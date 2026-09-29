'use strict';
// =============================================================================
// RD-028 bar 2 — PONG, WRITTEN NATURALLY. Same game, same oracle as v1; the
// only difference is that RD-028's signed fields + `mul` let the author say what
// they mean. Compare against pong_rules.js (v1) rule for rule.
//
//   v1 (RD-027)                              v2 (RD-028)
//   vx=128 means zero, +3 is 131             vx = 3 means +3
//   negate: sub:[256,vx] then clamp          negate: mul:[vx,-1]
//   move:   x + (vx-128), clamped both ends  move: x + vx, clamped
//   bounce: 6 rules + 2 helper fields        bounce: 2 rules, 0 helper fields
//           + 2-tick lag + direction gate    + no lag (gate kept — see below)
//   16 rules, 4 unnatural encodings          11 rules, 1 encoding (none unnatural)
//
// The bounce is now a branchless line — the standard idiom, finally sayable:
//   vx' = vx + hit * (-2 * vx)      where hit = min(count(paddles near), 1)
// hit=0 -> vx unchanged; hit=1 -> vx - 2vx = -vx. No conditional keyword needed,
// no empty-pool trick, no materialization, no lag.
//
// HONEST CORRECTION (the v2 test caught this): the direction gate survives. It was
// assumed to be a lag artifact; it is not. Without it the ball re-reverses every
// tick it stays inside HIT_R and oscillates in place. Proximity is a CONDITION,
// not an EVENT — and that distinction, not the encoding, is the one real argument
// for edge-triggers. It is still expressible with a plain `where`, so `on:` stays
// unnecessary (RD-027 holds).
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, SPEED = 3, PADDLE_SPEED = 4, HIT_R = 14;
const GOAL_L = 2, GOAL_R = 253;

function buildWorld() {
  // RD-033 finding: `new Engine(64)` boots the FARM's vocabulary, so Pong used to
  // ship crop/fish/enemy/zone it never used — every world was "the farm plus your
  // types". An EMPTY schema was always supported; nobody had asked for one. Pong's
  // world now contains exactly paddle and ball, and nothing else.
  const g = new Engine(64, { schemaDefs: [] });
  const paddle = g.defineType({ name: 'paddle', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: 128 },
    input_dir: { range: [-1, 1], init: 0 },     // RD-028: SIGNED — -1 up, 0 none, +1 down
    side: { range: [0, 1], init: 0 },
    score: { range: [0, 255], init: 0 },
  } });
  const ball = g.defineType({ name: 'ball', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 128 }, y: { range: [0, H], init: 128 },
    vx: { range: [-8, 8], init: SPEED },        // RD-028: SIGNED — a velocity is a velocity
    vy: { range: [-8, 8], init: 0 },
  } });
  if (!paddle.ok || !ball.ok) throw new Error('schema: ' + JSON.stringify(paddle.errors ?? ball.errors));
  return { g, T: { paddle: paddle.type, ball: ball.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });
// hit = 1 if any entity of `type` (optionally filtered) is within HIT_R, else 0.
const hit = (type, where) => ({ min: [{ count: { type, ...(where ? { where } : {}), of: { near: HIT_R } } }, 1] });
const negate = (e) => ({ mul: [e, -1] });

