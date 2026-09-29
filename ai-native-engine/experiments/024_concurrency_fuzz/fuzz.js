'use strict';
// RD-CONC — CONCURRENCY FUZZER. Adversarial property-based testing of the whole
// pipeline. Generates random multi-actor batches and asserts the invariants that
// define correctness for this engine, on every one:
//
//   P1 DETERMINISM (RD-003, the crux): the committed state must be IDENTICAL
//      regardless of the arrival order of the transactions in a batch. We run
//      the batch and several random permutations of it on fresh clones of the
//      same world and compare signatures. This is the exact property the whole
//      Claim->Schedule->Validate->Commit pipeline exists to guarantee.
//   P2 INDEX CONSISTENCY (RD-001/017): indexes == ground-truth after every commit.
//   P3 IDENTITY (RD-004/004.6): byUuid<->uuid coherent, no live handle to a
//      destroyed slot.
//   P4 STRUCTURE (RD-005.2): no parent cycles; order-keys finite.
//   P5 UNDO ROUND-TRIP (RD-020): undo returns the exact pre-batch state; redo the post.
//   P6 RELOAD-FORK DETERMINISM (RD-B6.1): save/load the committed world (with
//      tombstones -> compaction), drive both branches with a second batch
//      (spawns included), then re-fork the reloaded branch and repeat — TWO
//      chained reload cycles, since the original orderKey bug was a second-
//      cycle divergence. Signatures AND save bytes must stay identical.
//
// Deterministic PRNG (seeded) so any failure prints a REPRODUCIBLE seed.
// Zero deps. `node fuzz.js [iterations] [masterSeed]`

const { Engine, TYPE, TYPE_NAME } = require('../../core/engine.js');
const P = require('../../core/persistence.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const permute = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// full committed-state signature (everything a correct engine must reproduce)
// type-correct row: read ONLY the fields the entity's type owns (componentIndex
// is per-type-pool, so reading another pool at that row index is cross-pool garbage).
function row(w, e) {
  const r = w.componentIndex[e], t = w.type[e];
  return [w.uuid[e], TYPE_NAME[t], w.parent[e] >= 0 ? w.uuid[w.parent[e]] : '-', w.name[e],
    t === TYPE.CROP ? w.crop_water[r] : '-', t === TYPE.CROP ? w.crop_growth[r] : '-',
    t === TYPE.ENEMY ? w.enemy_hp[r] : '-', t === TYPE.ZONE ? w.zone_tally[r] : '-',
    w.orderKey[e].toFixed(6)].join(':');
}
function sig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) if (!w.destroyed[e]) rows.push(row(w, e));
  rows.sort();
  return `SEQ${w._uuidSeq}\n${rows.join('|')}\nT:${[...w.tombstones.keys()].sort().join(',')}`;
}
// Undo guarantees restoration of the OBSERVABLE (live) world, NOT internal
// bookkeeping: undo-of-create legitimately advances _uuidSeq (RD-004.6, ids never
// recycle) and leaves a tombstone (RD-020). So the undo/redo property compares
// live-entity state only.
function liveSig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) if (!w.destroyed[e]) rows.push(row(w, e));
  return rows.sort().join('|');
}

function buildWorld(rnd) {
  const g = new Engine(512);
  const ids = [];
  const n = 8 + Math.floor(rnd() * 12);
  for (let i = 0; i < n; i++) {
    const t = pick(rnd, [TYPE.ZONE, TYPE.CROP, TYPE.CROP, TYPE.ENEMY]);
    const parent = (i > 0 && rnd() < 0.6) ? pick(rnd, ids) : null;
    const refs = (i > 0 && rnd() < 0.3) ? [pick(rnd, ids)] : [];
    ids.push(g.spawn(t, { name: 'e' + i, parent, refs,
      growth: Math.floor(rnd() * 100), water: Math.floor(rnd() * 50), hp: 100, tally: Math.floor(rnd() * 10) }).uuid);
  }
  return { g, ids };
}

