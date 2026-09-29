'use strict';
// =============================================================================
// EXPERIMENT 019 (with the core) — PERSISTENCE, MEASURED. Spine decision #3.
// Two rival save/load couplings against the invariants everything else rests
// on. `node core/persistence_test.js`
//
//   WINNER  (persistence.js): authoritative-only + rebuild derived + preserve
//            the uuid high-water mark.
//   RIVAL   (naive, inline):  ALSO persist the derived indexes, and reset the
//            uuid counter to the live count on load.
//
// Properties, all computed: ROUND-TRIP fidelity, INDEX correctness post-load,
// IDENTITY safety (no recycled uuid), STALE-PROOF (a tampered on-disk index
// must not load as a lie), and INTEGRATION (persist composes with the protocol).
// =============================================================================
const { Engine, TYPE, TYPE_NAME } = require('./engine.js');
const P = require('./persistence.js');
const IR = require('./protocol.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// world signature: live entities (by uuid) + tombstones + the id counter.
// Anything a faithful round-trip must reproduce EXACTLY.
function sig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    const r = w.componentIndex[e];
    rows.push(`${w.uuid[e]}|${TYPE_NAME[w.type[e]]}|p=${w.parent[e]>=0?w.uuid[w.parent[e]]:'-'}|n=${w.name[e]}|refs=${w.refs[e].join(',')}` +
      `|w=${w.type[e]===TYPE.CROP?w.crop_water[r]:'-'}|g=${w.type[e]===TYPE.CROP?w.crop_growth[r]:'-'}` +
      `|hp=${w.type[e]===TYPE.ENEMY?w.enemy_hp[r]:'-'}|t=${w.type[e]===TYPE.ZONE?w.zone_tally[r]:'-'}`);
  }
  rows.sort();
  const tomb = [...w.tombstones.entries()].map(([u,t])=>`${u}:${t.type}:${t.lastName}`).sort();
  return `SEQ=${w._uuidSeq}\nLIVE:\n${rows.join('\n')}\nTOMB:\n${tomb.join('\n')}`;
}

// a representative world: nesting, refs, and a DELETE so a tombstone exists and
// seq != live-count (the condition that trips a naive reload).
function buildWorld() {
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 7 }).uuid;      // u0
  const c1 = g.spawn(TYPE.CROP, { name: 'A', parent: zone, growth: 40, water: 10 }).uuid; // u1
  const c2 = g.spawn(TYPE.CROP, { name: 'B', parent: zone, growth: 60, water: 0 }).uuid;  // u2
  const quest = g.spawn(TYPE.ENEMY, { name: 'boar', refs: [c1] }).uuid;   // u3 references c1
  const doomed = g.spawn(TYPE.CROP, { name: 'Doomed', parent: zone }).uuid; // u4
  g.submit([{ actor: 'sys', ops: [{ kind: 'delete', target: doomed }] }]); // u4 -> tombstone; seq=5, live=4
  return { g, zone, c1, c2, quest, doomed };
}

