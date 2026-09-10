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
    // The hourly auto-start ceiling defaults to 12. It was added after a real runaway
    // (40 runs in 60 SECONDS) and it works, but it cannot tell "a loop repeating itself"
    // from "a lot of distinct work": at ~130 tok/s a goal takes ~20s, so 12/hour throttles
    // legitimate batches to one goal every five minutes. Measured just now - 13 goals in
    // five minutes hit the cap and 17 sat queued for the rest of the hour.
    // The runaway case is already covered by the generation cap and queue dedup.
    AGENT_MAX_AUTO_STARTS: process.env.AGENT_MAX_AUTO_STARTS || '400',
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
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
  // 30 trials spanning every shape the agent has to handle. Deliberately varied - running
  // one shape thirty times would only measure that shape. Ordered so later goals depend on
  // earlier ones, which is where the real difficulty lives.

  // --- create, in three languages ---
  'Create q1_math.js exporting add(a,b) and mul(a,b), throwing a clear Error on non-numeric input. Verify with node.',
  'Create q2_str.js exporting slug(s) and title(s), throwing on non-string input. Verify with node.',
  'Create q3_list.js exporting uniq(arr), flatten(arr) and chunk(arr,n). Verify with node.',
  'Create q4_time.py with a function humanize(seconds) returning "2m 3s" style strings, plus asserts at the bottom. Run it with python.',
  'Create q5_page.html: a plain HTML page with a heading, a button, and a counter that increments on click. Test it in the browser.',

  // --- append to what exists ---
  'Add sub(a,b) and div(a,b) to the EXISTING q1_math.js, keeping add and mul unchanged. div must throw on divide-by-zero. Verify.',
  'Add kebab(s) and snake(s) to the EXISTING q2_str.js, keeping the existing functions. Verify.',
  'Add zip(a,b) and range(n) to the EXISTING q3_list.js. Keep everything else. Verify.',
  'Add a clamp(v,lo,hi) function to the EXISTING q1_math.js. Keep everything else. Verify.',
  'Add five more helpers to the EXISTING q3_list.js: head, tail, last, compact, sum. Verify all of them.',

  // --- edit one specific place ---
  'In the EXISTING q1_math.js, change ONLY clamp so it throws when lo > hi. Touch nothing else. Verify.',
  'In the EXISTING q2_str.js, change ONLY slug so it strips punctuation as well as spaces. Touch nothing else. Verify.',
  'In the EXISTING q3_list.js, change ONLY chunk so it throws when n is less than 1. Touch nothing else. Verify.',
  'In the EXISTING q1_math.js, add a JSDoc comment above add and mul only. Do not change any code. Verify it still runs.',

  // --- edit in many places at once ---
  'Add input validation to EVERY function in q2_str.js that lacks it, so each throws a clear Error on bad input. Keep the working logic. Verify.',
  'Add input validation to EVERY function in q3_list.js that lacks it. Keep the working logic. Verify.',
  'Rename the function uniq to unique everywhere in q3_list.js, including any uses. Verify.',

  // --- multiple files that depend on each other ---
  'Create q6_index.js that re-exports everything from q1_math.js, q2_str.js and q3_list.js. Verify it loads with node.',
  'Create q7_check.js that imports from q6_index.js and asserts at least one function from each module works. Run it and make it pass.',
  'Update the EXISTING q6_index.js to also re-export the newest helpers, then run q7_check.js and fix anything that fails.',

  // --- debugging: make something that fails pass ---
  'Create q8_broken.js containing a function median(arr) that is WRONG for even-length arrays, plus a test at the bottom that fails. Run it and confirm it fails.',
  'Fix median in the EXISTING q8_broken.js so its own test passes. Run it to prove it.',
  'Create q9_slow.js with a function fib(n) written recursively, and a test that fib(25) is 75025. Run it.',
  'Rewrite fib in the EXISTING q9_slow.js to be iterative, keeping the same test passing. Run it.',

  // --- read the real code, then write about it ---
  'Write Q_MATH.md documenting every function that really exists in q1_math.js, including what each throws. Read the file first.',
  'Write Q_LIST.md documenting every function that really exists in q3_list.js. Read the file first.',
  'Add a "Gotchas" section to the EXISTING Q_MATH.md describing the error cases, keeping the existing text.',

  // --- a game, with real assets and browser verification ---
  'Build q10_game.html: a Phaser 3 game. Use list_assets to find a player sprite, load it by EXACT path, arrow-key movement. Test it in the browser.',
  'Add a score display to the EXISTING q10_game.html that increases when the player moves. Keep movement working. Test in the browser.',
  'Write Q_GAME.md describing what q10_game.html actually does: the controls, the asset paths it loads, and the scoring. Read the file first.',
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
