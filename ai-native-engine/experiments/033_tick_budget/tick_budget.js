'use strict';
// =============================================================================
// RD-B2.1: GLOBAL PER-TICK OP BUDGET — bound the TOTAL ops one tick admits
// across ALL transactions/actors/systems.
// =============================================================================
// RD-B2 closed the per-TRANSACTION cap (I2) and flagged the residue: "per-tx
// budget bounds each actor; a thousand actors is a different attack." A session
// of many individually-small rule txs (the exact shape RD-B5's live run will
// produce) was unbounded. This card closes it, with the house discipline:
//
//   T1  NEGATIVE CONTROL (budget off): a flood of small txs commits wholesale —
//       proving the enforcement below is real, not incidental.
//   T2  ENFORCEMENT (budget on): the same flood is capped; every rejected tx
//       carries a localized `tick-budget:` reason naming the budget and the
//       tick's total demand.
//   T3  WHOLE-TX ATOMICITY + ZERO FOOTPRINT: a budget-rejected tx applies
//       NOTHING — no field write, no claim placed, no index effect (RD-002:
//       a partial behavior is corruption; enforcement runs before claims/
//       scheduling).
//   T4  GREEDY-FIT POLICY (the documented admission choice): a too-big tx
//       blocks only ITSELF; later txs in deterministic actor order still fit.
//   T5  DETERMINISM UNDER PERMUTATION (RD-003/P1, the crux): which txs are
//       rejected is IDENTICAL across >=6 seeded random permutations of the
//       same over-budget batch — admission order is (actor, batch position),
//       never arrival order.
//   T6  COMPOSITION with the per-tx cap (RD-B2/I2): both active at once —
//       the per-tx cap catches one fat tx (which then consumes NO tick
//       budget), the tick cap catches many small ones.
//   T7  stepTick MULTI-SYSTEM: N rules' txs over budget -> deterministic
//       subset commits, rejected systems get localized reasons, indexes stay
//       consistent, and ONE undo still reverses exactly what committed.
//
// The RD-B5 slot: experiments/029's classifyOpGrowth MEASURES op growth and
// never rejects; this budget REJECTS and never explains — they compose as the
// measurement and enforcement columns of the same session scorecard.
// Zero deps. `node experiments/033_tick_budget/tick_budget.js`
// =============================================================================
const path = require('node:path');
const { Engine, TYPE, TYPE_NAME } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// seeded PRNG — the RD-021 pattern (experiments/024_concurrency_fuzz/fuzz.js)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const permute = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// committed-state signature (type-correct rows — the RD-021 lesson)
function sig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    const r = w.componentIndex[e], t = w.type[e];
    rows.push([w.uuid[e], TYPE_NAME[t], w.parent[e] >= 0 ? w.uuid[w.parent[e]] : '-', w.name[e],
      t === TYPE.CROP ? w.crop_water[r] : '-', t === TYPE.CROP ? w.crop_growth[r] : '-',
      t === TYPE.ENEMY ? w.enemy_hp[r] : '-', t === TYPE.ZONE ? w.zone_tally[r] : '-'].join(':'));
  }
  return rows.sort().join('|') + `\nT:${[...w.tombstones.keys()].sort().join(',')}`;
}

// deterministic world builder: identical engines (same uuid mints) every call,
// so permutation replicas need no persistence round-trip.
function build(nCrops = 24, opts = {}) {
  const g = new Engine(4096, opts);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const crops = Array.from({ length: nCrops }, (_, i) =>
    g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 5, growth: 10 }).uuid);
  return { g, zone, crops };
}

console.log('=== RD-B2.1: global per-tick op budget (control, enforcement, determinism) ===\n');

