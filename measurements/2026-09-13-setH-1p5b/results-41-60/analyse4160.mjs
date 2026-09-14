// ANALYSIS OF THE 41-60 HELD-OUT EXPERIMENT, in the preregistered order.
//
//   1. verified goal attainment, all 20, paired McNemar
//   2. 19-goal sensitivity, excluding only the pre-identified weak-oracle goal
//   3. FIM_ELIGIBLE mechanism subset (13) - SECONDARY
//   4. WHOLE_FILE_FALLBACK quasi-control (7)
//   5. mechanism metrics
//   6. route-specific outcomes
//
// The interaction the architecture predicts: v2 separates from v1 primarily on the subset whose
// edit surface it actually changes, while the fallback subset stays comparatively similar. Seeing
// both subsets move together would mean the difference came from something other than edit surface.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const RAW = process.argv[2];
if (!RAW) { console.error('usage: node analyse4160.mjs <rawDir>'); process.exit(2); }

const all = JSON.parse(readFileSync(join(RAW, 'all.json'), 'utf8'));
const strata = JSON.parse(readFileSync(join(HERE, 'goal-strata-41-60.json'), 'utf8'));
const plan = JSON.parse(readFileSync(join(HERE, 'ANALYSIS_PLAN.json'), 'utf8'));
const byGoal = (arm) => new Map(all[arm].map((r) => [r.goal, r]));
const V1 = byGoal('v1');
const V2 = byGoal('v2');
const S = new Map(strata.goals.map((g) => [g.goal, g]));
const GOALS = strata.goals.map((g) => g.goal);

const nCr = (n, k) => { let r = 1; for (let j = 0; j < k; j++) r = (r * (n - j)) / (j + 1); return r; };
const mcnemar = (b, c) => {
  const d = b + c;
  if (!d) return NaN;
  const lo = Math.min(b, c);
  let t = 0;
  for (let j = 0; j <= lo; j++) t += nCr(d, j) * Math.pow(0.5, d);
  return Math.min(1, 2 * t);
};

function paired(goals, label, key = 'verified_goal_pass') {
  let both = 0; let neither = 0; const v2only = []; const v1only = [];
  for (const g of goals) {
    const a = !!(V1.get(g) || {})[key];
    const b = !!(V2.get(g) || {})[key];
    if (a && b) both++;
    else if (!a && !b) neither++;
    else if (b) v2only.push(g);
    else v1only.push(g);
  }
  const p = mcnemar(v2only.length, v1only.length);
  console.log('  ' + label);
  console.log('    v1 ' + goals.filter((g) => (V1.get(g) || {})[key]).length + '/' + goals.length
    + '    v2 ' + goals.filter((g) => (V2.get(g) || {})[key]).length + '/' + goals.length);
  console.log('    both ' + both + '  neither ' + neither
    + '  discordant ' + (v2only.length + v1only.length)
    + '   v1 fail -> v2 pass [' + (v2only.join(',') || 'none') + ']'
    + '   v1 pass -> v2 fail [' + (v1only.join(',') || 'none') + ']');
  console.log('    exact McNemar p = ' + (Number.isNaN(p) ? 'n/a - no discordant pairs' : p.toFixed(4))
    + (!Number.isNaN(p) && p < 0.05 ? '   SIGNIFICANT' : ''));
  return { v1: goals.filter((g) => (V1.get(g) || {})[key]).length, v2: goals.filter((g) => (V2.get(g) || {})[key]).length, p };
}

// Provenance: every row must have started from the frozen canonical world.
const starts = new Set([...all.v1, ...all.v2].map((r) => r.start_seed_bundle_sha));
console.log('===== PROVENANCE =====');
console.log('  distinct start states across all 40 trials: ' + starts.size
  + (starts.size === 1 ? '  (all from the canonical seed ' + [...starts][0].slice(0, 16) + ')' : '  <-- TRIALS DID NOT SHARE A START STATE'));
console.log('  strata_sha ' + plan.strata_sha.slice(0, 16) + '   v1 ' + plan.v1_commit + '   v2 ' + plan.v2_commit);

console.log('\n===== 1. PRIMARY - verified goal attainment, all 20 =====');
const primary = paired(GOALS, 'VERIFIED_GOAL_PASS (structural AND behavioural oracle where one exists)');

const weak = strata.goals.filter((g) => g.oracle === 'STRUCTURAL_WEAK_NO_OP_PASSES').map((g) => g.goal);
console.log('\n===== 2. SENSITIVITY - excluding preregistered weak oracle ' + JSON.stringify(weak) + ' =====');
paired(GOALS.filter((g) => !weak.includes(g)), 'VERIFIED_GOAL_PASS, ' + (GOALS.length - weak.length) + ' goals');

