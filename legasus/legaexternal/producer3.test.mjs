// r4 — producer #3 (pytest) against the evidence boundary. Predictions P3-1..P3-10 frozen in 0baca08.
//
// Run against the EXISTING boundary first, so that any shape change is DISCOVERED rather than pre-empted.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPytestProducer } from './pytest-producer.mjs';
import { adaptRecord } from './adapt.mjs';
import { scope, covers, joinConflicts, CONTEXT_DIMENSIONS, SUBJECT_DIMENSIONS, UNADMITTED,
  admitScopeDimension, scopeDimensions, resetScopeDimensions } from '../legaknow/justification.mjs';
import { admitDimension, registry, comparisonDefeat, RELEVANCE, ARGUED_FROM }
  from '../legaknow/admissibility.mjs';

const NL = String.fromCharCode(10);
const SIX = [...CONTEXT_DIMENSIONS, ...SUBJECT_DIMENSIONS];

// THE MUTABLE REGISTRY LEAKS ON FAILURE, and that is not speculation - registry-leak.test.mjs L5
// reproduces it: a test that THROWS before its trailing reset leaves the dimension admitted for
// everything that runs after it, silently turning later comparisons into refusals. beforeEach is used
// rather than a trailing reset precisely because it survives a failure in the PREVIOUS test.
beforeEach(resetScopeDimensions);

// THE SUBJECT. test_b passes ALONE and fails WHEN test_a RAN FIRST, because the fixture is module-scoped
// and therefore shared. Same file, same bytes, same interpreter, same criterion, same nodeid.
const SUITE = [
  'import pytest',
  '',
  '@pytest.fixture(scope="module")',
  'def counter():',
  '    return {"n": 0}',
  '',
  'def test_a(counter):',
  '    counter["n"] += 1',
  '    assert counter["n"] == 1',
  '',
  'def test_b(counter):',
  '    counter["n"] += 1',
  '    assert counter["n"] == 1',
  '',
].join(NL);

function suite() {
  const dir = mkdtempSync(join(tmpdir(), 'pyt3-'));
  writeFileSync(join(dir, 'test_cohort.py'), SUITE, 'utf8');
  return dir;
}

const outcomeOf = (p, nodeidEndsWith) =>
  p.records.find((r) => r.nodeid.endsWith(nodeidEndsWith))?.nativeResult;

test('P3-1 — the foreign coordinate is a REAL distinction the producer makes, not a label I invented',
  () => {
    const dir = suite();
    const alone = runPytestProducer({ dir, select: ['test_cohort.py::test_b'] });
    const together = runPytestProducer({ dir, select: ['test_cohort.py'] });
    assert.equal(alone.ok, true, alone.why);
    assert.equal(together.ok, true, together.why);

    // SAME nodeid. SAME file bytes. SAME interpreter. SAME criterion. DIFFERENT VERDICT.
    assert.equal(outcomeOf(alone, '::test_b'), 'PASSED');
    assert.equal(outcomeOf(together, '::test_b'), 'FAILED');
    assert.notEqual(alone.records[0].identity.collectionCohort,
      together.records[0].identity.collectionCohort);

    // and the coordinate that explains it is not one Legasus has a name for
    assert.equal(SIX.includes('collectionCohort'), false);
    assert.equal(SIX.includes('pluginSet'), false);
    rmSync(dir, { recursive: true, force: true });
  });

// P3-2 HELD PRE-REPAIR and is pinned in git history at 17edf5e, where this asserted the coordinate was
// simply GONE. After the repair the same assertion would still pass - the key is not a top-level property
// either way - so keeping it unchanged would be a test that looks green while its meaning drifted. It is
// restated to assert the behaviour that now has to hold.
test('P3-2 (restated post-repair) — the foreign coordinate is RECORDED, not dropped', () => {
  const s = scope({ invocation: 'test_cohort.py::test_b', collectionCohort: 'a b', pluginSet: 'x' });
  assert.equal(s.collectionCohort, undefined, 'it is still not a discriminating dimension');
  assert.equal(s[UNADMITTED].collectionCohort, 'a b', 'but it is PRESENT and readable');
  assert.equal(s[UNADMITTED].pluginSet, 'x');
  assert.equal(s.invocation, 'test_cohort.py::test_b');
});

