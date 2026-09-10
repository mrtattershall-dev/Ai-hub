/**
 * runIndex.mjs - read the run index: what happened, and is it getting better?
 *
 *   node server/runIndex.mjs              recent runs + totals
 *   node server/runIndex.mjs --trend      compare the oldest half against the newest
 *   node server/runIndex.mjs --errors     every distinct failure, by cost
 *   node server/runIndex.mjs --n 50       how many recent runs to show
 *
 * Written because the four biggest findings of 2026-09-10 - 25 model calls wasted on one
 * bad error message, a 26:13 rewrite-to-create ratio, 29 ledger tasks from one plan, an
 * 11.3% error rate - all came from hand-mining run files that the 40-run cap was busy
 * deleting. None of it was visible from inside the product. A run costs money and takes
 * minutes; the record of it costs a few hundred bytes and is the only way to know whether
 * a change helped.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.RUN_INDEX || join(__dirname, 'run-index.jsonl');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const N = parseInt((argv[argv.indexOf('--n') + 1] || '20'), 10);

if (!existsSync(FILE)) {
  console.log(`no run index yet at ${FILE}\nIt fills up as runs finish — one line each.`);
  process.exit(0);
}
const runs = readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
if (!runs.length) { console.log('run index is empty'); process.exit(0); }

const sum = (rs, f) => rs.reduce((a, r) => a + (f(r) || 0), 0);
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '—');
const agg = (rs) => {
  const calls = sum(rs, (r) => r.calls);
  const errs = sum(rs, (r) => r.errorCount);
  const status = {};
  for (const r of rs) status[r.status] = (status[r.status] || 0) + 1;
  const rates = rs.map((r) => r.tokPerSec?.max).filter(Boolean);
  return {
    n: rs.length, calls, errs, errRate: pct(errs, calls),
    done: pct(status.done || 0, rs.length),
    medCalls: rs.length ? [...rs].map((r) => r.calls).sort((a, b) => a - b)[Math.floor(rs.length / 2)] : 0,
    tok: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    promptMax: Math.max(0, ...rs.map((r) => r.promptMax || 0)),
  };
};

if (flag('errors')) {
  const all = new Map();
  for (const r of runs) for (const [k, v] of Object.entries(r.errors || {})) all.set(k, (all.get(k) || 0) + v);
  console.log(`\nevery distinct failure across ${runs.length} runs, by wasted model calls:\n`);
  [...all].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}x  ${k}`));
  process.exit(0);
}

if (flag('trend')) {
  const half = Math.floor(runs.length / 2);
  const a = agg(runs.slice(0, half)), b = agg(runs.slice(half));
  console.log(`\nOLDEST ${a.n} runs  ->  NEWEST ${b.n} runs\n`);
  const row = (label, x, y) => console.log(`  ${label.padEnd(22)} ${String(x).padStart(10)}  ->  ${String(y).padStart(10)}`);
  row('completed', a.done, b.done);
  row('error rate (of calls)', a.errRate, b.errRate);
  row('median calls per run', a.medCalls, b.medCalls);
  row('avg peak tok/s', a.tok ?? '—', b.tok ?? '—');
  row('largest prompt (tok)', a.promptMax || '—', b.promptMax || '—');
  process.exit(0);
}

const recent = runs.slice(-N);
console.log(`\nlast ${recent.length} of ${runs.length} runs\n`);
console.log('  when         status     calls  errs  tok/s   goal');
for (const r of recent) {
  const when = new Date(r.ts).toISOString().slice(5, 16).replace('T', ' ');
  const tok = r.tokPerSec ? String(Math.round(r.tokPerSec.max)) : '—';
  console.log(`  ${when}  ${String(r.status).padEnd(9)} ${String(r.calls).padStart(5)} ${String(r.errorCount).padStart(5)}  ${tok.padStart(5)}   ${String(r.goal).slice(0, 46)}`);
}
const a = agg(runs);
console.log(`\ntotals: ${a.n} runs, ${a.calls} model calls, ${a.errs} failed steps (${a.errRate} of calls), ${a.done} completed`);
const all = new Map();
for (const r of runs) for (const [k, v] of Object.entries(r.errors || {})) all.set(k, (all.get(k) || 0) + v);
if (all.size) {
  console.log('\ntop failures (each one is a wasted model call):');
  [...all].sort((x, y) => y[1] - x[1]).slice(0, 5).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`));
}
