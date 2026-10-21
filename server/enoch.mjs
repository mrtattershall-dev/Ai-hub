/**
 * enoch.mjs - read back what the Watchers recorded.
 *
 *   node server/enoch.mjs            summary: spend, failure categories, who was at fault, recent verdicts
 *   node server/enoch.mjs <runId>    one run's full verdict
 *
 * Descriptive only. Each verdict is one reviewer's reading of one transcript; a category that dominates
 * here is a LEAD to reproduce (fuzz seed, re-run the goal), not yet a finding.
 */
import { readFileSync, existsSync } from 'node:fs';
import { enochPath } from './watchers.js';

const path = enochPath();
if (!existsSync(path)) { console.log(`Enoch is empty: nothing recorded yet at ${path}`); process.exit(0); }
const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const want = process.argv[2];
if (want) {
  const hits = rows.filter((r) => r.runId === want || r.runId?.startsWith(want));
  if (!hits.length) { console.log(`no record for run ${want}`); process.exit(1); }
  for (const r of hits) console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

const cap = parseFloat(process.env.WATCHERS_BUDGET_USD || '10');
const spent = rows.reduce((s, r) => s + (r.costUsd || 0), 0);
const reviewed = rows.filter((r) => r.verdict);
const count = (xs) => Object.entries(xs.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const bar = (n, of) => '#'.repeat(Math.round((n / Math.max(of, 1)) * 30));

console.log(`ENOCH - ${path}`);
console.log(`spent $${spent.toFixed(4)} of $${cap} | ${reviewed.length} verdicts | ${rows.filter((r) => r.skipped).length} skipped | ${rows.filter((r) => r.error).length} errors`);
if (reviewed.length) console.log(`average $${(spent / reviewed.length).toFixed(4)} per verdict -> ~${Math.floor((cap - spent) / (spent / reviewed.length))} more at this rate`);

const section = (title, pairs, of) => {
  console.log(`\n${title}`);
  for (const [k, n] of pairs) console.log(`  ${k.padEnd(20)} ${String(n).padStart(4)}  ${bar(n, of)}`);
};
if (reviewed.length) {
  section('PRIMARY FAILURE CATEGORY', count(reviewed.map((r) => r.verdict.failure_category)), reviewed.length);
  section('ALSO PRESENT', count(reviewed.flatMap((r) => r.verdict.secondary_categories || [])), reviewed.length);
  section('AT FAULT', count(reviewed.map((r) => r.verdict.at_fault)), reviewed.length);
  section('OUTCOME (reviewer) vs STATUS (hub)', count(reviewed.map((r) => `${r.verdict.outcome} / ${r.status}`)), reviewed.length);
  const falseDone = reviewed.filter((r) => r.status === 'done' && r.verdict.goal_met !== 'yes');
  if (falseDone.length) console.log(`\n  ${falseDone.length} run(s) the hub marked done where the reviewer says the goal was not met`);
}

const errs = rows.filter((r) => r.error || r.skipped).slice(-5);
if (errs.length) {
  console.log('\nRECENT SKIPS / ERRORS');
  for (const r of errs) console.log(`  ${r.at.slice(0, 19)} ${String(r.runId).slice(0, 8)} ${r.error || r.skipped}`);
}

console.log('\nRECENT VERDICTS');
for (const r of reviewed.slice(-8)) {
  const v = r.verdict;
  console.log(`  ${r.at.slice(0, 19)} ${String(r.runId).slice(0, 8)} [${v.failure_category}/${v.at_fault}/${v.confidence}] step ${v.first_failure_step ?? '-'} $${(r.costUsd || 0).toFixed(4)}`);
  console.log(`    goal: ${String(r.goal).slice(0, 90)}`);
  console.log(`    why:  ${String(v.why).slice(0, 160)}`);
}
