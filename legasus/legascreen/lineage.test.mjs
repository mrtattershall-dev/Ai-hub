// LegaScreen v3 slice 1 — the lineage layer's own controls. Predictions in
// benchmarks/LEGASCREEN_V3_PREREG.md; the runs in benchmarks/RESULT.legascreen-v3-lineage.md.
//
// All fixtures are written here rather than imported, so nothing passes by accident of the
// repository's current state.
import test from 'node:test';
import assert from 'node:assert';
import { lineage, aggregationMismatch, AGGREGATION, CASE } from './lineage.mjs';

const tok = (context) => ({ context });

// A conjunction: a coordinate survives only if EVERY premise establishes it.
const SOUND = (ins) => {
  const ctx = {};
  for (const d of ['repo', 'crit']) {
    if (ins.every((i) => i.context[d] !== undefined)) ctx[d] = ins[0].context[d];
  }
  return { context: ctx };
};
// C2's shape: absent values filtered out, then whatever remains is taken.
const DEFECTIVE = (ins) => {
  const ctx = {};
  for (const d of ['repo', 'crit']) {
    const vals = [...new Set(ins.map((i) => i.context[d]).filter((v) => v !== undefined))];
    if (vals.length === 1) ctx[d] = vals[0];
  }
  return { context: ctx };
};
const two = () => [tok({ repo: 'S1', crit: 'K' }), tok({ repo: 'S1', crit: 'K' })];
const DECLARED = { 'context.repo': AGGREGATION.ALL_OF, 'context.crit': AGGREGATION.ALL_OF };

test('L-2/L-3 — a sound conjunction observes ALL_OF; C2s shape observes ANY_OF and MISMATCHES', () => {
  const good = lineage({ name: 'sound', inputs: two(), call: SOUND });
  assert.equal(good.aggregation['context.repo'], AGGREGATION.ALL_OF);
  assert.deepEqual(aggregationMismatch({ lin: good, declared: DECLARED }), [],
    'the POSITIVE CONTROL: a correct implementation must not be flagged');

  const bad = lineage({ name: 'defective', inputs: two(), call: DEFECTIVE });
  assert.equal(bad.aggregation['context.repo'], AGGREGATION.ANY_OF);
  const mm = aggregationMismatch({ lin: bad, declared: DECLARED });
  assert.equal(mm.length, 2);
  assert.equal(mm[0].declared, AGGREGATION.ALL_OF);
  assert.equal(mm[0].observed, AGGREGATION.ANY_OF);
});

test('L-1 — support is discovered across RENAMED coordinates, with no name matching', () => {
  // The v2 blind spot in miniature: output `criterion` is derived from input `producer`.
  const lin = lineage({ name: 'renames',
    inputs: [{ identity: { producer: 'p', version: '1', doc: 'm.f' } }],
    call: (ins) => ({ scope: { criterion: ins[0].identity.producer + ' ' + ins[0].identity.version,
      history: ins[0].identity.doc } }) });
  const edge = (from, to) => lin.edges.some((e) => e.from.endsWith(from) && e.to === to);
  assert.ok(edge('identity.producer', 'scope.criterion'));
  assert.ok(edge('identity.version', 'scope.criterion'));
  assert.ok(edge('identity.doc', 'scope.history'));
  assert.ok(!edge('identity.doc', 'scope.criterion'), 'L-5 NON-VACUITY: independence is observed too,'
    + ' so the matrix is not saying everything depends on everything');
});

test('DEFECT 1 — a REFUSED input is NO_OBSERVATION, never a dependency', () => {
  // The HEAD case: the operation rejects a mutated input and returns an object with no authority map.
  const lin = lineage({ name: 'refuses', inputs: two(),
    call: (ins) => (ins.every((i) => Object.keys(i.context).length === 2)
      ? { context: { repo: 'S1', crit: 'K' } }
      : { minted: false, why: 'not an authority token' }) });
  assert.deepEqual(lin.edges, [], 'a refusal is not evidence of dependency');
  assert.equal(lin.cases[CASE.OBSERVED], 0);
  assert.equal(lin.cases[CASE.NO_OBSERVATION], 4);
  assert.equal(lin.aggregation['context.repo'], AGGREGATION.UNKNOWN, 'and the answer is UNKNOWN');
});

test('DEFECT 2 — UNSUPPORTED is told apart from ANY_OF by the all-inputs-stripped run', () => {
  // Genuinely unsupported: the output coordinate ignores the inputs entirely.
  const minted = lineage({ name: 'mints', inputs: two(),
    call: () => ({ context: { repo: 'CONSTANT' } }) });
  assert.equal(minted.aggregation['context.repo'], AGGREGATION.UNSUPPORTED);
  // Disjunctive: no single removal moves it, but removing it from ALL inputs does.
  const disj = lineage({ name: 'disjunctive', inputs: two(),
    call: (ins) => {
      const v = ins.map((i) => i.context.repo).find((x) => x !== undefined);
      return { context: v === undefined ? {} : { repo: v } };
    } });
  assert.equal(disj.aggregation['context.repo'], AGGREGATION.ANY_OF,
    'before the fix this was reported UNSUPPORTED - the opposite finding');
});

test('DEFECT 3 — a vacuous perturbation is counted, never turned into an edge', () => {
  const lin = lineage({ name: 'novars', inputs: [{ context: {} }],
    call: () => ({ context: { x: 'constant' } }) });
  assert.deepEqual(lin.edges, []);
  assert.equal(lin.aggregation['context.x'], AGGREGATION.UNKNOWN, 'one input: aggregation is UNKNOWN');
});

test('NO OPPORTUNITY — a call that throws, or establishes nothing, screens nothing', () => {
  const threw = lineage({ name: 't', inputs: two(), call: () => { throw new Error('no'); } });
  assert.equal(threw.state, CASE.NO_OPPORTUNITY);
  assert.deepEqual(threw.edges, []);
  const empty = lineage({ name: 'e', inputs: two(), call: () => ({ context: {} }) });
  assert.equal(empty.state, CASE.NO_OPPORTUNITY);
  assert.match(empty.why, /established no output coordinate/);
});
