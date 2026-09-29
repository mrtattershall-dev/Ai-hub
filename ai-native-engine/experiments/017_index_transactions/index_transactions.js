'use strict';
// RD-001 x RD-002/003 — INDEX CONSISTENCY UNDER TRANSACTIONS (flagged open card).
//
// RD-001 decided: authoritative data + DERIVED maintained indexes (byType,
// childrenOf, referrersOf) — because the AI asks relationship questions and a
// bare tree pays O(N) per query. RD-002/003 decided: mutation is TRANSACTIONAL
// — Claim -> Schedule -> Validate -> Commit/Reject, atomic commit or reject.
//
// Those two decisions were proven in ISOLATION. This card tests them TOGETHER
// against the one question neither answered:
//
//   When a transaction ROLLS BACK, do the derived indexes roll back WITH the
//   data — atomically — or do they leak stale entries and silently desync?
//
// Why this is the dangerous case: an index that disagrees with the data is
// INVISIBLE. The data is correct; only the AI's relationship queries are wrong,
// and they're wrong SILENTLY — "who references Z?" returns a row that no longer
// exists, "all crops" omits one that does. That is the exact failure class this
// whole project fights (RD-002 immediate-mutation corruption, RD-005 LWW,
// RD-004.6 freelist): not a crash, a quiet lie.
//
// Method (measured, not reasoned): three competing index/transaction couplings
// run as rival designs, checked every step against a GROUND-TRUTH ORACLE (the
// indexes rebuilt from scratch from committed data). Work is counted
// DETERMINISTICALLY (index writes), not wall-clock. Zero deps, `node <file>`.

// ---------------------------------------------------------------------------
// The world: authoritative object map + three derived indexes (RD-001 shapes).
// ---------------------------------------------------------------------------
function emptyWorld() {
  return {
    objs: new Map(),            // id -> {id, type, parent, refs:[...]}
    byType: new Map(),          // type -> Set(id)
    childrenOf: new Map(),      // parentId -> Set(id)
    referrersOf: new Map(),     // targetId -> Set(id)  (reverse-reference index)
  };
}
const addTo = (m, k, v) => { (m.get(k) ?? m.set(k, new Set()).get(k)).add(v); };
const delFrom = (m, k, v) => { const s = m.get(k); if (s) { s.delete(v); if (s.size === 0) m.delete(k); } };

// The ORACLE: what the indexes MUST equal — derived purely from live objects.
// If a design's live indexes ever diverge from this, the index is lying.
function rebuildIndexes(objs) {
  const byType = new Map(), childrenOf = new Map(), referrersOf = new Map();
  for (const o of objs.values()) {
    addTo(byType, o.type, o.id);
    if (o.parent != null) addTo(childrenOf, o.parent, o.id);
    for (const r of o.refs) addTo(referrersOf, r, o.id);
  }
  return { byType, childrenOf, referrersOf };
}
const dumpIx = (m) => JSON.stringify([...m.entries()].map(([k, s]) => [k, [...s].sort((a,b)=>a-b)]).sort());
function indexesMatchOracle(w) {
  const truth = rebuildIndexes(w.objs);
  return dumpIx(w.byType) === dumpIx(truth.byType)
      && dumpIx(w.childrenOf) === dumpIx(truth.childrenOf)
      && dumpIx(w.referrersOf) === dumpIx(truth.referrersOf);
}

// ---------------------------------------------------------------------------
// Operations expressed as pure intents (what a proposer / player emits).
// A transaction is an ORDERED LIST of ops; it must apply ALL or NONE.
// ---------------------------------------------------------------------------
// op kinds: create{id,type,parent,refs}, delete{id}, reparent{id,parent},
//           setref{id,refs}
// A VALIDATOR rejects an op that violates an invariant (e.g. delete-missing,
// create-duplicate). One rejected op must roll back the WHOLE transaction.

function validate(objs, op) {
  switch (op.kind) {
    case 'create':   return objs.has(op.id) ? `create: id ${op.id} already exists` : null;
    case 'delete':   return objs.has(op.id) ? null : `delete: id ${op.id} missing`;
    case 'reparent': return objs.has(op.id) ? null : `reparent: id ${op.id} missing`;
    case 'setref':   return objs.has(op.id) ? null : `setref: id ${op.id} missing`;
    default:         return `unknown op ${op.kind}`;
  }
}

