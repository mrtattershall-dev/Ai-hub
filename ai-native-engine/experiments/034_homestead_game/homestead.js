'use strict';
// =============================================================================
// B3 — HOMESTEAD: the win/lose observable (pinned) + the oracle rule-set as
// ground truth that the game is WINNABLE in the decided grammar, + a reusable
// play harness (B4). Same discipline as RD-B5's checkFarmObservable + oracle.
// `node experiments/034_homestead_game/homestead.js` -> ALL PASS.
// =============================================================================
// The observable and its bars are the SPEC.md table, verbatim — pinned BEFORE
// any rule is authored so B5's verdict can't be fitted after the fact.
// Zero deps.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE, TYPE_NAME } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const M_TICKS = 40;                         // session length (SPEC.md)

// ---- the starting world (SPEC.md). B1 authors this SAME world via the editor;
// here it is built directly as the oracle-proof fixture. ----------------------
function buildStartWorld(engine = new Engine(256)) {
  const zone = engine.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  // three crops, all watered (25), growth staggered so harvests start early.
  const crops = [70, 40, 0].map((g, i) =>
    engine.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 25, growth: g }).uuid);
  return { engine, zone, crops };
}

// ---- the ORACLE rule-set: the correct 5-rule HOMESTEAD loop (SPEC.md). One
// zone in the world, so `match:{type:'zone'}` unambiguously targets the field.
function oracleRules() {
  return [
    { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
      effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 5] }, 255] } }] },
    { name: 'drain', match: { type: 'crop' },
      effects: [{ set: 'water', to: { max: [{ sub: [{ field: 'water' }, 1] }, 0] } }] },
    { name: 'reap', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } },
      effects: [{ delete: true }] },
    { name: 'score', match: { type: 'zone' },
      effects: [{ set: 'tally', to: { min: [{ add: [{ field: 'tally' },
        { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } } }] }, 4294967295] } }] },
    { name: 'reseed', match: { type: 'zone' }, every: 3,
      effects: [{ spawn: { type: 'crop', props: { name: 'seed', water: 25, growth: 0 }, cap: 1 } }] },
  ];
}

// ---- reusable play harness (B4 drives this too). Steps `ticks` ticks, records
// the per-tick trace the observable needs, plus a legible line per tick. -------
function playSession({ engine, zone, ticks = M_TICKS, onTick = null }) {
  // capture each tick's committed batch to count reaps (deletes) & spawns.
  let lastBatch = null;
  const orig = engine.submit.bind(engine);
  engine.submit = (b) => { lastBatch = b; return orig(b); };

  const trace = [];
  let unsafe = 0;
  for (let t = 0; t < ticks; t++) {
    const r = engine.stepTick();
    const batch = lastBatch ?? [];
    let reaps = 0, spawns = 0;
    batch.forEach((tx, i) => {
      if (r.results[i]?.status !== 'committed') return;
      for (const op of tx.ops) { if (op.kind === 'delete') reaps++; if (op.kind === 'createChild') spawns++; }
    });
    const population = engine.w.byType.get(TYPE.CROP)?.size ?? 0;
    const ze = engine.w.liveEntity(zone);
    const tally = ze >= 0 ? engine._field(ze, 'tally') : 0;
    if (!engine.indexesConsistent()) unsafe++;
    for (const [u, e] of engine.w.byUuid) if (engine.w.destroyed[e] || engine.w.uuid[e] !== u) unsafe++;
    const row = { tick: r.tick, population, reaps, spawns, tally };
    trace.push(row);
    if (onTick) onTick(row);
    lastBatch = null;
  }
  engine.submit = orig;
  return { trace, unsafe };
}

