// THE CLAIM LEDGER — the controls that decide whether a two-month run can remember anything without
// talking itself out of its own project.
//
// Every law here has a POSITIVE control as well as a negative one. A ledger that refuses everything is
// trivially free of superstition and equally useless.
import test from 'node:test';
import assert from 'node:assert';
import { assertClaim, record, recall, freshness, mayRely, rederive, reassess, openQuestions,
  worldState, expiryScope, watchKeys, strengthOf, STATE, BASIS, LIFECYCLE } from './ledger.mjs';

const FILES = ['src/fishing.py', 'src/player.py'];
const W0 = { digests: { 'src/fishing.py': 'aaa', 'src/player.py': 'ppp' },
  capabilityVersion: 'r2', apparatusVersion: 'exercise-r1' };
const FISHING_CHANGED = { ...W0, digests: { ...W0.digests, 'src/fishing.py': 'bbb' } };
const PLAYER_CHANGED = { ...W0, digests: { ...W0.digests, 'src/player.py': 'qqq' } };
const ENVELOPE_WIDENED = { ...W0, capabilityVersion: 'r3' };

const CLAIM = { subject: 'fishing.casting', predicate: 'can be implemented by', object: 'approach-A' };

test('LAW 4 — an attempt record may NEVER become a claim about the world', () => {
  const bad = assertClaim({ ...CLAIM, state: STATE.FALSIFIED, basis: BASIS.ATTEMPT_RECORD, world: W0,
    evidence: ['run 41'], invalidationSet: ['src/fishing.py'] });
  assert.equal(bad.rejected, true);
  assert.match(bad.why, /ATTEMPT FAILURE IS NOT WORLD FALSITY/);

  // POSITIVE CONTROL: the same evidence supports the claim it actually licenses, or the law is just a
  // refusal machine.
  const good = assertClaim({ ...CLAIM, state: STATE.ATTEMPTED_FAILED, basis: BASIS.ATTEMPT_RECORD,
    world: W0, invalidationSet: ['src/fishing.py'],
    evidence: ['run 41: no candidate verified'] });
  assert.equal(good.rejected, undefined);
  assert.equal(mayRely(good).ok, true, 'and it must be USABLE, as the attempt record it is');
});

test('LAW 5 — a refutation must state its evidence AND its scope, or it is dogma', () => {
  const noScope = assertClaim({ ...CLAIM, state: STATE.FALSIFIED, basis: BASIS.PROOF, world: W0,
    evidence: ['counterexample X'], invalidationSet: [] });
  assert.equal(noScope.rejected, true);
  assert.match(noScope.why, /SCOPED REFUTATION/);

  const noEvidence = assertClaim({ ...CLAIM, state: STATE.FALSIFIED, basis: BASIS.PROOF, world: W0,
    evidence: [], invalidationSet: FILES });
  assert.equal(noEvidence.rejected, true);

  // POSITIVE CONTROL: a properly scoped refutation is accepted and usable.
  const ok = assertClaim({ ...CLAIM, state: STATE.FALSIFIED, basis: BASIS.PROOF, world: W0,
    evidence: ['counterexample X'], invalidationSet: FILES });
  assert.equal(ok.rejected, undefined);
  assert.equal(mayRely(ok).ok, true);
});

test('VERIFIED requires a witness or a proof, and evidence', () => {
  assert.equal(assertClaim({ ...CLAIM, state: STATE.VERIFIED, basis: BASIS.ASSUMPTION, world: W0,
    evidence: ['e'] }).rejected, true);
  assert.equal(assertClaim({ ...CLAIM, state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS,
    world: W0, evidence: [] }).rejected, true);
  assert.equal(assertClaim({ ...CLAIM, state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS,
    world: W0, evidence: ['witness w1'], invalidationSet: FILES }).rejected, undefined);
});

test('THE INVALIDATION SET — a claim is disturbed by what it depended on, and not by everything else', () => {
  const c = assertClaim({ ...CLAIM, state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0,
    evidence: ['w1'], invalidationSet: ['src/fishing.py'] });
  assert.equal(freshness(c, FISHING_CHANGED).fresh, false, 'its own dependency moved');
  assert.equal(freshness(c, PLAYER_CHANGED).fresh, true,
    'an unrelated file changing must NOT stale every claim in the ledger, or the ledger is a stopwatch');

  // And a claim that depends on both is disturbed by either.
  const both = assertClaim({ ...CLAIM, state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS,
    world: W0, evidence: ['w1'], invalidationSet: FILES });
  assert.equal(freshness(both, PLAYER_CHANGED).fresh, false);
});

