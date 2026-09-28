// M1..M9 — can two individually valid histories produce an authority NEITHER history justified?
//
// Predictions frozen in MERGE_PREREG.md before merge.mjs existed.
//
// APPARATUS REQUIREMENT, from the seventh wrong-referent defect: every assertion names the record
// whose outcome it measures, through outcomeFor(result, origin, ref), which THROWS if that record
// was never produced. No index reads, no [length - 1], no optional find().
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, locateIn, replayMerged, outcomeFor } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2'), REL = load('REL'), ORD = load('ORD');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');
const NEED = relationClaim('COVERAGE', cov(ORD2).subject, cov(ORD2).object);

// A retargeted relation certificate: same evidence, a different relation instance. Used to make two
// origins carry DIFFERENT records, so a capture across origins would be visible.
function relFor(subject) {
  const c = structuredClone(REL2);
  const p = relationClaim('COVERAGE', subject, 'SAMPLE');
  c.requested_claim.predicate = p;
  c.licensed_claim.predicate = p;
  return c;
}

// One history, produced exactly the way the natural-relation run produced it, then re-addressed so
// two histories can be made to collide deliberately.
function history({ rel = REL2, ord = ORD2, mutate = (c) => c, relRef, ordRef } = {}) {
  const st = store();
  const r = mutate(structuredClone(rel));
  admit(r, { authorityStore: st });
  const relOut = adapt(r, { authorityStore: st });
  const entries = [];
  let liveRelRef = null;
  if (relOut.token) {
    const filed = st.admitToken(relOut.token, { fromCertificate: r.provenance.run_id });
    liveRelRef = filed.ref;
    const e = journalEntry({ ref: liveRelRef, store: st, certificate: r, consumed: [] }).entry;
    e.ref = relRef || e.ref;
    entries.push(e);
  }
  const o = structuredClone(ord);
  const w = cov(o);
  if (liveRelRef) w.evidence_root = liveRelRef;
  const ordOut = adapt(o, { authorityStore: st });
  if (ordOut.token) {
    const filed = st.admitToken(ordOut.token, { fromCertificate: o.provenance.run_id });
    const e = journalEntry({ ref: filed.ref, store: st, certificate: o,
      consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object,
        ref: relRef || liveRelRef }] }).entry;
    e.ref = ordRef || e.ref;
    entries.push(e);
  }
  return { entries, relRef: relRef || liveRelRef, ordRef: ordRef || (entries[1] && entries[1].ref) };
}

const J = (entries) => ({ entries });
const semantic = (r) => (r.outcomes || []).map((o) => [o.origin, o.ref, o.state, o.minted,
  (o.bound || []).join(','), (o.supply || []).map((s) => s.origin + '/' + s.by).join(',')].join('|'))
  .sort();

test('M1 — merging adds available records and produces no authority', () => {
  const a = history({ relRef: 'auth:1:aaa', ordRef: 'auth:2:aaa' });
  const b = history({ relRef: 'auth:1:bbb', ordRef: 'auth:2:bbb' });
  const m = merge([{ origin: 'A', journal: J(a.entries) }, { origin: 'B', journal: J(b.entries) }]);
  assert.equal(m.ok, true, m.why);
  assert.deepEqual(m.ambiguities, [], 'distinct origins are not a conflict');
  assert.equal(m.merged.records.length, 4);

  // locatable, and by shape incapable of returning authority
  for (const [origin, ref] of [['A', a.relRef], ['A', a.ordRef], ['B', b.relRef], ['B', b.ordRef]]) {
    const l = locateIn(m.merged, origin, ref);
    assert.equal(l.ok, true, origin + '/' + ref + ' must stay locatable');
    assert.equal(Object.prototype.hasOwnProperty.call(l, 'token'), false);
  }
  // an address from another origin is a DIFFERENT address
  assert.equal(locateIn(m.merged, 'A', b.relRef).ok, false);
  // and merging touched no store at all
  assert.equal(JSON.stringify(m).includes('auth:'), true, 'refs are data here');
  assert.equal(typeof m.merged.records[0].entry.evidence, 'object', 'evidence, not tokens');
});

