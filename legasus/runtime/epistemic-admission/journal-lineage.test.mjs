// L1..L8 — who may establish continuity, and does continuity carry governance with it?
//
// Predictions frozen in JOURNAL-LINEAGE_PREREG.md. Three permissions, deliberately separate:
// identify a predecessor, authorize a successor, transfer governance.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, occurrenceOf, contentOf, MODE,
  UNATTACHED } from './merge.mjs';

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

// The predecessor, and a successor that IDENTIFIES it. The assertion is data in the journal.
const PRED = consumer('auth:2:a', 'V1');
const OCC_PRED = occurrenceOf('P', PRED);
function successorOf(predOcc, tag) {
  const e = consumer('auth:2:a', tag || 'V1');
  e.continuity = { predecessor: predOcc, content: contentOf(PRED) };
  return e;
}
const GOVERN = { [OCC_PRED]: MODE.DESIGNATED };

function child(sources, opts) {
  const dir = mkdtempSync(join(tmpdir(), 'legasus-lineage-'));
  const path = join(dir, 'case.json');
  writeFileSync(path, JSON.stringify({ sources, opts }), 'utf8');
  return JSON.parse(execFileSync(process.execPath,
    [new URL('./lineage-child.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), path],
    { encoding: 'utf8' }));
}
// An outcome carries its obligation on the supply entry when it resolved, on the outcome itself
// when it was blocked BY an obligation, and NOWHERE AT ALL when nothing governed it and it was
// blocked for an unrelated reason. All three are read through one helper, so "ungoverned" is a
// value rather than a crash.
const obligationOf = (o) => o.obligation
  || (o.supply && o.supply[0] && o.supply[0].obligation) || null;
const modeOf = (o) => (obligationOf(o) || {}).mode || null;
const basisOf = (o) => (obligationOf(o) || {}).governedBy || null;

const at = (c, origin, ref) => {
  const o = c.outcomes.find((x) => x.origin === origin && x.ref === ref);
  assert.ok(o, 'no outcome for ' + origin + '/' + ref + ' among '
    + c.outcomes.map((x) => x.origin + '/' + x.ref).join(', '));
  return o;
};

test('L1 — identifying a predecessor is not being authorized to continue it', () => {
  const s = successorOf(OCC_PRED);
  // the journal asserts continuity; the governor authorized nothing
  const r = run([src('S', s), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN, unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(r.continuity.length, 0, 'no authorization means no continuity finding to report');
  assert.equal(r.unresolvedGovernance.length, 1,
    'and the obligation is unattached, which the frozen default would invalidate on');
  const o = outcomeFor(r, 'S', 'auth:2:a');
  assert.equal(modeOf(o), null, 'the successor inherits NOTHING by asserting a predecessor');
  assert.notEqual(basisOf(o), 'GOVERNING_BY_AUTHORIZED_CONTINUITY');
});

test('L2 — authorized continuity preserves the obligation across reordered inputs, cross-process', () => {
  const s = successorOf(OCC_PRED);
  const x = src('X', supplier('auth:1:x')), S = src('S', s);
  const opts = { governingByOccurrence: GOVERN,
    continuity: { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s),
      transferGovernance: true } } };

  for (const sources of [[S, x], [x, S]]) {
    const c = child(sources, opts);
    assert.notEqual(c.pid, process.pid, 'it really was another process');
    assert.equal(c.ok, true, c.why);
    assert.deepEqual(c.unresolvedGovernance, [], 'the obligation attached, via continuity');
    assert.equal(c.continuity[0].kind, 'CONTINUED');
    assert.equal(c.continuity[0].transferGovernance, true);
    const o = at(c, 'S', 'auth:2:a');
    assert.equal(o.mode, MODE.DESIGNATED, 'the intended obligation is preserved');
    assert.equal(o.governedBy, 'GOVERNING_BY_AUTHORIZED_CONTINUITY');
    assert.equal(o.occurrence, occurrenceOf('S', s),
      'identifier AND object: it attached to the successor occurrence itself');
  }

  // NECESSITY CONTROL: without the authorization the same journals do not inherit.
  const bare = child([S, x], { governingByOccurrence: GOVERN });
  assert.equal(bare.ok, false, 'and the frozen INVALIDATE default refuses rather than proceeding');
});

test('L3 — a replacement copying every label and assertion inherits nothing, cross-process', () => {
  const s = successorOf(OCC_PRED);
  const authorized = { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s),
    transferGovernance: true } };

  // The impostor copies the ref, the continuity assertion and the origin label. What it cannot copy
  // is the authorizing basis: the governor named THIS content under THIS merger-assigned origin.
  const impostor = successorOf(OCC_PRED, 'V2-REVISED');
  impostor.ref = s.ref;
  impostor.continuity = JSON.parse(JSON.stringify(s.continuity));
  assert.deepEqual(impostor.continuity, s.continuity, 'every serialized label is copied');
  assert.notEqual(contentOf(impostor), contentOf(s), 'but it is not the authorized content');

  const c = child([src('S', impostor), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN, continuity: authorized });
  assert.equal(c.ok, false, 'the run refuses rather than admitting an ungoverned successor');
  assert.equal(c.continuity[0].kind, 'UNAUTHORIZED');
  assert.match(c.continuity[0].why, /Identifying a predecessor is not being authorized/);
  assert.equal(c.unresolvedGovernance.length, 1, 'the obligation never attached');
  assert.deepEqual(c.outcomes, [], 'and nothing was admitted');

  // under an authorized diagnosis the impostor is visibly UNGOVERNED rather than inheriting
  const d = child([src('S', impostor), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN, continuity: authorized,
      unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(at(d, 'S', s.ref).mode, null, 'it inherits no obligation');
  assert.notEqual(at(d, 'S', s.ref).governedBy, 'GOVERNING_BY_AUTHORIZED_CONTINUITY');
});

test('L4 — a revision is covered only if the authorization names the new content', () => {
  const revised = successorOf(OCC_PRED, 'V2');
  const stale = { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(successorOf(OCC_PRED)),
    transferGovernance: true } };
  const notCovered = run([src('S', revised)],
    { governingByOccurrence: GOVERN, continuity: stale, unattachedPolicy: UNATTACHED.DIAGNOSE });
  assert.equal(notCovered.continuity[0].kind, 'UNAUTHORIZED');
  assert.equal(notCovered.unresolvedGovernance.length, 1,
    'an authorization for the old content does not reach the revision');

  const named = { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(revised),
    transferGovernance: true } };
  const covered = run([src('S', revised)],
    { governingByOccurrence: GOVERN, continuity: named });
  assert.equal(covered.continuity[0].kind, 'CONTINUED');
  assert.deepEqual(covered.unresolvedGovernance, []);
  assert.equal(modeOf(outcomeFor(covered, 'S', revised.ref)), MODE.DESIGNATED,
    'and only then does the obligation cover it');
});

