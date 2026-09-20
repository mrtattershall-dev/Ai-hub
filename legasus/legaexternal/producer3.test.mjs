// r4 — producer #3 (pytest) against the evidence boundary. Predictions P3-1..P3-10 frozen in 0baca08.
//
// Run against the EXISTING boundary first, so that any shape change is DISCOVERED rather than pre-empted.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPytestProducer } from './pytest-producer.mjs';
import { adaptRecord } from './adapt.mjs';
import { scope, covers, joinConflicts, CONTEXT_DIMENSIONS, SUBJECT_DIMENSIONS }
  from '../legaknow/justification.mjs';
import { admitDimension, RELEVANCE, ARGUED_FROM } from '../legaknow/admissibility.mjs';

const NL = String.fromCharCode(10);
const SIX = [...CONTEXT_DIMENSIONS, ...SUBJECT_DIMENSIONS];

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

test('P3-2 — THE HYPOTHESIS: scope() SILENTLY DROPS a coordinate outside the six', () => {
  const s = scope({ invocation: 'test_cohort.py::test_b', collectionCohort: 'a b', pluginSet: 'x' });
  assert.equal(Object.hasOwn(s, 'collectionCohort'), false, 'the foreign coordinate is gone');
  assert.equal(Object.hasOwn(s, 'pluginSet'), false);
  // no error, no record, no UNKNOWN - it simply is not there
  assert.equal(s.invocation, 'test_cohort.py::test_b');
});

test('P3-5 — NON-VACUITY CONTROL: a coordinate that IS one of the six survives scope() intact', () => {
  const s = scope({ invocation: 'i', criterion: 'c', repository: 'r' });
  assert.equal(s.invocation, 'i');
  assert.equal(s.criterion, 'c');
  assert.equal(s.repository, 'r');
  // without this, "silently dropped" would pass for free
});

test('P3-3 — admitDimension says YES and it changes NOTHING. Shown by EXECUTION, not by import-grep',
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

    // AND THE ADMISSION IS INERT. scope() reads a module constant; nothing feeds the gate's answer in.
    const s = scope({ invocation: 'n', collectionCohort: 'a b' });
    assert.equal(Object.hasOwn(s, 'collectionCohort'), false,
      'ADMITTED and still dropped - the deciding path and the advisory path are not the same path');
  });

// NOT A FROZEN PREDICTION. The prereg predicted a silent DROP (P3-2) and it holds. This is worse than
// what was predicted and it was not predicted, so it is labelled a DISCOVERY and not counted as a
// confirmed prediction. P3-9 keeps its frozen meaning: a POST-REPAIR requirement, tested below.
test('DISCOVERY (beyond the prereg) — the closed dimension set ADMITS A CONTRADICTION', () => {
  const dir = suite();
  const alone = runPytestProducer({ dir, select: ['test_cohort.py::test_b'] });
  const together = runPytestProducer({ dir, select: ['test_cohort.py'] });
  const a = adaptRecord(alone.records.find((r) => r.nodeid.endsWith('::test_b')));
  const b = adaptRecord(together.records.find((r) => r.nodeid.endsWith('::test_b')));

  assert.notEqual(a.native.result, b.native.result, 'the producer genuinely disagrees with itself');

  const sa = scope(a.scope);
  const sb = scope(b.scope);
  assert.deepEqual(sa, sb, 'yet the two scopes are IDENTICAL on all six dimensions');
  assert.deepEqual(joinConflicts(sa, sb), [],
    'so the join gate sees NO conflict and would let these two compose');
  assert.equal(covers(sa, sb).ok, true, 'and each covers the other');

  // THIS IS WORSE THAN A DROPPED COORDINATE. The closed dimension set does not merely lose information -
  // it admits a CONTRADICTION it has no vocabulary to explain, and reports the two as comparable.
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
