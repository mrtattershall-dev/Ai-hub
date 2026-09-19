// THE ANTI-EXPLANATION CONTROLS, and the stopping law.
//
// Two symmetric failure modes, and the algebra's job is neither one:
//
//     OVER-RECONCILIATION   genuine conflict -> invent a dimension -> NOT_COMPARABLE
//     UNDER-RECONCILIATION  different worlds -> ignore the relevant distinction -> DISAGREEMENT
//
// Its job is to preserve exactly the distinctions independently entitled to matter.
import test from 'node:test';
import assert from 'node:assert';
import { admitDimension, registry, comparisonDefeat, discriminatingProjection, RELEVANCE,
  ARGUED_FROM } from './admissibility.mjs';
import { evidenceFrontier, investigationJustified, contestState, objectivesFromContest, nextAction,
  FRONTIER, CONTEST } from './stopping.mjs';

// The dimensions this project has actually earned, with the arguments that earned them.
const REAL = [
  { name: 'repository', relevance: RELEVANCE.TRUTH_CONDITIONS,
    argument: 'the same source coordinate names different code at different repository states',
    arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'repoB design' },
  { name: 'history', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'a doctest example that runs after others asserts about source x execution history',
    arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'H1/H2 preregistration' },
  { name: 'criterion', relevance: RELEVANCE.TRUTH_CONDITIONS,
    argument: 'a claim of advancement is only meaningful relative to what counts as success',
    arguedFrom: ARGUED_FROM.DESIGN },
];

test('AN INCIDENTAL DIMENSION IS REFUSED, however faithfully it is recorded', () => {
  for (const name of ['hostname', 'tempFilename', 'wallClockNanos', 'jsonFieldOrder']) {
    const r = admitDimension({ name, relevance: RELEVANCE.INCIDENTAL,
      argument: 'it differs between runs', arguedFrom: ARGUED_FROM.SOURCE_INSPECTION });
    assert.equal(r.admitted, false, name);
    assert.match(r.why, /may never defeat a comparison/);
  }
});

test('A DIMENSION ARGUED FROM THE DISAGREEMENT IT EXPLAINS IS REFUSED', () => {
  const r = admitDimension({ name: 'phaseOfMoon', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'the two systems ran under different moon phases',
    arguedFrom: ARGUED_FROM.OBSERVED_DISCREPANCY });
  assert.equal(r.admitted, false);
  assert.match(r.why, /Explanatory power does not grant discriminative authority/);

  // POSITIVE CONTROL: the same dimension name, argued independently, is admissible. The refusal is about
  // the PROVENANCE of the argument, not about the word.
  // NOTE: this text mentions "discrepancy" on purpose. The first version of the guard pattern-matched
  // prose and refused this legitimate case. Provenance is typed now, so the words are free.
  const ok = admitDimension({ name: 'phaseOfMoon', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'the scheduler genuinely keys retry backoff on lunar phase',
    arguedFrom: ARGUED_FROM.SOURCE_INSPECTION,
    motivatedBy: 'reading the scheduler source before any discrepancy was scored' });
  assert.equal(ok.admitted, true);
});

test('THE ANTI-OVERFITTING CONTROL — accidental differences must NOT defeat comparison', () => {
  const reg = registry(REAL);
  const a = { subject: 'utils.f', repository: 'S1', history: 'H1', criterion: 'K1',
    hostname: 'build-07', tempFilename: '/tmp/abc123', wallClockNanos: 918273645 };
  const b = { subject: 'utils.f', repository: 'S1', history: 'H1', criterion: 'K1',
    hostname: 'build-92', tempFilename: '/tmp/zzz999', wallClockNanos: 111111111 };
  const d = comparisonDefeat({ a, b, reg });
  assert.equal(d.defeats, false);
  assert.deepEqual(d.entitled, []);
  assert.equal(d.incidental.length, 3);
  assert.match(d.why, /MUST STILL BE COMPARED/);
  // and the projection handed to comparison simply does not contain them
  assert.deepEqual(Object.keys(discriminatingProjection(a, reg)).sort(),
    ['criterion', 'history', 'repository']);
});

