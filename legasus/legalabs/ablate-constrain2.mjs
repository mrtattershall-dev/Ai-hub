// ABLATING CONSTRAIN — REVISION 2, with the repair machinery removed from the ablation itself.
//
// REVISION 1 IS METHODOLOGICALLY FLAWED AND ITS CATEGORY COUNTS ARE VOID. It extracted a guard and a
// return from anywhere inside the refused output - including from inside a returned function - and
// assembled that. Turning CONSTRAIN off must mean REMOVING ITS REJECTION AUTHORITY, not repairing the
// proposal until the assembler can consume it. Revision 1 measured
//
//     CONSTRAIN OFF + repair machinery
//
// which is a different configuration and a more flattering one. The finding it reported - that the old
// envelope discarded correct `elif` programs - is independently established elsewhere; what is void is
// the CATEGORY DECOMPOSITION, because every "assemblable" verdict passed through a transformation.
//
// WHAT COUNTS AS "UNCHANGED", frozen before any raw was examined:
//
//   DECODING is allowed   stripping a markdown code fence, trimming trailing whitespace. These are
//                         transport, not content: the fence is how the output arrived, not what it said.
//   EVERYTHING ELSE is repair. No extraction, no re-indentation, no dropping a line, no choosing a
//                         fragment out of a larger block. The proposal is inserted VERBATIM at the
//                         marker, with its own indentation, exactly as it came.
//
// THE FOUR CATEGORIES, also frozen before looking:
//
//   A UNASSEMBLABLE          the raw proposal cannot enter the downstream interface unchanged
//                            -> CONSTRAIN provides INTERFACE PROTECTION: PROVE cannot be pointed at it
//   B ASSEMBLABLE, PROVE FAILS   the gate refused it and verification independently rejects it too
//                            -> CHEAP EARLY REJECTION: semantically redundant, saves assembly and runs
//   C ASSEMBLABLE, PROVE PASSES  the gate refused something satisfying the whole downstream contract
//                            -> and this splits in two, because the first run showed the category as
//                               stated is not a defect indicator:
//     C_SCOPE     the proposal also TOUCHES A DECLARED-FIXED LINE. It satisfies the contract by
//                 exceeding the authority it was granted - a whole-function rewrite that redefines
//                 `classify` and happens to be right. Refusing it is CONSTRAIN doing its job: the
//                 envelope bounds the KIND of attempt, and a rewrite is a different kind even when
//                 its content is correct.
//     C_SEMANTIC  the proposal stayed inside the granted authority AND satisfies the contract.
//                 THIS is empirical over-constraint, and it is the only one of the two that is a defect.
//   D APPARATUS-UNDETERMINED     cannot be evaluated without changing the proposal or relying on
//                            unsupported semantics - a truncated raw, for instance
//
// The output is a FUNCTIONAL DECOMPOSITION, not a headline percentage. "CONSTRAIN improves correctness
// by X%" is the wrong shape of answer: the component defines part of the interface to everything
// downstream, so removing it makes some of the pipeline undefined rather than merely worse.
//
// CATEGORY C IS HELD TO A HIGHER STANDARD THAN THE PROBES. Passing the contract probes is not proof the
// gate was wrong - this project has already learned that a surviving candidate may be legal or may be
// outside the probe set. Every C candidate is additionally checked by a DENSE sweep against the
// contract's own expectation, and one that disagrees anywhere is reported as C-WEAK rather than C.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { contractProbes, checkProbes, containsPoint } from '../legaverify/probes.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FILES = process.argv.slice(2);
if (!FILES.length) { console.log('usage: ablate-constrain2.mjs <RESULT json> [...]'); process.exit(1); }

const SHAPES = {
  S_UPPER: { lines: ['def classify(n):', '    if n == 3:', '        return "three"',
    '    if n > 100000:', '        return "vast"', '    return "other"'],
  preservedCond: 'n == 3', domainPhrase: 'below 10', result: '"small"' },
  S_LOWER: { lines: ['def classify(n):', '    if n == 200:', '        return "twohundred"',
    '    if n < 0:', '        return "negative"', '    return "other"'],
  preservedCond: 'n == 200', domainPhrase: 'above 100', result: '"big"' },
  S_IVAL: { lines: ['def classify(n):', '    if n < 0:', '        return "negative"',
    '    if n > 100000:', '        return "vast"', '    return "other"'],
  preservedCond: 'n < 0', domainPhrase: 'below 10', result: '"small"' },
  S_STRADDLE: { lines: ['def classify(n):', '    if n > 5:', '        return "big"', '    return "other"'],
  preservedCond: 'n > 5', domainPhrase: 'below 10', result: '"small"' },
};

