// r4 — does the completeness bound survive consumption? Predictions were frozen in
// benchmarks/STOPPING_SCOPE_PREREG.md; the PRE-REPAIR run that reproduced all four is preserved in
// benchmarks/RESULT.stopping-scope.md and at 77fd921, where this file asserted the defects. It now
// asserts the repair and keeps every control.
//
// SC-2 is the permanent one: this project's own Law 1 instrument, pointed at this project's own API.
import test from 'node:test';
import assert from 'node:assert';
import { evidenceFrontier, contestState, objectivesFromContest, nextAction, SCOPE, FRONTIER_SCOPE,
  ACTION_SCOPE, FRONTIER } from './stopping.mjs';
import { informationMonotonicity } from './monotonicity.mjs';

const closed = () => evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] });
const quiescent = () => contestState({ frontier: closed(), investigations: [] });

const INFERS = [{ name: 'concludes no justified investigation exists',
  grants: (s) => s.doesNotEstablish === undefined }];

test('SC-1 REGRESSION — the bound survives objectivesFromContest, inherited verbatim from the verdict', () => {
  const v = quiescent();
  const o = objectivesFromContest(v);
  assert.equal(o.establishes, v.establishes, '77fd921 dropped this');
  assert.equal(o.doesNotEstablish, v.doesNotEstablish);
  assert.equal(o.doesNotEstablish, SCOPE.doesNotEstablish, 'a projection inherits, it does not restate');
  assert.deepEqual(o.objectives, []);
});

test('SC-2 REGRESSION — by Law 1: the erasure no longer gains a permission', () => {
  const m = informationMonotonicity({ rich: quiescent(), erase: objectivesFromContest,
    consumers: INFERS, label: 'objectivesFromContest' });
  assert.equal(m.ok, true, '77fd921: FORBIDDEN TRANSITION, permission manufactured from information loss');
  assert.deepEqual(m.gained, []);

  // NON-VACUITY, unchanged from the attack: the predicate is not constant, so ok:true means the
  // permission was withheld rather than never available.
  assert.equal(INFERS[0].grants(quiescent()), false);
  assert.equal(INFERS[0].grants({}), true);
  // and the instrument still FIRES on an erasure that really does drop the bound
  const stripped = informationMonotonicity({ rich: quiescent(),
    erase: (c) => ({ objectives: [], why: c.why }), consumers: INFERS, label: 'a dropping consumer' });
  assert.equal(stripped.ok, false, 'the guard can still fail, on a consumer that discards it');
});

test('SC-2b — the same holds for an OPEN contest that yields objectives', () => {
  const busy = contestState({ frontier: closed(), investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.equal(informationMonotonicity({ rich: busy, erase: objectivesFromContest,
    consumers: INFERS, label: 'objectivesFromContest' }).ok, true);
  assert.equal(objectivesFromContest(busy).doesNotEstablish, SCOPE.doesNotEstablish);
});

test('SC-3 REGRESSION — nextAction states its own bound, which is about the CANDIDATES', () => {
  const none = nextAction({ candidates: [{ name: 'a', justified: false }] });
  assert.equal(none.quiesce, true);
  assert.equal(none.establishes, ACTION_SCOPE.establishes, '77fd921 had no bound at all');
  assert.match(none.doesNotEstablish, /candidate list is supplied by the caller/);
  assert.notEqual(none.doesNotEstablish, SCOPE.doesNotEstablish,
    'a different claim gets a different bound, not a reused one');
  // and the non-quiescent branch carries it too
  assert.equal(nextAction({ candidates: [{ name: 'a', justified: true }] }).establishes,
    ACTION_SCOPE.establishes);
  assert.equal(nextAction({}).doesNotEstablish, ACTION_SCOPE.doesNotEstablish, 'including the empty call');
});

test('SC-4 REGRESSION — evidenceFrontier states that its requirement list is an INPUT', () => {
  const f = closed();
  assert.equal(f.state, FRONTIER.CLOSED);
  assert.equal(f.establishes, FRONTIER_SCOPE.establishes, '77fd921 had no bound');
  assert.match(f.doesNotEstablish, /requiredProducers is an input to this function, not a finding/);
  assert.match(f.why, /every producer DECLARED required/, 'and the why no longer reads as completeness');
  // OPEN carries it too: the bound is a property of the computation, not of one outcome
  assert.equal(evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'] }).doesNotEstablish,
    FRONTIER_SCOPE.doesNotEstablish);
});

test('SC-5 CONTROL — no verdict changed', () => {
  assert.equal(evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'] }).state, FRONTIER.OPEN);
  assert.equal(quiescent().state, 'QUIESCENT_CONTEST');
  const busy = contestState({ frontier: closed(), investigations: [
    { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.deepEqual(objectivesFromContest(busy).objectives,
    [{ kind: 'REDUCE_UNCERTAINTY', target: 'typecheck' }]);
  assert.deepEqual(objectivesFromContest(quiescent()).objectives, []);
});

// THE RESIDUAL, ASSERTED SO IT CANNOT BE FORGOTTEN. Carrying the bound makes dropping it a deliberate
// act rather than something the pipeline does on its own. It does NOT make the bound inseparable: the
// state is still a bare string and can still be read alone. Stated in the preregistration before the
// repair, and pinned here so no later reader mistakes this slice for a structural guarantee.
test('RESIDUAL — the state remains readable without its bound, and that is NOT solved here', () => {
  const v = quiescent();
  assert.equal(v.state, 'QUIESCENT_CONTEST');
  assert.equal(typeof v.state, 'string', 'a consumer can still compare this and discard everything else');
  assert.equal(INFERS[0].grants({ state: v.state }), true,
    'and such a consumer regains the inference. The pipeline no longer erases the bound; a reader'
    + ' still can, and preventing that would change every comparison in the freeze gate.');
});
