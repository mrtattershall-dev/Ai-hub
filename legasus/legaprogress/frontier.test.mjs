// THE FOUR-WAY CONTROL — the founding experiment for LegaProgress.
//
//     A  expected advancement        -> ADVANCEMENT
//     B  UNANTICIPATED but legitimate-> ADVANCEMENT        if B fails, we built a CHECKLIST
//     C  activity without advancement-> NO_EVIDENCE        if C passes, we built an ACTIVITY COUNTER
//     D  divergent but impressive    -> NOT_PURPOSE_SUPPORTED
//                                                          if D passes, we built a COMPLEXITY MAXIMIZER
//
// B and D are constructed to be as similar as possible: both are fully VERIFIED, both are backed by real
// execution witnesses, and NEITHER was named anywhere in the constitution. The only thing that separates
// them is whether the project's own execution reaches them. If naming were doing the work, B and D would
// share a verdict.
import test from 'node:test';
import assert from 'node:assert';
import { assessAdvancement, connectivity, supportedRegion, observabilityDebt, frontierFrom,
  VERDICT, ROUTE } from './frontier.mjs';
import { STATE, BASIS, assertClaim, record, freshness } from '../legaknow/ledger.mjs';

// A constitution that declares a REGION, not a feature list. There is no capability enumeration here for
// the mechanism to match against - that is the point.
const PURPOSE = {
  identity: 'a calm farming RPG',
  domains: ['world', 'player', 'farm', 'time'],
  entryPoints: ['game.main'],
  prohibitions: [{ id: 'no-telemetry', clause: 'the game does not phone home',
    match: '^(telemetry|analytics)\\.' }],
  invariants: [
    { id: 'playable', clause: 'the game runs', enforcement: 'ENFORCEABLE' },
    { id: 'calm', clause: 'the game feels calm', enforcement: 'DECLARED' },
  ],
};

const cap = (state) => ({ state });

// What the project actually executes. game.main reaches the farm and the player; the player's inventory
// execution reaches the unanticipated fishing module.
const WITNESSES = [
  { rootSubject: 'game.main', entered: ['farm.plant', 'farm.harvest', 'player.inventory', 'world.tick'] },
  { rootSubject: 'player.inventory', entered: ['fishing.casting'] },
  { rootSubject: 'consensus.raft_elect', entered: ['consensus.raft_elect', 'consensus.append'] },
];

const BEFORE = {
  'farm.plant': cap(STATE.VERIFIED),
  'player.inventory': cap(STATE.VERIFIED),
  'world.tick': cap(STATE.VERIFIED),
  'farm.harvest': cap(STATE.UNTESTED),
};

test('A — ANTICIPATED advancement is recognised', () => {
  const after = { ...BEFORE, 'farm.harvest': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
  assert.equal(r.verdict, VERDICT.ADVANCEMENT, r.why);
  assert.equal(r.advanced[0].subject, 'farm.harvest');
  assert.equal(r.advanced[0].route, ROUTE.IN_DOMAIN);
});

test('B — UNANTICIPATED legitimate advancement is admitted, or we built a checklist', () => {
  // `fishing` is in NO declared domain and is named nowhere in the constitution. It is admitted purely
  // because a purpose-supported capability's execution reaches it.
  const after = { ...BEFORE, 'fishing.casting': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
  assert.equal(r.verdict, VERDICT.ADVANCEMENT, r.why);
  assert.equal(r.advanced[0].subject, 'fishing.casting');
  assert.equal(r.advanced[0].route, ROUTE.CONNECTED,
    'and it must be admitted by EXECUTION, not by having been foreseen');
  assert.ok(!PURPOSE.domains.includes('fishing'), 'B must genuinely be outside the declared region');
});

test('C — ACTIVITY WITHOUT ADVANCEMENT is not progress, however correct it is', () => {
  // A week of verified refactoring. Every commit passed PROVE. Nothing changed evidentiary state.
  const after = { ...BEFORE };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
  assert.equal(r.verdict, VERDICT.NO_EVIDENCE_OF_ADVANCEMENT, r.why);
  assert.match(r.why, /may be correct and may be committed/);
});

test('D — DIVERGENT advancement is real advancement, and is still refused', () => {
  // Behaviourally real, fully witnessed, technically sophisticated, and nothing in the game ever runs it.
  const after = { ...BEFORE, 'consensus.raft_elect': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
  assert.equal(r.verdict, VERDICT.NOT_PURPOSE_SUPPORTED, r.why);
  assert.equal(r.transitions[0].route, ROUTE.UNSUPPORTED);
});

test('THE DISCRIMINATOR IS EXECUTION, NOT NAMING — B and D differ by exactly one witness edge', () => {
  // Remove the single edge player.inventory -> fishing.casting. B must now be refused, for the same
  // reason D is. If B still passed, admission was permissiveness rather than evidence.
  const severed = WITNESSES.filter((w) => w.rootSubject !== 'player.inventory');
  const after = { ...BEFORE, 'fishing.casting': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: severed });
  assert.equal(r.verdict, VERDICT.NOT_PURPOSE_SUPPORTED,
    'with the execution edge gone, the identical capability must be refused: ' + r.why);

  // And giving D the edge admits it, which proves the rule is symmetric and not a blocklist on the word
  // "consensus".
  const wired = [...WITNESSES,
    { rootSubject: 'world.tick', entered: ['consensus.raft_elect'] }];
  const afterD = { ...BEFORE, 'consensus.raft_elect': cap(STATE.VERIFIED) };
  const rd = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after: afterD, witnesses: wired });
  assert.equal(rd.verdict, VERDICT.ADVANCEMENT,
    'a consensus module the game actually runs IS part of the game: ' + rd.why);
});