function planShape(key) {
  const s = SHAPES[key];
  const src = s.lines.join(NL);
  const preserved = existingBehaviours(src, 'classify').find((b) => b.condition === s.preservedCond);
  const delta = 'For values ' + s.domainPhrase + ', return ' + s.result + '.';
  const req = requestedBehaviour(delta, 'n', { soleParameter: true });
  const prec = derivePrecedence({ preservation_text: 'Preserve the existing special handling.',
    delta_text: delta, existing: { condition: preserved.condition, result: preserved.result },
    requested: { condition: req.condition, result: req.result } }, overlap(preserved.domain, req.domain));
  const before = prec.winner === 'requested';
  return { s, src, lines: s.lines, preserved, req, prec,
    insertAfter: before ? preserved.line - 1 : preserved.line + 1 };
}

// DECODING ONLY. If this function ever grows a transformation, the ablation stops being an ablation.
//
// AND IT DID. The first version matched the fence as ```python\s* - and \s* ATE THE FIRST LINE'S
// INDENTATION. A proposal of four-space `elif n < 10:` arrived as column-zero `elif n < 10:`, which
// cannot be inserted into a function body, so every one of them was classified UNASSEMBLABLE. Sixty-one
// refusals landed in category A for a reason that was entirely my decoder.
//
// Caught by ASSEMBLING ONE BY HAND and running it, rather than by reasoning about the counts: the same
// four-space elif loads fine and returns "small". A category decomposition is only as good as the
// assembly under it, and the way to check an assembly is to run it.
//
// The fence is now consumed as the tag plus trailing spaces plus EXACTLY ONE newline. Everything after
// that, including leading whitespace, is content.
function decode(raw) {
  const fence = String(raw).match(/```(?:python)?[ \t]*\r?\n([\s\S]*?)```/);
  const body = fence ? fence[1] : String(raw);
  return body.replace(/\s+$/, '');
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'ab2-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'] });
    const m = new Map();
    inputs.forEach((v, i) => {
      const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      m.set(v, mm ? mm[1].trim() : 'MISSING');
    });
    return m;
  } catch (e) { return null; }
}

const origCache = new Map();
const originalFor = (p) => (v) => {
  const k = p.s.preservedCond + '|' + v;
  if (!origCache.has(k)) {
    const m = runProgram(p.src, [v]);
    origCache.set(k, m ? m.get(v) : 'ERROR');
  }
  return origCache.get(k);
};

