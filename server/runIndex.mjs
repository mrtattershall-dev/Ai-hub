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

// Four fields in the record are shaped differently from how a reader wants to use them,
// and three of them are objects. Reach for the wrong one and the output says
// "[object Object]" or "NaN" where a number belongs — which is worse than no number,
// because it still lines up in the column and still looks like a reading:
//   errorCount    the count. `errors` is an OBJECT {kind: count} — sum it only when the
//                 record predates errorCount, and never print it where a number goes.
//   errorSamples  {kind: {tool, args}} — objects all the way down, see sampleLine().
//   tokPerSec     {min, max}, or null, or (older lines) a bare number. Not a number now.
//   calls         the model-call count. agent.js renames run.modelCalls to `calls` on the
//                 way out, but accept either so an older or hand-made line still counts.
// Every read of these goes through the accessors below, so when the writer changes shape
// again there is exactly one place to fix rather than six call sites to re-audit.
const callsOf = (r) => Number(r.calls ?? r.modelCalls) || 0;
const errorsOf = (r) => (r.errors && typeof r.errors === 'object' ? r.errors : {});
const errorCountOf = (r) => (typeof r.errorCount === 'number'
  ? r.errorCount
  : Object.values(errorsOf(r)).reduce((a, b) => a + (Number(b) || 0), 0));
const peakTok = (r) => {
  const t = r.tokPerSec;
  if (typeof t === 'number') return t;                       // pre-{min,max} records
  return t && typeof t.max === 'number' ? t.max : null;      // null, not the object
};

// The verdicts that mean "this finish was never verified". finishKind is written by agent.js at the moment the status
// is (finishVerdict()); the values are its vocabulary, and a value this reader does not know is NOT treated as clean.
const UNVERIFIED = new Set(['forced', 'auto_clean_tests', 'unverified']);
const verdictOf = (r) => (r.finishKind ? (UNVERIFIED.has(r.finishKind) ? r.finishKind : 'ok') : '?');

const sum = (rs, f) => rs.reduce((a, r) => a + (f(r) || 0), 0);
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '—');
const agg = (rs) => {
  const calls = sum(rs, callsOf);
  const errs = sum(rs, errorCountOf);
  const status = {};
  for (const r of rs) status[r.status] = (status[r.status] || 0) + 1;
  const rates = rs.map(peakTok).filter((n) => n > 0);
  return {
    n: rs.length, calls, errs, errRate: pct(errs, calls),
    done: pct(status.done || 0, rs.length),
    // OF THE COMPLETED RUNS, HOW MANY WERE NEVER VERIFIED. "completed" on its own was the misleading number: a
    // forced finish and a test_web auto-finish both land on 'done', and the series exists to answer whether this is
    // getting better. Records written before finishKind landed have no verdict at all, so they are counted apart
    // rather than assumed clean - see finishVerdict() in agent.js.
    unverified: rs.filter((r) => UNVERIFIED.has(r.finishKind)).length,
    noVerdict: rs.filter((r) => r.status === 'done' && !r.finishKind).length,
    // callsOf, not r.calls: one record missing the field sorts NaN into the middle of the
    // list and the median silently becomes NaN for the whole half.
    medCalls: rs.length ? [...rs].map(callsOf).sort((a, b) => a - b)[Math.floor(rs.length / 2)] : 0,
    tok: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    promptMax: Math.max(0, ...rs.map((r) => r.promptMax || 0)),
  };
};

// errorSamples[kind] is {tool, args:{...}} — there is no string in it to print, so the
// only way to show one is to name its parts. Interpolating the sample (or its args) into
// a template gives "[object Object]", which is the whole reason this helper exists.
const sampleLine = (s) => {
  if (!s || typeof s !== 'object') return null;
  const args = s.args && typeof s.args === 'object'
    ? Object.entries(s.args).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
    : '';
  const one = [s.tool, args].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!one) return null;
  return one.length > 110 ? one.slice(0, 110) + '…' : one;
};