test('ANTI-ORACLE NON-VACUITY — an enumeration in the constitution changes nothing', () => {
  // The mechanism must be provably blind to a capability list. Same inputs, one with an `anticipated`
  // enumeration that names A and omits B; verdicts must be identical in both directions.
  const withList = { ...PURPOSE, anticipated: ['farm.harvest', 'farm.plant', 'world.tick'] };
  const afterB = { ...BEFORE, 'fishing.casting': cap(STATE.VERIFIED) };
  const afterA = { ...BEFORE, 'farm.harvest': cap(STATE.VERIFIED) };
  for (const [after, label] of [[afterA, 'A (enumerated)'], [afterB, 'B (not enumerated)']]) {
    const bare = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
    const listed = assessAdvancement({ purpose: withList, before: BEFORE, after, witnesses: WITNESSES });
    assert.equal(bare.verdict, listed.verdict, label + ': the enumeration must not be consulted');
    assert.equal(bare.verdict, VERDICT.ADVANCEMENT, label);
  }
});

test('PROHIBITIONS are absolute, and beat execution connectivity', () => {
  const witnesses = [...WITNESSES, { rootSubject: 'game.main', entered: ['telemetry.report'] }];
  const after = { ...BEFORE, 'telemetry.report': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses });
  assert.equal(r.verdict, VERDICT.PROHIBITED, r.why);
  assert.ok(r.prohibited.includes('telemetry.report'));
});

test('REGRESSION — losing evidence for a supported capability outranks any advancement alongside it', () => {
  // "Completed features are not casually destroyed" is only an invariant if something checks it.
  const after = { ...BEFORE, 'farm.plant': cap(STATE.CLAIMED), 'farm.harvest': cap(STATE.VERIFIED) };
  const r = assessAdvancement({ purpose: PURPOSE, before: BEFORE, after, witnesses: WITNESSES });
  assert.equal(r.verdict, VERDICT.REGRESSION, r.why);
  assert.match(r.why, /farm\.plant/);
});

test('OBSERVABILITY DEBT — capability may not outrun the evidence able to observe it', () => {
  const before = { a: cap(STATE.VERIFIED), b: cap(STATE.REACHABLE) };
  const after = { a: cap(STATE.VERIFIED), b: cap(STATE.REACHABLE),
    c: cap(STATE.CLAIMED), d: cap(STATE.CLAIMED) };
  assert.equal(observabilityDebt(before).ratio, 1);
  assert.equal(observabilityDebt(after).ratio, 0.5);
  const r = assessAdvancement({ purpose: PURPOSE, before, after, witnesses: [] });
  assert.equal(r.debt.increased, true, 'two unwitnessed claims must register as debt');

  // CONTROL: growing capability AND evidence together does not register debt.
  const healthy = { a: cap(STATE.VERIFIED), b: cap(STATE.REACHABLE), c: cap(STATE.VERIFIED) };
  assert.equal(assessAdvancement({ purpose: PURPOSE, before, after: healthy, witnesses: [] })
    .debt.increased, false);
});

test('THE EPISTEMIC JOIN — stale evidence cannot hold a capability up', () => {
  const W0 = { digests: { 'src/farm.py': 'aaa' }, capabilityVersion: 'r2',
    apparatusVersion: 'exercise-r1' };
  const MOVED = { ...W0, digests: { 'src/farm.py': 'bbb' } };
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ subject: 'farm.plant', predicate: 'is implemented',
    state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['witness w1'],
    invalidationSet: ['src/farm.py'] })));

  const fresh = frontierFrom(ledger, W0, freshness);
  assert.equal(fresh['farm.plant'].state, STATE.VERIFIED);

  const stale = frontierFrom(ledger, MOVED, freshness);
  assert.equal(stale['farm.plant'].state, STATE.CLAIMED,
    'a capability whose evidence went stale reverts to CLAIMED - it is not still VERIFIED');
  assert.equal(stale['farm.plant'].downgraded, true);

  // And that downgrade is exactly what the project ratchet sees as a regression.
  const r = assessAdvancement({ purpose: PURPOSE, before: fresh, after: stale,
    witnesses: [{ rootSubject: 'game.main', entered: ['farm.plant'] }] });
  assert.equal(r.verdict, VERDICT.REGRESSION, r.why);
});

test('the supported region is a FIXPOINT, so legitimacy propagates along real execution chains', () => {
  const conn = connectivity([
    { rootSubject: 'game.main', entered: ['farm.plant'] },
    { rootSubject: 'farm.plant', entered: ['soil.moisture'] },
    { rootSubject: 'soil.moisture', entered: ['weather.rain'] },
  ]);
  const { supported } = supportedRegion({ purpose: PURPOSE,
    subjects: ['farm.plant', 'soil.moisture', 'weather.rain', 'unrelated.thing'], conn });
  assert.equal(supported.get('farm.plant'), ROUTE.IN_DOMAIN);
  assert.equal(supported.get('soil.moisture'), ROUTE.CONNECTED);
  assert.equal(supported.get('weather.rain'), ROUTE.CONNECTED, 'two hops out and still part of the game');
  assert.equal(supported.has('unrelated.thing'), false, 'and the fixpoint must still terminate somewhere');
});
