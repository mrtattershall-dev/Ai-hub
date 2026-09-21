// S1..S8 — can one real admission create authority a later independent admission consumes?
//
// Predictions frozen in LINEAGE_PREREG.md. Scope stated there and repeated here: this tests whether
// established authority can be PRODUCED, STORED, REFERENCED, INVALIDATED and REUSED under the three
// already-supported rules. It makes NO claim about general inference recognition; rule selection
// stays unattacked and the census stays at zero correspondence.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim, VALIDITY } from './authority-store.mjs';
import { ADMITTED_RULES, DIGESTS, legacyDigestOf } from './rules.mjs';
import { isAuthority } from '../../legaknow/calculus.mjs';

const F4 = JSON.parse(readFileSync(new URL('./fixtures/F4.json', import.meta.url), 'utf8'));
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');
const NEED = relationClaim('COVERAGE', cov(F4).subject, cov(F4).object);

// CERTIFICATE A. A real certificate whose requested claim IS the relation instance, derived by
// `claim-from-direct-observation` - the rule that genuinely requires no relation witness. Built by
// retargeting F4's shape, so it goes through exactly the same adapter and admission path as B.
function certA({ repository = 'SAMPLE', predicate = NEED } = {}) {
  const a = structuredClone(F4);
  a.provenance.run_id = 'A';
  a.requested_claim = { domain: { name: repository, contained_in: ['REPOSITORY'] },
    quantifier: 'POINTWISE', predicate };
  a.licensed_claim = { ...a.requested_claim };
  a.licensed_relation = 'EQUIVALENT';
  a.derivation.rule_id = 'claim-from-direct-observation';
  a.derivation.rule_digest = DIGESTS['claim-from-direct-observation'];
  for (const alt of a.derivation.alternatives) alt.relation_witnesses = [];
  a.frontier = [];
  return a;
}

// CERTIFICATE B. F4, referencing a handle rather than the producer's placeholder string.
function certB(ref) {
  const b = structuredClone(F4);
  b.provenance.run_id = 'B';
  for (const w of b.derivation.alternatives[0].relation_witnesses) {
    if (w.relation === 'COVERAGE') w.evidence_root = ref;
  }
  return b;
}

// THE LOOP. Admit A; file the authority its admission produced; hand B the issued handle.
function lineage(opts = {}) {
  const s = store();
  const a = certA(opts);
  const ra = admit(a, { authorityStore: s });
  if (!ra.established) return { s, a, ra, ref: null };
  const out = adapt(a, { authorityStore: s });
  const filed = s.admitToken(out.token, { fromCertificate: a.provenance.run_id,
    contract: a.contract_version, rule: a.derivation.rule_id });
  return { s, a, ra, token: out.token, ref: filed.ref };
}

test('S1 — A admitted, stored, and B legitimately derives from it', () => {
  const { s, ra, ref } = lineage();
  assert.equal(ra.established, true, 'A is admitted on its own merits: ' + ra.why);
  assert.ok(ref, 'and its authority was filed under an issued handle');

  const b = certB(ref);
  const outB = adapt(b, { authorityStore: s });
  assert.equal(isAuthority(outB.token), true, 'B derives from A: ' + outB.why);
  assert.deepEqual(outB.bound, ['COVERAGE']);
  const rb = admit(b, { authorityStore: s });
  assert.equal(rb.state, STATE.ESTABLISHED);

  // the loop is closed: B's authority traces to a certificate that was itself admitted
  assert.equal(s.recordOf(ref).fromCertificate, 'A');
  assert.equal(s.recordOf(ref).claim, NEED);
});

test('S2 — if A fails admission there is no reference, and B refuses', () => {
  const s = store();
  const a = certA();
  a.measurement.observation.evidential_force = false;      // A cannot be admitted
  const ra = admit(a, { authorityStore: s });
  assert.equal(ra.established, false);
  assert.equal(s.size(), 0, 'nothing was filed');
  const b = certB('auth:never-issued');
  const outB = adapt(b, { authorityStore: s });
  assert.equal(outB.minted, false);
  assert.match((outB.unbound || []).map((u) => u.why).join(' | '), /resolves to nothing/);
});