function randOp(g, ids, rnd) {
  const live = ids.filter(u => g.w.liveEntity(u) >= 0);
  if (!live.length) return { kind: 'setfield', target: ids[0], field: 'water', value: 1 };
  const target = pick(rnd, live);
  const k = rnd();
  if (k < 0.35) {
    // orderKey included since RD-B6.1: P4 asserts "keys finite" but nothing ever
    // GENERATED a raw orderKey write (incl. Infinity/NaN), so the assertion had
    // no generator behind it — the engine's finiteness guard was unexercised.
    const f = pick(rnd, [['water', 255], ['growth', 255], ['tally', 1000], ['hp', 500], ['name', null], ['orderKey', null]]);
    const value = f[0] === 'name' ? 'n' + Math.floor(rnd() * 50)
      : f[0] === 'orderKey' ? pick(rnd, [rnd() * 100 - 50, Math.floor(rnd() * 40) + 0.5, Infinity, NaN])
      : Math.floor(rnd() * (f[1] + 1));
    return { kind: 'setfield', target, field: f[0], value };
  }
  if (k < 0.50) return { kind: 'delete', target };
  if (k < 0.65) return { kind: 'reparent', target, parent: pick(rnd, live) };
  if (k < 0.80) return { kind: 'move', target, after: rnd() < 0.5 ? null : pick(rnd, live) };
  if (k < 0.90) return { kind: 'createChild', type: pick(rnd, [TYPE.CROP, TYPE.ENEMY]), parent: target, props: { name: 'c' + Math.floor(rnd() * 50) } };
  // claim TTLs included since RD-022: valid short leases, the cap edge (64/65),
  // and the measured silent-break inputs (NaN, Infinity, 0, 1e9, string) — the
  // invalid ones must reject deterministically with zero footprint (P1 compares
  // committed state AND the rejected set across permutations; pre-fix, NaN left
  // a never-swept zombie entry and 1e9 an unbounded hold).
  return { kind: 'claim', target,
    ticks: pick(rnd, [1, 2, 2, 3, 64, 65, 0, NaN, Infinity, 1e9, '5']) };
}

function randBatch(g, ids, rnd) {
  const m = 2 + Math.floor(rnd() * 4);          // 2..5 transactions
  const txs = [];
  for (let i = 0; i < m; i++) {
    // DISTINCT actor per tx: the determinism guarantee is over CROSS-ACTOR
    // arrival order. A single actor's txs carry a causal order (submission
    // sequence) that must NOT be permuted — so we give each tx its own actor,
    // making every permutation a valid arrival reordering.
    const actor = 'A' + i;
    const nops = 1 + Math.floor(rnd() * 2);
    const ops = []; for (let j = 0; j < nops; j++) ops.push(randOp(g, ids, rnd));
    txs.push({ actor, ops });
  }
  return txs;
}

function checkInvariants(g) {
  const bad = [];
  if (!g.indexesConsistent()) bad.push('P2 index desync');
  const w = g.w;
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    let cur = w.parent[e], hops = 0, seen = false;
    while (cur >= 0) { if (cur === e) { seen = true; break; } cur = w.parent[cur]; if (++hops > w.count + 2) { seen = true; break; } }
    if (seen) { bad.push('P4 parent cycle at ' + e); break; }
    if (!Number.isFinite(w.orderKey[e])) bad.push('P4 non-finite orderKey at ' + e);
  }
  for (const [u, e] of w.byUuid) {
    if (w.destroyed[e]) { bad.push('P3 byUuid->destroyed ' + u); break; }
    if (w.uuid[e] !== u) { bad.push('P3 uuid mismatch ' + u); break; }
  }
  return bad;
}

// ---------------------------------------------------------------------------
const ITER = parseInt(process.argv[2] || '20000', 10);
const MASTER = parseInt(process.argv[3] || '1', 10);
const PERMS = 6;
let failures = [];

