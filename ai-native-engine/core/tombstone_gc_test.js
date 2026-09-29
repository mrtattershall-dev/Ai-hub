'use strict';
// =============================================================================
// TOMBSTONE GC (RD-019.1) — bound the RD-019 open cost, measured.
// The question: when is a tombstone safe to drop? Three policies:
//   NEVER  — keep every tombstone forever (RD-019 baseline; unbounded).
//   EAGER  — drop at delete time = HardDelete, no tombstone (RD-004.6's rejected
//            extreme: loses `deleted` vs `missing` even while a live ref exists).
//   REFCNT — drop a tombstone only when NO live entity references its uuid
//            (refs[] or dangling parent). Keeps metadata while useful, then reclaims.
// Properties: SAFETY (no uuid recycle, no wrong-live resolve), METADATA (deleted
// w/ type+name while referenced), STORAGE (bounded), INTEGRATION (persist/index).
// `node core/tombstone_gc_test.js`
// =============================================================================
const { Engine, TYPE } = require('./engine.js');
const P = require('./persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

console.log('=== RD-019.1 tombstone GC: when is a tombstone safe to drop? ===\n');

// --- S1 metadata preserved WHILE a live entity still references the tombstone
console.log('--- S1 a referenced tombstone is KEPT (deleted+metadata still available) ---');
{
  const g = new Engine(64);
  const sword = g.spawn(TYPE.CROP, { name: 'Sword' }).uuid;
  const quest = g.spawn(TYPE.ENEMY, { name: 'Quest', refs: [sword] }).uuid; // quest -> sword
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: sword }] }]);
  const gc = g.gcTombstones();
  ok(gc.kept.includes(sword) && gc.dropped.length === 0, 'sword tombstone KEPT — the quest still references it');
  const r = g.w.resolve(sword);
  ok(r.status === 'deleted' && r.lastName === 'Sword', 'resolve still reports deleted + last-known name (metadata intact)');
}

// --- S2 once the referrer is gone, the tombstone is reclaimed ---------------
console.log('\n--- S2 an UNREFERENCED tombstone is DROPPED (storage reclaimed) ---');
{
  const g = new Engine(64);
  const sword = g.spawn(TYPE.CROP, { name: 'Sword' }).uuid;
  const quest = g.spawn(TYPE.ENEMY, { name: 'Quest', refs: [sword] }).uuid;
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: sword }] }]);
  ok(g.gcTombstones().dropped.length === 0, 'while referenced: kept');
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: quest }] }]); // remove the referrer
  const gc = g.gcTombstones();
  ok(gc.dropped.includes(sword), 'after the referrer is deleted: sword tombstone DROPPED');
  ok(g.w.resolve(sword).status === 'missing', 'a later ref now resolves MISSING — honest degradation, not a wrong object');
}

// --- S3 SAFETY: a dropped uuid is NEVER recycled (RD-004.6 preserved) -------
console.log('\n--- S3 safety: GC never enables uuid recycling ---');
{
  const g = new Engine(64);
  const a = g.spawn(TYPE.CROP, { name: 'A' }).uuid;      // u0
  g.submit([{ actor: 'x', ops: [{ kind: 'delete', target: a }] }]);
  g.gcTombstones(); // drops u0's tombstone (nothing references it)
  ok(g.w.tombstones.size === 0, 'tombstone dropped');
  const b = g.spawn(TYPE.CROP, { name: 'B' }).uuid;      // must NOT reuse u0
  ok(b !== a, `new spawn got a fresh uuid (${b} != dropped ${a}) — seq preserved, no recycle`);
  ok(g.w.resolve(a).status === 'missing' && g.w.liveEntity(a) < 0, 'the dropped uuid resolves missing, never to the new object');
}

