/**
 * fullAgent.mjs - a long unattended run against a REAL model.
 *
 *   MODEL_BASE=https://…modal.run node server/fullAgent.mjs [minutes]
 *
 * Everything else here replaces the model with a script I wrote, which means the harness
 * and its expectations share an author and agreement between them proves very little. A
 * real model does what it actually does. So this is a RUN, not a test: it reports what
 * happened and asserts almost nothing, because five of my harnesses lied today and every
 * one of them lied in the reassuring direction.
 *
 * Mixed goals on purpose - game and non-game alternating, so both planner branches run
 * repeatedly rather than once - and the supervisor TICK is on, which has never executed
 * against a real model: stale approvals denied, interrupted runs resumed, queued work
 * picked up while idle.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
if (!BASE) { console.error('set MODEL_BASE'); process.exit(2); }
const MINUTES = parseFloat(process.argv[2] || '45');
const PORT = 5500 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${PORT}/api`;

const dir = mkdtempSync(join(tmpdir(), 'fullagent-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: BASE, model: process.env.MODEL_NAME || 'mycoder' } },
  history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env, PORT: String(PORT), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: process.env.TRIAL_INDEX || join(dir, 'run-index.jsonl'),
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'yolo', HUB_TOKEN: '',
    AGENT_TICK_S: '30', AGENT_APPROVAL_TIMEOUT_MIN: '2',
    AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '10',
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let died = null;
hub.on('exit', (c, s) => { died = `code=${c} sig=${s}`; });
const log = [];
hub.stdout.on('data', (d) => log.push(d.toString()));
hub.stderr.on('data', (d) => log.push(d.toString()));

const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60_000) })).json();
for (let i = 0; i < 400; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

const GOALS = [
  // 30 YOLO trials. Chosen so the MODE actually matters: build auto-runs node/npm/python/git
  // and ASKS about anything else, so a batch that never reaches for an unfamiliar binary
  // would behave identically in both modes and prove nothing. These deliberately want real
  // dependencies, system tools and multi-step builds - the places where "unknown command"
  // comes up - while the denylist (rm -rf, git push, shutdown, curl|bash) stays in force.

  // --- real dependencies, installed and used ---
  'Create y1_dates.js that uses a date library from npm to format the current date as "Monday, 1 January 2026". Install what you need, then run it.',
  'Create y2_uuid.js that installs and uses a uuid package to print five unique ids. Run it.',
  'Create y3_color.js that installs a colour library and prints the hex value of "rebeccapurple". Run it.',
  'Add a second output to the EXISTING y1_dates.js showing the date in ISO form. Keep the existing output. Run it.',
  'Create y4_csv.js that installs a CSV parser, parses an inline CSV string of three rows, and prints the parsed objects. Run it.',

  // --- the toolchain itself ---
  'Print the versions of node, npm and python available in this workspace, then write y5_env.md recording exactly what you found.',
  'List every npm package currently installed in this workspace and write y6_deps.md naming each one and what it is for.',
  'Create y7_lint.js with deliberately messy formatting, then install a formatter and use it to reformat the file. Show the before and after.',
  'Create a package.json for this workspace with a "test" script that runs any q7 or y-prefixed check file that exists, then run npm test.',
  'Create y8_bench.js that times how long it takes to sum one million numbers, and run it three times reporting each result.',

  // --- data and files ---
  'Create y9_data.json with 20 records of {id, name, score}, then y10_top.js that reads it and prints the top 5 by score. Run it.',
  'Add a filter to the EXISTING y10_top.js so it only counts scores above 50. Keep the existing output. Run it.',
  'Create y11_words.txt with 200 words, then y12_count.js that reports the ten most common. Run it.',
  'Create y13_tree.js that prints the workspace file tree as indented text, and run it.',
  'Create y14_report.md summarising every .js file in the workspace: its name and what it does. Read them first.',

  // --- python alongside javascript ---
  'Create y15_stats.py that computes mean, median and stdev of [3,1,4,1,5,9,2,6] with asserts, and run it.',
  'Add a mode() function to the EXISTING y15_stats.py with an assert. Keep the rest. Run it.',
  'Create y16_bridge.js that runs y15_stats.py as a subprocess and prints its output. Run it.',
  'Create y17_json.py that writes a JSON file and y18_read.js that reads it back and prints it. Run both in order.',
  'Write Y_PY.md documenting every function that really exists in y15_stats.py. Read the file first.',

  // --- debugging under yolo ---
  'Create y19_bug.js with an off-by-one error in a function slice2(arr, n) plus a failing test. Run it and confirm it fails.',
  'Fix slice2 in the EXISTING y19_bug.js so its test passes. Run it to prove it.',
  'Create y20_async.js with an async function that resolves after 100ms, and a test that awaits it. Run it.',
  'Create y21_throw.js that demonstrates try/catch around a thrown Error, printing both paths. Run it.',
  'Create y22_perf.js comparing array push versus concat over 100k items, and report which wins. Run it.',

  // --- larger builds ---
  'Create y23_api.js: a tiny in-memory CRUD store with add/get/list/remove and a test at the bottom. Run it.',
  'Add update(id, patch) to the EXISTING y23_api.js, keeping the other operations. Verify all five.',
  'Add input validation to EVERY function in y23_api.js that lacks it. Keep the working logic. Verify.',
  'Create y24_cli.js that takes a command line argument and prints a greeting, then run it with a sample argument.',
  'Write Y_API.md documenting every operation in y23_api.js including what each throws. Read the file first.',
];

console.log(`full agent run: ${MINUTES} min against ${BASE}`);
console.log(`workspace ${ws}\n`);

let prev = null;
for (const goal of GOALS) {
  const r = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) });
  prev = r.item?.id || r.id;
}
const kicked = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: (await api('/agent/queue')).items[0].id }) }).catch(() => null);
if (!kicked || (!kicked.runId && !kicked.ok)) await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOALS[0] }) });

const t0 = Date.now(), end = t0 + MINUTES * 60_000;
console.log('  mins  queue(done/open)  runs(done/other)  files  rss(MB)  note');
let lastNote = '';
while (Date.now() < end && !died) {
  await new Promise((r) => setTimeout(r, 30_000));
  try {
    const q = await api('/agent/queue');
    const items = q.items || [];
    const done = items.filter((i) => i.status === 'done').length;
    // 'stopped' is TERMINAL. Counting it as open made this sampler wait out its entire
    // deadline on a goal that had already failed and been repaired - seventeen minutes of
    // an idle GPU reported as "still working".
    const open = items.filter((i) => !['done', 'failed', 'cancelled', 'stopped'].includes(i.status)).length;
    const list = await api('/agent/list');
    const runs = Array.isArray(list) ? list : [];
    const rdone = runs.filter((r) => r.status === 'done').length;
    const files = existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git').length : 0;
    const txt = log.join('');
    const notes = txt.match(/(treated as DENIED|Resumed automatically|supervisor picked up a queued goal)/g) || [];
    const note = notes.length ? `${notes.length} tick action(s): ${[...new Set(notes)].join(' / ')}` : '';
    if (note !== lastNote && note) { lastNote = note; }
    console.log(`  ${String(((Date.now() - t0) / 60000).toFixed(1)).padStart(4)}  ${String(done + '/' + open).padStart(16)}  ${String(rdone + '/' + (runs.length - rdone)).padStart(16)}  ${String(files).padStart(5)}  ${String(process.memoryUsage ? '-' : '-').padStart(7)}  ${note}`);
    if (!open) { console.log('\n  ALL GOALS COMPLETE'); break; }
  } catch (e) { console.log(`  (sample failed: ${e.message.slice(0, 60)})`); }
}

const txt = log.join('');
const rates = (txt.match(/= ([0-9.]+) tok\/s/g) || []).map((m) => parseFloat(m.match(/[0-9.]+/)[0]));
const prompts = (txt.match(/prompt ~([0-9]+) tok/g) || []).map((m) => parseInt(m.match(/[0-9]+/)[0], 10));
console.log('\n--- result ---');
console.log('hub:', died ? 'DIED ' + died : 'alive');
const q = await api('/agent/queue').catch(() => ({ items: [] }));
console.log('queue:', (q.items || []).map((i) => i.status).join(', ') || '(empty)');
const list = await api('/agent/list').catch(() => []);
console.log('runs:', (Array.isArray(list) ? list : []).map((r) => r.status).join(' -> '));
console.log('files:', existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git').join(', ') : '(none)');
if (rates.length) console.log(`tok/s: min ${Math.min(...rates)} max ${Math.max(...rates)} n=${rates.length}`);
if (prompts.length) console.log(`prompt tokens: max ${Math.max(...prompts)}`);
for (const k of ['treated as DENIED', 'Resumed automatically', 'supervisor picked up a queued goal']) {
  console.log(`tick "${k}": ${(txt.match(new RegExp(k, 'g')) || []).length}`);
}
hub.kill();
