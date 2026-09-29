'use strict';
// =============================================================================
// M0 — ACTOR-INPUT LATENCY MEASUREMENT (option (a): full pipeline at tick cadence)
// =============================================================================
// The M0 question (BAR.md, pinned before this ran): is the UNMODIFIED
// claim->schedule->validate->commit pipeline fast enough that human input can
// flow through it at tick cadence with no fast path?  The engine is tick-based
// with no wall clock — input latency under option (a) is:
//     (wait until next tick boundary) + (tick compute)
// The interval is a design choice; tick compute under load is the unknown this
// script measures.  BAR: at reference load S2 (>=1000 live entities, 10 rules
// incl. an O(pop) aggregation, 8 actors submitting claim+write per tick,
// >=2000 ticks) tick compute p50 <= 5ms and p99 <= 10ms.
//
// Also measured, because the shape of the pipeline makes it a real question:
// CLAIM-vs-RULE interaction.  Layer 1 rejects a WHOLE tx if ANY op targets an
// entity claimed by another actor — and a rule's tick output is one tx over
// every matched entity.  So one player claim may reject an entire rule's tick.
// S2 runs both input shapes (write-only vs claim+write) to quantify it.
//
// `node experiments/036_multiplayer/m0_latency.js` -> table + m0_results.json
// Zero deps.
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const { oracleRules } = require(path.join(__dirname, '..', '034_homestead_game', 'homestead.js'));

// deterministic LCG (no Math.random: runs must be reproducible)
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

// ---- extra rules beyond the oracle 5 (all must pass the real gate) ----------
const U32 = 4294967295;
function extraRules(n) {
  const pool = [
    { name: 'wilt', match: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } },
      effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] },
    // O(pop) scoped aggregation — the expensive shape, required by the bar.
    { name: 'sumscore', match: { type: 'zone' }, every: 2,
      effects: [{ set: 'tally', to: { min: [{ add: [{ field: 'tally' },
        { sum: { field: 'growth', type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 }, of: 'children' } }] }, U32] } }] },
    { name: 'drycount', match: { type: 'zone' }, every: 5,
      effects: [{ set: 'tally', to: { min: [{ add: [{ field: 'tally' },
        { count: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } } }] }, U32] } }] },
    { name: 'soak', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 200 } },
      effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 2] }, 0] } }] },
    { name: 'ripen', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 90 } },
      effects: [{ set: 'name', to: 'ripe' }] },
  ];
  // parameterized variants to reach n (S3 wants 20 rules)
  for (let i = 0; pool.length < n; i++) {
    pool.push({ name: `wilt${i}`, match: { type: 'crop', where: { field: 'water', cmp: '<', value: 3 + i } },
      effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] });
  }
  return pool.slice(0, n);
}

// ---- NON-DEPLETING load set (harness v2). v1 used the oracle set at scale and
// the world SELF-DEPLETED (everything watered -> grew -> reaped; write-only arm
// ended at 11 live entities — not a 1000-entity measurement). The pinned bar
// says ">=1000 live entities sustained, 10 rules incl. an O(pop) aggregation";
// it never pinned the oracle set. This set holds population constant (no
// delete/spawn) and scores by SNAPSHOT (never saturates U32, so no synthetic
// range-rejections polluting the starvation counts).
function loadRules(n) {
  const pool = [
    { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
      effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 5] }, 255] } }] },
    { name: 'drain', match: { type: 'crop' },
      effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 1] }, 0] } }] },
    { name: 'score', match: { type: 'zone' },   // snapshot, not accumulate
      effects: [{ set: 'tally', to: { min: [{ count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } } }, U32] } }] },
    { name: 'wilt', match: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } },
      effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] },
    // O(pop) scoped aggregation — the expensive shape, required by the bar.
    { name: 'sumscore', match: { type: 'zone' }, every: 2,
      effects: [{ set: 'tally', to: { min: [{ sum: { field: 'growth', type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 }, of: 'children' } }, U32] } }] },
    { name: 'drycount', match: { type: 'zone' }, every: 5,
      effects: [{ set: 'tally', to: { min: [{ count: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } } }, U32] } }] },
    { name: 'soak', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 200 } },
      effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 2] }, 0] } }] },
    { name: 'ripen', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 90 } },
      effects: [{ set: 'name', to: 'ripe' }] },
  ];
  for (let i = 0; pool.length < n; i++) {
    pool.push({ name: `wilt${i}`, match: { type: 'crop', where: { field: 'water', cmp: '<', value: 3 + i } },
      effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1] }, 0] } }] });
  }
  return pool.slice(0, n);
}