// --- S4 dangling PARENT pointer also keeps a tombstone (structural ref) -----
console.log('\n--- S4 a live child keeps its deleted parent\'s tombstone (structural ref) ---');
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'zone' }).uuid;
  const child = g.spawn(TYPE.CROP, { name: 'child', parent: zone }).uuid;
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: zone }] }]); // orphan the child (RD-005.2 surfaces, no cascade)
  const gc = g.gcTombstones();
  ok(gc.kept.includes(zone), 'zone tombstone KEPT — the orphaned child still points at it via parent');
  ok(g.w.resolve(zone).status === 'deleted', 'the orphan can still discover its parent was deleted (migration metadata)');
}

// --- S5 STORAGE: churn workload — REFCNT bounds tombstones, NEVER doesn't ----
console.log('\n--- S5 storage under churn (create+delete x100, no lingering refs) ---');
{
  const g = new Engine(4096);
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  for (let i = 0; i < 100; i++) {
    const c = g.spawn(TYPE.CROP, { name: 'tmp' + i, parent: zone }).uuid;
    g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: c }] }]);
  }
  const neverCount = g.w.tombstones.size;                 // NEVER policy = 100
  const gc = g.gcTombstones();                            // REFCNT
  ok(neverCount === 100, `NEVER-GC keeps all ${neverCount} tombstones (unbounded — the RD-019 cost)`);
  ok(g.w.tombstones.size === 0, `REFCNT-GC reclaims all 100 (none referenced) -> ${g.w.tombstones.size} left`);
  ok(g.gcTombstones().dropped.length === 0, 'idempotent: a second GC drops nothing');
}

// --- S6 the METADATA argument vs EAGER (HardDelete) -------------------------
console.log('\n--- S6 why not just HardDelete (EAGER)? metadata is available exactly when useful ---');
{
  const g = new Engine(64);
  const item = g.spawn(TYPE.CROP, { name: 'Relic' }).uuid;
  const holder = g.spawn(TYPE.ENEMY, { name: 'Chest', refs: [item] }).uuid;
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: item }] }]);
  g.gcTombstones(); // holder still references item -> kept
  // REFCNT: while the chest points at the relic, we can tell the player "Relic (deleted)".
  ok(g.w.resolve(item).status === 'deleted' && g.w.resolve(item).lastName === 'Relic',
     'REFCNT: deleted+name available WHILE the chest still references it (EAGER/HardDelete would already say missing)');
}

// --- S7 INTEGRATION: GC composes with persistence + leaves indexes intact ---
console.log('\n--- S7 GC composes with persistence (RD-019) and indexes (RD-017) ---');
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const keep = g.spawn(TYPE.CROP, { name: 'Keep' }).uuid;
  const ref = g.spawn(TYPE.ENEMY, { name: 'Ref', refs: [keep], parent: zone }).uuid;
  const gone = g.spawn(TYPE.CROP, { name: 'Gone', parent: zone }).uuid;
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: keep }] }]);  // referenced -> keep tombstone
  g.submit([{ actor: 'a', ops: [{ kind: 'delete', target: gone }] }]);  // unreferenced -> droppable
  const gc = g.gcTombstones();
  ok(gc.kept.includes(keep) && gc.dropped.includes(gone), 'GC kept the referenced tombstone, dropped the orphan one');
  ok(g.indexesConsistent(), 'indexes still consistent after GC (GC touches only tombstones)');
  const g2 = P.loadText(P.saveText(g));
  ok(g2.w.tombstones.has(keep) && !g2.w.tombstones.has(gone), 'the smaller tombstone set round-trips through save/load');
  ok(g2.w.resolve(keep).status === 'deleted', 'kept tombstone still resolves deleted after reload');
}

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — tombstone GC`);
console.log('  Verdict: REFCNT-GC — drop a tombstone iff no live ref points at it. Bounds the');
console.log('  RD-019 storage cost (unlike NEVER) while keeping deleted-metadata exactly while it');
console.log('  is still reachable (unlike EAGER/HardDelete). Safe by RD-004.6: uuids never recycle.');
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
