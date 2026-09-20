// CONTROLS FOR BRIDGE-1 — predictions B-1..B-6 in benchmarks/BRIDGE_1_PREREG.md.
//
// The run against the real trees is benchmarks/RESULT.bridge.md. B-4b is the important one and it
// DOES NOT PASS; the test below records the failure rather than hiding it.
import test from 'node:test';
import assert from 'node:assert';
import * as substrate from './bridge.mjs';
import { bridge, compare, RELATION, COMPARISON } from './bridge.mjs';

const VA = { production: 'P1', specification: 'S1' };
const base = { production_subject: 'prod::f', specification_subject: 'spec::g',
  specification_proposition: 'p', provenance: 'read from both source comments', valid_against: VA };
const mk = (over = {}) => bridge({ ...base, relation: RELATION.EQUIVALENT, ...over });
const now = { ...VA };

test('B-3 — a bridge without provenance or endpoint pinning is REFUSED at construction', () => {
  for (const k of ['production_subject', 'specification_subject', 'relation', 'provenance',
    'valid_against']) {
    const b = { ...base, relation: RELATION.EQUIVALENT }; delete b[k];
    assert.throws(() => bridge(b), new RegExp(k), 'a bridge missing ' + k + ' would be the new oracle');
  }
  assert.throws(() => bridge({ ...base, relation: RELATION.EQUIVALENT,
    valid_against: { production: 'P1' } }), /pin BOTH endpoints/);
});

test('B-1 — results that differ under an EQUIVALENT bridge are a RESULT_DISAGREEMENT', () => {
  const r = compare({ bridge: mk(), digests: now,
    production: { result: 'PERMITTED', reasonClass: 'OK' },
    specification: { result: 'REFUSED', reasonClass: 'NO' } });
  assert.equal(r.comparison, COMPARISON.RESULT_DISAGREEMENT);
});

test('B-1b MUST FIRE — same answer, different justification, is NOT agreement', () => {
  // A path can refuse safely today for a reason that becomes dangerous downstream, and prod === spec
  // cannot see that.
  const r = compare({ bridge: mk({ reason_correspondence: { STALE_EVIDENCE: 'NO_ENTITLEMENT' } }),
    digests: now,
    production: { result: 'REFUSED', reasonClass: 'STALE_EVIDENCE' },
    specification: { result: 'REFUSED', reasonClass: 'CONTEXT_WIDENED' } });
  assert.equal(r.comparison, COMPARISON.REASON_DISAGREEMENT);
  assert.match(r.why, /both answered REFUSED/);
});

test('B-2b MUST FIRE — a production concept with no counterpart is UNMAPPABLE, not coerced', () => {
  const r = compare({ bridge: mk(), digests: now,
    production: { result: null }, specification: { result: 'REFUSED', reasonClass: 'NO' } });
  assert.equal(r.comparison, COMPARISON.UNMAPPABLE);
  assert.match(r.why, /NOT evidence against production/);
  assert.match(r.why, /not coerced to the nearest available answer/);
});

test('B-1 — a PARTIAL relation licenses NO verdict, however large the difference', () => {
  const r = compare({ bridge: mk({ relation: RELATION.PARTIAL }), digests: now,
    production: { result: 'PERMITTED', reasonClass: 'OK' },
    specification: { result: 'REFUSED', reasonClass: 'NO' } });
  assert.equal(r.comparison, COMPARISON.UNMAPPABLE);
  assert.match(r.why, /the BRIDGE fabricating a finding/);
});

test('a DIRECTIONAL relation is only violated in its own direction', () => {
  const narrower = { bridge: mk({ relation: RELATION.NARROWER }), digests: now };
  assert.equal(compare({ ...narrower, production: { result: 'REFUSED', reasonClass: 'a' },
    specification: { result: 'PERMITTED', reasonClass: 'b' } }).comparison, COMPARISON.AGREE);
  assert.equal(compare({ ...narrower, production: { result: 'PERMITTED', reasonClass: 'a' },
    specification: { result: 'REFUSED', reasonClass: 'b' } }).comparison,
  COMPARISON.RESULT_DISAGREEMENT);
});

