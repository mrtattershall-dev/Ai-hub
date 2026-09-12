/**
 * compare-setH.mjs - the four-arm comparison, judged against the predictions committed BEFORE the window.
 *
 *   node tools/compare-setH.mjs                      (all arms found in the set H directory)
 *
 * tatte: "Take the four data sheets and compare and do offline checks with said data".
 *
 * Set H is an A/B on the HUB: {14B, 30B} x {control = main, treatment = eaa70c1}. Goals and checker are byte-identical
 * across all four arms, so any difference is the hub or run-to-run noise - and this prints the noise estimate first,
 * because without it none of the other numbers can be called real. Set G's lesson was that a score can stay flat while
 * the binding constraint moves, so this reports work-on-disk and the countable corruption checks alongside the score,
 * and never reports status counts as if they were results.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const D = join(HERE, '..');
const ARMS = [
  { label: 'coder14b-sethctl', model: '14B', hub: 'control  (main)' },
  { label: 'coder14b-sethfix', model: '14B', hub: 'treatment(eaa70c1)' },
  { label: 'coder30b-sethctl', model: '30B', hub: 'control  (main)' },
  { label: 'coder30b-sethfix', model: '30B', hub: 'treatment(eaa70c1)' },
];
// Set G, for the replication band. Recovered 2026-09-12 from the completed analysis; the artefact had been committed
// empty, which is why this is written down here rather than read from a file that once lied about it.
const SETG = {
  'coder14b': { run: 58, impl: 4, wrote: 6, end: 4, regressed: 2 },
  'coder30b': { run: 78, impl: 29, wrote: 33, end: 29, regressed: 6 },
};

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-');

/** Duplicated definitions in a kept workspace - prediction 4, and it does not depend on the score moving at all. */
function duplicateDefs(wsDir) {
  if (!existsSync(wsDir)) return null;
  const out = [];
  for (const f of readdirSync(wsDir)) {
    if (!/\.(c|m)?js$|\.py$/i.test(f)) continue;
    const full = join(wsDir, f);
    let src = '';
    try { if (statSync(full).isFile()) src = readFileSync(full, 'utf8'); } catch { continue; }
    const lines = src.split('\n').length;
    const counts = new Map();
    // Deliberately matches INDENTED definitions too: every duplicate in set G was an indented class method or a
    // Python method, which is exactly why duplicateDecls.js (anchored at column 0) saw none of them.
    const pats = [
      /^[ \t]*def[ \t]+([A-Za-z_]\w*)[ \t]*\(/gm,          // python, any indent
      /^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/gm,
      /^[ \t]+(?:async[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*\([^)]*\)[ \t]*\{/gm,   // class methods
      /^[ \t]*class[ \t]+([A-Za-z_$][\w$]*)/gm,
    ];
    // The class-method pattern also matches `if (...) {`, `for (...) {`, and test-DSL calls like `it(...) {`. A first
    // draft skipped those names for every pattern EXCEPT the one that produces them, so the output led with `for x292`
    // and `if x35` and buried the real signal - a reader could conclude "no duplicates" from a wall of noise. Skip them
    // everywhere. `constructor` is deliberately NOT skipped: duplicate constructors ARE the corruption (set G left
    // s3_matrix.js with 27 of them), so excluding it would hide the clearest evidence there is.
    const NOISE = /^(if|for|while|switch|catch|return|else|do|try|with|it|describe|test|expect|before|after|beforeEach|afterEach|beforeAll|afterAll)$/;
    for (const re of pats) for (const m of src.matchAll(re)) {
      const name = m[1];
      if (NOISE.test(name)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
    if (dupes.length) out.push({ file: f, lines, dupes: dupes.slice(0, 6), worst: dupes[0][1] });
  }
  return out.sort((a, b) => b.worst - a.worst);
}

const rows = [];
for (const arm of ARMS) {
  const checks = readJson(join(D, `${arm.label}-checks.json`));
  const log = existsSync(join(D, `${arm.label}-setH.log`)) ? readFileSync(join(D, `${arm.label}-setH.log`), 'utf8') : '';
  const goalLines = [...log.matchAll(/^\s+(\d+)\s+(\S+)\s/gm)];
  const statuses = {};
  for (const m of goalLines) statuses[m[2]] = (statuses[m[2]] || 0) + 1;
  const results = checks?.results || [];
  const impl = results.filter((r) => r.impl).length;
  const asIs = results.filter((r) => r.asIs).length;
  const ws = join(D, 'data', arm.label, 'workspace');
  rows.push({ ...arm, attempted: goalLines.length, statuses, impl, asIs, total: results.length || 100,
    dupes: duplicateDefs(ws), present: !!checks });
}

console.log('\n═══ SET H - four arms, one variable (the hub) ═══\n');
console.log('  goals-H.json sha 1f29e971e72f9461 and checks-H.mjs sha ea0d8b53535313ef are byte-identical to set G and set F.\n');
console.log('  arm                 model  hub                 attempted  impl-correct  as-asked   done/stopped');
for (const r of rows) {
  if (!r.present) { console.log(`  ${r.label.padEnd(19)} ${r.model.padEnd(6)} ${r.hub.padEnd(19)} (no checks file yet - arm not finished)`); continue; }
  const ds = `${r.statuses.done || 0}/${r.statuses.stopped || 0}`;
  console.log(`  ${r.label.padEnd(19)} ${r.model.padEnd(6)} ${r.hub.padEnd(19)} ${String(r.attempted).padStart(9)}  ${String(r.impl).padStart(12)}  ${String(r.asIs).padStart(8)}   ${ds.padStart(12)}`);
}

console.log('\n─── PREDICTION 1 + 2: does the control replicate set G, and what is the run-to-run spread? ───');
for (const m of ['coder14b', 'coder30b']) {
  const ctl = rows.find((r) => r.label === `${m}-sethctl`);
  const g = SETG[m];
  if (!ctl?.present) { console.log(`  ${m}: control not finished yet`); continue; }
  const dImpl = ctl.impl - g.impl, dRun = ctl.attempted - g.run;
  console.log(`  ${m}: set G ${g.impl}/${g.run} attempted -> set H control ${ctl.impl}/${ctl.attempted} attempted`
    + `   (impl ${dImpl >= 0 ? '+' : ''}${dImpl}, attempted ${dRun >= 0 ? '+' : ''}${dRun})`);
  console.log(`    => THE SPREAD BETWEEN TWO RUNS OF THE SAME HUB ON THE SAME GOALS IS ${Math.abs(dImpl)} on impl and ${Math.abs(dRun)} on attempted.`);
  console.log('       No arm-to-arm difference smaller than that may be called real.');
  console.log('       MEASURED 2026-09-12 and the two metrics differ sharply: score moved 1 point (30B) and 2 (14B),');
  console.log('       but ATTEMPTED moved 19 (30B) and 8 (14B) on byte-identical configurations. So a treatment arm');
  console.log('       attempting 10-15 more goals than its control is INSIDE the noise and proves nothing; a 2+ point');
  console.log('       score move on the 30B is outside it. See measured-variance.txt.');
}

console.log('\n─── PREDICTION 3: does the treatment attempt MORE goals? (the repeats were the budget) ───');
for (const m of ['coder14b', 'coder30b']) {
  const c = rows.find((r) => r.label === `${m}-sethctl`), t = rows.find((r) => r.label === `${m}-sethfix`);
  if (!c?.present || !t?.present) { console.log(`  ${m}: needs both arms finished`); continue; }
  const d = t.attempted - c.attempted;
  // The pre-registration said "75+ of 100". That threshold was fixed BEFORE the controls measured how noisy this
  // quantity is: goals-attempted moved 19 on the 30B and 8 on the 14B between byte-identical runs. A flat 75 would
  // therefore print FAILED for a treatment arm that beat its control by 20, and HELD for one that lost by 3. Both
  // readings would be wrong, so the verdict is against the arm's OWN control plus the measured spread. The original
  // number is still printed, because changing the test after seeing the data is only honest if it is visible.
  const SPREAD = m === 'coder30b' ? 19 : 8;
  const verdict = d > SPREAD ? 'HELD (beat its control by more than the measured spread)'
    : d < -SPREAD ? 'CONTRADICTED (attempted materially FEWER)'
    : 'INSIDE THE NOISE - proves nothing either way';
  console.log(`  ${m}: control attempted ${c.attempted}, treatment attempted ${t.attempted}  (${d >= 0 ? '+' : ''}${d}, measured spread +/-${SPREAD})`);
  console.log(`       verdict: ${verdict}`);
  console.log(`       pre-registered threshold was 75+ of 100 -> ${t.attempted >= 75 ? 'met' : 'not met'} (recorded, but superseded by the spread)`);
}

console.log('\n─── PREDICTION 4: duplicated definitions in the kept workspace (does not need the score to move) ───');
for (const r of rows) {
  if (r.dupes === null) { console.log(`  ${r.label}: no kept workspace yet`); continue; }
  if (!r.dupes.length) { console.log(`  ${r.label}: NO duplicated definitions`); continue; }
  console.log(`  ${r.label}: ${r.dupes.length} file(s) with duplicates`);
  for (const d of r.dupes.slice(0, 4)) {
    console.log(`      ${d.file} (${d.lines} lines): ` + d.dupes.map(([n, c]) => `${n} x${c}`).join(', '));
  }
}

console.log('\n─── PREDICTION 5: read this before concluding anything ───');
console.log('  A flat score with more goals attempted and no corruption is NOT a failure: it says the ceiling is the');
console.log('  model rather than the tools, which is the answer the north star needs. Judge by the hidden checks against');
console.log('  the workspace and by the corruption counts above - never by done/stopped, which set G showed move');
console.log('  independently of the work on disk.\n');
