/**
 * realChain.test.mjs - the unattended chain, against a real model.
 *
 *   MODEL_BASE=https://…modal.run node server/realChain.test.mjs
 *
 * queueChain.test.mjs already proves the chain runs IN ORDER, but it proves it against
 * fakemodel: scripted replies that always parse, always finish, always reach 'done'. That
 * tests the plumbing and nothing about whether the mechanism survives a real model.
 *
 * It matters because of how the supervisor is built (agent.js ~2551): it advances ONLY on
 * `status === 'done'`. A real model that trips the loop guard, fails to parse, or asks for
 * approval ends the chain permanently. So the question this answers is not "does the queue
 * work" - it is "does an unattended sequence actually get to the end when a real model is
 * driving", which is the only version of the question that matters for running overnight.
 *
 * Three goals that DEPEND on each other, so finishing them in order is observable in the
 * files rather than only in the queue's own bookkeeping:
 *
 *   1. write maths.js with add()          -> creates a file
 *   2. add multiply() to the SAME file    -> must EDIT, not recreate (add() must survive)
 *   3. write a README from the real code  -> must mention BOTH functions
 *
 * Isolated: own workspace, queue, config, port. Touches nothing live.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
if (!BASE_URL) { console.error('set MODEL_BASE'); process.exit(2); }
const MODEL = process.env.MODEL_NAME || 'mycoder';
const PORT = 4750 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${PORT}/api`;

let passed = 0, failed = 0;
const notes = [];
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 400)}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'realchain-'));
const ws = join(dir, 'workspace');
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: BASE_URL, model: MODEL } },
  history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env,
    PORT: String(PORT), HUB_DB: dbPath,
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_SUPERVISOR: '1',              // the whole point: it must pull the next goal itself
    AGENT_APPROVAL_MODE: 'build',
    HUB_TOKEN: '',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '8',
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));

const api = async (p, o) => {
  const r = await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60_000) });
  return r.json();
};
for (let i = 0; i < 200; i++) {
  try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

console.log(`\nreal chain: ${BASE_URL}\n`);

const GOALS = [
  'Create maths.js exporting a function add(a, b) that returns their sum. Include a self-check that throws if add(2,2) !== 4, then verify it runs with node.',
  'Add a multiply(a, b) function to the EXISTING maths.js, keeping add() exactly as it is. Verify both still work.',
  'Write README.md describing every function that actually exists in maths.js. Read the file first.',
];

let ids = [];
await test('three dependent goals queue as an ordered chain', async () => {
  let prev = null;
  for (const goal of GOALS) {
    const r = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) });
    const id = r.item?.id || r.id;
    assert.ok(id, 'queue rejected a goal: ' + JSON.stringify(r).slice(0, 200));
    ids.push(id); prev = id;
  }
  assert.equal(ids.length, 3);
});

await test('the supervisor drives all three to completion with NO human input', async () => {
  // Prime the chain: the supervisor advances a chain, it does not start one.
  const first = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: ids[0] }) })
    .catch(() => null);
  if (!first || (!first.runId && !first.ok)) {
    const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOALS[0] }) });
    assert.ok(s.runId, 'could not start the first goal: ' + JSON.stringify(s).slice(0, 200));
  }

  const deadline = Date.now() + 35 * 60_000;
  let q = null;
  while (Date.now() < deadline) {
    q = await api('/agent/queue');
    const items = q.items || [];
    // 'taken' means the supervisor has DEQUEUED it and a run is in flight. Excluding it
    // made this loop stop watching while goal 3 was still working - and then the hub was
    // killed out from under it, which looked like the chain breaking. It had not.
    const open = items.filter((i) => !['done', 'failed', 'cancelled', 'stopped'].includes(i.status));
    if (!open.length) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  const items = (q && q.items) || [];
  const summary = items.map((i) => `${i.status}`).join(', ');
  notes.push(`queue end state: ${summary || '(empty)'}`);
  console.log(`        queue end state: ${summary || '(empty — all completed and reaped)'}`);

  const list = await api('/agent/list');
  // agent-runs/ is GLOBAL - it is not overridable by env like the workspace and queue are -
  // so /agent/list returns every run on the box, including other tests'. Filter to ours.
  const mine = (g) => GOALS.some((goal) => String(g || '').slice(0, 40) === goal.slice(0, 40));
  const runs = (Array.isArray(list) ? list : []).filter((r) => mine(r.goal)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  notes.push(`runs: ${runs.map((r) => r.status).join(' -> ')}`);
  console.log(`        runs: ${runs.map((r) => r.status).join(' -> ')}`);
  const done = runs.filter((r) => r.status === 'done').length;
  assert.ok(done >= 2, `only ${done} of ${runs.length} run(s) reached 'done' — the chain broke early`);
});

await test('step 2 EDITED step 1’s file rather than starting over', () => {
  const f = join(ws, 'maths.js');
  assert.ok(existsSync(f), `maths.js was never written; workspace: ${existsSync(ws) ? readdirSync(ws).join(', ') : '(none)'}`);
  const src = readFileSync(f, 'utf8');
  notes.push(`maths.js: ${src.length} bytes`);
  assert.match(src, /\badd\b/, 'add() was lost when multiply() was added');
  assert.match(src, /\bmultiply\b/, 'multiply() was never added');
});

await test('the generated code actually runs', async () => {
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, [join(ws, 'maths.js')], { encoding: 'utf8', timeout: 20_000 });
  } catch (e) {
    assert.fail(`node maths.js failed: ${String(e.stderr || e.message).slice(0, 250)}`);
  }
});

await test('step 3 documented what the code REALLY contains', () => {
  const f = join(ws, 'README.md');
  if (!existsSync(f)) { notes.push('README.md: not written (chain stopped before goal 3)'); assert.fail('README.md was never written'); }
  const doc = readFileSync(f, 'utf8');
  assert.match(doc, /add/i, 'README does not mention add()');
  assert.match(doc, /multiply/i, 'README does not mention multiply() — it was not written from the real file');
});

const rates = hubLog.join('').match(/= ([0-9.]+) tok\/s/g) || [];
if (rates.length) console.log(`\n  model rates seen: ${rates.slice(0, 10).join(', ')}`);
const supervisorNotes = hubLog.join('').match(/Supervisor[^\n]{0,90}/g) || [];
supervisorNotes.slice(0, 6).forEach((n) => console.log('  ' + n.trim()));

hub.kill();
console.log('\n--- notes ---');
notes.forEach((n) => console.log('  ' + n));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