const RULE_SET = [
  // ---- input: one rule instead of two, because direction is a SIGNED number ----
  // SCOPED (2026-07-17): the `where input_dir != 0` guard is not cosmetic. Without
  // it this rule matches EVERY paddle EVERY tick and writes y unconditionally —
  // and a branchless write of y+0 is still a WRITE of the field's current value.
  // So a player nudging a paddle directly (the editor's "move left paddle down",
  // a discrete y set) landed in the SAME tick as this rule's no-op y write, RD-005
  // DEFERRED both (two writers, no fold on a position field), and the paddle never
  // moved — the flagship NL command silently defeated in the very world it was
  // built for (MEASURED via intent2_e2e_pong_test.js). The guard scopes this rule
  // to when the paddle is actually being driven, so an idle paddle's y is free for
  // a direct write. Same lesson the vx bounce rules already carry, one writer over.
  { name: 'paddle_move', match: { type: 'paddle', where: { field: 'input_dir', cmp: '!=', value: 0 } },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { mul: [F('input_dir'), PADDLE_SPEED] }] }, 0, H) }] },

  // ---- motion: says exactly what it means ----
  { name: 'ball_move_x', match: { type: 'ball', where: { all: [
      { field: 'x', cmp: '>', value: GOAL_L }, { field: 'x', cmp: '<', value: GOAL_R }] } },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), F('vx')] }, 0, W) }] },
  { name: 'ball_move_y', match: { type: 'ball' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), F('vy')] }, 0, H) }] },

  // ---- wall bounce: negation is negation ----
  { name: 'bounce_top', match: { type: 'ball', where: { field: 'y', cmp: '<=', value: 0 } },
    effects: [{ set: 'vy', to: negate(F('vy')) }] },
  { name: 'bounce_bottom', match: { type: 'ball', where: { field: 'y', cmp: '>=', value: H } },
    effects: [{ set: 'vy', to: negate(F('vy')) }] },

  // ---- paddle bounce: branchless, no helper fields, no lag ----
  // vx' = vx + hit * (-2vx): hit=0 leaves vx alone, hit=1 flips it.
  //
  // The direction gate (`where vx < 0` + only LEFT paddles) is NOT an encoding
  // artifact — MEASURED 2026-07-16: without it the ball reverses every tick it
  // remains inside HIT_R and oscillates in place at x≈20, never scoring. That is
  // the real lesson: **proximity is a CONDITION that persists while overlapping,
  // not an EVENT that fires once.** The gate is the author stating "only when
  // travelling toward this paddle", which is semantically necessary in ANY
  // condition-based formulation. It costs one `where` and needs no new grammar.
  // MEASURED IN LIVE PLAY (2026-07-17, the user's session): a BRANCHLESS
  // conditional write is still an UNCONDITIONAL write. At the goal mouth this
  // rule wrote vx=-3 (a no-op value) in the same tick reset_from_left_goal wrote
  // vx=+3 — RD-005 correctly DEFERRED both, so the ball never turned around and
  // the right player farmed a point per round-trip (score hit 44) while the feed
  // spammed deferrals. Writers of a contested field must be SCOPED apart, exactly
  // like ball_move_x already was; the x-gates below are that scoping for vx.
  { name: 'bounce_paddle_left', match: { type: 'ball', where: { all: [
      { field: 'vx', cmp: '<', value: 0 }, { field: 'x', cmp: '>', value: GOAL_L }] } },
    effects: [{ set: 'vx', to: clamp({ add: [F('vx'),
      { mul: [hit('paddle', { field: 'side', cmp: '==', value: 0 }), { mul: [F('vx'), -2] }] }] }, -8, 8) }] },
  { name: 'bounce_paddle_right', match: { type: 'ball', where: { all: [
      { field: 'vx', cmp: '>', value: 0 }, { field: 'x', cmp: '<', value: GOAL_R }] } },
    effects: [{ set: 'vx', to: clamp({ add: [F('vx'),
      { mul: [hit('paddle', { field: 'side', cmp: '==', value: 1 }), { mul: [F('vx'), -2] }] }] }, -8, 8) }] },

  // ---- scoring by aggregation inversion (unchanged from v1 — it was already natural) ----
  { name: 'score_right', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 1 } },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'),
      { count: { type: 'ball', where: { field: 'x', cmp: '<=', value: GOAL_L } } }] }, 255] } }] },
  { name: 'score_left', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 0 } },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'),
      { count: { type: 'ball', where: { field: 'x', cmp: '>=', value: GOAL_R } } }] }, 255] } }] },

  // ---- reset ----
  { name: 'reset_from_left_goal', match: { type: 'ball', where: { field: 'x', cmp: '<=', value: GOAL_L } },
    effects: [{ set: 'x', to: 128 }, { set: 'vx', to: SPEED }] },
  { name: 'reset_from_right_goal', match: { type: 'ball', where: { field: 'x', cmp: '>=', value: GOAL_R } },
    effects: [{ set: 'x', to: 128 }, { set: 'vx', to: -SPEED }] },
];

function install(g) {
  return RULE_SET.map((r) => { const res = installRule(g, r); return { name: r.name, ok: res.ok, errors: res.errors }; });
}

module.exports = { buildWorld, RULE_SET, install, W, H, SPEED, PADDLE_SPEED, HIT_R, GOAL_L, GOAL_R };
