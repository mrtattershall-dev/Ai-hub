// Score LegaCore's derived constraints against the EXECUTABLE ground truth.
//
// THE SCORING RULE THAT MAKES A RECOVERED BIT MEAN SOMETHING:
//
//     A constraint's gain counts ONLY IF every boundary it removed genuinely fails when executed.
//
// Remove one position that actually passes and the constraint is manufacturing information - it has
// narrowed the model's authority on a claim the program does not support. Those are counted separately
// as OVER-CONSTRAINT and never contribute gain, because a system rewarded for confident narrowing will
// learn to narrow confidently.
//
// The ground truth is read HERE and never by the deriver. constraints.mjs sees the source and the
// planned operations only.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { constrain, verify } from './constraints.mjs';
// The SAME reconstruction the ground truth was built with. This scorer used to rebuild the patch
// blocks itself and normalized trailing newlines differently, so its text and the ground truth's text
// disagreed, every line number shifted, and an entire scoring run compared misaligned positions while
// looking completely plausible. `base_lines` is asserted below so a future divergence fails loudly
// instead of producing a number.
import { reconstruct, baseFor } from '../legalabs/substrate/narrowability.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/';
const SUB = ROOT + (process.argv[2] || 'provenance');

const GT = JSON.parse(readFileSync(join(SUB, 'GROUNDTRUTH.json'), 'utf8'));

// PER-KIND EXPECTATIONS. Each task in the generalization family preregisters WHICH constraint kind it
// tests and whether that kind SHOULD or SHOULD NOT fire. Reporting per kind is the point: an aggregate
// can be carried entirely by one rule while the others are wrong.
//
// This is a REPORTING change made before the run. The scoring rule - gain counts only if every removed
// boundary genuinely fails - is untouched.
const EXP = existsSync(join(SUB, 'EXPECTED.json'))
  ? JSON.parse(readFileSync(join(SUB, 'EXPECTED.json'), 'utf8')) : { tasks: [] };
const KIND = new Map((EXP.tasks || []).filter((t) => t.kind).map((t) => [t.id, t]));

// The parent range an operation sits in, by indentation - the same notion the candidate sweep used.
function parentRangeFor(src, refPos, indent) {
  const lines = src.split(NL);
  if (indent === 0) return { lo: 0, hi: lines.length - 1 };
  for (let i = refPos; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)(?:def|class)\b/);
    if (!m || m[1].length >= indent) continue;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (ind(lines[j]) <= m[1].length) break;
      end = j;
    }
    return { lo: i + 1, hi: end };
  }
  return { lo: 0, hi: lines.length - 1 };
}

let opsSeen = 0; let recovered = 0; let over = 0; let clean0 = 0; let missed = 0;
let bitsDerived = 0; let bitsAvailable = 0;
let styleFired = 0; let styleNarrowed = 0; let replayFail = 0;
const rows = [];

for (const t of GT) {
  const dir = join(SUB, t.task);
  if (!existsSync(join(dir, 'task.json'))) continue;
  const recon = reconstruct(dir);
  const blocks = recon.full.map((f) => f.code);

  for (let k = 0; k < t.rows.length; k++) {
    const row = t.rows[k];
    if (row.intra_line || row.error || !row.candidate_positions) continue;
    opsSeen++;
    // COORDINATES. The ground truth numbers candidate positions against the text with the OTHER
    // operations already applied, not against the original source. Deriving constraints against the
    // original would misalign every position silently, since line numbers still exist there. It is
    // also the right context semantically: when LegaCore reasons about where op_k may go, the rest of
    // the transaction is part of the program it is reasoning about.
    const base = baseFor(recon, k);
    if (base === null) continue;
    // ALIGNMENT ASSERTION. If this text is not the one the candidate positions were numbered against,
    // every comparison below is meaningless - and meaningless in the worst way, since the numbers still
    // look reasonable. Fail loudly rather than score.
    if (row.base_lines !== undefined && base.split(NL).length !== row.base_lines) {
      console.log('  MISALIGNED  ' + t.task + ':' + row.op + '  ground truth was built against '
        + row.base_lines + ' lines, this text has ' + base.split(NL).length + ' - refusing to score');
      process.exitCode = 1;
      continue;
    }
    const code = blocks[k] || '';
    const indent = ind(code.split(NL).find((l) => l.trim()) || '');
    const provides = [];
    for (const m of code.matchAll(/^\s*(?:def|class)\s+(\w+)/gm)) provides.push(m[1]);
    for (const m of code.matchAll(/^([A-Za-z_]\w*)\s*=(?!=)/gm)) provides.push(m[1]);
    const siblingKind = /^\s*def\b/m.test(code) ? 'def' : null;

    const ctx = { src: base, indent, provides, siblingKind,
      operation_id: t.task + ':' + row.op,
      parentRange: parentRangeFor(base, row.ref_position, indent) };

    const res = constrain(ctx, row.candidate_positions);
    const rep = verify(ctx, res.chain);
    if (!rep.all_replayed) replayFail++;

    const failing = new Set(row.failing_positions || []);
    const removed = res.chain.flatMap((c) => c.removed_positions || []);
    const wrongly = removed.filter((p) => !failing.has(p));
    const style = res.chain.filter((c) => c.kind === 'canonical_realization');
    if (style.length) styleFired++;
    if (style.some((c) => (c.removed_positions || []).length || c.gain_bits > 0)) styleNarrowed++;

    const maxBits = row.max_gain_bits || 0;
    bitsAvailable += maxBits;
    const honest = wrongly.length === 0;
    const gained = honest ? res.total_gain_bits : 0;
    if (honest) bitsDerived += Math.min(gained, maxBits);

    let verdict;
    if (!row.narrowable) verdict = (removed.length === 0) ? 'CORRECT-0' : 'OVER-CONSTRAINT';
    else if (wrongly.length) verdict = 'OVER-CONSTRAINT';
    else if (removed.length) verdict = 'RECOVERED';
    else verdict = 'missed';
    if (verdict === 'RECOVERED') recovered++;
    else if (verdict === 'OVER-CONSTRAINT') over++;
    else if (verdict === 'CORRECT-0') clean0++;
    else missed++;

    rows.push({ task: t.task, op: ctx.operation_id, verdict, narrowable: row.narrowable,
      cand: row.candidates, truth: row.passing, derived: res.constrained,
      gained, maxBits, wrongly: wrongly.length,
      kinds: res.chain.filter((c) => (c.removed_positions || []).length).map((c) => c.kind) });
  }
}

