'use strict';
// RD-008 (reconstruction) — memory: packed SoA world vs naive JS objects.
//
// Two numbers, deliberately measured DIFFERENTLY because their honesty comes
// from different places:
//   * SoA  -> EXACT. Sum of typed-array byteLengths. No heap snapshot, no GC,
//             fully deterministic. This is the number we trust.
//   * naive -> APPROXIMATE. A real heapUsed delta around N plain objects.
//             Inherently noisy (that noise is exactly what sank the earlier
//             attempts); run with --expose-gc to settle the heap first.
//
// Run: node --expose-gc memory_test.js   (works without --expose-gc too,
//      the naive number is just noisier).

const { World, TYPE } = require('./soa_world');

function buildMixed(N) {
  const w = new World(N);
  for (let i = 0; i < N; i++) {
    const r = i / N;
    if (r < 0.40) w.spawn(TYPE.CROP,  { growth: 50, water: 10, species: i % 5 });
    else if (r < 0.70) w.spawn(TYPE.FISH,  { depth: 3, size: 200, species: i % 4 });
    else w.spawn(TYPE.ENEMY, { hp: 100, damage: 5, aggro: 0 });
  }
  return w;
}

// naive equivalent: one plain object per entity, same fields it would carry
function buildNaive(N) {
  const arr = new Array(N);
  for (let i = 0; i < N; i++) {
    const r = i / N;
    if (r < 0.40) arr[i] = { uuid: 'uuid-' + i.toString(36), type: 'crop', destroyed: false, harvestable: false, growth: 50, water: 10, species: i % 5 };
    else if (r < 0.70) arr[i] = { uuid: 'uuid-' + i.toString(36), type: 'fish', destroyed: false, harvestable: true, depth: 3, size: 200, species: i % 4 };
    else arr[i] = { uuid: 'uuid-' + i.toString(36), type: 'enemy', destroyed: false, harvestable: false, hp: 100, damage: 5, aggro: 0 };
  }
  return arr;
}

const N = 200000;

// --- SoA: exact ---
const w = buildMixed(N);
const soaTotal = w.packedByteLength();
const soaPer = soaTotal / w.count;
const hotPer = w.hotByteLength() / w.count;

// --- naive: measured heap delta ---
function gc() { if (global.gc) { global.gc(); global.gc(); } }
gc();
const before = process.memoryUsage().heapUsed;
const naive = buildNaive(N);
gc();
const after = process.memoryUsage().heapUsed;
const naivePer = (after - before) / N;
// keep `naive` alive past measurement so it isn't collected early
if (naive.length !== N) throw new Error('unreachable');

console.log('=== RD-008 memory: packed SoA vs naive objects ===');
console.log(`entities: ${N} (40% crop / 30% fish / 30% enemy)\n`);
console.log(`SoA packed  : ${soaTotal} bytes total -> ${soaPer.toFixed(2)} B/entity  (EXACT, deterministic)`);
console.log(`  hot path  : ${hotPer.toFixed(2)} B/entity (type + destroyed + harvestable + componentIndex)`);
console.log(`  caveat    : every pool pre-sized to full capacity -> this is a CONSERVATIVE UPPER BOUND`);
console.log(`  excluded  : cold uuid strings live outside the packed arrays, by design\n`);
console.log(`naive JS obj: ~${naivePer.toFixed(2)} B/entity  (heap delta, APPROXIMATE${global.gc ? ', gc-settled' : ', run with --expose-gc to settle'})`);
console.log(`\nratio (naive / SoA): ~${(naivePer / soaPer).toFixed(1)}x`);
console.log('note: report the SoA number as fact; the ratio inherits the naive number\'s noise.');