test('AND A RELEVANT DIFFERENCE DOES defeat comparison — or the registry is a rubber stamp', () => {
  const reg = registry(REAL);
  const a = { subject: 'utils.f', repository: 'S1', history: 'H1', criterion: 'K1' };
  const b = { subject: 'utils.f', repository: 'S1', history: 'H2', criterion: 'K1' };
  const d = comparisonDefeat({ a, b, reg });
  assert.equal(d.defeats, true);
  assert.deepEqual(d.entitled, ['history']);
});

test('a dimension with no argument at all cannot defeat anything', () => {
  assert.equal(admitDimension({ name: 'vibes', relevance: RELEVANCE.TRUTH_CONDITIONS }).admitted, false);
  const reg = registry([{ name: 'vibes', relevance: RELEVANCE.TRUTH_CONDITIONS }]);
  assert.equal(reg.mayDefeatComparison('vibes'), false);
  assert.equal(reg.refused.length, 1);
});

// ---------------------------------------------------------------- LAW 7

test('LAW 7 — a conflict with an OPEN evidence frontier is not yet a settled contest', () => {
  const f = evidenceFrontier({ requiredProducers: ['doctest', 'witness', 'typecheck'],
    attempted: ['doctest', 'witness'] });
  assert.equal(f.state, FRONTIER.OPEN);
  assert.deepEqual(f.missing, ['typecheck']);
  const c = contestState({ frontier: f, investigations: [] });
  assert.equal(c.state, CONTEST.OPEN_CONTEST,
    'a decisive producer that never ran is not a settled disagreement');
});

test('LAW 7 — FOUR conditions, and the fourth is the one usually skipped', () => {
  const base = { name: 'rerun the same probe', authorized: true, executable: true,
    targetsDistinction: true, canChangeEntitlement: true };
  assert.equal(investigationJustified(base).ok, true);
  const pointless = investigationJustified({ ...base, canChangeEntitlement: false });
  assert.equal(pointless.ok, false);
  assert.match(pointless.why, /epistemically pointless however cheap it is/);
  for (const k of ['authorized', 'executable', 'targetsDistinction']) {
    assert.equal(investigationJustified({ ...base, [k]: false }).ok, false, k);
  }
});

test('LAW 7 — QUIESCENT_CONTEST is reachable, and it generates NO objective', () => {
  const f = evidenceFrontier({ requiredProducers: ['doctest'], attempted: ['doctest'] });
  assert.equal(f.state, FRONTIER.CLOSED);
  const c = contestState({ frontier: f, investigations: [
    { name: 'rerun the same probe', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: false },
    { name: 'ask the model again', authorized: true, executable: true, targetsDistinction: false,
      canChangeEntitlement: false },
  ] });
  assert.equal(c.state, CONTEST.QUIESCENT_CONTEST);
  assert.match(c.why, /ENTITLED TO STOP INVESTIGATING/);
  // THE CRITICAL PROPERTY: PURPOSE must not turn this into work.
  const o = objectivesFromContest(c);
  assert.deepEqual(o.objectives, []);
  assert.match(o.why, /how a loop runs forever/);
});

test('LAW 7 — and a JUSTIFIED investigation still produces work, so this is not a stop-everything switch', () => {
  const f = evidenceFrontier({ requiredProducers: ['doctest'], attempted: ['doctest'] });
  const c = contestState({ frontier: f, investigations: [
    { name: 'run the typechecker', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true },
  ] });
  assert.equal(c.state, CONTEST.OPEN_CONTEST);
  assert.deepEqual(objectivesFromContest(c).objectives, [{ kind: 'REDUCE_UNCERTAINTY',
    target: 'run the typechecker' }]);
});

test('LAW 7 — THE LEGITIMATE IDLE STATE: no justified action means QUIESCE, not an invented one', () => {
  const none = nextAction({ candidates: [{ name: 'a', justified: false }, { name: 'b', justified: false }] });
  assert.equal(none.quiesce, true);
  assert.equal(none.action, null);
  assert.match(none.why, /where invented objectives come from/);

  const some = nextAction({ candidates: [{ name: 'a', justified: true }] });
  assert.equal(some.quiesce, false);
  assert.equal(some.frontier.length, 1);
});

test('LAW 7 — an empty candidate list is QUIESCE, never a prompt to the model', () => {
  assert.equal(nextAction({}).quiesce, true);
  assert.equal(nextAction({ candidates: [] }).action, null);
});
