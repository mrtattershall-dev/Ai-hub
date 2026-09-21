// E1..E6 — a relation witness is a REFERENCE to established authority, not evidence.
//
// Predictions frozen in EVIDENCE-ROOT_PREREG.md. Updated to the HANDLE api of LINEAGE_PREREG.md:
// the store issues opaque refs and a certificate carries a ref, never a token. Every arm is
// unchanged; only how the root is addressed moved.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store, relationClaim, resolveEvidenceRoot } from './authority-store.mjs';
import { observe, derive, invalidate, isAuthority, KIND } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

const F4 = JSON.parse(readFileSync(new URL('./fixtures/F4.json', import.meta.url), 'utf8'));
const W = () => F4.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');
const NEED = relationClaim('COVERAGE', W().subject, W().object);

// A relation token, minted by the calculus from a real observation OF THE RELATION.
const relationToken = (claim, repository = 'SAMPLE') => observe({
  observation: observation({ status: OBSERVABILITY.OBSERVED, value: claim, subject: claim,
    producer: 'coverage-prover', procedure: 'enumerate the domain', attribution: 'domain enumeration',
    context: { repository } }),
  procedure: 'enumerate the domain', context: { repository } });

// A store holding `tok` under an ISSUED handle, and a clone of F4 whose COVERAGE witness references
// that handle. The producer names the handle it was given; it does not choose what it resolves to.
const withRoot = (tok) => {
  const s = store();
  const r = s.admitToken(tok, { note: 'prior admission stand-in' });
  const cert = structuredClone(F4);
  for (const w of cert.derivation.alternatives[0].relation_witnesses) {
    if (w.relation === 'COVERAGE') w.evidence_root = r.ref;
  }
  return { s, cert, ref: r.ref };
};
const run = (tok) => { const { s, cert } = withRoot(tok); return { out: adapt(cert, { authorityStore: s }), s, cert }; };
const whyOf = (out) => (out.unbound || []).map((u) => u.why).join(' | ');

test('E1 — a real, valid token establishing the exact relation instance SATISFIES', () => {
  const { s, cert } = withRoot(relationToken(NEED));
  const out = adapt(cert, { authorityStore: s });
  assert.equal(isAuthority(out.token), true, out.why);
  assert.deepEqual(out.bound, ['COVERAGE']);
  assert.equal(admit(cert, { authorityStore: s }).established, true);
});

test('E2 — a real handle whose authority is INVALID refuses', () => {
  const { out } = run(invalidate(relationToken(NEED), 'the corpus moved'));
  assert.equal(out.minted, false);
  assert.deepEqual(out.missing, ['COVERAGE']);
  assert.match(whyOf(out), /INVALIDATED token/);
  assert.match(whyOf(out), /Stale authority establishes nothing/);
});

test('E3 — valid authority for an UNRELATED proposition refuses', () => {
  const { out } = run(relationToken('COVERAGE(some:other:premise, SAMPLE)'));
  assert.equal(out.minted, false);
  assert.match(whyOf(out), /establishes "COVERAGE\(some:other:premise, SAMPLE\)"/);
  assert.match(whyOf(out), /A valid token for another proposition is not evidence for this one/);
});

test('E4 — the right relation proposition in the WRONG world refuses', () => {
  const { out } = run(relationToken(NEED, 'A_DIFFERENT_REPOSITORY'));
  assert.equal(out.minted, false);
  assert.match(whyOf(out), /established at repository A_DIFFERENT_REPOSITORY/);
  assert.match(whyOf(out), /the witness is about SAMPLE/);
  assert.match(whyOf(out), /A relation proven in another world does not hold in this one/);
});

test('E5 — a root that depends on the claim it is justifying refuses as CIRCULAR', () => {
  const seed = observe({
    observation: observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
      subject: F4.requested_claim.predicate, producer: 'p', procedure: 'proc',
      attribution: 'a', context: { repository: 'SAMPLE' } }),
    procedure: 'proc', context: { repository: 'SAMPLE' } });
  const circular = derive({ premises: [seed],
    rule: { name: F4.requested_claim.predicate, requires: [] },
    relationWitnesses: [], claim: NEED });
  assert.equal(isAuthority(circular), true, 'the token itself is validly minted');
  const { out } = run(circular);
  assert.equal(out.minted, false, 'and is still refused as a root for this derivation');
  assert.match(whyOf(out), /CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION/);
});

test('E6 ANTI-REFUSAL — a relation established by DERIVE, not OBSERVE, still satisfies', () => {
  const a = relationToken('partial coverage of the first half');
  const b = relationToken('partial coverage of the second half');
  const composed = derive({ premises: [a, b], rule: { name: 'coverage-composition', requires: [] },
    relationWitnesses: [], claim: NEED });
  assert.equal(isAuthority(composed), true);
  assert.equal(composed.constructor, 'DERIVE');
  const { out } = run(composed);
  assert.equal(isAuthority(out.token), true,
    'composed relational knowledge must remain usable: ' + out.why);
});

test('C-2 REGRESSION — an unresolvable root refuses; no store at all refuses too', () => {
  const out = adapt(F4, { authorityStore: store() });   // F4 still carries the producer's own string
  assert.equal(out.minted, false);
  assert.match(whyOf(out), /resolves to nothing in the authority store/);
  assert.match(whyOf(out), /An address is not an establishment; naming evidence is not having it/);
  assert.equal(adapt(F4).minted, false, 'and with no store it refuses rather than defaulting open');
});

test('the store refuses to file anything that is not a minted token', () => {
  const s = store();
  const forged = Object.freeze({ claim: NEED, kind: KIND.EPISTEMIC, valid: true, context: {},
    ancestry: [], constructor: 'OBSERVE' });
  const r = s.admitToken(forged);
  assert.equal(r.ok, false);
  assert.match(r.why, /a raw object - including a JSON clone of a real token - is an assertion/);
  assert.equal(s.size(), 0);
});

test('C-3 — the matcher resolves a REFERENCE; it never inspects an evidence payload', () => {
  const src = readFileSync(new URL('./authority-store.mjs', import.meta.url), 'utf8')
    .replace(/\r/g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(src, /tok\.claim !== need/);
  assert.match(src, /relationClaim\(/);
  assert.doesNotMatch(src, /\.payload|\.data\b|\.body\b/,
    'resolving must not become judging what evidence looks like');
});

test('C-4 — legaknow is byte-unchanged', () => {
  const diff = execSync('git diff --name-only HEAD -- legasus/legaknow/',
    { cwd: new URL('../../../', import.meta.url).pathname.replace(/^\//, ''), encoding: 'utf8' });
  assert.equal(diff.trim(), '', 'git says: ' + diff);
});

test('resolveEvidenceRoot names WHICH check failed, never a bare refusal', () => {
  const ctx = { claimDomain: 'SAMPLE', premiseRefs: [W().subject], derivingClaim: 'X',
    authorityStore: store() };
  for (const [w, pattern] of [
    [{ ...W(), evidence_root: null }, /asserts a relation without rooting in anything/],
    [{ ...W(), evidence_root: 'nope' }, /resolves to nothing in the authority store/],
  ]) {
    const why = resolveEvidenceRoot(w, ctx);
    assert.equal(typeof why, 'string');
    assert.match(why, pattern);
  }
});
