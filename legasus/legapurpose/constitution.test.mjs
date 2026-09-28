// THE CONSTITUTION — controls on the layer that decides what the system does next.
//
// The failure modes here are quieter than anywhere else in the architecture, because nothing crashes when
// a project pursues the wrong goal correctly for three weeks.
import test from 'node:test';
import assert from 'node:assert';
import { constitution, checkInvariants, objective, nextObjectives, ENFORCEMENT, OBJECTIVE, PRIORITY }
  from './constitution.mjs';
import { assertClaim, record, freshness, STATE, BASIS } from '../legaknow/ledger.mjs';
import { VERDICT } from '../legaprogress/frontier.mjs';

const BASE = {
  identity: 'a calm farming RPG',
  domains: ['world', 'player', 'farm'],
  entryPoints: ['game.main'],
};

test('a clause claiming ENFORCEABLE without a check is DEMOTED, not trusted', () => {
  const con = constitution({ ...BASE, invariants: [
    { id: 'calm', clause: 'the game feels calm', enforcement: ENFORCEMENT.ENFORCEABLE },
    { id: 'playable', clause: 'the game runs', enforcement: ENFORCEMENT.ENFORCEABLE,
      check: () => true },
  ] });
  const calm = con.invariants.find((c) => c.id === 'calm');
  assert.equal(calm.enforcement, ENFORCEMENT.DECLARED);
  assert.equal(calm.demoted, true);
  assert.equal(con.problems.length, 1);
  assert.match(con.problems[0].why, /oracle asserting taste/);
  // POSITIVE CONTROL: a clause WITH a check keeps its authority.
  assert.equal(con.enforceable.length, 1);
  assert.equal(con.enforceable[0].id, 'playable');
});

test('only ENFORCEABLE clauses may reject, and a check that could not run has NOT passed', () => {
  const con = constitution({ ...BASE, invariants: [
    { id: 'playable', clause: 'the game runs', enforcement: ENFORCEMENT.ENFORCEABLE, check: () => true },
    { id: 'saves', clause: 'saves load', enforcement: ENFORCEMENT.ENFORCEABLE, check: () => false },
    { id: 'unreadable', clause: 'x', enforcement: ENFORCEMENT.ENFORCEABLE,
      check: () => { throw new Error('harness down'); } },
    { id: 'calm', clause: 'the game feels calm', enforcement: ENFORCEMENT.DECLARED },
  ] });
  const r = checkInvariants(con, {});
  assert.equal(r.ok, false);
  const kinds = Object.fromEntries(r.violations.map((v) => [v.clause, v.kind]));
  assert.equal(kinds.saves, 'VIOLATED');
  assert.equal(kinds.unreadable, 'UNOBSERVABLE',
    'a check that threw must never be recorded as the invariant holding');
  assert.equal(kinds.playable, undefined);
  assert.deepEqual(r.unjudged.map((u) => u.clause), ['calm'],
    'taste is carried forward for a human, not silently enforced or silently dropped');
});

test('AN OBJECTIVE WITHOUT A FALSIFICATION CONDITION IS REFUSED AT CONSTRUCTION', () => {
  const noFalsify = objective({ kind: OBJECTIVE.ESTABLISH_CAPABILITY, target: 'fishing',
    serves: 'the region', justification: 'seems good', advancementTest: 'fishing exists' });
  assert.equal(noFalsify.rejected, true);
  assert.match(noFalsify.why, /report success forever/);

  const sameTest = objective({ kind: OBJECTIVE.ESTABLISH_CAPABILITY, target: 'fishing',
    serves: 'the region', justification: 'x', advancementTest: 'it works', falsification: 'it works' });
  assert.equal(sameTest.rejected, true, 'success and failure must be different observations');

  const unserved = objective({ kind: OBJECTIVE.ESTABLISH_CAPABILITY, target: 'fishing',
    justification: 'x', advancementTest: 'a', falsification: 'b' });
  assert.equal(unserved.rejected, true, 'an objective must name what it serves');

  // POSITIVE CONTROL: a properly formed objective is accepted, or this is just a refusal machine.
  const good = objective({ kind: OBJECTIVE.ESTABLISH_CAPABILITY, target: 'fishing',
    serves: 'a calm farming RPG', justification: 'nothing covers water activities',
    advancementTest: 'a witness-backed fishing capability connected to the project',
    falsification: 'the work produces no witness, or one nothing reaches' });
  assert.equal(good.rejected, undefined);
  assert.equal(good.kind, OBJECTIVE.ESTABLISH_CAPABILITY);
});

