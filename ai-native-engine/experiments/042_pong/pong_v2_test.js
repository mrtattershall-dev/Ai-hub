'use strict';
// =============================================================================
// RD-028 bars 2-4 — the naturally-written Pong must play the SAME game as v1,
// the proof must still bite on signed/multiply, and signs must survive the
// stack (folds, persistence, the RD-025 grid). `node pong_v2_test.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const P = CORE('persistence.js');
const V2 = require('./pong_rules_v2.js');
const V1 = require('./pong_rules.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// ---- bar 2: it installs and PLAYS the same game -------------------------------
const { g, T } = V2.buildWorld();
const rep = V2.install(g);
const bad = rep.filter((r) => !r.ok);
ok(bad.length === 0, `all ${V2.RULE_SET.length} naturally-written rules pass the RD-B6 gate`
  + (bad.length ? `\n     REJECTED: ${JSON.stringify(bad, null, 1)}` : ''));
if (bad.length) { console.log('\nFAIL — natural form rejected'); process.exit(1); }

const pL = g.spawn(T.paddle, { name: 'left', x: 8, y: 128, side: 0 }).uuid;
const pR = g.spawn(T.paddle, { name: 'right', x: 247, y: 200, side: 1 }).uuid;
const ball = g.spawn(T.ball, { name: 'ball', x: 128, y: 128, vx: -V2.SPEED, vy: 0 }).uuid;
const f = (u, k) => g._systemView().field(u, k);

ok(f(ball, 'vx') === -3, `SIGNED velocity is stored as itself: vx = ${f(ball, 'vx')} (v1 needed 125 to mean -3)`);

// input: one signed field, one rule
g.submit([{ actor: 'p1', ops: [{ kind: 'setfield', target: pL, field: 'input_dir', value: -1 }] }]);
g.stepTick();
ok(f(pL, 'y') === 124, `input_dir=-1 moves the paddle UP (128 -> ${f(pL, 'y')}) — one signed field, one rule`);
g.submit([{ actor: 'p1', ops: [{ kind: 'setfield', target: pL, field: 'input_dir', value: 0 }] }]);
g.stepTick();
const yh = f(pL, 'y'); g.stepTick();
ok(f(pL, 'y') === yh, 'input_dir=0 stops the paddle (mul by 0 — no branch needed)');

// the rally: ball travels left, must bounce off the paddle
let bounce = null;
for (let t = 0; t < 80 && bounce === null; t++) {
  g.stepTick();
  if (f(ball, 'vx') > 0) bounce = { x: f(ball, 'x'), vx: f(ball, 'vx') };
}
ok(bounce !== null, `the ball BOUNCED: vx ${-V2.SPEED} -> ${bounce?.vx} at x=${bounce?.x} — ONE branchless rule, no helper fields`);
ok(bounce && bounce.vx === V2.SPEED, `speed preserved exactly (${bounce?.vx} === ${V2.SPEED})`);
ok(bounce && bounce.x > V2.GOAL_L, `bounced before the goal (x=${bounce?.x})`);

// no double-reversal — v1 needed a direction gate for this; v2 needs nothing,
// because hit*(-2vx) is applied to the CURRENT vx with no lag.
const vxA = f(ball, 'vx'); g.stepTick();
const vxB = f(ball, 'vx');
ok(vxA === vxB && vxB === V2.SPEED,
  `no re-reversal while still inside the paddle's radius (vx stayed +${vxB}) — the direction gate is doing REAL work: proximity is a condition, not an event`);

// scoring by aggregation inversion still works
const s0 = f(pL, 'score');
let scored = false;
for (let t = 0; t < 140 && !scored; t++) { g.stepTick(); if (f(pL, 'score') > s0) scored = true; }
ok(scored, `LEFT scored when the ball passed the right paddle (score ${s0} -> ${f(pL, 'score')})`);
ok(f(ball, 'x') === 128, `ball reset to centre (x=${f(ball, 'x')})`);

// ---- the authoring delta (the POINT of the card) ------------------------------
ok(V2.RULE_SET.length < V1.RULE_SET.length,
  `AUTHORING DELTA: ${V1.RULE_SET.length} rules (v1, 4 unnatural encodings) -> ${V2.RULE_SET.length} rules (v2, 0 encodings)`);

// ---- bar 3: the proof still bites ---------------------------------------------
{
  const { g: g3, T: T3 } = V2.buildWorld();
  const overflow = installRule(g3, { name: 'bad_mul', match: { type: 'ball' },
    effects: [{ set: 'vx', to: { mul: [{ field: 'vx' }, { field: 'vx' }] } }] });   // [-8,8]^2 = [-64,64] vs range [-8,8]
  ok(!overflow.ok && overflow.errors.some((e) => e.code === 'range_unprovable'),
    'an unprovable MULTIPLY is refused range_unprovable (interval = the 4 corner products)');
  const under = installRule(g3, { name: 'bad_sub', match: { type: 'ball' },
    effects: [{ set: 'vx', to: { sub: [{ field: 'vx' }, 5] } }] });                 // [-13,3] vs [-8,8]
  ok(!under.ok && under.errors.some((e) => e.code === 'range_unprovable'),
    'a signed UNDERFLOW is refused (the proof is sign-aware, not just overflow-aware)');
  const good = installRule(g3, { name: 'ok_mul', match: { type: 'ball' },
    effects: [{ set: 'vx', to: { min: [{ max: [{ mul: [{ field: 'vx' }, 2] }, -8] }, 8] } }] });
  ok(good.ok, 'the same multiply with an author-stated clamp installs');
  const tooWide = g3.defineType({ name: 'huge', fields: { v: { range: [-3000000000, 3000000000] } } });
  ok(!tooWide.ok && tooWide.errors.some((e) => e.code === 'bad_range'), 'a signed range beyond Int32 is refused at defineType');
}

// ---- bar 4: sign safety across the stack --------------------------------------
{
  const g4 = new Engine(32);
  const S = g4.defineType({ name: 'thing', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 },
    temp: { range: [-128, 127], fold: 'min', init: 0 },
    drift: { range: [-32768, 32767], fold: 'additive', init: 0 } } });
  const u = g4.spawn(S.type, { name: 't', x: 10, y: 10, temp: -40, drift: -1000 }).uuid;
  ok(g4._systemView().field(u, 'temp') === -40, 'Int8 pool round-trips a negative (-40)');
  ok(g4._systemView().field(u, 'drift') === -1000, 'Int16 pool round-trips -1000');
  // fold over negatives: two actors, min-fold
  g4.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: u, field: 'temp', value: -10 }] },
             { actor: 'B', ops: [{ kind: 'setfield', target: u, field: 'temp', value: -90 }] }]);
  ok(g4._systemView().field(u, 'temp') === -90, `min-fold over negatives picks -90 (got ${g4._systemView().field(u, 'temp')})`);
  g4.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: u, field: 'drift', value: -500 }] },
             { actor: 'B', ops: [{ kind: 'setfield', target: u, field: 'drift', value: -300 }] }]);
  ok(g4._systemView().field(u, 'drift') === -800, `additive fold over negatives sums to -800 (got ${g4._systemView().field(u, 'drift')})`);
  // range rejection on a signed field
  const r = g4.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: u, field: 'temp', value: -200 }] }]);
  ok(r.results[0].status === 'rejected', 'writing -200 to an Int8 [-128,127] field is REJECTED, not wrapped');
  // persistence
  const snap = P.save(g4);
  const g5 = P.load(JSON.parse(JSON.stringify(snap)));
  ok(g5._systemView().field(u, 'temp') === -90 && g5._systemView().field(u, 'drift') === -800,
    'negatives survive save/load byte-identically');
  // the RD-025 grid with the coords still unsigned (the honest restriction)
  const near = installRule(g4, { name: 'prox', match: { type: 'thing' },
    effects: [{ set: 'temp', to: { min: [{ max: [{ count: { type: 'thing', of: { near: 5 } } }, -128] }, 127] } }] });
  ok(near.ok, 'the RD-025 near-grid still installs on a type carrying signed fields');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-028 signed fields + multiply`);
process.exit(FAIL ? 1 : 0);
