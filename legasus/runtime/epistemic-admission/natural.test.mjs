// N1..N8 — does ORDINARY producer work manufacture relation authority a later run consumes?
//
// Predictions frozen in NATURAL-RELATION_PREREG.md, after the selection procedure in
// NATURAL-RELATION_SELECTION.md had already chosen which relation, from what the producer ALREADY
// records. No new registry rule. No new producer evidence.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim } from './authority-store.mjs';
import { isAuthority } from '../../legaknow/calculus.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL = load('REL');          // the frozen selection's relation certificate (case F2)
const ORD = load('ORD');          // the ordinary certificate for that same case

// THE FROZEN SELECTION RULE HAS A LIMITATION, found by running it and NOT retrofitted. It says
// "the first qualifying fact in fixture order"; it does not say "a fact some consumer can use".
// F2's fact qualifies, but F2's ordinary certificate has an OPEN derivation - census site #7 - so
// it never reaches witness binding and cannot demonstrate consumption. The rule stands as frozen.
// These are the first qualifying fact whose case ALSO has a closed derivation, emitted by the same
// producer code and labelled SECONDARY wherever they are used.
const REL2 = load('REL2');        // secondary: relation certificate, case F4
const ORD2 = load('ORD2');        // secondary: its consumer

const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

test('N1 — an ordinary producer run emitted a RELATION claim, with no test-side retargeting', () => {
  assert.equal(REL.requested_claim.quantifier, 'POINTWISE');
  assert.equal(REL.requested_claim.predicate,
    relationClaim('COVERAGE', cov(ORD).subject, cov(ORD).object),
    'and it is exactly the relation the ordinary certificate needs');
  // the producer reports facts and REQUESTS a claim; it never certifies one
  assert.ok(!JSON.stringify(REL).includes('relation_established'));
  assert.match(REL.measurement.observation.attribution, /recorded by obligation\.coverage/,
    'the attribution names the record the fact came from, not a label invented for the schema');
  // same evidence record as the ordinary case: same instrument, repository and observation
  assert.equal(REL.measurement.instrument.name, ORD.measurement.instrument.name);
  assert.equal(REL.measurement.observation.context.repository,
    ORD.measurement.observation.context.repository);
});

test('N2 — the NORMAL admission path mints relation authority and it enters the store', () => {
  const s = store();
  const r = admit(REL, { authorityStore: s });
  assert.equal(r.state, STATE.ESTABLISHED, r.why);
  const out = adapt(REL, { authorityStore: s });
  assert.equal(isAuthority(out.token), true);
  assert.equal(out.token.claim, REL.requested_claim.predicate,
    'the minted token IS the relation instance');
  const filed = s.admitToken(out.token, { fromCertificate: REL.provenance.run_id });
  assert.ok(filed.ref, 'and it is filed under an issued handle');
});

// The whole loop, endogenous: producer facts -> certified relation -> stored -> later consumption.
function endogenous(mutate = (c) => c, { rel: relSrc = REL2, ord: ordSrc = ORD2 } = {}) {
  const s = store();
  const rel = mutate(structuredClone(relSrc));
  const ra = admit(rel, { authorityStore: s });
  if (!ra.established) return { s, ra, ref: null };
  const filed = s.admitToken(adapt(rel, { authorityStore: s }).token,
    { fromCertificate: rel.provenance.run_id });
  const ord = structuredClone(ordSrc);
  for (const w of ord.derivation.alternatives[0].relation_witnesses) {
    if (w.relation === 'COVERAGE') w.evidence_root = filed.ref;   // ONLY the opaque handle
  }
  return { s, ra, ref: filed.ref, ord, out: adapt(ord, { authorityStore: s }) };
}

test('N3 SECONDARY — a later certificate referencing ONLY the handle consumes it and derives', () => {
  const { s, ref, out, ord } = endogenous();
  assert.ok(ref);
  assert.equal(cov(ord).evidence_root, ref, 'the later certificate carries a handle, not a token');
  assert.deepEqual(out.bound, ['COVERAGE'], 'the COVERAGE obligation is satisfied by it: ' + out.why);
  assert.equal(isAuthority(out.token), true, 'and the later derivation mints');
  // the handle is only meaningful in the store that issued it: same store, or nothing resolves
  assert.equal(admit(ord, { authorityStore: s }).state, STATE.ESTABLISHED);

  // NECESSITY CONTROL - without the filed relation, the SAME certificate does not establish.
  // Otherwise this arm would be scoring something the consumer would have done anyway.
  const bare = structuredClone(ORD2);
  assert.notEqual(admit(bare, { authorityStore: store() }).state, STATE.ESTABLISHED,
    'the unmodified ordinary certificate must NOT establish on its own');
});