for (let it = 0; it < ITER && failures.length < 5; it++) {
  const worldSeed = (MASTER * 1000003 + it * 97 + 1) >>> 0;
  const batchSeed = (MASTER * 7919 + it * 131 + 5) >>> 0;
  const { g: g0, ids } = buildWorld(mulberry32(worldSeed));
  const batch = randBatch(g0, ids, mulberry32(batchSeed));

  // RD-B2.1: a quarter of iterations run P1 (and P5) WITH a small global
  // per-tick op budget — 1..6 ops against a 2..10-op batch demand, so budget
  // REJECTION is active most budgeted iterations and P1 asserts that WHICH txs
  // lose survives all 6 permutations (the RD-B2.1 admission-order property).
  // tickOpsBudget is session config, NOT persisted (P.load builds a default
  // engine), so it is re-applied explicitly to every loaded branch.
  const tickBudget = (it % 4 === 0)
    ? 1 + Math.floor(mulberry32((batchSeed ^ 0x71C7) >>> 0)() * 6) : null;

  // P1 determinism: batch vs random permutations, on fresh clones of g0
  const base = P.save(g0);
  const wa = P.load(base); wa.tickOpsBudget = tickBudget; wa.submit(batch); const sa = sig(wa);
  const permRnd = mulberry32((batchSeed ^ 0xABCD) >>> 0);
  for (let k = 0; k < PERMS; k++) {
    const pb = permute(permRnd, batch);
    const wp = P.load(base); wp.tickOpsBudget = tickBudget; wp.submit(pb);
    if (sig(wp) !== sa) { failures.push({ kind: 'P1 determinism', worldSeed, batchSeed, k, tickBudget, sa, sp: sig(wp) }); break; }
  }

  // P2/P3/P4 invariants on the committed world
  const inv = checkInvariants(wa);
  if (inv.length) failures.push({ kind: inv.join('; '), worldSeed, batchSeed });

  // P6 RELOAD-FORK DETERMINISM (RD-B6.1): fork the COMMITTED world (which may
  // now hold tombstones — load compacts them out) via save/load, then drive
  // both branches with a second random batch that includes createChild spawns.
  // This is the exact class the orderKey-index bug hid in (compaction + post-
  // reload spawn): 20k iterations of P1-P5 were green WITH that bug present,
  // because no property ever compared a reloaded branch against the branch
  // that never saved. sig() covers it all: orderKey values, uuid mints (SEQ),
  // tombstones, fields.
  {
    // CHAINED cycles, not a single round-trip: the orderKey-index bug was a
    // SECOND-cycle divergence (save->load->spawn->save differed), and a
    // single-reload P6 only ever proves cycle 1. Cycle 2 re-forks the already-
    // reloaded branch (wb -> save -> load), so compaction-of-a-compaction,
    // stub re-materialization, and post-reload-spawn keys all cross the seam
    // AGAIN before the final comparison.
    let wb = P.load(P.save(wa));
    // Claims are SESSION state, ephemeral by decision (RD-002/RD-020: "history
    // is ephemeral, not persisted, like claims") — a reload releases them.
    // Release them on the original branch too, at each fork point, so P6
    // asserts determinism of everything PERSISTED while keeping the claims
    // exclusion explicit (first P6 runs caught exactly this divergence: a
    // batch-1 claim rejected batch-2 writes on one branch only). Ownership of
    // disconnect/expiry semantics: the open claim-TTL card.
    //
    // RD-B2.1 BUDGET CONSISTENCY: P6 runs BUDGET-OFF on both branches.
    // persistence.js is owned by another workstream and does not carry
    // tickOpsBudget, so P.load's wb would otherwise silently diverge from a
    // budgeted wa on batch2 — an instrument artifact, not an engine finding
    // (the RD-021 discipline). Same-setting-both-branches is the invariant;
    // OFF is the setting chosen here (P1 above already fuzzes the budget path).
    wa.tickOpsBudget = null;
    for (let cycle = 0; cycle < 2; cycle++) {
      if (cycle > 0) { wb = P.load(P.save(wb)); wb.claims.clear(); }
      wa.claims.clear();
      const ids2 = [...wa.w.byUuid.keys()];             // live uuids, identical on both branches
      const batch2 = randBatch(wa, ids2, mulberry32(((batchSeed ^ 0x5EED) + cycle * 0x9E37) >>> 0));
      wa.submit(batch2); wb.submit(batch2);
      if (sig(wa) !== sig(wb)) {
        failures.push({ kind: `P6 reload-fork divergence (cycle ${cycle + 1})`, worldSeed, batchSeed, sa: sig(wa), sp: sig(wb) }); break;
      }
      if (P.saveText(wa) !== P.saveText(wb)) {          // bytes too: traces are blind to some divergences
        failures.push({ kind: `P6 save-byte divergence (cycle ${cycle + 1})`, worldSeed, batchSeed }); break;
      }
      const inv6 = checkInvariants(wb);
      if (inv6.length) { failures.push({ kind: `P6(reloaded, cycle ${cycle + 1}) ` + inv6.join('; '), worldSeed, batchSeed }); break; }
    }
  }

  // P5 undo round-trip on a fresh history-enabled rebuild (same budget as P1:
  // undo must restore the pre-batch state regardless of WHICH txs the budget
  // admitted — one tick is one undo step for exactly what committed).
  const { g: gh } = buildWorld(mulberry32(worldSeed));
  gh.enableHistory();
  gh.tickOpsBudget = tickBudget;
  const before = liveSig(gh);
  gh.submit(batch);
  const after = liveSig(gh);
  const u = gh.undo();
  if (u.ok && liveSig(gh) !== before) failures.push({ kind: 'P5 undo mismatch', worldSeed, batchSeed });
  else if (u.ok) { gh.redo(); if (liveSig(gh) !== after) failures.push({ kind: 'P5 redo mismatch', worldSeed, batchSeed }); }
}

console.log(`=== concurrency fuzz: ${ITER.toLocaleString()} iterations, master seed ${MASTER}, ${PERMS} permutations each ===`);
if (!failures.length) {
  console.log(`ALL PASS — determinism + index + identity + structure + undo held on every random batch.`);
} else {
  console.log(`${failures.length} FAILURE(S) FOUND:`);
  for (const f of failures) {
    console.log(`\n  [${f.kind}]  worldSeed=${f.worldSeed} batchSeed=${f.batchSeed}${f.k !== undefined ? ' perm#' + f.k : ''}`);
    if (f.sa) { console.log('   sigA: ' + f.sa.replace(/\n/g, ' | ')); console.log('   sigP: ' + f.sp.replace(/\n/g, ' | ')); }
  }
  process.exitCode = 1;
}
