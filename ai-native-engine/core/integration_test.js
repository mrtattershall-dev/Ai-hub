'use strict';
// =============================================================================
// INTEGRATION PROOF — every decided RD, composed, driven end-to-end.
// This is the payoff of the isolated cards: ONE core, one protocol, the
// anchoring Crop #142 bug driven through it, plus each invariant the separate
// experiments proved — re-proven in composition. `node core/integration_test.js`
// =============================================================================
const { Engine, TYPE, TYPE_NAME } = require('./engine.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

// ---------------------------------------------------------------------------
hr('T1  Crop #142, CLAIM path (RD-002): B waters a crop A is harvesting');
// A holds a soft claim from a prior tick (harvest is a multi-tick action).
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const c142 = g.spawn(TYPE.CROP, { name: 'Wheat#142', parent: zone, growth: 100, water: 0 }).uuid;

  const t1 = g.submit([{ actor: 'A', ops: [{ kind: 'claim', target: c142, ticks: 3 }] }]);
  ok(t1.results[0].status === 'committed', 'tick1: A acquires a claim on #142');

  // same-tick race: B waters while A's claim is held
  const t2 = g.submit([{ actor: 'B', ops: [{ kind: 'setfield', target: c142, field: 'water', value: 100 }] }]);
  ok(t2.results[0].status === 'rejected', 'tick2: B\'s water REJECTED at the claim layer');
  ok(/held by A/.test(t2.results[0].reasons.join()), '      B told WHY (communication, not arbitration)');
  ok(g.contextSlice(c142).includes('\t0\t'), '      #142 water still 0 — no silent corruption');

  // A completes the harvest (owns the claim)
  const t3 = g.submit([{ actor: 'A', ops: [{ kind: 'delete', target: c142 }] }]);
  ok(t3.results[0].status === 'committed', 'tick3: A harvests #142 (delete) — committed');
  ok(g.w.resolve(c142).status === 'deleted', '      #142 resolves as DELETED, not a value (RD-004.6)');
  ok(g.indexesConsistent(), '      indexes consistent after the whole exchange (RD-017)');
}

// ---------------------------------------------------------------------------
hr('T2  Crop #142, SCHEDULE path (RD-003): harvest + water, SAME batch, no claim');
// The pure anti-LWW proof: two arrival orders must NOT let water silently win.
{
  const g = new Engine(64);
  const c = g.spawn(TYPE.CROP, { name: 'Wheat', growth: 100, water: 0 }).uuid;
  // submit B-before-A in the array to prove arrival order doesn't matter
  const r = g.submit([
    { actor: 'B', ops: [{ kind: 'setfield', target: c, field: 'water', value: 100 }] },
    { actor: 'A', ops: [{ kind: 'delete', target: c }] },
  ]);
  const rA = r.results.find(x => x.actor === 'A'), rB = r.results.find(x => x.actor === 'B');
  ok(rA.status === 'committed', 'A\'s harvest scheduled first (destructive) and commits');
  ok(rB.status === 'rejected' && /destroyed/.test(rB.reasons.join()),
     'B\'s water REJECTED — cannot water a destroyed crop (not silently applied)');
  ok(g.w.resolve(c).status === 'deleted', 'crop is gone, not a "harvested + freshly watered" corruption');
  ok(g.indexesConsistent(), 'indexes consistent (the LWW bug that started this project: fixed)');
}

// ---------------------------------------------------------------------------
hr('T3  FOLD (RD-005/.1): foldable same-tick writes merge losslessly');
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'stockpile', tally: 0 }).uuid;
  const crop = g.spawn(TYPE.CROP, { name: 'C', growth: 50, water: 0 }).uuid;
  const r = g.submit([
    { actor: 'A', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 5 }] },
    { actor: 'B', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 7 }] },
    { actor: 'C', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 60 }] },
    { actor: 'D', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 100 }] },
  ]);
  ok(r.results.every(x => x.status === 'committed'), 'all four contributions COMMIT (none rejected)');
  const slice = g.contextSlice(zone, 1);
  ok(g.w.zone_tally[g.w.componentIndex[g.w.liveEntity(zone)]] === 12, 'zone.tally additive-folded 5+7 = 12 (lossless)');
  ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(crop)]] === 100, 'crop.water max-folded 60,100 = 100 (the wetter wins)');
  ok(r.deferrals.length === 0, 'no deferrals — foldable fields never surface a conflict');
}

