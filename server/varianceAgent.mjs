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
  // THE SAME SIX SHAPES, FIVE TIMES EACH, with independent file prefixes.
  // Everything measured so far is n=1 per goal: we know the agent CAN do each shape,
  // not how OFTEN. For anything meant to run unattended that is the number that
  // matters - 100% and 60% look identical in a single successful demo.
  // Prefixes keep the repeats independent; repeating into the same files would
  // measure 'editing a bigger file' instead of consistency.
  'Create v1_calc.js exporting add(a,b), sub(a,b) and div(a,b). div throws on divide-by-zero. Include self-checks. Verify with node.',
  'Create v1_base.js exporting greet(name) that throws on non-string input, then ADD a farewell(name) function to that SAME file keeping greet unchanged. Verify both.',
  'Create v1_edit.js exporting scale(v, f) with no validation, then change ONLY scale so it throws when f is zero. Touch nothing else. Verify.',
  'Create v1_multi.js with three functions a(x), b(x), c(x) that each double their input, then add input validation to EVERY one of them. Keep the maths. Verify.',
  'Create v1_lib.js exporting one function, v1_use.js that imports and calls it, then run v1_use.js and make it pass.',
  'Create v1_docs.js exporting three named functions with distinct behaviour, then write v1_DOCS.md describing every function that really exists in it. Read the file first.',
  'Create v2_calc.js exporting add(a,b), sub(a,b) and div(a,b). div throws on divide-by-zero. Include self-checks. Verify with node.',
  'Create v2_base.js exporting greet(name) that throws on non-string input, then ADD a farewell(name) function to that SAME file keeping greet unchanged. Verify both.',
  'Create v2_edit.js exporting scale(v, f) with no validation, then change ONLY scale so it throws when f is zero. Touch nothing else. Verify.',
  'Create v2_multi.js with three functions a(x), b(x), c(x) that each double their input, then add input validation to EVERY one of them. Keep the maths. Verify.',
  'Create v2_lib.js exporting one function, v2_use.js that imports and calls it, then run v2_use.js and make it pass.',
  'Create v2_docs.js exporting three named functions with distinct behaviour, then write v2_DOCS.md describing every function that really exists in it. Read the file first.',
  'Create v3_calc.js exporting add(a,b), sub(a,b) and div(a,b). div throws on divide-by-zero. Include self-checks. Verify with node.',
  'Create v3_base.js exporting greet(name) that throws on non-string input, then ADD a farewell(name) function to that SAME file keeping greet unchanged. Verify both.',
  'Create v3_edit.js exporting scale(v, f) with no validation, then change ONLY scale so it throws when f is zero. Touch nothing else. Verify.',
  'Create v3_multi.js with three functions a(x), b(x), c(x) that each double their input, then add input validation to EVERY one of them. Keep the maths. Verify.',
  'Create v3_lib.js exporting one function, v3_use.js that imports and calls it, then run v3_use.js and make it pass.',
  'Create v3_docs.js exporting three named functions with distinct behaviour, then write v3_DOCS.md describing every function that really exists in it. Read the file first.',
  'Create v4_calc.js exporting add(a,b), sub(a,b) and div(a,b). div throws on divide-by-zero. Include self-checks. Verify with node.',
  'Create v4_base.js exporting greet(name) that throws on non-string input, then ADD a farewell(name) function to that SAME file keeping greet unchanged. Verify both.',
  'Create v4_edit.js exporting scale(v, f) with no validation, then change ONLY scale so it throws when f is zero. Touch nothing else. Verify.',
  'Create v4_multi.js with three functions a(x), b(x), c(x) that each double their input, then add input validation to EVERY one of them. Keep the maths. Verify.',
  'Create v4_lib.js exporting one function, v4_use.js that imports and calls it, then run v4_use.js and make it pass.',
  'Create v4_docs.js exporting three named functions with distinct behaviour, then write v4_DOCS.md describing every function that really exists in it. Read the file first.',
  'Create v5_calc.js exporting add(a,b), sub(a,b) and div(a,b). div throws on divide-by-zero. Include self-checks. Verify with node.',
  'Create v5_base.js exporting greet(name) that throws on non-string input, then ADD a farewell(name) function to that SAME file keeping greet unchanged. Verify both.',
  'Create v5_edit.js exporting scale(v, f) with no validation, then change ONLY scale so it throws when f is zero. Touch nothing else. Verify.',
  'Create v5_multi.js with three functions a(x), b(x), c(x) that each double their input, then add input validation to EVERY one of them. Keep the maths. Verify.',
  'Create v5_lib.js exporting one function, v5_use.js that imports and calls it, then run v5_use.js and make it pass.',
  'Create v5_docs.js exporting three named functions with distinct behaviour, then write v5_DOCS.md describing every function that really exists in it. Read the file first.',
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
