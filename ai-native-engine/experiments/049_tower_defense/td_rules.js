'use strict';
// =============================================================================
// RD-039 — TOWER DEFENSE, chosen for what it EXPOSES, not what it adds: it is the
// cleanest forcing function for RD-032's RELATIONAL-PREDICATE gap. Targeting and
// pathing ARE the genre, so — unlike racing, which dodged ordered checkpoints with
// a single finish line — TD cannot sidestep "act on the entity whose field relates
// to MY field." This experiment builds everything the grammar CAN express and then
// forces the two things it can't into the open as concrete gate verdicts (td_test).
//
// WHAT SURVIVES (this file), all field-vs-CONSTANT + aggregation-inversion:
//   * pathing as SPACE — an L-bend on x<CORNER then y (position thresholds, not a
//     per-enemy waypoint index). Fixed routes only.
//   * attack by INVERSION — an enemy near a tower damages ITSELF (area towers). The
//     tower never writes the enemy; the damaged entity owns the write.
//   * hp/death (latched at 0), leak (latched), life/money via global counts.
//
// WHAT DOES NOT (proven in td_test): single-target "shoot the nearest/strongest
// enemy" (a tower can't select OR write another entity), and per-enemy waypoint
// following ("toward waypoint whose idx == my progress" — where compares to a
// constant, never to the matched entity's own field).
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, SPEED = 3, DMG = 10, BOUNTY = 5, TOWER_R = 16;
const CORNER_X = 180, EXIT_Y = 200, START_LIFE = 20, ENEMY_HP = 30;

function buildWorld() {
  const g = new Engine(64, { schemaDefs: [] });
  const enemy = g.defineType({ name: 'enemy', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 40 },
    hp: { range: [0, 100], init: ENEMY_HP }, leaked: { range: [0, 1], init: 0 } } });
  const tower = g.defineType({ name: 'tower', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 100 }, y: { range: [0, H], init: 40 } } });
  const base = g.defineType({ name: 'base', fields: {   // non-spatial: holds game state
    life: { range: [0, START_LIFE], init: START_LIFE }, money: { range: [0, 999], init: 0 } } });
  for (const d of [enemy, tower, base]) if (!d.ok) throw new Error('schema: ' + JSON.stringify(d.errors));
  return { g, T: { enemy: enemy.type, tower: tower.type, base: base.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const alive = (extra = []) => ({ all: [{ field: 'hp', cmp: '>', value: 0 }, { field: 'leaked', cmp: '==', value: 0 }, ...extra] });

const RULE_SET = [
  // PATH AS SPACE: march right along the top, then turn down at the corner. The
  // "turn" is a POSITION THRESHOLD (x<CORNER vs x>=CORNER) — field-vs-constant, so
  // no relational predicate. Guards make these exclusive (no contention on x/y).
  { name: 'march_right', match: { type: 'enemy', where: alive([{ field: 'x', cmp: '<', value: CORNER_X }]) },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), SPEED] }, 0, W) }] },
  { name: 'march_down', match: { type: 'enemy', where: alive([{ field: 'x', cmp: '>=', value: CORNER_X }]) },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), SPEED] }, 0, H) }] },

  // ATTACK BY INVERSION: a living enemy loses hp for each tower within range (up to
  // 4 stacked). The tower never writes the enemy — the enemy owns its own hp write.
  // This is AREA targeting; it cannot single out "the nearest" (see td_test gap B).
  { name: 'take_damage', match: { type: 'enemy', where: { field: 'hp', cmp: '>', value: 0 } },
    effects: [{ set: 'hp', to: clamp({ add: [F('hp'),
      { mul: [{ min: [{ count: { type: 'tower', of: { near: TOWER_R } } }, 4] }, -DMG] }] }, 0, 100) }] },

  // LEAK: a living enemy that reaches the exit row latches leaked=1 (and stops — the
  // guards above exclude leaked enemies), so the exit can't be counted twice.
  { name: 'leak', match: { type: 'enemy', where: alive([{ field: 'y', cmp: '>=', value: EXIT_Y - 5 }]) },
    effects: [{ set: 'leaked', to: 1 }] },

  // BASE STATE: life = start − (enemies that leaked); money = (enemies killed) × bounty.
  // Both derived from latched flags via global counts, so they're stable. Single-owner.
  { name: 'base_life', match: { type: 'base' },
    effects: [{ set: 'life', to: clamp({ add: [START_LIFE,
      { mul: [{ count: { type: 'enemy', where: { field: 'leaked', cmp: '==', value: 1 } } }, -1] }] }, 0, START_LIFE) }] },
  { name: 'base_money', match: { type: 'base' },
    effects: [{ set: 'money', to: clamp({ mul: [
      { min: [{ count: { type: 'enemy', where: { field: 'hp', cmp: '==', value: 0 } } }, 100] }, BOUNTY] }, 0, 999) }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors, warnings: res.warnings }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, SPEED, DMG, BOUNTY, TOWER_R, CORNER_X, EXIT_Y, START_LIFE, ENEMY_HP };
