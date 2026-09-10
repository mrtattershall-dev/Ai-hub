/**
 * supervisorTick.test.mjs - the three ways an unattended chain dies.
 *
 *   node server/supervisorTick.test.mjs
 *
 * The supervisor advances only on status 'done'. Every OTHER terminal state is normal,
 * not exceptional - measured on real runs today: a refused command -> awaiting_approval,
 * a dropped socket -> interrupted, a loop guard or budget -> stopped. Each left the queue
 * full and the hub idle forever, because nothing polls.
 *
 * The riskiest thing here is the approval path, so it is tested first and hardest: an
 * unattended timeout must DENY, never approve. Auto-approving a command a human was asked
 * about would make the whole gate theatre - the gate exists precisely because nobody is
 * watching.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB = 5100 + Math.floor(Math.random() * 200);
const FAKE = 12100 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${HUB}/api`;

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${String(e.message).slice(0, 300)}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'tick-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${FAKE}`, model: 'fake' } }, history: [], settings: {},
}), 'utf8');

const fake = spawn(process.execPath, [join(__dirname, 'fakemodel.mjs'), '--port', String(FAKE), '--script', 'approval'], { stdio: 'ignore' });
const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env, PORT: String(HUB), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'run-index.jsonl'),
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'strict',   // strict => the command WILL ask
    AGENT_TICK_S: '15', AGENT_APPROVAL_TIMEOUT_MIN: '1',
    HUB_TOKEN: '', AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '5',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const log = [];
hub.stdout.on('data', (d) => log.push(d.toString()));
hub.stderr.on('data', (d) => log.push(d.toString()));
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(30_000) })).json();
for (let i = 0; i < 200; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

console.log('\nsupervisor tick\n');

test('the tick announced itself at boot (it is wired, not dead code)', () => {
  assert.match(log.join(''), /unattended tick every/i, 'no tick line in the boot log');
});

let runId = null;
await test('a run reaches awaiting_approval, as it should', async () => {
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'run a command that needs approval' }) });
  runId = s.runId;
  assert.ok(runId, 'no runId: ' + JSON.stringify(s).slice(0, 150));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const r = await api('/agent/' + runId);
    if (r.status === 'awaiting_approval') return;
    if (['done', 'error', 'stopped'].includes(r.status)) assert.fail(`ended ${r.status} without ever asking`);
    await new Promise((x) => setTimeout(x, 1000));
  }
  assert.fail('never reached awaiting_approval');
});

await test('a stale approval is DENIED by the tick, and the run moves on', async () => {
  const deadline = Date.now() + 180_000;
  let r = null;
  while (Date.now() < deadline) {
    r = await api('/agent/' + runId);
    if (r.status !== 'awaiting_approval') break;
    await new Promise((x) => setTimeout(x, 2000));
  }
  assert.notEqual(r.status, 'awaiting_approval', 'still blocked after the timeout - the chain would be dead');
  const denied = (r.steps || []).filter((s) => s.type === 'approval_denied');
  assert.ok(denied.length > 0, `no approval_denied step; states seen: ${(r.steps || []).map((s) => s.type).join(',')}`);
  console.log(`        run went ${r.status}; denial: ${String(denied[0].text || '').slice(0, 80)}`);
});

await test('IT WAS NEVER AUTO-APPROVED — the command did not run', async () => {
  const r = await api('/agent/' + runId);
  const ran = (r.steps || []).some((s) => s.tool === 'run_command' && s.result && !/DENIED|not approved/i.test(String(s.result)));
  assert.ok(!ran, 'a command that needed approval was executed without a human');
  const hist = JSON.stringify(r.steps || []);
  assert.match(hist, /NOT approved|DENIED/i, 'the agent was not told it was denied');
});

await test('queued work is picked up while idle (a loop, not just a chain)', async () => {
  await api('/agent/queue', { method: 'POST', body: JSON.stringify({ goal: 'a goal nobody started by hand' }) });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const q = await api('/agent/queue');
    const item = (q.items || []).find((i) => /nobody started/.test(i.goal));
    if (!item || item.status !== 'queued') {
      console.log(`        picked up: ${item ? item.status : 'consumed'}`);
      return;
    }
    await new Promise((x) => setTimeout(x, 3000));
  }
  assert.fail('a queued goal sat untouched — the hub is still a chain, not a loop');
});

hub.kill(); fake.kill();
const ticks = (log.join('').match(/supervisor picked up a queued goal/g) || []).length;
console.log(`\n  tick pickups logged: ${ticks}`);
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
