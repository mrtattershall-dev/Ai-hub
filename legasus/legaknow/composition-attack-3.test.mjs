// r4 — composition wave 3, the two PREDICTIONS OF NO DEFECT. Frozen in benchmarks/COMPOSITION_PREREG_3.md
// (W3-a, W3-b) BEFORE this file existed. These assert that the code is RIGHT; a failure here falsifies
// my model of it and is the result.
import test from 'node:test';
import assert from 'node:assert';
import { covers, scope, ANY } from './justification.mjs';
import { assertClaim, record, reassess, recall, mayRely, freshness, STATE, BASIS, LIFECYCLE }
  from './ledger.mjs';

// ------------------------------------------------------------------ W3-a: covers() is transitive

test('W3-a-1 PREDICTED HOLDS — covers() is transitive over every 4-valued pair on two dimensions', () => {
  const V = [null, ANY, 'S1', 'S2'];
  const scopes = [];
  for (const r of V) for (const c of V) scopes.push(scope({ repository: r, criterion: c }));
  let triples = 0; let counter = 0; let abNotC = 0;
  for (const a of scopes) for (const b of scopes) for (const c of scopes) {
    triples++;
    const ab = covers(a, b).ok; const bc = covers(b, c).ok; const ac = covers(a, c).ok;
    if (ab && bc && !ac) counter++;
    if (ab && !ac) abNotC++;
  }
  assert.equal(triples, 4096);
  assert.equal(counter, 0, 'a transitivity counterexample exists');
  // NON-VACUITY: the enumeration contains triples where A covers B but not C, so the property is
  // not holding because covers() says yes to everything.
  assert.ok(abNotC > 0);
});

// ------------------------------------------------------------------ W3-b: no reconciliation by recency

const w0 = { digests: { 'a.py': 'd0' }, capabilityVersion: 'r2', apparatusVersion: 'e1' };
const w1 = { digests: { 'a.py': 'd1' }, capabilityVersion: 'r2', apparatusVersion: 'e1' };
const claim = (state, world, evidence) => assertClaim({ subject: 'f', predicate: 'behaves', object: 'ok',
  state, basis: BASIS.EXECUTION_WITNESS, world, invalidationSet: ['a.py'], evidence: [evidence] });

test('W3-b-1 PREDICTED HOLDS — FALSIFIED@S0 then VERIFIED@S1 without reassessment is CONTESTED (over-conservative, never permissive)', () => {
  const L = record({}, claim(STATE.FALSIFIED, w0, 'counterexample')).ledger;
  const r = record(L, claim(STATE.VERIFIED, w1, 'witness'));
  assert.equal(r.contested, true);
  assert.equal(mayRely(r.entry).ok, false);
  assert.equal(r.entry.state, STATE.CONTESTED);
});

test('W3-b-2 PREDICTED HOLDS — reassessed against S1 first, the S0 falsification is STALE and the S1 verification stands', () => {
  const L0 = record({}, claim(STATE.FALSIFIED, w0, 'counterexample')).ledger;
  const { ledger: L1, staled } = reassess(L0, w1);
  assert.equal(staled.length, 1);
  assert.equal(recall(L1, { subject: 'f', predicate: 'behaves', object: 'ok' }).lifecycle, LIFECYCLE.STALE);
  const r = record(L1, claim(STATE.VERIFIED, w1, 'witness'));
  assert.equal(r.contested, undefined);
  assert.equal(mayRely(r.entry).ok, true);
});

test('W3-b-3 PREDICTED HOLDS — neither world lends reliance to the other', () => {
  const f = claim(STATE.FALSIFIED, w0, 'counterexample');
  assert.equal(mayRely(freshness(f, w1)).ok, false, 'a falsification at S0 is not relied on at S1');
  const v = claim(STATE.VERIFIED, w1, 'witness');
  assert.equal(mayRely(freshness(v, w0)).ok, false, 'a verification at S1 is not relied on without S1');
  assert.equal(mayRely(freshness(v, w1)).ok, true, 'and it IS relied on at S1 (non-vacuity)');
});
