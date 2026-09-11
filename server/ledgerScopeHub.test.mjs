/**
 * ledgerScopeHub.test.mjs - the TASK LEDGER block sent with every model call is scoped to the run's goal.
 *
 *   node server/ledgerScopeHub.test.mjs
 *
 * ledgerScope.test.mjs proves the rule on taskLedger.js; this proves the hub actually hands the goal to it. Set E
 * (2026-09-11): goal 1's plan tasks were in every later goal's model calls and the 14B acted on them.
 *   goal 1  plans "Create a1.js ..." (the ledger is seeded from the plan) and finishes nothing
 *   goal 2  about b2.js -> its first model call does NOT carry goal 1's a1.js task, and says leftovers are hidden
 *   goal 3  about a1.js -> its first model call DOES carry it
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nthe per-call ledger is scoped to the goal\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { plan: '', log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'scope', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? rig.plan : FINISH;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'scope', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'scopehub-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'scope' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

async function runGoal(goal, plan) {
  rig.plan = plan;
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  const tf = join(dir, 'runs', `${st.runId}.transcript.jsonl`);
  const turns = existsSync(tf) ? readFileSync(tf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.kind === 'turn') : [];
  const ledgerMsg = turns.length ? (turns[0].sent || []).map((m) => String(m.content || '')).find((c) => c.startsWith('TASK LEDGER')) || '' : '';
  return { run, ledgerMsg };
}

const g1 = await runGoal('Create a1.js exporting add(a, b).', '1. Create a1.js with add(a, b)\n2. Run a1.js with node to check it');
const g2 = await runGoal('Create b2.js exporting mul(a, b).', 'Plan: write b2.js.');
const g3 = await runGoal('Fix add(a, b) in the EXISTING a1.js.', 'Plan: fix a1.js.');

await test('the premise: goal 1 seeded its plan tasks and left them open', () => {
  assert.ok((g1.run?.steps || []).some((s) => s.type === 'note' && /Task ledger seeded/.test(String(s.text))), 'no seeding note');
  assert.match(readFileSync(join(dir, 'workspace', 'TASKS.md'), 'utf8'), /\[ \] 1\. Create a1\.js/);
});
await test('goal 2 (about b2.js): the model is NOT sent goal 1\'s a1.js task', () => {
  assert.ok(g2.ledgerMsg, 'no TASK LEDGER message in goal 2\'s first call');
  assert.doesNotMatch(g2.ledgerMsg, /Create a1\.js/, g2.ledgerMsg);
  assert.match(g2.ledgerMsg, /not shown/, g2.ledgerMsg);
});
await test('goal 3 (about a1.js): the model IS sent the a1.js task', () => {
  assert.match(g3.ledgerMsg, /Create a1\.js/, g3.ledgerMsg);
});
hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
