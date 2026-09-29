'use strict';
// =============================================================================
// RD-027 — PONG authored with NOTHING but today's grammar: no `on:` triggers,
// no engine edits, every rule through the RD-B6 gate.
//
// THE THREE MECHANISMS UNDER TEST
//   input-as-state        the client SETS paddle.input_dir; a rule READS it in `where`
//   near (RD-025)         collision IS proximity
//   aggregation inversion "when X, update Y" = match Y, aggregate over X
//
// THE KEY TRICK (and RD-027's real finding): the grammar has NO conditional
// expression, and `where` cannot reference an aggregation — so "reverse only if a
// paddle is near" looks unwritable. But **an aggregation over an EMPTY pool
// returns 0**, and 0 is the identity for + and -. So an aggregation IS a
// conditional: `vx + (delta from nearby paddles)` changes nothing when no paddle
// is near, and reverses when one is. No new grammar needed.
//
// ENCODINGS FORCED ON THE AUTHOR (H2 evidence, reported not hidden):
//   1. SIGNED VALUES: defineType ranges are unsigned, so velocity is OFFSET-encoded
//      (vx=128 is zero, 131 is +3, 125 is -3). Reads become sub:[vx,128];
//      negation becomes sub:[256,vx].
//   2. MATERIALIZED EXPRESSIONS: aggregations take a FIELD, not an expression, so
//      the reversal delta must be precomputed into a ball field (dl/dr) before a
//      paddle can aggregate it.
//   3. TWO-TICK LAG: ball writes dl -> paddle aggregates to pd -> ball applies.
//      Contact-to-reversal takes 2 ticks (6px at speed 3, well inside HIT_R=14).
//   4. DIRECTION GATING: `where vx<128` on the bounce rule is what stops the stale
//      delta re-firing; without it the 2-tick lag double-reverses.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const W = 255, H = 255, ZERO = 128, SPEED = 3, PADDLE_SPEED = 4, HIT_R = 14;
const GOAL_L = 2, GOAL_R = 253;

function buildWorld() {
  const g = new Engine(64);
  const paddle = g.defineType({ name: 'paddle', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: 0 }, y: { range: [0, H], init: ZERO },
    input_dir: { range: [0, 2], init: 0 },        // INPUT AS STATE: 0 none, 1 up, 2 down
    side: { range: [0, 1], init: 0 },             // 0 left, 1 right
    score: { range: [0, 255], init: 0 },
    pd: { range: [0, 255], init: 0 },             // reversal delta harvested from nearby balls
  } });
  const ball = g.defineType({ name: 'ball', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, W], init: ZERO }, y: { range: [0, H], init: ZERO },
    vx: { range: [0, 255], init: ZERO + SPEED },  // offset-encoded velocity
    vy: { range: [0, 255], init: ZERO },
    dl: { range: [0, 255], init: 0 },             // materialized: delta that reverses a LEFT-moving ball
    dr: { range: [0, 255], init: 0 },             // materialized: delta that reverses a RIGHT-moving ball
  } });
  if (!paddle.ok || !ball.ok) throw new Error('schema: ' + JSON.stringify(paddle.errors ?? ball.errors));
  return { g, T: { paddle: paddle.type, ball: ball.type } };
}

const F = (f) => ({ field: f });
const clamp = (e, lo, hi) => ({ min: [{ max: [e, lo] }, hi] });

