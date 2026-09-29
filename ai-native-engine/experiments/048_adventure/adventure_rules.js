'use strict';
// =============================================================================
// RD-038 (bar 1) — ACTION/ADVENTURE, the SIXTH genre, same grammar, ZERO core
// edits. The novel mechanic no prior genre had: COLLECTIBLES + INVENTORY +
// CONDITIONAL WORLD-UNLOCK — pick up keys, and a gate OPENS once you hold enough.
// This is the quest/progression shape: accumulated state changing the world.
// Combat (proximity damage, defeat) is folded in to show it COMPOSES with the
// shooter's proven mechanics in one world.
//
// Everything expressible with no gaps — the unlock threshold is a CONSTANT, so no
// relational predicate is needed (a gate asks `count(player where keys >= 2)`,
// field-vs-constant, which the grammar has). Counts are clamped for the range
// proof (RD-B1): a field's value can never exceed its declared range.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, NEAR_R = 16, KEYS_NEEDED = 2, MAX_KEYS = 16, DMG = 10;

function buildWorld() {
  const g = new Engine(64, { schemaDefs: [] });
  const player = g.defineType({ name: 'player', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 10 }, y: { range: [0, H], init: 128 },
    vx: { range: [-4, 4], init: 0 }, vy: { range: [-4, 4], init: 0 },   // input velocity
    keys: { range: [0, MAX_KEYS], init: 0 }, hp: { range: [0, 100], init: 100 },
  } });
  const item = g.defineType({ name: 'item', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 128 }, taken: { range: [0, 1], init: 0 } } });
  const gate = g.defineType({ name: 'gate', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 200 }, y: { range: [0, H], init: 128 }, open: { range: [0, 1], init: 0 } } });
  const foe = g.defineType({ name: 'foe', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 100 }, y: { range: [0, H], init: 128 }, hp: { range: [0, 100], init: 30 } } });
  for (const d of [player, item, gate, foe]) if (!d.ok) throw new Error('schema: ' + JSON.stringify(d.errors));
  return { g, T: { player: player.type, item: item.type, gate: gate.type, foe: foe.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const nearOne = (type, where) => ({ min: [{ count: { type, ...(where ? { where } : {}), of: { near: NEAR_R } } }, 1] });

const RULE_SET = [
  // player movement (velocity input) — the only unconditional self-writes.
  { name: 'move_x', match: { type: 'player' }, effects: [{ set: 'x', to: clamp({ add: [F('x'), F('vx')] }, 0, W) }] },
  { name: 'move_y', match: { type: 'player' }, effects: [{ set: 'y', to: clamp({ add: [F('y'), F('vy')] }, 0, H) }] },

  // COLLECT: an untaken item near a player becomes taken (guarded: stops firing
  // once taken — a one-way latch, single owner of `taken`, no contention).
  { name: 'collect', match: { type: 'item', where: { field: 'taken', cmp: '==', value: 0 } },
    effects: [{ set: 'taken', to: nearOne('player') }] },

  // INVENTORY: a player's key count = the number of taken items (clamped for the
  // range proof). Single owner of `keys`; reads no field of its own, so no advisory.
  { name: 'inventory', match: { type: 'player' },
    effects: [{ set: 'keys', to: { min: [{ count: { type: 'item', where: { field: 'taken', cmp: '==', value: 1 } } }, MAX_KEYS] } }] },

  // UNLOCK: the gate opens once a player holds >= KEYS_NEEDED keys. The threshold
  // is a CONSTANT, so this needs no relational predicate — field-vs-constant only.
  { name: 'unlock', match: { type: 'gate' },
    effects: [{ set: 'open', to: { min: [{ count: { type: 'player', where: { field: 'keys', cmp: '>=', value: KEYS_NEEDED } } }, 1] } }] },

  // COMBAT (composes with the shooter): a living foe near a player loses hp; at 0
  // it is defeated. Guarded on hp>0 so it is not an unconditional self-write.
  { name: 'foe_hurt', match: { type: 'foe', where: { field: 'hp', cmp: '>', value: 0 } },
    effects: [{ set: 'hp', to: clamp({ add: [F('hp'), { mul: [nearOne('player'), -DMG] }] }, 0, 100) }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors, warnings: res.warnings }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, NEAR_R, KEYS_NEEDED, MAX_KEYS };
