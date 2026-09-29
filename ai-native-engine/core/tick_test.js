'use strict';
// =============================================================================
// TICK LOOP (phase 0 of the behavior spine). Proves the simulation substrate
// INHERITS the pipeline's guarantees rather than re-implementing them:
//   T1  a system runs the world forward (growth over N ticks)
//   T2  Crop #142 AT THE SYSTEMS LAYER — system-vs-player same-tick conflicts
//       resolve IDENTICALLY to player-vs-player (twin-engine equivalence),
//       for both the fold case (water/max) and the defer case (name/label)
//   T3  one tick = ONE RD-020 undo step (a whole tick reverses atomically)
//   T4  30-tick mixed run (spawner + reaper systems): indexes consistent and
//       identity coherent after EVERY tick
//   T5  system REGISTRATION order does not change committed state (RD-003
//       determinism extended to systems)
// `node core/tick_test.js`
// =============================================================================
const { Engine, TYPE } = require('./engine.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// observable crop state, uuid-keyed (type-correct reads only — RD-021 lesson)
const cropSig = (g) => g.w.uuid
  .map((u, e) => u !== undefined && !g.w.destroyed[e] && g.w.type[e] === TYPE.CROP
    ? [u, g._field(e, 'water'), g._field(e, 'growth')] : null)
  .filter(Boolean);

// the canonical growth system: watered crops grow, water evaporates
const growthSystem = (view) => {
  const ops = [];
  for (const u of view.allOfType('crop')) {
    const water = view.field(u, 'water'), growth = view.field(u, 'growth');
    if (water > 0) {
      ops.push({ kind: 'setfield', target: u, field: 'growth', value: Math.min(255, growth + 5) });
      ops.push({ kind: 'setfield', target: u, field: 'water', value: Math.max(0, water - 1) });
    }
  }
  return ops;
};

function build() {
  const g = new Engine(256);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'c1', parent: zone, water: 10, growth: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'c2', parent: zone, water: 3, growth: 0 }).uuid;
  return { g, zone, c1, c2 };
}

console.log('=== phase 0: the tick loop runs through the unmodified pipeline ===\n');

// --- T1: a system runs the world forward -----------------------------------
{
  const { g, c1, c2 } = build();
  g.registerSystem('growth', growthSystem);
  for (let t = 0; t < 10; t++) {
    const r = g.stepTick();
    ok(r.results.every(x => x.status === 'committed') || t >= 3,
      `T1 tick ${t + 1}: system tx committed`);
  }
  // c1 (water 10) grew all 10 ticks; c2 (water 3) grew only 3 then dried out
  ok(g._field(g.w.liveEntity(c1), 'growth') === 50, 'T1 c1 grew 5/tick for 10 ticks -> 50');
  ok(g._field(g.w.liveEntity(c1), 'water') === 0, 'T1 c1 water evaporated 10 -> 0');
  ok(g._field(g.w.liveEntity(c2), 'growth') === 15, 'T1 c2 grew only while watered (3 ticks) -> 15');
  ok(g.indexesConsistent(), 'T1 indexes consistent after the run');
}

// --- T2: Crop #142 at the SYSTEMS layer — twin-engine equivalence -----------
// FOLD case: an irrigation system writes water=40 the same tick a player
// writes water=25. Rival engine: two PLAYERS submit the same two writes.
// The committed value must be identical (max-fold, lossless) in both.
{
  const S = build(), P = build();
  S.g.registerSystem('irrigate', (view) =>
    [{ kind: 'setfield', target: S.c1, field: 'water', value: 40 }]);
  const rs = S.g.stepTick([{ actor: 'playerB', ops: [{ kind: 'setfield', target: S.c1, field: 'water', value: 25 }] }]);
  const rp = P.g.submit([
    { actor: 'playerA', ops: [{ kind: 'setfield', target: P.c1, field: 'water', value: 40 }] },
    { actor: 'playerB', ops: [{ kind: 'setfield', target: P.c1, field: 'water', value: 25 }] },
  ]);
  ok(rs.results.every(x => x.status === 'committed'), 'T2 fold: system tx AND player tx both committed');
  const sv = S.g._field(S.g.w.liveEntity(S.c1), 'water');
  const pv = P.g._field(P.g.w.liveEntity(P.c1), 'water');
  ok(sv === 40 && sv === pv, `T2 fold: system-vs-player folds to max=40, IDENTICAL to player-vs-player (${sv}===${pv})`);
  ok(rs.deferrals.length === 0 && rp.deferrals.length === 0, 'T2 fold: lossless — no deferral in either engine');
}
// DEFER case: a labeler system and a player contest `name` (label semantics).
// Neither side may win by arbitration; identical to player-vs-player.
{
  const S = build(), P = build();
  const before = S.g.w.name[S.g.w.liveEntity(S.c1)];
  S.g.registerSystem('labeler', () =>
    [{ kind: 'setfield', target: S.c1, field: 'name', value: 'sys-label' }]);
  const rs = S.g.stepTick([{ actor: 'playerB', ops: [{ kind: 'setfield', target: S.c1, field: 'name', value: 'player-label' }] }]);
  const rp = P.g.submit([
    { actor: 'playerA', ops: [{ kind: 'setfield', target: P.c1, field: 'name', value: 'sys-label' }] },
    { actor: 'playerB', ops: [{ kind: 'setfield', target: P.c1, field: 'name', value: 'player-label' }] },
  ]);
  ok(rs.deferrals.length === 1 && rs.deferrals[0].field === 'name', 'T2 defer: system-vs-player name clash DEFERRED (surfaced)');
  ok(S.g.w.name[S.g.w.liveEntity(S.c1)] === before, 'T2 defer: written by NEITHER side — prior value holds');
  ok(eq(
    rs.deferrals.map(d => [d.field, d.semantics, d.competing.map(c => c.value).sort()]),
    rp.deferrals.map(d => [d.field, d.semantics, d.competing.map(c => c.value).sort()])),
    'T2 defer: deferral shape IDENTICAL to the player-vs-player twin');
}

