// r4 — producer #3's declared mapping. Predictions PM-1..PM-6 frozen in benchmarks/PYTEST_MAPPING_PREREG.md
// BEFORE the mapping existed. PM-4 runs pytest.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPytestProducer } from './pytest-producer.mjs';
import { adaptRecord, PYTEST_MAPPING, DOCTEST_MAPPING, UNKNOWN_MAPPING } from './adapt.mjs';
import { OBSERVABILITY } from '../legaknow/observation.mjs';
import { illegalRefinement } from '../legaknow/monotonicity.mjs';
import { scope, covers, joinConflicts, admitScopeDimension, resetScopeDimensions, UNADMITTED,
  CONTEXT_DIMENSIONS, SUBJECT_DIMENSIONS } from '../legaknow/justification.mjs';
import { RELEVANCE, ARGUED_FROM } from '../legaknow/admissibility.mjs';

beforeEach(resetScopeDimensions);
afterEach(resetScopeDimensions);

const NL = String.fromCharCode(10);
const rec = (native, extra = {}) => ({ nodeid: 't.py::a', nativeResult: native, nativeDetails: {},
  identity: { producer: 'pytest', producerVersion: '9.1.1', invocation: 't.py::a',
    collectionCohort: 'A', pluginSet: 'P', ...extra } });

test('PM-1 — each native adapts to its declared state; an unlisted native is UNKNOWN_MAPPING', () => {
  const expect = {
    PASSED: [OBSERVABILITY.OBSERVED, 'HELD'],
    FAILED: [OBSERVABILITY.OBSERVED, 'REFUTED'],
    SKIPPED: [OBSERVABILITY.NOT_ATTEMPTED, null],
    SETUP_FAILED: [OBSERVABILITY.PREREQUISITE_MISSING, null],
    SETUP_SKIPPED: [OBSERVABILITY.NOT_ATTEMPTED, null],
  };
  for (const [native, [obs, assertion]] of Object.entries(expect)) {
    const r = adaptRecord(rec(native));
    assert.equal(r.observability, obs, native);
    assert.equal(r.assertion, assertion, native);
  }
  for (const native of ['XPASSED', 'RERUN', 'ERROR']) {
    assert.equal(adaptRecord(rec(native)).observability, UNKNOWN_MAPPING, native);
  }
});

test('PM-2 — a scoped claim derives from a pytest PASSED record (E6 for producer #3)', () => {
  const r = adaptRecord(rec('PASSED'));
  assert.equal(r.assertion, 'HELD');
  assert.equal(r.scope.criterion, 'pytest 9.1.1');
  assert.equal(r.scope.invocation, 't.py::a');
  assert.equal(r.scope[UNADMITTED].collectionCohort, 'A');
  assert.equal(r.scope[UNADMITTED].pluginSet, 'P');
  assert.equal(r.native.result, 'PASSED', 'raw survives');
});

test('PM-3 — NON-INVENTION, mechanically: two records pytest reports as FAILED grant identical permissions', () => {
  const states = [
    { name: 'assertion failed', source: 'FAILED', truth: 'ASSERTION' },
    { name: 'body raised', source: 'FAILED', truth: 'EXCEPTION' },
  ];
  const r = illegalRefinement({ states,
    adapt: (s) => adaptRecord(rec(s.source)).assertion,
    consumers: [{ name: 'treats as refuted', grants: (v) => v === 'REFUTED' },
      { name: 'treats as held', grants: (v) => v === 'HELD' }] });
  assert.equal(r.ok, true, 'the adapter reads only what pytest said');
});

const SUITE = ['import pytest', '', '@pytest.fixture(scope="module")', 'def counter():',
  '    return {"n": 0}', '', 'def test_a(counter):', '    counter["n"] += 1',
  '    assert counter["n"] == 1', '', 'def test_b(counter):', '    counter["n"] += 1',
  '    assert counter["n"] == 1', ''].join(NL);

test('PM-4 — the Entry 11 payoff with assertions: contradictory before admission, incomparable after', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pm4-'));
  writeFileSync(join(dir, 'test_cohort.py'), SUITE, 'utf8');
  const alone = runPytestProducer({ dir, select: ['test_cohort.py::test_b'] });
  const together = runPytestProducer({ dir, select: ['test_cohort.py'] });
  assert.equal(alone.ok && together.ok, true);
  const a = adaptRecord(alone.records.find((r) => r.nodeid.endsWith('::test_b')));
  const b = adaptRecord(together.records.find((r) => r.nodeid.endsWith('::test_b')));

  // FIRST HALF: real assertions, identical scopes over the six, comparable - and contradictory.
  assert.equal(a.assertion, 'HELD');
  assert.equal(b.assertion, 'REFUTED');
  const sa = scope(a.scope); const sb = scope(b.scope);
  for (const d of [...CONTEXT_DIMENSIONS, ...SUBJECT_DIMENSIONS]) assert.equal(sa[d], sb[d], d);
  assert.deepEqual(joinConflicts(sa, sb), []);
  assert.equal(covers(sa, sb).ok, true);
  assert.notEqual(a.assertion, b.assertion, 'same subject, compatible scope, opposite conclusions');

  // SECOND HALF: admitted for pytest, they are claims about different subjects.
  assert.equal(admitScopeDimension({ name: 'collectionCohort', side: 'CONTEXT', producer: 'pytest',
    relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
    argument: 'pytest builds module- and session-scoped fixtures once per session and reuses them',
    arguedFrom: ARGUED_FROM.SPECIFICATION, establishedAt: 'producer #3 prereg, 0baca08' }).admitted, true);
  const ta = scope(a.scope); const tb = scope(b.scope);
  const conflicts = joinConflicts(ta, tb);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].dimension, 'collectionCohort');
  rmSync(dir, { recursive: true, force: true });
});

test('PM-5 — doctest and git adaptations are byte-unchanged', () => {
  const dt = adaptRecord({ nativeResult: 'PASS', nativeDetails: { got: 'x' }, want: 'x\n', source: 'f()',
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } });
  assert.deepEqual([dt.scope.history, dt.scope.criterion, dt.observability, dt.assertion, dt.native.want],
    ['m.f#0', 'CPython doctest 3.13', 'OBSERVED', 'HELD', 'x\n']);
  const gs = adaptRecord({ path: 'x', nativeResult: 'TRACKED_CLEAN', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40), head: 'b'.repeat(40) } });
  assert.equal(Object.hasOwn(gs.scope, 'history'), false);
  assert.equal(gs.scope.implementation, 'a'.repeat(40));
  assert.equal(gs.observability, UNKNOWN_MAPPING);
});

test('PM-6 CONTROL — neither producer can use the other\'s mapping', () => {
  const pytestUnderDoctest = adaptRecord(rec('PASSED'), { mapping: DOCTEST_MAPPING });
  assert.equal(pytestUnderDoctest.observability, UNKNOWN_MAPPING);
  assert.match(pytestUnderDoctest.why, /declared for "CPython doctest" and this record is from "pytest"/);
  const doctestUnderPytest = adaptRecord({ nativeResult: 'PASSED', nativeDetails: {},
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } },
  { mapping: PYTEST_MAPPING });
  assert.equal(doctestUnderPytest.observability, UNKNOWN_MAPPING);
});
