// WHERE DOES THE OLD BEHAVIOUR FIRST BREAK?
//
// Inspecting the FINAL file of a failed 7/7 transaction cannot tell you which operation broke it. The
// harness evaluates the old regression suite after EVERY insertion, and the reference control proved
// every intermediate under this plan is green, so any PASS -> FAIL flip localises the defect to one
// tiny operation.
//
// The distinction this draws is architectural, not cosmetic:
//
//   FIRST_FAILING_SITE=k     one snippet is wrong, or site k's oracle instruction was insufficient.
//                            A local problem with a local fix.
//   CROSS_SITE_INTERACTION   every intermediate stays green and only the completed combination fails.
//                            Two individually plausible insertions both performing the same transition
//                            would look exactly like this. That is an EDIT-PLAN defect, not bad local
//                            code, and no amount of better snippet generation fixes it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
const rows = JSON.parse(readFileSync(join(DIR, 'rows.json'), 'utf8'))
  .filter((r) => r.condition === 'B_oracle_localized_insertion');

console.log('  FIRST-FAILING-SITE ANALYSIS   (preserved data, no new inference)\n');
const verdicts = [];
for (const r of rows) {
  const seq = r.steps.map((s) => (s.loads_after === false ? 'X'
    : s.old_regression_after === true ? 'G'
      : s.old_regression_after === false ? 'R' : '?'));
  let firstFlip = null;
  for (let i = 0; i < r.steps.length; i++) {
    const s = r.steps[i];
    if (s.loads_after === false) { firstFlip = { site: i + 1, kind: 'LOAD' }; break; }
    if (s.old_regression_after === false) { firstFlip = { site: i + 1, kind: 'OLD_REGRESSION' }; break; }
  }
  const completed = r.aborted_at === null;
  let verdict;
  if (r.verified) verdict = 'VERIFIED';
  else if (firstFlip) verdict = 'FIRST_FAILING_SITE=' + firstFlip.site + ' (' + firstFlip.kind + ')';
  else if (completed && r.final_old_regression === false) verdict = 'CROSS_SITE_INTERACTION';
  else if (completed && r.final_new_delta === false) verdict = 'PLAN_COMPLETED_DELTA_WRONG';
  else verdict = 'aborted: ' + String(r.why).slice(0, 40);
  verdicts.push({ goal: r.goal, seed: r.seed, verdict, sites: r.steps_completed + '/' + r.sites_total });

  console.log('  g' + r.goal + ' s' + String(r.seed).padEnd(3)
    + ' [' + seq.join('') + ']'.padEnd(10 - seq.length)
    + '  ' + (r.steps_completed + '/' + r.sites_total).padEnd(6) + verdict);
  if (firstFlip && firstFlip.kind === 'OLD_REGRESSION') {
    const s = r.steps[firstFlip.site - 1];
    console.log('        site ' + firstFlip.site + ' intent: ' + String(s.purpose).slice(0, 96));
    console.log('        it wrote: ' + String(s.snippet_head).slice(0, 96));
    if (s.bound_stopped_by) console.log('        bound stopped by: ' + s.bound_stopped_by
      + '  (dropped ' + s.bound_dropped_lines + ' lines, ' + s.bound_trimmed_bytes + ' bytes)');
  }
}

console.log('\n  legend  G = loads and old behaviour green   R = loads but old behaviour broke   X = does not load\n');
console.log('===== VERDICT TALLY =====');
const tally = new Map();
for (const v of verdicts) {
  const k = v.verdict.replace(/=\d+/, '=k').replace(/aborted:.*/, 'aborted');
  tally.set(k, (tally.get(k) || 0) + 1);
}
for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log('  ' + n + 'x  ' + k);

const flips = new Map();
for (const v of verdicts) {
  const m = v.verdict.match(/FIRST_FAILING_SITE=(\d+)/);
  if (m) flips.set(m[1], (flips.get(m[1]) || 0) + 1);
}
if (flips.size) {
  console.log('\n  where the chain first breaks, by site:');
  for (const [site, n] of [...flips].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log('    site ' + site + '  ' + n + ' trajector' + (n === 1 ? 'y' : 'ies'));
  }
}
const depth = {};
for (const r of rows) {
  const k = 'g' + r.goal;
  depth[k] = depth[k] || [];
  depth[k].push(r.steps_completed);
}
console.log('\n  transaction depth (sites completed) per goal:');
for (const [k, v] of Object.entries(depth)) {
  console.log('    ' + k + '  ' + v.slice().sort((a, b) => a - b).join(' ') + '   max ' + Math.max(...v));
}
