'use strict';
// =============================================================================
// RD-026 bar 4 — the user's criterion: 10,000 entities, near(entity, radius),
// under a fixed budget. Same-process OFF/ON arms per shape (laptop absolute
// timings vary ~3x run-to-run; ratios are the finding).
//
// DENSITY IS A FREE VARIABLE THE CRITERION DIDN'T FIX, and it dominates: a
// near-query's RESULT SET is |entities| x (circle area / world area). Pack 10k
// entities into 256x256 with radius 20 and every entity genuinely HAS ~190
// neighbours — ~2M results/tick that no index can conjure away (the output is
// that big). Spread the same 10k over 4096x4096 and each has <1. So both are
// measured and reported separately: an index question and an output question.
// `node accel_bench.js [frames]`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule, setAccel } = CORE('behavior.js');

const FRAMES = Number(process.argv[2] ?? 20);
const ms = (bi) => Number(bi) / 1e6;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function build(n, world, radius, mode) {
  const g = new Engine(n + 8);
  const hi = world - 1;
  const A = g.defineType({ name: 'agent', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, hi], init: 0 }, y: { range: [0, hi], init: 0 }, seen: { range: [0, 255], init: 0 } } });
  for (let i = 0; i < n; i++)                       // deterministic scatter (no Math.random — project rule)
    g.spawn(A.type, { name: `a${i}`, x: (i * 7919) % world, y: (i * 6271) % world });
  const expr = mode === 'near'
    ? { count: { type: 'agent', of: { near: radius } } }
    : { count: { type: 'agent' } };
  installRule(g, { name: 'r', match: { type: 'agent' }, effects: [{ set: 'seen', to: { min: [expr, 255] } }] });
  return g;
}
function arm(n, world, radius, mode, accel) {
  setAccel(accel);
  const g = build(n, world, radius, mode);
  const t = [];
  for (let f = 0; f < FRAMES; f++) { const t0 = process.hrtime.bigint(); g.stepTick(); t.push(ms(process.hrtime.bigint() - t0)); }
  setAccel(true);
  return mean(t);
}
const fmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(2)}ms`);
const row = (label, off, on) => console.log(`${label.padEnd(42)} OFF ${fmt(off).padStart(8)}   ON ${fmt(on).padStart(8)}   ${(off / Math.max(on, 1e-9)).toFixed(1)}x   ${on <= 16.6 ? 'FITS 60fps' : 'over budget'}`);

console.log(`RD-026 acceleration bench — ${FRAMES} frames/arm, same-process OFF/ON\n`);

console.log('--- H1: global-scope aggregation (no proximity involved) ---');
for (const n of [500, 2000, 10000]) row(`count/all, N=${n}`, arm(n, 256, 0, 'all', false), arm(n, 256, 0, 'all', true));

console.log('\n--- H2: near-scope, SPARSE (10k over a 4096x4096 world, r=20) ---');
console.log('    expected neighbours/entity ~= 10000 * pi*20^2 / 4096^2 = 0.75');
for (const n of [1000, 5000, 10000]) row(`count/near r=20, N=${n}, world 4096`, arm(n, 4096, 20, 'near', false), arm(n, 4096, 20, 'near', true));

console.log('\n--- H2: near-scope, DENSE (the output-bound case) ---');
console.log('    10k in 256x256 with r=20 => ~190 true neighbours EACH => ~1.9M results/tick');
row('count/near r=20, N=10000, world 256', arm(10000, 256, 20, 'near', false), arm(10000, 256, 20, 'near', true));
row('count/near r=5,  N=10000, world 256', arm(10000, 256, 5, 'near', false), arm(10000, 256, 5, 'near', true));

console.log('\n--- the genre shapes RD-025 measured, re-measured with acceleration ---');
row('20 racers, r=20, world 256', arm(20, 256, 20, 'near', false), arm(20, 256, 20, 'near', true));
row('200 movers, r=20, world 256', arm(200, 256, 20, 'near', false), arm(200, 256, 20, 'near', true));
console.log('\nFacts only. The pre-registered decision rule is walked in results.md.');
