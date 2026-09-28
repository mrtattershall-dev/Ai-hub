// X1..X5 — replacement WITHOUT coexistence. Predictions frozen in SUBSTITUTION_PREREG.md.
//
// The containment detects multiple claimants in the CURRENT merged set. It cannot detect an ABSENT
// intended history. This suite removes the competing claimant and asks whether the same
// unauthorized transfer succeeds again.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, contentOf, MODE,
  UNATTACHED, CONTINUITY_CONTRACT } from './merge.mjs';
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

// THE INDEPENDENT FIXTURE IDENTITY again: which history OBJECT, not which digest.
const HISTORY = new Map();
const A = claimant();                       // authorized
const B = structuredClone(A);               // byte-identical replacement
const REVISED = claimant('REVISED');        // a replacement whose content differs
HISTORY.set(A, 'A-AUTHORIZED');
HISTORY.set(B, 'B-REPLACEMENT');
HISTORY.set(REVISED, 'REVISED-REPLACEMENT');
assert.equal(JSON.stringify(A), JSON.stringify(B), 'A and B are byte-identical');

const J = (entries) => ({ entries });
const src = (origin, e) => ({ origin, journal: J([e]) });
const GOVERN = { [PRED_OCC]: MODE.DESIGNATED };
const AUTH = { [PRED_OCC]: { successorOrigin: 'S', successorContent: contentOf(A),
  transferGovernance: true } };
// CONTRACT NOTE, disclosed rather than tuned away: the default continuity contract is now
// HISTORY_SPECIFIC, which REFUSES under today's inputs (X1, audit-x1.mjs). The arms below measure
// TRANSFER MECHANICS, so they name CONTENT_MATCH explicitly - the contract that says "whichever
// record carries exactly this content may continue", which a byte-identical replacement satisfies
// by design. Choosing it here is choosing it, not avoiding X1.
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), continuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH, ...opts });

test('X1 — THE ATTACK: remove A, present byte-identical B in its place', () => {
  // A is authorized. A is gone. B sits in A's former position. The authorization is unchanged.
  const r = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH });

  // exactly one claimant carries the authorized content - the shape C3 permits
  assert.equal(r.continuity.length, 1);
  assert.equal(r.continuity[0].kind, 'CONTINUED',
    'PREDICTED AND CONFIRMED: the containment never fires, because there is no co-presence');
  assert.equal(r.continuity[0].successor.origin, 'S');
  assert.equal(r.continuity[0].transferGovernance, true);

  // and the governance of the ABSENT history attached to the replacement
  assert.equal(r.ok, true, r.why);
  const o = outcomeFor(r, 'S', B.ref);
  const ob = o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {};
  assert.equal(ob.mode, MODE.DESIGNATED);
  assert.equal(ob.governedBy, 'GOVERNING_BY_AUTHORIZED_CONTINUITY');
  assert.deepEqual(r.unresolvedGovernance, [],
    'nothing is reported: the run believes it attached correctly, to a history that is not here');

  // the fixture identity says which object it actually was
  assert.equal(HISTORY.get(B), 'B-REPLACEMENT',
    'the obligation of A was transferred to B, and no input distinguishes them');
});

