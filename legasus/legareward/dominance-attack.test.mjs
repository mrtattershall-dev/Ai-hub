// r4 — composition wave 2, preference. Prediction frozen in benchmarks/COMPOSITION_PREREG_2.md (W2-d);
// the PRE-REPAIR run that reproduced it is preserved in benchmarks/RESULT.composition-2.md and at
// b0673cd, where this file asserted the defect. It now asserts the repair and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { compare, paretoFrontier, paretoFrontierReport, mayReplaceChampion, VERDICT }
  from './dominance.mjs';

const base = { changedChars: 10, branchPoints: 1, distinctLiterals: 1, duplicatedTerms: 0, worstCaseTests: 1 };
const A = { name: 'A', verified: true, metrics: { ...base } };                       // robustness UNMEASURED
const B = { name: 'B', verified: true, metrics: { ...base, placementRobustness: 0.2 } };

test('W2-d-1 REGRESSION — a candidate missing the BEHAVIORAL metric is INCOMPARABLE, named, and off the frontier', () => {
  const c = compare(A, B);
  assert.equal(c.verdict, VERDICT.INCOMPARABLE, 'b0673cd called these EQUIVALENT');
  assert.deepEqual(c.unmeasured, ['placementRobustness']);
  // FIRST FLIP FAILED HERE: compare() alone left A on the frontier, because INCOMPARABLE is not
  // DOMINATED. The exclusion had to be made explicit, and it carries a record.
  assert.deepEqual(paretoFrontier([A, B]).map((x) => x.name), ['B']);
  const report = paretoFrontierReport([A, B]);
  assert.deepEqual(report.excluded.map((e) => e.name), ['A']);
  assert.deepEqual(report.excluded[0].unmeasured, ['placementRobustness']);
});

test('W2-d-2 CONTROL — promotion still refuses it, in both directions', () => {
  assert.equal(mayReplaceChampion(A, B).replace, false);
  assert.equal(mayReplaceChampion(B, A).replace, false);
});

test('W2-d-3 CONTROL — with the metric present on both, dominance is decided on it', () => {
  const A2 = { ...A, metrics: { ...base, placementRobustness: 0.6 } };
  assert.equal(compare(A2, B).verdict, VERDICT.DOMINATES);
  assert.deepEqual(paretoFrontier([A2, B]).map((c) => c.name), ['A']);
});

test('W2-d-4 ADMIT CONTROL — a missing DESCRIPTIVE metric is still skipped, because it cannot promote', () => {
  const noChars = { name: 'C', verified: true, metrics: { ...base, placementRobustness: 0.2 } };
  delete noChars.metrics.changedChars;
  assert.equal(compare(noChars, B).verdict, VERDICT.EQUIVALENT);
});