function buildWorld({ nCrops, capacity, opsBudget }) {
  const engine = new Engine(capacity, opsBudget ? { opsBudget } : {});
  const zone = engine.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  for (let i = 0; i < nCrops; i++)
    engine.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 25 + (i % 200), growth: (i * 97) % 100 });
  return { engine, zone };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

function liveCropUuids(engine) {
  return [...(engine.w.byType.get(TYPE.CROP) ?? [])].map(e => engine.w.uuid[e]);
}

function unsafeCheck(engine) {
  let u = 0;
  if (!engine.indexesConsistent()) u++;
  for (const [uu, e] of engine.w.byUuid) if (engine.w.destroyed[e] || engine.w.uuid[e] !== uu) u++;
  return u;
}

// ---- one scenario: soak `ticks` ticks, timing stepTick only -----------------
function runScenario({ name, nCrops, capacity, opsBudget, ruleSet, nRules, nActors, ticks, inputShape, moveEvery = 0, warmup = 100 }) {
  const { engine } = buildWorld({ nCrops, capacity, opsBudget });
  const rules = ruleSet === 'oracle' ? [...oracleRules(), ...extraRules(Math.max(0, nRules - 5))] : loadRules(nRules);
  for (const r of rules) {
    const res = installRule(engine, r);
    if (!res.ok) throw new Error(`rule ${r.name} failed the gate: ${JSON.stringify(res.errors)}`);
  }
  const rand = lcg(42);
  const samples = [];
  let committedTx = 0, rejectedPlayerTx = 0, ruleTxRejected = 0, ruleTxTotal = 0, unsafe = 0;
  let popMin = Infinity, popMax = 0;
  const rejectWhy = new Map(); // first-reason prefix -> count (rule txs only)

  for (let t = 0; t < warmup + ticks; t++) {
    // ---- build this tick's input batch (untimed: this is client-side work) --
    const crops = liveCropUuids(engine);
    if (t >= warmup) { popMin = Math.min(popMin, crops.length); popMax = Math.max(popMax, crops.length); }
    const batch = [];
    for (let k = 0; k < nActors; k++) {
      if (!crops.length) break;
      const target = crops[(Math.floor(rand() * crops.length) + k * 13) % crops.length];
      const ops = [];
      if (inputShape === 'claim+write') ops.push({ kind: 'claim', target, ticks: 2 });
      ops.push({ kind: 'setfield', target, field: 'water', value: 200 + (k % 50) });
      if (moveEvery && k === 0 && t % moveEvery === 0 && crops.length > 1)
        ops.push({ kind: 'move', target, after: crops[(crops.indexOf(target) + 1) % crops.length] });
      batch.push({ actor: `p${k}`, ops });
    }
    // ---- timed region: the full tick through the unmodified pipeline --------
    const t0 = process.hrtime.bigint();
    const r = engine.stepTick(batch);
    const t1 = process.hrtime.bigint();
    if (t >= warmup) {
      samples.push(Number(t1 - t0) / 1e6);
      for (const res of r.results) {
        const isRule = String(res.actor).startsWith('sys:');
        if (isRule) {
          ruleTxTotal++;
          if (res.status === 'rejected') {
            ruleTxRejected++;
            const why = String(res.reasons[0] ?? '?').split(':')[0];
            rejectWhy.set(why, (rejectWhy.get(why) ?? 0) + 1);
          }
        }
        else if (res.status === 'committed') committedTx++;
        else if (res.status === 'rejected') rejectedPlayerTx++;
      }
      if (t % 250 === 0) unsafe += unsafeCheck(engine);
    }
  }
  unsafe += unsafeCheck(engine);

  // ---- lone-submit micro-latency: one input tx, no systems (the event-driven
  // ceiling — what an immediate-on-arrival submit would cost at this scale) ---
  const crops = liveCropUuids(engine);
  const solo = [];
  for (let i = 0; i < 500 && crops.length; i++) {
    const target = crops[i % crops.length];
    const tx = [{ actor: 'solo', ops: [{ kind: 'setfield', target, field: 'water', value: 100 }] }];
    const t0 = process.hrtime.bigint();
    engine.submit(tx);
    const t1 = process.hrtime.bigint();
    solo.push(Number(t1 - t0) / 1e6);
  }

  samples.sort((a, b) => a - b); solo.sort((a, b) => a - b);
  const stat = (a) => ({ p50: pct(a, 0.50), p90: pct(a, 0.90), p99: pct(a, 0.99), max: a[a.length - 1],
    mean: a.reduce((x, y) => x + y, 0) / a.length });
  return {
    name, inputShape, nRules, nActors, ticks,
    liveEntities: [...engine.w.byUuid.values()].filter(e => !engine.w.destroyed[e]).length,
    popMin, popMax,
    rowsUsed: engine.w.count, capacity: engine.w.capacity,
    tickMs: stat(samples), soloSubmitMs: stat(solo),
    committedTx, rejectedPlayerTx, ruleTxRejected, ruleTxTotal,
    rejectWhy: Object.fromEntries(rejectWhy), unsafe,
  };
}