test('LAW 2 — ASYMMETRIC EXPIRY: a widened envelope stales the negative and leaves the positive alone', () => {
  // The day-50 scenario. The program did not change; the SYSTEM got better. A negative recorded when the
  // system was weaker must not keep forbidding the answer.
  const neg = assertClaim({ ...CLAIM, state: STATE.ATTEMPTED_FAILED, basis: BASIS.ATTEMPT_RECORD,
    world: W0, evidence: ['run 41'], invalidationSet: ['src/fishing.py'] });
  const pos = assertClaim({ subject: 'fishing.casting', predicate: 'is implemented',
    state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['w1'],
    invalidationSet: ['src/fishing.py'] });

  assert.equal(expiryScope(neg.state), 'BROAD');
  assert.equal(expiryScope(pos.state), 'NARROW');
  assert.ok(watchKeys(neg).includes('capabilityVersion'));
  assert.ok(!watchKeys(pos).includes('capabilityVersion'));

  assert.equal(freshness(neg, ENVELOPE_WIDENED).fresh, false,
    'the negative must expire when the system that produced it changed');
  assert.equal(mayRely(freshness(neg, ENVELOPE_WIDENED)).reason, 'STALE');
  assert.equal(freshness(pos, ENVELOPE_WIDENED).fresh, true,
    'a widened envelope does not disturb an execution-witnessed positive');

  // SYMMETRY CONTROL: both expire when the SOURCE moves. The asymmetry is about which EXTRA signals a
  // negative watches, not about negatives being uniquely fragile.
  assert.equal(freshness(neg, FISHING_CHANGED).fresh, false);
  assert.equal(freshness(pos, FISHING_CHANGED).fresh, false);
});

test('LAW 3 — contradicting live claims become CONTESTED rather than the newer one winning', () => {
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ ...CLAIM, state: STATE.VERIFIED,
    basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['witness A'], invalidationSet: FILES })));
  const out = record(ledger, assertClaim({ ...CLAIM, state: STATE.FALSIFIED, basis: BASIS.PROOF,
    world: W0, evidence: ['proof B'], invalidationSet: FILES }));
  assert.equal(out.contested, true);
  assert.equal(out.entry.state, STATE.CONTESTED);
  assert.equal(out.entry.priorState, STATE.VERIFIED);
  assert.equal(mayRely(out.entry).reason, 'CONTESTED');
});

test('LAW 3 negative control — an attempt failure does NOT contest an established truth', () => {
  // If these contested each other, one bad run would disable knowledge the system had actually earned.
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ ...CLAIM, state: STATE.VERIFIED,
    basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['witness A'], invalidationSet: FILES })));
  const out = record(ledger, assertClaim({ ...CLAIM, state: STATE.ATTEMPTED_FAILED,
    basis: BASIS.ATTEMPT_RECORD, world: W0, evidence: ['run 41'], invalidationSet: FILES }));
  assert.notEqual(out.contested, true);
  assert.equal(out.entry.state, STATE.ATTEMPTED_FAILED);
});

test('UNOBSERVABLE is never a clean negative, and UNTESTED is never silence', () => {
  const u = assertClaim({ ...CLAIM, state: STATE.UNOBSERVABLE, basis: BASIS.ATTEMPT_RECORD, world: W0 });
  assert.equal(mayRely(u).reason, 'UNOBSERVABLE');
  assert.equal(mayRely(undefined).reason, 'UNTESTED');
  assert.equal(recall({}, CLAIM).state, STATE.UNTESTED);
});

