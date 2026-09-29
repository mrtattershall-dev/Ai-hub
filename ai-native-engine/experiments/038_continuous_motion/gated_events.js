'use strict';
// =============================================================================
// RD-023 apparatus — the DISCRETE layer: motion events become ordinary op
// batches through the EXISTING pipeline (Claim -> Schedule -> Validate ->
// Commit), exactly like any player tx. One tx per subject entity (the RD-M0.1
// granularity decision), actors round-robin over 4 synthetic players.
// The engine has no position fields (the vocabulary wall, known) — events
// write QUANTIZED position into crop 'water' (0-255 int). Quantization is
// irrelevant to what this bench measures: the per-write COST of the gated
// pipeline, which is the architecture question.
// =============================================================================

function buildWorld(Engine, TYPE, n) {
  const engine = new Engine(n + 8);
  const zone = engine.spawn(TYPE.ZONE, { name: 'track', tally: 0 }).uuid;
  const uuids = [];
  for (let i = 0; i < n; i++)
    uuids.push(engine.spawn(TYPE.CROP, { name: `r${i}`, parent: zone, water: 0, growth: 0 }).uuid);
  return { engine, zone, uuids };
}

const q255 = (v, world) => Math.max(0, Math.min(255, Math.round((v / world) * 255)));

// events: array of entity indices (crossings) or [i,j] pairs (collisions).
// -> extraBatch txs, one per subject entity.
function eventsToTxs(events, uuids, motion) {
  const txs = [];
  let k = 0;
  for (const ev of events) {
    const idxs = Array.isArray(ev) ? ev : [ev];
    for (const i of idxs)
      txs.push({ actor: `p${k++ % 4}`, ops: [{ kind: 'setfield', target: uuids[i], field: 'water', value: q255(motion.x[i], motion.WORLD) }] });
  }
  return txs;
}

// invariant sweep (the m1_server unsafeCheck pattern): 0 = clean
function unsafeCheck(engine) {
  let u = 0;
  if (!engine.indexesConsistent()) u++;
  for (const [uu, e] of engine.w.byUuid) if (engine.w.destroyed[e] || engine.w.uuid[e] !== uu) u++;
  return u;
}

module.exports = { buildWorld, eventsToTxs, unsafeCheck, q255 };

if (require.main === module) { // smoke: events land through the real pipeline
  const path = require('node:path');
  const { Engine, TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
  const { createMotion } = require('./motion_system.js');
  const { engine, uuids } = buildWorld(Engine, TYPE, 10);
  const m = createMotion(10);
  m.integrate(1 / 60);
  const txs = eventsToTxs([0, 3, [4, 5]], uuids, m);
  const r = engine.stepTick(txs);
  const committed = r.results.filter((x) => x.status === 'committed').length;
  console.log(`txs ${txs.length}, committed ${committed}, unsafe ${unsafeCheck(engine)}`);
  if (committed !== 4 || unsafeCheck(engine) !== 0) { console.error('FAIL'); process.exit(1); }
  console.log('ALL PASS — gated_events smoke');
}
