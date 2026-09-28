// r4 — C10 from benchmarks/COMPOSITION_PREREG.md. At b11e51f this file asserted the predicted
// duplicate: OBSERVATION_DIMENSIONS carried history twice. The constant is removed; this asserts the
// removal and that the one remaining definition carries history exactly once.
import test from 'node:test';
import assert from 'node:assert';
import * as observation from './observation.mjs';
import { DIMENSIONS } from './justification.mjs';

test('C10 REGRESSION — the stale copy is gone and the one definition carries history once', () => {
  assert.equal(observation.OBSERVATION_DIMENSIONS, undefined, 'b11e51f exported a duplicate here');
  assert.equal(DIMENSIONS.filter((d) => d === 'history').length, 1);
  assert.equal(new Set(DIMENSIONS).size, DIMENSIONS.length, 'no dimension is listed twice');
});
