// CONTROLS FOR THE OUTCOME STATE MACHINE — prediction W-5 in benchmarks/AUTO_WITNESS_1_PREREG.md.
//
// The claim under test is not "the states exist". It is that a judgment CANNOT be issued over a
// journey that never ran the experiment, and that the gate is structural rather than a convention a
// probe author is trusted to remember. Four slices say conventions do not hold here.
import test from 'node:test';
import assert from 'node:assert';
import * as substrate from './outcome.mjs';
import { journey, finding, isVerdict, STATE, VERDICT, REQUIRED } from './outcome.mjs';

const full = (s = 'subject') => journey(s)
  .mark(STATE.DISCOVERED).mark(STATE.BASELINE_REPLAYED)
  .mark(STATE.PERTURBATION_APPLIED).mark(STATE.OBSERVED);

test('W-5b MUST FIRE — an incomplete journey cannot yield VIOLATED', () => {
  const j = journey('picky').mark(STATE.DISCOVERED).mark(STATE.BASELINE_REPLAYED);
  const v = j.violated('I am sure it is broken');
  assert.equal(v.verdict, VERDICT.INVARIANT_UNKNOWN, 'conviction without an experiment is refused');
  assert.deepEqual(v.missing, [STATE.PERTURBATION_APPLIED, STATE.OBSERVED]);
  assert.match(v.why, /never reached/);
});

test('W-5b — HELD IS GATED EXACTLY AS HARD, because a vacuous pass is the same error with a nicer sign', () => {
  const j = journey('quiet').mark(STATE.DISCOVERED).mark(STATE.BASELINE_REPLAYED)
    .mark(STATE.PERTURBATION_NO_EFFECT, 'nothing changed');
  const v = j.held('no violation seen');
  assert.equal(v.verdict, VERDICT.INVARIANT_UNKNOWN);
  assert.ok(v.missing.includes(STATE.PERTURBATION_APPLIED));
});

test('POSITIVE CONTROL — a complete journey DOES convict, so the gate is not just always-UNKNOWN', () => {
  const v = full().violated('observed ANY_OF where ALL_OF was declared');
  assert.equal(v.verdict, VERDICT.INVARIANT_VIOLATED);
  assert.deepEqual(v.path, REQUIRED);
  assert.ok(isVerdict(v));
  assert.ok(finding(v), 'and it is admissible as a finding');
});

test('a stage cannot be skipped by asserting the one after it', () => {
  assert.throws(() => journey('a').mark(STATE.DISCOVERED).mark(STATE.OBSERVED),
    /requires PERTURBATION_APPLIED first/);
  assert.throws(() => journey('b').mark(STATE.PERTURBATION_APPLIED), /requires BASELINE_REPLAYED/);
  assert.throws(() => journey('c').mark(STATE.DISCOVERED).mark(STATE.BASELINE_REPLAYED)
    .mark(STATE.PERTURBATION_APPLIED).mark(STATE.OBSERVED).mark(STATE.OBSERVED), /already recorded/);
});

test('a terminal outcome ends the journey - nothing can be appended after a refusal', () => {
  const j = journey('d').mark(STATE.DISCOVERED).mark(STATE.BASELINE_REPLAYED)
    .mark(STATE.PERTURBATION_APPLIED).mark(STATE.AUTHORITY_REFUSED, 'the subject refused');
  assert.throws(() => j.mark(STATE.OBSERVED), /cannot follow a terminal outcome/);
  assert.equal(j.violated('still broken').verdict, VERDICT.INVARIANT_UNKNOWN,
    'a refusal is NOT evidence against the subject');
});

test('an object that merely CLAIMS a verdict is not one', () => {
  const forged = { subject: 'x', verdict: VERDICT.INVARIANT_VIOLATED, why: 'trust me' };
  assert.equal(isVerdict(forged), false);
  assert.throws(() => finding(forged), /findings are built from journeys/);
});

test('W-7 — the substrate offers no way to construct a verdict', () => {
  const names = Object.keys(substrate).sort();
  assert.deepEqual(names.filter((k) => /forge|mint|fabricat|unsafe|bypass|testonly|seal/i.test(k)), []);
  assert.deepEqual(names, ['REQUIRED', 'STATE', 'VERDICT', 'finding', 'isVerdict', 'journey']);
});
