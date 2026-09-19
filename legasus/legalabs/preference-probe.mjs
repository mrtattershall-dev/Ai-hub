// THE PREFERENCE PROBE — offline, over artifacts already on disk. No GPU.
//
// THE FROZEN QUESTION: given two implementations of the same verified semantic contract, can
// domain-neutral metrics identify consistent quality dominance WITHOUT preferring a candidate merely
// because its syntax resembles a canonical realization?
//
// It promotes nothing and rejects nothing. Domination affects the CHAMPION, never ADMISSIBILITY.
//
// PLACEMENT ROBUSTNESS is measured by EXECUTION, not by taste: for a transaction of k operations, the
// fraction of all k! orderings under which the assembled program still satisfies the contract, with
// expectations held at the DERIVED order. A realization that stays correct across more legal arrangements
// plausibly dominates one whose correctness depends on a specific surrounding arrangement.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measure, DIMENSIONS, behavioralDimensions, descriptiveDimensions }
  from '../legareward/metrics.mjs';
import { compare, mayReplaceChampion, VERDICT } from '../legareward/dominance.mjs';
import { placementRobustness } from '../legareward/robustness.mjs';
import { makeTally, observed, unobservable, finding, conclude } from './nonvacuity.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FILE = process.argv[2] || 'measurements/2026-09-19-set-domains/RESULT.json';

const SRC_LINES = ['def classify(n):', '    if n == 3:', '        return "three"', '    return "other"'];
const INSERT_AFTER = 2;

// The requested domain of each operation across the families this probe reads, as the PLAN holds it.
const WANT = {
  evens: [2, 4, 6, 8], mid2: [4, 6], four: [4], odds: [1, 5, 7],
  micro: null, low: null, mid: null, five: null, fifty: null, high: null, cross: null,
};

const permutations = (xs) => (xs.length <= 1 ? [xs]
  : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'pref-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 20000 });
  const m = new Map();
  inputs.forEach((v, i) => {
    const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
    m.set(v, mm ? mm[1].trim() : 'MISSING');
  });
  return m;
}

const expand = (cond, result) => '    if ' + cond + ':' + NL + '        return "' + result + '"';
const assemble = (order, condByOp) => L(...SRC_LINES.slice(0, INSERT_AFTER + 1),
  ...order.map((id) => expand(condByOp[id], id)), ...SRC_LINES.slice(INSERT_AFTER + 1));

// Ground truth from the CONTRACT: the derived order decides who wins where domains overlap, and the
// preserved behaviour always wins at n == 3.
function expectationsFor(derivedOrder, condByOp, probeInputs) {
  const base = runProgram(assemble(derivedOrder, condByOp), probeInputs);
  return base;
}

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const tally = makeTally('preference probe');

// Group VERIFIED rows by (case, operation) and collect the distinct realizations of each.
const realizations = new Map();
for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  if (!c.order) continue;
  for (const row of c.rows) {
    if (!row.assembled || !row.verified || !row.perOp) continue;
    const condByOp = {};
    let ok = true;
    for (const [id, o] of Object.entries(row.perOp)) {
      if (!o.condition) { ok = false; break; }
      condByOp[id] = o.condition;
    }
    if (!ok) continue;
    for (const id of Object.keys(condByOp)) {
      const gk = c.case + ' | ' + id;
      if (!realizations.has(gk)) realizations.set(gk, new Map());
      const forms = realizations.get(gk);
      const form = condByOp[id];
      if (!forms.has(form)) {
        forms.set(form, { code: form, id, case: c.case, order: c.order, models: new Set(),
          sample: { ...condByOp } });
      }
      forms.get(form).models.add(c.model.replace('qwen2.5-coder:', ''));
    }
  }
}

// PLACEMENT ROBUSTNESS REV 2: the INSERTION POSITION is varied against the existing program, and the
// denominator is the positions where the unit still compiles. Rev 1 permuted the order of the new
// operations and its own evidence convicted it - it called `n < 10 and n != 3` and `n < 10` equally
// robust and then demoted the self-defending guard, while the middle family had measured 0.651 against
// 0.470 the other way.
const candidates = [];
for (const [gk, forms] of realizations) {
  for (const f of forms.values()) {
    const ops = f.order;
    if (ops.length < 2) continue;
    try {
      const inputs = [];
      for (let v = -3; v <= 12; v++) inputs.push(v);
      for (const v of [50, 101, -100]) inputs.push(v);

      // Ground truth from the CONTRACT: the derived order, assembled as the architecture would.
      const expected = expectationsFor(ops, f.sample, inputs);

      // The unit the guard is being placed into: the fixed source PLUS the transaction's other
      // operations in their derived order. Varying this guard's position against that is the real
      // deployment variation - neighbours move when files are edited.
      const others = ops.filter((id) => id !== f.id);
      const srcLines = [SRC_LINES[0],
        ...SRC_LINES.slice(1, INSERT_AFTER + 1),
        ...others.flatMap((id) => [expand(f.sample[id], id).split(NL)[0],
          expand(f.sample[id], id).split(NL)[1]]),
        ...SRC_LINES.slice(INSERT_AFTER + 1)];
      const guardLines = expand(f.code, f.id).split(NL);

      const rob = placementRobustness({ srcLines, guardLines, inputs, expected });
      candidates.push({ group: gk, code: f.code, id: f.id, case: f.case, verified: true,
        models: [...f.models].sort(),
        metrics: measure({ code: f.code, placementsLegal: rob.legal, placementsCorrect: rob.correct }),
        placements: rob.correct + '/' + rob.legal });
      observed(tally);
    } catch (e) {
      unobservable(tally, gk + ' | ' + f.code + '  ->  ' + String(e.message).split(NL)[0]);
    }
  }
}

