// P1..P5 — does positional origin reassignment merely BLOCK legitimate continuity, or can it
// positively AUTHORIZE THE WRONG HISTORY?
//
// Predictions frozen in POSITIONAL-MISATTACHMENT_PREREG.md. This construction deliberately removes
// the content difference that protected L3, because the mutation table showed L3 was sensitive to
// content and not to origin.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, contentOf, MODE,
  UNATTACHED } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function consumerEntry(ref) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  const w = cov(o);
  w.evidence_root = filed.ref;
  const f2 = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
      ref: 'auth:9:gone' }] }).entry;
  e.ref = ref;
  return e;
}

// TWO SEPARATE HISTORIES WHOSE RECORDS ARE BYTE-IDENTICAL, same local ref included.
const PRED_OCC = occurrenceOf('P', consumerEntry('auth:2:a'));
function historyRecord() {
  const e = consumerEntry('auth:2:a');
  e.continuity = { predecessor: PRED_OCC, content: 'irrelevant-here' };
  return e;
}
// THE INDEPENDENT FIXTURE IDENTITY: a label the harness maintains and the runtime NEVER sees.
// Comparing against the resulting occurrence digest alone would certify the defect as absent,
// because the digest differs only through the origin - the variable under test.
const HISTORY = new Map();
// ONE record, then a clone: two DISTINCT objects in two separate journals whose bytes are equal.
// Building two independently gave records differing only in an internal evidence_root drawn from
// the module ref counter - a difference with no meaning here, and one that would have let content
// separate them and quietly protected the arm. Cloning is the faithful construction.
const TEMPLATE = historyRecord();
function history(label, e) {
  HISTORY.set(e, label);                 // keyed by object identity, never serialized
  return e;
}
const AUTHORIZED = history('AUTHORIZED-HISTORY', TEMPLATE);
const OTHER = history('OTHER-HISTORY', structuredClone(TEMPLATE));
assert.notEqual(AUTHORIZED, OTHER, 'two distinct objects, so two separate histories');
assert.equal(JSON.stringify(AUTHORIZED), JSON.stringify(OTHER),
  'the two histories are byte-identical, so nothing in the data distinguishes them');

const J = (entries) => ({ entries });
const src = (origin, e) => ({ origin, journal: J(e) });
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), ...opts });
const AUTH_ORIGIN = 'origin-0';
const authorization = { [PRED_OCC]: { successorOrigin: AUTH_ORIGIN,
  successorContent: contentOf(AUTHORIZED), transferGovernance: true } };
const GOVERN = { [PRED_OCC]: MODE.DESIGNATED };

// Which HISTORY OBJECT did the runtime select? Resolved back through the fixture map, by identity.
function selectedHistory(result, sources) {
  const f = (result.continuity || []).find((x) => x.ok);
  if (!f) return null;
  const s = sources.find((x) => x.origin === f.successor.origin);
  assert.ok(s, 'the selected origin is not among the sources');
  const entry = s.journal.entries.find((e) => e.ref === f.successor.ref);
  assert.ok(entry, 'the selected ref is not in that journal');
  return HISTORY.get(entry) || 'UNTAGGED';
}

test('P1 — baseline: with stable labels the authorized history is the one selected', () => {
  const sources = [src('origin-0', [AUTHORIZED]), src('origin-1', [OTHER])];
  const r = play(sources, { governingByOccurrence: GOVERN, continuity: authorization });
  assert.equal(selectedHistory(r, sources), 'AUTHORIZED-HISTORY',
    'established against the independent fixture identity, not against a digest');
  assert.equal(r.continuity[0].kind, 'CONTINUED');
  assert.equal(r.ok, true, r.why);
});

test('P2 — the decisive attack: reorder with the authorization unchanged', () => {
  const sources = [src('origin-0', [OTHER]), src('origin-1', [AUTHORIZED])];
  const r = play(sources, { governingByOccurrence: GOVERN, continuity: authorization,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  const selected = selectedHistory(r, sources);

  // RECORDED AS IT COMES OUT. Either answer is a result; only one of them is a safety failure.
  assert.notEqual(selected, 'AUTHORIZED-HISTORY',
    'if the authorized history were still selected the hazard would not reach continuity at all');
  assert.equal(selected, 'OTHER-HISTORY',
    'POSITIVELY AUTHORIZES THE WRONG HISTORY: the unauthorized one now occupies the authorized'
    + ' origin, and byte-identical content satisfies the remaining condition');
  assert.equal(r.continuity[0].kind, 'CONTINUED',
    'and it is reported as a successful continuity, not as a refusal');
});

test('P3 — governance follows the same finding, and is not independent evidence', () => {
  const sources = [src('origin-0', [OTHER]), src('origin-1', [AUTHORIZED])];
  const r = play(sources, { governingByOccurrence: GOVERN, continuity: authorization,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  const o = outcomeFor(r, 'origin-0', 'auth:2:a');
  const ob = o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {};
  assert.equal(ob.governedBy, 'GOVERNING_BY_AUTHORIZED_CONTINUITY',
    'the obligation attached to the wrong history too');
  assert.equal(ob.mode, MODE.DESIGNATED);
  // stated in the preregistration before running: this arm is gated on P2 and is not a second
  // independent piece of evidence.
});

test('P4 — which failure mode: it authorizes the wrong history, it does not merely block', () => {
  const reordered = [src('origin-0', [OTHER]), src('origin-1', [AUTHORIZED])];
  const r = play(reordered, { governingByOccurrence: GOVERN, continuity: authorization,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.ok, true, 'the run does not refuse');
  assert.deepEqual(r.unresolvedGovernance, [],
    'nothing is reported as unattached - the obligation believes it attached correctly');
  assert.equal((r.continuity || []).some((x) => !x.ok), false, 'and no continuity finding refuses');

  // BLOCKING would look like this instead, and it does not happen:
  assert.notEqual(r.continuity[0].kind, 'UNAUTHORIZED');
  assert.notEqual(r.continuity[0].kind, 'ABSENT');
});

test('P5 — the missing input, stated as a requirement rather than repaired', () => {
  // The two histories are byte-identical. Their occurrence digests differ ONLY through the origin,
  // which is the variable under test. So no identifier the runtime could compute would separate
  // them: the information is not present in what it receives.
  assert.equal(contentOf(AUTHORIZED), contentOf(OTHER), 'content cannot separate them');
  assert.equal(JSON.stringify(AUTHORIZED), JSON.stringify(OTHER), 'nor can any serialization');
  assert.notEqual(occurrenceOf('origin-0', AUTHORIZED), occurrenceOf('origin-1', AUTHORIZED),
    'the occurrence differs only by the origin the merger assigned');
  assert.equal(occurrenceOf('origin-0', AUTHORIZED), occurrenceOf('origin-0', OTHER),
    'so under one origin the two histories are literally the same occurrence');

  // THE REQUIREMENT: a continuity authorization needs an input the merger cannot supply from
  // position alone - a history identity that travels WITH the journal and is established, not
  // asserted. That is a missing input, and no stronger digest invented here would be ownership.
  assert.equal(HISTORY.get(AUTHORIZED) !== HISTORY.get(OTHER), true,
    'the harness can tell them apart only because it kept a label the runtime never receives');
});
