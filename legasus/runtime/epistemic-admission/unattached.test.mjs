// U1..U7 — what happens AFTER governance fails to attach.
//
// Predictions frozen in UNATTACHED-GOVERNANCE_PREREG.md. G5 made an unattached obligation visible;
// it did not prevent its consequence.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, MODE, UNATTACHED } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function supplier(ref) {
  const st = store();
  const c = structuredClone(REL2);
  admit(c, { authorityStore: st });
  const filed = st.admitToken(adapt(c, { authorityStore: st }).token, { fromCertificate: 'REL' });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: c, consumed: [] }).entry;
  e.ref = ref;
  return e;
}
function consumer(ref, tag) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  if (tag) o.provenance = { ...o.provenance, run_id: o.provenance.run_id + '-' + tag };
  const w = cov(o);
  w.evidence_root = filed.ref;
  const f2 = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
      ref: 'auth:9:gone' }] }).entry;
  e.ref = ref;
  return e;
}
const J = (entries) => ({ entries });
const src = (origin, ...entries) => ({ origin, journal: J(entries) });
const run = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), ...opts });
const ABSENT = '0'.repeat(64);

test('U1 — diagnosis alone makes the failure visible without preventing it', () => {
  // The governor meant this consumer to be DESIGNATED. The entry denotes nothing here, so under a
  // diagnose-only policy the consumer proceeds under the unnamed default - and the default takes
  // the substitute the designated obligation would have refused.
  const r = run([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))],
    { governingByOccurrence: { [ABSENT]: MODE.DESIGNATED },
      unattachedPolicy: UNATTACHED.DIAGNOSE });

  assert.equal(r.unresolvedGovernance.length, 1, 'the failure is reported');
  const a = outcomeFor(r, 'A', 'auth:2:a');
  assert.equal(a.state, STATE.ESTABLISHED, 'AND the consumer succeeded anyway: ' + a.why);
  assert.equal(a.supply[0].by, 'CLAIM', 'through exactly the substitute DESIGNATED would refuse');
  assert.equal(a.supply[0].obligation.governedBy, 'DEFAULT');
  assert.equal(a.supply[0].obligation.mode, null,
    'THE GAP: a burden the governor intended was silently replaced by the unnamed default');
});

test('U2 — the affected set is not computable, which is why BLOCK cannot exist', () => {
  // Two consumers, indistinguishable from an entry that denotes nothing. The entry carries an
  // occurrence digest of a record that is not here; nothing in it names a subject in this set.
  const r = run([src('A', consumer('auth:2:a', 'FIRST')), src('D', consumer('auth:2:d', 'SECOND')),
    src('B', supplier('auth:1:b'))],
  { governingByOccurrence: { [ABSENT]: MODE.DESIGNATED }, unattachedPolicy: UNATTACHED.DIAGNOSE });
  const entry = r.unresolvedGovernance[0];
  assert.equal(entry.denoting, ABSENT);
  const present = r.outcomes.map((o) => o.occurrence);
  assert.equal(present.includes(entry.denoting), false,
    'it matches no record here, so which consumer it meant is UNKNOWN, not unenumerated');
  assert.equal(present.length, 3, 'and there is more than one candidate it could have meant');
  assert.equal(new Set(present).size, 3, 'each a distinct occurrence');
});

test('U3 — INVALIDATE is the default: no admission is produced at all', () => {
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))];
  const r = run(sources, { governingByOccurrence: { [ABSENT]: MODE.DESIGNATED } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.outcomes, [], 'nothing was admitted, not even the records that were fine');
  assert.equal(r.unattached.policy, UNATTACHED.INVALIDATE);
  assert.equal(r.unattached.governedBy, 'DEFAULT');
  assert.match(r.why, /governance did not attach/);
  assert.match(r.why, /proceeding under the default would substitute a weaker one/);
  assert.match(r.why, new RegExp(ABSENT), 'and every unattached entry is named');

  // control: with governance that DOES attach, the same journals admit normally
  const ok = run(sources, { witnessModes: { COVERAGE: MODE.EXISTENTIAL } });
  assert.equal(ok.ok, true);
  assert.equal(outcomeFor(ok, 'A', 'auth:2:a').state, STATE.ESTABLISHED,
    'so U3 refusal is the policy doing work, not the fixture being unsatisfiable');
});

test('U4 — DIAGNOSE is an authorized downgrade, recorded as one', () => {
  const r = run([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))],
    { governingByOccurrence: { [ABSENT]: MODE.DESIGNATED },
      unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.ok, true);
  assert.equal(r.unattached.policy, UNATTACHED.DIAGNOSE);
  assert.equal(r.unattached.governedBy, 'GOVERNOR',
    'the result says the downgrade was chosen, not that it is how things work');
  assert.notEqual(r.unattached.governedBy, 'DEFAULT');
});

