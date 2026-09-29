'use strict';
// =============================================================================
// RD-B5 APPARATUS — multi-rule authoring sessions, CALIBRATED BEFORE the live
// model runs. (Spec: decisions/RD-B5_multirule_session_spec.md.)
//
// The question RD-B5 will decide: when a model authors SEVERAL interacting
// rules toward one GAME-LEVEL goal (a property over N ticks, not a single-tick
// postcondition), do per-rule gating + RD-005 fold/defer + RD-B2 invariants
// already cover composition (H1), or does the boundary need a temporal /
// multi-rule contract form (H2)?
//
// This file is the INSTRUMENT, proven deterministic before any model touches
// it — the same referee-first discipline as 025_behavior_corpus and RD-B3's
// mock-apparatus proof. It provides:
//   - runSession(rulesets, opts): install rule JSONs through the REAL wire
//     (core/behavior.js installRule), step the REAL engine N ticks, and record
//     a per-tick TRACE: ops/actor, committed/rejected txs, deferrals, silent
//     FOLD ARBITRATIONS between rules, spawns/reaps, population, safety.
//   - checkFarmObservable(trace): the temporal observable for the farming-loop
//     goal — matured AND reaped AND reseeded AND STILL RUNNING in the last
//     third. A property of the whole run; no single tick can satisfy it.
//   - classifyOpGrowth(trace): bounded / linear / superlinear ops-per-tick —
//     the confound-killer. A multi-rule session's rising op count must be
//     attributable: "rules interact badly" vs "N rules x M ticks accumulate
//     linearly" are different verdicts, and without this classifier they read
//     identically. (Budget column from item 0 slots in beside it when it lands;
//     this measures TOTALS and never rejects, so the two compose.)
//
// CONTROLS (all hand-authored, all through the real wire, all asserted):
//   ORACLE        4-rule farming loop -> observable PASSES (goal achievable)
//   MISSING-LINK  oracle minus reseed -> observable FAILS  (checker bites)
//   BENIGN-LINEAR spawn-every-tick    -> classified LINEAR, not superlinear
//   SUPERLINEAR   trusted-closure population-doubler -> classifier FIRES
//                 (a rule CANNOT express this: spawn caps are static 1..16 —
//                  measured claim, see T5)
//   OPPOSED-FOLD  boost(+10) vs decay(-3), both valid, same field same tick ->
//                 max-fold silently discards decay EVERY tick, zero deferrals
//   DELETE-VS-WRITE fert(+50) vs reap(delete) on the same crop, same tick ->
//                 records which layer resolves it and what happens to the
//                 fert tx's OTHER, innocent targets (atomicity coupling)
//
// `node experiments/029_multirule_session/multirule_session.js` -> ALL PASS.
// Zero deps. Exports everything for the live RD-B5 harness to reuse.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE, TYPE_NAME, foldSemantics, isFoldable } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

// ---- fixture ----------------------------------------------------------------
// One canonical farm world for every control (differences live in the RULES,
// so traces are comparable across controls).
function buildFarm(capacity = 256) {
  const g = new Engine(capacity);
  const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'c1', parent: zone, water: 20, growth: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'c2', parent: zone, water: 10, growth: 40 }).uuid;
  return { g, zone, c1, c2 };
}

// ---- the rule-sets (each rule is the JSON a model would emit) ----------------
// The ORACLE farming loop — the hand-authored proof the game-level goal is
// achievable INSIDE the decided grammar. 4 rules, individually gate-valid.
const ORACLE_RULES = [
  { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
    effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 5 ] }, 255 ] } },
               { set: 'water',  to: { max: [ { sub: [ { field: 'water' }, 1 ] }, 0 ] } } ] },
  { name: 'wilt', match: { type: 'crop', where: { all: [ { field: 'water', cmp: '==', value: 0 },
                                                          { field: 'growth', cmp: '>', value: 0 } ] } },
    effects: [ { set: 'growth', to: { max: [ { sub: [ { field: 'growth' }, 2 ] }, 0 ] } } ] },
  { name: 'reap', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } },
    effects: [ { delete: true } ] },
  { name: 'reseed', match: { type: 'zone' }, every: 3,
    effects: [ { spawn: { type: 'crop', props: { name: 'seed', water: 20, growth: 0 }, cap: 1 } } ] },
];