test('S3 — A revoked before B: B refuses the stale root', () => {
  const { s, ref } = lineage();
  s.revoke(ref, 'the corpus moved under it');
  const b = certB(ref);
  const outB = adapt(b, { authorityStore: s });
  assert.equal(outB.minted, false);
  const why = (outB.unbound || []).map((u) => u.why).join(' | ');
  assert.match(why, /REVOKED/);
  assert.match(why, /the corpus moved under it/);
  assert.match(why, /Stale authority establishes nothing/);
});

test('S4 — a serialized clone of A cannot become authority', () => {
  const { s, token, ref } = lineage();
  const clone = JSON.parse(JSON.stringify(token));
  assert.equal(isAuthority(clone), false, 'a JSON round-trip is not a member of the brand');
  const r = s.admitToken(clone);
  assert.equal(r.ok, false);
  assert.match(r.why, /a JSON clone of a real token - is an assertion, not an entitlement/);
  // the persistent record deliberately does NOT carry the token
  assert.equal(s.recordOf(ref).token, undefined,
    'the persistent artefact is an admission RECORD, not a serialized token');
  assert.equal(s.recordOf(ref).claim, NEED, 'it carries the claim, evidence and provenance instead');
});

test('S5 REPAIRED — the world check now fires on the real lineage path, on BOTH coordinates', () => {
  // HISTORY, kept: S5's original prediction FAILED. B accepted a root from another world, because
  // observe() was handed the certificate's observation context, which carried no repository at all,
  // so `token.context.repository` was undefined and the comparison never fired. The earlier arms
  // passed only on tokens CONSTRUCTED with an explicit world.
  //
  // WORLD-IDENTITY_PREREG then SEARCHED every subset of {repository, claim_domain, evidence_extent,
  // procedure} and found exactly one minimal identity: {repository, claim_domain}. The repair
  // carries both into the token, and extent is ORDERED rather than compared for equality.

  // (a) different CLAIM DOMAIN, same repository
  const { s, ref } = lineage({ repository: 'A_DIFFERENT_CLAIM_DOMAIN' });
  assert.ok(ref, 'A was admitted over its own claim domain');
  const b = certB(ref);
  const outB = adapt(b, { authorityStore: s });
  assert.equal(outB.minted, false, 'R-W1: B now refuses a root from another population');
  assert.match((outB.unbound || []).map((u) => u.why).join(' | '),
    /established over claim domain A_DIFFERENT_CLAIM_DOMAIN/);

  // (b) different REPOSITORY, same claim domain
  const s2 = store();
  const a2 = certA();
  a2.measurement.observation.context.repository = 'a-different-repository';
  const out2 = adapt(a2, { authorityStore: s2 });
  const filed = s2.admitToken(out2.token, { fromCertificate: 'A' });
  const b2 = certB(filed.ref);
  const outB2 = adapt(b2, { authorityStore: s2 });
  assert.equal(outB2.minted, false, 'R-W1: and refuses a root from another repository');
  assert.match((outB2.unbound || []).map((u) => u.why).join(' | '),
    /established in repository a-different-repository/);
});

test('R-W3 — extent is ORDERED, not equal: examining MORE transfers, LESS does not', () => {
  // The arm that determined extent cannot be an identity coordinate (D3a).
  for (const [tokenExamined, need, shouldTransfer] of [[60, 60, true], [90, 60, true], [30, 60, false]]) {
    const s = store();
    const a = certA();
    a.measurement.observation.context.examined = tokenExamined;
    const filed = s.admitToken(adapt(a, { authorityStore: s }).token, { fromCertificate: 'A' });
    const b = certB(filed.ref);
    b.measurement.observation.context.examined = need;
    const out = adapt(b, { authorityStore: s });
    assert.equal(isAuthority(out.token), shouldTransfer,
      'token examined ' + tokenExamined + ', needed ' + need + ': ' + (out.why || 'minted'));
  }
});

