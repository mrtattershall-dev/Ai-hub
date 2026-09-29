'use strict';
// CAPSTONE (reconstruction) — the whole stack in one place, on the packed world.
//
// Proves the RD-002/003 conflict-safety guarantees (Claim -> Scheduler ->
// Validator -> Commit) are NOT tied to convenient JS objects: they hold
// identically on a dense typed-array SoA world, at scale.
//
//   Claim     : time-boxed soft lock on an entity; a second actor is rejected
//               here, before validation, with a legible reason.
//   Scheduler : deterministic total order over intents, independent of arrival.
//   Validator : rejects invalid state transitions (world.canHarvest/canWater).
//   Commit    : atomic apply on success.
//
// Scenario (50,000 entities): 25k crops (ripe) + 25k fish (bystanders).
//   tick 0: Player A claims every crop (duration 3).
//   tick 1: Player B tries to water every crop  -> all blocked at CLAIM.
//   tick 4: claims expired -> Player A harvests every crop -> all commit.
//   throughout: the 25k fish are never claimed, never touched.

const { World, TYPE } = require('./soa_world');

// --- Claim layer -----------------------------------------------------------
class ClaimSystem {
  constructor() { this.claims = new Map(); } // entity -> { holder, expires }
  claim(e, who, tick, duration) {
    const c = this.claims.get(e);
    if (c && tick < c.expires && c.holder !== who) {
      return { ok: false, reason: `already claimed by ${c.holder} until tick ${c.expires}` };
    }
    this.claims.set(e, { holder: who, expires: tick + duration });
    return { ok: true };
  }
  held(e, who, tick) {
    const c = this.claims.get(e);
    return !!c && tick < c.expires && c.holder === who;
  }
}

// --- Scheduler: deterministic order regardless of arrival ------------------
function schedule(intents) {
  // priority: harvest(0) before water(1); tie-break by entity index. Stable,
  // arrival-independent. (Total-order sort is deterministic by construction;
  // this layer exists so ordering is a decided policy, not an accident.)
  const prio = { harvest: 0, water: 1 };
  return [...intents].sort((a, b) =>
    (prio[a.action] - prio[b.action]) || (a.entity - b.entity));
}

// --- one intent through Claim -> Validate -> Commit ------------------------
function process(world, claims, intent, tick) {
  const c = claims.claim(intent.entity, intent.who, tick, intent.duration ?? 0);
  if (!c.ok) return { stage: 'claim', ok: false, reason: c.reason };
  const v = intent.action === 'harvest'
    ? world.harvest(intent.entity)   // validate + commit atomically
    : world.water(intent.entity);
  return { stage: v.ok ? 'commit' : 'validate', ok: v.ok, reason: v.reason };
}

// --- build world -----------------------------------------------------------
const CROPS = 25000, FISH = 25000, N = CROPS + FISH;
const w = new World(N);
const cropIds = [], fishIds = [];
for (let i = 0; i < CROPS; i++) cropIds.push(w.spawn(TYPE.CROP, { growth: 100, water: 0, species: i % 5 }));
for (let i = 0; i < FISH; i++) fishIds.push(w.spawn(TYPE.FISH, { depth: 3, size: 200, species: i % 4 }));

const claims = new ClaimSystem();

// tick 0: A claims every crop (duration 3)
let aClaimed = 0;
for (const e of schedule(cropIds.map(entity => ({ entity }))).map(x => x.entity)) {
  if (claims.claim(e, 'A', 0, 3).ok) aClaimed++;
}

// tick 1: B tries to water every crop -> must be blocked at the claim stage
let bBlocked = 0, bLeaked = 0;
const bIntents = schedule(cropIds.map(entity => ({ entity, who: 'B', action: 'water', duration: 0 })));
for (const intent of bIntents) {
  const r = process(w, claims, intent, 1);
  if (!r.ok && r.stage === 'claim') bBlocked++;
  else bLeaked++; // any B success or non-claim rejection is contamination
}

// tick 4: claims (0..3) expired -> A harvests every crop
let harvested = 0, harvestFail = 0;
const aIntents = schedule(cropIds.map(entity => ({ entity, who: 'A', action: 'harvest', duration: 0 })));
for (const intent of aIntents) {
  const r = process(w, claims, intent, 4);
  if (r.ok && r.stage === 'commit') harvested++; else harvestFail++;
}

// bystanders: every fish untouched (not destroyed, never claimed, still catchable)
let fishUntouched = 0;
for (const e of fishIds) {
  if (!w.destroyed[e] && w.harvestable[e] && !claims.claims.has(e)) fishUntouched++;
}

// crops watered by B? (must be zero — B never got past the claim gate)
let cropsWateredByB = 0;
for (const e of cropIds) if (w.crop_water[w.componentIndex[e]] > 0) cropsWateredByB++;

const checks = [
  ['A claimed all 25k crops',                aClaimed === CROPS],
  ['B blocked at claim on all 25k, zero leak', bBlocked === CROPS && bLeaked === 0],
  ['no crop was watered by B',                cropsWateredByB === 0],
  ['A harvested all 25k after expiry',        harvested === CROPS && harvestFail === 0],
  ['all 25k fish left untouched',             fishUntouched === FISH],
];

console.log('=== CAPSTONE: claim/schedule/validate/commit on packed SoA world ===');
console.log(`entities: ${N} (${CROPS} crops + ${FISH} fish)\n`);
for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`);
const allPass = checks.every(([, p]) => p);
console.log(`\nhot-path packed size: ${(w.hotByteLength() / w.count).toFixed(2)} B/entity`);
console.log('  (type + destroyed + harvestable + componentIndex; excludes cold uuid strings');
console.log('   and the claim/pending maps, which live outside the packed arrays by design)');
console.log(allPass ? '\nALL PASS — conflict-safety holds on the dense typed-array world.' : '\nSOME FAILED');
if (!allPass) process.exitCode = 1;