// ---- THE PINNED OBSERVABLE (SPEC.md table, verbatim) ------------------------
function checkHomesteadObservable(trace, unsafe) {
  const lastThird = trace.slice(Math.floor(trace.length * 2 / 3));   // ticks 27..40
  const clauses = {
    safe:       unsafe === 0,
    alive:      trace.every(t => t.population >= 1),                 // never died off
    thriving:   lastThird.length > 0 && lastThird.every(t => t.population >= 3),
    productive: trace.reduce((n, t) => n + t.reaps, 0) >= 4,
    scored:     (trace[trace.length - 1]?.tally ?? 0) >= 6,
  };
  return { win: Object.values(clauses).every(Boolean), clauses };
}

// ---- run a full game from a rule-set (installs, plays, adjudicates) ----------
function runGame(rules, { ticks = M_TICKS, onTick = null } = {}) {
  const { engine, zone } = buildStartWorld();
  const installErrors = [];
  for (const r of rules) { const res = installRule(engine, r); if (!res.ok) installErrors.push({ rule: r.name, errors: res.errors }); }
  const { trace, unsafe } = playSession({ engine, zone, ticks, onTick });
  const verdict = checkHomesteadObservable(trace, unsafe);
  return { engine, zone, trace, unsafe, installErrors, verdict };
}

// ---- authoring apparatus (shared by B2 + B5): the 5 authoring goals and a
// proposer that emits the MEASURED failure classes (RD-B1/B2/B4: unclamped
// range, missing spawn cap) then repairs from the gate's localized error — so
// the editor's REAL gate + repair loop is exercised. Only the proposer's
// *capability* is stubbed; its capability is separately measured (b2_smoke.js:
// qwen2.5-coder:7b too slow on CPU, phi3 too weak — safety held under both).
const HOMESTEAD_GOALS = [
  'watered crops gain 5 growth each tick',
  'every crop loses 1 water each tick',
  'crops that reach 100 growth are harvested',
  'the field zone scores the number of ready crops each tick',
  'the field plants a new crop every 3 ticks',
];
function nearMissProposer() {
  const R = {
    grow: ['{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"add":[{"field":"growth"},5]}}]}',
           '{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"min":[{"add":[{"field":"growth"},5]},255]}}]}'],
    drain: ['{"name":"drain","match":{"type":"crop"},"effects":[{"set":"water","to":{"sub":[{"field":"water"},1]}}]}',
            '{"name":"drain","match":{"type":"crop"},"effects":[{"set":"water","to":{"max":[{"sub":[{"field":"water"},1]},0]}}]}'],
    reap: ['{"name":"reap","match":{"type":"crop","where":{"field":"growth","cmp":">=","value":100}},"effects":[{"delete":true}]}'],
    score: ['{"name":"score","match":{"type":"zone"},"effects":[{"set":"tally","to":{"add":[{"field":"tally"},{"count":{"type":"crop","where":{"field":"growth","cmp":">=","value":100}}}]}}]}',
            '{"name":"score","match":{"type":"zone"},"effects":[{"set":"tally","to":{"min":[{"add":[{"field":"tally"},{"count":{"type":"crop","where":{"field":"growth","cmp":">=","value":100}}}]},4294967295]}}]}'],
    reseed: ['{"name":"reseed","match":{"type":"zone"},"every":3,"effects":[{"spawn":{"type":"crop","props":{"name":"seed","water":25,"growth":0}}}]}',
             '{"name":"reseed","match":{"type":"zone"},"every":3,"effects":[{"spawn":{"type":"crop","props":{"name":"seed","water":25,"growth":0},"cap":1}}]}'],
  };
  return async (prompt) => {
    const goal = ((prompt.match(/GOAL: (.*)/) || [])[1] || '').toLowerCase();
    const sawErr = /REJECTED/.test(prompt);
    const key = /gain.*growth|growth each tick/.test(goal) ? 'grow'
      : /water each tick|loses .*water|drain/.test(goal) ? 'drain'
      : /harvest|reach.*100|reap/.test(goal) ? 'reap'
      : /score|ready crops|tally/.test(goal) ? 'score'
      : /plant|new crop|reseed|every 3/.test(goal) ? 'reseed' : null;
    if (!key) return '{}';
    return sawErr && R[key][1] ? R[key][1] : R[key][0];
  };
}

