// r4 — the completeness boundary of law 7, named by the owner 2026-09-20.
//
// QUIESCENT_CONTEST establishes that no investigation FORMULATED in the frontier is justified. It does
// not establish that no justified investigation exists. The bound must travel WITH the verdict: a
// bounded claim quoted without its bound is an unbounded claim, and this project's own history is the
// evidence that the difference is not pedantic.
import test from 'node:test';
import assert from 'node:assert';
import { evidenceFrontier, contestState, objectivesFromContest, SCOPE, CONTEST } from './stopping.mjs';

const closed = () => evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] });

test('EVERY verdict carries the bound, not just the quiescent one', () => {
  const quiet = contestState({ frontier: closed(), investigations: [] });
  const busy = contestState({ frontier: closed(), investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  const open = contestState({ frontier: evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'] }),
    investigations: [] });
  for (const [name, v] of [['quiescent', quiet], ['open-with-justified', busy], ['open-frontier', open]]) {
    assert.equal(v.establishes, SCOPE.establishes, name);
    assert.equal(v.doesNotEstablish, SCOPE.doesNotEstablish, name);
  }
  assert.equal(quiet.state, CONTEST.QUIESCENT_CONTEST);
  assert.equal(busy.state, CONTEST.OPEN_CONTEST);
  assert.equal(open.state, CONTEST.OPEN_CONTEST);
});

test('the bound says the two things it must, and the quiescent why no longer overclaims', () => {
  const quiet = contestState({ frontier: closed(), investigations: [] });
  assert.match(quiet.establishes, /FORMULATED in this frontier/);
  assert.match(quiet.doesNotEstablish, /no justified investigation EXISTS/);
  assert.match(quiet.doesNotEstablish, /completeness/);
  // the verdict's own prose must not assert the thing the bound denies
  assert.match(quiet.why, /formulated in this frontier/);
  assert.match(quiet.why, /nobody has\s+formulated|nobody has formulated/);
});

test('NON-VACUITY — the bound changes nothing about the computation it qualifies', () => {
  // A qualification that also altered the verdict would be a new law wearing a comment. Same states,
  // same objectives, as before it existed.
  const quiet = contestState({ frontier: closed(), investigations: [] });
  assert.deepEqual(objectivesFromContest(quiet).objectives, []);
  const busy = contestState({ frontier: closed(), investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.deepEqual(objectivesFromContest(busy).objectives,
    [{ kind: 'REDUCE_UNCERTAINTY', target: 'typecheck' }]);
  // and asking about completeness generates no objective, because it is not an investigation
  assert.equal(Object.hasOwn(quiet, 'objectives'), false);
});
