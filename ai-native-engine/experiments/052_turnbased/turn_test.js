'use strict';
// =============================================================================
// RD-041 bar 1 — turn-based tactical PLAYS on today's grammar, zero core edits.
// THE headline proof: between turns, ANY number of ticks pass and NOTHING changes
// (the game is turn-gated, not real-time) — so the continuous tick is just a
// heartbeat. Plus: "end turn" is a transaction, queued moves execute on resolve,
// delayed effects count down in TURNS not ticks, a bomb detonates "after N turns".
// And the honest wall: AUTO-initiative-ordering hits the RD-040 relational gap.
//   node experiments/052_turnbased/turn_test.js
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { installRule } = CORE('behavior.js');
const R = require(path.join(__dirname, 'turn_rules.js'));
const { buildWorld, install } = R;

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

function scene() {
  const { g, T } = buildWorld();
  const res = install(g);
  g.spawn(T.game, { name: 'state' });
  g.spawn(T.unit, { name: 'A', x: 50, y: 50, hp: 100, active: 1, mx: 3, my: 0, initv: 5 });
  g.spawn(T.unit, { name: 'B', x: 100, y: 50, hp: 100, active: 0, poison: 3, initv: 9 });
  g.spawn(T.bomb, { name: 'nade', x: 200, y: 50, fuse: 2, boom: 0 });
  const v = g._systemView();
  const id = (type, name) => v.allOfType(type).find((u) => g._systemView().nameOf(u) === name);
  const gu = id('game', 'state'), A = id('unit', 'A'), B = id('unit', 'B'), nade = id('bomb', 'nade');
  const fld = (u, f) => g._systemView().field(u, f);
  let unsafe = 0, deferrals = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { const r = g.stepTick(); deferrals += r.deferrals.length; if (!g.indexesConsistent()) unsafe++; } };
  const endTurn = () => { const r = g.stepTick([{ actor: 'p', ops: [{ kind: 'setfield', target: gu, field: 'phase', value: 1 }] }]); deferrals += r.deferrals.length; tick(2); };  // 3 ticks: pulse propagates
  return { g, res, gu, A, B, nade, fld, tick, endTurn, stats: () => ({ unsafe, deferrals }) };
}

// ---- install ----------------------------------------------------------------
{
  const { res } = scene();
  ok(res.every((r) => r.ok), `all ${res.length} turn-based rules install through the gate`);
}

// ---- THE headline: the game is turn-gated, NOT real-time ----------------------
hr('T1 between turns, ANY number of ticks pass and NOTHING changes (proves not real-time)');
{
  const s = scene();
  const before = [s.fld(s.A, 'x'), s.fld(s.B, 'hp'), s.fld(s.B, 'poison'), s.fld(s.gu, 'turn'), s.fld(s.nade, 'fuse')];
  s.tick(25);                                          // 25 heartbeats, no "end turn"
  const after = [s.fld(s.A, 'x'), s.fld(s.B, 'hp'), s.fld(s.B, 'poison'), s.fld(s.gu, 'turn'), s.fld(s.nade, 'fuse')];
  ok(JSON.stringify(before) === JSON.stringify(after), `25 ticks with no end-turn changed NOTHING (${after.join(',')}) — the tick is a heartbeat, not the clock`);
  ok(s.stats().deferrals === 0, 'no contention while idling');
}

// ---- end turn = a transaction; queued move executes; poison ticks per TURN ----
hr('T2 "end turn" (a tx) resolves ONE turn: queued move applies, poison ticks once, counter advances');
{
  const s = scene();
  ok(s.fld(s.A, 'x') === 50 && s.fld(s.gu, 'turn') === 0, 'start: A at x=50, turn 0');
  s.endTurn();
  ok(s.fld(s.A, 'x') === 53, `A's QUEUED move executed on resolve (x 50→${s.fld(s.A, 'x')})`);
  ok(s.fld(s.B, 'hp') === 90 && s.fld(s.B, 'poison') === 2, `poison ticked exactly ONCE this turn (hp ${s.fld(s.B, 'hp')}, poison ${s.fld(s.B, 'poison')})`);
  ok(s.fld(s.gu, 'turn') === 1 && s.fld(s.gu, 'phase') === 0, `turn advanced to ${s.fld(s.gu, 'turn')} and returned to the input phase`);
  // idle after resolving: must NOT resolve again (no double-tick of poison/move)
  s.tick(15);
  ok(s.fld(s.A, 'x') === 53 && s.fld(s.B, 'poison') === 2 && s.fld(s.gu, 'turn') === 1, 'idling after the turn does NOT re-resolve (poison/move/counter stable)');
}