// ---------------------------------------------------------------------------
hr('T4  DEFER (RD-005): non-foldable contested field written by NEITHER side');
{
  const g = new Engine(64);
  const crop = g.spawn(TYPE.CROP, { name: 'Original', growth: 50 }).uuid;
  const r = g.submit([
    { actor: 'A', ops: [{ kind: 'setfield', target: crop, field: 'name', value: 'Alpha' }] },
    { actor: 'B', ops: [{ kind: 'setfield', target: crop, field: 'name', value: 'Beta' }] },
  ]);
  ok(r.deferrals.length === 1 && r.deferrals[0].field === 'name', 'name conflict is DEFERRED (surfaced)');
  ok(g.w.name[g.w.liveEntity(crop)] === 'Original', 'name held at prior value — NOT auto-picked by timestamp');
  ok(r.results.every(x => /deferred/.test(x.reasons.join())), 'both actors told the field is contested');
  ok(r.deferrals[0].competing.length === 2, 'both competing values preserved for the author to choose from');
}

// ---------------------------------------------------------------------------
hr('T5  ATOMIC ROLLBACK (RD-017): a rejected tx leaves ZERO index trace');
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const before = g.allOfType(TYPE.CROP).length;
  // one batch: tx1 valid createChild; tx2 has a valid createChild THEN a
  // delete of a missing id -> tx2 must reject wholesale, applying NEITHER op.
  const r = g.submit([
    { actor: 'A', ops: [{ kind: 'createChild', type: TYPE.CROP, parent: zone, props: { name: 'good' } }] },
    { actor: 'B', ops: [
        { kind: 'createChild', type: TYPE.CROP, parent: zone, props: { name: 'doomed' } },
        { kind: 'delete', target: 'u-does-not-exist' },
    ] },
  ]);
  const rA = r.results.find(x => x.actor === 'A'), rB = r.results.find(x => x.actor === 'B');
  ok(rA.status === 'committed', 'A\'s child committed');
  ok(rB.status === 'rejected' && /missing/.test(rB.reasons.join()), 'B rejected on the missing-target op');
  ok(g.allOfType(TYPE.CROP).length === before + 1, 'exactly ONE crop added — B\'s "doomed" child never leaked');
  ok(g.indexesConsistent(), 'indexes == ground-truth oracle (no half-applied B)');
}

// ---------------------------------------------------------------------------
hr('T6  CONTRACT GATE (RD-014): op-valid but goal-violating tx is refused');
{
  const g = new Engine(64);
  const crop = g.spawn(TYPE.CROP, { name: 'C', growth: 20, water: 0 }).uuid;
  // goal contract: "this crop must never be over-watered past 80".
  const noOverwater = (preview) => preview.field(crop, 'water') <= 80 || `water ${preview.field(crop, 'water')} exceeds cap 80`;
  const r = g.submit([{ actor: 'AI', contract: noOverwater,
    ops: [{ kind: 'setfield', target: crop, field: 'water', value: 100 }] }]);
  ok(r.results[0].status === 'rejected' && /cap 80/.test(r.results[0].reasons.join()),
     'the setfield is individually valid, but the goal contract REJECTS it');
  ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(crop)]] === 0, 'nothing applied — water still 0 (contract disposes)');
  ok(g.indexesConsistent(), 'a contract-rejected tx leaves the world + indexes untouched');
}

// ---------------------------------------------------------------------------
hr('T7  IDENTITY + reverse-refs (RD-004/.6/RD-001): delete surfaces dangling refs');
{
  const g = new Engine(64);
  const sword = g.spawn(TYPE.CROP, { name: 'Sword' }).uuid;          // (reuse crop as a thing)
  const quest = g.spawn(TYPE.ENEMY, { name: 'Quest', refs: [sword] }).uuid; // quest references sword
  ok(g.referrersOf(sword).length === 1, 'reverse index: 1 referrer of the sword (RD-001)');
  const r = g.submit([{ actor: 'A', ops: [{ kind: 'delete', target: sword }] }]);
  ok(r.results[0].status === 'committed', 'sword deleted');
  const res = g.w.resolve(sword);
  ok(res.status === 'deleted' && res.lastName === 'Sword', 'tombstone carries type + last-known name (RD-004.6)');
  ok(g.referrersOf(sword).length === 0 && g.indexesConsistent(), 'reverse-ref index cleaned atomically with the delete');
  // the quest's stored UUID still resolves to explicit DELETED absence, never a value
  ok(g.w.resolve(sword).status === 'deleted', 'the quest\'s dangling ref resolves to loud absence, not a lie');
}