test('M2 — disjoint histories replay with their ORIGINAL dependency relationships', () => {
  const a = history({ relRef: 'auth:1:aaa', ordRef: 'auth:2:aaa' });
  const b = history({ relRef: 'auth:1:bbb', ordRef: 'auth:2:bbb' });
  const m = merge([{ origin: 'A', journal: J(a.entries) }, { origin: 'B', journal: J(b.entries) }]);
  const r = replayMerged(m.merged, { authorityStore: store() });
  for (const [origin, h] of [['A', a], ['B', b]]) {
    assert.equal(outcomeFor(r, origin, h.relRef).state, STATE.ESTABLISHED);
    const o = outcomeFor(r, origin, h.ordRef);
    assert.equal(o.state, STATE.ESTABLISHED, o.why);
    assert.deepEqual(o.bound, ['COVERAGE']);
    assert.deepEqual(o.supply.map((s) => s.origin + '/' + s.by), [origin + '/REFERENCE'],
      'each consumer rests on ITS OWN history, by reference, not on the other one');
  }
});

test('M3 — same address in different origins: neither captures the other references', () => {
  const COLLIDE = 'auth:1:same';        // the address EVERY process issues first
  const a = history({ relRef: COLLIDE, ordRef: 'auth:2:aaa' });
  // B files a DIFFERENT relation under the SAME address string
  const bRel = relFor('beta-subject');
  const b = history({ rel: bRel, ord: ORD2, relRef: COLLIDE, ordRef: 'auth:2:bbb' });
  assert.equal(b.entries.length, 1, 'B has no consumer: beta does not satisfy ORD2 witness');

  const A = { origin: 'A', journal: J(a.entries) }, B = { origin: 'B', journal: J(b.entries) };
  const m = merge([A, B]);
  assert.deepEqual(m.ambiguities, [], 'the same string under two origins is NOT a conflict');
  assert.notEqual(locateIn(m.merged, 'A', COLLIDE).record.claim,
    locateIn(m.merged, 'B', COLLIDE).record.claim, 'they are genuinely different records');

  // BOTH INPUT ORDERS. The first version of this arm only ran [A, B], where A consumer happens to
  // be reached before B record is processed at all - so a merger that dropped the origin from its
  // key passed it. Order-luck is not a refusal. Disclosed in MERGE_RESULT.md.
  for (const sources of [[A, B], [B, A]]) {
    const r = replayMerged(merge(sources).merged, { authorityStore: store() });
    const o = outcomeFor(r, 'A', a.ordRef);
    assert.equal(o.state, STATE.ESTABLISHED, o.why);
    assert.deepEqual(o.supply.map((x) => x.origin + '/' + x.ref + '/' + x.by),
      ['A/' + COLLIDE + '/REFERENCE'],
      'A resolved ITS OWN address, not B record filed under the same string');
    const bRec = outcomeFor(r, 'B', COLLIDE);
    assert.equal(bRec.state, STATE.ESTABLISHED, 'B record is fine on its own terms');
    assert.notEqual(bRec.newRef, outcomeFor(r, 'A', COLLIDE).newRef,
      'and the two same-named records are two different authorities');
    for (const x of r.outcomes) {
      for (const sup of x.supply || []) {
        if (sup.by === 'REFERENCE') {
          assert.equal(sup.origin, x.origin, 'a REFERENCE never crosses an origin: ' + x.ref);
        }
      }
    }
  }
});