// ---- T1 + T2: the flood, without and with the budget -----------------------
// 30 actors x 10 ops = 300 ops in one tick; every tx is far under the per-tx
// cap (2048), so RD-B2/I2 sees nothing wrong — exactly the flagged gap.
{
  const mkFlood = (crops) => Array.from({ length: 30 }, (_, i) => ({
    actor: `A${String(i).padStart(2, '0')}`,
    ops: Array.from({ length: 10 }, (_, j) => ({ kind: 'setfield', target: crops[(i * 10 + j) % crops.length], field: 'water', value: 9 })),
  }));
  { // T1 NEGATIVE CONTROL: budget off (the default) -> the flood commits wholesale.
    const { g, crops } = build(300);
    const r = g.submit(mkFlood(crops));
    ok(r.committed === 30 && g._field(g.w.liveEntity(crops[299]), 'water') === 9,
      'T1 CONTROL budget OFF (default): 30 txs / 300 ops commit wholesale — per-tick work is unbounded without the guard');
  }
  { // T2 ENFORCEMENT: tickOpsBudget=100 -> a deterministic prefix fits, the rest reject with localized reasons.
    const { g, crops } = build(300, { tickOpsBudget: 100 });
    const r = g.submit(mkFlood(crops));
    const rej = r.results.filter(x => x.status === 'rejected');
    const admitted = r.results.reduce((n, x, i) => n + (x.status === 'committed' ? 10 : 0), 0);
    ok(r.committed === 10 && admitted === 100,
      `T2 budget 100: exactly 10 of 30 txs (${admitted} ops) admitted — total per-tick work bounded`);
    ok(rej.length === 20 && rej.every(x => x.reasons.join().includes('tick-budget') &&
        x.reasons.join().includes('budget 100') && x.reasons.join().includes('300 ops')),
      'T2 every rejected tx carries a localized tick-budget reason naming the budget (100) and the tick demand (300)');
    // admission is by ACTOR order: A00..A09 fit, A10..A29 do not.
    ok(r.results.slice(0, 10).every(x => x.status === 'committed') && r.results.slice(10).every(x => x.status === 'rejected'),
      'T2 admitted set is the deterministic actor-order prefix A00..A09');
  }
}

// ---- T3: whole-tx atomicity + zero footprint --------------------------------
// The rejected tx mixes setfields with a claim. NOTHING of it may land: no
// field write, no claim entry, no index effect (enforcement precedes claims
// and scheduling).
{
  const { g, crops } = build(8, { tickOpsBudget: 4 });
  const before = sig(g);
  const r = g.submit([
    { actor: 'a-small', ops: [{ kind: 'setfield', target: crops[0], field: 'water', value: 7 }] },  // 1 op, fits
    { actor: 'b-big', ops: [                                                                        // 5 ops, cannot fit
      { kind: 'setfield', target: crops[1], field: 'water', value: 9 },
      { kind: 'setfield', target: crops[2], field: 'water', value: 9 },
      { kind: 'setfield', target: crops[3], field: 'growth', value: 99 },
      { kind: 'claim', target: crops[4], ticks: 5 },
      { kind: 'delete', target: crops[5] },
    ] },
  ]);
  ok(r.results[0].status === 'committed' && r.results[1].status === 'rejected' &&
     r.results[1].reasons.join().includes('tick-budget'),
    'T3 small tx committed; 5-op tx rejected whole with a tick-budget reason');
  const e = (u) => g.w.liveEntity(u);
  ok(g._field(e(crops[1]), 'water') === 5 && g._field(e(crops[2]), 'water') === 5 && g._field(e(crops[3]), 'growth') === 10,
    'T3 ATOMICITY: none of the rejected tx\'s writes landed (not even a prefix)');
  ok(g.claims.size === 0, 'T3 ZERO FOOTPRINT: the rejected tx\'s claim op placed NO claim');
  ok(e(crops[5]) >= 0 && g.indexesConsistent(), 'T3 its delete did not land either; indexes consistent with the oracle');
  ok(sig(g) !== before && g._field(e(crops[0]), 'water') === 7, 'T3 the committed tx is untouched (isolation)');
}

