// r4 — ATTACK on the stopping machinery. Predictions frozen in benchmarks/COMPOSITION_PREREG.md
// (C9-a) BEFORE this file existed. Assertions state the PREDICTED DEFECT.
import test from 'node:test';
import assert from 'node:assert';
import { evidenceFrontier, contestState, objectivesFromContest, CONTEST, FRONTIER } from './stopping.mjs';

test('C9-a ATTACK — an irrelevant pending string holds the contest OPEN with ZERO objectives', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: ['irrelevant'] });
  assert.equal(f.state, FRONTIER.OPEN);
  const c = contestState({ frontier: f, investigations: [] });
  // PREDICTED DEFECT: neither quiescent nor actionable - a stall reported as "do not quiesce".
  assert.equal(c.state, CONTEST.OPEN_CONTEST, 'prediction C9-a: open');
  assert.deepEqual(objectivesFromContest(c).objectives, []);
});

test('C9-a CONTROL — the same frontier with nothing pending is QUIESCENT', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: [] });
  assert.equal(contestState({ frontier: f, investigations: [] }).state, CONTEST.QUIESCENT_CONTEST);
});

test('C9-a POSITIVE CONTROL — a pending item that IS a justified investigation must keep it open', () => {
  const f = evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'], pending: ['typecheck'] });
  const c = contestState({ frontier: f, investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.equal(c.state, CONTEST.OPEN_CONTEST);
  assert.equal(objectivesFromContest(c).objectives.length, 1);
});
