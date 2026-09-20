// r4 — the UNADMITTED mechanism under attack. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG.md (C4, C5, C6); the PRE-REPAIR run that reproduced all three is
// preserved in benchmarks/RESULT.composition.md and at b11e51f, where this file asserted the defects.
// It now asserts the repairs and keeps every control - including the positive controls, because a
// mechanism that solves this by ignoring every coordinate has failed.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { scope, covers, joinConflicts, admitScopeDimension, scopeDimensions, resetScopeDimensions,
  UNADMITTED } from './justification.mjs';
import { admitDimension, RELEVANCE, ARGUED_FROM } from './admissibility.mjs';

beforeEach(resetScopeDimensions);
afterEach(resetScopeDimensions);

const PYTEST_COHORT = {
  name: 'collectionCohort', side: 'CONTEXT', producer: 'pytest',
  relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
  argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them, so a'
    + ' verdict for one nodeid is conditional on which other nodes were collected.',
  arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'producer #3 prereg, 0baca08',
};

// ------------------------------------------------------------------ C4: promotion by name

test('C4-a REGRESSION — a git-shaped scope carrying a key NAMED collectionCohort is NOT promoted by pytest\'s admission', () => {
  assert.equal(admitScopeDimension(PYTEST_COHORT).admitted, true);
  const g1 = scope({ criterion: 'git 2.43', repository: 'h', implementation: 'o1',
    [UNADMITTED]: { collectionCohort: 'x' } });
  const g2 = scope({ criterion: 'git 2.43', repository: 'h', implementation: 'o2',
    [UNADMITTED]: { collectionCohort: 'y' } });
  assert.equal(g1.collectionCohort, null, 'b11e51f promoted this on a string match');
  assert.equal(g1[UNADMITTED].collectionCohort, 'x', 'still recorded');
  assert.deepEqual(joinConflicts(g1, g2), [], 'and two git records are still comparable');
});

test('C4-b POSITIVE CONTROL — a pytest-shaped scope promotes, and the join is then refused', () => {
  assert.equal(admitScopeDimension(PYTEST_COHORT).admitted, true);
  const p1 = scope({ criterion: 'pytest 9.1.1', invocation: 't.py::b', [UNADMITTED]: { collectionCohort: 'A' } });
  const p2 = scope({ criterion: 'pytest 9.1.1', invocation: 't.py::b', [UNADMITTED]: { collectionCohort: 'A B' } });
  assert.equal(p1.collectionCohort, 'A');
  assert.equal(joinConflicts(p1, p2).length, 1);
  assert.equal(joinConflicts(p1, p2)[0].dimension, 'collectionCohort');
});

test('C4-c — a scope that does not say which producer established it gets nobody\'s coordinate', () => {
  assert.equal(admitScopeDimension(PYTEST_COHORT).admitted, true);
  const s = scope({ invocation: 'n', [UNADMITTED]: { collectionCohort: 'A' } });
  assert.equal(s.collectionCohort, null);
  assert.equal(s[UNADMITTED].collectionCohort, 'A');
});

test('C4-d — an admission that names no producer is refused with a reason, and changes nothing', () => {
  const before = scopeDimensions().slice();
  const { producer, ...noProducer } = PYTEST_COHORT;
  const r = admitScopeDimension(noProducer);
  assert.equal(r.admitted, false);
  assert.match(r.why, /PRODUCER/);
  assert.deepEqual(scopeDimensions(), before);
});

// ------------------------------------------------------------------ C5: the reserved key

test('C5-a REGRESSION — the bookkeeping key UNADMITTED is refused as a dimension, at both gates', () => {
  const entry = { name: UNADMITTED, side: 'CONTEXT', producer: 'probe',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'reserved-name probe',
    arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'C5' };
  const r = admitScopeDimension(entry);
  assert.equal(r.admitted, false, 'b11e51f admitted this');
  assert.match(r.why, /reserved bookkeeping key/);
  assert.equal(admitDimension(entry).admitted, false, 'the judgement refuses it too, not only the door');
  assert.equal(scopeDimensions().includes(UNADMITTED), false);
  for (const bad of ['', 'SHADOWED:x', 'a b', '1abc', null]) {
    assert.equal(admitDimension({ ...entry, name: bad }).admitted, false, String(bad));
  }
});

test('C5-b — two scopes carrying IDENTICAL blocks still cover each other (no NOT_COMPARABLE from bookkeeping)', () => {
  const a = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  const b = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  assert.equal(covers(a, b).ok, true);
  assert.deepEqual(joinConflicts(a, b), []);
});

test('C5-c ADMIT CONTROL — an ordinary identifier with a producer is still admissible', () => {
  assert.equal(admitScopeDimension({ ...PYTEST_COHORT, name: 'fixtureScope' }).admitted, true);
  assert.equal(scopeDimensions().includes('fixtureScope'), true);
});

// ------------------------------------------------------------------ C6: shadowing

test('C6-a REGRESSION — a carried value shadowed by a top-level value of the same unadmitted name is RECORDED', () => {
  const s = scope({ foo: 'top-B', [UNADMITTED]: { foo: 'carried-A' } });
  assert.equal(s[UNADMITTED].foo, 'top-B', 'the declared value still wins');
  assert.equal(s[UNADMITTED]['SHADOWED:foo'], 'carried-A', 'b11e51f dropped this');
  // and the record survives a second pass through scope()
  assert.equal(scope(s)[UNADMITTED]['SHADOWED:foo'], 'carried-A');
});

test('C6-b REGRESSION — the same shadowing after the name is ADMITTED', () => {
  assert.equal(admitScopeDimension({ ...PYTEST_COHORT, name: 'foo' }).admitted, true);
  const s = scope({ criterion: 'pytest 9', foo: 'top-B', [UNADMITTED]: { foo: 'carried-A' } });
  assert.equal(s.foo, 'top-B');
  assert.equal(s[UNADMITTED]['SHADOWED:foo'], 'carried-A');
  assert.equal(covers(s, scope({ criterion: 'pytest 9', foo: 'top-B' })).ok, true,
    'the shadow record never affects comparison');
});

test('C6-c CONTROL — with no top-level value the carried one is kept and nothing is marked shadowed', () => {
  const s = scope({ [UNADMITTED]: { foo: 'carried-A' } });
  assert.equal(s[UNADMITTED].foo, 'carried-A');
  assert.equal(Object.keys(s[UNADMITTED]).some((k) => k.startsWith('SHADOWED:')), false);
  // an EQUAL top-level value is not a shadow either
  const same = scope({ foo: 'v', [UNADMITTED]: { foo: 'v' } });
  assert.equal(Object.keys(same[UNADMITTED]).some((k) => k.startsWith('SHADOWED:')), false);
});