// ---- T4: greedy-fit — a too-big tx blocks only itself -----------------------
// Admission order a(4), b(10), c(2) with budget 8: a fits (4), b cannot ever
// fit alongside it (14>8) and is rejected, c STILL fits (6<=8). The rival
// policy (first blocker blocks all) would starve c for b's sin.
{
  const { g, crops } = build(16, { tickOpsBudget: 8 });
  const mkOps = (n, off) => Array.from({ length: n }, (_, j) => ({ kind: 'setfield', target: crops[off + j], field: 'water', value: 9 }));
  const r = g.submit([
    { actor: 'a', ops: mkOps(4, 0) },
    { actor: 'b', ops: mkOps(10, 4) },
    { actor: 'c', ops: mkOps(2, 14) },
  ]);
  ok(r.results[0].status === 'committed' && r.results[1].status === 'rejected' && r.results[2].status === 'committed',
    'T4 GREEDY-FIT: b (10 ops) rejected, but c (2 ops, later in actor order) still fits — one oversized actor cannot starve the tick');
  ok(g._field(g.w.liveEntity(crops[15]), 'water') === 9 && g._field(g.w.liveEntity(crops[4]), 'water') === 5,
    'T4 c\'s writes landed, b\'s did not');
}

// ---- T5: determinism under permutation (RD-003/P1, the crux) ----------------
// One over-budget batch, 8 distinct actors, mixed op kinds. Run it and >=6
// seeded random permutations of it on freshly-rebuilt IDENTICAL worlds:
// committed signature AND the exact rejected-actor set must never move.
{
  const PERMS = 6;
  const mkBatch = (crops) => [
    { actor: 'A0', ops: [{ kind: 'setfield', target: crops[0], field: 'water', value: 9 },
                         { kind: 'setfield', target: crops[1], field: 'growth', value: 50 }] },
    { actor: 'A1', ops: [{ kind: 'delete', target: crops[2] }] },
    { actor: 'A2', ops: [{ kind: 'setfield', target: crops[3], field: 'water', value: 1 },
                         { kind: 'setfield', target: crops[4], field: 'water', value: 2 },
                         { kind: 'setfield', target: crops[5], field: 'water', value: 3 }] },
    { actor: 'A3', ops: [{ kind: 'claim', target: crops[6], ticks: 3 }] },
    { actor: 'A4', ops: [{ kind: 'setfield', target: crops[7], field: 'growth', value: 77 },
                         { kind: 'setfield', target: crops[8], field: 'growth', value: 78 }] },
    { actor: 'A5', ops: [{ kind: 'move', target: crops[9], after: null }] },
    { actor: 'A6', ops: [{ kind: 'setfield', target: crops[10], field: 'water', value: 11 },
                         { kind: 'setfield', target: crops[11], field: 'water', value: 12 }] },
    { actor: 'A7', ops: [{ kind: 'setfield', target: crops[12], field: 'water', value: 13 }] },
  ]; // total demand: 13 ops
  const run = (batch) => {
    const { g, crops } = build(16, { tickOpsBudget: 7 }); // 7 < 13: someone must lose
    const r = g.submit(batch.length ? batch : mkBatch(crops));
    return { g, r, crops };
  };
  const { g: g0, r: r0, crops: crops0 } = run([]);
  const baseBatch = mkBatch(crops0); // same uuids in every rebuilt world (deterministic mints)
  const baseSig = sig(g0);
  const baseRejected = r0.results.filter(x => x.status === 'rejected').map(x => x.actor).sort().join(',');
  ok(r0.committed > 0 && baseRejected.length > 0,
    `T5 base run: over-budget batch split deterministically (committed ${r0.committed}, rejected {${baseRejected}})`);
  const permRnd = mulberry32(0xB2B2);
  let diverged = 0;
  for (let k = 0; k < PERMS; k++) {
    const { g, r } = run(permute(permRnd, baseBatch));
    const rej = r.results.filter(x => x.status === 'rejected').map(x => x.actor).sort().join(',');
    if (sig(g) !== baseSig || rej !== baseRejected) diverged++;
  }
  ok(diverged === 0,
    `T5 DETERMINISM: committed state AND rejected-actor set identical across ${PERMS} seeded permutations of the over-budget batch`);
}

