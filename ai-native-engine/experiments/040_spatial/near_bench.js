'use strict';
// =============================================================================
// RD-025 bar 4 — does the O(n) near-scan blow the tick budget? This DECIDES
// H1 (scope suffices) vs H2 (a spatial index must go into core first).
// Same-process arms per N (laptop absolute timings vary ~3x run-to-run; only
// same-process ratios are trustworthy — pinned project finding).
//   A  no rule           (tick floor)
//   B  global-scope count rule   (today's O(n) aggregation, the honest control)
//   C  near-scope count rule     (the new path: n_matched x n_pool scan)
// A near-scoped rule over M matched entities scanning a P-sized pool is
// inherently O(M*P) — quadratic when both grow. That is what this measures.
// `node near_bench.js [frames]`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const FRAMES = Number(process.argv[2] ?? 60);
const ms = (bi) => Number(bi) / 1e6;
const stats = (a) => { const s = a.slice().sort((x, y) => x - y);
  return { mean: a.reduce((p, c) => p + c, 0) / a.length, p95: s[Math.floor(s.length * 0.95)] }; };

function build(n) {
  const g = new Engine(n + 8);
  const A = g.defineType({ name: 'agent', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, seen: { range: [0, 255], init: 0 } } });
  // deterministic scatter over a 256x256 field (no Math.random — project rule)
  for (let i = 0; i < n; i++) g.spawn(A.type, { name: `a${i}`, x: (i * 37) % 256, y: (i * 61) % 256 });
  return g;
}
function arm(n, mode) {
  const g = build(n);
  if (mode === 'global') installRule(g, { name: 'r', match: { type: 'agent' },
    effects: [{ set: 'seen', to: { min: [{ count: { type: 'agent' } }, 255] } }] });
  if (mode === 'near') installRule(g, { name: 'r', match: { type: 'agent' },
    effects: [{ set: 'seen', to: { min: [{ count: { type: 'agent', of: { near: 20 } } }, 255] } }] });
  const t = [];
  for (let f = 0; f < FRAMES; f++) { const t0 = process.hrtime.bigint(); g.stepTick(); t.push(ms(process.hrtime.bigint() - t0)); }
  return stats(t);
}

console.log(`RD-025 near-scope bench — ${FRAMES} frames/arm, same-process arms per N, radius 20 on a 256x256 field\n`);
console.log('    N   no-rule    global-count   near-count   near/global   >16.6ms?');
const rows = [];
for (const n of [100, 500, 1000, 2000]) {
  const a = arm(n, 'none'), b = arm(n, 'global'), c = arm(n, 'near');
  rows.push({ n, a: a.mean, b: b.mean, c: c.mean });
  console.log(`${String(n).padStart(5)}   ${a.mean.toFixed(3)}ms     ${b.mean.toFixed(3)}ms      ${c.mean.toFixed(3)}ms     ${(c.mean / Math.max(b.mean, 1e-9)).toFixed(2)}x        ${c.mean > 16.6 ? 'YES — over budget' : 'no'}`);
}
const worst = rows[rows.length - 1];
console.log(`\npathological shape (EVERY entity matches AND scans EVERY entity): at N=${worst.n}, near costs ${worst.c.toFixed(2)}ms/tick vs global ${worst.b.toFixed(2)}ms (budget 16.6ms).`);
console.log(`NOTE: the GLOBAL-scope control also blows the budget from N~500 — the quadratic is a pre-existing`);
console.log(`property of per-entity aggregation (RD-B4/B7), not something proximity introduced (near/global ~${(worst.c / worst.b).toFixed(1)}x).`);

// ---- realistic genre shape (the card's own bar: "20 racers / 200 projectiles") ----
// M matched movers x P scanned pool — the shape a real game actually writes.
function armRealistic(M, P) {
  const g = new Engine(M + P + 8);
  const A = g.defineType({ name: 'mover', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, seen: { range: [0, 255], init: 0 } } });
  const B = g.defineType({ name: 'prop', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 } } });
  for (let i = 0; i < M; i++) g.spawn(A.type, { name: `m${i}`, x: (i * 37) % 256, y: (i * 61) % 256 });
  for (let i = 0; i < P; i++) g.spawn(B.type, { name: `p${i}`, x: (i * 53) % 256, y: (i * 29) % 256 });
  installRule(g, { name: 'r', match: { type: 'mover' },
    effects: [{ set: 'seen', to: { min: [{ count: { type: 'prop', of: { near: 20 } } }, 255] } }] });
  const t = [];
  for (let f = 0; f < FRAMES; f++) { const t0 = process.hrtime.bigint(); g.stepTick(); t.push(ms(process.hrtime.bigint() - t0)); }
  return stats(t);
}
console.log(`\nrealistic genre shapes (M movers each scanning P props, radius 20):`);
const real = [[2, 4, 'Pong (2 paddles, ball+walls)'], [20, 200, "the card's bar: 20 racers / 200 projectiles"],
  [50, 500, 'a busy action scene'], [200, 1000, 'a bullet-hell']];
const fits = [];
for (const [M, P, label] of real) {
  const r = armRealistic(M, P);
  const over = r.mean > 16.6;
  fits.push({ M, P, label, mean: r.mean, over });
  console.log(`  M=${String(M).padStart(3)} P=${String(P).padStart(4)}  ${r.mean.toFixed(3)}ms mean, p95 ${r.p95.toFixed(3)}ms  ${over ? 'OVER BUDGET' : 'fits 60fps'}   — ${label}`);
}
// Facts only — the pre-registered decision rule is walked in results.md, not fitted here.
const lastOk = [...fits].reverse().find((f) => !f.over), firstBad = fits.find((f) => f.over);
console.log(`\nMEASURED CROSSOVER: fits up to M=${lastOk.M} x P=${lastOk.P} (${lastOk.mean.toFixed(2)}ms);`
  + (firstBad ? ` breaches at M=${firstBad.M} x P=${firstBad.P} (${firstBad.mean.toFixed(2)}ms).` : ' no breach measured.'));
console.log(`Apply decisions/RD-025's rule against the genre bar it pre-registered — see experiments/040_spatial/results.md.`);
