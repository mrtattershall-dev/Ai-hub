// r4 — does the completeness bound survive consumption? Predictions SC-1..SC-5 frozen in
// benchmarks/STOPPING_SCOPE_PREREG.md BEFORE this file existed. Assertions state the PREDICTED DEFECT.
//
// SC-2 puts this project's own Law 1 instrument on this project's own new API: erasing information
// must never GAIN a permission.
import test from 'node:test';
import assert from 'node:assert';
import { evidenceFrontier, contestState, objectivesFromContest, nextAction, FRONTIER } from './stopping.mjs';
import { informationMonotonicity } from './monotonicity.mjs';

const closed = () => evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] });
const quiescent = () => contestState({ frontier: closed(), investigations: [] });

// A reader makes the inference "zero objectives, therefore no justified investigation exists"
// precisely when nothing in the artifact denies it. That is the mechanism, modelled as a predicate.
const INFERS = [{ name: 'concludes no justified investigation exists',
  grants: (s) => s.doesNotEstablish === undefined }];

test('SC-1 ATTACK — the bound does not survive objectivesFromContest', () => {
  const o = objectivesFromContest(quiescent());
  // PREDICTED DEFECT: the artifact PURPOSE consumes says "zero objectives" and denies nothing.
  assert.equal(o.establishes, undefined, 'prediction SC-1');
  assert.equal(o.doesNotEstablish, undefined, 'prediction SC-1');
  assert.deepEqual(o.objectives, []);
});

test('SC-2 ATTACK — by Law 1: erasing the bound GAINS a permission', () => {
  const m = informationMonotonicity({ rich: quiescent(), erase: objectivesFromContest,
    consumers: INFERS, label: 'objectivesFromContest' });
  // PREDICTED DEFECT: a FORBIDDEN TRANSITION, in the module's own words.
  assert.equal(m.ok, false, 'prediction SC-2');
  assert.deepEqual(m.gained, ['concludes no justified investigation exists']);
  assert.match(m.why, /Authority was manufactured out of information loss/);

  // NON-VACUITY: the predicate is not constant. The rich state REFUSES the same consumer, so the
  // violation is a real change of permission and not a consumer that always grants.
  assert.equal(INFERS[0].grants(quiescent()), false, 'the bounded verdict denies the inference');
  assert.equal(INFERS[0].grants({}), true, 'and an unbounded artifact permits it');
});

test('SC-3 ATTACK — nextAction makes the same claim with no bound at all', () => {
  const none = nextAction({ candidates: [{ name: 'a', justified: false }] });
  assert.equal(none.quiesce, true);
  // PREDICTED DEFECT: bounded by who wrote the candidate list, and saying so nowhere.
  assert.equal(none.establishes, undefined, 'prediction SC-3');
  assert.equal(none.doesNotEstablish, undefined, 'prediction SC-3');
});

test('SC-4 ATTACK — evidenceFrontier CLOSED carries no bound and its why reads as completeness', () => {
  const f = closed();
  assert.equal(f.state, FRONTIER.CLOSED);
  // PREDICTED DEFECT: "every required producer was attempted" over a DECLARED list, with nothing
  // recording that the requirement list is an input.
  assert.equal(f.establishes, undefined, 'prediction SC-4');
  assert.equal(f.doesNotEstablish, undefined, 'prediction SC-4');
  assert.match(f.why, /every required producer was attempted/);
});

test('SC-5 CONTROL — the verdicts themselves are unaffected by any of this', () => {
  const open = evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'] });
  assert.equal(open.state, FRONTIER.OPEN);
  const busy = contestState({ frontier: closed(), investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.deepEqual(objectivesFromContest(busy).objectives,
    [{ kind: 'REDUCE_UNCERTAINTY', target: 'typecheck' }]);
  assert.deepEqual(objectivesFromContest(quiescent()).objectives, []);
});