// --- T3: one tick is ONE undo step ------------------------------------------
{
  const { g } = build();
  g.enableHistory();
  g.registerSystem('growth', growthSystem);
  const before = cropSig(g);
  const r = g.stepTick();
  ok(r.committed >= 1 && !eq(cropSig(g), before), 'T3 tick mutated multiple crops');
  const u = g.undo();
  ok(u.ok && eq(cropSig(g), before), 'T3 ONE undo() reverses the WHOLE tick (all system writes)');
  ok(g.indexesConsistent(), 'T3 indexes consistent after undo');
  const rd = g.redo();
  ok(rd.ok && !eq(cropSig(g), before), 'T3 redo re-applies the tick');
}

// --- T4: 30-tick mixed run with structural systems ---------------------------
// spawner: the zone plants a new crop every 5 ticks (bounded).
// reaper: fully-grown crops (growth>=50) are harvested (deleted).
{
  const { g, zone } = build();
  g.registerSystem('growth', growthSystem);
  g.registerSystem('spawner', (view) =>
    view.tick % 5 === 0
      ? [{ kind: 'createChild', type: TYPE.CROP, parent: zone, props: { name: `crop-t${view.tick}`, water: 20, growth: 0 } }]
      : []);
  g.registerSystem('reaper', (view) =>
    view.allOfType('crop').filter(u => view.field(u, 'growth') >= 50)
      .map(u => ({ kind: 'delete', target: u })));
  let allConsistent = true, identityOk = true, sawSpawn = false, sawReap = false;
  for (let t = 0; t < 30; t++) {
    const r = g.stepTick();
    if (!g.indexesConsistent()) allConsistent = false;
    for (const [u, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== u) identityOk = false;
    for (const res of r.results) {
      if (res.actor === 'sys:spawner' && res.status === 'committed') sawSpawn = true;
      if (res.actor === 'sys:reaper' && res.status === 'committed') sawReap = true;
    }
  }
  ok(allConsistent, 'T4 indexes consistent after EVERY one of 30 ticks (spawn+delete mix)');
  ok(identityOk, 'T4 identity coherent every tick (no live handle to a destroyed slot)');
  ok(sawSpawn && sawReap, 'T4 structural systems ran: crops were planted AND harvested');
  ok(g.w.tombstones.size > 0, 'T4 reaped crops are tombstones (RD-004.6), not cleared rows');
}

// --- T5: registration order does not change committed state ------------------
{
  const mk = (order) => {
    const { g, c1 } = build();
    const systems = {
      growth: growthSystem,
      irrigate: (view) => view.allOfType('crop')
        .filter(u => view.field(u, 'water') < 5)
        .map(u => ({ kind: 'setfield', target: u, field: 'water', value: 8 })),
    };
    for (const n of order) g.registerSystem(n, systems[n]);
    for (let t = 0; t < 12; t++) g.stepTick();
    return cropSig(g);
  };
  ok(eq(mk(['growth', 'irrigate']), mk(['irrigate', 'growth'])),
    'T5 committed state IDENTICAL under reversed system registration order (RD-003 inherited)');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
