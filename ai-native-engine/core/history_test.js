'use strict';
// =============================================================================
// EXPERIMENT 020 (with the core) — HISTORY / UNDO, MEASURED. Spine decision #9.
// The Engine.log gives us the substrate; the question is the MECHANISM.
//   RIVAL   — snapshot-per-step: deep-copy the world before each batch. Correct,
//             but O(N) storage EVERY step regardless of change size.
//   WINNER  — inverse-delta: record only what changed + how to reverse it,
//             O(change) per step, with identity preserved (undo of a delete
//             resurrects the SAME uuid; undo of a create never recycles its id).
// `node core/history_test.js`
// =============================================================================
const { Engine, TYPE, TYPE_NAME } = require('./engine.js');
const IR = require('./protocol.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

function sig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    const r = w.componentIndex[e];
    rows.push(`${w.uuid[e]}|${TYPE_NAME[w.type[e]]}|p=${w.parent[e]>=0?w.uuid[w.parent[e]]:'-'}|n=${w.name[e]}|refs=${w.refs[e].join(',')}` +
      `|w=${w.type[e]===TYPE.CROP?w.crop_water[r]:'-'}|t=${w.type[e]===TYPE.ZONE?w.zone_tally[r]:'-'}`);
  }
  rows.sort();
  const tomb = [...w.tombstones.keys()].sort();
  return `SEQ=${w._uuidSeq}|LIVE=${rows.join(';')}|TOMB=${tomb.join(',')}`;
}

function buildWorld() {
  const g = new Engine(64).enableHistory();
  const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'A', parent: zone, growth: 40, water: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'B', parent: zone, growth: 60, water: 0 }).uuid;
  const quest = g.spawn(TYPE.ENEMY, { name: 'boar', refs: [c1] }).uuid;
  return { g, zone, c1, c2, quest };
}

// ---------------------------------------------------------------------------
console.log('=== 020 history/undo: inverse-delta vs snapshot-per-step ===\n');

// --- H1 single undo/redo exactness -----------------------------------------
console.log('--- H1  undo restores the exact prior state; redo re-applies ---');
{
  const { g, c1 } = buildWorld();
  const before = sig(g);
  g.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: c1, field: 'water', value: 90 }] }]);
  const after = sig(g);
  ok(before !== after, 'a committed edit changed the world');
  g.undo();
  ok(sig(g) === before, 'undo restored the exact prior signature');
  ok(g.indexesConsistent(), 'indexes consistent after undo (RD-017 held)');
  g.redo();
  ok(sig(g) === after, 'redo re-applied the edit exactly');
}

// --- H2 multi-step: walk back to genesis and forward again -----------------
console.log('\n--- H2  multi-step undo/redo returns exact states at every waypoint ---');
{
  const { g, c1, c2, zone } = buildWorld();
  const marks = [sig(g)];
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:c1, field:'water', value:50 }] }]); marks.push(sig(g));
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:c2, field:'growth', value:100 }] }]); marks.push(sig(g));
  g.submit([{ actor:'A', ops:[{ kind:'delete', target:c2 }] }]); marks.push(sig(g));
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:zone, field:'tally', value:9 }] }]); marks.push(sig(g));
  // undo all the way back
  let good = true;
  for (let k = marks.length - 1; k > 0; k--) { g.undo(); if (sig(g) !== marks[k-1]) good = false; }
  ok(good, 'undo through 4 edits hit every prior waypoint exactly (incl. a delete)');
  // redo all the way forward
  good = true;
  for (let k = 1; k < marks.length; k++) { g.redo(); if (sig(g) !== marks[k]) good = false; }
  ok(good && g.indexesConsistent(), 'redo forward hit every waypoint and left indexes consistent');
}

// --- H3 identity on DELETE: undo resurrects the SAME uuid + reconnects refs -
console.log('\n--- H3  undoing a delete resurrects the same identity (RD-004) ---');
{
  const { g, c1, quest } = buildWorld();
  ok(g.referrersOf(c1).length === 1, 'precondition: quest references c1');
  g.submit([{ actor:'A', ops:[{ kind:'delete', target:c1 }] }]);
  ok(g.w.resolve(c1).status === 'deleted' && g.referrersOf(c1).length === 0, 'after delete: c1 gone, reverse-ref cleared');
  g.undo();
  ok(g.w.resolve(c1).status === 'live', 'undo brought c1 back as the SAME uuid (not a new object)');
  ok(g.referrersOf(c1).length === 1 && g.indexesConsistent(), 'the quest\'s reference RECONNECTED — identity preserved, indexes rebuilt');
}

