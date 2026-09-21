// S0..S8 — multiplicity, and when a support set is complete enough to decide anything about it.
//
// Predictions frozen in MULTIPLICITY_PREREG.md. The proposed rule under test:
//
//     Multiple eligible supports may justify the same claim without increasing its scope, currency
//     or strength. Their provenance stays explicit; multiplicity itself contributes no authority.
//
// It is a PROPOSAL. S7 is its falsifier, not its demonstration.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim, resolveEvidenceRoot } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');
const NEED = relationClaim('COVERAGE', cov(ORD2).subject, cov(ORD2).object);

// A supplier record and a consumer record, produced the ordinary way and then re-addressed.
function supplier(ref, mutate = (c) => c) {
  const st = store();
  const c = mutate(structuredClone(REL2));
  admit(c, { authorityStore: st });
  const out = adapt(c, { authorityStore: st });
  if (!out.token) return null;
  const filed = st.admitToken(out.token, { fromCertificate: c.provenance.run_id });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: c, consumed: [] }).entry;
  e.ref = ref;
  return e;
}
function consumer(ref, rootRef = 'auth:9:gone', mutate = (c) => c) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = mutate(structuredClone(ORD2));
  const w = cov(o);
  w.evidence_root = filed.ref;
  const out = adapt(o, { authorityStore: st });
  const f2 = st.admitToken(out.token, { fromCertificate: o.provenance.run_id });
  const e = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object, ref: rootRef }] }).entry;
  e.ref = ref;
  return e;
}
const J = (entries) => ({ entries });
const src = (origin, ...entries) => ({ origin, journal: J(entries) });
const play = (sources) => replayMerged(merge(sources).merged, { authorityStore: store() });
const shape = (r) => (r.outcomes || []).map((o) => [o.origin, o.ref, o.state, o.minted,
  (o.bound || []).join(','),
  (o.candidates || []).map((c) => c.origin + '/' + c.ref).sort().join(','),
  (o.supply || []).map((s) => s.origin + '/' + s.by).join(',')].join('|')).sort();

test('S0 — the reworded refusal changes wording only', () => {
  // Captured from the run BEFORE the wording change, and asserted here unchanged.
  const r = play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))]);
  assert.deepEqual(
    r.outcomes.map((o) => [o.origin, o.ref, o.state, o.minted].join('|')).sort(),
    ['A|auth:2:a|UNRESOLVED|false', 'B|auth:1:b|ESTABLISHED|true', 'C|auth:1:c|ESTABLISHED|true'],
    'states and minting are byte-identical to the pre-rewording behaviour');
  const a = outcomeFor(r, 'A', 'auth:2:a');
  assert.match(a.why, /MULTIPLE ELIGIBLE SUPPORTS/);
  assert.match(a.why, /not a finding that the evidence disagrees/);
  assert.match(a.why, /not a finding that the claim is better supported/);
});

test('S1 — duplicate support: two histories, ONE reason, reported as multiplicity', () => {
  // The SAME underlying evidence, byte-identical, reaching the consumer through two origins.
  const one = supplier('auth:1:b');
  const same = structuredClone(one);
  same.ref = 'auth:1:c';
  assert.deepEqual(same.evidence, one.evidence, 'this is genuinely one observation, twice');

  const r = play([src('A', consumer('auth:2:a')), src('B', one), src('C', same)]);
  const a = outcomeFor(r, 'A', 'auth:2:a');
  assert.equal(a.minted, false, 'nothing is composed and nothing is chosen: ' + a.why);
  assert.deepEqual((a.candidates || []).map((c) => c.origin + '/' + c.ref),
    ['B/auth:1:b', 'C/auth:1:c'], 'and BOTH stay named in the provenance');

  // AND IT IS NOT CORROBORATION. Two replays of one observation are two histories and one reason.
  assert.match(a.why, /not a finding that the claim is better supported/);
  assert.equal(/corroborat|confidence|strength|weight|score/i.test(JSON.stringify(r)), false,
    'no outcome anywhere carries a notion of how WELL supported the claim is');
});

