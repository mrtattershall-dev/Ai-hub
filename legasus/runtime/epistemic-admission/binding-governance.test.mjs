// G1..G5 — does an authorized obligation stay attached to its intended subject?
//
// Predictions frozen in GOVERNANCE-BINDING_PREREG.md. The subject of governance is frozen there as
// a RECORD OCCURRENCE: this record, as merged from this origin. Not a positional label, not bytes,
// not a lineage.
//
// APPARATUS REQUIREMENT, from the tenth wrong-referent instance: an identity-sensitive assertion
// checks BOTH the identifier and the object it resolves to. Every arm compares the triple
// (origin, ref, occurrence) through subjectOf(), which fails if the occurrence is missing.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, sameObligationContract,
  sameGovernedSubjects, MODE } from './merge.mjs';

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
// A consumer whose root is absent, so its fate turns entirely on its governing mode.
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
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), ...opts });

/** BOTH the identifier and the object it resolves to. Never a coordinate on its own. */
function subjectOf(result, origin, ref) {
  const o = outcomeFor(result, origin, ref);
  assert.ok(o.occurrence, 'no occurrence on the outcome for ' + origin + '/' + ref
    + ': an identity-sensitive assertion cannot be made against a coordinate alone');
  return { origin: o.origin, ref: o.ref, occurrence: o.occurrence };
}
const modeAt = (r, origin, ref) => {
  const o = outcomeFor(r, origin, ref);
  return (o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {}).mode || null;
};

// Two consumers sharing the SAME local ref, distinguishable only by which record they are.
const SHARED = 'auth:1:same';
const first = () => consumer(SHARED, 'FIRST');
const second = () => consumer(SHARED, 'SECOND');
// origins assigned BY POSITION, which is what A6 showed a careless merger may do
const byPosition = (entries) => entries.map((e, i) => src('origin-' + i, e));

test('G1 — reordering two consumers with the same local ref', () => {
  const a = first(), b = second();
  const occA = occurrenceOf('origin-0', a), occB = occurrenceOf('origin-1', b);
  assert.notEqual(occA, occB, 'they are genuinely different occurrences');

  // BY (origin, ref): the key is identical in both orders, and it lands on a different record.
  const byRecord = { '["origin-0","auth:1:same"]': MODE.DESIGNATED };
  const fwdR = play(byPosition([a, b]), { governingByRecord: byRecord });
  const revR = play(byPosition([b, a]), { governingByRecord: byRecord });
  const sFwd = subjectOf(fwdR, 'origin-0', SHARED), sRev = subjectOf(revR, 'origin-0', SHARED);
  assert.equal(sFwd.origin + '/' + sFwd.ref, sRev.origin + '/' + sRev.ref,
    'the coordinates are identical, which is exactly why comparing them alone certifies nothing');
  assert.notEqual(sFwd.occurrence, sRev.occurrence,
    'DEMONSTRATED: an unchanged governance map applied its obligation to a DIFFERENT record');
  assert.equal(modeAt(fwdR, 'origin-0', SHARED), MODE.DESIGNATED);
  assert.equal(modeAt(revR, 'origin-0', SHARED), MODE.DESIGNATED,
    'the wrong consumer was governed, and nothing in the run said so');

  // BY OCCURRENCE: an occurrence is (origin, ref, content), so a reassignment of origins does not
  // misapply the obligation - it fails to resolve it, and SAYS SO. That is the behaviour the
  // preregistration froze, and it is a SAFE FAILURE, not a following of the record.
  //
  // My first version of this assertion expected the obligation to FOLLOW a across the reorder. It
  // cannot: the origin is part of the occurrence. The frozen mechanism was right and the assertion
  // contradicted it. Recorded rather than adjusted the other way.
  const byOcc = { [occA]: MODE.DESIGNATED };
  const fwdO = play(byPosition([a, b]), { governingByOccurrence: byOcc });
  const revO = play(byPosition([b, a]), { governingByOccurrence: byOcc });
  assert.equal(modeAt(fwdO, 'origin-0', SHARED), MODE.DESIGNATED, 'a is governed at position 0');
  assert.deepEqual(fwdO.unresolvedGovernance, [], 'and the entry resolved');
  assert.equal(subjectOf(fwdO, 'origin-0', SHARED).occurrence, occA,
    'identifier AND object: the governed subject is the intended record');

  assert.equal(modeAt(revO, 'origin-0', SHARED), null, 'after the reorder b is NOT governed');
  assert.equal(modeAt(revO, 'origin-1', SHARED), null, 'and neither, now, is a');
  assert.equal(revO.unresolvedGovernance.length, 1,
    'the obligation governed NOTHING and the run says so, rather than landing on the wrong record');
  assert.equal(revO.unresolvedGovernance[0].denoting, occA);
});