test('L5 — a fork: neither inherits, and insertion order does not decide', () => {
  // FIRST, A FINDING THAT NARROWS THE ARM. Naming the successor ORIGIN in the authorization means a
  // claimant merged under any other origin creates no ambiguity at all - it simply does not qualify.
  const s1 = successorOf(OCC_PRED);
  const elsewhere = successorOf(OCC_PRED);
  const auth = { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s1),
    transferGovernance: true } };
  const notAFork = run([src('S', s1), src('S2', elsewhere)],
    { governingByOccurrence: GOVERN, continuity: auth });
  assert.equal(notAFork.continuity[0].kind, 'CONTINUED',
    'a claimant in another origin is not a competing successor');

  // AND THE SECOND FINDING, recorded rather than fixtured around: within ONE origin, two records
  // that both satisfy one authorized content ARE NOT CONSTRUCTIBLE through the public merge path.
  // Content includes the ref, and merge collapses byte-identical entries under one origin (M7), so
  // two distinct records under one origin necessarily differ in content. The fork the
  // preregistration anticipated cannot arise from journals as this contract defines them.
  const twin = structuredClone(s1);
  twin.ref = 'auth:2:twin';
  assert.notEqual(contentOf(twin), contentOf(s1),
    'distinct records under one origin cannot share one authorized content');

  // The refusal path still exists and must behave, so it is exercised against a DIRECTLY
  // CONSTRUCTED merged set - labelled as synthetic, and not presented as a natural fixture.
  const entry = { ref: 'a', continuity: { predecessor: OCC_PRED } };
  const synthetic = (reversed) => {
    const recs = [
      { origin: 'S', ref: 'a', occurrence: 'occ-a', entry },
      { origin: 'S', ref: 'b', occurrence: 'occ-b', entry },
    ];
    return replayMerged({ records: reversed ? recs.reverse() : recs },
      { authorityStore: store(),
        continuity: { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(entry),
          transferGovernance: true } } });
  };
  const fwd = synthetic(false), rev = synthetic(true);   // reverse() mutates; each call rebuilds
  assert.equal(fwd.ok, false, 'a fork refuses');
  assert.match(fwd.why, /NEITHER inherits/);
  assert.match(fwd.why, /not resolved by insertion order/);
  assert.deepEqual(fwd.outcomes, [], 'and nothing is admitted');
  assert.equal(fwd.why, rev.why, 'the refusal is identical under both orders');
});