if (flag('errors')) {
  const all = new Map();
  const eg = new Map();   // first sample seen per kind — the call that actually failed
  for (const r of runs) {
    for (const [k, v] of Object.entries(errorsOf(r))) all.set(k, (all.get(k) || 0) + (Number(v) || 0));
    // The samples are recorded so a kind that reads like "the model keeps breaking"
    // turns into "look, the tool is wrong". They were being dropped on the floor here:
    // this command was printing the counts and nothing else.
    for (const [k, s] of Object.entries(r.errorSamples || {})) {
      if (!eg.has(k)) { const line = sampleLine(s); if (line) eg.set(k, line); }
    }
  }
  console.log(`\nevery distinct failure across ${runs.length} runs, by wasted model calls:\n`);
  [...all].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${String(v).padStart(4)}x  ${k}`);
    if (eg.has(k)) console.log(`        e.g. ${eg.get(k)}`);
  });
  process.exit(0);
}

if (flag('trend')) {
  const half = Math.floor(runs.length / 2);
  const a = agg(runs.slice(0, half)), b = agg(runs.slice(half));
  console.log(`\nOLDEST ${a.n} runs  ->  NEWEST ${b.n} runs\n`);
  const row = (label, x, y) => console.log(`  ${label.padEnd(22)} ${String(x).padStart(10)}  ->  ${String(y).padStart(10)}`);
  row('completed', a.done, b.done);
  // "completed" went UP in set G while the work got worse, because a forced finish counts as completed. Read the two
  // lines together or the trend is a lie.
  row('of those, unverified', a.unverified, b.unverified);
  row('  (no verdict recorded)', a.noVerdict, b.noVerdict);
  row('error rate (of calls)', a.errRate, b.errRate);
  row('median calls per run', a.medCalls, b.medCalls);
  row('avg peak tok/s', a.tok ?? '—', b.tok ?? '—');
  row('largest prompt (tok)', a.promptMax || '—', b.promptMax || '—');
  process.exit(0);
}

const recent = runs.slice(-N);
console.log(`\nlast ${recent.length} of ${runs.length} runs\n`);
console.log('  when         status    verdict            calls  errs  tok/s   goal');
for (const r of recent) {
  // LOCAL time, not UTC. This file exists to correlate what happened - with the runner's
  // output, with a hub log, with what you remember doing - and toISOString() printed 15:37
  // for a run that happened at 10:37 on the machine reading it. Five hours of mental
  // arithmetic on the one tool whose whole job is lining events up.
  const d = new Date(r.ts);
  const when = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
    + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // peakTok, not r.tokPerSec.max: a truthy tokPerSec that is a bare number (older lines)
  // has no .max, and Math.round(undefined) prints "NaN" in a column of real rates.
  const t = peakTok(r);
  const tok = t == null ? '—' : String(Math.round(t));
  console.log(`  ${when}  ${String(r.status).padEnd(9)} ${verdictOf(r).padEnd(17)} ${String(callsOf(r)).padStart(5)} ${String(errorCountOf(r)).padStart(5)}  ${tok.padStart(5)}   ${String(r.goal).slice(0, 46)}`);
}
const a = agg(runs);
console.log(`\ntotals: ${a.n} runs, ${a.calls} model calls, ${a.errs} failed steps (${a.errRate} of calls), ${a.done} completed`
  + `, of which ${a.unverified} never verified` + (a.noVerdict ? ` (${a.noVerdict} predate the verdict field)` : ''));
const all = new Map();
for (const r of runs) for (const [k, v] of Object.entries(errorsOf(r))) all.set(k, (all.get(k) || 0) + (Number(v) || 0));
if (all.size) {
  console.log('\ntop failures (each one is a wasted model call):');
  [...all].sort((x, y) => y[1] - x[1]).slice(0, 5).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`));
}
