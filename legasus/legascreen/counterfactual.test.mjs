// LegaScreen v3 slice 2 — CONTROLS THAT ATTACK THE SUBSTRATE ITSELF.
//
// Predictions CF-1..CF-6 in benchmarks/LEGASCREEN_V3_SLICE2_PREREG.md; the runs against the real
// trees in benchmarks/RESULT.legascreen-cf.md. Every fixture is written here rather than imported,
// so nothing passes by accident of the repository's state - and the substrate is held to the standard
// it exists to enforce.
import test from 'node:test';
import assert from 'node:assert';
import * as substrate from './counterfactual.mjs';
import { counterfactual, mismatches, OUTCOME, AGGREGATION } from './counterfactual.mjs';

// A miniature authority system with a REAL brand, so a copied object is not a token - exactly the
// property that defeated slice 1.
const MINTED = new WeakSet();
const mint = (context) => { const t = Object.freeze({ context }); MINTED.add(t); return t; };
const isToken = (t) => !!(t && typeof t === 'object' && MINTED.has(t));
const construct = (facts) => facts.map((f) => mint({ ...f }));

const SOUND = (ins) => {
  if (!ins.every(isToken)) return { refused: true, why: 'not a token' };
  const ctx = {};
  for (const d of ['repo', 'crit']) if (ins.every((i) => i.context[d] !== undefined)) ctx[d] = ins[0].context[d];
  return { context: ctx };
};
const DEFECTIVE = (ins) => {                                     // C2's shape
  if (!ins.every(isToken)) return { refused: true, why: 'not a token' };
  const ctx = {};
  for (const d of ['repo', 'crit']) {
    const v = [...new Set(ins.map((i) => i.context[d]).filter((x) => x !== undefined))];
    if (v.length === 1) ctx[d] = v[0];
  }
  return { context: ctx };
};
const FACTS = () => [{ repo: 'S1', crit: 'K' }, { repo: 'S1', crit: 'K' }];
const DECL = (value) => ({ 'context.repo': { value, authority: 'the operation\'s own contract' },
  'context.crit': { value, authority: 'the operation\'s own contract' } });

test('CF-1 — a BRANDED token is screenable, because the counterfactual is minted upstream', () => {
  // The slice-1 method would fail here: a copied token is not in the WeakSet. This one never copies.
  const r = counterfactual({ name: 'sound', facts: FACTS(), construct, operate: SOUND,
    declared: DECL(AGGREGATION.ALL_OF) });
  assert.equal(r.outcome, OUTCOME.OBSERVED);
  assert.equal(r.stages[OUTCOME.OBSERVED], 4, 'all four interventions were lawfully observed');
  assert.equal(r.stages[OUTCOME.AUTHORITY_REFUSED], 0, 'nothing was refused: every input was real');
  assert.equal(r.aggregation['context.repo'], AGGREGATION.ALL_OF);
  assert.deepEqual(mismatches(r), [], 'the POSITIVE CONTROL: a correct implementation is not convicted');
});

test('CF-2 — the C2 shape is convicted, and the conviction quotes its authority', () => {
  const r = counterfactual({ name: 'defective', facts: FACTS(), construct, operate: DEFECTIVE,
    declared: DECL(AGGREGATION.ALL_OF) });
  assert.equal(r.aggregation['context.repo'], AGGREGATION.ANY_OF);
  const mm = mismatches(r);
  assert.equal(mm.length, 2);
  assert.equal(mm[0].verdict, 'MISMATCH');
  assert.match(mm[0].authority, /own contract/);
});

test('CF-2b BOTH SHAPES ADMITTED — a legitimately ANY_OF operation is not convicted by an ANY_OF contract', () => {
  // Or the engine would only ever recognise one shape and ALL_OF would be a synonym for "correct".
  const r = counterfactual({ name: 'disjunctive', facts: FACTS(), construct, operate: DEFECTIVE,
    declared: DECL(AGGREGATION.ANY_OF) });
  assert.equal(r.aggregation['context.repo'], AGGREGATION.ANY_OF);
  assert.deepEqual(mismatches(r), []);
});

test('CF-3 — an unstable baseline scores NOTHING', () => {
  let n = 0;
  const r = counterfactual({ name: 'drifts', facts: FACTS(), construct,
    operate: (ins) => ({ context: { repo: 'S' + (n++) } }) });
  assert.equal(r.outcome, OUTCOME.BASELINE_UNSTABLE);
  assert.deepEqual(r.aggregation, {});
  assert.deepEqual(mismatches(r), [], 'and a non-OBSERVED outcome can never produce a mismatch');
  assert.match(r.why, /did not reproduce the baseline/);
});

test('CF-5 — every failure stage is tagged, scores zero, and is told apart from the others', () => {
  // RECONSTRUCTION_FAILED: the production constructor refuses the mutated facts.
  const recon = counterfactual({ name: 'strict', facts: FACTS(), operate: SOUND,
    construct: (facts) => { if (facts.some((f) => f.repo === undefined)) throw new Error('needs repo');
      return facts.map((f) => mint({ ...f })); } });
  assert.equal(recon.stages[OUTCOME.RECONSTRUCTION_FAILED], 2);
  assert.equal(recon.aggregation['context.repo'], AGGREGATION.UNKNOWN,
    'unreconstructable is UNKNOWN, never clean and never a finding');

  // AUTHORITY_REFUSED: the operation rejects a legitimately built input.
  const refused = counterfactual({ name: 'picky', facts: FACTS(), construct,
    operate: (ins) => (ins.every((i) => i.context.repo !== undefined) ? SOUND(ins)
      : { refused: true, why: 'I want repo' }) });
  assert.equal(refused.stages[OUTCOME.AUTHORITY_REFUSED], 2);
  assert.ok(!refused.edges.some((e) => e.from.endsWith('.repo')),
    'a refusal is NOT a dependency - the slice-1 defect, now impossible in the substrate');

  // NO_CHANGE / COORDINATE_ABSENT: an intervention that does not intervene.
  const vacuous = counterfactual({ name: 'const', facts: [{ a: 1 }, { a: 2 }],
    construct: (f) => f.map((x) => mint({ ...x })),
    operate: () => ({ context: { fixed: 'always' } }) });
  assert.equal(vacuous.aggregation['context.fixed'], AGGREGATION.UNSUPPORTED);
  assert.deepEqual(vacuous.edges, []);
});

test('CF-6 — a declaration with no stated AUTHORITY cannot convict anything', () => {
  const r = counterfactual({ name: 'defective', facts: FACTS(), construct, operate: DEFECTIVE,
    declared: { 'context.repo': { value: AGGREGATION.ALL_OF } } });   // no authority field
  const mm = mismatches(r);
  assert.equal(mm.length, 1);
  assert.equal(mm[0].verdict, 'UNCOMPARABLE');
  assert.match(mm[0].why, /changed together/);
});

test('CF-4 — THE SUBSTRATE OFFERS NO BACKDOOR', () => {
  const names = Object.keys(substrate);
  assert.deepEqual(names.filter((k) => /forge|mint|fabricat|unsafe|bypass|testonly/i.test(k)), [],
    'a test-only constructor would weaken the exact property being screened');
  assert.deepEqual(names.sort(), ['AGGREGATION', 'OUTCOME', 'SCORES', 'counterfactual', 'mismatches']);
  assert.deepEqual([...substrate.SCORES], [OUTCOME.OBSERVED], 'only OBSERVED may ever be scored');
});