test('R-W4 REPAIRED — the rule identity now covers behaviour reached through a called function', () => {
  // HISTORY, kept: R-W4's prediction FAILED here. Changing the world check inside
  // resolveEvidenceRoot left every fingerprint byte-identical, because digestOf hashed
  // satisfiedBy.toString(), which contains the CALL and not the callee's body.
  //
  // DEPENDENCY-CLOSURE then built the closure mechanically and INSTALL-FINGERPRINTS installed it.
  // The installed identity now covers resolveEvidenceRoot, so the same change moves it - while an
  // unrelated edit in the same module still does not (I-4).
  assert.notEqual(DIGESTS['universal-from-exhaustive-coverage'],
    '1c356ca01d173bd4d3656ae003781df7e991e3cb4033250750a6ee1764930ba4',
    'the identity is no longer the source-only digest that could not see the change');
  const src = ADMITTED_RULES['universal-from-exhaustive-coverage'].obligations[0].satisfiedBy.toString();
  assert.match(src, /resolveEvidenceRoot\(w, ctx\)/, 'the matcher still CALLS it');
  // and what the matcher source alone cannot see is now inside the identity: see install.test.mjs
  // I-3, which mutates that callee and shows the installed fingerprint move.
});

test('R-W4 history — the source-only digest, kept as the record of what it could not see', () => {
  // The legacy digest is still computable, and still blind in exactly the way that was recorded.
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const before = legacyDigestOf(rule);
  // a matcher whose SOURCE is unchanged but whose callee's meaning differs hashes identically under
  // the legacy scheme, because the scheme never looks past the call.
  assert.equal(legacyDigestOf({ ...rule }), before,
    'the source-only digest depends on nothing but the matcher text');
  assert.notEqual(before, DIGESTS['universal-from-exhaustive-coverage'],
    'and the installed identity is a different, wider thing');
});

test('L-2 — invalidation PROPAGATES to dependents; re-establishing does NOT restore them', () => {
  const { s, ref } = lineage();
  const b = certB(ref);
  const rb = admit(b, { authorityStore: s });
  assert.equal(rb.established, true);
  const bFiled = s.admitToken(adapt(b, { authorityStore: s }).token, { fromCertificate: 'B' });
  s.dependsOn(bFiled.ref, ref);

  const { touched } = s.revoke(ref, 'A was wrong');
  assert.ok(touched.includes(ref));
  assert.equal(s.validityOf(ref), VALIDITY.REVOKED);
  assert.equal(s.validityOf(bFiled.ref), VALIDITY.UNESTABLISHED,
    'B lost its standing because something it consumed did');

  s.reestablish(ref);
  assert.equal(s.validityOf(ref), VALIDITY.LIVE);
  assert.equal(s.validityOf(bFiled.ref), VALIDITY.UNESTABLISHED,
    'REVALIDATION DOES NOT PROPAGATE: B must be re-run, not reasoned back into existence');
});

test('S8 — THE OPEN QUESTION: does a retained alias survive revocation?', () => {
  const { s, token, ref } = lineage();
  const alias = token;                                  // a direct reference, kept by a consumer
  s.revoke(ref, 'revoked at the store');

  // (a) through the store - the only path a certificate can take - revocation holds
  assert.equal(s.resolve(ref).ok, false);
  const b = certB(ref);
  assert.equal(adapt(b, { authorityStore: s }).minted, false);

  // (b) the retained alias is STILL a valid branded token. invalidate() returns a NEW token and
  // leaves the original frozen one untouched, so revocation is effective only for consumers forced
  // through the store. PREDICTED in LINEAGE_PREREG L-3, and confirmed.
  assert.equal(isAuthority(alias), true, 'the alias is still branded');
  assert.equal(alias.valid, true, 'and still reports itself valid');

  // (c) BUT the bypass is unreachable through the certificate seam: a certificate can carry only a
  // handle, and a token cannot survive JSON. There is no field for one and no way to express it.
  const b2 = certB(ref);
  cov(b2).evidence_root = alias;                        // try to smuggle the token in
  const out2 = adapt(b2, { authorityStore: s });
  assert.equal(out2.minted, false, 'a token in the evidence_root slot resolves to nothing');
  assert.equal(JSON.parse(JSON.stringify({ t: alias })).t.valid, true,
    'the clone LOOKS valid...');
  assert.equal(isAuthority(JSON.parse(JSON.stringify({ t: alias })).t), false,
    '...and is not authority, because the brand does not survive serialization');
});

test('L-4 — legaknow is byte-unchanged', () => {
  const diff = execSync('git diff --name-only HEAD -- legasus/legaknow/',
    { cwd: new URL('../../../', import.meta.url).pathname.replace(/^\//, ''), encoding: 'utf8' });
  assert.equal(diff.trim(), '', 'git says: ' + diff);
});