test('M4 — conflicting records under ONE identity: reported, never selected', () => {
  const a = history({ relRef: 'auth:1:x', ordRef: 'auth:2:x' });
  const other = history({ rel: relFor('gamma-subject'), relRef: 'auth:1:x' });
  // both journals handed the SAME origin by a careless merger
  const m = merge([{ origin: 'SAME', journal: J(a.entries) },
    { origin: 'SAME', journal: J(other.entries) }]);
  assert.equal(m.ok, true);
  assert.equal(m.ambiguities.length, 1, 'the collision is reported');
  assert.equal(m.ambiguities[0].ref, 'auth:1:x');
  assert.match(m.ambiguities[0].why, /first-wins and last-wins are both a merger deciding/);

  assert.equal(locateIn(m.merged, 'SAME', 'auth:1:x').ok, false, 'and it cannot be located either');
  const r = replayMerged(m.merged, { authorityStore: store() });
  const amb = outcomeFor(r, 'SAME', 'auth:1:x');
  assert.equal(amb.minted, false);
  assert.equal(amb.state, STATE.UNRESOLVED);
  // the consumer that pointed at that identity gets nothing, rather than one of the two candidates
  const con = outcomeFor(r, 'SAME', 'auth:2:x');
  assert.notEqual(con.state, STATE.ESTABLISHED);
  assert.deepEqual(con.bound || [], []);
});

test('M5 — a dependency supplied by the other journal, with its control', () => {
  // A is a consumer whose root is NOT in A. On its own it is open.
  const full = history({ relRef: 'auth:1:a', ordRef: 'auth:2:a' });
  const aOnly = J([full.entries[1]]);
  const before = replayMerged(merge([{ origin: 'A', journal: aOnly }]).merged,
    { authorityStore: store() });
  const wasOpen = outcomeFor(before, 'A', 'auth:2:a');
  assert.equal(wasOpen.state, STATE.FRONTIER_OPEN, '(a) it was NOT available before');

  // B supplies a record that independently establishes exactly the needed claim.
  const b = history({ relRef: 'auth:1:b' });
  const m = merge([{ origin: 'A', journal: aOnly }, { origin: 'B', journal: J([b.entries[0]]) }]);
  const after = replayMerged(m.merged, { authorityStore: store() });
  assert.equal(outcomeFor(after, 'B', 'auth:1:b').state, STATE.ESTABLISHED,
    '(b) the supplied record independently admits on its own evidence');
  const now = outcomeFor(after, 'A', 'auth:2:a');
  assert.equal(now.state, STATE.ESTABLISHED, now.why);
  assert.deepEqual(now.bound, ['COVERAGE']);
  assert.deepEqual(now.supply.map((s) => s.origin + '/' + s.by + '/' + s.claim),
    ['B/CLAIM/' + NEED], '(c) and the new establishment TRACES to that record, by claim');

  // THE CONTROL, which is the load-bearing half: a supplied record that does not admit supplies
  // nothing. Without this, the arm cannot tell conservation from a merger that closes things.
  const bad = history({ relRef: 'auth:1:b',
    mutate: (c) => { c.measurement.observation.evidential_force = false; return c; } });
  assert.equal(bad.entries.length, 0, 'it never minted, so it was never even journaled');
  const m2 = merge([{ origin: 'A', journal: aOnly },
    { origin: 'B', journal: J([{ ...b.entries[0],
      evidence: { ...structuredClone(b.entries[0].evidence),
        measurement: { ...structuredClone(b.entries[0].evidence.measurement),
          observation: { ...structuredClone(b.entries[0].evidence.measurement.observation),
            evidential_force: false } } } }]) }]);
  const after2 = replayMerged(m2.merged, { authorityStore: store() });
  assert.notEqual(outcomeFor(after2, 'B', 'auth:1:b').state, STATE.ESTABLISHED);
  const still = outcomeFor(after2, 'A', 'auth:2:a');
  assert.equal(still.state, STATE.FRONTIER_OPEN, 'an inadmissible record supplies nothing');
  assert.deepEqual(still.bound || [], []);

  // CONTROL 2, and the sharper one: a record that DOES mint a token carrying exactly the needed
  // claim, while its request is NOT established (licensed_relation NONE -> CANDIDATE). A supplier
  // chosen by "a token exists with the right claim" would hand this over. Added after control 1
  // was shown not to sense that defect; disclosed in MERGE_RESULT.md.
  const cand = structuredClone(b.entries[0]);
  cand.evidence.licensed_claim = null;
  cand.evidence.licensed_relation = 'NONE';
  const m3 = merge([{ origin: 'A', journal: aOnly },
    { origin: 'B', journal: J([cand]) }]);
  const after3 = replayMerged(m3.merged, { authorityStore: store() });
  const bCand = outcomeFor(after3, 'B', 'auth:1:b');
  assert.equal(bCand.minted, true, 'a token really was minted');
  assert.equal(bCand.state, STATE.CANDIDATE, 'but the claim is NOT established: ' + bCand.why);
  const still2 = outcomeFor(after3, 'A', 'auth:2:a');
  assert.equal(still2.state, STATE.FRONTIER_OPEN,
    'a minted token whose claim is unestablished supplies nothing either');
  assert.deepEqual(still2.bound || [], []);
});

