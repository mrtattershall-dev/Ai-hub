// REPEATABILITY CALIBRATION. Development goals only - no holdout is touched.
//
// WHY. The 61-80 pilot produced an unplanned measurement: on 16 goals where v3 delegates to v2, the
// two arms run BYTE-IDENTICAL code with identical decoding and still disagreed on 5 of them. A
// single sample per goal per architecture is therefore a very noisy instrument, and every paired
// comparison so far has been reading that noise as part of its signal.
//
// This run estimates, per goal and per architecture:
//     P(pass)                  how often the goal is solved at all
//     within-goal variance     is this a stable pass, a stable fail, or a coin flip?
//     pairwise disagreement    how often two independent samples of the SAME setup differ
//     syntax-failure rate      how much of the failure is "did not load" rather than "wrong answer"
//     route-specific variance  does the FIM path behave differently from whole-file generation?
//
// A benchmark sample collapses 10/10, 5/10 and 0/10 into the same binary. Those are completely
// different situations and only repetition can tell them apart.
//
// ON SEEDS. ollama DOES honour options.seed - verified here: the same seed twice gives
// byte-identical output, different seeds differ, and no seed varies run to run. Two samples at
// different seeds also differed in CORRECTNESS on a trivial probe, so seed choice is not cosmetic.
//
// These repeats are nonetheless INDEPENDENT AND UNSEEDED, because arm.mjs is frozen at 68ab72c and
// takes no seed parameter, and breaking that freeze to instrument a calibration would invalidate the
// comparison the calibration exists to inform. Independent unseeded draws are exactly what is needed
// to estimate P(pass) and disagreement; what is lost is byte-level reproducibility of this run.
// Wiring an explicit seed - and matched seeds across arms - belongs in the next architecture version.

import { runGoal as runGoalV2 } from './arm.mjs';
import { runGoalV3 } from './arm3.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const N = Number(process.env.REPEATS || 8);
const PLAN = (process.env.CASES || '62:v2,63:v2,66:v2,72:v2,75:v2,71:v3,64:v3,74:v3')
  .split(',').map((s) => { const [g, a] = s.split(':'); return { goal: Number(g), arm: a }; });

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'rep-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

const OUT = mkdtempSync(join(tmpdir(), 'repeat-'));
mkdirSync(OUT, { recursive: true });
console.log('  repeatability calibration: ' + PLAN.length + ' cases x ' + N + ' independent unseeded repeats');
console.log('  development goals only; no holdout touched\n');

const rows = [];
for (const { goal, arm } of PLAN) {
  const outcomes = [];
  for (let s = 1; s <= N; s++) {
    const ws = freshWs();
    let rec;
    try {
      rec = arm === 'v3'
        ? await runGoalV3({ ws, goalIndex: goal - 1, goals: GOALS })
        : await runGoalV2({ arm: 'v2', ws, goalIndex: goal - 1, goals: GOALS });
    } catch (e) {
      rec = { verified_goal_pass: false, failure_kind: 'threw', note: String(e.message).slice(0, 80) };
    }
    outcomes.push({
      repeat: s,
      pass: !!rec.verified_goal_pass,
      contract: !!rec.contract_pass,
      kind: rec.failure_kind || null,
      route: rec.v3_route || rec.operation || null,
      loads: rec.load_success === undefined ? null : rec.load_success,
    });
    process.stdout.write('  [' + arm + ' ' + goal + ' repeat ' + s + '] ' + (rec.verified_goal_pass ? 'PASS' : 'fail')
      + '  ' + String(rec.failure_kind || '').slice(0, 44) + '\n');
  }
  const passes = outcomes.filter((o) => o.pass).length;
  // Pairwise disagreement across all C(N,2) pairs of independent samples.
  let disagree = 0;
  let pairs = 0;
  for (let i = 0; i < outcomes.length; i++) {
    for (let j = i + 1; j < outcomes.length; j++) { pairs++; if (outcomes[i].pass !== outcomes[j].pass) disagree++; }
  }
  const syntax = outcomes.filter((o) => !o.pass && /load_error|does not load|intermediate_does_not_load|SyntaxError/.test(String(o.kind))).length;
  const row = {
    goal, arm, route: outcomes[0].route, n: N, passes,
    p_pass: +(passes / N).toFixed(3),
    pairwise_disagreement: +(disagree / pairs).toFixed(3),
    stability: passes === N ? 'STABLE_PASS' : passes === 0 ? 'STABLE_FAIL' : 'STOCHASTIC',
    syntax_failures: syntax,
    kinds: outcomes.filter((o) => !o.pass).map((o) => o.kind),
    outcomes,
  };
  rows.push(row);
  console.log('    -> ' + row.stability + '  P(pass)=' + row.p_pass
    + '  pairwise disagreement=' + row.pairwise_disagreement + '  syntax failures=' + syntax + '/' + (N - passes) + '\n');
  writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');
}

console.log('===== CALIBRATION SUMMARY =====');
console.log('  goal arm  route                          P(pass)  disagree  stability');
for (const r of rows) {
  console.log('  ' + String(r.goal).padEnd(5) + r.arm.padEnd(4)
    + String(r.route || '').padEnd(31)
    + String(r.p_pass).padEnd(9) + String(r.pairwise_disagreement).padEnd(10) + r.stability);
}
const stoch = rows.filter((r) => r.stability === 'STOCHASTIC');
console.log('');
console.log('  STABLE_PASS ' + rows.filter((r) => r.stability === 'STABLE_PASS').length
  + '   STOCHASTIC ' + stoch.length
  + '   STABLE_FAIL ' + rows.filter((r) => r.stability === 'STABLE_FAIL').length + '   of ' + rows.length);
if (stoch.length) {
  const mean = stoch.reduce((s, r) => s + r.pairwise_disagreement, 0) / stoch.length;
  console.log('  mean pairwise disagreement among stochastic goals: ' + mean.toFixed(3));
}
console.log('\n  RAW = ' + OUT);
