'use strict';
// =============================================================================
// RD-032 — A TOP-DOWN SHOOTER on the same rule system that runs Pong and the
// farm. Zero core edits. Every mechanic Pong never had: chase AI, damage,
// death, spawning, firing, kill-scoring.
//
// THE TWO TRICKS THAT CARRY IT (both predicted by the card, both confirmed):
//
// 1. AGGREGATION-AS-FETCH + CLAMP-AS-SIGN  (H2's workaround)
//    The grammar has no relational predicate: a rule cannot say "my x vs your x".
//    But a field-aggregation FETCHES another entity's value into an expression:
//        target = {"max":{"field":"x","type":"player"}}     // one player -> its x
//    and for integers, clamp(d,-1,1) IS sign(d):
//        step  = {"min":[{"max":[{"sub":[target, {"field":"x"}]}, -1]}, 1]}
//    So "walk toward the player" = x + sign(player.x - my.x). No new grammar.
//
// 2. HP AS THE CONDITIONAL LIFECYCLE
//    `{"delete":true}` has no conditional form and `where` cannot see aggregations,
//    so "die when shot" is NOT directly sayable. It splits into two rules:
//        hp   = max(hp - count{bullets near} * DMG, 0)     // aggregation -> a FIELD
//        die: match enemy where hp <= 0 -> delete           // `where` CAN see a field
//    The field is the bridge between an aggregation and a predicate.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255;
const PLAYER_SPEED = 2, BULLET_SPEED = 6, BULLET_LIFE = 40;
const HIT_R = 5, TOUCH_R = 6, DMG = 34;      // 3 bullets kill a 100hp enemy
const POOL = 6;                              // pre-spawned bullets (H3 workaround)

function buildWorld() {
  const g = new Engine(128, { schemaDefs: [] });   // RD-033: no farm types — this world is exactly its own vocabulary
  const player = g.defineType({ name: 'player', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 128 }, y: { range: [0, H], init: 128 },
    input_x: { range: [-1, 1], init: 0 }, input_y: { range: [-1, 1], init: 0 },
    fire: { range: [0, 1], init: 0 },
    hp: { range: [0, 255], init: 100 }, score: { range: [0, 255], init: 0 } } });
  const enemy = g.defineType({ name: 'enemy2', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 0 },
    hp: { range: [0, 255], init: 100 } } });
  const bullet = g.defineType({ name: 'bullet', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 0 },
    vx: { range: [-8, 8], init: 0 }, vy: { range: [-8, 8], init: 0 },
    life: { range: [0, 255], init: 0 } } });
  const spawner = g.defineType({ name: 'spawner', fields: { made: { range: [0, 255], init: 0 } } });
  for (const r of [player, enemy, bullet, spawner]) if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { g, T: { player: player.type, enemy: enemy.type, bullet: bullet.type, spawner: spawner.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const fetch1 = (field, type) => ({ max: { field, type } });          // one-of-a-kind -> its value
const sign = (e) => clamp(e, -1, 1);                                  // integer sign, via clamp

const RULE_SET = [
  // ---- player: input as state (same shape as Pong — it transferred unchanged) ----
  { name: 'player_move_x', match: { type: 'player' },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), { mul: [F('input_x'), PLAYER_SPEED] }] }, 0, W) }] },
  { name: 'player_move_y', match: { type: 'player' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('input_y'), PLAYER_SPEED] }] }, 0, H) }] },

  // ---- enemies CHASE: aggregation-as-fetch + clamp-as-sign (H2's workaround) ----
  { name: 'enemy_chase_x', match: { type: 'enemy2' },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), sign({ sub: [fetch1('x', 'player'), F('x')] })] }, 0, W) }] },
  { name: 'enemy_chase_y', match: { type: 'enemy2' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), sign({ sub: [fetch1('y', 'player'), F('y')] })] }, 0, H) }] },

  // ---- bullets: live ones fly and age; dead ones are recycled (H3's pool) ----
  { name: 'bullet_fly_x', match: { type: 'bullet', where: { field: 'life', cmp: '>', value: 0 } },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), F('vx')] }, 0, W) }] },
  { name: 'bullet_fly_y', match: { type: 'bullet', where: { field: 'life', cmp: '>', value: 0 } },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), F('vy')] }, 0, H) }] },
  { name: 'bullet_age', match: { type: 'bullet', where: { field: 'life', cmp: '>', value: 0 } },
    effects: [{ set: 'life', to: { max: [{ sub: [F('life'), 1] }, 0] } }] },
  // firing: a SPENT bullet teleports to the player and arms itself, but only while
  // the player holds fire. `fire` is fetched (it is the player's field, not the
  // bullet's) and multiplied in — 0 leaves life at 0, 1 arms it. This is the H3
  // workaround for static spawn props: recycle a pool instead of spawning at a point.
  { name: 'bullet_reload_x', match: { type: 'bullet', where: { field: 'life', cmp: '==', value: 0 } },
    effects: [{ set: 'x', to: fetch1('x', 'player') }] },
  { name: 'bullet_reload_y', match: { type: 'bullet', where: { field: 'life', cmp: '==', value: 0 } },
    effects: [{ set: 'y', to: fetch1('y', 'player') }] },
  { name: 'bullet_arm', match: { type: 'bullet', where: { field: 'life', cmp: '==', value: 0 } },
    effects: [{ set: 'life', to: { mul: [fetch1('fire', 'player'), BULLET_LIFE] } },
              { set: 'vx', to: { mul: [fetch1('input_x', 'player'), BULLET_SPEED] } },
              { set: 'vy', to: { mul: [fetch1('input_y', 'player'), BULLET_SPEED] } }] },

  // ---- damage: an aggregation becomes a FIELD, so a predicate can see it ----
  { name: 'enemy_take_damage', match: { type: 'enemy2' },
    effects: [{ set: 'hp', to: { max: [{ sub: [F('hp'),
      { mul: [{ count: { type: 'bullet', where: { field: 'life', cmp: '>', value: 0 }, of: { near: HIT_R } } }, DMG] }] }, 0] } }] },
  // ---- death: now expressible, because hp is a field `where` can read ----
  { name: 'enemy_die', match: { type: 'enemy2', where: { field: 'hp', cmp: '<=', value: 0 } },
    effects: [{ delete: true }] },

  // ---- the player takes contact damage from enemies (aggregation inversion) ----
  { name: 'player_take_damage', match: { type: 'player' },
    effects: [{ set: 'hp', to: { max: [{ sub: [F('hp'),
      { count: { type: 'enemy2', of: { near: TOUCH_R } } }] }, 0] } }] },

  // ---- score: count the TRANSITION in the same tick it happens. The dying enemy
  // is still visible to this rule (both read the same pre-tick view), so a kill is
  // counted exactly once — the tick it crosses hp<=0, before delete commits.
  { name: 'score_kills', match: { type: 'player' },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'),
      { count: { type: 'enemy2', where: { field: 'hp', cmp: '<=', value: 0 } } }] }, 255] } }] },

  // ---- bounded spawning (the farm's reseed shape, unchanged across genres) ----
  { name: 'spawn_enemies', match: { type: 'spawner' }, every: 20,
    effects: [{ spawn: { type: 'enemy2', props: { hp: 100, x: 10, y: 10 }, cap: 1 } }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors }; });
}

module.exports = { buildWorld, RULE_SET, install, POOL, W, H, HIT_R, TOUCH_R, DMG, BULLET_LIFE, PLAYER_SPEED };
