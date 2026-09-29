'use strict';
// =============================================================================
// RD-023 apparatus — the frame-budget bench. SAME-PROCESS arms per entity
// count (this laptop's absolute timings vary ~3x run-to-run; only same-process
// A/B ratios are trustworthy — pinned project finding):
//   A  ungated motion only            (the fast layer, engine ticking empty)
//   B  ungated motion + K gated events/frame through the REAL pipeline
//   C  NEGATIVE CONTROL: every entity's motion routed through the pipeline
//      every frame (today's architecture used naively) — one tx per entity
// Budgets: 16.6ms (60fps) and 33ms (30fps). Reports mean/p95 frame ms and the
// share of frames over budget. `node frame_budget_bench.js [frames]`
// =============================================================================
const path = require('node:path');
const { Engine, TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const { createMotion } = require('./motion_system.js');
const { buildWorld, eventsToTxs, unsafeCheck, q255 } = require('./gated_events.js');

const FRAMES = Number(process.argv[2] ?? 200);
const DT = 1 / 60;
const ms = (bi) => Number(bi) / 1e6;

function stats(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { mean, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
}

function runArm(n, mode, eventsPerFrame = 0) {
  const { engine, uuids } = buildWorld(Engine, TYPE, n);
  const motion = createMotion(n);
  const frames = [], gatedMs = [], motionMs = [];
  let committed = 0, rejected = 0, deferred = 0;
  for (let f = 0; f < FRAMES; f++) {
    const t0 = process.hrtime.bigint();
    motion.integrate(DT);
    const t1 = process.hrtime.bigint();
    let txs = [];
    if (mode === 'events' && eventsPerFrame > 0) {
      // deterministic K events/frame: entities f..f+K-1 (mod n) "cross a checkpoint"
      const evs = Array.from({ length: Math.min(eventsPerFrame, n) }, (_, k) => (f + k) % n);
      txs = eventsToTxs(evs, uuids, motion);
    } else if (mode === 'control') {
      // today's architecture, unmodified: ALL motion as gated writes, 1 tx/entity
      for (let i = 0; i < n; i++)
        txs.push({ actor: `p${i % 4}`, ops: [{ kind: 'setfield', target: uuids[i], field: 'water', value: q255(motion.x[i], motion.WORLD) }] });
    }
    const r = engine.stepTick(txs);
    const t2 = process.hrtime.bigint();
    for (const res of r.results) {
      if (res.status === 'committed') committed++;
      else if (res.status === 'rejected') rejected++;
    }
    deferred += r.deferrals.length;
    motionMs.push(ms(t1 - t0)); gatedMs.push(ms(t2 - t1)); frames.push(ms(t2 - t0));
  }
  const unsafe = unsafeCheck(engine);
  return { frames: stats(frames), motion: stats(motionMs), gated: stats(gatedMs),
    committed, rejected, deferred, unsafe,
    over16: frames.filter((x) => x > 16.6).length / FRAMES,
    over33: frames.filter((x) => x > 33).length / FRAMES };
}

const row = (label, r) =>
  console.log(`${label.padEnd(26)} frame mean ${r.frames.mean.toFixed(3)}ms p95 ${r.frames.p95.toFixed(3)}ms | gated mean ${r.gated.mean.toFixed(3)}ms | >16.6ms ${(r.over16 * 100).toFixed(0)}% >33ms ${(r.over33 * 100).toFixed(0)}% | commit ${r.committed} rej ${r.rejected} defer ${r.deferred} unsafe ${r.unsafe}`);

let anyUnsafe = 0;
console.log(`RD-023 frame budget bench — ${FRAMES} frames/arm, same-process arms per N\n`);
for (const n of [100, 500, 1000, 2000, 5000]) {
  console.log(`— N=${n} ${'—'.repeat(40)}`);
  const a = runArm(n, 'motion');            row('A ungated motion', a);
  for (const k of [10, 50, 200]) {
    const b = runArm(n, 'events', k);        row(`B motion + ${String(k).padStart(3)} gated ev/f`, b);
    anyUnsafe += b.unsafe;
  }
  if (n <= 2000) {                          // C at 5000 measured separately below if viable
    const c = runArm(n, 'control');          row('C CONTROL all-gated', c);
    anyUnsafe += c.unsafe;
    const aRef = a.frames.mean, cRef = c.frames.mean;
    console.log(`   layering speedup at N=${n}: control/A = ${(cRef / Math.max(aRef, 1e-9)).toFixed(1)}x`);
  }
  anyUnsafe += a.unsafe;
}
console.log(`\nunsafe events across ALL arms: ${anyUnsafe}`);
if (anyUnsafe) { console.error('FAIL — invariant violation'); process.exit(1); }
console.log('bench complete');
