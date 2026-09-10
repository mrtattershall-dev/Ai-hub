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
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'),
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_TICK_S: '30', AGENT_APPROVAL_TIMEOUT_MIN: '2',
    AGENT_MAX_STEPS: '25', AGENT_MAX_MINUTES: '8',
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
  // Harder than the last set: eight goals, mixed domains, and several that no single tool
  // solves cleanly - appends, a real mid-file edit, a multi-site change, and a game.
  'Create vec.js exporting add(a, b) for {x,y} vectors, with a self-check that throws if add({x:1,y:2},{x:3,y:4}) is wrong. Verify with node.',
  'Add sub(a, b) to the EXISTING vec.js, keeping add exactly as it is. Verify both.',
  'Add len(v) returning the magnitude of a {x,y} vector to the EXISTING vec.js. Keep add and sub unchanged. Verify all three.',
  'Change add(a, b) in the EXISTING vec.js so it throws a clear Error if either argument is missing x or y. Keep sub and len untouched. Verify.',
  'Add input validation to EVERY function in vec.js that does not already have it, so each throws a clear Error on bad input. Do not change the working maths. Verify.',
  'Write VEC.md documenting every function that really exists in vec.js, including what each throws. Read the file first.',
  'Add a "Examples" section to the EXISTING VEC.md with a runnable snippet per function, keeping the existing text.',
  'Build a Phaser 3 game in index.html: use list_assets to find a player sprite, load it by EXACT path, arrow-key movement. Test it in the browser.',
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
    const open = items.length - done;
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
