// R1..R8 — can authority survive a restart without being silently recreated from a saved verdict?
//
// Predictions frozen in REPLAY_PREREG.md before replay.mjs existed. The boundary under test:
// a persisted admission record is an INPUT to a new admission attempt, and a saved acceptance
// verdict authorizes nothing.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store } from './authority-store.mjs';
import { journalEntry, serialize, parse, locate, replayJournal, JOURNAL_VERSION } from './replay.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const REL = load('REL'), ORD = load('ORD');

const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

// A LIVE RUN, then its journal. Exactly the shape the natural-relation experiment produced.
function liveRun(relSrc = REL2, ordSrc = ORD2, mutate = (c) => c) {
  const st = store();
  const rel = mutate(structuredClone(relSrc));
  admit(rel, { authorityStore: st });
  const relOut = adapt(rel, { authorityStore: st });
  const entries = [];
  let relRef = null;
  if (relOut.token) {
    const filed = st.admitToken(relOut.token, { fromCertificate: rel.provenance.run_id });
    relRef = filed.ref;
    entries.push(journalEntry({ ref: relRef, store: st, certificate: rel, consumed: [] }).entry);
  }
  const ord = structuredClone(ordSrc);
  const w = cov(ord);
  if (relRef) w.evidence_root = relRef;
  const ordOut = adapt(ord, { authorityStore: st });
  if (ordOut.token) {
    const filed = st.admitToken(ordOut.token, { fromCertificate: ord.provenance.run_id });
    st.dependsOn(filed.ref, relRef);
    entries.push(journalEntry({ ref: filed.ref, store: st, certificate: ord,
      consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object, ref: relRef }] }).entry);
  }
  return { st, relRef, ord, ordOut, entries };
}

const journalOf = (entries) => ({ entries });

test('R1 — a previously issued handle alone grants no authority in a fresh store', () => {
  const { relRef, entries } = liveRun();
  assert.ok(relRef);
  const fresh = store();
  const got = fresh.resolve(relRef);
  assert.equal(got.ok, false);
  assert.match(got.why, /resolves to nothing|address is not an establishment/);

  // THE NAMED HAZARD from the preregistration: nextRef's counter restarts at zero in a fresh
  // process, so an address of the same SHAPE is regenerable. A fresh store refuses every ref it
  // did not itself issue, so shape is not what it keys on.
  const mine = liveRun().relRef;                      // makes this store's counter advance
  assert.equal(fresh.resolve(mine).ok, false, 'a ref issued by ANOTHER store is still nothing here');
  assert.equal(store().resolve('auth:1:aaaaaa').ok, false, 'nor is a plausibly-shaped address');

  // and locate() - the filing-cabinet lookup - never hands back a token, by shape
  const l = locate(journalOf(entries), relRef);
  assert.equal(l.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(l, 'token'), false,
    'locate must not have a token field at all, not merely a null one');
  assert.ok(l.record.claim, 'it returns the recorded claim');
});