const fim = strata.goals.filter((g) => g.stratum === 'FIM_ELIGIBLE').map((g) => g.goal);
const fb = strata.goals.filter((g) => g.stratum === 'WHOLE_FILE_FALLBACK').map((g) => g.goal);
console.log('\n===== 3. MECHANISM SUBSET (secondary) - FIM_ELIGIBLE, ' + fim.length + ' goals =====');
const mech = paired(fim, 'goals whose edit surface v2 actually changes');
console.log('\n===== 4. QUASI-CONTROL - WHOLE_FILE_FALLBACK, ' + fb.length + ' goals =====');
const ctrl = paired(fb, 'goals where BOTH arms generate whole files');

console.log('\n  PREDICTED INTERACTION: separation concentrated in the FIM subset, fallback flat.');
console.log('    FIM subset      v1 ' + mech.v1 + '/' + fim.length + '  ->  v2 ' + mech.v2 + '/' + fim.length
  + '   delta ' + (mech.v2 - mech.v1));
console.log('    fallback subset v1 ' + ctrl.v1 + '/' + fb.length + '  ->  v2 ' + ctrl.v2 + '/' + fb.length
  + '   delta ' + (ctrl.v2 - ctrl.v1));

console.log('\n===== 5. MECHANISM METRICS =====');
const sum = (arm, f) => all[arm].reduce((s, r) => s + (Number(f(r)) || 0), 0);
const cnt = (arm, f) => all[arm].filter(f).length;
const rows = [
  ['body produced', (a) => cnt(a, (r) => r.body_present)],
  ['load success', (a) => cnt(a, (r) => r.load_success === true)],
  ['structural contract pass', (a) => cnt(a, (r) => r.contract_pass)],
  ['behavioural probe pass', (a) => cnt(a, (r) => r.behavioral_pass === true)],
  ['VERIFIED goal pass', (a) => cnt(a, (r) => r.verified_goal_pass)],
  ['dependency-firewall blocks', (a) => cnt(a, (r) => r.failure_kind === 'dependency_firewall')],
  ['unresolved-dep violations', (a) => sum(a, (r) => (r.firewall_violations || []).length)],
  ['span-safety rejections', (a) => cnt(a, (r) => r.span_safety_rejected)],
  ['outside-span changes', (a) => cnt(a, (r) => r.outside_span_changed)],
  ['whole-file rewrites', (a) => cnt(a, (r) => r.rewrote_whole_file)],
  ['lines added (total)', (a) => sum(a, (r) => r.lines_added)],
  ['lines removed (total)', (a) => sum(a, (r) => r.lines_removed)],
  ['repairs attempted', (a) => cnt(a, (r) => r.repair_attempted)],
  ['repairs succeeded', (a) => cnt(a, (r) => r.repair_success)],
  ['model calls (total)', (a) => sum(a, (r) => r.model_calls)],
];
console.log('    metric                        v1        v2');
for (const [name, f] of rows) {
  console.log('    ' + name.padEnd(29) + String(f('v1')).padEnd(9) + String(f('v2')));
}

console.log('\n===== 6. ROUTE-SPECIFIC OUTCOMES (v2) =====');
const byOp = {};
for (const r of all.v2) {
  const k = r.operation || 'unknown';
  byOp[k] = byOp[k] || { n: 0, verified: 0, contract: 0 };
  byOp[k].n++;
  if (r.verified_goal_pass) byOp[k].verified++;
  if (r.contract_pass) byOp[k].contract++;
}
for (const [k, v] of Object.entries(byOp)) {
  console.log('    ' + k.padEnd(16) + ' n=' + String(v.n).padEnd(4) + ' contract ' + v.contract + '/' + v.n + '   VERIFIED ' + v.verified + '/' + v.n);
}
const kinds = {};
for (const arm of ['v1', 'v2']) {
  kinds[arm] = {};
  for (const r of all[arm]) if (!r.verified_goal_pass && r.failure_kind) {
    for (const k of String(r.failure_kind).split(',')) kinds[arm][k] = (kinds[arm][k] || 0) + 1;
  }
}
console.log('\n    failure kinds v1: ' + JSON.stringify(kinds.v1));
console.log('    failure kinds v2: ' + JSON.stringify(kinds.v2));

console.log('\n===== PER-GOAL =====');
console.log('  goal  stratum      op(v2)        v1        v2       oracle');
for (const g of GOALS) {
  const a = V1.get(g) || {}; const b = V2.get(g) || {}; const s = S.get(g);
  console.log('  [' + g + ']  ' + (s.stratum === 'FIM_ELIGIBLE' ? 'FIM     ' : 'fallback')
    + '  ' + String(b.operation || '').padEnd(13)
    + ' ' + (a.verified_goal_pass ? 'PASS' : 'fail').padEnd(9)
    + ' ' + (b.verified_goal_pass ? 'PASS' : 'fail').padEnd(8)
    + ' ' + s.oracle);
}