// =============================================================================
if (require.main === module) {
  console.log('=== M0: option (a) — full pipeline at tick cadence ===\n');
  const scenarios = [
    // S1: HOMESTEAD as shipped (oracle set, spawn/delete dynamics), 8 humans.
    { name: 'S1 homestead', nCrops: 3, capacity: 4096, ruleSet: 'oracle', nRules: 5, nActors: 8, ticks: 2000, inputShape: 'write-only' },
    // S2: THE REFERENCE LOAD from BAR.md — non-depleting set, both input shapes.
    { name: 'S2 ref (write-only)', nCrops: 1000, capacity: 16384, ruleSet: 'load', nRules: 10, nActors: 8, ticks: 2000, inputShape: 'write-only', moveEvery: 10 },
    { name: 'S2 ref (claim+write)', nCrops: 1000, capacity: 16384, ruleSet: 'load', nRules: 10, nActors: 8, ticks: 2000, inputShape: 'claim+write', moveEvery: 10 },
    // S3: stress — find where it strains. opsBudget raised (default 2048 would
    // reject any rule matching >2048 entities whole; that cap is an M5 finding
    // to exercise deliberately, not an accident to trip here).
    { name: 'S3 stress', nCrops: 5000, capacity: 32768, opsBudget: 16384, ruleSet: 'load', nRules: 20, nActors: 32, ticks: 500, inputShape: 'claim+write' },
  ];
  const results = [];
  for (const s of scenarios) {
    const r = runScenario(s);
    results.push(r);
    const f = (x) => x.toFixed(2).padStart(7);
    console.log(`${r.name.padEnd(22)} pop=[${r.popMin}..${r.popMax}] rules=${String(r.nRules).padStart(2)} actors=${String(r.nActors).padStart(2)}`);
    console.log(`  tick ms   p50=${f(r.tickMs.p50)} p90=${f(r.tickMs.p90)} p99=${f(r.tickMs.p99)} max=${f(r.tickMs.max)} mean=${f(r.tickMs.mean)}`);
    console.log(`  solo ms   p50=${f(r.soloSubmitMs.p50)} p99=${f(r.soloSubmitMs.p99)}`);
    console.log(`  player tx committed=${r.committedTx} rejected=${r.rejectedPlayerTx} | rule tx rejected=${r.ruleTxRejected}/${r.ruleTxTotal} ${JSON.stringify(r.rejectWhy)} | unsafe=${r.unsafe}\n`);
  }

  // ---- adjudicate the pinned M0 bar against the REFERENCE load (S2) ---------
  const ref = results.find(r => r.name.startsWith('S2 ref (claim+write)'));
  const passLoad = ref.popMin >= 1000;
  const passP50 = ref.tickMs.p50 <= 5, passP99 = ref.tickMs.p99 <= 10;
  const safe = results.every(r => r.unsafe === 0);
  console.log('--- BAR.md M0 clause (pinned before this ran) ---');
  console.log(`>=1000 live sustained: ${passLoad ? 'PASS' : 'FAIL'} (popMin=${ref.popMin})`);
  console.log(`p50 <= 5ms:  ${passP50 ? 'PASS' : 'FAIL'} (${ref.tickMs.p50.toFixed(2)}ms)`);
  console.log(`p99 <= 10ms: ${passP99 ? 'PASS' : 'FAIL'} (${ref.tickMs.p99.toFixed(2)}ms)`);
  console.log(`unsafe == 0 everywhere: ${safe ? 'PASS' : 'FAIL'}`);
  console.log(passLoad && passP50 && passP99 && safe
    ? '=> option (a) MEETS the bar: full pipeline at tick cadence, no fast path.'
    : '=> option (a) MISSES the bar: rivals (b)/(c) must now be built and compared.');

  // claim-starvation quantification (the M1-relevant interaction)
  const w = results.find(r => r.name === 'S2 ref (write-only)');
  const c = results.find(r => r.name === 'S2 ref (claim+write)');
  console.log(`\nclaim->rule starvation: rule-tx rejection rate write-only=${(100 * w.ruleTxRejected / w.ruleTxTotal).toFixed(1)}% vs claim+write=${(100 * c.ruleTxRejected / c.ruleTxTotal).toFixed(1)}%`);

  fs.writeFileSync(path.join(__dirname, 'm0_results.json'), JSON.stringify(results, null, 2));
  console.log('\nresults -> experiments/036_multiplayer/m0_results.json');
}