test('P3-8 — a foreign coordinate can no longer silently vanish, end to end', () => {
  const rec = { nodeid: 't.py::b', nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'pytest', producerVersion: '8', invocation: 't.py::b',
      collectionCohort: 'A B', pluginSet: 'P' } };
  // through the ADAPTER...
  const adapted = adaptRecord(rec);
  assert.equal(adapted.scope[UNADMITTED].collectionCohort, 'A B',
    'the adapter carries what it cannot map');
  // ...and through scope(), which is where the first version of this repair silently threw it away again
  const s = scope(adapted.scope);
  assert.equal(s[UNADMITTED].collectionCohort, 'A B', 'and scope() MERGES rather than discards');
  assert.equal(s[UNADMITTED].pluginSet, 'P');
  assert.equal(JSON.stringify(s).includes('A B'), true);
});

test('P3-9 — an UNADMITTED coordinate may NOT defeat a comparison', () => {
  resetScopeDimensions();
  const a = scope({ invocation: 'n', criterion: 'pytest 8', collectionCohort: 'A' });
  const b = scope({ invocation: 'n', criterion: 'pytest 8', collectionCohort: 'A B' });
  assert.notDeepEqual(a[UNADMITTED], b[UNADMITTED], 'the difference is RECORDED');
  assert.deepEqual(joinConflicts(a, b), [],
    'and it does NOT block the join - recording a difference must never become an excuse');
  assert.equal(covers(a, b).ok, true, 'nor defeat coverage');

  // the anti-overfitting audit says the same thing, in its own words
  const reg = registry([{ name: 'criterion', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'authorities applying different criteria are not disagreeing',
    arguedFrom: ARGUED_FROM.DESIGN }]);
  const d = comparisonDefeat({ a: { criterion: 'x', collectionCohort: 'A' },
    b: { criterion: 'x', collectionCohort: 'A B' }, reg });
  assert.equal(d.defeats, false);
  assert.deepEqual(d.incidental, ['collectionCohort']);
});

test('P3-10 — admitting a dimension NARROWS authority; it never widens it', () => {
  resetScopeDimensions();
  const before = scopeDimensions().length;

  // what was refused before must not become admitted merely because a new dimension exists
  const granted = scope({ criterion: 'pytest 8' });
  const askedFor = scope({ criterion: 'pytest 8', invocation: 'n' });
  const refusedBefore = covers(granted, askedFor).ok;
  assert.equal(refusedBefore, false, 'the control: this was refused before the admission');

  // `producer` was added to the entry after composition attack C4: an admission argued from pytest's
  // fixture semantics governs pytest records, and a same-named key on another producer's record is
  // recorded rather than promoted.
  const v = admitScopeDimension({ name: 'collectionCohort', side: 'CONTEXT', producer: 'pytest',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them, so a'
      + ' verdict for one nodeid is conditional on which other nodes were collected.',
    arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'producer #3 prereg, 0baca08' });
  assert.equal(v.admitted, true);
  assert.equal(scopeDimensions().length, before + 1);
  assert.equal(covers(granted, askedFor).ok, false, 'still refused - authority did not widen');

  // and the newly admitted coordinate is now DISCRIMINATING, which is strictly narrowing
  const a = scope({ criterion: 'c', collectionCohort: 'A' });
  const b = scope({ criterion: 'c', collectionCohort: 'A B' });
  assert.equal(a.collectionCohort, 'A', 'PROMOTED out of UNADMITTED into a real dimension');
  assert.equal(joinConflicts(a, b).length, 1, 'and NOW it is entitled to block the join');
  assert.equal(covers(a, b).ok, false);
  resetScopeDimensions();
});

