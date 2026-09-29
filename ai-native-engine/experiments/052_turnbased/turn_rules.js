'use strict';
// =============================================================================
// RD-041 — TURN-BASED TACTICAL, chosen for the assumption it makes IMPOSSIBLE to
// keep: "the engine is fundamentally real-time / rules fire every tick." If a
// turn-based game runs on the SAME grammar with ZERO core edits, the continuous
// tick is proven to be just a HEARTBEAT — turns are a STATE MACHINE built from
// rules + a broadcast phase, not an engine concept.
//
// The mechanism (no new engine anything):
//   * a `game` entity holds `phase` (0 = input, 1 = resolve) and a `turn` counter.
//   * every actor reads the global phase via count(game where phase==1) — a
//     field-vs-CONSTANT aggregation, the same broadcast trick as TD's key-count
//     and the platformer's on_ground. No relational predicate needed.
//   * ALL gameplay rules are gated on that resolve pulse, so BETWEEN turns nothing
//     happens no matter how many ticks pass — the game is turn-gated, not real-time.
//   * "end turn" is a plain TRANSACTION (set phase=1). Delayed effects (poison for
//     N turns, a bomb fuse) are COUNTDOWN FIELDS decremented on the resolve pulse —
//     "after 5 turns", not "after 300 ticks". Initiative is DATA (a field).
//
// EXPECTED WALL (measured in the test): AUTO-advancing initiative order — "activate
// the unit whose init is next after mine" — is the RD-032/RD-040 relational gap. So
// turn ORDER is player-driven here (a tx sets who's active); everything else is rules.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, POISON_DMG = 10;

function buildWorld() {
  const g = new Engine(64, { schemaDefs: [] });
  const game = g.defineType({ name: 'game', fields: {   // non-spatial: the turn state machine
    phase: { range: [0, 1], init: 0 }, turn: { range: [0, 255], init: 0 } } });
  const unit = g.defineType({ name: 'unit', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 0 }, hp: { range: [0, 100], init: 100 },
    active: { range: [0, 1], init: 0 },                  // whose turn (player-driven)
    mx: { range: [-4, 4], init: 0 }, my: { range: [-4, 4], init: 0 },   // QUEUED move intent
    poison: { range: [0, 10], init: 0 },                 // turns of poison remaining
    initv: { range: [0, 20], init: 0 },                  // initiative — DATA
    resolving: { range: [0, 1], init: 0 } } });
  const bomb = g.defineType({ name: 'bomb', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 128 }, y: { range: [0, H], init: 128 },
    fuse: { range: [0, 10], init: 3 }, boom: { range: [0, 1], init: 0 }, resolving: { range: [0, 1], init: 0 } } });
  for (const d of [game, unit, bomb]) if (!d.ok) throw new Error('schema: ' + JSON.stringify(d.errors));
  return { g, T: { game: game.type, unit: unit.type, bomb: bomb.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
const resolvePulse = { min: [{ count: { type: 'game', where: { field: 'phase', cmp: '==', value: 1 } } }, 1] };

const RULE_SET = [
  // every actor senses the global resolve phase (broadcast via a constant-filter count).
  { name: 'sense_unit', match: { type: 'unit' }, effects: [{ set: 'resolving', to: resolvePulse }] },
  { name: 'sense_bomb', match: { type: 'bomb' }, effects: [{ set: 'resolving', to: resolvePulse }] },

  // the ACTIVE unit executes its QUEUED move — only on the resolve pulse.
  { name: 'do_move', match: { type: 'unit', where: { all: [
      { field: 'active', cmp: '==', value: 1 }, { field: 'resolving', cmp: '==', value: 1 }] } },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), F('mx')] }, 0, W) }, { set: 'y', to: clamp({ add: [F('y'), F('my')] }, 0, H) }] },

  // delayed effect #1: poison ticks once PER TURN (not per tick) until it wears off.
  { name: 'poison_tick', match: { type: 'unit', where: { all: [
      { field: 'poison', cmp: '>', value: 0 }, { field: 'resolving', cmp: '==', value: 1 }] } },
    effects: [{ set: 'hp', to: clamp({ add: [F('hp'), -POISON_DMG] }, 0, 100) }, { set: 'poison', to: clamp({ add: [F('poison'), -1] }, 0, 10) }] },

  // delayed effect #2: a bomb fuse counts down per turn; at 0 it detonates ("after N turns").
  { name: 'bomb_fuse', match: { type: 'bomb', where: { all: [
      { field: 'fuse', cmp: '>', value: 0 }, { field: 'resolving', cmp: '==', value: 1 }] } },
    effects: [{ set: 'fuse', to: clamp({ add: [F('fuse'), -1] }, 0, 10) }] },
  { name: 'bomb_boom', match: { type: 'bomb', where: { all: [
      { field: 'fuse', cmp: '==', value: 0 }, { field: 'boom', cmp: '==', value: 0 }] } },
    effects: [{ set: 'boom', to: 1 }] },

  // end-of-resolve: advance the turn counter and return to input phase.
  { name: 'advance_turn', match: { type: 'game', where: { field: 'phase', cmp: '==', value: 1 } },
    effects: [{ set: 'phase', to: 0 }, { set: 'turn', to: clamp({ add: [F('turn'), 1] }, 0, 255) }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors, warnings: res.warnings }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, POISON_DMG };