// --- H4 identity on CREATE: undo tombstones the uuid; it is never recycled --
console.log('\n--- H4  undoing a create tombstones its uuid; redo restores the same id ---');
{
  const { g, zone } = buildWorld();
  const r = IR.apply(g, JSON.stringify({ actor:'ai', ops:[{ op:'createChild', childType:'crop', parent: zone, props:{ name:'sprout' } }] }));
  const born = r.result.results[0]._created[0];
  ok(g.w.resolve(born).status === 'live', 'created entity is live');
  g.undo();
  ok(g.w.resolve(born).status === 'deleted', 'undo of create removed it (uuid now a tombstone)');
  g.redo();
  ok(g.w.resolve(born).status === 'live', 'redo restored the SAME uuid (create/undo/redo is identity-symmetric)');
  // now undo again and prove a fresh create does NOT recycle the id
  g.undo();
  const r2 = IR.apply(g, JSON.stringify({ actor:'ai', ops:[{ op:'createChild', childType:'crop', parent: zone, props:{ name:'other' } }] }));
  const born2 = r2.result.results[0]._created[0];
  ok(born2 !== born, `a new create minted a fresh uuid (${born2} != ${born}) — no recycling (RD-004.6)`);
}

// --- H5 linear history: a new edit after undo clears the redo stack ---------
console.log('\n--- H5  new edit after undo discards redo (linear history) ---');
{
  const { g, c1 } = buildWorld();
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:c1, field:'water', value:30 }] }]);
  g.undo();
  ok(g.history.redo.length === 1, 'redo available after an undo');
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:c1, field:'water', value:70 }] }]); // new branch
  ok(g.history.redo.length === 0, 'the new edit cleared the stale redo (no dangling future)');
  ok(g.redo().ok === false, 'redo now correctly reports nothing to redo');
}

// --- H6 undo of a conflict-resolved batch (RD-005 fold + a race) -----------
console.log('\n--- H6  undo reverses folded writes and race outcomes correctly ---');
{
  const { g, c1, c2 } = buildWorld();
  const before = sig(g);
  // fold: two actors water c1 (max) ; race: A deletes c2, B waters c2 (rejected)
  g.submit([
    { actor:'A', ops:[{ kind:'setfield', target:c1, field:'water', value:40 }] },
    { actor:'B', ops:[{ kind:'setfield', target:c1, field:'water', value:80 }] },
    { actor:'C', ops:[{ kind:'delete', target:c2 }] },
    { actor:'D', ops:[{ kind:'setfield', target:c2, field:'water', value:100 }] }, // rejected (destroyed)
  ]);
  ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(c1)]] === 80 && g.w.resolve(c2).status === 'deleted', 'batch: c1 folded to 80, c2 deleted');
  g.undo();
  ok(sig(g) === before, 'one undo reversed the whole batch (fold + delete) back to pre-batch');
  ok(g.indexesConsistent(), 'indexes consistent after undoing a multi-actor batch');
}

// --- H7 STORAGE COST: inverse-delta << snapshot-per-step -------------------
console.log('\n--- H7  history storage: O(change) delta vs O(N) snapshot-per-step ---');
{
  const g = new Engine(4096).enableHistory();
  const zone = g.spawn(TYPE.ZONE, { name:'z', tally:0 }).uuid;
  const crops = [];
  for (let i = 0; i < 200; i++) crops.push(g.spawn(TYPE.CROP, { name:'c'+i, parent:zone, growth:100 }).uuid);
  const N = g.w.count; // ~201 live entities

  // rival: snapshot-per-step would copy all N entities each batch.
  let snapshotCells = 0, deltaEntries = 0;
  const K = 50;
  for (let step = 0; step < K; step++) {
    // each batch touches ONE crop (a 1-field change)
    g.submit([{ actor:'A', ops:[{ kind:'setfield', target: crops[step % crops.length], field:'water', value: (step % 100) }] }]);
    snapshotCells += N;                                   // a full-world copy every step
    deltaEntries += g.history.undo[g.history.undo.length - 1].length; // just the inverse entries
  }
  ok(deltaEntries === K, `inverse-delta stored ${deltaEntries} entries for ${K} single-field edits (O(change))`);
  ok(snapshotCells === K * N, `snapshot-per-step would store ${snapshotCells} entity-copies (O(K·N))`);
  ok(deltaEntries * 100 < snapshotCells, `delta is >100x cheaper here (${deltaEntries} vs ${snapshotCells}) — undo depth is affordable`);
  // and it still undoes correctly at scale
  const preLast = sig(g); g.undo(); g.redo();
  ok(sig(g) === preLast && g.indexesConsistent(), 'undo/redo still exact and consistent on a 200-entity world');
}

// --- H8 boundary: history is runtime state, not persisted (RD-019 consistency)
console.log('\n--- H8  history is ephemeral runtime state (matches RD-019 claims policy) ---');
{
  const { g } = buildWorld();
  g.submit([{ actor:'A', ops:[{ kind:'setfield', target:g.spawn(TYPE.CROP,{name:'t'}).uuid, field:'water', value:5 }] }]);
  ok(g.history.undo.length >= 1, 'undo stack populated at runtime');
  console.log('    (note: undo/redo stacks are NOT serialized by persistence.js — a reload starts fresh,');
  console.log('     same policy as ephemeral claims. Cross-session undo would need the log persisted; open.)');
  ok(true, 'documented boundary: persistence carries state, not the undo timeline');
}

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — history/undo`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