test('B-5 MUST FIRE — either endpoint moving makes the bridge unable to convict OR absolve', () => {
  const b = mk({ reason_correspondence: { OK: 'OK' } });
  const agreeing = { production: { result: 'PERMITTED', reasonClass: 'OK' },
    specification: { result: 'PERMITTED', reasonClass: 'OK' } };
  const differing = { production: { result: 'PERMITTED', reasonClass: 'OK' },
    specification: { result: 'REFUSED', reasonClass: 'NO' } };
  assert.equal(compare({ ...agreeing, bridge: b, digests: now }).comparison, COMPARISON.AGREE);
  for (const moved of [{ production: 'CHANGED', specification: 'S1' },
    { production: 'P1', specification: 'CHANGED' }]) {
    assert.equal(compare({ ...differing, bridge: b, digests: moved }).comparison, COMPARISON.UNKNOWN,
      'cannot convict');
    assert.equal(compare({ ...agreeing, bridge: b, digests: moved }).comparison, COMPARISON.UNKNOWN,
      'and cannot absolve - the half usually forgotten');
  }
});

// ---------------------------------------------------------------- the three mutation modes
test('IMPLEMENTATION MUTATION is caught: specification fixed, production behaviour changed', () => {
  const b = mk({ reason_correspondence: { OK: 'OK' } });
  const spec = { result: 'REFUSED', reasonClass: 'NO' };
  assert.equal(compare({ bridge: b, digests: now, specification: spec,
    production: { result: 'REFUSED', reasonClass: 'NO' } }).comparison, COMPARISON.UNMAPPABLE);
  assert.equal(compare({ bridge: b, digests: now, specification: spec,
    production: { result: 'PERMITTED', reasonClass: 'OK' } }).comparison,
  COMPARISON.RESULT_DISAGREEMENT);
});

test('SPECIFICATION MUTATION is caught: production fixed, specification semantics changed', () => {
  const b = mk({ reason_correspondence: { OK: 'OK' } });
  const prod = { result: 'PERMITTED', reasonClass: 'OK' };
  assert.equal(compare({ bridge: b, digests: now, production: prod,
    specification: { result: 'PERMITTED', reasonClass: 'OK' } }).comparison, COMPARISON.AGREE);
  assert.equal(compare({ bridge: b, digests: now, production: prod,
    specification: { result: 'REFUSED', reasonClass: 'NO' } }).comparison,
  COMPARISON.RESULT_DISAGREEMENT);
});

test('B-4b DOES NOT PASS — BRIDGE MUTATION PRODUCES SILENT FALSE AGREEMENT', () => {
  // THE PREREGISTERED PREDICTION WAS THAT A CORRUPTED BRIDGE MUST NOT PRODUCE SILENT AGREEMENT.
  // IT DOES. Production is correct, the specification is correct, and they refuse for genuinely
  // different reasons - but a bridge that DECLARES those reasons to correspond reports AGREE, and
  // nothing in the comparison can tell. The bridge is the oracle for its own correctness.
  const prod = { result: 'REFUSED', reasonClass: 'STALE_EVIDENCE' };
  const spec = { result: 'REFUSED', reasonClass: 'CONTEXT_WIDENED' };

  const honest = compare({ bridge: mk({ reason_correspondence: { STALE_EVIDENCE: 'NO_COUNTERPART' } }),
    digests: now, production: prod, specification: spec });
  assert.equal(honest.comparison, COMPARISON.REASON_DISAGREEMENT);

  const corrupted = compare({ bridge: mk({
    reason_correspondence: { STALE_EVIDENCE: 'CONTEXT_WIDENED' } }),   // one edited line
    digests: now, production: prod, specification: spec });
  assert.equal(corrupted.comparison, COMPARISON.AGREE,
    'RECORDED AS A FAILURE, NOT AS BEHAVIOUR: the architecture cannot currently detect this');

  // What provenance and pinning DO give is attributability and staleness - not detection. Stating
  // the difference is the point; a control that passed here would be lying.
  assert.ok(mk({ reason_correspondence: {} }).provenance, 'the bridge carries where it came from');
});

test('B-7 — the substrate offers no way to fabricate a comparison', () => {
  assert.deepEqual(Object.keys(substrate).sort(),
    ['COMPARISON', 'RELATION', 'bridge', 'compare', 'digestOf']);
});