// Apply an op's DATA effect only. Returns an inverse-description so callers that
// need to undo data (design EAGER) can, isolating the index question.
function applyData(objs, op) {
  switch (op.kind) {
    case 'create': objs.set(op.id, { id: op.id, type: op.type, parent: op.parent ?? null, refs: (op.refs ?? []).slice() }); return;
    case 'delete': objs.delete(op.id); return;
    case 'reparent': objs.get(op.id).parent = op.parent ?? null; return;
    case 'setref': objs.get(op.id).refs = op.refs.slice(); return;
  }
}
// Index effect for an object entering (+1) or leaving (-1) the world, or a
// field change expressed as leave-old then enter-new. Counts writes.
function indexEnter(w, o, counter) {
  addTo(w.byType, o.type, o.id); counter.n++;
  if (o.parent != null) { addTo(w.childrenOf, o.parent, o.id); counter.n++; }
  for (const r of o.refs) { addTo(w.referrersOf, r, o.id); counter.n++; }
}
function indexLeave(w, o, counter) {
  delFrom(w.byType, o.type, o.id); counter.n++;
  if (o.parent != null) { delFrom(w.childrenOf, o.parent, o.id); counter.n++; }
  for (const r of o.refs) { delFrom(w.referrersOf, r, o.id); counter.n++; }
}

// ===========================================================================
// DESIGN 1 — EAGER in-place (the naive coupling): mutate data AND indexes as
// each op runs. On a mid-transaction reject, roll back the DATA (snapshot) but
// the index writes already happened and are NOT undone. This is the "obvious"
// implementation and the one under suspicion.
// ===========================================================================
function runEager(w, tx, counter) {
  // snapshot data only (the naive author remembered data, forgot indexes)
  const dataSnap = new Map([...w.objs.entries()].map(([k, o]) => [k, { ...o, refs: o.refs.slice() }]));
  for (const op of tx) {
    const err = validate(w.objs, op);
    if (err) { w.objs = dataSnap; return { ok: false, reason: err }; } // data restored, indexes NOT
    // eager index maintenance around the data change
    if (op.kind === 'create') { applyData(w.objs, op); indexEnter(w, w.objs.get(op.id), counter); }
    else if (op.kind === 'delete') { indexLeave(w, w.objs.get(op.id), counter); applyData(w.objs, op); }
    else if (op.kind === 'reparent') { const o = w.objs.get(op.id); indexLeave(w, o, counter); applyData(w.objs, op); indexEnter(w, o, counter); }
    else if (op.kind === 'setref') { const o = w.objs.get(op.id); indexLeave(w, o, counter); applyData(w.objs, op); indexEnter(w, o, counter); }
  }
  return { ok: true };
}

// ===========================================================================
// DESIGN 2 — REBUILD on commit: apply data ops to a scratch copy; if all
// validate, swap data in and REBUILD every index from scratch. Correct by
// construction (indexes are a pure function of committed data) but O(N) per
// commit regardless of how small the change was.
// ===========================================================================
function runRebuild(w, tx, counter) {
  const scratch = new Map([...w.objs.entries()].map(([k, o]) => [k, { ...o, refs: o.refs.slice() }]));
  for (const op of tx) {
    const err = validate(scratch, op);
    if (err) return { ok: false, reason: err };   // scratch discarded, real world untouched
    applyData(scratch, op);
  }
  w.objs = scratch;
  const truth = rebuildIndexes(w.objs);            // full rebuild
  for (const o of w.objs.values()) { counter.n++; } // O(N) cost, counted honestly
  w.byType = truth.byType; w.childrenOf = truth.childrenOf; w.referrersOf = truth.referrersOf;
  return { ok: true };
}