const MISSING_LINK_RULES = ORACLE_RULES.filter(r => r.name !== 'reseed');

const BENIGN_LINEAR_RULES = [
  ORACLE_RULES[0], // grow
  { name: 'planter', match: { type: 'zone' }, // every tick, bounded per tick, population += 1/tick
    effects: [ { spawn: { type: 'crop', props: { name: 'row', water: 200, growth: 0 }, cap: 1 } } ] },
];

const OPPOSED_FOLD_RULES = [
  { name: 'boost', match: { type: 'crop' },
    effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 10 ] }, 255 ] } } ] },
  { name: 'decay', match: { type: 'crop' },
    effects: [ { set: 'growth', to: { max: [ { sub: [ { field: 'growth' }, 3 ] }, 0 ] } } ] },
];

// fert is +30 (not +50) so the fixture's two crops cross the reap threshold on
// DIFFERENT ticks (c2 at tick 3, c1 later) — that desynchronization is what
// makes the innocent-target atomicity coupling measurable at tick 3.
const DELETE_VS_WRITE_RULES = [
  { name: 'fert', match: { type: 'crop' },
    effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 30 ] }, 255 ] } } ] },
  { name: 'reap', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } },
    effects: [ { delete: true } ] },
];

// ---- instrumented session runner ---------------------------------------------
// Installs each rule through the REAL wire (rejections are recorded, not thrown),
// wraps engine.submit to capture each tick's batch, and steps N ticks recording
// the full trace. `trustedSystems` lets a control register a raw closure (used
// ONLY by the superlinear calibration control — a rule cannot express that).
function runSession({ rules = [], trustedSystems = [], ticks = 40, capacity = 256, tickOpsBudget = null } = {}) {
  const fx = buildFarm(capacity);
  const { g } = fx;
  // ITEM 0 (RD-B2.1): the live run's enforcement column. Session config, set
  // post-construction like any engine policy knob; null = off (default engine
  // behavior, every deterministic control above unchanged).
  if (tickOpsBudget != null) g.tickOpsBudget = tickOpsBudget;

  const installErrors = [];
  for (const r of rules) {
    const res = installRule(g, r);
    if (!res.ok) installErrors.push({ rule: r.name, errors: res.errors });
  }
  for (const [name, fn] of trustedSystems) g.registerSystem(name, fn);

  // capture each submit()'s batch without touching engine internals
  let lastBatch = null;
  const origSubmit = g.submit.bind(g);
  g.submit = (batch) => { lastBatch = batch; return origSubmit(batch); };

  const trace = [];
  let unsafe = 0;
  for (let t = 0; t < ticks; t++) {
    const r = g.stepTick();
    const batch = lastBatch ?? [];

    // per-actor submitted op counts + per-tick action tallies from COMMITTED txs
    const opsByActor = {}, rejected = [];
    let totalOps = 0, spawns = 0, reaps = 0;
    batch.forEach((tx, i) => {
      opsByActor[tx.actor] = (opsByActor[tx.actor] ?? 0) + tx.ops.length;
      totalOps += tx.ops.length;
      const st = r.results[i]?.status;
      if (st === 'committed') for (const op of tx.ops) {
        if (op.kind === 'createChild') spawns++;
        if (op.kind === 'delete') reaps++;
      }
      if (st === 'rejected') rejected.push({ actor: tx.actor, reasons: r.results[i].reasons });
    });

    // SILENT FOLD ARBITRATION detector: same (target, field) written by >=2
    // DISTINCT actors with DIFFERENT values on a foldable field. RD-005 folds
    // these losslessly for convergent intents; between OPPOSED rules the fold
    // still picks one — with no deferral and no author signal. Count them.
    const writes = new Map();
    batch.forEach((tx, i) => {
      if (r.results[i]?.status !== 'committed') return;
      for (const op of tx.ops) if (op.kind === 'setfield') {
        const e = g.w.liveEntity(op.target); // post-commit resolve is fine for typing
        const ty = e >= 0 ? g.w.type[e] : null;
        const k = `${op.target}|${op.field}`;
        (writes.get(k) ?? writes.set(k, []).get(k)).push({ actor: tx.actor, value: op.value, ty });
      }
    });
    let foldArbitrations = 0;
    for (const [k, ws] of writes) {
      const actors = new Set(ws.map(w => w.actor)), values = new Set(ws.map(w => w.value));
      if (actors.size >= 2 && values.size >= 2 && ws[0].ty !== null
          && isFoldable(foldSemantics(ws[0].ty, k.split('|')[1]))) foldArbitrations++;
    }

    const liveCrops = g.w.byType.get(TYPE.CROP)?.size ?? 0;
    let maxGrowth = 0;
    for (const e of g.w.byType.get(TYPE.CROP) ?? []) maxGrowth = Math.max(maxGrowth, g._field(e, 'growth'));
    if (!g.indexesConsistent()) unsafe++;
    for (const [u, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== u) unsafe++;

    // ITEM-0 SIGNAL (RD-B2.1): budget trips are a first-class scorecard column,
    // not just an enforced cap. The classifier MEASURES growth and never
    // rejects; the budget REJECTS and never explains — the RD-B5 spec logs
    // both, so a live session's write-up can distinguish "the model's rules
    // grew until the ceiling caught them" from "the rules stayed bounded".
    // Reasons are prefixed by their own guard (the RD-B2.1 localization rule):
    // `budget:` = per-tx cap, `tick-budget:` = global per-tick cap.
    const budgetTrips = rejected.filter(x => x.reasons.some(s => /^(tick-)?budget:/.test(s))).length;

    trace.push({ tick: r.tick, totalOps, opsByActor, committed: r.committed,
      rejected, deferrals: r.deferrals, foldArbitrations, budgetTrips, spawns, reaps, liveCrops, maxGrowth });
    lastBatch = null;
  }

  g.submit = origSubmit;
  return { fx, trace, installErrors, unsafe };
}

// ---- the temporal observable -------------------------------------------------
// "The farming loop WORKS": crops mature, get reaped, get replanted, and the
// loop is STILL running late in the run. Each clause is checkable only over the
// whole trace — this is precisely the contract shape RD-014's per-proposal gate
// has never been pointed at.
function checkFarmObservable(trace, unsafe) {
  const lastThird = trace.slice(Math.floor(trace.length * 2 / 3));
  const clauses = {
    safe:      unsafe === 0,
    matured:   trace.some(t => t.maxGrowth >= 100),
    reaped:    trace.reduce((n, t) => n + t.reaps, 0) >= 2,
    reseeded:  trace.reduce((n, t) => n + t.spawns, 0) >= 5,
    sustained: lastThird.some(t => t.reaps > 0) && lastThird.some(t => t.spawns > 0)
               && trace[trace.length - 1].liveCrops >= 1,
  };
  return { pass: Object.values(clauses).every(Boolean), clauses };
}

// ---- ops-per-tick growth classifier -------------------------------------------
// bounded | linear | superlinear, from the slope of totalOps over the run's two
// halves. The confound-killer for multi-rule sessions: rising ops with a stable
// slope is ACCUMULATION (N rules x M ticks), not emergent bad behavior; a
// growing slope is the thing to investigate. Warmup ticks are skipped.
function classifyOpGrowth(trace, { warmup = 4 } = {}) {
  const ys = trace.slice(warmup).map(t => t.totalOps);
  const half = Math.floor(ys.length / 2);
  const slope = (a) => a.length > 1 ? (a[a.length - 1] - a[0]) / (a.length - 1) : 0;
  const s1 = slope(ys.slice(0, half)), s2 = slope(ys.slice(half));
  const label = (Math.abs(s2) <= 0.1) ? 'bounded'
    : (s2 > 2 * Math.max(s1, 0.25) ? 'superlinear' : 'linear');
  return { label, firstHalfSlope: +s1.toFixed(3), secondHalfSlope: +s2.toFixed(3) };
}

module.exports = { buildFarm, runSession, checkFarmObservable, classifyOpGrowth,
  ORACLE_RULES, MISSING_LINK_RULES, BENIGN_LINEAR_RULES, OPPOSED_FOLD_RULES, DELETE_VS_WRITE_RULES };

// =============================================================================
// SELF-TEST — the calibration proof. `node multirule_session.js` -> ALL PASS.
// =============================================================================
if (require.main === module) {
  let PASS = 0, FAIL = 0;
  const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

  // --- T1: ORACLE — the game-level goal is achievable inside the grammar -----
  console.log('=== T1: oracle farming loop sustains (the goal is achievable) ===');
  {
    const { trace, installErrors, unsafe } = runSession({ rules: ORACLE_RULES });
    ok(installErrors.length === 0, `T1 all 4 oracle rules install through the real wire`);
    const obs = checkFarmObservable(trace, unsafe);
    ok(obs.pass, `T1 temporal observable PASSES: ${JSON.stringify(obs.clauses)}`);
    ok(unsafe === 0, 'T1 zero unsafe events across 40 ticks');
    const g = classifyOpGrowth(trace);
    ok(g.label !== 'superlinear', `T1 op growth is ${g.label} (slopes ${g.firstHalfSlope} -> ${g.secondHalfSlope}) — steady-state loop`);
    const reaps = trace.reduce((n, t) => n + t.reaps, 0), spawns = trace.reduce((n, t) => n + t.spawns, 0);
    console.log(`    [oracle] reaps=${reaps} spawns=${spawns} endCrops=${trace[trace.length - 1].liveCrops}`);
  }

  // --- T2: MISSING-LINK — the checker cannot be trivially satisfied ----------
  console.log('\n=== T2: oracle minus reseed FAILS the observable (checker bites) ===');
  {
    const { trace, unsafe } = runSession({ rules: MISSING_LINK_RULES });
    const obs = checkFarmObservable(trace, unsafe);
    ok(!obs.pass, `T2 observable FAILS without reseed: ${JSON.stringify(obs.clauses)}`);
    ok(obs.clauses.safe && obs.clauses.matured, 'T2 ...and fails on SUSTAINABILITY, not on safety (rules were individually fine)');
  }

  // --- T3: BENIGN-LINEAR — accumulation is NOT flagged as emergent-bad -------
  console.log('\n=== T3: benign linear accumulation classified linear (confound control) ===');
  {
    const { trace, unsafe } = runSession({ rules: BENIGN_LINEAR_RULES });
    const g = classifyOpGrowth(trace);
    ok(g.label === 'linear', `T3 spawn-every-tick + grow classified LINEAR (slopes ${g.firstHalfSlope} -> ${g.secondHalfSlope})`);
    ok(unsafe === 0, 'T3 zero unsafe events (population growth alone is not a safety event)');
  }

  // --- T4: SUPERLINEAR — the classifier CAN fire (and rules can't cause it) --
  console.log('\n=== T4: superlinear control fires the classifier ===');
  {
    // trusted closure: every crop spawns a crop -> population doubles per tick.
    // Deliberately NOT a rule: static spawn caps make this unrepresentable.
    const doubler = (view) => view.allOfType('crop').map(u =>
      ({ kind: 'createChild', type: TYPE.CROP, parent: u, props: { name: 'x', water: 1, growth: 0 } }));
    const { trace } = runSession({ rules: [ORACLE_RULES[0]], trustedSystems: [['doubler', doubler]], ticks: 12, capacity: 20000 });
    const g = classifyOpGrowth(trace, { warmup: 2 });
    ok(g.label === 'superlinear', `T4 population-doubler classified SUPERLINEAR (slopes ${g.firstHalfSlope} -> ${g.secondHalfSlope})`);
  }
  {
    // measured claim: the grammar cannot express the doubler — spawn cap is a
    // static 1..16 integer, and an out-of-range cap is a LOCALIZED wire error.
    const { parseRule } = CORE('behavior.js');
    const stub = { w: { capacity: 256, resolve: () => ({ status: 'missing' }), type: [], byUuid: new Map() } };
    const r = parseRule(stub, { name: 'bomb', match: { type: 'crop' }, effects: [ { spawn: { type: 'crop', cap: 100000 } } ] });
    ok(!r.ok && r.errors.some(e => e.code === 'spawn_cap_required'),
      'T4 a rule CANNOT express superlinear growth: cap 100000 statically rejected (spawn_cap_required)');
  }

  // --- T5: OPPOSED-FOLD — silent arbitration between rules, measured ---------
  console.log('\n=== T5: opposed foldable writes — max-fold silently discards one rule ===');
  {
    const { fx, trace, unsafe } = runSession({ rules: OPPOSED_FOLD_RULES, ticks: 10 });
    const arbs = trace.reduce((n, t) => n + t.foldArbitrations, 0);
    const defs = trace.reduce((n, t) => n + t.deferrals.length, 0);
    ok(arbs >= 18, `T5 fold arbitration on ~every crop every tick (${arbs} events over 10 ticks)`);
    ok(defs === 0, 'T5 ZERO deferrals — the clash is auto-folded, never surfaced to any author');
    // decay's entire intent is discarded: growth advances exactly as if decay were not installed
    const g1 = fx.g._field(fx.g.w.liveEntity(fx.c1), 'growth');
    ok(g1 === 100, `T5 c1 growth after 10 ticks = ${g1} = +10/tick — decay(-3) contributed NOTHING (max-fold arbitration)`);
    ok(unsafe === 0, 'T5 zero unsafe events — this is a SEMANTIC finding, not a corruption');
    console.log('    [finding] RD-005 max-fold is lossless for CONVERGENT intents (two waterings);');
    console.log('              between OPPOSED rules it silently deletes one rule\'s purpose. No signal exists');
    console.log('              today that would tell an authoring model its rule is being no-opped.');
  }

  // --- T6: DELETE-VS-WRITE — resolution layer + innocent-target coupling -----
  // Fixture dynamics (fert +30): c2 (g0=40) crosses 100 pre-tick at t3 -> reaped;
  // c1 (g0=0) is at 60, INNOCENT. But fert's tick-3 tx writes BOTH crops, and one
  // write targets the now-deleted c2 -> the WHOLE fert tx is rejected (atomicity,
  // RD-002: a partial behavior is corruption) -> c1's growth STALLS one tick.
  // The mechanism (probed directly): the VALIDATE layer rejects with the
  // localized reason 'cannot write growth of a destroyed object' — not a fold,
  // not a deferral, not silent. Actor names: stepTick wraps installRule's
  // 'rule:<name>' system as actor 'sys:rule:<name>'.
  console.log('\n=== T6: delete-vs-write same tick — validate-layer rejection + innocent-target coupling ===');
  {
    const { fx, trace, unsafe } = runSession({ rules: DELETE_VS_WRITE_RULES, ticks: 6 });
    const t3 = trace[2];
    ok(t3.reaps === 1, `T6 reap landed at tick 3 (c2 crossed 100; reaps=${t3.reaps})`);
    const rej = t3.rejected.find(x => x.actor === 'sys:rule:fert');
    ok(!!rej && /cannot write .* destroyed/.test(rej.reasons[0] || ''),
      `T6 fert tx REJECTED at the reap tick by the VALIDATE layer: "${rej?.reasons[0]}"`);
    ok(t3.deferrals.length === 0 && t3.foldArbitrations === 0,
      'T6 resolution layer identified: validation rejection — NOT a fold, NOT a deferral');
    // innocent-target coupling: c1 was a valid target of the rejected tx -> stalled
    ok(trace[1].maxGrowth === 100 && t3.maxGrowth === 60,
      `T6 innocent target STALLED: c1 stays at 60 through tick 3 (fert's whole tx died with it) — atomicity coupling, measured`);
    ok(trace[3].maxGrowth === 90, 'T6 ...and resumes next tick (90 at tick 4): a stall, not a corruption');
    ok(unsafe === 0, 'T6 zero unsafe events');
    const rerun = runSession({ rules: DELETE_VS_WRITE_RULES, ticks: 6 });
    ok(JSON.stringify(rerun.trace) === JSON.stringify(trace), 'T6 the resolution is DETERMINISTIC (identical trace on rerun)');
  }

  // --- T7: composition inherits the pipeline (one tick = one undo, 4 rules) --
  console.log('\n=== T7: multi-rule tick is still ONE undo step ===');
  {
    const fx = buildFarm();
    for (const r of ORACLE_RULES) installRule(fx.g, r);
    fx.g.enableHistory();
    const sig = () => JSON.stringify([...fx.g.w.byUuid.entries()].map(([u, e]) =>
      [u, fx.g.w.type[e] === TYPE.CROP ? [fx.g._field(e, 'water'), fx.g._field(e, 'growth')] : null]));
    const before = sig();
    fx.g.stepTick();
    ok(sig() !== before, 'T7 tick mutated the world (4 rules fired)');
    const u = fx.g.undo();
    ok(u.ok && sig() === before, 'T7 ONE undo reverses the whole 4-rule tick (RD-020 composition holds)');
  }

  // --- T8: the item-0 column — budget trips LOGGED, with its negative control
  console.log('\n=== T8: budget trips are a logged scorecard signal (item 0), not just a cap ===');
  {
    // negative control: budget OFF (the default) — the column must read zero
    // everywhere, or the signal would be noise rather than measurement.
    const off = runSession({ rules: ORACLE_RULES, ticks: 12 });
    ok(off.trace.every(t => t.budgetTrips === 0),
      'T8 budget off (default): budgetTrips === 0 on every tick (control — the column is quiet without the cap)');

    // budget ON and deliberately tight: the oracle emits multiple rule txs per
    // tick; a 2-op ceiling forces deterministic tick-budget rejections.
    const on = runSession({ rules: ORACLE_RULES, ticks: 12, tickOpsBudget: 2 });
    const trips = on.trace.reduce((n, t) => n + t.budgetTrips, 0);
    ok(trips > 0, `T8 budget on (2 ops/tick vs the oracle's demand): ${trips} trips LOGGED across 12 ticks`);
    ok(on.trace.every(t => t.budgetTrips === t.rejected.filter(x => x.reasons.some(s => /^(tick-)?budget:/.test(s))).length),
      'T8 the column counts exactly the budget-guard rejections (each guard names itself — RD-B2.1 localization)');
    ok(on.unsafe === 0, 'T8 a budget-throttled session stays safe (zero unsafe events)');
    const rerun = runSession({ rules: ORACLE_RULES, ticks: 12, tickOpsBudget: 2 });
    ok(JSON.stringify(rerun.trace) === JSON.stringify(on.trace),
      'T8 throttled trace is DETERMINISTIC (identical on rerun — admission is actor-ordered, RD-B2.1)');
  }

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
}
