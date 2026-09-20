// r4 — composition wave 2, the Law-4 adapter. Predictions frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-e, W2-g) BEFORE this file existed. Assertions state the PREDICTED DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { adaptRecord, UNKNOWN_MAPPING } from './adapt.mjs';
import { OBSERVABILITY } from '../legaknow/observation.mjs';

test('W2-e-1 ATTACK — an absent producer version is stringified into the criterion', () => {
  const r = adaptRecord({ nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'pytest', invocation: 't.py::a' } });
  // PREDICTED DEFECT: UNKNOWN collapsing into a value.
  assert.equal(r.scope.criterion, 'pytest undefined', 'prediction W2-e-1');
});

test('W2-e-2 ATTACK — a record with no producer at all is adapted rather than refused', () => {
  const r = adaptRecord({ nativeResult: 'PASSED', nativeDetails: {}, identity: { invocation: 'x' } });
  assert.equal(r.scope.criterion, 'undefined undefined', 'prediction W2-e-2');
  assert.equal(r.rejected, undefined);
});

test('W2-e CONTROL — a versioned producer builds the criterion it always did', () => {
  const r = adaptRecord({ nativeResult: 'PASS', nativeDetails: {}, want: 'x\n', source: 'f()',
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } });
  assert.equal(r.scope.criterion, 'CPython doctest 3.13');
});

test('W2-g-1 ATTACK — a git record whose native result is spelled PASS receives doctest\'s semantics', () => {
  const r = adaptRecord({ path: 'x', nativeResult: 'PASS', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40), head: 'b'.repeat(40) } });
  // PREDICTED DEFECT: same name -> same authority, at the adapter.
  assert.equal(r.observability, OBSERVABILITY.OBSERVED, 'prediction W2-g-1');
  assert.equal(r.assertion, 'HELD');
});

test('W2-g-2 CONTROL — the same git record with git\'s own vocabulary is UNKNOWN_MAPPING', () => {
  const r = adaptRecord({ path: 'x', nativeResult: 'TRACKED_CLEAN', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40), head: 'b'.repeat(40) } });
  assert.equal(r.observability, UNKNOWN_MAPPING);
});

test('W2-g-3 CONTROL — a doctest PASS still maps', () => {
  const r = adaptRecord({ nativeResult: 'PASS', nativeDetails: {}, want: 'x\n', source: 'f()',
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } });
  assert.equal(r.observability, OBSERVABILITY.OBSERVED);
  assert.equal(r.assertion, 'HELD');
});

test('W2-g FINDING — pytest has no declared mapping: every pytest verdict is UNKNOWN_MAPPING today', () => {
  for (const native of ['PASSED', 'FAILED', 'SETUP_FAILED']) {
    const r = adaptRecord({ nodeid: 't.py::a', nativeResult: native, nativeDetails: {},
      identity: { producer: 'pytest', producerVersion: '9.1.1', invocation: 't.py::a',
        collectionCohort: 'A', pluginSet: 'P' } });
    assert.equal(r.observability, UNKNOWN_MAPPING, native);
  }
});
