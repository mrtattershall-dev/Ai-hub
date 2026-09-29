'use strict';
// =============================================================================
// RD-027 bars 1-3 — does Pong actually PLAY, with zero core edits, every rule
// through the gate, asserted against a hand-computed oracle? `node pong_test.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { buildWorld, install, RULE_SET, ZERO, SPEED, GOAL_L } = require('./pong_rules.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

const { g, T } = buildWorld();
const rep = install(g);
const bad = rep.filter((r) => !r.ok);
ok(bad.length === 0, `all ${RULE_SET.length} Pong rules pass the RD-B6 gate`
  + (bad.length ? `\n     REJECTED: ${JSON.stringify(bad, null, 1)}` : ''));
if (bad.length) { console.log(`\nFAIL — the grammar could not express Pong; see rejections above`); process.exit(1); }

// left paddle at x=8, right at x=247; ball starts centre, moving LEFT at 3/tick
const pL = g.spawn(T.paddle, { name: 'left', x: 8, y: 128, side: 0 }).uuid;
const pR = g.spawn(T.paddle, { name: 'right', x: 247, y: 200, side: 1 }).uuid;
const ball = g.spawn(T.ball, { name: 'ball', x: 128, y: 128, vx: ZERO - SPEED, vy: ZERO }).uuid;
const v = () => g._systemView();
const f = (u, k) => v().field(u, k);

// ---- input-as-state: the paddle moves because a TX set its input field --------
const y0 = f(pL, 'y');
g.submit([{ actor: 'p1', ops: [{ kind: 'setfield', target: pL, field: 'input_dir', value: 1 }] }]);
g.stepTick();
ok(f(pL, 'y') === y0 - 4, `input-as-state: a gated tx set input_dir=1 and the paddle MOVED (${y0} -> ${f(pL, 'y')}) — no 'on:' trigger involved`);
g.submit([{ actor: 'p1', ops: [{ kind: 'setfield', target: pL, field: 'input_dir', value: 0 }] }]);
g.stepTick();
const yHold = f(pL, 'y');
g.stepTick();
ok(f(pL, 'y') === yHold, 'input released (input_dir=0): the paddle STOPS — the condition is the trigger');

// ---- the ball travels left, hand-oracle: 3px/tick ----------------------------
const xBefore = f(ball, 'x');
g.stepTick();
ok(f(ball, 'x') === xBefore - SPEED, `ball moves left ${xBefore} -> ${f(ball, 'x')} (offset-encoded vx=${f(ball, 'vx')} means ${f(ball, 'vx') - ZERO})`);

// ---- run the rally until the ball reaches the left paddle --------------------
// paddle_l is at (8,124) after the input nudge; the ball is at y=128 travelling
// straight left, so it MUST pass within HIT_R and reverse.
let reversedAt = null, minX = 999;
for (let t = 0; t < 80 && reversedAt === null; t++) {
  g.stepTick();
  const x = f(ball, 'x'), vx = f(ball, 'vx');
  minX = Math.min(minX, x);
  if (vx > ZERO) reversedAt = { t, x, vx };
}
ok(reversedAt !== null, `the ball BOUNCED off the paddle: vx flipped to +${reversedAt ? reversedAt.vx - ZERO : '?'} at x=${reversedAt ? reversedAt.x : '?'}`);
ok(reversedAt && reversedAt.x > GOAL_L, `it bounced BEFORE the goal line (x=${reversedAt?.x} > ${GOAL_L}) — proximity, not luck`);
ok(Math.abs((reversedAt?.vx ?? 0) - (ZERO + SPEED)) <= 1,
  `speed is preserved through the bounce (|vx|=${Math.abs((reversedAt?.vx ?? 0) - ZERO)}, was ${SPEED})`);

// ---- it must NOT double-reverse (the 2-tick-lag hazard the where-gate stops) --
const vxAfter = f(ball, 'vx');
g.stepTick(); g.stepTick();
ok(f(ball, 'vx') === vxAfter, `no double-reversal on the following ticks (vx stayed ${vxAfter}) — the direction gate holds`);

// ---- the ball now travels right; the right paddle is at y=200, ball at y~128,
// so it MISSES, and the LEFT player scores by aggregation inversion -------------
const scoreBefore = f(pL, 'score');
let scored = null;
for (let t = 0; t < 120 && scored === null; t++) {
  g.stepTick();
  if (f(pL, 'score') > scoreBefore) scored = { t, x: f(ball, 'x') };
}
ok(scored !== null, `LEFT player scored when the ball passed the right paddle (score ${scoreBefore} -> ${f(pL, 'score')}) — the paddle COUNTED the ball; the ball never wrote the paddle`);
ok(f(ball, 'x') === ZERO, `the ball RESET to centre after the goal (x=${f(ball, 'x')})`);
ok(f(pR, 'score') === 0, 'the right player did NOT score (aggregation inversion is side-correct)');

// ---- invariants after a full rally -------------------------------------------
let unsafe = 0;
if (!g.indexesConsistent()) unsafe++;
for (const [uu, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== uu) unsafe++;
ok(unsafe === 0, 'unsafe sweep: 0 after the full rally');

// ---- determinism: the same script replays identically -------------------------
function replay() {
  const { g: g2, T: T2 } = buildWorld();
  install(g2);
  const a = g2.spawn(T2.paddle, { name: 'left', x: 8, y: 128, side: 0 }).uuid;
  g2.spawn(T2.paddle, { name: 'right', x: 247, y: 200, side: 1 });
  const b = g2.spawn(T2.ball, { name: 'ball', x: 128, y: 128, vx: ZERO - SPEED, vy: ZERO }).uuid;
  g2.submit([{ actor: 'p1', ops: [{ kind: 'setfield', target: a, field: 'input_dir', value: 1 }] }]);
  const trace = [];
  for (let t = 0; t < 60; t++) { g2.stepTick(); trace.push(`${g2._systemView().field(b, 'x')},${g2._systemView().field(b, 'vx')}`); }
  return trace.join('|');
}
ok(replay() === replay(), 'deterministic: two identical runs produce identical ball traces');

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-027: Pong on today's grammar, zero core edits`);
process.exit(FAIL ? 1 : 0);