// ---- T6: composition with the per-tx cap (RD-B2/I2) -------------------------
// Both budgets on: opsBudget=10 (per tx), tickOpsBudget=15 (per tick).
// 'fat' (12 ops) dies at the per-tx cap and consumes NO tick budget; then
// a/b/c (6 ops each) contend for the 15: a and b fit (12), c does not (18>15).
{
  const { g, crops } = build(40, { opsBudget: 10, tickOpsBudget: 15 });
  const mkOps = (n, off) => Array.from({ length: n }, (_, j) => ({ kind: 'setfield', target: crops[off + j], field: 'water', value: 9 }));
  const r = g.submit([
    { actor: 'fat', ops: mkOps(12, 0) },
    { actor: 'a', ops: mkOps(6, 12) },
    { actor: 'b', ops: mkOps(6, 18) },
    { actor: 'c', ops: mkOps(6, 24) },
  ]);
  const reason = (i) => r.results[i].reasons.join();
  ok(r.results[0].status === 'rejected' && reason(0).includes('per-tx budget 10') && !reason(0).includes('tick-budget'),
    'T6 fat tx (12 ops) caught by the PER-TX cap — localized to that cap, not the tick cap');
  ok(r.results[1].status === 'committed' && r.results[2].status === 'committed',
    'T6 fat tx consumed NO tick budget (it commits nothing): a and b (12 of 15) both fit');
  ok(r.results[3].status === 'rejected' && reason(3).includes('tick-budget'),
    'T6 c caught by the PER-TICK cap — the two caps compose: one fat tx vs many small ones, each named by its own guard');
}

// ---- T7: stepTick multi-system + undo composition ---------------------------
// Three registered systems (one tx each, actor sys:<name>), 4 ops apiece = 12;
// tickOpsBudget=8 admits alpha+beta in actor order and rejects gamma. World
// stays consistent, and the tick is still ONE undo step for what committed.
{
  const g = new Engine(256, { tickOpsBudget: 8 });
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const crops = Array.from({ length: 4 }, (_, i) => g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 0, growth: 0 }).uuid);
  g.registerSystem('alpha', (v) => crops.map(u => ({ kind: 'setfield', target: u, field: 'water', value: 3 })));
  g.registerSystem('beta',  (v) => crops.map(u => ({ kind: 'setfield', target: u, field: 'growth', value: 4 })));
  g.registerSystem('gamma', (v) => crops.map(u => ({ kind: 'setfield', target: u, field: 'water', value: 200 })));
  g.enableHistory();
  const before = sig(g);
  const r = g.stepTick();
  const by = Object.fromEntries(r.results.map(x => [x.actor, x]));
  ok(by['sys:alpha'].status === 'committed' && by['sys:beta'].status === 'committed' && by['sys:gamma'].status === 'rejected',
    'T7 stepTick: deterministic subset of systems commits (alpha, beta); gamma rejected by the tick budget');
  ok(by['sys:gamma'].reasons.join().includes('tick-budget'),
    'T7 the rejected SYSTEM gets the same localized re-promptable reason as any actor');
  const e = (u) => g.w.liveEntity(u);
  ok(crops.every(u => g._field(e(u), 'water') === 3 && g._field(e(u), 'growth') === 4),
    'T7 committed systems\' writes landed; the rejected system\'s (water=200) did not — no fold with a rejected tx');
  ok(g.indexesConsistent(), 'T7 world consistent with the index oracle after a budget-split tick');
  const mid = sig(g);
  ok(g.undo().ok && sig(g) === before,
    'T7 ONE undo reverses exactly the committed portion of the tick (RD-020 composes with the budget)');
  ok(g.redo().ok && sig(g) === mid, 'T7 redo restores the post-tick state');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