test('L6 — identical content in separate histories is two histories', () => {
  const s = successorOf(OCC_PRED);
  const copy = structuredClone(s);
  const auth = { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s),
    transferGovernance: true } };
  const r = run([src('S', s), src('T', copy), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN, continuity: auth });
  assert.equal(r.continuity[0].kind, 'CONTINUED');
  assert.equal(r.continuity[0].successor.origin, 'S', 'the authorized origin, not the copy');
  assert.notEqual(occurrenceOf('S', s), occurrenceOf('T', copy),
    'equality alone merges nothing: two occurrences, two histories');

  assert.equal(modeOf(outcomeFor(r, 'S', s.ref)), MODE.DESIGNATED, 'the authorized one is governed');
  assert.equal(modeOf(outcomeFor(r, 'T', copy.ref)), null,
    'and the byte-identical copy inherits nothing by being identical');
  assert.notEqual(basisOf(outcomeFor(r, 'T', copy.ref)), 'GOVERNING_BY_AUTHORIZED_CONTINUITY');
});

test('L7 — continuity without governance transfer: the permissions are separable', () => {
  const s = successorOf(OCC_PRED);
  const r = run([src('S', s), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN,
      continuity: { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s),
        transferGovernance: false } },
      unattachedPolicy: UNATTACHED.DIAGNOSE });

  assert.equal(r.continuity[0].kind, 'CONTINUED', 'the history IS continued');
  assert.equal(r.continuity[0].transferGovernance, false);
  assert.match(r.continuity[0].why, /different permissions/);
  assert.equal(modeOf(outcomeFor(r, 'S', s.ref)), null,
    'and the successor inherits NO obligation');
  assert.equal(r.unresolvedGovernance.length, 1,
    'the predecessor obligation remains unattached, and says so');

  // the same journals WITH the transfer permission do inherit: the difference is the permission
  const withTransfer = run([src('S', s), src('X', supplier('auth:1:x'))],
    { governingByOccurrence: GOVERN,
      continuity: { [OCC_PRED]: { successorOrigin: 'S', successorContent: contentOf(s),
        transferGovernance: true } } });
  assert.equal(modeOf(outcomeFor(withTransfer, 'S', s.ref)), MODE.DESIGNATED);
});

test('L8 — a continuity authorization whose predecessor is absent is unattached governance', () => {
  const s = successorOf('0'.repeat(64));
  const r = run([src('S', s)], {
    governingByOccurrence: { ['0'.repeat(64)]: MODE.DESIGNATED },
    continuity: { ['0'.repeat(64)]: { successorOrigin: 'S', successorContent: contentOf(s),
      transferGovernance: true } },
  });
  // the successor IS authorized and the transfer IS permitted, so governance attaches to it:
  // the predecessor being absent from the merged set does not by itself break the chain.
  assert.equal(r.continuity[0].kind, 'CONTINUED');
  assert.equal(r.ok, true, r.why);
  assert.equal(modeOf(outcomeFor(r, 'S', s.ref)), MODE.DESIGNATED);
  assert.equal(basisOf(outcomeFor(r, 'S', s.ref)), 'GOVERNING_BY_AUTHORIZED_CONTINUITY');

  // but WITHOUT the transfer permission the same absent predecessor is simply unattached
  const noTransfer = run([src('S', s)], {
    governingByOccurrence: { ['0'.repeat(64)]: MODE.DESIGNATED },
    continuity: { ['0'.repeat(64)]: { successorOrigin: 'S', successorContent: contentOf(s),
      transferGovernance: false } },
  });
  assert.equal(noTransfer.ok, false, 'and the frozen INVALIDATE default applies');
  assert.match(noTransfer.why, /governance did not attach/);
});
