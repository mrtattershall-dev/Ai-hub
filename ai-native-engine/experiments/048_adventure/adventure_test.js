'use strict';
// =============================================================================
// RD-038 bar 1 — the action/adventure loop PLAYS on today's grammar, zero core
// edits, safe. Observable: a player walks a corridor, PICKS UP two keys (inventory
// climbs 0→1→2), a locked GATE OPENS the moment the key threshold is met, and a
// foe encountered on the way is DEFEATED by combat. Controls: with one key the gate
// stays LOCKED (losable); an untouched item is never taken. RD-035 advisory
// generalizes (only the position writes).
//   node experiments/048_adventure/adventure_test.js
// =============================================================================
const path = require('node:path');
const A = require(path.join(__dirname, 'adventure_rules.js'));
const { buildWorld, install } = A;

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// item1=40, item2=90, foe=140, gate=210, player starts at 10
function scene() {
  const { g, T } = buildWorld();
  const res = install(g);
  g.spawn(T.player, { name: 'hero', x: 10, y: 128 });
  g.spawn(T.item, { name: 'key1', x: 40, y: 128 });
  g.spawn(T.item, { name: 'key2', x: 90, y: 128 });
  g.spawn(T.foe, { name: 'goblin', x: 140, y: 128, hp: 30 });
  g.spawn(T.gate, { name: 'door', x: 210, y: 128 });
  const find = (type, name) => { const v = g._systemView(); return v.allOfType(type).find((u) => v.nameOf(u) === name); };
  const hero = find('player', 'hero'), door = find('gate', 'door'), goblin = find('foe', 'goblin');
  const key1 = find('item', 'key1'), key2 = find('item', 'key2');
  const F = (u, f) => g._systemView().field(u, f);
  let unsafe = 0, deferrals = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { const r = g.stepTick(); deferrals += r.deferrals.length; if (!g.indexesConsistent()) unsafe++; } };
  const setIn = (obj) => { const r = g.stepTick([{ actor: 'p', ops: Object.entries(obj).map(([field, value]) => ({ kind: 'setfield', target: hero, field, value })) }]); deferrals += r.deferrals.length; };
  const driveUntil = (pred, max = 300) => { let n = 0; while (!pred() && n++ < max) tick(); return n < max; };
  return { g, res, hero, door, goblin, key1, key2, F, tick, setIn, driveUntil, stats: () => ({ unsafe, deferrals }) };
}

// ---- install: gate-clean; advisory only on the position writes ---------------
{
  const { res } = scene();
  ok(res.every((r) => r.ok), `all ${res.length} adventure rules install through the gate`);
  const flagged = res.filter((r) => (r.warnings || []).some((w) => w.code === 'unconditional_write')).map((r) => r.name).sort();
  ok(JSON.stringify(flagged) === JSON.stringify(['move_x', 'move_y']),
    `RD-035 advisory fires only on the position writes (got: [${flagged.join(', ')}])`);
}

// ---- the run: collect, unlock, defeat ---------------------------------------
{
  const s = scene();
  ok(s.F(s.hero, 'keys') === 0 && s.F(s.door, 'open') === 0, 'start: 0 keys, gate LOCKED');

  s.setIn({ vx: 4, vy: 0 });
  // after the first key (between the two item bands): exactly one key, gate still locked
  s.driveUntil(() => s.F(s.hero, 'x') >= 64); s.tick(2);
  ok(s.F(s.key1, 'taken') === 1 && s.F(s.hero, 'keys') === 1, 'picked up key1 -> inventory = 1');
  ok(s.F(s.door, 'open') === 0, 'CONTROL: with one key the gate stays LOCKED (the threshold is 2)');

  // second key -> threshold met -> gate opens
  s.driveUntil(() => s.F(s.hero, 'x') >= 110); s.tick(3);
  ok(s.F(s.key2, 'taken') === 1 && s.F(s.hero, 'keys') === 2, 'picked up key2 -> inventory = 2');
  ok(s.F(s.door, 'open') === 1, 'the gate UNLOCKS the moment the 2-key threshold is met');

  // pass the foe -> defeated by combat
  s.driveUntil(() => s.F(s.hero, 'x') >= 170);
  ok(s.F(s.goblin, 'hp') === 0, `the foe is DEFEATED in passing (combat composes; hp ${s.F(s.goblin, 'hp')})`);

  // reach the (now open) gate
  s.driveUntil(() => s.F(s.hero, 'x') >= 205);
  ok(s.F(s.door, 'open') === 1 && s.F(s.hero, 'keys') === 2, 'arrive at the gate: still open, still holding both keys');

  const st = s.stats();
  ok(st.unsafe === 0 && st.deferrals === 0, `SAFE + contention-free across the run (unsafe=${st.unsafe}, deferrals=${st.deferrals})`);
}

// ---- control: an untouched item is never taken (no phantom collection) -------
{
  const s = scene();
  s.setIn({ vx: 0, vy: 0 });         // stand still at x=10, far from every item
  s.tick(20);
  ok(s.F(s.key1, 'taken') === 0 && s.F(s.key2, 'taken') === 0 && s.F(s.hero, 'keys') === 0,
    'CONTROL: standing still collects nothing — items are taken only by proximity');
}

// ---- determinism -------------------------------------------------------------
{
  const trace = () => {
    const s = scene();
    s.setIn({ vx: 4 });
    const t = [];
    for (let i = 0; i < 30; i++) { s.tick(); t.push([s.F(s.hero, 'keys'), s.F(s.door, 'open'), s.F(s.goblin, 'hp')].join(',')); }
    return t.join('|');
  };
  ok(trace() === trace(), 'deterministic: two identical runs produce identical (keys,gate,foe-hp) traces');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-038: action/adventure, a 6th genre, zero core edits`);
process.exit(FAIL ? 1 : 0);
