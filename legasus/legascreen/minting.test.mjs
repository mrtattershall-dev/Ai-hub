// LegaScreen v2 minting probes — fire, silence, vacuity and the witness requirement, all in-memory.
// Predictions in benchmarks/LEGASCREEN_V2_PREREG.md; the runs are in benchmarks/RESULT.legascreen-v2.md.
import test from 'node:test';
import assert from 'node:assert';
import { screenTransform, screenAll } from './minting.mjs';

const tok = (context) => ({ context });
const CONJ = 'declared conjunctive for this test';

test('I-WEAKENING fires on a conjunction that survives losing a conjunct, and is silent on a real one', () => {
  // DEFECTIVE: filters absent values out, then takes what remains - C2's shape.
  const bad = screenTransform({ name: 'derive', conjunctive: CONJ,
    inputs: [tok({ repo: 'S1' }), tok({ repo: 'S1' })],
    call: (ins) => {
      const ctx = {};
      for (const d of ['repo']) {
        const vals = [...new Set(ins.map((i) => i.context[d]).filter((v) => v !== undefined))];
        if (vals.length === 1) ctx[d] = vals[0];
      }
      return { context: ctx };
    } });
  assert.equal(bad.positives.length, 1);
  assert.equal(bad.positives[0].probe, 'I-WEAKENING');
  assert.equal(bad.positives[0].dimension, 'repo');

  // SOUND: a dimension enters only when EVERY input establishes it.
  const good = screenTransform({ name: 'derive', conjunctive: CONJ,
    inputs: [tok({ repo: 'S1' }), tok({ repo: 'S1' })],
    call: (ins) => {
      const ctx = {};
      for (const d of ['repo']) {
        if (ins.every((i) => i.context[d] !== undefined)) ctx[d] = ins[0].context[d];
      }
      return { context: ctx };
    } });
  assert.deepEqual(good.positives, [], 'the POSITIVE CONTROL: retaining a jointly-established'
    + ' dimension must not be flagged, or discarding everything would pass');
});

test('I-ANCESTRY fires on authority with no input ancestry, and does NOT fire on C2 (V2-1)', () => {
  const minted = screenTransform({ name: 'mints',
    inputs: [tok({ repo: 'S1' })], call: () => ({ context: { repo: 'INVENTED' } }) });
  assert.equal(minted.positives.length, 1);
  assert.equal(minted.positives[0].probe, 'I-ANCESTRY');

  // C2's shape under I-ANCESTRY alone: strip repo from BOTH premises and the output loses it too,
  // so the universal invariant is satisfied. This is why two invariants exist.
  const c2 = screenTransform({ name: 'derive',
    inputs: [tok({ repo: 'S1' }), tok({ repo: 'S1' })],
    call: (ins) => {
      const vals = [...new Set(ins.map((i) => i.context.repo).filter((v) => v !== undefined))];
      return { context: vals.length === 1 ? { repo: vals[0] } : {} };
    } });
  assert.deepEqual(c2.positives.filter((p) => p.probe === 'I-ANCESTRY'), [],
    'ANCESTRY cannot see C2: S1 is in the closure of the inputs');
});

test('A VACUOUS PERTURBATION IS UNSCREENED, never a positive', () => {
  // The defect the first version of minting.mjs had: the output dimension is DERIVED from a
  // differently-named input, so stripping it by name changes nothing.
  const r = screenTransform({ name: 'derivesByAnotherName',
    inputs: [{ context: { producer: 'p', version: '1' } }],
    call: (ins) => ({ context: { criterion: ins[0].context.producer + ' ' + ins[0].context.version } }) });
  assert.deepEqual(r.positives, [], 'the first version reported this as minting');
  assert.equal(r.unscreened.length, 1);
  assert.match(r.unscreened[0].why, /VACUOUS/);
  assert.match(r.unscreened[0].why, /NOT FLAGGED means NOT EXAMINED/);
});

test('NO OBSERVATION WITHOUT EXECUTION — an unwitnessed call is UNSCREENED, never clean', () => {
  const threw = screenTransform({ name: 'throws', inputs: [tok({ repo: 'S1' })],
    call: () => { throw new Error('bad arguments'); } });
  assert.equal(threw.witnessed, false);
  assert.deepEqual(threw.positives, []);
  assert.match(threw.unscreened[0].why, /no witnessed execution exists/);

  const noMap = screenTransform({ name: 'noAuthority', inputs: [tok({ repo: 'S1' })],
    call: () => ({ objectives: [] }) });
  assert.equal(noMap.witnessed, false);
  assert.match(noMap.unscreened[0].why, /no authority map/);
});

test('screenAll reports coverage, so a null can be told apart from a run that examined nothing', () => {
  const r = screenAll([
    { name: 'a', inputs: [tok({ repo: 'S1' })], call: (i) => ({ context: { ...i[0].context } }) },
    { name: 'b', inputs: [tok({ repo: 'S1' })], call: () => { throw new Error('no'); } },
  ]);
  assert.deepEqual(r.positives, []);
  assert.equal(r.coverage.transforms, 2);
  assert.equal(r.coverage.witnessed, 1, 'one of the two was never witnessed');
  assert.ok(r.coverage.perturbations > 0);
});