// ---- HARD variant (track 3 / RD-B5 rescue): the score rule requires the RD-B7
// scoped SUM (accumulate the total growth of the field's OWN ready crops) — a
// materially harder rule than the count, chosen to push a capable model OFF
// ceiling so the observable-as-feedback rescue is measurable. Scored threshold
// raised to match (each ready crop contributes ~100 growth).
function oracleRulesHard() {
  return oracleRules().map(r => r.name !== 'score' ? r : ({
    name: 'score', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ add: [{ field: 'tally' },
      { sum: { field: 'growth', type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 }, of: 'children' } }] }, 4294967295] } }] }));
}
function checkHomesteadObservableHard(trace, unsafe) {
  const v = checkHomesteadObservable(trace, unsafe);
  v.clauses.scored = (trace[trace.length - 1]?.tally ?? 0) >= 300;   // ~3 harvests of accumulated growth
  v.win = Object.values(v.clauses).every(Boolean);
  return v;
}

module.exports = { M_TICKS, buildStartWorld, oracleRules, playSession,
  checkHomesteadObservable, runGame, HOMESTEAD_GOALS, nearMissProposer,
  oracleRulesHard, checkHomesteadObservableHard };

// =============================================================================
// GROUND-TRUTH SELF-TEST — the oracle WINS; named near-misses LOSE (the bar is
// genuinely losable). Pinned BEFORE B2 authors anything.
// =============================================================================
if (require.main === module) {
  let PASS = 0, FAIL = 0;
  const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
  console.log('=== B3: HOMESTEAD observable + oracle ground truth ===\n');

  // --- the oracle must WIN ---------------------------------------------------
  const oracle = runGame(oracleRules());
  console.log('oracle clauses:', JSON.stringify(oracle.verdict.clauses));
  console.log(`  final: population=${oracle.trace.at(-1).population} tally=${oracle.trace.at(-1).tally} reaps=${oracle.trace.reduce((n,t)=>n+t.reaps,0)} unsafe=${oracle.unsafe}`);
  ok(oracle.installErrors.length === 0, 'oracle: all 5 rules install (goal expressible in-grammar)');
  ok(oracle.unsafe === 0, 'oracle: zero unsafe events across 40 ticks');
  ok(oracle.verdict.win, 'oracle WINS the pinned observable (the game is winnable)');

  // --- near-miss LOSSES prove the bar is losable (pre-registered in SPEC) -----
  const noReseed = runGame(oracleRules().filter(r => r.name !== 'reseed'));
  ok(!noReseed.verdict.win && (!noReseed.verdict.clauses.alive || !noReseed.verdict.clauses.thriving),
    `drop reseed -> LOSE by die-off (alive=${noReseed.verdict.clauses.alive} thriving=${noReseed.verdict.clauses.thriving}, final pop=${noReseed.trace.at(-1).population})`);

  const noScore = runGame(oracleRules().filter(r => r.name !== 'score'));
  ok(!noScore.verdict.win && !noScore.verdict.clauses.scored,
    `drop score -> LOSE: runs but wins nothing (tally=${noScore.trace.at(-1).tally}, scored=${noScore.verdict.clauses.scored})`);

  const noReap = runGame(oracleRules().filter(r => r.name !== 'reap'));
  ok(!noReap.verdict.win,
    `drop reap -> LOSE: nothing harvested (productive=${noReap.verdict.clauses.productive}, reaps=${noReap.trace.reduce((n,t)=>n+t.reaps,0)})`);

  // --- the observable is SAFE-gated: an unsafe rule can't even be authored ----
  const { engine } = buildStartWorld();
  const bad = installRule(engine, { name: 'cheat', match: { type: 'crop' },
    effects: [{ set: 'growth', to: { add: [{ field: 'growth' }, 5] } }] });   // unclamped
  ok(!bad.ok && /range_unprovable/.test(JSON.stringify(bad.errors)),
    'an unclamped rule is REJECTED at authoring (never reaches the game) — the boundary is unconditional');

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
}
