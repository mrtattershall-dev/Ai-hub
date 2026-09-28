// r4 — instrument subsumption (W3-h). Admit, refusal and unknown controls, each fixed in
// benchmarks/COMPOSITION_PREREG_3.md before this existed. A representation that can only say SUBSUMES
// is a budget with a vocabulary; one that can only refuse is a wall. Both directions must be reachable.
import test from 'node:test';
import assert from 'node:assert';
import { instrument, subsumes, nullTransfers, SUBSUMPTION } from './instruments.mjs';

const W = (ref) => ({ injected: true, fired: true, ref });
const cls = (c, ref = 'run-' + c) => ({ failureClass: c, witness: W(ref) });

test('ADMIT — A with witnessed {f1, f2, f3} subsumes B with witnessed {f1, f2}', () => {
  const A = instrument({ name: 'A', detects: [cls('f1'), cls('f2'), cls('f3')] });
  const B = instrument({ name: 'B', detects: [cls('f1'), cls('f2')] });
  const s = subsumes(A, B);
  assert.equal(s.verdict, SUBSUMPTION.SUBSUMES);
  assert.deepEqual(s.covered, ['f1', 'f2']);
  assert.equal(nullTransfers({ cheap: A, strong: B, cheapFound: false }).transfers, true);
});

test('REFUSE — B detects f4, which A has never been shown to detect', () => {
  const A = instrument({ name: 'A', detects: [cls('f1'), cls('f2'), cls('f3')] });
  const B = instrument({ name: 'B', detects: [cls('f1'), cls('f4')] });
  const s = subsumes(A, B);
  assert.equal(s.verdict, SUBSUMPTION.DOES_NOT_SUBSUME);
  assert.deepEqual(s.uncovered, ['f4']);
  const n = nullTransfers({ cheap: A, strong: B, cheapFound: false });
  assert.equal(n.transfers, false);
  assert.match(n.why, /not a strong null/);
});

test('UNKNOWN — a claimed class without a witness never supports SUBSUMES, on either side', () => {
  const claimedOnly = { failureClass: 'f2', witness: { injected: true, fired: false } };
  const A = instrument({ name: 'A', detects: [cls('f1'), claimedOnly] });
  const B = instrument({ name: 'B', detects: [cls('f1'), cls('f2')] });
  const s = subsumes(A, B);
  assert.equal(s.verdict, SUBSUMPTION.UNKNOWN, 'A claims f2 and did not fire on it');
  assert.deepEqual(s.claimedNotWitnessed, ['f2']);
  // B's own unwitnessed claim is UNKNOWN too - what B detects is not established
  const B2 = instrument({ name: 'B2', detects: [cls('f1'), claimedOnly] });
  assert.equal(subsumes(instrument({ name: 'A2', detects: [cls('f1'), cls('f2')] }), B2).verdict,
    SUBSUMPTION.UNKNOWN);
  // an undeclared instrument is UNKNOWN, never empty
  assert.equal(subsumes(instrument({ name: 'A', detects: undefined }), B).verdict, SUBSUMPTION.UNKNOWN);
});

test('THE ASYMMETRY — a cheap FINDING is conclusive whatever the subsumption relation', () => {
  const weak = instrument({ name: 'weak', detects: [cls('f1')] });
  const strong = instrument({ name: 'strong', detects: [cls('f1'), cls('f2'), cls('f3')] });
  assert.equal(subsumes(weak, strong).verdict, SUBSUMPTION.DOES_NOT_SUBSUME);
  assert.equal(nullTransfers({ cheap: weak, strong, cheapFound: true }).transfers, true);
  assert.equal(nullTransfers({ cheap: weak, strong, cheapFound: false }).transfers, false);
});

test('NON-VACUITY — the same instrument subsumes itself, and an empty B is subsumed by anything declared', () => {
  const A = instrument({ name: 'A', detects: [cls('f1')] });
  assert.equal(subsumes(A, A).verdict, SUBSUMPTION.SUBSUMES);
  assert.equal(subsumes(A, instrument({ name: 'none', detects: [] })).verdict, SUBSUMPTION.SUBSUMES);
});
