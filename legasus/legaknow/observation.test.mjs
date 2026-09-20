// OBSERVATION — controls on the layer BENEATH entitlement, which run 0 proved the algebra cannot protect.
//
// The algebra reasoned correctly over the empty set and produced a false clean result, because the
// evidence object lied about its own provenance. These tests are about making that lie unrepresentable.
import test from 'node:test';
import assert from 'node:assert';
import { observation, evidenceFrom, degrade, admissibleAsPrimitive, OBSERVABILITY,
  PROVENANCE_FIELDS } from './observation.mjs';
import { DIMENSIONS } from './justification.mjs';

const full = (status, value = 'v') => observation({ status, value,
  subject: 'utils.canonicalize_name#3f7c', producer: 'line-tracer', procedure: 'observe()',
  attribution: 'frame co_qualname', context: 'repoB@pristine' });

test('AN OBSERVATION WITHOUT A STATUS IS MALFORMED — there is no default', () => {
  const o = observation({ value: 'something' });
  assert.equal(o.malformed, true);
  assert.match(o.why, /eight different situations into one empty value/);
  assert.equal(evidenceFrom(o).ok, false);
});

test('EIGHT SITUATIONS, EIGHT STATUSES — and only two carry evidential force', () => {
  const evidential = [];
  for (const s of Object.values(OBSERVABILITY)) {
    if (evidenceFrom(full(s)).ok) evidential.push(s);
  }
  assert.deepEqual(evidential.sort(), [OBSERVABILITY.EMPTY_OBSERVED, OBSERVABILITY.OBSERVED].sort());
  // and each refusal names the actual status, so a caller can tell an observer failure from a subject one
  assert.equal(evidenceFrom(full(OBSERVABILITY.PRODUCER_FAILED)).reason, 'PRODUCER_FAILED');
  assert.equal(evidenceFrom(full(OBSERVABILITY.SUBJECT_FAILED)).reason, 'SUBJECT_FAILED');
  assert.notEqual(evidenceFrom(full(OBSERVABILITY.PRODUCER_FAILED)).reason,
    evidenceFrom(full(OBSERVABILITY.SUBJECT_FAILED)).reason);
});

test('THE RUN 0 CONTROL — a real empty result and a failed observer must NOT be the same object', () => {
  // `failSet(null) -> {}` made these identical. That single collapse produced a false clean result that
  // no correctness in the entitlement algebra could have caught.
  const reallyEmpty = evidenceFrom(full(OBSERVABILITY.EMPTY_OBSERVED, null));
  const observerDied = evidenceFrom(full(OBSERVABILITY.PRODUCER_FAILED, null));

  assert.equal(reallyEmpty.ok, true, 'a genuine empty result IS evidence');
  assert.equal(reallyEmpty.empty, true);
  assert.equal(observerDied.ok, false, 'a dead observer is NOT a clean negative');
  assert.notDeepEqual(reallyEmpty, observerDied,
    'if these are ever equal again, run 0 can happen again');
});

test('ATTRIBUTION IS PART OF TRUTH — provenance-incomplete evidence is refused', () => {
  for (const field of PROVENANCE_FIELDS) {
    const o = degrade(full(OBSERVABILITY.OBSERVED), field);
    const e = evidenceFrom(o);
    assert.equal(e.ok, false, field + ' must be required');
    assert.equal(e.reason, 'PROVENANCE_INCOMPLETE');
    assert.ok(e.missing.includes(field));
  }
  assert.equal(evidenceFrom(full(OBSERVABILITY.OBSERVED)).ok, true,
    'and a complete observation is admitted, or this is a refusal machine');
});

test('LOSS OF PROVENANCE MUST NEVER INCREASE ENTITLEMENT — exhaustively', () => {
  // The universal property, checked over every status x every provenance field rather than argued.
  let checked = 0;
  for (const status of Object.values(OBSERVABILITY)) {
    const base = full(status);
    const before = evidenceFrom(base).ok;
    for (const field of PROVENANCE_FIELDS) {
      const after = evidenceFrom(degrade(base, field)).ok;
      assert.ok(!(after && !before),
        'degrading ' + field + ' under ' + status + ' INCREASED entitlement');
      assert.ok(after === false || before === true);
      checked++;
    }
  }
  assert.equal(checked, Object.values(OBSERVABILITY).length * PROVENANCE_FIELDS.length);
});

test('THE TRUST BASE IS A TESTABLE PROPERTY — a procedure whose failure is unrepresentable is refused', () => {
  // This is why "who verifies the verifier?" does not run forever.
  const alwaysFine = admissibleAsPrimitive({ name: 'alwaysFine',
    run: () => ({ status: OBSERVABILITY.OBSERVED, value: 1 }),
    probes: ['good', 'catastrophic', null] });
  assert.equal(alwaysFine.ok, false);
  assert.match(alwaysFine.why, /no failure of it is representable/);

  // A procedure that returns a bare value cannot say how it was produced.
  const noStatus = admissibleAsPrimitive({ name: 'noStatus', run: () => [], probes: ['x'] });
  assert.equal(noStatus.ok, false);
  assert.match(noStatus.why, /cannot say how it was produced/);

  // An untested failure mode is a silent one.
  assert.equal(admissibleAsPrimitive({ name: 'unprobed', run: () => ({ status: 'OBSERVED' }) }).ok,
    false);

  // POSITIVE CONTROL: a procedure that CAN report its own failure is admissible.
  const honest = admissibleAsPrimitive({ name: 'honest',
    run: (p) => (p === null
      ? { status: OBSERVABILITY.PRODUCER_FAILED }
      : { status: OBSERVABILITY.OBSERVED, value: p }),
    probes: ['good', null] });
  assert.equal(honest.ok, true);
  assert.deepEqual(honest.representableFailures, [OBSERVABILITY.PRODUCER_FAILED]);
});

test('a procedure that THROWS is treated as a representable failure, not as a crash of the audit', () => {
  const throwy = admissibleAsPrimitive({ name: 'throwy',
    run: (p) => { if (p === null) throw new Error('boom'); return { status: OBSERVABILITY.OBSERVED }; },
    probes: ['ok', null] });
  assert.equal(throwy.ok, true);
  assert.ok(throwy.representableFailures.includes(OBSERVABILITY.PRODUCER_FAILED));
});

test('HISTORY is a scope dimension, because the subject includes its causal context', () => {
  // Read from the one definition; the observation-side copy was removed (composition attack C10).
  assert.ok(DIMENSIONS.includes('history'));
  assert.ok(DIMENSIONS.includes('implementation'));
});