test('R2 — valid replay ACROSS A REAL PROCESS BOUNDARY recovers what re-execution justifies', () => {
  const { entries, relRef } = liveRun();
  assert.equal(entries.length, 2, 'the live run produced two filed authorities to journal');
  const ser = serialize(entries);
  assert.equal(ser.ok, true, ser.why);
  const dir = mkdtempSync(join(tmpdir(), 'legasus-replay-'));
  const path = join(dir, 'journal.json');
  writeFileSync(path, ser.text, 'utf8');

  // NOTHING BUT BYTES CROSSES. A fresh node process, fresh module graph, fresh WeakSet.
  const child = JSON.parse(execFileSync(process.execPath,
    [new URL('./replay-child.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), path],
    { encoding: 'utf8' }));
  assert.equal(child.ok, true, child.why);
  assert.notEqual(child.pid, process.pid, 'it really was another process');

  // every parent address is dead there, and locate never returned a token
  for (const d of child.deadRefs) {
    assert.equal(d.resolved, false, d.ref + ' must not resolve after restart');
    assert.equal(d.located, true, d.ref + ' is still FINDABLE as a record');
    assert.equal(d.locateReturnedToken, false);
  }

  // and re-execution recovered the authority
  const [relOut, ordOut] = child.replayed.outcomes;
  assert.equal(relOut.state, STATE.ESTABLISHED, relOut.why);
  assert.equal(ordOut.state, STATE.ESTABLISHED, ordOut.why);
  assert.deepEqual(ordOut.bound, ['COVERAGE'], 'the consumer bound its witness again');
  assert.notEqual(relOut.newRef, relRef, 'under a NEW address; the old one was never revived');
  assert.equal(child.storeSize, 2);

  // THE BOUNDARY'S OWN CONTROL: a JSON clone of a real token is not authority.
  assert.equal(child.liveIsAuthority, true, 'the child genuinely minted');
  assert.equal(child.cloneIsAuthority, false,
    'if a JSON clone answered true, the boundary is not what the prereg says and nothing here reads');
});

test('R3 — a saved verdict cannot substitute for evidence', () => {
  const { entries } = liveRun();

  // the writer refuses a journal of verdicts outright
  const stripped = entries.map((e) => ({ ...e, evidence: null }));
  const ser = serialize(stripped);
  assert.equal(ser.ok, false);
  assert.match(ser.why, /list of assertions|nothing could be re-executed/);

  // and if one reaches the replayer anyway, it establishes nothing
  const verdictOnly = [{ ref: entries[0].ref, consumed: [],
    record: { ...entries[0].record, state: 'ESTABLISHED', accepted: true, established: true } }];
  const out = replayJournal(journalOf(verdictOnly), { authorityStore: store() }).outcomes[0];
  assert.equal(out.state, STATE.UNRESOLVED);
  assert.equal(out.minted, false);
  assert.match(out.why, /saved outcome is not a reason/);

  // nor may a record carry a token in the first place
  const fake = { recordOf: () => ({ claim: 'x', token: { pretending: true } }) };
  const je = journalEntry({ ref: 'r', store: fake, certificate: REL2 });
  assert.equal(je.ok, false);
  assert.match(je.why, /token in disguise|minting operation/);
});

test('R4 — replay evaluates the CHANGED evidence; the old verdict cannot carry acceptance forward', () => {
  const { entries } = liveRun();
  const damaged = structuredClone(entries);
  // the record still says ESTABLISHED. The evidence no longer carries evidential force.
  damaged[0].record.state = 'ESTABLISHED';
  damaged[0].evidence.measurement.observation.evidential_force = false;

  const out = replayJournal(journalOf(damaged), { authorityStore: store() });
  const byRef = Object.fromEntries(out.outcomes.map((o) => [o.ref, o]));
  const rel = byRef[damaged[0].ref], ord = byRef[damaged[1].ref];
  assert.notEqual(rel.state, STATE.ESTABLISHED, 'changed evidence is re-judged: ' + rel.why);
  assert.equal(rel.minted, false);
  // and the consumer that rested on it does NOT inherit last time's acceptance
  assert.notEqual(ord.state, STATE.ESTABLISHED);
  assert.deepEqual(ord.bound || [], []);

  // A SHARPER FORM, because the above could pass merely because the dependency went missing
  // (which is R5's arm, not this one). Here the dependency is intact and ONLY the consumer's own
  // evidence changed, while its record still says ESTABLISHED.
  const d2 = structuredClone(entries);
  d2[1].record.state = 'ESTABLISHED';
  for (const alt of d2[1].evidence.derivation.alternatives) {
    alt.closed = false;
    for (const pr of alt.premises || []) pr.settled = false;
  }
  const o2 = replayJournal(journalOf(d2), { authorityStore: store() }).outcomes;
  assert.equal(o2[0].state, STATE.ESTABLISHED, 'the dependency is intact this time');
  assert.notEqual(o2[1].state, STATE.ESTABLISHED,
    'a saved ESTABLISHED does not survive its own evidence changing: ' + o2[1].why);
  assert.equal(o2[1].minted, false);
});

test('R5 — a missing dependency leaves replay OPEN, naming it, not refused', () => {
  const { entries } = liveRun();
  const withoutRoot = journalOf([entries[1]]);              // the consumer, with its root absent
  const out = replayJournal(withoutRoot, { authorityStore: store() }).outcomes[0];
  assert.equal(out.state, STATE.FRONTIER_OPEN,
    'unresolved is not disproven; a missing record is ignorance, not falsity');
  assert.equal(out.minted, false);
  assert.match(out.why, /COVERAGE\(/, 'and it names WHICH dependency is missing');
  assert.match(out.why, new RegExp(entries[0].ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'by the address it was recorded under');
});

test('R6 — authority for the OLD world cannot bind in the new one after replay', () => {
  // Construction note, recorded because the first version of this arm was wrong: mutating the
  // RELATION's world means the consumer never binds LIVE either, so nothing is journaled and the
  // arm silently reads the relation's own outcome. The arm is about a recovered authority meeting
  // a consumer whose world has MOVED, so the consumer is what changes.
  for (const [mutate, pattern] of [
    [(c) => { c.measurement.observation.context.repository = 'another-repository'; },
      /established in repository/],
    [(c) => { for (const w of c.derivation.alternatives[0].relation_witnesses) w.domain = 'A_DIFFERENT_POPULATION'; },
      /established over claim domain|different population/],
  ]) {
    const { entries } = liveRun();
    assert.equal(entries.length, 2, 'the live run bound, so there is something to move');
    const moved = structuredClone(entries);
    mutate(moved[1].evidence);
    const out = replayJournal(journalOf(moved), { authorityStore: store() }).outcomes;
    const rel = out[0], ord = out[1];
    assert.equal(rel.state, STATE.ESTABLISHED, 'the relation still replays in ITS world');
    assert.deepEqual(ord.bound || [], [], 'but the moved consumer must not bind it');
    assert.notEqual(ord.state, STATE.ESTABLISHED, ord.why);
  }
});

test('R7 — records cannot bootstrap authority by referring to one another', () => {
  const { entries } = liveRun();
  const a = structuredClone(entries[0]), b = structuredClone(entries[1]);
  a.consumed = [{ relation: 'COVERAGE', subject: 'x', object: 'y', ref: b.ref }];
  b.consumed = [{ relation: 'COVERAGE', subject: 'x', object: 'y', ref: a.ref }];
  const out = replayJournal(journalOf([a, b]), { authorityStore: store() });
  assert.equal(out.ok, false);
  assert.match(out.why, /cycle/);
  assert.match(out.why, /no evidence at its root/);
  for (const o of out.outcomes) assert.equal(o.minted, false);
});

test('R8 — replay does not repair the F2 boundary: witness binding is still never reached', () => {
  const { entries } = liveRun(REL, ORD);
  // F2's ordinary certificate never minted, so only the RELATION is in the journal at all.
  assert.equal(entries.length, 1, 'there was no second authority to record last time either');
  const st = store();
  const out = replayJournal(journalOf(entries), { authorityStore: st }).outcomes[0];
  assert.equal(out.state, STATE.ESTABLISHED, 'the relation replays: ' + out.why);

  // and the ordinary certificate, re-pointed at the freshly recovered relation, still stops short
  const ord = structuredClone(ORD);
  cov(ord).evidence_root = out.newRef;
  const a = adapt(ord, { authorityStore: st });
  assert.equal(a.minted, false);
  assert.equal(a.stage, 'DERIVE');
  assert.match(a.why, /no closed alternative/);
  assert.deepEqual(a.bound || [], [], 'binding is still not reached. Replay manufactured nothing');
});

test('R-CONTRACT — a journal written under another contract is not evidence under this one', () => {
  const { entries } = liveRun();
  const text = serialize(entries).text.replace(JOURNAL_VERSION, 'replay-journal-9.9.9');
  const p = parse(text);
  assert.equal(p.ok, false);
  assert.match(p.why, /is not replay-journal-1\.0\.0/);
});