test('P3-10b — the gate REFUSES with a reason, and a refusal changes nothing', () => {
  resetScopeDimensions();
  const before = scopeDimensions().slice();

  const noSide = admitScopeDimension({ name: 'wallClock',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'x', arguedFrom: ARGUED_FROM.DESIGN });
  assert.equal(noSide.admitted, false);
  assert.match(noSide.why, /must declare its SIDE/);

  const circular = admitScopeDimension({ name: 'phaseOfMoon', side: 'CONTEXT',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'the two runs differed on it, which explains the discrepancy',
    arguedFrom: ARGUED_FROM.OBSERVED_DISCREPANCY });
  assert.equal(circular.admitted, false, 'explanatory power does not grant discriminative authority');

  assert.deepEqual(scopeDimensions(), before, 'a refusal leaves the active set untouched');
});

test('P3-5 — NON-VACUITY CONTROL: a coordinate that IS one of the six survives scope() intact', () => {
  const s = scope({ invocation: 'i', criterion: 'c', repository: 'r' });
  assert.equal(s.invocation, 'i');
  assert.equal(s.criterion, 'c');
  assert.equal(s.repository, 'r');
  // without this, "silently dropped" would pass for free
});

// P3-3 HELD PRE-REPAIR and STILL HOLDS, which is deliberate rather than an unfixed defect. admitDimension
// is the JUDGEMENT and it remains inert on its own; admitScopeDimension is the DOOR. Keeping the raw gate
// callable and inert is itself a trap - someone may call it and believe something happened - so the fact
// is pinned here by execution rather than left to be rediscovered.
test('P3-3 — admitDimension alone is a JUDGEMENT, not a door; only admitScopeDimension changes anything',
  () => {
    const verdict = admitDimension({
      name: 'collectionCohort',
      relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
      argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them, so'
        + ' a verdict for one nodeid is conditional on which other nodes were collected. Argued from'
        + " pytest's documented fixture-scope semantics.",
      arguedFrom: ARGUED_FROM.SPECIFICATION,
      establishedAt: 'producer #3 preregistration, 0baca08',
    });
    assert.equal(verdict.admitted, true, 'the GATE admits it: ' + verdict.why);

    // PRE-REPAIR (17edf5e) the coordinate was DROPPED here. It is now recorded, but it is still not a
    // discriminating dimension - because admitDimension by itself feeds nothing into the active set.
    resetScopeDimensions();
    const s = scope({ invocation: 'n', collectionCohort: 'a b' });
    assert.equal(s.collectionCohort, undefined, 'the raw gate alone promotes nothing');
    assert.equal(s[UNADMITTED].collectionCohort, 'a b', 'though it is no longer thrown away');
    assert.equal(scopeDimensions().includes('collectionCohort'), false);
  });

