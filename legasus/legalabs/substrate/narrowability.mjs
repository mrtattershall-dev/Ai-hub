// NARROWABILITY, established by EXECUTION rather than by assertion.
//
// v6 reports realized gain over a denominator of "independently narrowable operations". If that
// denominator is my judgement, the whole measurement is circular - the system gets credit for finding
// constraints I decided existed. So narrowability is defined operationally and proven by running code:
//
//     An operation is NARROWABLE when at least one position inside its structural parent BREAKS the
//     transaction. The set of positions that still pass is its TRUE CONSTRAINED REGION, and the
//     maximum honestly derivable gain is log2(candidates / passing).
//
// This is ground truth that no planner produced. LegaCore will later be scored on how much of it it
// can DERIVE from witnessed transaction semantics - and it cannot be rewarded for narrowing beyond
// what execution says is real, because positions outside the passing set genuinely fail.
//
// An operation where EVERY position passes is not a miss. It is position-independent, 0 bits is its
// correct answer, and v6 requires those to stay at 0.
//
// LIMITS, stated rather than discovered later:
//   - single-operation moves only; joint reorderings of two operations are not explored
//   - candidate positions are line boundaries sharing the reference's structural parent, which is the
//     same search space the two-axis score already uses as its denominator
//   - "passes" means the sealed delta and preservation probes pass. A position that breaks something
//     no probe observes is counted as passing, so this UNDERSTATES narrowability. Understating the
//     denominator is the conservative direction: it makes realized gain harder to claim, not easier.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { structuralParent } from '../../legaparse/siteclass.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// Apply operations by anchor, re-anchored against the current text at each step - the same discipline
// the transaction harness uses, for the same reason.
export function applyByAnchor(src, ops) {
  let cur = src;
  for (const op of ops) {
    const n = cur.split(op.anchor).length - 1;
    if (n !== 1) return null;
    const at = cur.indexOf(op.anchor) + op.anchor.length;
    cur = cur.slice(0, at) + op.code + cur.slice(at);
  }
  return cur;
}

// Insert a block of code immediately after line `pos` (0-indexed) of `text`.
function insertAfterLine(text, pos, code) {
  const lines = text.split(NL);
  const head = lines.slice(0, pos + 1).join(NL);
  const tail = lines.slice(pos + 1).join(NL);
  return head + NL + code.replace(/\n$/, '') + NL + tail;
}

