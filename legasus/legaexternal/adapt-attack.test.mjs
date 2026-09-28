// r4 — composition wave 2, the Law-4 adapter. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG_2.md (W2-e, W2-g); the PRE-REPAIR run that reproduced them is preserved
// in benchmarks/RESULT.composition-2.md and at b0673cd, where this file asserted the defects. It now
// asserts the repairs and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { adaptRecord, readapt, UNKNOWN_MAPPING, DOCTEST_MAPPING, FOR_PRODUCER } from './adapt.mjs';
import { OBSERVABILITY } from '../legaknow/observation.mjs';

const GIT = { path: 'x', nativeDetails: {},
  identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40), head: 'b'.repeat(40) } };
const DOC = { nativeDetails: {}, want: 'x\n', source: 'f()',
  identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } };

test('W2-e-1 REGRESSION — an absent producer version is NOT stringified; the criterion is the producer alone', () => {
  const r = adaptRecord({ nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'pytest', invocation: 't.py::a' } });
  assert.equal(r.scope.criterion, 'pytest', 'b0673cd wrote "pytest undefined"');
  assert.equal(JSON.stringify(r.scope).includes('undefined'), false);
});

test('W2-e-2 REGRESSION — a record with no producer is REFUSED, not adapted', () => {
  const r = adaptRecord({ nativeResult: 'PASSED', nativeDetails: {}, identity: { invocation: 'x' } });
  assert.equal(r.rejected, true, 'b0673cd adapted this under "undefined undefined"');
  assert.match(r.why, /names no producer/);
  assert.equal(r.scope, undefined);
});

test('W2-e CONTROL — a versioned producer builds the criterion it always did', () => {
  assert.equal(adaptRecord({ ...DOC, nativeResult: 'PASS' }).scope.criterion, 'CPython doctest 3.13');
});

test('W2-g-1 REGRESSION — a git record spelled PASS does NOT receive doctest\'s semantics', () => {
  const r = adaptRecord({ ...GIT, nativeResult: 'PASS' });
  assert.equal(r.observability, UNKNOWN_MAPPING, 'b0673cd granted OBSERVED / HELD here');
  assert.equal(r.assertion, null);
  assert.match(r.why, /no mapping is declared for producer "git"/);
  // and handing it the doctest mapping EXPLICITLY does not help: the mapping says who it is for
  const forced = adaptRecord({ ...GIT, nativeResult: 'PASS' }, { mapping: DOCTEST_MAPPING });
  assert.equal(forced.observability, UNKNOWN_MAPPING);
  assert.match(forced.why, /declared for "CPython doctest" and this record is from "git"/);
});

test('W2-g-2 CONTROL — git\'s own vocabulary is UNKNOWN_MAPPING, as before', () => {
  assert.equal(adaptRecord({ ...GIT, nativeResult: 'TRACKED_CLEAN' }).observability, UNKNOWN_MAPPING);
});

test('W2-g-3 CONTROL — a doctest PASS still maps, by default and under an explicit mapping', () => {
  const r = adaptRecord({ ...DOC, nativeResult: 'PASS' });
  assert.equal(r.observability, OBSERVABILITY.OBSERVED);
  assert.equal(r.assertion, 'HELD');
  assert.equal(adaptRecord({ ...DOC, nativeResult: 'PASS' }, { mapping: DOCTEST_MAPPING }).assertion, 'HELD');
});

test('W2-g-4 ADMIT CONTROL — a mapping extended by spread keeps its producer, so re-adaptation still works', () => {
  const later = { ...DOCTEST_MAPPING, NEW_NATIVE: { observability: OBSERVABILITY.OBSERVED, assertion: 'HELD' } };
  assert.equal(later[FOR_PRODUCER], 'CPython doctest');
  const [r] = readapt([{ ...DOC, nativeResult: 'NEW_NATIVE' }], { mapping: later });
  assert.equal(r.assertion, 'HELD');
  // a mapping that declares no producer applies to nobody
  const anon = { PASS: { observability: OBSERVABILITY.OBSERVED, assertion: 'HELD' } };
  const a = adaptRecord({ ...DOC, nativeResult: 'PASS' }, { mapping: anon });
  assert.equal(a.observability, UNKNOWN_MAPPING);
  assert.match(a.why, /declares no producer/);
});

// This test recorded, at b0673cd, that pytest had NO declared mapping and every pytest verdict was
// UNKNOWN_MAPPING. That finding opened the objective preregistered in PYTEST_MAPPING_PREREG.md and
// resolved at the commit that registered PYTEST_MAPPING. The finding is history (RESULT.composition-2.md
// keeps it); the test now asserts the state that replaced it, with git as the producer that still has
// no registered mapping - so "no mapping for producer X" stays a reachable, non-vacuous answer.
test('W2-g FINDING, superseded — pytest now has a declared mapping; a producer without one is still refused by name', () => {
  const r = adaptRecord({ nodeid: 't.py::a', nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'pytest', producerVersion: '9.1.1', invocation: 't.py::a',
      collectionCohort: 'A', pluginSet: 'P' } });
  assert.equal(r.observability, OBSERVABILITY.OBSERVED, 'b0673cd: UNKNOWN_MAPPING');
  assert.equal(r.assertion, 'HELD');
  const g = adaptRecord({ path: 'x', nativeResult: 'TRACKED_CLEAN', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40), head: 'b'.repeat(40) } });
  assert.equal(g.observability, UNKNOWN_MAPPING);
  assert.match(g.why, /no mapping is declared for producer "git"/);
});