test('M6 — two open histories cannot bootstrap one another', () => {
  const mkOpen = (mine, theirs, myRef, theirRef) => {
    const c = relFor(mine);
    return { ref: myRef, record: { claim: relationClaim('COVERAGE', mine, 'SAMPLE'),
      constructor: 'DERIVE', context: {}, ancestry: [], fromCertificate: myRef },
    evidence: c,
    consumed: [{ relation: 'COVERAGE', subject: theirs, object: 'SAMPLE', ref: theirRef }] };
  };
  const m = merge([
    { origin: 'A', journal: J([mkOpen('alpha', 'beta', 'auth:1:a', 'auth:1:b')]) },
    { origin: 'B', journal: J([mkOpen('beta', 'alpha', 'auth:1:b', 'auth:1:a')]) }]);
  const r = replayMerged(m.merged, { authorityStore: store() });
  for (const [origin, ref] of [['A', 'auth:1:a'], ['B', 'auth:1:b']]) {
    const o = outcomeFor(r, origin, ref);
    assert.equal(o.minted, false, origin + ' must not mint: ' + o.why);
    assert.notEqual(o.state, STATE.ESTABLISHED);
  }
});

test('M7 — input order and duplication preserve semantic outcomes', () => {
  const a = history({ relRef: 'auth:1:aaa', ordRef: 'auth:2:aaa' });
  const b = history({ relRef: 'auth:1:bbb', ordRef: 'auth:2:bbb' });
  const A = { origin: 'A', journal: J(a.entries) }, B = { origin: 'B', journal: J(b.entries) };
  const fwd = replayMerged(merge([A, B]).merged, { authorityStore: store() });
  const rev = replayMerged(merge([B, A]).merged, { authorityStore: store() });
  assert.deepEqual(semantic(fwd), semantic(rev), 'reversing input order changed the semantics');

  // duplication: the SAME journal twice under the same origin is the same record, not a conflict
  const dup = merge([A, { origin: 'A', journal: J(structuredClone(a.entries)) }]);
  assert.deepEqual(dup.ambiguities, [], 'identical content is duplication, not ambiguity');
  assert.equal(dup.merged.records.length, 2);
  assert.deepEqual(semantic(replayMerged(dup.merged, { authorityStore: store() })),
    semantic(replayMerged(merge([A]).merged, { authorityStore: store() })));
});

test('M8 — a newly available relation still cannot bind outside its licensed world', () => {
  const full = history({ relRef: 'auth:1:a', ordRef: 'auth:2:a' });
  // the consumer's world has moved; the supplied relation is from the old one
  const moved = structuredClone(full.entries[1]);
  moved.evidence.measurement.observation.context.repository = 'another-repository';
  const b = history({ relRef: 'auth:1:b' });
  const m = merge([{ origin: 'A', journal: J([moved]) }, { origin: 'B', journal: J([b.entries[0]]) }]);
  const r = replayMerged(m.merged, { authorityStore: store() });
  assert.equal(outcomeFor(r, 'B', 'auth:1:b').state, STATE.ESTABLISHED, 'B is fine in ITS world');
  const o = outcomeFor(r, 'A', 'auth:2:a');
  assert.deepEqual(o.bound || [], [], 'but it must not bind for a consumer in another world');
  assert.notEqual(o.state, STATE.ESTABLISHED);
});

