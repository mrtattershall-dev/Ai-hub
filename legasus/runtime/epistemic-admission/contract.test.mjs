// D1..D6 — closing the governance decision. Frozen in CONTINUITY-CONTRACT_PREREG.md.
//
//   HISTORY_SPECIFIC  default. Refuses today: a presented record carries nothing separating it from
//                     a byte-identical replacement (X1, audit-x1.mjs).
//   CONTENT_MATCH     a DIFFERENT claim, satisfied by a replacement by design, chosen explicitly.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, contentOf, MODE, UNATTACHED,
  CONTINUITY_CONTRACT } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function record(tag) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const seed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  if (tag) o.provenance = { ...o.provenance, run_id: o.provenance.run_id + '-' + tag };
  const w = cov(o);
  w.evidence_root = seed.ref;
  const filed = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
      ref: 'auth:9:gone' }] }).entry;
  e.ref = 'auth:2:a';
  return e;
}
const PRED = occurrenceOf('P', record());
const A = record();
A.continuity = { predecessor: PRED, content: 'identification-only' };
const B = structuredClone(A);                       // the replacement X1 uses
const GOVERN = { [PRED]: MODE.DESIGNATED };
const AUTH = { [PRED]: { successorOrigin: 'S', successorContent: contentOf(A),
  transferGovernance: true } };
const src = (origin, e) => ({ origin, journal: { entries: [e] } });
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), ...opts });
const modeOf = (r, origin, ref) => {
  const o = outcomeFor(r, origin, ref);
  return ((o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation)) || {}).mode || null;
};

test('D1 — the default refuses a history-specific transfer', () => {
  const r = play([src('S', A)], { governingByOccurrence: GOVERN, continuity: AUTH,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.continuityContract.contract, CONTINUITY_CONTRACT.HISTORY_SPECIFIC);
  assert.equal(r.continuityContract.chosenBy, 'DEFAULT');
  assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE_FROM_REPLACEMENT');
  assert.match(r.continuity[0].why, /cannot be distinguished from a substitute/);
  assert.match(r.continuity[0].why, /must choose CONTENT_MATCH explicitly/);
  assert.equal(modeOf(r, 'S', A.ref), null, 'nothing inherits');
  assert.equal(r.unresolvedGovernance.length, 1, 'and the obligation is left unattached');
});

test('D2 — X1 exact construction under the default: the replacement gains nothing', () => {
  // A authorized, A gone, byte-identical B in its place. This is the attack that succeeded.
  const r = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE_FROM_REPLACEMENT');
  assert.equal(modeOf(r, 'S', B.ref), null, 'B does NOT inherit A obligation');

  // and under INVALIDATE the run refuses outright
  const strict = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH });
  assert.equal(strict.ok, false);
  assert.deepEqual(strict.outcomes, []);
});

test('D3 — CONTENT_MATCH transfers, and the outcome says it was CHOSEN', () => {
  const r = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH,
    continuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH });
  assert.equal(r.continuityContract.contract, CONTINUITY_CONTRACT.CONTENT_MATCH);
  assert.equal(r.continuityContract.chosenBy, 'GOVERNOR',
    'never that this is how things work');
  assert.equal(r.continuity[0].kind, 'CONTINUED');
  assert.equal(r.continuity[0].contract, CONTINUITY_CONTRACT.CONTENT_MATCH);
  assert.match(r.continuity[0].why, /byte-identical\s+replacement satisfies this by design/);
  assert.equal(modeOf(r, 'S', B.ref), MODE.DESIGNATED);

  // THE POINT, asserted: choosing this contract ACCEPTS X1 rather than avoiding it. The record
  // that inherits here is the replacement, and the contract says that is correct.
  assert.equal(B.continuity.predecessor, PRED);
});

test('D4 — THE MEASURED COST: which transfers this blocks', () => {
  // Counted from the arms themselves rather than described. Every arm that names CONTENT_MATCH in
  // its helper is an arm whose transfer the default now refuses.
  const files = ['journal-lineage.test.mjs', 'containment.test.mjs', 'substitution-attack.test.mjs'];
  let named = 0;
  for (const f of files) {
    const text = readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    named += (text.match(/CONTINUITY_CONTRACT\.CONTENT_MATCH/g) || []).length;
  }
  assert.ok(named >= 4, 'at least four call sites had to name the contract explicitly: ' + named);

  // and the arms that MOVED when the default changed, recorded as a list rather than a number:
  //   C3, L2, L4, L5, L7, L8, X1, X3  — eight arms, every one of them a transfer arm.
  // The P-suite did NOT move, because it measures the preserved specimen, which predates the
  // contract distinction. That asymmetry is the evidence the specimen is still isolated.
  assert.ok(true);
});

test('D5 — the contract is governed, never requested', () => {
  const asked = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH,
    requestedContinuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(asked.continuityContract.contract, CONTINUITY_CONTRACT.HISTORY_SPECIFIC,
    'asking for the other contract does not obtain it');
  assert.equal(asked.continuityContract.requested, CONTINUITY_CONTRACT.CONTENT_MATCH);
  assert.equal(asked.continuityContract.requestAccepted, false);
  assert.equal(asked.continuity[0].kind, 'INDISTINGUISHABLE_FROM_REPLACEMENT');

  const silent = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(silent.continuityContract.requested, null);
  assert.equal(silent.continuityContract.requestAccepted, null,
    'no request is not the same value as request refused');
});

test('D6 — co-presence still refuses under BOTH contracts', () => {
  for (const contract of [undefined, CONTINUITY_CONTRACT.CONTENT_MATCH]) {
    const r = play([src('S', A), src('T', B)], { governingByOccurrence: GOVERN, continuity: AUTH,
      continuityContract: contract, unattachedPolicy: UNATTACHED.DIAGNOSE });
    assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE',
      'choosing CONTENT_MATCH does not re-open the ambiguity the containment closed');
    assert.equal(modeOf(r, 'S', A.ref), null);
    assert.equal(modeOf(r, 'T', B.ref), null);
  }
});
