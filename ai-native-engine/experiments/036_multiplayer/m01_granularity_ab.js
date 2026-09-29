'use strict';
// =============================================================================
// RD-M0.1 A/B — per-entity rule txs (SPLIT) vs whole-rule txs (WHOLE), measured
// INTERLEAVED IN ONE PROCESS. Motivation: back-to-back runs of the identical
// m0_latency.js differ ~3x on this machine (26.3 vs 9.5 ms p50) — cross-run
// comparisons are noise. Interleaving A/B/A/B... in one process subjects both
// arms to the same thermal/GC environment; the DELTA is meaningful even when
// absolute numbers wobble.
// Load = the S2 reference (1000 crops, 10 non-depleting rules, 8 write-only
// actors) — write-only so neither arm is claim-starved (RD-M0 F1).
// `node experiments/036_multiplayer/m01_granularity_ab.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const U32 = 4294967295;
const RULES = [
  { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
    effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 5] }, 255] } }] },
  { name: 'drain', match: { type: 'crop' },
    effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 1] }, 0] } }] },
  { name: 'score', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } } }, U32] } }] },
  { name: 'wilt', match: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } },
    effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] },
  { name: 'sumscore', match: { type: 'zone' }, every: 2,
    effects: [{ set: 'tally', to: { min: [{ sum: { field: 'growth', type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 }, of: 'children' } }, U32] } }] },
  { name: 'drycount', match: { type: 'zone' }, every: 5,
    effects: [{ set: 'tally', to: { min: [{ count: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } } }, U32] } }] },
  { name: 'soak', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 200 } },
    effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 2] }, 0] } }] },
  { name: 'ripen', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 90 } },
    effects: [{ set: 'name', to: 'ripe' }] },
  { name: 'wilt0', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 3 } },
    effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] },
  { name: 'wilt1', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 4 } },
    effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] },
];

function rep(mode, ticks) {
  const engine = new Engine(16384);
  const zone = engine.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  for (let i = 0; i < 1000; i++)
    engine.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 25 + (i % 200), growth: (i * 97) % 100 });
  for (const r of RULES) {
    const res = installRule(engine, r);
    if (!res.ok) throw new Error(`rule ${r.name}: ${JSON.stringify(res.errors)}`);
  }
  // the A/B knob: installRule sets txPerEntity=true (RD-M0.1); WHOLE arm
  // flips it back so the SAME compiled rules submit as one tx per rule.
  for (const s of engine.systems) s.txPerEntity = (mode === 'SPLIT');
  const rand = lcg(42);
  const crops = [...(engine.w.byType.get(TYPE.CROP) ?? [])].map(e => engine.w.uuid[e]);
  const samples = [];
  for (let t = 0; t < ticks; t++) {
    const batch = [];
    for (let k = 0; k < 8; k++) {
      const target = crops[(Math.floor(rand() * crops.length) + k * 13) % crops.length];
      batch.push({ actor: `p${k}`, ops: [{ kind: 'setfield', target, field: 'water', value: 200 + (k % 50) }] });
    }
    const t0 = process.hrtime.bigint();
    engine.stepTick(batch);
    const t1 = process.hrtime.bigint();
    if (t >= 50) samples.push(Number(t1 - t0) / 1e6); // 50-tick warmup per rep
  }
  samples.sort((a, b) => a - b);
  const pct = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
  return { p50: pct(0.5), p99: pct(0.99) };
}

if (require.main === module) {
  console.log('=== RD-M0.1 A/B: SPLIT vs WHOLE, interleaved, one process ===');
  console.log('load: 1000 crops, 10 rules, 8 write-only actors, 400 timed ticks/rep\n');
  const reps = { SPLIT: [], WHOLE: [] };
  rep('WHOLE', 100); rep('SPLIT', 100); // joint warmup, discarded
  for (let i = 0; i < 5; i++) {
    for (const mode of ['WHOLE', 'SPLIT']) {
      const r = rep(mode, 450);
      reps[mode].push(r);
      console.log(`rep${i} ${mode.padEnd(5)} p50=${r.p50.toFixed(2)}ms p99=${r.p99.toFixed(2)}ms`);
    }
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const w50 = med(reps.WHOLE.map(r => r.p50)), s50 = med(reps.SPLIT.map(r => r.p50));
  const w99 = med(reps.WHOLE.map(r => r.p99)), s99 = med(reps.SPLIT.map(r => r.p99));
  console.log(`\nmedian-of-reps: WHOLE p50=${w50.toFixed(2)} p99=${w99.toFixed(2)} | SPLIT p50=${s50.toFixed(2)} p99=${s99.toFixed(2)}`);
  console.log(`SPLIT/WHOLE ratio: p50 x${(s50 / w50).toFixed(2)}  p99 x${(s99 / w99).toFixed(2)}`);
}