test('U5 — BLOCK is refused, not faked', () => {
  // asked for even where nothing is unattached: it is refused on its own terms, always
  const r = run([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))],
    { unattachedPolicy: UNATTACHED.BLOCK });
  assert.equal(r.ok, false);
  assert.deepEqual(r.outcomes, []);
  assert.match(r.why, /refused, not approximated/);
  assert.match(r.why, /UNKNOWN - not merely unenumerated/);
  assert.equal(/blocked|partially/i.test(r.why), false,
    'and it does not silently degrade to diagnosing or to blocking something nearby');
});

test('U6 — the policy is governed, never requested', () => {
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))];
  const gov = { governingByOccurrence: { [ABSENT]: MODE.DESIGNATED } };
  const asked = run(sources, { ...gov, requestedUnattachedPolicy: UNATTACHED.DIAGNOSE });
  const plain = run(sources, gov);

  assert.equal(asked.ok, false, 'asking for the downgrade does not obtain it');
  assert.equal(asked.unattached.policy, UNATTACHED.INVALIDATE);
  assert.equal(asked.unattached.requested, UNATTACHED.DIAGNOSE);
  assert.equal(asked.unattached.requestAccepted, false);
  assert.equal(plain.unattached.requested, null);
  assert.equal(plain.unattached.requestAccepted, null,
    'no request is not the same value as request refused');

  // the ADMISSION projection is identical whether or not the request was made
  const admission = (x) => ({ ok: x.ok, outcomes: x.outcomes.length, why: x.why });
  assert.deepEqual(admission(asked), admission(plain));
});

test('U7 — subjectOf prevents two mistakes and does not establish a third thing', () => {
  // The helper refuses a coordinate-only or missing-subject assertion. It CANNOT establish that it
  // resolved the RIGHT occurrence: testing the apparatus with the apparatus proves nothing. The
  // expected occurrence is therefore constructed independently, from the entry, by occurrenceOf.
  const a = consumer('auth:2:a', 'FIRST'), d = consumer('auth:2:d', 'SECOND');
  const r = run([src('A', a), src('D', d), src('B', supplier('auth:1:b'))],
    { witnessModes: { COVERAGE: MODE.EXISTENTIAL } });

  const expectedA = occurrenceOf('A', a), expectedD = occurrenceOf('D', d);
  assert.notEqual(expectedA, expectedD);
  assert.equal(outcomeFor(r, 'A', 'auth:2:a').occurrence, expectedA,
    'the outcome resolves to the occurrence computed independently of any outcome');
  assert.equal(outcomeFor(r, 'D', 'auth:2:d').occurrence, expectedD);

  // and the arm fails if a neighbour is returned: the expectation is specific, not merely present
  assert.notEqual(outcomeFor(r, 'A', 'auth:2:a').occurrence, expectedD,
    'a neighbour occurrence must not satisfy this assertion');
  assert.throws(() => outcomeFor(r, 'A', 'auth:2:d'), /no outcome was produced/,
    'and a coordinate that names no record still fails loudly');
});

// ADDED after the result was reported, because "no admissions returned" and "no usable authority
// escaped" are different observations and only the first had been measured. The probes call
// adapt(), which calls derive(), which mints - so suppressing results afterwards would not be the
// same as never running.
test('U8 — invalidation happens BEFORE anything can mint, not after', () => {
  const st = store();
  const before = st.size();
  const r = replayMerged(merge([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))]).merged,
    { authorityStore: st, governingByOccurrence: { [ABSENT]: MODE.DESIGNATED } });

  assert.equal(r.ok, false, 'the run is invalidated');
  assert.deepEqual(r.outcomes, [], 'no admissions are returned');

  // AND NO AUTHORITY ESCAPED: the store this run was handed is untouched. Nothing was filed, so
  // nothing is resolvable, so no token reached anywhere it could be consumed.
  assert.equal(st.size(), before, 'not one entry was filed into the authority store');
  assert.equal(JSON.stringify(r).includes('auth:'), false,
    'and no issued address appears anywhere in the result');

  // the control that gives this arm teeth: the SAME journals, governed so that attachment
  // succeeds, do file entries - so an empty store is the invalidation, not an inert fixture.
  const st2 = store();
  const ok = replayMerged(merge([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))]).merged,
    { authorityStore: st2, witnessModes: { COVERAGE: MODE.EXISTENTIAL } });
  assert.equal(ok.ok, true);
  assert.ok(st2.size() > 0, 'the same journals do mint and file when governance attaches');
});
