// ACTION-GOVERNANCE-1, the B-PRIME REGRESSION SUITE. Built FIRST, before any enforcement is added.
//
// These pin the SIX BINDINGS THE CALCULUS ALREADY HOLDS, measured by ag-baseline-probe.mjs. The G-series
// repair touches commit(), which sits one function away from all of them, so they are pinned before
// anything is added near it. A failure here after the E-series lands is a regression, not a new finding.
//
// B6' IS THE ONE MOST AT RISK, and it is not a refusal. A controller HOLDING owner-issued authority and
// exercising it within its grant must stay PERMITTED. An earlier amendment of mine stated that any
// controller-held token satisfying `from` was a regression - which would have prohibited the legitimate
// case. controller-HELD is not controller-CREATED, and this test exists so that a future tightening
// cannot quietly forbid exercising a legitimate delegation.
import test from 'node:test';
import assert from 'node:assert';
import { delegate, commit, observe, isAuthority, KIND } from '../../legaknow/calculus.mjs';

const GRANT = ['edit:fixture'];
const CTX = { repository: 'S1', implementation: 'fixture.js' };
const owned = () => delegate({ from: 'OWNER', grant: GRANT, to: 'controller', context: CTX });
const evidence = () => observe({ observation: { subject: 'fixture.js' }, procedure: 'probe', context: CTX });

test('the fixture itself is valid — an owner grant mints NORMATIVE authority', () => {
  const t = owned();
  assert.equal(isAuthority(t), true, 'no token minted: ' + JSON.stringify(t));
  assert.equal(t.kind, KIND.NORMATIVE);
  assert.deepEqual([...t.grant], GRANT);
});

test("B1' — a grant may not WIDEN beyond the grantor", () => {
  const r = delegate({ from: owned(), grant: ['edit:fixture', 'deploy:prod'], to: 'sub', context: CTX });
  assert.equal(r.minted, false);
  assert.match(r.why, /does not hold/);
  assert.deepEqual(r.widening, ['deploy:prod'], 'the refusal names WHICH grant was not held');
});

test("B2' — a grantee may not DROP a context dimension the grantor pins", () => {
  const r = delegate({ from: owned(), grant: GRANT, to: 'sub', context: {} });
  assert.equal(r.minted, false);
  assert.match(r.why, /drops or changes/);
  // a grant over one world is not a grant over every world
  assert.ok(r.widened.includes('implementation'), 'names the dropped dimension: ' + r.widened);
});

test("B3' — a grantee may not CHANGE a pinned context dimension", () => {
  const r = delegate({ from: owned(), grant: GRANT, to: 'sub',
    context: { repository: 'S2', implementation: 'fixture.js' } });
  assert.equal(r.minted, false);
  assert.deepEqual(r.widened, ['repository']);
});

test("B4' — belief cannot be laundered into permission by re-delegation", () => {
  const r = delegate({ from: evidence(), grant: GRANT, to: 'sub', context: CTX });
  assert.equal(r.minted, false);
  // the epistemic token is not even accepted as a grantor
  assert.match(r.why, /authority token, or the independent root OWNER/);
});

test("B5' — commit refuses a bare EPISTEMIC token", () => {
  const r = commit({ authority: evidence(), action: 'edit fixture.js', requires: GRANT });
  assert.equal(r.committed, false);
  assert.match(r.why, /consumes an authority token/);
});

test("B6' — controller-HELD owner-issued authority MUST remain exercisable (not a refusal)", () => {
  const r = commit({ authority: owned(), action: 'edit fixture.js', requires: GRANT });
  assert.equal(r.committed, true,
    'holding is not creating: a legitimate delegation must stay exercisable. ' + (r.why || ''));
  assert.ok(Array.isArray(r.consumed) && r.consumed.length, 'the authority chain is recorded');
  assert.equal(r.consumed[0].from, 'OWNER', 'and it traces to the independent root');
});

test("B7' — commit refuses when the required grant is not covered", () => {
  const r = commit({ authority: owned(), action: 'deploy', requires: ['deploy:prod'] });
  assert.equal(r.committed, false, 'a grant for one action is not a grant for another');
});

// ---------------------------------------------------------------------------------------------------
// THE MEASURED GAPS, pinned as CURRENT BEHAVIOUR so the E-series inverting them is visible as a change.
//
// These are NOT assertions that the behaviour is correct. Each is labelled with what it would take for it
// to be a defect, because two of them are only gaps against a POLICY THIS EXPERIMENT HAS NOT YET DECLARED:
// shareable permissions and reusable tokens are both ordinarily legitimate.

test('GAP G1 (current) — sibling grants are DUPLICATED, not allocated', () => {
  const p = owned();
  const a = delegate({ from: p, grant: GRANT, to: 'childA', context: CTX });
  const b = delegate({ from: p, grant: GRANT, to: 'childB', context: CTX });
  assert.equal(isAuthority(a) && isAuthority(b), true);
  // NOT A DEFECT ON ITS FACE: sharing a permission without consuming it is normal. It becomes a budget
  // violation only where the parent holds a FINITE ALLOWANCE and descendants collectively exceed it.
  // E5 is conditional on this experiment DECLARING such an allowance.
});

test('GAP G2 (current) — a grant is reusable; consumption is not recorded', () => {
  const t = owned();
  const one = commit({ authority: t, action: 'edit fixture.js #1', requires: GRANT });
  const two = commit({ authority: t, action: 'edit fixture.js #2', requires: GRANT });
  assert.equal(one.committed && two.committed, true);
  // NOT A DEFECT ON ITS FACE: most permissions are not tickets. E4 is conditional on this experiment
  // DECLARING a single-use policy for the operation under test.
});

test('GAP G3 (current) — the action target is NEVER compared to the authority context', () => {
  const t = owned();          // context pins implementation: fixture.js
  const r = commit({ authority: t, action: 'edit OTHER.js', requires: GRANT });
  assert.equal(r.committed, true, 'baseline: the mismatch is not detected today');
  // THIS ONE IS A GAP UNCONDITIONALLY - no policy makes it correct for a grant pinned to one target to
  // authorize another. But note the EVIDENTIAL BOUNDARY: commit() is a pure authorization function and
  // writes nothing. What is established is an authorization failure, NOT that a write to OTHER.js
  // occurred or could. E0/E1 must connect authorization to EFFECT ON DISK.
  //
  // And this is an UNCHECKED TARGET BINDING, not time-of-check-to-time-of-use. The target is never
  // compared at any time; TOCTOU is the separate case where a checked target CHANGES before execution,
  // which is E9 and is not probed here.
});

test('GAP G5 (current) — a token carries no expiry or revocation surface', () => {
  const keys = Object.keys(owned());
  assert.deepEqual(keys.sort(),
    ['ancestry', 'claim', 'constructor', 'context', 'grant', 'kind', 'valid'].sort(),
    'if this fails, a lifetime/revocation field was added — update E6/E7 rather than this assertion');
  assert.equal(keys.some((k) => /expir|revok|ttl|until|issuedAt|budget/i.test(k)), false);
});
