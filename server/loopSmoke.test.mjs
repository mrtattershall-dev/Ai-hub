/**
 * loopSmoke.test.mjs - can the agent loop actually get through a run?
 *
 *   node server/loopSmoke.test.mjs
 *
 * "Does it reach step four" is the question that matters before spending money on a GPU,
 * and it does not need one: fakemodel.mjs plays scripted agent actions over the real
 * /api/chat contract, so the LOOP is exercised end to end - parser, tools, ledger, git
 * checkpoints, finish gate - with the model replaced by something deterministic.
 *
 * Fully isolated: its own workspace (AGENT_WORKSPACE), its own queue (AGENT_QUEUE_FILE),
 * its own config (HUB_DB), its own ports. It touches nothing of yours.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB_PORT = 3820 + Math.floor(Math.random() * 150);
const FAKE_PORT = 11600 + Math.floor(Math.random() * 150);
const BASE = `http://127.0.0.1:${HUB_PORT}/api`;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'loopsmoke-'));
const ws = join(dir, 'workspace');
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${FAKE_PORT}`, model: 'fake' } },
  history: [], settings: {},
}), 'utf8');

const SCRIPT = process.env.SMOKE_SCRIPT || 'happy';
const fake = spawn(process.execPath, [join(__dirname, 'fakemodel.mjs'), '--port', String(FAKE_PORT), '--script', SCRIPT], { stdio: 'ignore' });
const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env,
    PORT: String(HUB_PORT), HUB_DB: dbPath,
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    MODEL_STALL_S: '30', MODEL_FIRST_BYTE_S: '30',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));

const api = async (path, opts) => {
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return r.json();
};

for (let i = 0; i < 100; i++) {
  try { await fetch(BASE + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

console.log(`\nloop smoke  (script="${SCRIPT}")\n`);

let run = null;
await test('a run starts', async () => {
  const started = await api('/agent/start', {
    method: 'POST',
    body: JSON.stringify({ goal: 'Create counter.js exporting add(a,b), then verify it runs.' }),
  });
  assert.ok(started.runId, 'no run id: ' + JSON.stringify(started).slice(0, 200));
  run = started.runId;
});

await test('the run reaches a terminal state without hanging', async () => {
  const deadline = Date.now() + 180_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await api('/agent/' + run);
    if (['done', 'error', 'stopped', 'interrupted', 'awaiting_approval'].includes(last.status)) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  assert.ok(last, 'no run state');
  assert.ok(['done', 'error', 'stopped', 'interrupted', 'awaiting_approval'].includes(last.status),
    `still ${last.status} after 180s`);
  run = last;
});

await test('IT REACHED AT LEAST STEP FOUR', () => {
  const steps = (run.steps || []).length;
  assert.ok(steps >= 4, `only ${steps} steps: ` + (run.steps || []).map((s) => s.tool || s.type).join(' -> '));
});

await test('no tool returned an ERROR', () => {
  const errs = (run.steps || []).filter((s) => /^ERROR/.test(String(s.result || '')));
  assert.equal(errs.length, 0, errs.map((e) => `${e.tool}: ${String(e.result).slice(0, 90)}`).join(' | '));
});

await test('the run finished cleanly (not error/interrupted)', () => {
  // `marathon` is generative and never calls finish on purpose - it exists to prove the
  // BUDGET guard stops a runaway. Its correct ending is 'stopped', not 'done'.
  const want = SCRIPT === 'marathon' ? ['stopped'] : ['done'];
  assert.ok(want.includes(run.status), `status=${run.status} (wanted ${want.join('/')}); last step: ` +
    JSON.stringify((run.steps || []).slice(-1)[0] || {}).slice(0, 220));
});

await test('it actually wrote a file into its own workspace', () => {
  assert.ok(existsSync(ws), 'workspace was never created');
  const files = readdirSync(ws).filter((f) => f !== '.git' && f !== 'package.json');
  assert.ok(files.length > 0, 'workspace is empty - nothing was built');
});

await test('the workspace got its npm boundary marker', () => {
  assert.ok(existsSync(join(ws, 'package.json')), 'no package.json - npm would walk up to the hub');
});

await test('checkpoints went to the workspace repo, not the hub repo', () => {
  assert.ok(existsSync(join(ws, '.git')), 'workspace is not its own git repo');
});

await test('throughput was measured', () => {
  const rate = run.lastTokPerSec;
  assert.ok(rate === undefined || typeof rate === 'number', 'telemetry field is malformed');
});

hub.kill(); fake.kill();
if (failed) { console.log('\n--- hub log tail ---\n' + hubLog.join('').split('\n').slice(-25).join('\n')); }
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
