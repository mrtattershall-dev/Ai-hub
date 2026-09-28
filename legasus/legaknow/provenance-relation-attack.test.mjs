// r4 — is provenance a FUNCTION of content or a RELATION? Predictions were frozen in
// benchmarks/PROVENANCE_RELATION_PREREG.md; the PRE-REPAIR run that reproduced both is preserved in
// benchmarks/RESULT.provenance-relation.md and at fefb29d, where this file asserted the defects. It
// now asserts the repair and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import * as provenance from './provenance.mjs';
import { bind, ledger, verifySeal, MULTIPLY_BOUND, digestOf } from './provenance.mjs';

// Two files that are legitimately byte-identical and legitimately have different histories. Not
// hypothetical: benchmarks/repoC/IDENTITY.json records three such files in pyparsing, all empty.
const EMPTY = Buffer.from('');

const twoHistories = () => ledger([
  bind({ bytes: EMPTY, producedBy: 'pyparsing packaging, ai/__init__.py', path: 'a/__init__.py' }),
  bind({ bytes: EMPTY, producedBy: 'pyparsing packaging, tools/__init__.py', path: 'b/__init__.py' }),
]);

const damaged = () => ledger([
  bind({ bytes: EMPTY, producedBy: 'LEGASUS_REPLAY_r3', path: 'same.json' }),
  bind({ bytes: EMPTY, producedBy: 'CPYTHON_DOCTEST', path: 'same.json' }),
]);

test('PR-1 REGRESSION — two legitimate histories are MULTIPLY_BOUND, and no conflict is asserted', () => {
  const found = twoHistories().lookup(EMPTY);
  assert.equal(found.provenance, MULTIPLY_BOUND, 'fefb29d called this CONTESTED');
  assert.equal(found.bindings.length, 2, 'both production events kept');
  assert.match(found.why, /NOT a contradiction/);
  // and the word that carries ledger.mjs LAW 3's obligation is gone from this module
  assert.equal(provenance.CONTESTED, undefined,
    'a conflict claim needs evidence the content had ONE history; the digest is not that evidence');
});

test('PR-2 REGRESSION — the two cases are still indistinguishable, and the state now SAYS so', () => {
  const legit = twoHistories().lookup(EMPTY);
  const broken = damaged().lookup(EMPTY);
  // The module genuinely cannot tell them apart - the digest is the only identity, by the decision
  // that makes the identity property work. What changed is that it no longer claims to.
  assert.equal(legit.provenance, broken.provenance);
  assert.match(legit.why, /cannot tell that from a damaged record/);
});

test('PR-3 CONTROL — the same attribution bound twice is ONE attribution', () => {
  const l = ledger([
    bind({ bytes: EMPTY, producedBy: 'X', path: 'a', git: { commit: 'abc' } }),
    bind({ bytes: EMPTY, producedBy: 'X', path: 'b', git: { commit: 'abc' } }),
  ]);
  assert.equal(l.lookup(EMPTY).producedBy, 'X');
  assert.equal(l.lookup(EMPTY).provenance, undefined);
});

test('PR-4 CONTROL — the entitlement is unchanged by the repair: neither state attributes to one producer', () => {
  assert.equal(twoHistories().lookup(EMPTY).producedBy, undefined);
  assert.equal(damaged().lookup(EMPTY).producedBy, undefined);
  // a third, different attribution joins the relation rather than replacing anything
  const three = ledger([...twoHistories().byDigest.get(digestOf(EMPTY)).bindings,
    bind({ bytes: EMPTY, producedBy: 'a third tool', path: 'c' })]);
  assert.equal(three.lookup(EMPTY).bindings.length, 3);
});

test('PR-5 CONTROL — the seal still covers every attribution in the set (C8-b does not regress)', () => {
  const l = twoHistories();
  const sealed = l.seal();
  assert.equal(verifySeal(l, sealed).ok, true);
  l.byDigest.get(digestOf(EMPTY)).bindings[0].producedBy = 'SOMETHING ELSE';
  assert.equal(verifySeal(l, sealed).ok, false);
});
