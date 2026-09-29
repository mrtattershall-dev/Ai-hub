'use strict';
// =============================================================================
// F2 RETRO-CHECK — did the whole-tx granularity bug (RD-M0 F2: a rule's entire
// tick silently rejected when one matched entity was deleted that tick) change
// any DECIDED Phase B verdict?
//
// Phase B ran entirely under WHOLE-TX granularity. This replays the decided
// adjudications under BOTH granularities:
//   1. B3/B4/B5 ground truth: oracle WINS, named near-misses LOSE — margins.
//   2. B2-LIVE run 2 (unambiguous goals, published 2/3 WIN): the authored rule
//      bodies were captured verbatim in RESULT_JSON — exact replay.
//   3. Hard-goal oracle (b3_rescue's variant) under both.
// NOT replayable (bodies not captured; reported, not swept): B2-LIVE run 1
// (terse goals 0/3), the b3_rescue model runs, the follow-up runs. Their
// CONTROL and TREATMENT arms shared the F2 regime, so directional findings
// are not confounded BETWEEN arms; absolute win rates could shift.
//
// Also quantifies F2 directly: stalled rule txs + total ops silently dropped
// per 40-tick oracle game under WHOLE.
//
// REGIME LABELING: this runs on the POST-FIX (RD-M0.1) engine. The WHOLE arm
// emulates the historical Phase B granularity by flipping txPerEntity off —
// an emulation VALIDATED by its byte-exact reproduction of the published
// Phase B finals (pop 9 / tally 8 / reaps 8; B2-LIVE run-2 lose/WIN/WIN).
// 8/8 numbers = pre-fix historical record; 10/10 = what the engine now does.
// `node experiments/036_multiplayer/f2_retrocheck.js`
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { installRule } = CORE('behavior.js');
const H = require(path.join(__dirname, '..', '034_homestead_game', 'homestead.js'));

// Play a rule-set under a chosen granularity; returns verdict + stall stats.
function play(rules, { granularity, hard = false }) {
  const { engine, zone } = H.buildStartWorld();
  const installErrors = [];
  for (const r of rules) { const res = installRule(engine, r); if (!res.ok) installErrors.push(res.errors); }
  for (const s of engine.systems) s.txPerEntity = (granularity === 'SPLIT');
  // count rule-tx stalls + dropped ops by wrapping submit's result inspection
  let stalledTx = 0, droppedOps = 0;
  const orig = engine.submit.bind(engine);
  engine.submit = (batch) => {
    const r = orig(batch);
    batch.forEach((tx, i) => {
      if (String(tx.actor).startsWith('sys:') && r.results[i]?.status === 'rejected') {
        stalledTx++; droppedOps += tx.ops.length;
      }
    });
    return r;
  };
  const { trace, unsafe } = H.playSession({ engine, zone, ticks: H.M_TICKS });
  engine.submit = orig;
  const verdict = hard ? H.checkHomesteadObservableHard(trace, unsafe) : H.checkHomesteadObservable(trace, unsafe);
  const last = trace[trace.length - 1];
  return { verdict, unsafe, stalledTx, droppedOps, installErrors,
    finals: { pop: last.population, tally: last.tally, reaps: trace.reduce((n, t) => n + t.reaps, 0) } };
}

const fmt = (r) => `${r.verdict.win ? 'WIN ' : 'LOSE'} pop=${r.finals.pop} tally=${r.finals.tally} reaps=${r.finals.reaps} stalledRuleTx=${r.stalledTx} droppedOps=${r.droppedOps} unsafe=${r.unsafe}`;

