// r4 — composition wave 2, preference. Predictions frozen in benchmarks/COMPOSITION_PREREG_2.md (W2-d)
// BEFORE this file existed. Assertions state the PREDICTED DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { compare, paretoFrontier, mayReplaceChampion, VERDICT } from './dominance.mjs';

const base = { changedChars: 10, branchPoints: 1, distinctLiterals: 1, duplicatedTerms: 0, worstCaseTests: 1 };
const A = { name: 'A', verified: true, metrics: { ...base } };                       // robustness UNMEASURED
const B = { name: 'B', verified: true, metrics: { ...base, placementRobustness: 0.2 } };

test('W2-d-1 ATTACK — a candidate missing the BEHAVIORAL metric is EQUIVALENT and survives the frontier', () => {
  // PREDICTED DEFECT: unmeasured is treated as compatible.
  assert.equal(compare(A, B).verdict, VERDICT.EQUIVALENT, 'prediction W2-d-1: equivalent');
  assert.deepEqual(paretoFrontier([A, B]).map((c) => c.name).sort(), ['A', 'B']);
});

test('W2-d-2 CONTROL — promotion already refuses it (the safe direction holds today)', () => {
  assert.equal(mayReplaceChampion(A, B).replace, false);
  assert.equal(mayReplaceChampion(B, A).replace, false);
});

test('W2-d-3 CONTROL — with the metric present on both, dominance is decided on it', () => {
  const A2 = { ...A, metrics: { ...base, placementRobustness: 0.6 } };
  assert.equal(compare(A2, B).verdict, VERDICT.DOMINATES);
  assert.deepEqual(paretoFrontier([A2, B]).map((c) => c.name), ['A']);
});