// ---- RIVAL: naive persist-derived + reset-counter ------------------------
function naiveSave(engine) {
  const base = P.save(engine);
  // ALSO serialise the derived indexes (the mistake), and drop the seq counter.
  const w = engine.w;
  base._indexes = {
    byType: [...w.byType.entries()].map(([k,s])=>[k,[...s]]),
    childrenOf: [...w.childrenOf.entries()].map(([k,s])=>[k,[...s]]),
    referrersOf: [...w.referrersOf.entries()].map(([k,s])=>[k,[...s]]),
  };
  delete base.uuidSeq;      // naive: "we'll just recompute the counter on load"
  return base;
}
function naiveLoad(obj) {
  // reconstruct entities like the winner, but TRUST the stored indexes and
  // reset the counter to the live count.
  const g = new Engine(Math.max(64, obj.entities.length * 2));
  const w = g.w;
  const parentUuid = [];
  for (const ent of obj.entities) {
    const e = w.count++;
    w.type[e]=ent.type; w.destroyed[e]=0; w.uuid[e]=ent.uuid; w.byUuid.set(ent.uuid,e);
    w.name[e]=ent.name; w.refs[e]=(ent.refs||[]).slice(); w.parent[e]=-1; parentUuid[e]=ent.parent;
    const row=w._poolNext[ent.type]++; w.componentIndex[e]=row;
    if (ent.type===TYPE.CROP){w.crop_growth[row]=ent.growth||0;w.crop_water[row]=ent.water||0;}
    else if (ent.type===TYPE.ENEMY) w.enemy_hp[row]=ent.hp||0;
    else if (ent.type===TYPE.ZONE) w.zone_tally[row]=ent.tally||0;
  }
  for (let e=0;e<w.count;e++){const pu=parentUuid[e]; if(pu!=null){const pe=w.byUuid.get(pu); if(pe!==undefined)w.parent[e]=pe;}}
  for (const t of obj.tombstones||[]) w.tombstones.set(t.uuid,{type:t.type,lastName:t.lastName});
  // THE TWO MISTAKES:
  w._uuidSeq = w.byUuid.size;   // reset counter to live count (recycles ids)
  const load = (arr)=>new Map(arr.map(([k,s])=>[k,new Set(s)]));
  w.byType = load(obj._indexes.byType);           // trust stored indexes...
  w.childrenOf = load(obj._indexes.childrenOf);
  w.referrersOf = load(obj._indexes.referrersOf); // ...even if they're stale
  return g;
}

// ---------------------------------------------------------------------------
console.log('=== 019 persistence: authoritative-rebuild vs naive persist-derived ===\n');

// --- P1 ROUND-TRIP FIDELITY -------------------------------------------------
console.log('--- P1  round-trip reproduces the world exactly ---');
{
  const { g } = buildWorld();
  const before = sig(g);
  const g2 = P.loadText(P.saveText(g));
  ok(sig(g2) === before, 'WINNER: save->load reproduces live entities + tombstones + seq exactly');
}

// --- P2 INDEX CORRECTNESS post-load ----------------------------------------
console.log('\n--- P2  derived indexes are correct after load ---');
{
  const { g, c1 } = buildWorld();
  const refsBefore = g.referrersOf(c1).length;
  const g2 = P.load(P.save(g));
  ok(g2.indexesConsistent(), 'WINNER: rebuilt indexes == ground-truth oracle');
  ok(g2.referrersOf(c1).length === refsBefore && refsBefore === 1, 'WINNER: reverse-ref query survives the round-trip');
}

// --- P3 IDENTITY SAFETY: no recycled uuid (the RD-004/004.6 killer) ---------
console.log('\n--- P3  after load, a NEW spawn must not recycle a tombstoned uuid ---');
{
  const { g, doomed } = buildWorld();       // "doomed" (u4) is a tombstone; seq=5, live=4
  ok(g.w.resolve(doomed).status === 'deleted', 'precondition: doomed uuid is a tombstone before save');

  // WINNER
  const gW = P.load(P.save(g));
  const newW = gW.spawn(TYPE.CROP, { name: 'fresh' }).uuid;
  ok(newW !== doomed, `WINNER: new uuid (${newW}) != recycled tombstone (${doomed})`);
  ok(gW.w.resolve(doomed).status === 'deleted', 'WINNER: the old tombstone STILL resolves as deleted (identity preserved)');

  // RIVAL
  const gR = naiveLoad(naiveSave(g));
  const newR = gR.spawn(TYPE.CROP, { name: 'fresh' }).uuid;
  ok(newR === doomed, `RIVAL: reset counter RECYCLES the tombstoned uuid (${newR} === ${doomed}) — the freelist bug via save/load`);
  ok(gR.w.resolve(doomed).status === 'live', 'RIVAL: a stale reference to the deleted object now silently resolves LIVE (identity corrupted)');
}