test('M9 — additional records alone do not erase F2 undecidable premise', () => {
  const f2 = history({ rel: REL, ord: ORD, relRef: 'auth:1:f2' });
  assert.equal(f2.entries.length, 1, 'F2 ordinary certificate never minted, then or now');
  const b = history({ relRef: 'auth:1:b' });
  const m = merge([{ origin: 'F2', journal: J(f2.entries) },
    { origin: 'B', journal: J(b.entries) }]);
  const st = store();
  const r = replayMerged(m.merged, { authorityStore: st });
  assert.equal(outcomeFor(r, 'F2', 'auth:1:f2').state, STATE.ESTABLISHED, 'the relation replays');

  // and F2 ordinary certificate, offered every record in the merged set, still stops short
  const ord = structuredClone(ORD);
  cov(ord).evidence_root = outcomeFor(r, 'B', 'auth:1:b').newRef;
  const out = adapt(ord, { authorityStore: st });
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'DERIVE');
  assert.match(out.why, /no closed alternative/);
  assert.deepEqual(out.bound || [], []);
});

test('M-APPARATUS — outcomeFor fails loudly when its subject was never produced', () => {
  const r = { outcomes: [{ origin: 'A', ref: 'auth:1:a', state: STATE.ESTABLISHED }] };
  assert.equal(outcomeFor(r, 'A', 'auth:1:a').state, STATE.ESTABLISHED);
  assert.throws(() => outcomeFor(r, 'B', 'auth:1:a'), /no outcome was produced for \(B, auth:1:a\)/);
  assert.throws(() => outcomeFor(r, 'A', 'auth:9:z'), /would otherwise measure a neighbour/);
});

test('M-ORIGIN — a journal may not name its own origin, and every journal needs one', () => {
  const a = history({ relRef: 'auth:1:a' });
  assert.equal(merge([{ journal: J(a.entries) }]).ok, false);
  const self = { entries: a.entries, origin: 'i-am-trustworthy' };
  const m = merge([{ origin: 'A', journal: self }]);
  assert.equal(m.ok, false);
  assert.match(m.why, /does not get to choose the identity under which it is believed/);
});

// ADDED AFTER MUTATION TESTING, and disclosed as such: five of six mutants were caught by the
// frozen arms, but "when several records establish the needed claim, pick the first" survived every
// one of them. The refusal existed in merge.mjs and no arm ever reached it, because no arm made two
// DISTINCT records establish the SAME claim. The prereg names conflicting records under one
// IDENTITY (M4); this is conflict at the level of the PROPOSITION, which it did not name.
test('M10 — several records establishing the SAME claim: reported, not selected', () => {
  const full = history({ relRef: 'auth:1:a', ordRef: 'auth:2:a' });
  const consumer = J([full.entries[1]]);
  const b = history({ relRef: 'auth:1:b' });
  const c = history({ relRef: 'auth:1:c' });
  assert.equal(locateIn(merge([{ origin: 'B', journal: J([b.entries[0]]) }]).merged, 'B', 'auth:1:b')
    .record.claim, NEED, 'both suppliers establish exactly the claim the consumer needs');

  const m = merge([{ origin: 'A', journal: consumer },
    { origin: 'B', journal: J([b.entries[0]]) }, { origin: 'C', journal: J([c.entries[0]]) }]);
  assert.deepEqual(m.ambiguities, [], 'they are different identities, so merging reports no conflict');
  const r = replayMerged(m.merged, { authorityStore: store() });
  assert.equal(outcomeFor(r, 'B', 'auth:1:b').state, STATE.ESTABLISHED);
  assert.equal(outcomeFor(r, 'C', 'auth:1:c').state, STATE.ESTABLISHED);
  const o = outcomeFor(r, 'A', 'auth:2:a');
  assert.equal(o.minted, false, 'the consumer must not pick one: ' + o.why);
  // reworded in the multiplicity run: the refusal means "multiple suppliers, composition
  // undefined", never "the evidence disagrees". Behaviour is unchanged; S0 asserts that.
  assert.match(o.why, /MULTIPLE ELIGIBLE SUPPORTS/);
  assert.match(o.why, /not a finding that the evidence disagrees/);
  assert.match(o.why, /B\/auth:1:b/);
  assert.match(o.why, /C\/auth:1:c/);
  assert.deepEqual(o.bound || [], []);
});