test('S2 — distinct agreeing support is preserved as alternatives, never combined', () => {
  // "Different evidence" here means a different run of the same instrument: distinct provenance and
  // distinct observation identity, same fully scoped proposition. That is the strongest form of
  // distinctness these fixtures can express, and the weakness is stated rather than papered over.
  const b = supplier('auth:1:b');
  const c = supplier('auth:1:c', (x) => {
    x.provenance = { ...x.provenance, run_id: x.provenance.run_id + '-SECOND-RUN' };
    return x;
  });
  assert.notDeepEqual(b.evidence.provenance, c.evidence.provenance, 'the evidence records differ');
  assert.equal(b.evidence.licensed_claim.predicate, c.evidence.licensed_claim.predicate,
    'and they license the same fully scoped proposition');

  const fwd = play([src('A', consumer('auth:2:a')), src('B', b), src('C', c)]);
  const rev = play([src('C', c), src('B', b), src('A', consumer('auth:2:a'))]);
  // The candidate SET is compared, not its order: the reported list is input-ordered, which is
  // cosmetic and is disclosed rather than asserted away.
  assert.deepEqual(shape(fwd), shape(rev), 'neither is chosen by input order');
  const a = outcomeFor(fwd, 'A', 'auth:2:a');
  assert.equal(a.minted, false);
  assert.deepEqual((a.candidates || []).map((x) => x.origin).sort(), ['B', 'C'],
    'both alternatives survive; nothing is merged into a single stronger support');
});

test('S3 — apparent agreement is not agreement', () => {
  // Same claim string, incompatible world. It establishes in ITS world and could never bind here.
  const good = supplier('auth:1:b');
  const elsewhere = supplier('auth:1:c', (x) => {
    x.measurement.observation.context.repository = 'another-repository';
    return x;
  });
  const r = play([src('A', consumer('auth:2:a')), src('B', good), src('C', elsewhere)]);
  assert.equal(outcomeFor(r, 'C', 'auth:1:c').state, STATE.ESTABLISHED, 'fine in its own world');
  const a = outcomeFor(r, 'A', 'auth:2:a');

  // THE REQUIRED OBSERVATION: a support that cannot bind here is not eligible support here, so
  // this must not be reported as two eligible supports.
  //
  // Read from `supply[].candidates`, NOT from `outcome.candidates`. The outcome only carries a
  // candidates field in the multi-candidate REFUSAL branch; when one candidate is eligible the set
  // considered is recorded on the supply entry. The first version of this arm read the refusal
  // field on a successful outcome and got undefined - the ninth wrong-referent instance, and the
  // second one inside this very suite.
  assert.equal(a.minted, true, 'the one genuinely eligible support is used: ' + a.why);
  assert.deepEqual(a.bound, ['COVERAGE']);
  assert.deepEqual((a.supply[0].candidates || []).map((x) => x.origin), ['B'],
    'a claim-identity match in another world is not eligible support here');
  assert.equal(a.supply[0].origin, 'B');
});

test('S4 — the claim language cannot express incompatible propositions: TERMINAL', () => {
  // A claim is a predicate string plus a world. There is no negation, no contradiction operator,
  // and no vocabulary for "incompatible with". So "actual disagreement" cannot be CONSTRUCTED in
  // this contract, and no negation is invented here to manufacture the case.
  assert.equal(typeof relationClaim('COVERAGE', 'x', 'y'), 'string');
  assert.equal(/negat|contradict|incompatible|refutes|excludes/i.test(JSON.stringify(REL2)), false,
    'the certificate carries no negative vocabulary');
  assert.equal(/negat|contradict|incompatible|refutes|excludes/i
    .test(readFileSync(new URL('./adapter.mjs', import.meta.url), 'utf8')
      .replace(/^.*?import /s, '')), false, 'nor does the adapter');
  // THE MISSING COORDINATE, named so it is not rediscovered: a claim would need a polarity, or a
  // declared incompatibility relation between predicates, before disagreement is even sayable.
});

test('S5 — a deeper second supplier is not concealed by scheduling', () => {
  // The second supplier sits one replay step deeper: it is reached only after another record in
  // its own origin. The consumer would be ready the moment the shallow supplier lands.
  const deepRoot = supplier('auth:1:root');
  const deep = supplier('auth:1:deep');
  deep.consumed = [{ relation: 'COVERAGE', subject: cov(ORD2).subject, object: cov(ORD2).object,
    ref: 'auth:1:root' }];
  const shallow = supplier('auth:1:b');

  const A = src('A', consumer('auth:2:a')), B = src('B', shallow),
    C = src('C', deepRoot, deep);
  for (const order of [[A, B, C], [C, B, A], [B, C, A], [A, C, B]]) {
    const r = play(order);
    const a = outcomeFor(r, 'A', 'auth:2:a');
    assert.equal(a.minted, false,
      'the deeper supplier must be discovered before the consumer commits: ' + a.why);
    assert.ok((a.candidates || []).length > 1, 'multiplicity is visible under order '
      + order.map((o) => o.origin).join(''));
  }
});