test('REGRESSION outranks everything, because repair precedes ambition', () => {
  const con = constitution({ ...BASE, invariants: [] });
  const assessment = { verdict: VERDICT.REGRESSION, debt: { increased: true },
    regressions: [{ subject: 'farm.plant', from: STATE.VERIFIED, to: STATE.CLAIMED, supported: true }] };
  const { objectives } = nextObjectives({ con, ledger: {}, frontier: {}, assessment,
    gaps: [{ subject: 'fishing', why: 'no water activities' }] });
  assert.equal(objectives[0].kind, OBJECTIVE.REPAIR_REGRESSION);
  assert.equal(objectives[0].target, 'farm.plant');
  assert.ok(objectives.some((o) => o.kind === OBJECTIVE.ESTABLISH_CAPABILITY),
    'and ambition is still queued, not discarded');
  assert.ok(PRIORITY.indexOf(OBJECTIVE.REPAIR_REGRESSION)
    < PRIORITY.indexOf(OBJECTIVE.ESTABLISH_CAPABILITY));
});

test('AN UNKNOWN BECOMES AN ESCALATION, NEVER A GUESS', () => {
  const con = constitution({ ...BASE, invariants: [],
    unknowns: [{ id: 'art-style', clause: 'what the game looks like is not mine to decide' }] });
  const { objectives } = nextObjectives({ con, ledger: {}, frontier: {}, assessment: null });
  const esc = objectives.find((o) => o.kind === OBJECTIVE.ESCALATE_UNKNOWN);
  assert.ok(esc, 'the unknown must surface as work');
  assert.equal(esc.blockedBy, 'NEEDS_OWNER');
  assert.match(esc.falsification, /stays blocked/);
  // And it must outrank ordinary capability work, or it will never be reached in a two-month queue.
  assert.ok(PRIORITY.indexOf(OBJECTIVE.ESCALATE_UNKNOWN)
    < PRIORITY.indexOf(OBJECTIVE.ESTABLISH_CAPABILITY));
});

test('STALE and CONTESTED claims generate revalidation work, from evidence and not from a list', () => {
  const W0 = { digests: { 'src/farm.py': 'aaa' }, capabilityVersion: 'r2', apparatusVersion: 'e1' };
  const MOVED = { ...W0, digests: { 'src/farm.py': 'bbb' } };
  let ledger = {};
  ({ ledger } = record(ledger, assertClaim({ subject: 'farm.plant', predicate: 'is implemented',
    state: STATE.VERIFIED, basis: BASIS.EXECUTION_WITNESS, world: W0, evidence: ['w1'],
    invalidationSet: ['src/farm.py'] })));
  const swept = Object.fromEntries(Object.entries(ledger)
    .map(([k, v]) => [k, freshness(v, MOVED)]));

  const con = constitution({ ...BASE, invariants: [] });
  const { objectives } = nextObjectives({ con, ledger: swept, frontier: {}, assessment: null });
  const rev = objectives.find((o) => o.kind === OBJECTIVE.REVALIDATE_STALE);
  assert.ok(rev, 'a stale claim owes work: ' + JSON.stringify(objectives.map((o) => o.kind)));
  assert.equal(rev.target, 'farm.plant');

  // CONTROL: an unchanged world owes no revalidation. Otherwise the queue is a treadmill.
  const still = Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, freshness(v, W0)]));
  const { objectives: none } = nextObjectives({ con, ledger: still, frontier: {}, assessment: null });
  assert.equal(none.filter((o) => o.kind === OBJECTIVE.REVALIDATE_STALE).length, 0);
});

test('OBSERVABILITY DEBT becomes work, targeting exactly the capabilities with no witness', () => {
  const con = constitution({ ...BASE, invariants: [] });
  const frontier = { 'farm.plant': { state: STATE.VERIFIED }, 'farm.water': { state: STATE.CLAIMED } };
  const { objectives } = nextObjectives({ con, ledger: {}, frontier,
    assessment: { verdict: VERDICT.ADVANCEMENT, debt: { increased: true }, regressions: [] } });
  const pay = objectives.find((o) => o.kind === OBJECTIVE.PAY_OBSERVABILITY_DEBT);
  assert.ok(pay);
  assert.deepEqual(pay.target, ['farm.water'], 'and only the dark surface, not the witnessed one');
});

test('the ordering is declared POLICY and says so, rather than posing as a measurement', () => {
  const con = constitution({ ...BASE, invariants: [] });
  const r = nextObjectives({ con, ledger: {}, frontier: {}, assessment: null });
  assert.match(r.policyNote, /needs an owner/);
  assert.match(r.policyNote, /No evidence here says this order is the best use/);
});

test('NO INVENTED WORK — with nothing owing anything, the queue is empty', () => {
  // A goal system that always has something to do is indistinguishable from one that makes work up.
  const con = constitution({ ...BASE, invariants: [] });
  const { objectives } = nextObjectives({ con, ledger: {}, frontier: {},
    assessment: { verdict: VERDICT.ADVANCEMENT, debt: { increased: false }, regressions: [] } });
  assert.equal(objectives.length, 0, JSON.stringify(objectives.map((o) => o.kind)));
});