const probeCache = new Map();
function probesFor(key, p) {
  if (!probeCache.has(key)) {
    probeCache.set(key, contractProbes({ requested: p.req.domain,
      requestedResult: p.req.result.replace(/"/g, ''), preserved: p.preserved.domain,
      preservedWins: p.prec.winner === 'existing',
      existing: existingBehaviours(p.src, 'classify') }, originalFor(p)));
  }
  return probeCache.get(key);
}

// The stronger evidence category C is held to: every integer in a wide band, against the contract's
// own expectation rather than against a probe list.
function denseAgrees(p, program) {
  const inputs = [];
  for (let v = -300; v <= 300; v++) inputs.push(v);
  inputs.push(-1000000, -10000, 10000, 1000000, 100001, 99999);
  const orig = runProgram(p.src, inputs);
  const cand = runProgram(program, inputs);
  if (!orig || !cand) return false;
  const wins = p.prec.winner === 'existing';
  for (const v of inputs) {
    const claimed = containsPoint(p.req.domain, v);
    const held = wins && containsPoint(p.preserved.domain, v);
    const expected = claimed && !held ? p.req.result.replace(/"/g, '') : orig.get(v);
    if (cand.get(v) !== expected) return false;
  }
  return true;
}

const cat = { A: 0, B: 0, C_SEMANTIC: 0, C_SCOPE: 0, C_WEAK: 0, D: 0 };
const byReason = {};
const cExamples = {};
const sExamples = {};
for (const f of FILES) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  for (const cell of Object.values(data.cells)) {
    const shape = cell.shape;
    if (!shape || !SHAPES[shape]) continue;
    const p = planShape(shape);
    const probes = probesFor(shape, p);
    for (const row of cell.rows || []) {
      if (row.authorized !== false) continue;
      const reason = row.reason || 'unknown';
      const b = byReason[reason] = byReason[reason] || { A: 0, B: 0, C_SEMANTIC: 0, C_SCOPE: 0, C_WEAK: 0, D: 0 };
      const raw = row.raw || '';
      if (raw.length >= 139) { cat.D++; b.D++; continue; }      // truncated on the way to disk
      const proposal = decode(raw);
      if (!proposal.trim()) { cat.D++; b.D++; continue; }
      // VERBATIM insertion. No re-indentation, no extraction, no selection.
      const program = L(...p.lines.slice(0, p.insertAfter + 1), proposal,
        ...p.lines.slice(p.insertAfter + 1));
      const res = runProgram(program, probes.map((x) => x.input));
      if (!res) { cat.A++; b.A++; continue; }                   // does not load unchanged
      const ok = checkProbes(probes, (v) => res.get(v)).passed;
      if (!ok) { cat.B++; b.B++; continue; }
      if (!denseAgrees(p, program)) { cat.C_WEAK++; b.C_WEAK++; continue; }
      // MECHANICAL, not a judgement call: did the proposal touch a line declared FIXED? That is the
      // authority it was not granted, and it is the same rule the envelope already enforces.
      const fixed = new Set(p.lines.map((l) => l.trim()));
      const touchesFixed = proposal.split(NL).some((l) => fixed.has(l.trim()));
      const k = reason + ' :: ' + proposal.replace(/\s+/g, ' ').trim().slice(0, 60);
      if (touchesFixed) { cat.C_SCOPE++; b.C_SCOPE++; sExamples[k] = (sExamples[k] || 0) + 1; }
      else { cat.C_SEMANTIC++; b.C_SEMANTIC++; cExamples[k] = (cExamples[k] || 0) + 1; }
    }
  }
}

const total = cat.A + cat.B + cat.C_SEMANTIC + cat.C_SCOPE + cat.C_WEAK + cat.D;
console.log('  ABLATING CONSTRAIN, revision 2 - rejection authority removed, NOTHING repaired');
console.log('  no GPU time: every refused output replayed is already on disk');
console.log('');
console.log('  FUNCTIONAL DECOMPOSITION of ' + total + ' refusals');
console.log('    A  interface protection   ' + String(cat.A).padStart(3)
  + '   the proposal does not load unchanged; PROVE cannot be pointed at it');
console.log('    B  cheap early rejection  ' + String(cat.B).padStart(3)
  + '   PROVE rejects it too; the gate saved an assembly and a run');
console.log('    C- SCOPE (correct refusal) ' + String(cat.C_SCOPE).padStart(3)
  + '   satisfies the contract by TOUCHING A FIXED LINE - authority it was not granted');
console.log('    C  FALSE REJECTION        ' + String(cat.C_SEMANTIC).padStart(3)
  + '   satisfies the contract AND stayed inside its authority - the only defect category');
console.log('    C- weak false rejection   ' + String(cat.C_WEAK).padStart(3)
  + '   passes the probes but the dense sweep disagrees somewhere');
console.log('    D  undetermined           ' + String(cat.D).padStart(3)
  + '   not evaluable without changing the proposal');
console.log('');
for (const [reason, b] of Object.entries(byReason).sort((x, y) =>
  (y[1].A + y[1].B + y[1].C_SCOPE + y[1].C_SEMANTIC + y[1].C_WEAK + y[1].D)
  - (x[1].A + x[1].B + x[1].C_SCOPE + x[1].C_SEMANTIC + x[1].C_WEAK + x[1].D))) {
  console.log('    ' + reason.padEnd(38) + ' A ' + String(b.A).padStart(3) + '  B ' + String(b.B).padStart(3)
    + '  Cscope ' + String(b.C_SCOPE).padStart(3) + '  Csem ' + String(b.C_SEMANTIC).padStart(3)
    + '  Cweak ' + String(b.C_WEAK).padStart(3) + '  D ' + String(b.D).padStart(3));
}
if (cat.C_SCOPE) {
  console.log('');
  console.log('  C-SCOPE - correct by content, refused for taking authority it was not granted:');
  for (const [k, n] of Object.entries(sExamples).sort((a, b2) => b2[1] - a[1]).slice(0, 6)) {
    console.log('      ' + String(n).padStart(3) + 'x  ' + k);
  }
}
if (cat.C_SEMANTIC) {
  console.log('');
  console.log('  CATEGORY C - THE DEFECT: refused, inside its authority, and satisfies the contract:');
  for (const [k, n] of Object.entries(cExamples).sort((a, b2) => b2[1] - a[1]).slice(0, 10)) {
    console.log('      ' + String(n).padStart(3) + 'x  ' + k);
  }
}
console.log('');
console.log('  A is the only category where CONSTRAIN is doing something PROVE structurally cannot.');
console.log('  B is cost. C is a defect. There is no single percentage that says all three.');
