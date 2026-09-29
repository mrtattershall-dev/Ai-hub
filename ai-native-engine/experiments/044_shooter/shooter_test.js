'use strict';
// =============================================================================
// RD-032 bars 1-3 — does the shooter PLAY? Every assertion carries a CONTROL,
// because RD-029 proved a weak oracle launders a wrong rule.
// Each mechanic gets a FRESH world: the first version let armed bullets from the
// firing test fly into the chase test's enemies and quietly kill them, which is
// its own lesson about shared fixtures. `node shooter_test.js`
// =============================================================================
const path = require('node:path');
const S = require('./shooter_rules.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const world = () => { const { g, T } = S.buildWorld(); S.install(g); return { g, T, f: (u, k) => g._systemView().field(u, k), live: (t) => g._systemView().allOfType(t) }; };

// ---- bar 2: the grammar accepts every rule -----------------------------------
{
  const { g } = S.buildWorld();
  const bad = S.install(g).filter((r) => !r.ok);
  ok(bad.length === 0, `all ${S.RULE_SET.length} shooter rules pass the RD-B6 gate`
    + (bad.length ? `\n     REJECTED: ${JSON.stringify(bad, null, 1)}` : ''));
  if (bad.length) { console.log('\nFAIL — the grammar could not express the shooter'); process.exit(1); }
}

// ---- chase AI (H2's workaround: aggregation-fetch + clamp-as-sign) ------------
{
  const { g, T, f } = world();
  const P = g.spawn(T.player, { name: 'you', x: 128, y: 128 }).uuid;
  const L = g.spawn(T.enemy, { name: 'L', x: 60, y: 128, hp: 100 }).uuid;
  const R = g.spawn(T.enemy, { name: 'R', x: 200, y: 128, hp: 100 }).uuid;
  const On = g.spawn(T.enemy, { name: 'On', x: 128, y: 128, hp: 100 }).uuid;
  const dL0 = 128 - f(L, 'x'), dR0 = f(R, 'x') - 128;
  g.stepTick();
  ok(128 - f(L, 'x') === dL0 - 1 && f(R, 'x') - 128 === dR0 - 1,
    `enemies CHASE from BOTH sides (gap L ${dL0}->${128 - f(L, 'x')}, R ${dR0}->${f(R, 'x') - 128}) — sign(player.x - my.x) built from clamp, with NO relational predicate in the grammar`);
  ok(f(On, 'x') === 128 && f(On, 'y') === 128, `CONTROL: an enemy already on the player does not jitter (sign(0)=0)`);
}

// ---- firing: the H3 pool workaround ------------------------------------------
{
  const { g, T, f } = world();
  const P = g.spawn(T.player, { name: 'you', x: 100, y: 100 }).uuid;   // stationary: no input
  const b = [];
  for (let i = 0; i < S.POOL; i++) b.push(g.spawn(T.bullet, { name: `b${i}`, life: 0 }).uuid);
  g.stepTick();
  ok(b.every((x) => f(x, 'life') === 0), 'CONTROL: bullets stay unarmed while fire is released');
  ok(f(b[0], 'x') === 100 && f(b[0], 'y') === 100,
    `spent bullets track the player (${f(b[0], 'x')},${f(b[0], 'y')}) — the POOL workaround for static spawn props`);
  g.submit([{ actor: 'p1', ops: [
    { kind: 'setfield', target: P, field: 'fire', value: 1 },
    { kind: 'setfield', target: P, field: 'input_x', value: -1 }] }]);
  g.stepTick();
  const armed = b.filter((x) => f(x, 'life') > 0);
  ok(armed.length > 0 && f(armed[0], 'vx') === -6,
    `holding fire ARMS the pool (${armed.length}/${S.POOL} live, vx=${f(armed[0], 'vx')}) — fire/aim fetched from the PLAYER's fields into the BULLET's rule`);
}

// ---- damage + death + scoring (the aggregation->field->where->delete bridge) ---
{
  const { g, T, f, live } = world();
  const P = g.spawn(T.player, { name: 'you', x: 200, y: 200 }).uuid;   // far away; no contact damage
  const victim = g.spawn(T.enemy, { name: 'victim', x: 20, y: 20, hp: 100 }).uuid;
  const safe = g.spawn(T.enemy, { name: 'safe', x: 240, y: 20, hp: 100 }).uuid;
  g.spawn(T.bullet, { name: 'shot', x: 22, y: 20, life: 30, vx: 0, vy: 0 });   // parked 2 units from victim
  g.stepTick();
  ok(f(victim, 'hp') === 100 - S.DMG, `a bullet within ${S.HIT_R} DAMAGES the enemy (hp 100 -> ${f(victim, 'hp')})`);
  ok(f(safe, 'hp') === 100, `CONTROL: an enemy far from any bullet takes NO damage (hp=${f(safe, 'hp')})`);
  g.stepTick(); g.stepTick();                       // 3 hits: 100 -> 66 -> 32 -> 0
  ok(f(victim, 'hp') === 0, `three hits drive hp to exactly 0 (clamped, never negative)`);
  const s0 = f(P, 'score');
  g.stepTick();                                     // the tick that SEES hp<=0: scores AND deletes
  ok(!live('enemy2').includes(victim), `the enemy DIED (aggregation -> field -> where -> delete: the two-rule bridge for a conditional lifecycle)`);
  ok(f(P, 'score') === s0 + 1, `the kill SCORED exactly once (${s0} -> ${f(P, 'score')}) — the dying enemy is still visible to the score rule in the tick it is deleted`);
  const s1 = f(P, 'score');
  g.stepTick();
  ok(f(P, 'score') === s1, 'CONTROL: score does not keep rising once the corpse is gone');
  ok(f(safe, 'hp') === 100, 'CONTROL: the untouched enemy is still alive and undamaged');
}

// ---- player contact damage ----------------------------------------------------
{
  const { g, T, f } = world();
  const P = g.spawn(T.player, { name: 'you', x: 128, y: 128 }).uuid;
  const hp0 = f(P, 'hp');
  g.stepTick();
  ok(f(P, 'hp') === hp0, 'CONTROL: no enemies nearby -> the player takes no damage');
  g.spawn(T.enemy, { name: 'toucher', x: 128, y: 130, hp: 100 });
  g.stepTick();
  ok(f(P, 'hp') < hp0, `an adjacent enemy DAMAGES the player (hp ${hp0} -> ${f(P, 'hp')}) — aggregation inversion again`);
}

// ---- bounded spawning (RD-032 caught a REAL core bug here) ---------------------
{
  const { g, T, live } = world();
  g.spawn(T.player, { name: 'you', x: 128, y: 128 });
  g.spawn(T.spawner, { name: 'nest' });
  const n0 = live('enemy2').length;
  for (let i = 0; i < 41; i++) g.stepTick();
  const n1 = live('enemy2').length;
  ok(n1 > n0, `the spawner CREATES enemies over time (${n0} -> ${n1}) — this is the assertion that exposed behavior.js resolving spawn types against the FARM table instead of the world's schema`);
}

// ---- invariants + determinism -------------------------------------------------
{
  const { g, T } = world();
  g.spawn(T.player, { name: 'you', x: 128, y: 128 });
  g.spawn(T.spawner, { name: 'nest' });
  for (let i = 0; i < 3; i++) g.spawn(T.bullet, { name: `b${i}`, life: 0 });
  for (let i = 0; i < 60; i++) g.stepTick();
  let unsafe = 0;
  if (!g.indexesConsistent()) unsafe++;
  for (const [uu, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== uu) unsafe++;
  ok(unsafe === 0, 'unsafe sweep: 0 after 60 ticks of spawning, chasing, shooting and dying');
}
{
  const replay = () => {
    const { g, T } = world();
    const p = g.spawn(T.player, { name: 'you', x: 128, y: 128 }).uuid;
    g.spawn(T.enemy, { name: 'e', x: 60, y: 128, hp: 100 });
    for (let i = 0; i < 3; i++) g.spawn(T.bullet, { name: `b${i}`, life: 0 });
    g.submit([{ actor: 'p', ops: [{ kind: 'setfield', target: p, field: 'fire', value: 1 }] }]);
    const tr = [];
    for (let t = 0; t < 40; t++) { g.stepTick(); tr.push(g._systemView().allOfType('enemy2').map((u) => g._systemView().field(u, 'hp')).join(',')); }
    return tr.join('|');
  };
  ok(replay() === replay(), 'deterministic: two identical shooter sessions produce identical traces');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-032: a top-down shooter on the same rule system, zero core edits`);
process.exit(FAIL ? 1 : 0);
