'use strict';
// =============================================================================
// RD-023 H2 probe — deliberately construct the D&H/Crop-#142-shaped bug at
// motion granularity: two actors write conflicting values to the SAME entity's
// motion state in the SAME frame, via the ungated path. Question: is the loss
// (a) genuine silent state corruption (the class this project exists to stop),
// or (b) cosmetic/self-correcting? Split by WRITE TYPE, because they differ:
//   1. held-input (re-asserted every frame, e.g. steering)
//   2. impulse (one-shot, e.g. knockback) — fires once, never re-sent
// Then the same conflict through the GATED path to show RD-005 catches it.
// =============================================================================
const path = require('node:path');
const { Engine, TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const { createMotion } = require('./motion_system.js');
const { buildWorld, unsafeCheck } = require('./gated_events.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const DT = 1 / 60;

// ---- case 1: held input, ungated — both actors write vx every frame ----------
{
  const m = createMotion(1);
  m.x[0] = 500; m.vx[0] = 0; m.vy[0] = 0; m.y[0] = 500;
  for (let f = 0; f < 60; f++) {
    m.vx[0] = +10;      // actor A (applied first every frame)
    m.vx[0] = -10;      // actor B (applied second every frame) — LWW, A silently gone
    m.integrate(DT);
  }
  ok(Math.abs(m.x[0] - (500 - 10)) < 1e-9, `held-input LWW: B fully wins (x=${m.x[0].toFixed(2)}, A's +10 contributed nothing, NO error raised)`);
  // classification: the loss is DETERMINISTIC and REPEATED — but each frame's
  // loss is identical, and the state is re-derivable from who-writes-last. It
  // is unfair (one player's stick does nothing) yet self-consistent: no
  // corruption accumulates beyond what frame-1 already shows.
}

// ---- case 2: impulse, ungated — knockback fired ONCE, then overwritten -------
{
  const m = createMotion(1);
  m.x[0] = 500; m.vx[0] = 0; m.vy[0] = 0; m.y[0] = 500;
  m.vx[0] += 50;        // actor A: one-shot knockback impulse (never re-sent)
  m.vx[0] = -10;        // actor B: steering write, same frame — impulse ERASED
  for (let f = 0; f < 60; f++) m.integrate(DT);
  const withBoth = 500 + (50 - 10) * 1; // what compose-both physics would give after 1s
  ok(m.x[0].toFixed(2) === '490.00',
    `impulse LWW: knockback PERMANENTLY erased (x=${m.x[0].toFixed(2)}, compose-both would be ~${withBoth}) — one-shot gameplay state silently lost, never self-corrects`);
  // classification: this IS the Crop-#142 class — a meaningful one-shot state
  // transition destroyed with no error, no trace, diverging forever after.
}

// ---- case 3: the same conflict through the GATED path -------------------------
// What distinguishes the gate from LWW is NOT that every conflict defers — it
// is that the outcome never depends on ARRIVAL ORDER (RD-005: foldable fields
// fold deterministically and losslessly; opaque fields defer, surfaced).
{
  const run = (order) => {
    const { engine, uuids } = buildWorld(Engine, TYPE, 1);
    const txA = { actor: 'A', ops: [{ kind: 'setfield', target: uuids[0], field: 'water', value: 200 }] };
    const txB = { actor: 'B', ops: [{ kind: 'setfield', target: uuids[0], field: 'water', value: 10 }] };
    const r = engine.stepTick(order === 'AB' ? [txA, txB] : [txB, txA]);
    return { v: engine._systemView().field(uuids[0], 'water'), defer: r.deferrals.length, unsafe: unsafeCheck(engine) };
  };
  const ab = run('AB'), ba = run('BA');
  console.log(`  gated numeric conflict: AB -> water=${ab.v}, BA -> water=${ba.v} (crop.water folds as 'max')`);
  ok(ab.v === ba.v && ab.v === 200, `gated numeric conflict is ORDER-INDEPENDENT (fold=max -> 200 both ways) — the ungated path above gave x=490 vs would-be different under swapped order`);
  ok(ab.unsafe === 0 && ba.unsafe === 0, 'gated path: world invariants intact after the conflict');
}
{ // opaque field (crop.name is 'label') -> the gate DEFERS, surfacing the conflict
  const { engine, uuids } = buildWorld(Engine, TYPE, 1);
  const r = engine.stepTick([
    { actor: 'A', ops: [{ kind: 'setfield', target: uuids[0], field: 'name', value: 'Ada' }] },
    { actor: 'B', ops: [{ kind: 'setfield', target: uuids[0], field: 'name', value: 'Bob' }] },
  ]);
  console.log(`  gated label conflict: deferrals=${r.deferrals.length}, statuses=${r.results.map((x) => x.status).join(',')}`);
  ok(r.deferrals.length > 0, 'gated opaque conflict is DEFERRED and surfaced, not silently arbitrated');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS + FAIL} checks, ${FAIL} failed`);
console.log(`
VERDICT (H2): split by write type —
  held-input motion writes: LWW loss is unfair-but-bounded; it does not
    accumulate hidden corruption (H1-compatible: may stay ungated, though a
    real game should COMPOSE inputs, not overwrite).
  impulse/one-shot writes: genuine silent permanent loss — the Crop-#142
    class at 60fps. These MUST go through the gate. They are, by nature,
    DISCRETE EVENTS — which is exactly the boundary H1 proposes. So H2's
    support, where real, lands on the same side as H1's layering.`);
process.exit(FAIL ? 1 : 0);
