'use strict';
// B6 — export a RICH per-tick, per-crop trace of a real HOMESTEAD session
// (authored oracle rules, real engine) as JSON, for the visual play-UI to
// replay. Faithful: every frame is real committed engine state.
// `node b6_export_trace.js > trace.json`
const path = require('node:path');
const { TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const { installRule } = require(path.join(__dirname, '..', '..', 'core', 'behavior.js'));
const H = require(path.join(__dirname, 'homestead.js'));

const { engine, zone } = H.buildStartWorld();
for (const r of H.oracleRules()) installRule(engine, r);

// wrap submit to capture per-tick harvested/planted uuids
let lastBatch = null;
const orig = engine.submit.bind(engine);
engine.submit = (b) => { lastBatch = b; return orig(b); };

function snapshotCrops() {
  const w = engine.w, crops = [];
  for (const e of (w.byType.get(TYPE.CROP) ?? [])) {
    const r = w.componentIndex[e];
    crops.push({ id: w.uuid[e], water: w.crop_water[r], growth: w.crop_growth[r] });
  }
  return crops.sort((a, b) => (a.id < b.id ? -1 : 1));
}

const frames = [{ tick: 0, crops: snapshotCrops(), tally: 0, harvested: [], planted: [] }];
for (let t = 0; t < H.M_TICKS; t++) {
  const r = engine.stepTick();
  const batch = lastBatch ?? [];
  const harvested = [], planted = [];
  batch.forEach((tx, i) => {
    if (r.results[i]?.status !== 'committed') return;
    for (const op of tx.ops) { if (op.kind === 'delete') harvested.push(op.target); }
    (r.results[i]._created || []).forEach(u => planted.push(u));
  });
  const ze = engine.w.liveEntity(zone);
  frames.push({ tick: r.tick, crops: snapshotCrops(),
    tally: ze >= 0 ? engine._field(ze, 'tally') : 0, harvested, planted });
  lastBatch = null;
}

const v = H.checkHomesteadObservable(frames.slice(1).map(f => ({
  population: f.crops.length, reaps: f.harvested.length, spawns: f.planted.length, tally: f.tally,
})), 0);

process.stdout.write(JSON.stringify({
  title: 'HOMESTEAD', ticks: H.M_TICKS,
  rules: H.oracleRules().map(r => r.name),
  win: v.win, clauses: v.clauses,
  frames,
}));
