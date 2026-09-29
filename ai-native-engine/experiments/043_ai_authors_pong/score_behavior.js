'use strict';
// =============================================================================
// RD-029 bar 4 — HONEST SCORING. A rule that passes the gate but plays wrong is
// a FAIL (the B2-LIVE lesson: SAFE != CORRECT; the gate has nothing to object to
// when a valid rule simply does the wrong thing). This replays each authored
// rule from artifacts.json against a hand-computed oracle. No model calls — free
// and repeatable, which is exactly why the raw artifacts were captured.
// `node score_behavior.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
// `node score_behavior.js [artifacts-file]` — defaults to the latest run. The raw
// artifacts make every re-score FREE (no GPU), which is the whole point of the
// capture house rule: this file has now been re-scored a dozen times for $0.
const A = require(process.argv[2] ? path.resolve(process.argv[2]) : './artifacts.json');

const build = (signed) => {
  const g = new Engine(64);
  g.defineType({ name: 'paddle', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 128 },
    input_dir: signed ? { range: [-1, 1], init: 0 } : { range: [0, 2], init: 0 },
    score: { range: [0, 255], init: 0 } } });
  g.defineType({ name: 'ball', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 128 }, y: { range: [0, 255], init: 128 },
    vx: signed ? { range: [-8, 8], init: 3 } : { range: [0, 255], init: 131 },
    vy: signed ? { range: [-8, 8], init: 0 } : { range: [0, 255], init: 128 } } });
  return g;
};

// Each oracle sets a scenario, runs ONE tick, and asserts the observable the goal
// asked for — stated in the goal's own terms, not the implementation's.
const ORACLES = {
  // ORACLE HARDENED 2026-07-16: the first version asserted only `after < before`,
  // and PASSED a rule whose inverted clamp min:[max:[e,255],0] slams y to 0 — a
  // "decrease" of 128. A weak oracle launders a wrong rule. Now: the move must be
  // SMALL (a paddle step, not a teleport) and a released input must not move at all.
  paddle_input: (g, signed) => {
    const T = g.w.schema.TYPE;
    const p = g.spawn(T.PADDLE, { name: 'p', x: 8, y: 128, input_dir: signed ? -1 : 1 }).uuid;
    const q = g.spawn(T.PADDLE, { name: 'q', x: 240, y: 128, input_dir: 0 }).uuid;   // control: no input
    g.spawn(T.BALL, { name: 'b', x: 128, y: 128 });
    g.stepTick();
    const moved = 128 - g._systemView().field(p, 'y');
    const idle = 128 - g._systemView().field(q, 'y');
    return { pass: moved >= 1 && moved <= 10 && idle === 0,
      detail: `held 'up': y moved ${moved} (want 1..10, a step not a teleport); released control moved ${idle} (want 0)` };
  },
  ball_move: (g, signed) => {
    const T = g.w.schema.TYPE;
    g.spawn(T.PADDLE, { name: 'p', x: 8, y: 8 });
    const b = g.spawn(T.BALL, { name: 'b', x: 128, y: 128, vx: signed ? 3 : 131 }).uuid;
    g.stepTick();
    const x = g._systemView().field(b, 'x');
    return { pass: x === 131, detail: `vx=+3 for one tick: x 128 -> ${x} (want 131)` };
  },
  wall_bounce: (g, signed) => {
    const T = g.w.schema.TYPE;
    g.spawn(T.PADDLE, { name: 'p', x: 8, y: 200 });
    const b = g.spawn(T.BALL, { name: 'b', x: 128, y: 0, vy: signed ? -3 : 125 }).uuid;
    g.stepTick();
    const vy = g._systemView().field(b, 'vy');
    const want = signed ? 3 : 131;
    return { pass: vy === want, detail: `at y=0 with vy=${signed ? -3 : '125(-3)'}: vy -> ${vy} (want ${want} = downward)` };
  },
  // ORACLE HARDENED: the first version only tested the POSITIVE case and passed a
  // rule that reverses vx every tick regardless of paddles (it oscillated into a
  // reversed state by tick 3 and looked right). A bounce rule must also NOT fire
  // when nothing is near — that control is the whole content of the goal.
  paddle_bounce: (g, signed) => {
    const T = g.w.schema.TYPE;
    g.spawn(T.PADDLE, { name: 'p', x: 20, y: 128 });
    const near = g.spawn(T.BALL, { name: 'near', x: 28, y: 128, vx: signed ? -3 : 125 }).uuid;   // 8 away, closing
    const far = g.spawn(T.BALL, { name: 'far', x: 200, y: 20, vx: signed ? -3 : 125 }).uuid;     // nowhere near a paddle
    g.stepTick();
    const vN = g._systemView().field(near, 'vx'), vF = g._systemView().field(far, 'vx');
    const rev = (v) => (signed ? v > 0 : v > 128);
    return { pass: rev(vN) && !rev(vF),
      detail: `near-paddle ball: vx -> ${vN} (want reversed); FAR ball: vx -> ${vF} (want UNCHANGED ${signed ? -3 : 125})` };
  },
  scoring: (g) => {
    const T = g.w.schema.TYPE;
    const p = g.spawn(T.PADDLE, { name: 'p', x: 8, y: 128 }).uuid;
    g.spawn(T.BALL, { name: 'b', x: 1, y: 128 });                                          // a ball IS in the goal
    const s0 = g._systemView().field(p, 'score');
    g.stepTick();
    const s1 = g._systemView().field(p, 'score');
    return { pass: s1 === s0 + 1, detail: `ball at x=1 (in goal) for one tick: score ${s0} -> ${s1} (want +1)` };
  },
};

let gatedTotal = 0, correctTotal = 0;
const summary = {};
for (const [arm, results] of Object.entries(A.arms)) {
  const signed = arm.startsWith('B');
  console.log(`\n===== ARM ${arm} =====`);
  let gated = 0, correct = 0;
  for (const r of results) {
    if (!r.success) { console.log(`  ${r.key.padEnd(15)} REFUSED by the gate after ${r.attempts} attempt(s) — not correct by default`); continue; }
    gated++;
    const g = build(signed);
    const inst = installRule(g, r.rule);
    if (!inst.ok) { console.log(`  ${r.key.padEnd(15)} GATED-then-UNINSTALLABLE (?!) ${JSON.stringify(inst.errors)}`); continue; }
    let v;
    try { v = ORACLES[r.key](g, signed); } catch (e) { v = { pass: false, detail: 'threw: ' + e.message }; }
    if (v.pass) correct++;
    console.log(`  ${r.key.padEnd(15)} gated in ${r.attempts} | ${v.pass ? 'CORRECT' : 'WRONG  '} | ${v.detail}`);
    if (!v.pass) console.log(`      rule: ${JSON.stringify(r.rule)}`);
  }
  summary[arm] = { gated, correct, total: results.length };
  gatedTotal += gated; correctTotal += correct;
  console.log(`  --> ${gated}/${results.length} passed the GATE, ${correct}/${results.length} actually PLAY CORRECTLY`);
}
console.log(`\n===== RD-029 SCORE =====`);
for (const [arm, s] of Object.entries(summary)) console.log(`  ${arm.padEnd(14)} gate ${s.gated}/${s.total}   correct ${s.correct}/${s.total}`);
console.log(`  (gated != correct is the B2-LIVE lesson, re-applied off-farm)`);
