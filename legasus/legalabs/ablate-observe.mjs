// ABLATING OBSERVE — does knowing the current program contribute causal information?
//
// WHAT "OBSERVE OFF" MEANS, FROZEN BEFORE ANY PERTURBATION. It does NOT mean "choose a wrong site".
// An ablation that picks a location known to break things is guaranteed to fail by construction and
// proves nothing. It means:
//
//     replace the OBSERVE-derived location with a TASK-INDEPENDENT location policy that has no access
//     to the relevant program fact
//
// The relevant fact here is WHERE THE PRESERVED BEHAVIOUR SITS and which behaviour wins the overlap.
// Both blind policies below know only that they are inserting into a function body - the minimum any
// inserter must know - and consult nothing about ownership, scope, or precedence.
//
//   OBSERVE_ON      insertion point derived from the program: after the preserved guard, because
//                   DECIDE ruled that the existing behaviour wins
//   BLIND_TOP       immediately after the `def` line. Task-independent, presentation-relative.
//   BLIND_BOTTOM    immediately before the unit's last line. Also task-independent.
//
// TWO blind policies rather than one, deliberately. A single blind policy that fails could have been
// an unlucky choice; two that disagree with each other tell us something about WHICH program fact is
// carrying the information.
//
// EVERYTHING ELSE IS HELD FIXED: the same recorded fragments, the same DECIDE output, the same RENDER
// artifact, the same CONSTRAIN policy, the same PROVE probes. Only the placement changes.
//
// PREDICTION, WRITTEN BEFORE RUNNING:
//
//   BLIND_TOP fails broadly. Placing the new guard before the preserved one shadows the preserved
//   behaviour wherever the domains overlap, which is the whole reason DECIDE derives a precedence.
//
//   BLIND_BOTTOM largely SUCCEEDS, and that is the interesting half. In these programs the preserved
//   behaviour already sits near the top, so appending at the end happens to satisfy the precedence
//   ruling without deriving it. If that holds, OBSERVE's causal contribution in THIS family is
//   specifically "do not place the new behaviour ahead of a preserved one that would shadow it" - and
//   a naive append achieves that here by luck of source order rather than by reasoning.
//
// A result where BOTH blind policies fail would make OBSERVE straightforwardly load-bearing. A result
// where BOTH succeed would mean placement carries no information in this family and the derivation is
// unearned. The partial result is the most likely and the most informative, and it is recorded as a
// prediction so it cannot be narrated afterwards as though it were the expected outcome all along.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { contractProbes, checkProbes } from '../legaverify/probes.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FILES = process.argv.slice(2);
if (!FILES.length) { console.log('usage: ablate-observe.mjs <RESULT json> [...]'); process.exit(1); }

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
    derived: before ? preserved.line - 1 : preserved.line + 1,
    blindTop: 0,                             // immediately after the def line
    blindBottom: s.lines.length - 2 };       // immediately before the unit's last line
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'obs-'));
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

const POLICIES = ['derived', 'blindTop', 'blindBottom'];
const tally = {};
for (const f of FILES) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  for (const cell of Object.values(data.cells)) {
    const shape = cell.shape;
    if (!shape || !SHAPES[shape]) continue;
    const p = planShape(shape);
    const probes = probesFor(shape, p);
    const inputs = probes.map((x) => x.input);
    const t = tally[shape] = tally[shape] || { n: 0, derived: 0, blindTop: 0, blindBottom: 0,
      at: { derived: p.derived, blindTop: p.blindTop, blindBottom: p.blindBottom } };
    for (const row of cell.rows || []) {
      if (row.authorized !== true || !row.code) continue;
      const m = String(row.code).match(/^(if\s.*?:)\s*(return\s.*)$/);
      if (!m) continue;
      const code = '    ' + m[1] + NL + '        ' + m[2];
      t.n++;
      for (const pol of POLICIES) {
        const at = p[pol];
        const program = L(...p.lines.slice(0, at + 1), code, ...p.lines.slice(at + 1));
        const res = runProgram(program, inputs);
        if (res && checkProbes(probes, (v) => res.get(v)).passed) t[pol]++;
      }
    }
  }
}

console.log('  ABLATING OBSERVE - derived placement against two OBSERVATION-BLIND policies');
console.log('  no GPU time: the same recorded fragments, three placements each');
console.log('');
const tot = { n: 0, derived: 0, blindTop: 0, blindBottom: 0 };
for (const [shape, t] of Object.entries(tally)) {
  console.log('  ' + shape.padEnd(11) + ' fragments ' + String(t.n).padStart(3)
    + '   DERIVED(after line ' + t.at.derived + ') ' + String(t.derived).padStart(3)
    + '   BLIND_TOP(after 0) ' + String(t.blindTop).padStart(3)
    + '   BLIND_BOTTOM(after ' + t.at.blindBottom + ') ' + String(t.blindBottom).padStart(3));
  for (const k of ['n', 'derived', 'blindTop', 'blindBottom']) tot[k] += t[k];
}
console.log('');
console.log('  TOTAL ' + tot.n + ' fragments    DERIVED ' + tot.derived
  + '    BLIND_TOP ' + tot.blindTop + '    BLIND_BOTTOM ' + tot.blindBottom);
console.log('');
console.log('  A component is not proven necessary because good results occurred while it was enabled.');
console.log('  It is proven load-bearing when removing ONLY that component causes the predicted failure.');