for (const r of rows) {
  console.log('  ' + r.verdict.padEnd(16) + r.op.padEnd(12)
    + ' cand ' + String(r.cand).padStart(3)
    + '  truth-passes ' + String(r.truth).padStart(3)
    + '  derived ' + String(r.derived).padStart(3)
    + '  gain ' + r.gained.toFixed(2) + '/' + r.maxBits.toFixed(2)
    + (r.wrongly ? '  WRONGLY REMOVED ' + r.wrongly : '')
    + (r.kinds.length ? '  [' + [...new Set(r.kinds)].join(',') + ']' : ''));
}

const narrowableOps = rows.filter((r) => r.narrowable).length;

// ---- PER KIND FIRST. The aggregate comes after, because an aggregate can be carried entirely by one
// rule while the others are wrong - which is exactly the state this family was built to resolve.
if (KIND.size) {
  console.log('');
  console.log('  ---- PER CONSTRAINT KIND (the aggregate is reported after this, not instead of it)');
  const byKind = new Map();
  for (const [id, spec] of KIND) {
    if (!byKind.has(spec.kind)) byKind.set(spec.kind, { POSITIVE: null, NEGATIVE: null });
    const rs = rows.filter((r) => r.task === id);
    const fired = rs.flatMap((r) => r.kinds);
    byKind.get(spec.kind)[spec.half] = {
      id,
      narrowable: rs.filter((r) => r.narrowable).length,
      ops: rs.length,
      firedOwn: fired.filter((k) => k === spec.kind).length,
      firedAny: [...new Set(fired)],
      over: rs.filter((r) => r.wrongly > 0).length,
      bits: rs.reduce((a, r) => a + r.gained, 0),
      avail: rs.reduce((a, r) => a + r.maxBits, 0),
    };
  }
  for (const [kind, halves] of byKind) {
    console.log('');
    console.log('  ' + kind);
    for (const half of ['POSITIVE', 'NEGATIVE']) {
      const h = halves[half];
      if (!h) continue;
      // A positive case must fire its own kind. A negative case must NOT, and must not over-constrain.
      const ok = half === 'POSITIVE' ? (h.firedOwn > 0 && h.over === 0) : (h.firedOwn === 0 && h.over === 0);
      console.log('    ' + (ok ? 'PASS  ' : 'FAIL  ') + half.padEnd(9) + h.id
        + '  narrowable ' + h.narrowable + '/' + h.ops
        + '  this kind fired on ' + h.firedOwn + ' op(s)'
        + '  over-constraint ' + h.over
        + '  bits ' + h.bits.toFixed(2) + '/' + h.avail.toFixed(2));
      if (h.firedAny.length) console.log('          kinds that narrowed: ' + h.firedAny.join(', '));
    }
  }
}

console.log('');
console.log('  ---- LegaCore constraint derivation, against executable ground truth');
console.log('  operations scored          ' + opsSeen + '   (narrowable ' + narrowableOps + ')');
console.log('  RECOVERED                  ' + recovered + '   narrowed, and every removed boundary really fails');
console.log('  missed                     ' + missed + '   narrowable, nothing derived');
console.log('  OVER-CONSTRAINT            ' + over + '   removed a boundary that actually passes');
console.log('  correct zero               ' + clean0 + '   position-independent and left alone');
console.log('  witnesses that replayed    ' + (opsSeen - replayFail) + '/' + opsSeen);
console.log('');
console.log('  PRIMARY   recovered ' + recovered + ' of ' + narrowableOps + ' narrowable   (v6 target: >= 15 of 26)');
console.log('  SECONDARY realized available information '
  + (bitsAvailable ? (100 * bitsDerived / bitsAvailable).toFixed(1) : '0') + '%   ('
  + bitsDerived.toFixed(2) + ' of ' + bitsAvailable.toFixed(2) + ' bits)   DIAGNOSTIC ONLY');
console.log('');
console.log('  STYLE CONTROL  canonical_realization fired on ' + styleFired + ' operation(s) and narrowed '
  + styleNarrowed + '.');
console.log('  A style constraint that narrows anything is a milestone failure regardless of score.');