// NOT A FROZEN PREDICTION. The prereg predicted a silent DROP and it held. This was worse and was NOT
// predicted, so it is a DISCOVERY and is not counted as a confirmed prediction.
//
// PRE-REPAIR, pinned at 17edf5e: the two scopes were deepEqual, joinConflicts returned [] and each
// covered the other - a CONTRADICTION REPORTED AS AGREEMENT. This now asserts the repaired behaviour,
// and the six dimensions STILL cannot explain the disagreement. That has not changed and is not claimed
// to have. What changed is that the difference is now VISIBLE, and can be made discriminating THROUGH
// THE GATE rather than by editing a constant.
test('DISCOVERY (beyond the prereg), now repaired — the contradiction is visible and explicable', () => {
  const dir = suite();
  const alone = runPytestProducer({ dir, select: ['test_cohort.py::test_b'] });
  const together = runPytestProducer({ dir, select: ['test_cohort.py'] });
  const a = adaptRecord(alone.records.find((r) => r.nodeid.endsWith('::test_b')));
  const b = adaptRecord(together.records.find((r) => r.nodeid.endsWith('::test_b')));

  assert.notEqual(a.native.result, b.native.result, 'the producer genuinely disagrees with itself');

  resetScopeDimensions();
  const sa = scope(a.scope);
  const sb = scope(b.scope);

  // THE SIX STILL CANNOT EXPLAIN IT. That is unchanged by the repair and is not claimed to be.
  for (const d of SIX) assert.equal(sa[d], sb[d], d + ' is identical across the two runs');

  // WHAT CHANGED: the difference is no longer invisible.
  assert.notEqual(sa[UNADMITTED].collectionCohort, sb[UNADMITTED].collectionCohort);

  // and it is still not entitled to defeat the comparison, because the gate has not admitted it
  assert.deepEqual(joinConflicts(sa, sb), []);
  assert.equal(covers(sa, sb).ok, true);

  // NOW TAKE IT THROUGH THE GATE. This is the path that did not exist before the repair.
  const v = admitScopeDimension({ name: 'collectionCohort', side: 'CONTEXT', producer: 'pytest',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them, so a'
      + ' verdict for one nodeid is conditional on which other nodes were collected. Argued from'
      + " pytest's documented fixture-scope semantics, not from this disagreement.",
    arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'producer #3 prereg, 0baca08' });
  assert.equal(v.admitted, true);

  const ta = scope(a.scope);
  const tb = scope(b.scope);
  assert.equal(ta.collectionCohort, a.scope[UNADMITTED].collectionCohort, 'promoted, no re-observation');
  const conflicts = joinConflicts(ta, tb);
  assert.equal(conflicts.length, 1, 'and NOW the join is correctly refused');
  assert.equal(conflicts[0].dimension, 'collectionCohort');

  // THE POINT. The two verdicts are no longer a contradiction at all - they are claims about DIFFERENT
  // SUBJECTS, refused a comparison for a stated and independently argued reason. That is what the
  // architecture always claimed and had never implemented.
  resetScopeDimensions();
  rmSync(dir, { recursive: true, force: true });
});

test('P3-4 — the adapter does not squeeze the foreign coordinate into a declared dimension', () => {
  const rec = { nodeid: 'test_x.py::test_y', nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'pytest', producerVersion: '9.9', invocation: 'test_x.py::test_y',
      collectionCohort: 'A B C', pluginSet: 'P Q' } };
  const sc = adaptRecord(rec).scope;
  for (const d of SIX) {
    if (sc[d] === undefined) continue;
    assert.equal(String(sc[d]).includes('A B C'), false, d + ' must not become a home for the cohort');
    assert.equal(String(sc[d]).includes('P Q'), false, d + ' must not become a home for the plugin set');
  }
});

test('P3-6 — producer failure is non-knowledge', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pyt3-empty-'));
  writeFileSync(join(dir, 'test_none.py'), '# no tests here' + NL, 'utf8');
  const p = runPytestProducer({ dir, select: ['test_missing_entirely.py'] });
  // whichever way pytest reports it, NO verdict about any subject may be manufactured
  if (p.ok) assert.equal(p.records.length, 0, 'no records, therefore no claims');
  else assert.equal(p.producerFailed, true);
  rmSync(dir, { recursive: true, force: true });
});

test('P3-7 — doctest and git evidence unchanged', () => {
  const dt = { nativeResult: 'PASS', nativeDetails: { got: 'x' }, want: 'x\n', source: 'f()',
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } };
  const o = adaptRecord(dt);
  assert.equal(o.scope.history, 'm.f#0');
  assert.equal(o.scope.criterion, 'CPython doctest 3.13');
  assert.equal(o.observability, 'OBSERVED');
  assert.equal(o.assertion, 'HELD');
  assert.equal(o.native.want, 'x\n');

  const g = { path: 'x', nativeResult: 'TRACKED_CLEAN', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40),
      head: 'b'.repeat(40) } };
  const gs = adaptRecord(g).scope;
  assert.equal(Object.hasOwn(gs, 'history'), false);
  assert.equal(gs.implementation, 'a'.repeat(40));
  assert.equal(gs.repository, 'b'.repeat(40));
});