// ---- delayed effect measured in TURNS, not ticks -----------------------------
hr('T3 a bomb detonates "after 2 turns" — turns, not the 30+ ticks that elapsed');
{
  const s = scene();
  ok(s.fld(s.nade, 'fuse') === 2 && s.fld(s.nade, 'boom') === 0, 'fuse starts at 2, unarmed');
  s.endTurn();
  ok(s.fld(s.nade, 'fuse') === 1 && s.fld(s.nade, 'boom') === 0, `after turn 1: fuse ${s.fld(s.nade, 'fuse')}, still unarmed`);
  s.endTurn();
  ok(s.fld(s.nade, 'fuse') === 0, `after turn 2: fuse hit 0 — the detonation turn (not a tick count; ~6 ticks had elapsed)`);
  s.tick(1);                                           // the boom flag latches one heartbeat after the fuse expires
  ok(s.fld(s.nade, 'boom') === 1, `the bomb DETONATED on turn 2 (boom=1) — delay measured in TURNS; the flag trails the fuse by one tick`);
  ok(s.stats().unsafe === 0, `SAFE across the match (unsafe=${s.stats().unsafe})`);
}

// ---- poison expires after its 3 turns (delayed effect ends on schedule) -------
hr('T4 poison lasts exactly 3 turns then stops');
{
  const s = scene();
  s.endTurn(); s.endTurn(); s.endTurn();               // 3 turns
  ok(s.fld(s.B, 'poison') === 0 && s.fld(s.B, 'hp') === 70, `poison dealt 3×10 then expired (hp ${s.fld(s.B, 'hp')}, poison ${s.fld(s.B, 'poison')})`);
  s.endTurn();
  ok(s.fld(s.B, 'hp') === 70, 'a 4th turn deals no more poison damage (the countdown ended)');
}

// ---- determinism -------------------------------------------------------------
{
  const trace = () => { const s = scene(); const t = []; for (let k = 0; k < 4; k++) { s.endTurn(); t.push([s.fld(s.A, 'x'), s.fld(s.B, 'hp'), s.fld(s.gu, 'turn')].join(',')); } return t.join('|'); };
  ok(trace() === trace(), 'deterministic: two identical matches produce identical turn traces');
}

// ---- THE WALL: auto-initiative ordering hits the RD-040 relational gap ---------
hr('T5 the honest wall — AUTO turn order ("activate the unit whose initv == the current slot") needs a relational read');
{
  const { g } = buildWorld();
  install(g);
  // "a unit becomes active when its initiative equals the game's current slot" is a
  // predicate comparing a unit field to ANOTHER entity's field — the RD-032/RD-040 gap.
  const rel = installRule(g, { name: 'auto_init', match: { type: 'unit', where: { field: 'initv', cmp: '==', value: { field: 'turn' } } }, effects: [{ set: 'active', to: 1 }] });
  console.log(`     verdict: ${rel.ok ? 'ACCEPTED' : 'REJECTED ' + JSON.stringify((rel.errors || []).map((e) => e.code))}`);
  ok(!rel.ok, 'auto-initiative REJECTED (field-vs-field) — turn ORDER needs RD-040 L2; turn STRUCTURE (this whole genre) does not. Player-driven turns work today.');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-041: turn-based tactical, zero core edits; the tick is a heartbeat, not the clock`);
process.exit(FAIL ? 1 : 0);
