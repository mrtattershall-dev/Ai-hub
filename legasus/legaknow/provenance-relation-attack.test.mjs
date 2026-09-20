// r4 — is provenance a FUNCTION of content or a RELATION? Predictions PR-1..PR-5 frozen in
// benchmarks/PROVENANCE_RELATION_PREREG.md BEFORE this file existed. Assertions state the PREDICTED
// DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { bind, ledger, verifySeal, CONTESTED, digestOf } from './provenance.mjs';

// Two files that are legitimately byte-identical and legitimately have different histories. This is
// not hypothetical: benchmarks/repoC/IDENTITY.json records three such files in pyparsing, all empty.
const EMPTY = Buffer.from('');

const twoHistories = () => ledger([
  bind({ bytes: EMPTY, producedBy: 'pyparsing packaging, ai/__init__.py', path: 'a/__init__.py' }),
  bind({ bytes: EMPTY, producedBy: 'pyparsing packaging, tools/__init__.py', path: 'b/__init__.py' }),
]);

// A genuinely damaged record: ONE artifact declared to have two producers.
const damaged = () => ledger([
  bind({ bytes: EMPTY, producedBy: 'LEGASUS_REPLAY_r3', path: 'same.json' }),
  bind({ bytes: EMPTY, producedBy: 'CPYTHON_DOCTEST', path: 'same.json' }),
]);

test('PR-1 ATTACK — two legitimate histories for identical bytes are declared CONTESTED', () => {
  const found = twoHistories().lookup(EMPTY);
  // PREDICTED DEFECT: a conflict asserted where both statements are true. CONTESTED is defined in
  // ledger.mjs LAW 3 as contradicting claims that block reliance AND OWE AN EXPERIMENT - and no
  // experiment separates two tools that each emitted an empty file.
  assert.equal(found.provenance, CONTESTED, 'prediction PR-1');
  assert.match(found.why, /last-wins/);
});

test('PR-2 ATTACK — the module cannot tell that case from a genuinely damaged record', () => {
  const legit = twoHistories().lookup(EMPTY);
  const broken = damaged().lookup(EMPTY);
  // PREDICTED DEFECT: indistinguishable. The digest is the only identity and path is DESCRIPTION by
  // decision, so nothing here carries the coordinate a conflict claim would need.
  assert.equal(legit.provenance, broken.provenance, 'prediction PR-2: same state');
  assert.equal(legit.bindings.length, broken.bindings.length);
  assert.equal(legit.why, broken.why, 'and the same explanation');
});

test('PR-3 CONTROL — the same attribution bound twice is ONE attribution', () => {
  const l = ledger([
    bind({ bytes: EMPTY, producedBy: 'X', path: 'a', git: { commit: 'abc' } }),
    bind({ bytes: EMPTY, producedBy: 'X', path: 'b', git: { commit: 'abc' } }),
  ]);
  assert.equal(l.lookup(EMPTY).producedBy, 'X');
  assert.equal(l.lookup(EMPTY).provenance, undefined);
});

test('PR-4 CONTROL — the ENTITLEMENT is already right: neither state attributes to one producer', () => {
  assert.equal(twoHistories().lookup(EMPTY).producedBy, undefined);
  assert.equal(damaged().lookup(EMPTY).producedBy, undefined);
});

test('PR-5 CONTROL — the seal still covers every attribution in the set (C8-b must not regress)', () => {
  const l = twoHistories();
  const sealed = l.seal();
  assert.equal(verifySeal(l, sealed).ok, true);
  l.byDigest.get(digestOf(EMPTY)).bindings[0].producedBy = 'SOMETHING ELSE';
  assert.equal(verifySeal(l, sealed).ok, false);
});
