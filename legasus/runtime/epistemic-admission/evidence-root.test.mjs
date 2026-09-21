// E1..E6 — a relation witness is a REFERENCE to established authority, not evidence.
//
// Predictions frozen in EVIDENCE-ROOT_PREREG.md. Registry still three rules, rule selection still
// unattacked, census untouched, legaknow unmodified.
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

const withRoot = (tok) => { const s = store(); s.put(W().evidence_root, tok); return s; };

test('E1 — a real, valid token establishing the exact relation instance SATISFIES', () => {
  const s = withRoot(relationToken(NEED));
  const out = adapt(F4, { authorityStore: s });
  assert.equal(isAuthority(out.token), true, out.why);
  assert.deepEqual(out.bound, ['COVERAGE']);
  assert.equal(admit(F4, { authorityStore: s }).established, true);
});

test('E2 — a real id whose authority is INVALID refuses', () => {
  const stale = invalidate(relationToken(NEED), 'the corpus moved');
  const out = adapt(F4, { authorityStore: withRoot(stale) });
  assert.equal(out.minted, false);
  assert.deepEqual(out.missing, ['COVERAGE']);
  assert.match(out.unbound.map((u) => u.why).join(' | '), /INVALIDATED token/);
  assert.match(out.unbound.map((u) => u.why).join(' | '), /Stale authority establishes nothing/);
});

test('E3 — valid authority for an UNRELATED proposition refuses', () => {
  const other = relationToken('COVERAGE(some:other:premise, SAMPLE)');
  const out = adapt(F4, { authorityStore: withRoot(other) });
  assert.equal(out.minted, false);
  const why = out.unbound.map((u) => u.why).join(' | ');
  assert.match(why, /establishes "COVERAGE\(some:other:premise, SAMPLE\)"/);
  assert.match(why, /A valid token for another proposition is not evidence for this one/);
});

test('E4 — the right relation proposition in the WRONG world refuses', () => {
  const elsewhere = relationToken(NEED, 'A_DIFFERENT_REPOSITORY');
  const out = adapt(F4, { authorityStore: withRoot(elsewhere) });
  assert.equal(out.minted, false);
  const why = out.unbound.map((u) => u.why).join(' | ');
  assert.match(why, /established at repository A_DIFFERENT_REPOSITORY/);
  assert.match(why, /the witness is about SAMPLE/);
  assert.match(why, /A relation proven in another world does not hold in this one/);
});

test('E5 — a root that depends on the claim it is justifying refuses as CIRCULAR', () => {
  // The relation token is DERIVED from an observation of the very claim under derivation.
  const seed = observe({
    observation: observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
      subject: F4.requested_claim.predicate, producer: 'p', procedure: 'proc',
      attribution: 'a', context: { repository: 'SAMPLE' } }),
    procedure: 'proc', context: { repository: 'SAMPLE' } });
  const circular = derive({ premises: [seed],
    rule: { name: F4.requested_claim.predicate, requires: [] },
    relationWitnesses: [], claim: NEED });
  assert.equal(isAuthority(circular), true, 'the token itself is validly minted');
  const out = adapt(F4, { authorityStore: withRoot(circular) });
  assert.equal(out.minted, false, 'and is still refused as a root for this derivation');
  assert.match(out.unbound.map((u) => u.why).join(' | '),
    /CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION/);
});

test('E6 ANTI-REFUSAL — a relation established by DERIVE, not OBSERVE, still satisfies', () => {
  // Otherwise the easy "safe" implementation accepts only primitive observations and makes composed
  // relational knowledge impossible.
  const a = relationToken('partial coverage of the first half');
  const b = relationToken('partial coverage of the second half');
  const composed = derive({ premises: [a, b], rule: { name: 'coverage-composition', requires: [] },
    relationWitnesses: [], claim: NEED });
  assert.equal(isAuthority(composed), true);
  assert.equal(composed.constructor, 'DERIVE');
  const out = adapt(F4, { authorityStore: withRoot(composed) });
  assert.equal(isAuthority(out.token), true,
    'composed relational knowledge must remain usable: ' + out.why);
});

test('C-2 REGRESSION — an unresolvable root now refuses where v1.3 accepted it', () => {
  const empty = store();
  const out = adapt(F4, { authorityStore: empty });
  assert.equal(out.minted, false);
  const why = out.unbound.map((u) => u.why).join(' | ');
  assert.match(why, /resolves to nothing in the authority store/);
  assert.match(why, /An address is not an establishment; naming evidence is not having it/);
  // and with no store at all, it refuses rather than defaulting open
  assert.equal(adapt(F4).minted, false);
});

test('the store refuses to file anything that is not a minted token', () => {
  const s = store();
  const forged = Object.freeze({ claim: NEED, kind: KIND.EPISTEMIC, valid: true, context: {},
    ancestry: [], constructor: 'OBSERVE' });
  const r = s.put('x', forged);
  assert.equal(r.ok, false);
  assert.match(r.why, /a raw object is an assertion, not an entitlement/);
  assert.equal(s.size(), 0);
});

test('C-3 — the matcher resolves a REFERENCE; it never inspects an evidence payload', () => {
  const src = readFileSync(new URL('./authority-store.mjs', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  // it compares a claim string it CONSTRUCTED against the token's own claim
  assert.match(src, /tok\.claim !== need/);
  assert.match(src, /relationClaim\(/);
  // and there is no payload inspection: no value/data/body/content reading
  assert.doesNotMatch(src, /\.payload|\.evidence\b|\.data\b|\.body\b/,
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
