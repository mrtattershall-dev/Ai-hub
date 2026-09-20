// r4 — C10 from benchmarks/COMPOSITION_PREREG.md: a stale vocabulary constant. Asserts the PREDICTED
// duplicate.
import test from 'node:test';
import assert from 'node:assert';
import { OBSERVATION_DIMENSIONS } from './observation.mjs';
import { DIMENSIONS } from './justification.mjs';

test('C10 ATTACK — OBSERVATION_DIMENSIONS carries history twice', () => {
  assert.equal(DIMENSIONS.includes('history'), true, 'the base set already has it');
  assert.equal(OBSERVATION_DIMENSIONS.filter((d) => d === 'history').length, 2,
    'prediction C10: duplicated');
  assert.equal(OBSERVATION_DIMENSIONS.length, DIMENSIONS.length + 1);
});