const verdict = conclude(tally, {
  clean: 'every verified realization was evaluated.',
  dirty: (n) => n + ' unstable dominance(s) found.',
});
console.log('  SOURCE: ' + FILE);
console.log('');
console.log(verdict.text);
if (!verdict.ok) process.exit(1);

// ---- pairwise comparison, within a contract -----------------------------------------------------
const SURFACE = ['changedChars', 'branchPoints'];
const SUBSTANCE = Object.keys(DIMENSIONS).filter((d) => !SURFACE.includes(d));

const counts = { DOMINATES: 0, DOMINATED: 0, EQUIVALENT: 0, NO_PREFERENCE: 0, INCOMPARABLE: 0 };
const surfaceOnly = [];
const rows = [];
const byGroup = new Map();
for (const c of candidates) {
  if (!byGroup.has(c.group)) byGroup.set(c.group, []);
  byGroup.get(c.group).push(c);
}

for (const [group, pool] of byGroup) {
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]; const b = pool[j];
      const full = compare(a, b);
      counts[full.verdict]++;
      const sub = compare(a, b, { dimensions: SUBSTANCE });
      // A dominance that exists only on surface dimensions is a preference for a spelling.
      const onlySurface = (full.verdict === VERDICT.DOMINATES || full.verdict === VERDICT.DOMINATED)
        && sub.verdict === VERDICT.EQUIVALENT;
      if (onlySurface) surfaceOnly.push({ group, a: a.code, b: b.code, verdict: full.verdict });
      rows.push({ group, a: a.code, b: b.code, verdict: full.verdict, substance: sub.verdict,
        onlySurface, aModels: a.models, bModels: b.models,
        aPlace: a.placements, bPlace: b.placements });
    }
  }
}

const total = Object.values(counts).reduce((x, y) => x + y, 0);
console.log('');
console.log('  PAIRWISE VERDICTS over ' + candidates.length + ' verified realizations, '
  + total + ' within-contract pairs');
for (const [k, v] of Object.entries(counts)) {
  if (!v && k === 'INCOMPARABLE') continue;
  console.log('    ' + k.padEnd(16) + String(v).padStart(4)
    + (total ? '   ' + (100 * v / total).toFixed(1) + '%' : ''));
}

console.log('');
console.log('  THE ANTI-ORACLE ENDPOINT: dominances that vanish without the surface dimensions');
console.log('    dominances on the full vector      '
  + (counts.DOMINATES + counts.DOMINATED));
console.log('    of those, SURFACE-ONLY (weak)      ' + surfaceOnly.length);

console.log('');
console.log('  PAIRS  (placement robustness shown as correct/legal arrangements)');
for (const row of rows.slice(0, 24)) {
  console.log('    ' + row.group.padEnd(18) + row.verdict.padEnd(15)
    + (row.onlySurface ? 'SURFACE-ONLY  ' : '              ')
    + row.a + '  [' + row.aPlace + ']   vs   ' + row.b + '  [' + row.bPlace + ']');
}

// ---- PROMOTION under the rev 2 rule -------------------------------------------------------------
console.log('');
console.log('  PROMOTION — behavioral dimensions only. Descriptive gains may not take a champion.');
let promotions = 0; let blockedDescriptive = 0;
for (const [, pool] of byGroup) {
  for (let i = 0; i < pool.length; i++) {
    for (let j = 0; j < pool.length; j++) {
      if (i === j) continue;
      const m = mayReplaceChampion(pool[i], pool[j]);
      if (m.replace) promotions++;
      else if (m.behavioralVerdict === VERDICT.EQUIVALENT
        && m.descriptiveVerdict === VERDICT.DOMINATES) blockedDescriptive++;
    }
  }
}
console.log('    promotions allowed (behavioral dominance)   ' + promotions);
console.log('    BLOCKED: descriptive-only gains             ' + blockedDescriptive);

// ---- stability: does any dominance direction REVERSE across models? -----------------------------
console.log('');
console.log('  STABILITY — a dominance is only signal if its direction never reverses');
let reversals = 0;
const seen = new Map();
for (const row of rows) {
  if (row.verdict !== VERDICT.DOMINATES && row.verdict !== VERDICT.DOMINATED) continue;
  const pair = [row.a, row.b].sort().join('   ||   ');
  const dir = (row.verdict === VERDICT.DOMINATES ? row.a : row.b);
  if (seen.has(pair) && seen.get(pair) !== dir) {
    reversals++;
    console.log('    REVERSAL on ' + pair);
  }
  seen.set(pair, dir);
}
console.log('    distinct dominating pairs ' + seen.size + '   reversals ' + reversals);
console.log('');
console.log(reversals === 0
  ? '    NO REVERSALS. Where a dominance exists, its direction is consistent across models and cases.'
  : '    ' + reversals + ' REVERSAL(S) - there is no stable quality signal in these metrics as they stand.');
