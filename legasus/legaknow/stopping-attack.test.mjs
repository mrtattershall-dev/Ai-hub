// r4 — the stopping machinery under attack. Predictions were frozen in benchmarks/COMPOSITION_PREREG.md
// (C9-a); the PRE-REPAIR run that reproduced the stall is preserved in benchmarks/RESULT.composition.md
// and at b11e51f, where this file asserted the defect. It now asserts the repair and keeps every
// control.
import test from 'node:test';
import assert from 'node:assert';
import { evidenceFrontier, contestState, objectivesFromContest, CONTEST, FRONTIER } from './stopping.mjs';

test('C9-a REGRESSION — an irrelevant pending string is DISCHARGED with a record, and the contest QUIESCES', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: ['irrelevant'] });
  assert.equal(f.state, FRONTIER.OPEN, 'the raw frontier still reports it');
  const c = contestState({ frontier: f, investigations: [] });
  assert.equal(c.state, CONTEST.QUIESCENT_CONTEST, 'b11e51f stalled here as OPEN with zero objectives');
  assert.deepEqual(c.frontier.discharged, ['irrelevant']);
  assert.deepEqual(c.frontier.pending, []);
  assert.match(c.frontier.why, /discharged from pending/);
  assert.deepEqual(objectivesFromContest(c).objectives, []);
});

test('C9-a CONTROL — the same frontier with nothing pending is QUIESCENT with nothing discharged', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: [] });
  const c = contestState({ frontier: f, investigations: [] });
  assert.equal(c.state, CONTEST.QUIESCENT_CONTEST);
  assert.deepEqual(c.frontier.discharged, []);
});

test('C9-a POSITIVE CONTROL — a pending item that IS a justified investigation keeps the contest OPEN', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: ['typecheck'] });
  const c = contestState({ frontier: f, investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.equal(c.state, CONTEST.OPEN_CONTEST);
  assert.deepEqual(c.frontier.pending, ['typecheck']);
  assert.deepEqual(c.frontier.discharged, []);
  assert.equal(objectivesFromContest(c).objectives.length, 1);
});

test('C9-a — a MISSING required producer still holds the frontier open by itself; discharge does not touch it', () => {
  const f = evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'], pending: ['irrelevant'] });
  const c = contestState({ frontier: f, investigations: [] });
  assert.equal(c.state, CONTEST.OPEN_CONTEST);
  assert.deepEqual(c.frontier.missing, ['u']);
  assert.deepEqual(c.frontier.discharged, ['irrelevant']);
});

test('C9-a — a pending item whose investigation is NOT justified is discharged too (a name is not an obligation)', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: ['rerun'] });
  const c = contestState({ frontier: f, investigations: [
    { name: 'rerun', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: false }] });
  assert.equal(c.state, CONTEST.QUIESCENT_CONTEST);
  assert.deepEqual(c.frontier.discharged, ['rerun']);
});