let PASS = 0, FAIL = 0, FLIPS = [];
const check = (cond, msg) => { cond ? PASS++ : FAIL++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

console.log('=== F2 retro-check: Phase B verdicts under WHOLE (as decided) vs SPLIT (F2 fixed) ===\n');

// ---- 1. ground truth: oracle + near-misses ---------------------------------
console.log('--- 1. B3/B4/B5 ground truth (bar: productive>=4 reaps, scored>=6 tally, thriving pop>=3) ---');
const sets = [
  ['oracle', H.oracleRules(), true],
  ['drop-reseed', H.oracleRules().filter(r => r.name !== 'reseed'), false],
  ['drop-score', H.oracleRules().filter(r => r.name !== 'score'), false],
  ['drop-reap', H.oracleRules().filter(r => r.name !== 'reap'), false],
];
for (const [name, rules, expectWin] of sets) {
  const w = play(rules, { granularity: 'WHOLE' });
  const s = play(rules, { granularity: 'SPLIT' });
  console.log(`${name.padEnd(12)} WHOLE: ${fmt(w)}`);
  console.log(`${''.padEnd(12)} SPLIT: ${fmt(s)}`);
  check(w.verdict.win === expectWin, `  ${name} under WHOLE (as decided in Phase B): ${expectWin ? 'wins' : 'loses'}`);
  check(s.verdict.win === expectWin, `  ${name} under SPLIT (F2 fixed): verdict UNCHANGED`);
  if (w.verdict.win !== s.verdict.win) FLIPS.push(`ground-truth:${name}`);
}

// ---- 2. B2-LIVE run 2: exact replay from captured bodies -------------------
console.log('\n--- 2. B2-LIVE run 2 (published: lose, WIN, WIN — score 8 vs bar 6) ---');
const cap = fs.readFileSync(path.join(__dirname, '..', '034_homestead_game', 'b2_live_Qwen2_5-Coder-32B-Instruct.txt'), 'utf8');
const json = JSON.parse(cap.match(/RESULT_JSON (.*)/)[1]);
json.perRule.forEach((session, i) => {
  const bodies = session.authored.filter(a => a.ok && a.body).map(a => JSON.parse(a.body));
  const w = play(bodies, { granularity: 'WHOLE' });
  const s = play(bodies, { granularity: 'SPLIT' });
  console.log(`s${i + 1} (${bodies.length}/5 rules) WHOLE: ${fmt(w)}`);
  console.log(`   ${''.padEnd(11)} SPLIT: ${fmt(s)}`);
  check(w.verdict.win === session.win, `  s${i + 1} WHOLE replay reproduces the published verdict (${session.win ? 'WIN' : 'lose'})`);
  check(s.verdict.win === session.win, `  s${i + 1} SPLIT: verdict UNCHANGED`);
  if (w.verdict.win !== s.verdict.win) FLIPS.push(`b2-live-s${i + 1}`);
});

// ---- 3. hard-goal oracle (the b3_rescue variant) ----------------------------
console.log('\n--- 3. hard-goal oracle (scored>=300, the rescue-run bar) ---');
const hw = play(H.oracleRulesHard(), { granularity: 'WHOLE', hard: true });
const hs = play(H.oracleRulesHard(), { granularity: 'SPLIT', hard: true });
console.log(`oracle-hard  WHOLE: ${fmt(hw)}`);
console.log(`oracle-hard  SPLIT: ${fmt(hs)}`);
check(hw.verdict.win, '  hard oracle wins under WHOLE (as it did when the rescue bar was set)');
check(hs.verdict.win, '  hard oracle wins under SPLIT');
if (hw.verdict.win !== hs.verdict.win) FLIPS.push('oracle-hard');

console.log(`\n=== ${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed ===`);
console.log(FLIPS.length
  ? `VERDICT FLIPS UNDER F2 FIX: ${FLIPS.join(', ')} — Phase B conclusions AFFECTED, records must be amended`
  : 'NO decided verdict flips. F2 cost real dropped ops (counts above) but never the difference between win and loss in any replayable decided run.');
console.log('NOT replayable (bodies never captured): B2-LIVE run 1 (terse 0/3), b3_rescue model runs, follow-ups.');
process.exit(FAIL ? 1 : 0);
