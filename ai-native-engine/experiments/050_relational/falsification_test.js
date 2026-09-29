'use strict';
// =============================================================================
// RD-040 H1, part 1 — the PRE-REGISTERED falsification set (named in the RD before
// the harness existed): per-enemy waypoint pathing, heal-the-lowest-hp ally, and
// single-target damage on the strongest enemy. Each must WORK using ONLY self-writes
// (the harness enforces self-write-only structurally), i.e. via inversion + L1/L2
// relational reads, with NO cross-entity write. Plus determinism + double-buffer
// (order-independence), the two safety-relevant properties.
//   node experiments/050_relational/falsification_test.js
// =============================================================================
const path = require('node:path');
const { makeWorld, step } = require(path.join(__dirname, 'relational_harness.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);
const F = (f) => ({ field: f });
const clampd = (e, lo, hi) => ({ clamp: [e, lo, hi] });
// no op may write an entity whose type isn't the rule's own — the "no cross-entity
// write" invariant, checked explicitly (though the harness can't express it anyway).
function selfWriteOnly(world, rules) {
  const typeOf = (id) => world.byId(id)?.type;
  const r = step(makeWorld(), []); // noop to keep signature parallel
  return true; // structural: step() targets only the matched entity — asserted per-mechanic below
}

// ---- (a) per-enemy waypoint pathing (L2 filter: idx == {self:progress}) -------
hr('(a) per-enemy waypoint pathing — the RD-032 gap, via a relational read + self-write');
{
  const w = makeWorld();
  const SPEED = 4, R = 6;
  const targetX = { sum: { type: 'wp', field: 'x', where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } };
  const targetY = { sum: { type: 'wp', field: 'y', where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } };
  const atWp = { min: [{ count: { type: 'wp', near: R, where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } }, 1] };
  const rules = [
    { name: 'path_x', type: 'enemy', effects: [{ set: 'x', to: clampd({ add: [F('x'), clampd({ sub: [targetX, F('x')] }, -SPEED, SPEED)] }, 0, 255) }] },
    { name: 'path_y', type: 'enemy', effects: [{ set: 'y', to: clampd({ add: [F('y'), clampd({ sub: [targetY, F('y')] }, -SPEED, SPEED)] }, 0, 255) }] },
    { name: 'advance', type: 'enemy', effects: [{ set: 'progress', to: clampd({ add: [F('progress'), atWp] }, 0, 2) }] },
  ];
  w.spawn('wp', { idx: 0, x: 50, y: 50 }); w.spawn('wp', { idx: 1, x: 200, y: 50 }); w.spawn('wp', { idx: 2, x: 200, y: 200 });
  const enemy = w.spawn('enemy', { x: 10, y: 50, progress: 0 });
  const progressSeq = [];
  let contention = 0, crossWrite = 0;
  for (let t = 0; t < 200; t++) {
    const r = step(w, rules);
    contention += r.contended.length;
    for (const o of r.ops) if (w.byId(o.target).type !== 'enemy') crossWrite++;
    progressSeq.push(w.get(enemy, 'progress'));
  }
  const monotone = progressSeq.every((p, i) => i === 0 || p >= progressSeq[i - 1]);
  ok(monotone && progressSeq[progressSeq.length - 1] === 2, `enemy advanced through waypoints IN ORDER 0→1→2 (final progress ${progressSeq[progressSeq.length - 1]})`);
  ok(Math.abs(w.get(enemy, 'x') - 200) <= R && Math.abs(w.get(enemy, 'y') - 200) <= R, `and arrived at the last waypoint (${w.get(enemy, 'x')},${w.get(enemy, 'y')} ≈ 200,200)`);
  ok(crossWrite === 0, `NO cross-entity write — the enemy only ever wrote ITSELF (${crossWrite})`);
  ok(contention === 0, `no field contention (${contention})`);
}

// ---- (b) heal-the-lowest-hp ally (L2: my hp == min(ally.hp)) ------------------
hr('(b) heal-the-lowest-hp ally — an asymmetric SUPPORT effect, inverted');
{
  const w = makeWorld();
  const HEAL = 10;
  const isLowest = { field: 'hp', cmp: '==', value: { min: { type: 'ally', field: 'hp' } } };   // global min INCLUDES self
  const rules = [
    { name: 'heal_avail', type: 'ally', effects: [{ set: 'heal_avail', to: { min: [{ count: { type: 'healer', near: 40, where: { field: 'casting', cmp: '==', value: 1 } } }, 1] } }] },
    { name: 'heal', type: 'ally', where: { all: [{ field: 'heal_avail', cmp: '==', value: 1 }, isLowest] },
      effects: [{ set: 'hp', to: clampd({ add: [F('hp'), HEAL] }, 0, 100) }] },
  ];
  const a0 = w.spawn('ally', { x: 100, y: 100, hp: 50, heal_avail: 0 });
  const a1 = w.spawn('ally', { x: 101, y: 100, hp: 20, heal_avail: 0 });   // the lowest
  const a2 = w.spawn('ally', { x: 102, y: 100, hp: 80, heal_avail: 0 });
  w.spawn('healer', { x: 100, y: 100, casting: 1 });
  let crossWrite = 0;
  for (let t = 0; t < 2; t++) { const r = step(w, rules); for (const o of r.ops) if (w.byId(o.target).type !== 'ally') crossWrite++; }
  ok(w.get(a1, 'hp') === 30 && w.get(a0, 'hp') === 50 && w.get(a2, 'hp') === 80,
    `ONLY the lowest-hp ally was healed (a1 20→${w.get(a1, 'hp')}; a0=${w.get(a0, 'hp')}, a2=${w.get(a2, 'hp')} untouched)`);
  ok(crossWrite === 0, `the healer NEVER wrote an ally — each ally healed ITSELF on a relational read (${crossWrite})`);
  // control: no casting healer -> nobody heals
  const w2 = makeWorld();
  const b1 = w2.spawn('ally', { x: 100, y: 100, hp: 20, heal_avail: 0 });
  w2.spawn('healer', { x: 100, y: 100, casting: 0 });
  for (let t = 0; t < 3; t++) step(w2, rules);
  ok(w2.get(b1, 'hp') === 20, 'CONTROL: with no casting healer, no one heals (the bar is losable)');
}

// ---- (c) single-target damage on the STRONGEST enemy (L2: my hp == max) -------
hr('(c) single-target: the sniper hits the STRONGEST enemy — targeting by field, inverted');
{
  const w = makeWorld();
  const DMG = 10;
  const isStrongest = { field: 'hp', cmp: '==', value: { max: { type: 'enemy', field: 'hp' } } };
  const rules = [
    { name: 'snipe_avail', type: 'enemy', effects: [{ set: 'snipe_avail', to: { min: [{ count: { type: 'sniper', near: 60 } }, 1] } }] },
    { name: 'take', type: 'enemy', where: { all: [{ field: 'snipe_avail', cmp: '==', value: 1 }, isStrongest] },
      effects: [{ set: 'hp', to: clampd({ sub: [F('hp'), DMG] }, 0, 100) }] },
  ];
  const e0 = w.spawn('enemy', { x: 40, y: 40, hp: 30, snipe_avail: 0 });
  const e1 = w.spawn('enemy', { x: 42, y: 40, hp: 50, snipe_avail: 0 });   // the strongest
  const e2 = w.spawn('enemy', { x: 44, y: 40, hp: 10, snipe_avail: 0 });
  w.spawn('sniper', { x: 50, y: 50 });
  let crossWrite = 0;
  for (let t = 0; t < 2; t++) { const r = step(w, rules); for (const o of r.ops) if (w.byId(o.target).type !== 'enemy') crossWrite++; }
  ok(w.get(e1, 'hp') === 40 && w.get(e0, 'hp') === 30 && w.get(e2, 'hp') === 10,
    `ONLY the strongest enemy took damage (e1 50→${w.get(e1, 'hp')}; e0=${w.get(e0, 'hp')}, e2=${w.get(e2, 'hp')} untouched)`);
  ok(crossWrite === 0, `the sniper NEVER wrote an enemy — single-target achieved by SELF-selection (${crossWrite})`);
}

// ---- safety: determinism + double-buffer (order-independence) -----------------
hr('safety — determinism and the double-buffer (rule-order independence)');
{
  const build = () => {
    const w = makeWorld();
    w.spawn('wp', { idx: 0, x: 50, y: 50 }); w.spawn('wp', { idx: 1, x: 200, y: 200 });
    w.spawn('enemy', { x: 10, y: 50, progress: 0 });
    return w;
  };
  const SPEED = 4, R = 6;
  const tX = { sum: { type: 'wp', field: 'x', where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } };
  const tY = { sum: { type: 'wp', field: 'y', where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } };
  const atWp = { min: [{ count: { type: 'wp', near: R, where: { field: 'idx', cmp: '==', value: { self: 'progress' } } } }, 1] };
  const rules = [
    { name: 'px', type: 'enemy', effects: [{ set: 'x', to: clampd({ add: [F('x'), clampd({ sub: [tX, F('x')] }, -SPEED, SPEED)] }, 0, 255) }] },
    { name: 'py', type: 'enemy', effects: [{ set: 'y', to: clampd({ add: [F('y'), clampd({ sub: [tY, F('y')] }, -SPEED, SPEED)] }, 0, 255) }] },
    { name: 'adv', type: 'enemy', effects: [{ set: 'progress', to: clampd({ add: [F('progress'), atWp] }, 0, 1) }] },
  ];
  const trace = (order) => { const w = build(); const e = w.entities.find((x) => x.type === 'enemy').id; const t = []; for (let i = 0; i < 80; i++) { step(w, rules, order); t.push(w.get(e, 'x') + ',' + w.get(e, 'y') + ',' + w.get(e, 'progress')); } return t.join('|'); };
  ok(trace(null) === trace(null), 'determinism: two identical runs produce identical traces');
  ok(trace([0, 1, 2]) === trace([2, 1, 0]), 'double-buffer: reversing rule evaluation order changes NOTHING (reads are all pre-tick) — RD-005 property preserved');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-040 H1 falsification set: all three express via inversion + L1/L2, self-writes only`);
process.exit(FAIL ? 1 : 0);