// ===========================================================================
// DESIGN 3 — STAGED deltas: the transaction stages BOTH data and index changes
// and applies them to the LIVE world only after every op validates. Nothing —
// data or index — touches the world until commit; a reject applies nothing.
// O(change-size), and atomic across data+index by construction.
// ===========================================================================
function runStaged(w, tx, counter) {
  // stage on a scratch data copy so validation sees intra-tx effects...
  const scratch = new Map([...w.objs.entries()].map(([k, o]) => [k, { ...o, refs: o.refs.slice() }]));
  const indexOps = []; // {dir:+1|-1, snapshot-of-object-at-that-moment}
  for (const op of tx) {
    const err = validate(scratch, op);
    if (err) return { ok: false, reason: err };   // NOTHING applied to live world
    if (op.kind === 'create') { applyData(scratch, op); indexOps.push({ dir: +1, o: { ...scratch.get(op.id), refs: scratch.get(op.id).refs.slice() } }); }
    else if (op.kind === 'delete') { indexOps.push({ dir: -1, o: { ...scratch.get(op.id), refs: scratch.get(op.id).refs.slice() } }); applyData(scratch, op); }
    else if (op.kind === 'reparent' || op.kind === 'setref') {
      const before = { ...scratch.get(op.id), refs: scratch.get(op.id).refs.slice() };
      indexOps.push({ dir: -1, o: before }); applyData(scratch, op);
      indexOps.push({ dir: +1, o: { ...scratch.get(op.id), refs: scratch.get(op.id).refs.slice() } });
    }
  }
  // commit point: swap data, then replay staged index deltas onto live indexes
  w.objs = scratch;
  for (const d of indexOps) { if (d.dir === +1) indexEnter(w, d.o, counter); else indexLeave(w, d.o, counter); }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI relationship query, run THROUGH the maintained indexes (the point of them).
// After a rollback, this must equal the same query over ground truth — or the
// index is silently lying to the model.
// ---------------------------------------------------------------------------
const qReferrers = (w, z) => [...(w.referrersOf.get(z) ?? [])].sort((a,b)=>a-b);
const qByType    = (w, t) => [...(w.byType.get(t) ?? [])].sort((a,b)=>a-b);
const truthReferrers = (objs, z) => [...objs.values()].filter(o => o.refs.includes(z)).map(o=>o.id).sort((a,b)=>a-b);

// ---------------------------------------------------------------------------
// TEST HARNESS
// ---------------------------------------------------------------------------
let PASS = 0, FAIL = 0;
const ok  = (c, m) => { (c ? PASS++ : FAIL++); console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

function seedWorld(run) {
  const w = emptyWorld(); const c = { n: 0 };
  // 6 objects; obj 5 references obj 42... which doesn't exist yet, keep simple:
  // crops 1,2,3 (children of 0); fish 10,11; and 3 references 1.
  run(w, [
    { kind: 'create', id: 0, type: 'zone', parent: null, refs: [] },
    { kind: 'create', id: 1, type: 'crop', parent: 0, refs: [] },
    { kind: 'create', id: 2, type: 'crop', parent: 0, refs: [] },
    { kind: 'create', id: 3, type: 'crop', parent: 0, refs: [1] },
    { kind: 'create', id: 10, type: 'fish', parent: 0, refs: [] },
    { kind: 'create', id: 11, type: 'fish', parent: 0, refs: [1] },
  ], c);
  return { w, c };
}

const DESIGNS = [
  { name: 'EAGER   ', run: runEager },
  { name: 'REBUILD ', run: runRebuild },
  { name: 'STAGED  ', run: runStaged },
];

console.log('=== RD-001 x RD-002/003: index consistency under transactions ===\n');

// --- P1: after a COMMITTED valid transaction, indexes == oracle -------------
console.log('--- P1  committed valid tx: indexes match ground truth ---');
for (const d of DESIGNS) {
  const { w, c } = seedWorld(d.run);
  const r = d.run(w, [ { kind: 'create', id: 12, type: 'fish', parent: 0, refs: [2] }, { kind: 'reparent', id: 1, parent: 12 } ], c);
  ok(r.ok && indexesMatchOracle(w), `${d.name} commit leaves indexes consistent`);
}

// --- P2: THE CARD. a REJECTED transaction must leave indexes == oracle ------
// tx: [ valid create 20, valid setref, INVALID delete missing-id 999 ].
// The first two ops touch the fish/referrer indexes; the third fails, so the
// whole tx must roll back — data AND indexes — as if nothing happened.
console.log('\n--- P2  rejected tx (op 3 invalid): indexes must fully roll back ---');
for (const d of DESIGNS) {
  const { w, c } = seedWorld(d.run);
  const before = { ref1: qReferrers(w, 1).slice(), fish: qByType(w, 'fish').slice() };
  const r = d.run(w, [
    { kind: 'create', id: 20, type: 'fish', parent: 0, refs: [1] }, // touches referrersOf[1], byType[fish]
    { kind: 'setref', id: 10, refs: [1] },                          // touches referrersOf[1]
    { kind: 'delete', id: 999 },                                    // INVALID -> whole tx rejects
  ], c);
  const consistent = indexesMatchOracle(w);
  const queryHonest = JSON.stringify(qReferrers(w, 1)) === JSON.stringify(truthReferrers(w.objs, 1));
  const noLeak = JSON.stringify(qByType(w, 'fish')) === JSON.stringify(before.fish)
             && JSON.stringify(qReferrers(w, 1)) === JSON.stringify(before.ref1);
  ok(!r.ok, `${d.name} tx correctly rejected (${r.reason})`);
  ok(consistent, `${d.name}   indexes == ground-truth oracle after rollback`);
  ok(queryHonest, `${d.name}   AI query 'who references 1?' returns the TRUTH, not a stale-index lie`);
  ok(noLeak, `${d.name}   no leaked index entries from the aborted ops`);
}

// --- P3: stress — a long interleaving of commits and rejects ----------------
// End state indexes must equal the oracle for the surviving data.
console.log('\n--- P3  stress: 200 interleaved txs (mix of commit + reject) ---');
for (const d of DESIGNS) {
  const { w, c } = seedWorld(d.run);
  let nextId = 100, rejects = 0, commits = 0;
  // deterministic pseudo-sequence, no RNG (same discipline as RD-001/008)
  for (let i = 0; i < 200; i++) {
    const pick = (i * 2654435761) >>> 0;
    let tx;
    if (pick % 5 === 0) {
      tx = [ { kind: 'create', id: nextId, type: (i%2?'crop':'fish'), parent: 0, refs: [1] }, { kind: 'delete', id: 500000 + i } ]; // 2nd op invalid -> reject
    } else if (pick % 5 === 1) {
      tx = [ { kind: 'create', id: nextId, type: 'crop', parent: 0, refs: [2] } ]; nextId++;
    } else if (pick % 5 === 2) {
      tx = [ { kind: 'setref', id: 3, refs: [1, 2] }, { kind: 'reparent', id: 11, parent: 1 } ];
    } else if (pick % 5 === 3) {
      const victim = 100 + (pick % Math.max(1, nextId - 100));
      tx = w.objs.has(victim) ? [ { kind: 'delete', id: victim } ] : [ { kind: 'setref', id: 2, refs: [] } ];
    } else {
      tx = [ { kind: 'reparent', id: 10, parent: (i%3===0?0:1) } ];
    }
    const r = d.run(w, tx, c);
    r.ok ? commits++ : rejects++;
    if (!indexesMatchOracle(w)) { ok(false, `${d.name} DIVERGED at step ${i} (tx ${r.ok?'committed':'rejected'})`); break; }
  }
  if (indexesMatchOracle(w)) ok(true, `${d.name} consistent after 200 txs (${commits} commit / ${rejects} reject)`);
}

// --- P4: cost — deterministic index-write count for one small committed tx --
console.log('\n--- P4  cost of index maintenance per small committed tx (index writes) ---');
for (const d of DESIGNS) {
  const { w } = seedWorld(d.run);
  const c = { n: 0 };
  d.run(w, [ { kind: 'create', id: 30, type: 'fish', parent: 0, refs: [1] } ], c);
  console.log(`    ${d.name} : ${c.n} index writes for a 1-object create in a 6+ object world`);
}

// ---------------------------------------------------------------------------
console.log('\n--- computed verdict ---');
console.log(`  EAGER   : mutates indexes in place, rolls back only DATA on reject`);
console.log(`  REBUILD : correct (indexes = pure fn of committed data) but O(N) every commit`);
console.log(`  STAGED  : correct AND O(change-size) — data+index committed atomically`);
console.log(`\n  ${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
console.log(FAIL === 0
  ? '  NOTE: if EAGER passed P2/P3 here, the harness failed to exercise a mid-tx reject — check it.'
  : '  READING: the FAILs are the finding — they show which coupling silently desyncs the index.');