test('RE-DERIVATION is the only exit from STALE, and failing to re-derive does not restore the old answer', () => {
  const neg = assertClaim({ ...CLAIM, state: STATE.ATTEMPTED_FAILED, basis: BASIS.ATTEMPT_RECORD,
    world: W0, evidence: ['run 41'], invalidationSet: ['src/fishing.py'] });
  const stale = freshness(neg, ENVELOPE_WIDENED);
  assert.equal(stale.lifecycle, LIFECYCLE.STALE);

  const gaveUp = rederive(stale, ENVELOPE_WIDENED, () => null);
  assert.equal(gaveUp.lifecycle, LIFECYCLE.INVALID);
  assert.equal(mayRely(gaveUp).ok, false);

  const again = rederive(stale, ENVELOPE_WIDENED,
    () => ({ state: STATE.ATTEMPTED_FAILED, basis: BASIS.ATTEMPT_RECORD, evidence: ['run 92'] }));
  assert.equal(again.lifecycle, LIFECYCLE.REVALIDATED);
  assert.equal(mayRely(again).ok, true);

  // THE WHOLE POINT: the wider envelope now succeeds, and the ledger updates instead of forbidding it.
  const flipped = rederive(stale, ENVELOPE_WIDENED,
    () => ({ state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, evidence: ['witness C'] }));
  assert.equal(flipped.state, STATE.VERIFIED);
  assert.equal(flipped.previousState, STATE.ATTEMPTED_FAILED);
  assert.equal(mayRely(flipped).ok, true);
  assert.equal(freshness(flipped, ENVELOPE_WIDENED).fresh, true,
    're-derivation must rebase the claim on the CURRENT world, not leave it permanently stale');
});

test('THE SUPERSTITION CONTROL — a stale negative must not be able to block work', () => {
  // Day 4 records a failure. Day 50 the system is stronger. If the ledger can still say "do not bother",
  // it has become a superstition generator and the run is dead in a way nothing will report.
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ ...CLAIM, state: STATE.ATTEMPTED_FAILED,
    basis: BASIS.ATTEMPT_RECORD, world: W0, evidence: ['run 41'],
    invalidationSet: ['src/fishing.py'] })));
  assert.equal(mayRely(recall(ledger, CLAIM, ENVELOPE_WIDENED)).reason, 'STALE',
    'the day-4 negative may NOT be relied on at day 50');
  assert.equal(mayRely(recall(ledger, CLAIM, W0)).ok, true,
    'and an unchanged world must still be remembered, or the ledger remembers nothing at all');
});

test('REASSESS sweeps the ledger after a commit and reports exactly what the commit disturbed', () => {
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ subject: 'fishing', predicate: 'is implemented',
    state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['w'],
    invalidationSet: ['src/fishing.py'] })));
  ({ ledger } = record(ledger, assertClaim({ subject: 'player', predicate: 'is implemented',
    state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['w'],
    invalidationSet: ['src/player.py'] })));
  const { staled } = reassess(ledger, FISHING_CHANGED);
  assert.equal(staled.length, 1, 'a commit to one file must not stale the other claim');
  assert.equal(staled[0].subject, 'fishing');
});

test('evidentiary strength is ordered, so ADVANCEMENT can be asked as a question', () => {
  assert.ok(strengthOf(STATE.VERIFIED) > strengthOf(STATE.REACHABLE));
  assert.ok(strengthOf(STATE.REACHABLE) > strengthOf(STATE.CLAIMED));
  assert.ok(strengthOf(STATE.CLAIMED) > strengthOf(STATE.UNTESTED));
  // FALSIFIED is not "weak evidence"; it is a different answer, and must not sit on the ladder.
  assert.equal(strengthOf(STATE.FALSIFIED), -1);
  assert.equal(strengthOf(STATE.UNOBSERVABLE), -1);
});

test('open questions are derived, not declared', () => {
  let ledger = {};
  for (const [s, st] of [['a', STATE.VERIFIED], ['b', STATE.UNOBSERVABLE], ['c', STATE.UNTESTED]]) {
    ({ ledger } = record(ledger, assertClaim({ subject: s, predicate: 'p', state: st,
      basis: st === STATE.VERIFIED ? BASIS.EXECUTION_WITNESS : BASIS.ATTEMPT_RECORD,
      world: W0, evidence: ['w'], invalidationSet: FILES })));
  }
  const open = openQuestions(ledger);
  assert.deepEqual(open.map((o) => o.blocked).sort(), ['UNOBSERVABLE', 'UNTESTED']);
});

test('worldState digests real files per-file and an absent file is a distinct world', () => {
  const a = worldState({ files: ['legasus/legaknow/ledger.mjs', 'legasus/legaknow/nope.mjs'] });
  assert.equal(a.digests['legasus/legaknow/nope.mjs'], 'ABSENT');
  assert.notEqual(a.digests['legasus/legaknow/ledger.mjs'], 'ABSENT');
  const b = worldState({ files: ['legasus/legaknow/ledger.mjs'] });
  assert.equal(a.digests['legasus/legaknow/ledger.mjs'], b.digests['legasus/legaknow/ledger.mjs']);
});