test('N3 PRIMARY — the frozen selection cannot complete the loop, and that is the finding', () => {
  // F2's relation certificate IS admitted (N2). Its ordinary certificate simply never reaches
  // witness binding, because the adapter looks for a closed alternative first and F2 has none.
  // Consuming certified relational knowledge did not repair an unrelated defect - correctly.
  const { ref, out } = endogenous((c) => c, { rel: REL, ord: ORD });
  assert.ok(ref, 'the relation authority was still produced and filed');
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'DERIVE');
  assert.match(out.why, /no closed alternative/);
  assert.deepEqual(out.bound || [], [], 'binding is never reached, so nothing is bound');
});

test('N4 — remove a fact necessary for the relation: it is REFUSED, never fabricated', () => {
  const { ra } = endogenous((c) => { c.measurement.observation.evidential_force = false; return c; });
  assert.equal(ra.established, false, 'no evidential force, no relation authority');
  const { ra: ra2 } = endogenous((c) => {
    c.derivation.alternatives.forEach((a) => { a.closed = false; a.premises[0].settled = false; });
    return c;
  });
  assert.equal(ra2.established, false, 'an unsettled premise produces no relation either');
});

test('N5 — the same apparent relation in the wrong world: later consumption refuses', () => {
  for (const [field, value, pattern] of [
    ['repository', 'some-other-repository', /established in repository some-other-repository/],
    ['claim_domain', null, /established over claim domain/],
  ]) {
    const s = store();
    const rel = structuredClone(REL2);
    if (field === 'repository') rel.measurement.observation.context.repository = value;
    else rel.requested_claim.domain.name = 'A_DIFFERENT_POPULATION';
    const ra = admit(rel, { authorityStore: s });
    assert.equal(ra.established, true, 'the relation is admitted in its OWN world');
    const filed = s.admitToken(adapt(rel, { authorityStore: s }).token, { fromCertificate: 'REL' });
    const ord = structuredClone(ORD2);
    for (const w of ord.derivation.alternatives[0].relation_witnesses) {
      if (w.relation === 'COVERAGE') w.evidence_root = filed.ref;
    }
    const out = adapt(ord, { authorityStore: s });
    assert.deepEqual(out.bound || [], [], field + ': the witness must not bind');
    assert.match((out.unbound || []).map((u) => u.why).join(' | '), pattern);
  }
});

test('N6 ANTI-REFUSAL — relation authority reached by DERIVE is still consumable', () => {
  // the producer's relation certificate mints through the adapter, which observes then DERIVES,
  // so the stored token is a derived one. N3 already depends on this; asserted explicitly.
  const s = store();
  admit(REL2, { authorityStore: s });
  const out = adapt(REL2, { authorityStore: s });
  assert.equal(out.token.constructor, 'DERIVE');
  const filed = s.admitToken(out.token, { fromCertificate: 'REL' });
  const ord = structuredClone(ORD2);
  for (const w of ord.derivation.alternatives[0].relation_witnesses) {
    if (w.relation === 'COVERAGE') w.evidence_root = filed.ref;
  }
  assert.deepEqual(adapt(ord, { authorityStore: s }).bound, ['COVERAGE']);
});

test('N7 — another TRUE fact from the same evidence cannot substitute for the relation', () => {
  // MEMBERSHIP is equally recorded by the producer for this case and is equally true. It is not
  // COVERAGE, and the matcher compares the claim it constructs against the token's own claim.
  const s = store();
  const other = structuredClone(REL2);
  other.requested_claim.predicate = relationClaim('MEMBERSHIP', cov(ORD2).subject, cov(ORD2).object);
  other.licensed_claim.predicate = other.requested_claim.predicate;
  const ra = admit(other, { authorityStore: s });
  assert.equal(ra.established, true, 'the other fact is genuinely established');
  const filed = s.admitToken(adapt(other, { authorityStore: s }).token, { fromCertificate: 'OTHER' });
  const ord = structuredClone(ORD2);
  for (const w of ord.derivation.alternatives[0].relation_witnesses) {
    if (w.relation === 'COVERAGE') w.evidence_root = filed.ref;
  }
  const out = adapt(ord, { authorityStore: s });
  assert.deepEqual(out.bound || [], [], 'a true but different fact must not silently substitute');
  assert.match((out.unbound || []).map((u) => u.why).join(' | '),
    /establishes "MEMBERSHIP\(.*\)" and this witness needs "COVERAGE\(/);
});

test('N8 — a qualifying relation existed, found by the frozen rule before any producer change', () => {
  // Discharged by NATURAL-RELATION_SELECTION.md. Recorded here so the arm is visible in the suite:
  // had nothing qualified, the experiment would have terminated rather than adding vocabulary.
  assert.equal(REL.provenance.run_id, 'F2-REL',
    'and the selected case is F2 - the one whose OWN claim cannot be admitted');
});
