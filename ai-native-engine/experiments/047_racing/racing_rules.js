'use strict';
// =============================================================================
// RD-037 (bar 1) — RACING, the FIFTH genre, same rule grammar, ZERO core edits.
// The novel mechanic: THROTTLE physics (accelerate / coast-brake to a top speed)
// + LAP COUNTING (a per-car progress counter advanced by proximity, that must not
// double-count while sitting on the line).
//
// HONEST GRAMMAR LIMITS (stated, not hidden — the point of a coverage pass):
//  * NO TRIG. Integer determinism (RD-003) means no sin/cos, so there is no
//    free-heading steering. A car steers by axis velocity input (sx,sy ∈ {-1,0,1})
//    and moves x += sx*speed (mul, RD-028). This is grid/8-way steering, not a
//    physical heading — fine for kart/arcade racing, not a simulator.
//  * NO RELATIONAL PREDICATE ("the checkpoint whose idx == MY next_cp" — RD-032's
//    known gap; a `where` compares a field to a CONSTANT, not to the matched
//    entity's field). So ordered multi-checkpoint circuits are NOT directly
//    expressible. Worked around: lap = crossing ONE finish line, with an `armed`
//    flag set at a FAR marker on the far side, so a lap needs a real loop and the
//    line can't be farmed by idling on it. This reuses the platformer's
//    "proximity -> a field -> a where-condition" pattern (RD-036).
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, TOP = 8, NEAR_R = 18;
const FINISH_X = 20, FAR_X = 235, LANE_Y = 128;

function buildWorld() {
  const g = new Engine(64, { schemaDefs: [] });
  const car = g.defineType({ name: 'car', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: FINISH_X }, y: { range: [0, H], init: LANE_Y },
    speed: { range: [0, TOP], init: 0 },
    throttle: { range: [0, 1], init: 0 },              // input: 1 = accelerate, 0 = coast/brake
    sx: { range: [-1, 1], init: 0 }, sy: { range: [-1, 1], init: 0 },   // steer input (axis)
    laps: { range: [0, 255], init: 0 },
    armed: { range: [0, 1], init: 0 },                 // reached the far side since the last lap?
    near_fin: { range: [0, 1], init: 0 }, near_far: { range: [0, 1], init: 0 },
  } });
  const finish = g.defineType({ name: 'finish', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: FINISH_X }, y: { range: [0, H], init: LANE_Y } } });
  const marker = g.defineType({ name: 'marker', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: FAR_X }, y: { range: [0, H], init: LANE_Y } } });
  if (!car.ok || !finish.ok || !marker.ok) throw new Error('schema: ' + JSON.stringify(car.errors ?? finish.errors ?? marker.errors));
  return { g, T: { car: car.type, finish: finish.type, marker: marker.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const nearField = (type) => ({ min: [{ count: { type, of: { near: NEAR_R } } }, 1] });

const RULE_SET = [
  // throttle physics: accelerate on input, coast/brake otherwise. Scoped apart by
  // `throttle` so the two speed writers never contest (RD-035 at design time).
  { name: 'accelerate', match: { type: 'car', where: { field: 'throttle', cmp: '==', value: 1 } },
    effects: [{ set: 'speed', to: clamp({ add: [F('speed'), 1] }, 0, TOP) }] },
  { name: 'coast', match: { type: 'car', where: { field: 'throttle', cmp: '==', value: 0 } },
    effects: [{ set: 'speed', to: clamp({ add: [F('speed'), -1] }, 0, TOP) }] },

  // steering: move by (axis * speed). mul of a signed steer and speed (RD-028).
  { name: 'drive_x', match: { type: 'car' },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), { mul: [F('sx'), F('speed')] }] }, 0, W) }] },
  { name: 'drive_y', match: { type: 'car' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('sy'), F('speed')] }] }, 0, H) }] },

  // proximity -> flags (single-owner fields).
  { name: 'sense_finish', match: { type: 'car' }, effects: [{ set: 'near_fin', to: nearField('finish') }] },
  { name: 'sense_far', match: { type: 'car' }, effects: [{ set: 'near_far', to: nearField('marker') }] },

  // arm at the far side; a lap needs armed AND crossing the finish, then disarm —
  // so idling on the line does not farm laps (both guarded, so no contention).
  { name: 'arm', match: { type: 'car', where: { field: 'near_far', cmp: '==', value: 1 } },
    effects: [{ set: 'armed', to: 1 }] },
  { name: 'lap', match: { type: 'car', where: { all: [
      { field: 'armed', cmp: '==', value: 1 }, { field: 'near_fin', cmp: '==', value: 1 }] } },
    effects: [{ set: 'laps', to: clamp({ add: [F('laps'), 1] }, 0, 255) }, { set: 'armed', to: 0 }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors, warnings: res.warnings }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, TOP, NEAR_R, FINISH_X, FAR_X, LANE_Y };
