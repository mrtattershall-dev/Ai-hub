// C1..C5 — containing the positional misattachment P2 demonstrated.
//
// Predictions frozen in CONTAINMENT_PREREG.md. This CONTAINS a known failure; it does not solve it.
// The missing input P5 named is still missing, and no identifier is invented here.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, resolveContinuity, occurrenceOf,
  contentOf, MODE, UNATTACHED, CONTINUITY_CONTRACT } from './merge.mjs';
import { resolveContinuityUNCONTAINED } from './_specimen-support.mjs';
import { replayMergedForTests } from './_test-entry.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function consumerEntry(ref, tag) {
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
const PRED_OCC = occurrenceOf('P', consumerEntry('auth:2:a'));
function claimant(tag) {
  const e = consumerEntry('auth:2:a', tag);
  e.continuity = { predecessor: PRED_OCC, content: 'irrelevant-here' };
  return e;
}
const TEMPLATE = claimant();
const A = TEMPLATE, B = structuredClone(TEMPLATE);        // byte-identical, two histories
const SOLE = claimant('DISTINCT');                        // different content

const J = (entries) => ({ entries });
const src = (origin, e) => ({ origin, journal: J([e]) });
const GOVERN = { [PRED_OCC]: MODE.DESIGNATED };
const authFor = (origin, entry) => ({ [PRED_OCC]: { successorOrigin: origin,
  successorContent: contentOf(entry), transferGovernance: true } });
// CONTRACT NOTE, disclosed rather than tuned away: the default continuity contract is now
// HISTORY_SPECIFIC, which REFUSES under today's inputs (X1, audit-x1.mjs). The arms below measure
// TRANSFER MECHANICS, so they name CONTENT_MATCH explicitly - the contract that says "whichever
// record carries exactly this content may continue", which a byte-identical replacement satisfies
// by design. Choosing it here is choosing it, not avoiding X1.
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), continuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH, ...opts });

test('C1 — two claimants at the authorized content: the transfer is refused, both orders alike', () => {
  const auth = authFor('origin-0', A);
  const fwd = play([src('origin-0', A), src('origin-1', B)],
    { governingByOccurrence: GOVERN, continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE });
  const rev = play([src('origin-0', B), src('origin-1', A)],
    { governingByOccurrence: GOVERN, continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE });

  for (const r of [fwd, rev]) {
    assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE', r.continuity[0].why);
    assert.equal(r.continuity[0].ok, false);
    assert.match(r.continuity[0].why, /MERGER-ASSIGNED ORIGIN selects between them/);
    assert.match(r.continuity[0].why, /CONTAINS a demonstrated misattachment; it does not solve it/);
    assert.equal(r.unresolvedGovernance.length, 1, 'and no obligation attaches to anything');
  }
  assert.equal(fwd.continuity[0].why, rev.continuity[0].why, 'identical under both orders');

  // The claimant LIST is sorted, not input-ordered. Added after a mutant that removed the sort
  // survived the first version of this arm: both runs above list the same origins in the same
  // sequence, so only a permuted SOURCE order exercises it. Same lesson as M10 - a refusal path can
  // exist and never be reached by the arms that were supposed to cover it.
  const permuted = play([src('origin-1', A), src('origin-0', B)],
    { governingByOccurrence: GOVERN, continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.deepEqual(permuted.continuity[0].claimants, fwd.continuity[0].claimants,
    'the claimant list does not move with the order the sources were passed in');
});

test('C2 — THE ACCEPTED COST: a legitimate transfer is refused too', () => {
  // Stable, hand-chosen origin labels. The governor genuinely intended this transfer. It is refused,
  // because the inputs cannot distinguish the intended history from its byte-identical twin.
  const r = play([src('S', A), src('T', B)],
    { governingByOccurrence: GOVERN, continuity: authFor('S', A),
      unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE');
  assert.equal(r.unresolvedGovernance.length, 1, 'the intended obligation does not attach');

  // and the SPECIMEN shows what was given up: it would have transferred, to one of them
  const spec = replayMergedForTests(merge([src('S', A), src('T', B)]).merged,
    { authorityStore: store(), governingByOccurrence: GOVERN, continuity: authFor('S', A),
      unattachedPolicy: UNATTACHED.DIAGNOSE }, resolveContinuityUNCONTAINED);
  assert.equal(spec.continuity[0].kind, 'CONTINUED',
    'the cost is real: this transfer used to succeed, and the sacrifice is recorded not hidden');
});

test('C3 — the capability survives: one claimant at the authorized content still transfers', () => {
  const r = play([src('S', SOLE), src('T', B)],
    { governingByOccurrence: GOVERN, continuity: authFor('S', SOLE) });
  assert.equal(r.ok, true, r.why);
  assert.equal(r.continuity[0].kind, 'CONTINUED',
    'containment must not be a disguised removal of the feature');
  assert.equal(r.continuity[0].transferGovernance, true);
  assert.notEqual(contentOf(SOLE), contentOf(B), 'and the other claimant is not at that content');
});

test('C4 — the specimen is intact, and the live path does not take it', () => {
  const merged = merge([src('origin-0', B), src('origin-1', A)]).merged;
  const auth = authFor('origin-0', A);

  // the specimen still exhibits P2's failure when called directly
  const spec = resolveContinuityUNCONTAINED(merged, auth);
  assert.equal(spec[0].kind, 'CONTINUED', 'the preserved defect still behaves as the defect');
  assert.equal(spec[0].successor.origin, 'origin-0',
    'selecting whichever history landed in the authorized slot');

  // and the contained function, on the same inputs, does not
  const contained = resolveContinuity(merged, auth);
  assert.equal(contained[0].kind, 'INDISTINGUISHABLE');

  // the live default goes through the contained one
  const live = play([src('origin-0', B), src('origin-1', A)],
    { governingByOccurrence: GOVERN, continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(live.continuity[0].kind, 'INDISTINGUISHABLE',
    'the escape hatch is not reachable without naming it');
});

test('C5 — the refusal is consequential, not a diagnostic', () => {
  // under the frozen INVALIDATE default the refused transfer leaves the obligation unattached and
  // the whole run refuses. Containment is not a note in a report.
  const r = play([src('origin-0', A), src('origin-1', B)],
    { governingByOccurrence: GOVERN, continuity: authFor('origin-0', A) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.outcomes, [], 'no admissions at all');
  assert.match(r.why, /governance did not attach/);
  assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE');
});