const RULE_SET = [
  // ---- 1. INPUT. The whole `on:`-trigger question, answered in two rules: the
  // keypress is STATE, `where` is the trigger, the pipeline gates it like any tx.
  { name: 'paddle_up', match: { type: 'paddle', where: { field: 'input_dir', cmp: '==', value: 1 } },
    effects: [{ set: 'y', to: { max: [{ sub: [F('y'), PADDLE_SPEED] }, 0] } }] },
  { name: 'paddle_down', match: { type: 'paddle', where: { field: 'input_dir', cmp: '==', value: 2 } },
    effects: [{ set: 'y', to: { min: [{ add: [F('y'), PADDLE_SPEED] }, H] } }] },

  // ---- 2. MOTION. Gated away from the goal mouths so it never contests the reset
  // rules' write to x (RD-005 would DEFER both and freeze the ball — a real
  // conflict the grammar makes you resolve by construction).
  { name: 'ball_move_x', match: { type: 'ball', where: { all: [
      { field: 'x', cmp: '>', value: GOAL_L }, { field: 'x', cmp: '<', value: GOAL_R }] } },
    effects: [{ set: 'x', to: clamp({ add: [F('x'), { sub: [F('vx'), ZERO] }] }, 0, W) }] },
  { name: 'ball_move_y', match: { type: 'ball' },
    effects: [{ set: 'y', to: clamp({ add: [F('y'), { sub: [F('vy'), ZERO] }] }, 0, H) }] },

  // ---- 3. WALL BOUNCE. The CONDITION is the trigger; no event required.
  { name: 'bounce_top', match: { type: 'ball', where: { field: 'y', cmp: '<=', value: 0 } },
    effects: [{ set: 'vy', to: { min: [{ sub: [256, F('vy')] }, 255] } }] },
  { name: 'bounce_bottom', match: { type: 'ball', where: { field: 'y', cmp: '>=', value: H } },
    effects: [{ set: 'vy', to: { min: [{ sub: [256, F('vy')] }, 255] } }] },

  // ---- 4. PADDLE BOUNCE, in three hops (the aggregation-as-conditional trick).
  // (a) the ball materializes both reversal deltas. Each is 0 unless the ball is
  //     travelling that way, so only the relevant one is ever non-zero.
  { name: 'ball_delta_left', match: { type: 'ball' },     // 256-2vx > 0 only when vx < 128
    effects: [{ set: 'dl', to: clamp({ sub: [256, { add: [F('vx'), F('vx')] }] }, 0, 255) }] },
  { name: 'ball_delta_right', match: { type: 'ball' },    // 2vx-256 > 0 only when vx > 128
    effects: [{ set: 'dr', to: clamp({ sub: [{ add: [F('vx'), F('vx')] }, 256] }, 0, 255) }] },
  // (b) each paddle harvests the delta of balls within HIT_R. EMPTY POOL -> 0 is
  //     the conditional: no ball near => pd = 0 => the ball's arithmetic is a no-op.
  { name: 'paddle_harvest_left', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 0 } },
    effects: [{ set: 'pd', to: { max: { field: 'dl', type: 'ball', of: { near: HIT_R } } } }] },
  { name: 'paddle_harvest_right', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 1 } },
    effects: [{ set: 'pd', to: { max: { field: 'dr', type: 'ball', of: { near: HIT_R } } } }] },
  // (c) the ball applies the delta of paddles within HIT_R. `where` on direction is
  //     load-bearing: it stops the 2-tick-stale delta from double-reversing.
  { name: 'bounce_paddle_left', match: { type: 'ball', where: { field: 'vx', cmp: '<', value: ZERO } },
    effects: [{ set: 'vx', to: clamp({ add: [F('vx'),
      { max: { field: 'pd', type: 'paddle', where: { field: 'side', cmp: '==', value: 0 }, of: { near: HIT_R } } }] }, 0, 255) }] },
  { name: 'bounce_paddle_right', match: { type: 'ball', where: { field: 'vx', cmp: '>', value: ZERO } },
    effects: [{ set: 'vx', to: clamp({ sub: [F('vx'),
      { max: { field: 'pd', type: 'paddle', where: { field: 'side', cmp: '==', value: 1 }, of: { near: HIT_R } } }] }, 0, 255) }] },

  // ---- 5. SCORING by AGGREGATION INVERSION: the ball cannot write the paddle's
  // score (effects only write the matched entity), so the PADDLE counts balls in
  // the opposite goal. This is the HOMESTEAD `score` rule's exact shape.
  { name: 'score_right', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 1 } },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'),
      { count: { type: 'ball', where: { field: 'x', cmp: '<=', value: GOAL_L } } }] }, 255] } }] },
  { name: 'score_left', match: { type: 'paddle', where: { field: 'side', cmp: '==', value: 0 } },
    effects: [{ set: 'score', to: { min: [{ add: [F('score'),
      { count: { type: 'ball', where: { field: 'x', cmp: '>=', value: GOAL_R } } }] }, 255] } }] },

  // ---- 6. RESET (owns x at the goal mouths; ball_move_x is gated away from them)
  { name: 'reset_from_left_goal', match: { type: 'ball', where: { field: 'x', cmp: '<=', value: GOAL_L } },
    effects: [{ set: 'x', to: ZERO }, { set: 'vx', to: ZERO + SPEED }] },
  { name: 'reset_from_right_goal', match: { type: 'ball', where: { field: 'x', cmp: '>=', value: GOAL_R } },
    effects: [{ set: 'x', to: ZERO }, { set: 'vx', to: ZERO - SPEED }] },
];

function install(g) {
  const report = [];
  for (const r of RULE_SET) {
    const res = installRule(g, r);
    report.push({ name: r.name, ok: res.ok, errors: res.errors });
  }
  return report;
}

module.exports = { buildWorld, RULE_SET, install, W, H, ZERO, SPEED, PADDLE_SPEED, HIT_R, GOAL_L, GOAL_R };