test('S6 — completeness rests on a DECLARED claim, and a record that declines to declare hides', () => {
  // THE ATTACK NAMED IN THE PREREGISTRATION. Readiness defers a consumer while a pending record
  // DECLARES the needed claim. A declared claim is a record: a hint, never an authority.
  const shallow = supplier('auth:1:b');
  const hidden = supplier('auth:1:c');
  delete hidden.record.claim;            // it still establishes the claim; it just does not say so

  const honest = play([src('A', consumer('auth:2:a')), src('B', shallow),
    src('C', supplier('auth:1:c'))]);
  const attacked = play([src('A', consumer('auth:2:a')), src('B', shallow), src('C', hidden)]);

  assert.equal(outcomeFor(honest, 'A', 'auth:2:a').minted, false,
    'declared: multiplicity is detected and nothing is chosen');
  const a = outcomeFor(attacked, 'A', 'auth:2:a');
  assert.equal(outcomeFor(attacked, 'C', 'auth:1:c').state, STATE.ESTABLISHED,
    'the undeclared record establishes exactly the same claim');

  // Recorded as it comes out, whichever way it goes. The preregistration predicted concealment.
  const concealed = a.minted === true;
  assert.equal(concealed, true,
    'PREDICTION WAS CONCEALMENT. If this now fails, completeness stopped resting on the hint and'
    + ' the result document must be rewritten, not this assertion');
  assert.equal((a.supply || [])[0].completenessBasis, 'DECLARED_CLAIMS_OF_PENDING_RECORDS',
    'and the outcome says out loud what its completeness rested on');
});

test('S7 — multiplicity adds no scope, currency or strength', () => {
  const b = supplier('auth:1:b'), c = supplier('auth:1:c');
  const onlyB = play([src('A', consumer('auth:2:a')), src('B', b)]);
  const onlyC = play([src('A', consumer('auth:2:a')), src('C', c)]);
  const ob = outcomeFor(onlyB, 'A', 'auth:2:a'), oc = outcomeFor(onlyC, 'A', 'auth:2:a');
  assert.equal(ob.state, STATE.ESTABLISHED, ob.why);
  assert.equal(ob.state, oc.state);
  assert.deepEqual(ob.bound, oc.bound);
  assert.equal(ob.why, oc.why, 'either support alone licenses exactly the same thing');

  // and with both available the outcome is a refusal, never something MORE than either alone
  const both = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', b), src('C', c)]),
    'A', 'auth:2:a');
  assert.equal(both.minted, false);
  assert.equal(/corroborat|confidence|strength|weight|count|score/i
    .test(JSON.stringify([ob, oc, both])), false,
  'no outcome grows a notion of how many supports there were');
});

test('S8 — the contract cannot say "any admissible support": TERMINAL', () => {
  // A witness roots in ONE designated address, or in nothing. There is no existential mode, so a
  // consumer cannot express "an admissible support exists" as distinct from "this one". No mode is
  // added here to manufacture the distinction.
  const st = store();
  const w = { relation: 'COVERAGE', subject: 'x', object: 'y', domain: 'SAMPLE', evidence_root: '' };
  const why = resolveEvidenceRoot(w, { authorityStore: st });
  assert.match(why, /asserts a relation without rooting in anything/,
    'the only alternative to a designated root is nothing at all');
  // The first version of this probe grepped adapter.mjs for "existential" and matched the RULE ID
  // `existential-from-established-member` - an eighth wrong-referent instance, caught on the first
  // run. The structural question is about the WITNESS, so ask the witness.
  const keys = Object.keys(cov(ORD2)).sort();
  assert.deepEqual(keys,
    ['domain', 'evidence_root', 'object', 'provenance', 'relation', 'subject'],
    'read off the witness itself, not from memory - the second wrong-referent slip in this arm');
  assert.equal(typeof cov(ORD2).evidence_root, 'string',
    'ONE designated root, not a list and not a predicate over admissible supports');
  assert.equal(keys.some((k) => /mode|requirement|any|either|some/i.test(k)), false,
    'and no key expresses what KIND of support would satisfy it');
  // THE MISSING COORDINATE: a witness would need a requirement MODE - designated vs existential -
  // before "several eligible supports" could be a satisfaction rather than an impasse.
});