test('X2 — content control: a sole claimant whose content differs is still refused', () => {
  const r = play([src('S', REVISED)], { governingByOccurrence: GOVERN, continuity: AUTH,
    unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.continuity[0].kind, 'UNAUTHORIZED');
  assert.match(r.continuity[0].why, /Identifying a predecessor is not being authorized/);
  assert.equal(r.unresolvedGovernance.length, 1, 'and the obligation does not attach');
  // the content-change protection is untouched by any of this
});

test('X3 — the scope of the containment, as measured', () => {
  // co-present duplicates: refused
  const coPresent = play([src('S', A), src('T', B)],
    { governingByOccurrence: GOVERN, continuity: AUTH, unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(coPresent.continuity[0].kind, 'INDISTINGUISHABLE');

  // the SAME authorization, the SAME content, one claimant removed: allowed
  const sole = play([src('S', B)], { governingByOccurrence: GOVERN, continuity: AUTH });
  assert.equal(sole.continuity[0].kind, 'CONTINUED');

  // THE STATEMENT THIS SUITE ESTABLISHES, asserted so it cannot drift:
  //   transfer is refused when MULTIPLE PRESENTED claimants carry the authorized content;
  //   substitution by a SOLE byte-identical claimant is NOT prevented.
  assert.notEqual(coPresent.continuity[0].kind, sole.continuity[0].kind,
    'removing the competing claimant changes a refusal into a transfer, with nothing else changed');
});

test('X4 — the specimen survives relocation and still exhibits the failure', () => {
  const merged = merge([src('origin-0', B), src('origin-1', A)]).merged;
  const auth = { [PRED_OCC]: { successorOrigin: 'origin-0', successorContent: contentOf(A),
    transferGovernance: true } };
  const spec = resolveContinuityUNCONTAINED(merged, auth);
  assert.equal(spec[0].kind, 'CONTINUED', 'the preserved defect still behaves as the defect');
  assert.equal(spec[0].successor.origin, 'origin-0');

  // and it is still injectable, so P1..P5 measure it end to end
  const viaInjection = replayMergedForTests(merge([src('origin-0', B), src('origin-1', A)]).merged,
    { authorityStore: store(), governingByOccurrence: GOVERN, continuity: auth,
      unattachedPolicy: UNATTACHED.DIAGNOSE }, resolveContinuityUNCONTAINED);
  assert.equal(viaInjection.continuity[0].kind, 'CONTINUED');
});

test('X6 — resolver injection is not on the production call surface', () => {
  // ADDED after a correction: replacing the magic flag with a caller-supplied `continuityResolver`
  // option did NOT remove the bypass capability. A caller who can inject the function that DECIDES
  // continuity can replace the check. Injection now belongs to the trusted runtime-author boundary
  // and lives in _test-entry.mjs; replayMerged PINS the contained resolver.
  const merged = merge([src('origin-0', B), src('origin-1', A)]).merged;
  const auth = { [PRED_OCC]: { successorOrigin: 'origin-0', successorContent: contentOf(A),
    transferGovernance: true } };
  const viaProduction = replayMerged(merged, { authorityStore: store(),
    governingByOccurrence: GOVERN, continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE,
    continuityResolver: resolveContinuityUNCONTAINED });
  assert.equal(viaProduction.continuity[0].kind, 'INDISTINGUISHABLE',
    'the production entry point ignores a supplied resolver and uses the contained one');

  // the testing entry point demands one explicitly and refuses to be used as a general shortcut
  assert.throws(() => replayMergedForTests(merged, { authorityStore: store() }),
    /requires an explicit resolver/);

  // STATED LIMIT, not softened: this moves the capability behind a boundary. In JavaScript a bypass
  // that exists is callable by anyone who imports it - X4 imports it deliberately.
});

test('X5 — the old flag is gone from the production options surface', () => {
  const merged = merge([src('origin-0', B), src('origin-1', A)]).merged;
  const auth = { [PRED_OCC]: { successorOrigin: 'origin-0', successorContent: contentOf(A),
    transferGovernance: true } };
  const r = replayMerged(merged, { authorityStore: store(), governingByOccurrence: GOVERN,
    continuity: auth, unattachedPolicy: UNATTACHED.DIAGNOSE,
    __specimenUncontainedContinuity: 'YES-I-WANT-THE-KNOWN-DEFECT' });
  assert.equal(r.continuity[0].kind, 'INDISTINGUISHABLE',
    'the old magic string has no effect: the contained resolver ran');
  // STATED LIMIT: this removes the defect from the options surface. It does not make the specimen
  // unreachable - X4 reaches it by importing it, and in JavaScript any bypass that exists is
  // callable by anyone who imports it.
});
