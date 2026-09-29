'use strict';
// =============================================================================
// RD-036 (bar 1) — PLATFORMER, the FOURTH genre, on the same rule grammar with
// ZERO core edits. Farm (idle) → Pong (real-time 2p) → shooter (top-down) →
// platformer. The novel mechanic no prior genre had: GRAVITY (a constant
// downward acceleration on vy) + GROUND CONTACT as a STATE, where "standing on a
// platform" is a PROXIMITY CONDITION that persists while overlapping — RD-028's
// lesson ("proximity is a condition, not an event") is exactly what a platformer
// needs, so it should fall out of the existing grammar. No `on:` triggers, no new
// engine concept: gravity is arithmetic, the grounded flag is an aggregation over
// nearby platforms, jump is a guarded impulse.
//
// Physics, all as condition→effect rules through the RD-B6 gate:
//   ground_check : on_ground = min(count(platform within R), 1)   (proximity ⇒ grounded)
//   gravity      : where NOT grounded → vy += G   (fall faster; guarded so it can't
//                  contest the landing write — the RD-035 lesson, applied up front)
//   land         : where grounded AND falling → vy = 0            (stop at the surface)
//   jump         : where jump-input AND grounded → vy = -JUMP      (guarded impulse)
//   move_y       : y += vy                                        (apply velocity)
//
// NEAR_R is deliberately ≥ the max fall step (VY_MAX) so the player cannot tunnel
// THROUGH the platform's grounded-band in one tick (a real platformer bug; here
// the band [plat.y ± R] is wider than one move, so landing is always detected).
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, G = 1, VY_MAX = 8, JUMP = 6, NEAR_R = 16;
const PLAT_X = 128, PLAT_Y = 200;

function buildWorld() {
  const g = new Engine(64, { schemaDefs: [] });      // no farm vocabulary; a platformer's own words
  const player = g.defineType({ name: 'player', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 128 }, y: { range: [0, H], init: 40 },
    vy: { range: [-VY_MAX, VY_MAX], init: 0 },        // RD-028 signed: a velocity is a velocity
    on_ground: { range: [0, 1], init: 0 },
    jump: { range: [0, 1], init: 0 },                 // input, set by the player through the gate
  } });
  const platform = g.defineType({ name: 'platform', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: PLAT_X }, y: { range: [0, H], init: PLAT_Y },
  } });
  if (!player.ok || !platform.ok) throw new Error('schema: ' + JSON.stringify(player.errors ?? platform.errors));
  return { g, T: { player: player.type, platform: platform.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
// grounded = 1 if any platform is within NEAR_R of the player, else 0 (RD-025 near,
// RD-027 aggregation-as-conditional: count over an empty neighbourhood is 0).
const grounded = { min: [{ count: { type: 'platform', of: { near: NEAR_R } } }, 1] };

const RULE_SET = [
  // recompute the grounded flag from proximity every tick. Unguarded, but it does
  // NOT read on_ground (it derives it from platforms), and nothing else writes
  // on_ground — so it is the sole owner of the field, no contention. (RD-035)
  { name: 'ground_check', match: { type: 'player' },
    effects: [{ set: 'on_ground', to: grounded }] },

  // gravity: only while airborne. The `where` is the RD-035 fix applied at design
  // time — an unguarded vy write would contest the landing/jump writes every tick.
  { name: 'gravity', match: { type: 'player', where: { field: 'on_ground', cmp: '==', value: 0 } },
    effects: [{ set: 'vy', to: clamp({ add: [F('vy'), G] }, -VY_MAX, VY_MAX) }] },

  // land: grounded and still moving down ⇒ arrest the fall. Scoped apart from
  // gravity (on_ground==0 vs ==1) so the two never contest vy.
  { name: 'land', match: { type: 'player', where: { all: [
      { field: 'on_ground', cmp: '==', value: 1 }, { field: 'vy', cmp: '>', value: 0 }] } },
    effects: [{ set: 'vy', to: 0 }] },

  // jump: a guarded impulse — only when grounded and the input is held.
  { name: 'jump', match: { type: 'player', where: { all: [
      { field: 'jump', cmp: '==', value: 1 }, { field: 'on_ground', cmp: '==', value: 1 }] } },
    effects: [{ set: 'vy', to: -JUMP }] },

  // apply velocity. Unguarded self-write to y (y = y + vy) — the SAME shape as
  // Pong's ball_move_y; the RD-035 advisory correctly flags it as "physics owns y,
  // confirm intended", and the author confirms. Kept unguarded on purpose.
  { name: 'move_y', match: { type: 'player' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), F('vy')] }, 0, H) }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors, warnings: res.warnings }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, G, VY_MAX, JUMP, NEAR_R, PLAT_X, PLAT_Y };