function runProbe(lang, sourceName, sourceText, probeText) {
  const ws = mkdtempSync(join(tmpdir(), 'narrow-'));
  writeFileSync(join(ws, sourceName), sourceText, 'utf8');
  const probeName = lang === 'py' ? '_probe.py' : '_probe.js';
  writeFileSync(join(ws, probeName), probeText, 'utf8');
  try {
    const out = execFileSync(lang === 'py' ? 'python' : 'node', [probeName],
      { cwd: ws, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
    return /\bOK\b/.test(out);
  } catch { return false; }
}

// Candidate positions: line boundaries in `text` whose structural parent matches the reference's, which
// is exactly the denominator the two-axis score already counts.
function candidates(text, refPos, indent) {
  const lines = text.split(NL);
  const target = (structuralParent(text, refPos, indent) || { line: -1 }).line;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const p = structuralParent(text, i, indent);
    if ((p ? p.line : -1) !== target) continue;
    // Never split a compound header from its body: inserting between `if x:` and its first statement
    // is a syntax error, not a placement choice.
    if (/:\s*$/.test(lines[i])) continue;
    out.push(i);
  }
  return out;
}

// ONE RECONSTRUCTION, USED BY EVERY CONSUMER.
//
// The scorer used to rebuild the patch blocks itself, normalizing trailing newlines differently from
// this file. The texts then differed, every line number shifted, and position comparisons between
// derived constraints and this ground truth were silently misaligned - invalidating an entire scoring
// run that looked completely plausible.
//
// Two reconstructions of one artifact that MUST agree, with nothing enforcing agreement, is the same
// hazard shape as the rest of the ledger. The fix is not to copy the normalization more carefully; it
// is to have exactly one of it.
export function reconstruct(dir) {
  const task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
  const oracle = JSON.parse(readFileSync(join(dir, 'evidence', 'oracle.json'), 'utf8'));
  const srcName = readdirSync(join(dir, 'source'))[0];
  const src = readFileSync(join(dir, 'source', srcName), 'utf8');
  const lang = task.language || 'py';
  const patch = readFileSync(join(dir, 'evidence', 'reference.patch'), 'utf8');
  // Built from character codes rather than escape sequences. Every time this normalization has passed
  // through a shell it has arrived corrupted, and a regex literal broken this way is not always a
  // syntax error - it can silently change meaning instead.
  const LEAD = new RegExp('^' + NL);
  const TRAIL = new RegExp(NL + '+$');
  const blocks = patch.split(/^--- op .*$/m).slice(1).map((b) => b.replace(LEAD, '').replace(TRAIL, NL));
  const full = oracle.transaction.operations.map((o, i) => ({ id: o.id, anchor: o.site_hint, code: blocks[i] }));
  return { task, oracle, srcName, src, lang, full };
}

// The text an operation is placed into: the source with every OTHER operation already applied. This is
// the coordinate system every candidate position is numbered against.
export function baseFor(recon, k) {
  return applyByAnchor(recon.src, recon.full.filter((_, j) => j !== k));
}

export function proveTask(dir) {
  const recon = reconstruct(dir);
  const { task, oracle, srcName, src, lang } = recon;
  // Probes live as files under evidence/probes, not inside the oracle JSON.
  const pdir = join(dir, 'evidence', 'probes');
  const ext = lang === 'py' ? '.py' : '.js';
  const delta = existsSync(join(pdir, 'delta' + ext)) ? readFileSync(join(pdir, 'delta' + ext), 'utf8') : null;
  const preserve = existsSync(join(pdir, 'preservation' + ext))
    ? readFileSync(join(pdir, 'preservation' + ext), 'utf8') : null;
  const ops = oracle.transaction.operations;
  if (!delta) return { id: task.task_id, error: 'oracle carries no delta probe' };

  const full = recon.full;

  // Sanity: the reference itself must pass, or nothing below means anything.
  const ref = applyByAnchor(src, full);
  if (!ref || !runProbe(lang, srcName, ref, delta)) {
    return { id: task.task_id, error: 'the reference transaction does not pass its own delta probe' };
  }

  const rows = [];
  for (let k = 0; k < full.length; k++) {
    // INTRA-LINE OPERATIONS ARE A THIRD CATEGORY, not an untestable one. An op whose anchor stops
    // mid-line edits an EXPRESSION - `, "rect"` goes inside a list literal - so its position is fixed
    // by the expression it modifies and a line-boundary search space does not describe it at all. The
    // first version of this prover swept line boundaries for them, produced a syntax error at every
    // candidate, and reported "0 of 27 passing", which reads as a property of the program and is a
    // property of the instrument.
    //
    // They are excluded from the v6 denominator. Counting them as narrowable would inflate it with
    // operations whose placement was never in question - the same denominator error the goal-coupling
    // audit caught earlier in this project.
    if (!full[k].anchor.endsWith(NL)) {
      rows.push({ op: full[k].id, intra_line: true, candidates: null, passing: null,
        narrowable: false, max_gain_bits: null,
        note: 'intra-line: edits an expression, so its position is fixed by that expression rather '
          + 'than chosen among line boundaries; outside this measurement’s search space' });
      continue;
    }
    const others = full.filter((_, j) => j !== k);
    const base = applyByAnchor(src, others);
    if (base === null) { rows.push({ op: full[k].id, error: 'anchor not unique without this op' }); continue; }
    // Where the reference put it, in the base text.
    const at = base.indexOf(full[k].anchor);
    if (at < 0) { rows.push({ op: full[k].id, error: 'anchor missing from base' }); continue; }
    const refPos = base.slice(0, at + full[k].anchor.length - 1).split(NL).length - 1;
    const codeIndent = ind((full[k].code.split(NL).find((l) => l.trim()) || ''));
    const cands = candidates(base, refPos, codeIndent);

    const passing = [];
    for (const p of cands) {
      const text = insertAfterLine(base, p, full[k].code);
      const ok = runProbe(lang, srcName, text, delta)
        && (!preserve || runProbe(lang, srcName, text, preserve));
      if (ok) passing.push(p);
    }
    const narrowable = passing.length > 0 && passing.length < cands.length;
    rows.push({ op: full[k].id, ref_position: refPos,
      base_lines: base.split(NL).length,
      candidates: cands.length, candidate_positions: cands,
      failing_positions: cands.filter((p) => !passing.includes(p)),
      passing: passing.length, passing_positions: passing,
      narrowable,
      max_gain_bits: passing.length > 0 ? Math.log2(cands.length / passing.length) : null,
      note: passing.length === cands.length ? 'position-independent: every candidate passes, 0 bits is correct'
        : passing.length === 0 ? 'NO candidate passes - the probe or the candidate set is wrong, not the program'
          : null });
  }
  return { id: task.task_id, rows };
}

const isMain = process.argv[1] && process.argv[1].endsWith('narrowability.mjs');
if (isMain) {
  const FAM = process.argv[2] || './provenance';
  const JSONOUT = process.argv[3] || null;         // optional: dump full per-position ground truth
  const dump = [];
  let narrowable = 0; let independent = 0; let broken = 0; let totalMax = 0; let intra = 0;
  for (const d of readdirSync(FAM).sort()) {
    if (!existsSync(join(FAM, d, 'task.json'))) continue;
    const r = proveTask(join(FAM, d));
    if (r.error) { console.log('  ' + d + '  ERROR ' + r.error); continue; }
    dump.push({ task: d, rows: r.rows });
    for (const row of r.rows) {
      if (row.error) { console.log('  ' + d + ' ' + row.op + '  ERROR ' + row.error); broken++; continue; }
      const kind = row.intra_line ? 'INTRA-LINE '
        : row.passing === 0 ? 'UNTESTABLE '
          : row.narrowable ? 'NARROWABLE ' : 'independent';
      if (row.intra_line) intra++;
      else if (row.passing === 0) broken++;
      else if (row.narrowable) { narrowable++; totalMax += row.max_gain_bits; }
      else independent++;
      console.log('  ' + d + ' ' + row.op.padEnd(4) + kind
        + '  candidates ' + String(row.candidates).padStart(3)
        + '  passing ' + String(row.passing).padStart(3)
        + '  max gain ' + (row.max_gain_bits === null ? 'n/a' : row.max_gain_bits.toFixed(2) + ' bits'));
    }
  }
  const total = narrowable + independent + broken + intra;
  console.log('');
  console.log('  ---- NARROWABILITY, proven by execution');
  console.log('  operations                ' + total);
  console.log('  NARROWABLE                ' + narrowable + '   <- the v6 denominator');
  console.log('  position-independent      ' + independent + '   0 bits is the CORRECT answer for these');
  console.log('  intra-line                ' + intra + '   position fixed by the expression, not a line boundary');
  console.log('  untestable                ' + broken + '   no candidate passes: instrument or probe, not program');
  if (narrowable) console.log('  mean max derivable gain   ' + (totalMax / narrowable).toFixed(2) + ' bits');
  console.log('');
  if (JSONOUT) {
    writeFileSync(JSONOUT, JSON.stringify(dump, null, 1), 'utf8');
    console.log('  per-position ground truth written to ' + JSONOUT);
  }
  console.log('  No planner produced any of this. It is what the program and its probes actually do,');
  console.log('  so LegaCore cannot be rewarded for narrowing past it - those positions really fail.');
}