// --- P4 STALE-PROOF: a tampered on-disk index must not load as a lie --------
console.log('\n--- P4  a tampered/stale on-disk index (the RD-017 failure at storage) ---');
{
  const { g, c1 } = buildWorld();

  // RIVAL stores the index, so it CAN be stale/tampered — drop a referrer edge.
  const blob = naiveSave(g);
  blob._indexes.referrersOf = blob._indexes.referrersOf.map(([k,s]) => [k, s.filter(() => false)]); // wipe reverse edges
  const gR = naiveLoad(blob);
  ok(!gR.indexesConsistent(), 'RIVAL: tampered index loads a LIE — index != data, silently (query now wrong)');
  ok(gR.referrersOf(c1).length === 0, "RIVAL: 'who references c1?' answers WRONG after a corrupted save");

  // WINNER stores no index, so there is nothing to tamper — rebuild is truth.
  const gW = P.load(P.save(g));
  ok(gW.indexesConsistent() && gW.referrersOf(c1).length === 1, 'WINNER: no stored index to corrupt — rebuild is always consistent');
}

// --- P5 SIZE (minor): persisting the derived index is pure redundant bytes --
console.log('\n--- P5  the naive blob is strictly larger (redundant derived data) ---');
{
  const { g } = buildWorld();
  const win = JSON.stringify(P.save(g)).length;
  const naive = JSON.stringify(naiveSave(g)).length;
  ok(naive > win, `WINNER blob ${win} B < naive ${naive} B (indexes are recomputable, not worth storing)`);
}

// --- P6 INTEGRATION: persistence composes with the protocol + pipeline ------
console.log('\n--- P6  a reloaded engine drives protocol proposals normally ---');
{
  const { g, c1 } = buildWorld();
  const g2 = P.loadText(P.saveText(g));
  // run a structured-IR proposal (RD-018) against the RELOADED engine
  const r = IR.apply(g2, JSON.stringify({ actor: 'ai',
    ops: [{ op: 'setfield', target: c1, field: 'water', value: 90 }],
    asserts: [{ target: c1, field: 'water', cmp: '<=', value: 90 }] }));
  ok(r.accepted && r.result.results[0].status === 'committed', 'reloaded engine accepts + commits a valid IR proposal');
  ok(g2.w.crop_water[g2.w.componentIndex[g2.w.liveEntity(c1)]] === 90 && g2.indexesConsistent(),
     'the write landed and indexes stayed consistent post-reload');
  // and re-saving the mutated engine round-trips again (persistence is stable)
  const g3 = P.loadText(P.saveText(g2));
  ok(sig(g3) === sig(g2), 'save->load->mutate->save->load is stable (idempotent round-trip)');
}

// --- P7 BRIDGE to #9: snapshot is O(live state); event-log is O(all history) -
console.log('\n--- P7  snapshot size tracks LIVE state, not history length (why snapshot for persistence) ---');
{
  // Honest framing: a FULL faithful replay of the transaction log DOES reproduce
  // identities correctly (it re-runs every spawn, so the uuid counter advances
  // identically). The real reason snapshot wins for PERSISTENCE is cost: churn
  // (create-then-delete) leaves live state tiny while the log grows without
  // bound. Snapshot load is O(live); replay load is O(all ops ever).
  const g = new Engine(4096);
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  let logOps = 0;
  for (let i = 0; i < 50; i++) {
    const r = IR.apply(g, JSON.stringify({ actor:'ai', ops:[{op:'createChild', childType:'crop', parent: zone, props:{name:'tmp'+i}}] }));
    logOps++;
    const born = r.result.results[0]._created[0];
    g.submit([{ actor:'sys', ops:[{ kind:'delete', target: born }] }]); logOps++;
  }
  // net live state: just the zone. tombstones: 50. log: 100 ops.
  const liveCount = g.allOfType(TYPE.CROP).length; // 0 crops survive
  const snapshotBytes = JSON.stringify(P.save(g)).length;
  ok(liveCount === 0, `after 50 create+delete churns, 0 crops live (${logOps} ops in history)`);
  const g2 = P.load(P.save(g));
  ok(g2.indexesConsistent() && g2.allOfType(TYPE.CROP).length === 0, 'snapshot reload is O(live state) and correct — history length irrelevant');
  ok(snapshotBytes < 100 * 40, `snapshot ~${snapshotBytes} B stays small though the log holds ${logOps} ops — replay-persistence would carry all of them`);
  console.log('    => snapshot for persistence (#3); the transaction log is the substrate for UNDO (#9), where locality matters, not full reload.');
}

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — persistence`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