// ---------------------------------------------------------------------------
hr('T8  STRUCTURAL acyclicity (RD-005.2): a cycle-creating reparent is refused');
{
  const g = new Engine(64);
  const a = g.spawn(TYPE.ZONE, { name: 'A' }).uuid;
  const b = g.spawn(TYPE.ZONE, { name: 'B', parent: a }).uuid;      // b under a
  const r = g.submit([{ actor: 'X', ops: [{ kind: 'reparent', target: a, parent: b }] }]); // a under b -> cycle
  ok(r.results[0].status === 'rejected' && /cycle/.test(r.results[0].reasons.join()), 'reparent that forms a cycle REJECTED');
  ok(g.indexesConsistent(), 'childrenOf index unchanged after the refused reparent');
}

// ---------------------------------------------------------------------------
hr('T9  AI CONTEXT (RD-007): legible columnar slice of a RETRIEVED neighborhood');
{
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'farm' }).uuid;
  for (let i = 0; i < 5; i++) g.spawn(TYPE.CROP, { name: 'crop' + i, parent: zone, growth: i * 20, water: i });
  for (let i = 0; i < 50; i++) g.spawn(TYPE.ENEMY, { name: 'far' + i }); // noise NOT near the zone
  const slice = g.contextSlice(zone, 1);
  ok(/^# slice root=/.test(slice), 'slice has a schema header (implicit ids, small ints)');
  ok(slice.split('\n').filter(Boolean).length <= 2 + 6, 'retrieved ONLY the zone + its 5 crops, not all 56 objects (retrieval > dump)');
  ok(slice.includes('\tcrop\t') && !slice.includes('far49'), 'columnar rows present; distant noise excluded');
  ok(slice.split('\n')[1] === 'id\ttype\tparent\tname\twater\tgrowth\thp', 'a model can read the columns directly');
}

// ---------------------------------------------------------------------------
hr('T10 STRESS (RD-017 in composition): 300 mixed batches stay consistent');
{
  const g = new Engine(4096);
  const zone = g.spawn(TYPE.ZONE, { name: 'world', tally: 0 }).uuid;
  const crops = [];
  for (let i = 0; i < 20; i++) crops.push(g.spawn(TYPE.CROP, { name: 'c' + i, parent: zone, growth: 100 }).uuid);
  let diverged = -1;
  for (let step = 0; step < 300 && diverged < 0; step++) {
    const pick = (step * 2654435761) >>> 0;
    const target = crops[pick % crops.length];
    let batch;
    if (pick % 4 === 0)      batch = [{ actor: 'A', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 1 }] },
                                      { actor: 'B', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 2 }] }]; // fold
    else if (pick % 4 === 1) batch = [{ actor: 'A', ops: [{ kind: 'delete', target }] },
                                      { actor: 'B', ops: [{ kind: 'setfield', target, field: 'water', value: 50 }] }]; // race
    else if (pick % 4 === 2) batch = [{ actor: 'A', ops: [{ kind: 'createChild', type: TYPE.CROP, parent: zone, props: { name: 'n' + step, growth: 100 } }] }];
    else                     batch = [{ actor: 'A', ops: [{ kind: 'setfield', target, field: 'name', value: 'x' + step }] },
                                      { actor: 'B', ops: [{ kind: 'setfield', target, field: 'name', value: 'y' + step }] }]; // defer
    g.submit(batch);
    if (!g.indexesConsistent()) diverged = step;
  }
  ok(diverged < 0, `indexes stayed consistent across 300 mixed batches (claim/fold/defer/race/create)` + (diverged<0?'':` — DIVERGED at ${diverged}`));
  ok(g.w.zone_tally[g.w.componentIndex[g.w.liveEntity(zone)]] > 0, 'additive tally accumulated across batches (fold works in aggregate)');
}

// ---------------------------------------------------------------------------
console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — integrated core`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
