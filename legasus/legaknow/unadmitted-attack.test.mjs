// r4 — ATTACK on the UNADMITTED mechanism. Predictions frozen in benchmarks/COMPOSITION_PREREG.md
// (C4, C5, C6) BEFORE this file existed. Assertions state the PREDICTED DEFECT.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { scope, covers, joinConflicts, admitScopeDimension, scopeDimensions, resetScopeDimensions,
  UNADMITTED } from './justification.mjs';
import { RELEVANCE, ARGUED_FROM } from './admissibility.mjs';

beforeEach(resetScopeDimensions);
afterEach(resetScopeDimensions);

const PYTEST_COHORT = {
  name: 'collectionCohort', side: 'CONTEXT', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
  argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them, so a'
    + ' verdict for one nodeid is conditional on which other nodes were collected.',
  arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'producer #3 prereg, 0baca08',
};

// ------------------------------------------------------------------ C4: promotion by name

test('C4-a ATTACK — a git-shaped scope carrying a key NAMED collectionCohort is promoted by pytest\'s admission', () => {
  assert.equal(admitScopeDimension(PYTEST_COHORT).admitted, true);
  const g1 = scope({ criterion: 'git 2.43', repository: 'h', implementation: 'o1',
    [UNADMITTED]: { collectionCohort: 'x' } });
  const g2 = scope({ criterion: 'git 2.43', repository: 'h', implementation: 'o2',
    [UNADMITTED]: { collectionCohort: 'y' } });
  // PREDICTED DEFECT: promoted on a string match; two git records are now refused a join on a
  // dimension whose relevance argument is about pytest fixtures.
  assert.equal(g1.collectionCohort, 'x', 'prediction C4-a: promoted by name');
  const conflicts = joinConflicts(g1, g2);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].dimension, 'collectionCohort');
});

test('C4-b POSITIVE CONTROL — a pytest-shaped scope promotes, and that is correct', () => {
  assert.equal(admitScopeDimension(PYTEST_COHORT).admitted, true);
  const p = scope({ criterion: 'pytest 9.1.1', invocation: 't.py::b',
    [UNADMITTED]: { collectionCohort: 'A B' } });
  assert.equal(p.collectionCohort, 'A B');
});

// ------------------------------------------------------------------ C5: the reserved key

test('C5-a ATTACK — the bookkeeping key UNADMITTED is admissible as a dimension', () => {
  const r = admitScopeDimension({ name: UNADMITTED, side: 'CONTEXT',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'reserved-name probe',
    arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'C5 attack' });
  // PREDICTED DEFECT: admitted.
  assert.equal(r.admitted, true, 'prediction C5-a: ' + (r.why || ''));
  assert.equal(scopeDimensions().includes(UNADMITTED), true);
});

test('C5-b ATTACK — with UNADMITTED active, two scopes carrying IDENTICAL blocks fail covers()', () => {
  admitScopeDimension({ name: UNADMITTED, side: 'CONTEXT',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'reserved-name probe',
    arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'C5 attack' });
  const a = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  const b = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  // PREDICTED DEFECT: NOT_COMPARABLE manufactured out of object identity on a bookkeeping key.
  assert.equal(covers(a, b).ok, false, 'prediction C5-b: coverage refused');
});

test('C5-c CONTROL — before any such admission the same two scopes cover each other', () => {
  const a = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  const b = scope({ criterion: 'c', [UNADMITTED]: { q: 1 } });
  assert.equal(covers(a, b).ok, true);
});

// ------------------------------------------------------------------ C6: shadowing

test('C6-a ATTACK — a carried value shadowed by a top-level value of the same UNADMITTED name vanishes', () => {
  const s = scope({ foo: 'top-B', [UNADMITTED]: { foo: 'carried-A' } });
  // PREDICTED DEFECT: only 'top-B' survives, with no record that 'carried-A' was ever carried.
  assert.equal(s[UNADMITTED].foo, 'top-B');
  assert.equal(JSON.stringify(s).includes('carried-A'), false, 'prediction C6-a: silently dropped');
});

test('C6-b ATTACK — the same shadowing after the name is ADMITTED', () => {
  assert.equal(admitScopeDimension({ name: 'foo', side: 'CONTEXT',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'C6 probe', arguedFrom: ARGUED_FROM.DESIGN,
    establishedAt: 'C6 attack' }).admitted, true);
  const s = scope({ foo: 'top-B', [UNADMITTED]: { foo: 'carried-A' } });
  assert.equal(s.foo, 'top-B');
  assert.equal(JSON.stringify(s).includes('carried-A'), false, 'prediction C6-b: silently dropped');
});

test('C6-c CONTROL — with no top-level value the carried one is kept (the Entry 11 contract holds there)', () => {
  const s = scope({ [UNADMITTED]: { foo: 'carried-A' } });
  assert.equal(s[UNADMITTED].foo, 'carried-A');
});