test('G2 — replacing a journal while keeping its assigned label', () => {
  const original = first(), impostor = second();
  const byRecord = { '["A","auth:1:same"]': MODE.DESIGNATED };
  const before = play([src('A', original)], { governingByRecord: byRecord });
  const after = play([src('A', impostor)], { governingByRecord: byRecord });

  assert.equal(modeAt(before, 'A', SHARED), MODE.DESIGNATED);
  assert.equal(modeAt(after, 'A', SHARED), MODE.DESIGNATED,
    'DEMONSTRATED: a different record inherited the old obligation under coordinate keying');
  assert.notEqual(subjectOf(before, 'A', SHARED).occurrence,
    subjectOf(after, 'A', SHARED).occurrence, 'though it is plainly not the same record');

  // by occurrence the obligation does not transfer, and the absence is REPORTED
  const byOcc = { [occurrenceOf('A', original)]: MODE.DESIGNATED };
  const swapped = play([src('A', impostor)], { governingByOccurrence: byOcc });
  assert.equal(modeAt(swapped, 'A', SHARED), null, 'the impostor inherits nothing');
  assert.equal(swapped.unresolvedGovernance.length, 1);
  assert.equal(swapped.unresolvedGovernance[0].by, 'OCCURRENCE');
  assert.match(swapped.unresolvedGovernance[0].why, /governed nothing/);
});

test('G3 — replay under reassigned origins: the map matches, the subjects do not', () => {
  const a = first(), b = second();
  const byRecord = { '["origin-0","auth:1:same"]': MODE.DESIGNATED };
  const fwd = play(byPosition([a, b]), { governingByRecord: byRecord, obligationContractId: 'C' });
  const rev = play(byPosition([b, a]), { governingByRecord: byRecord, obligationContractId: 'C' });

  // THE SHARPEST FAILURE PREDICTED IN THE PREREGISTRATION, and it arrived: the contract
  // fingerprint digests the governance MAP, and the map is identical.
  assert.equal(sameObligationContract(fwd, rev), true,
    'the map fingerprint says these are the same contract');
  assert.equal(sameGovernedSubjects(fwd, rev), false,
    'while the subjects it landed on are demonstrably different');
  assert.notEqual(fwd.obligationContract.subjects, rev.obligationContract.subjects);

  // a genuine reproduction agrees on BOTH
  const again = play(byPosition([a, b]), { governingByRecord: byRecord, obligationContractId: 'C' });
  assert.equal(sameObligationContract(fwd, again), true);
  assert.equal(sameGovernedSubjects(fwd, again), true);
});

test('G4 — duplication redirects nothing, and identical content is not one occurrence', () => {
  const a = first();
  const copy = structuredClone(a);
  const byOcc = { [occurrenceOf('A', a)]: MODE.DESIGNATED };

  // same origin, identical content: one record (M7), governance unmoved
  const sameOrigin = play([src('A', a), src('A', copy)], { governingByOccurrence: byOcc });
  assert.equal(modeAt(sameOrigin, 'A', SHARED), MODE.DESIGNATED);
  assert.deepEqual(sameOrigin.unresolvedGovernance, []);

  // different origin, identical content: TWO occurrences. Content equality establishes neither
  // common origin nor ownership - the multiplicity run's conclusion, reached from another side.
  assert.notEqual(occurrenceOf('A', a), occurrenceOf('B', copy));
  const twoOrigins = play([src('A', a), src('B', copy)], { governingByOccurrence: byOcc });
  assert.equal(modeAt(twoOrigins, 'A', SHARED), MODE.DESIGNATED, 'the intended one is governed');
  assert.equal(modeAt(twoOrigins, 'B', SHARED), null, 'the duplicate is NOT');
  assert.notEqual(subjectOf(twoOrigins, 'A', SHARED).occurrence,
    subjectOf(twoOrigins, 'B', SHARED).occurrence);
});

test('G5 — governance denoting nothing is reported, not silently ignored', () => {
  const r = play([src('A', first()), src('B', supplier('auth:1:b'))], {
    governingByOccurrence: { ['0'.repeat(64)]: MODE.COMPLETE },
    governingByRecord: { '["Z","auth:7:nowhere"]': MODE.DESIGNATED },
  });
  assert.equal(r.unresolvedGovernance.length, 2);
  assert.deepEqual(r.unresolvedGovernance.map((u) => u.by).sort(), ['OCCURRENCE', 'RECORD']);
  for (const u of r.unresolvedGovernance) assert.ok(u.denoting, 'each names what it denoted');

  // and the run did NOT quietly become an ungoverned one that looks governed
  assert.equal(modeAt(r, 'A', SHARED), null);
  assert.match(r.unresolvedGovernance[0].why, /did not fall through to the default/);
});
