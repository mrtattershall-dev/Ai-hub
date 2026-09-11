/**
 * planFilesGate.test.mjs - the finish gate asks, once, about a file the plan promised.
 *
 *   node server/planFilesGate.test.mjs
 *
 * 14B data run, 2026-09-10, goal 9: the BUILD PLAN listed S_QUEUE.md under FILES, the model
 * never wrote it, and its finish was accepted. The gate now blocks the FIRST finish while a
 * plan-listed file is missing - once only, because plans over-promise and a gate that binds
 * plan items turns finished work into stopped runs (why the ledger gate is advisory). The
 * second finish is accepted with a note.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];

const FENCE = '`'.repeat(3);
const write = (path, body) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}javascript\n${body}\n${FENCE}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;
const tick = (f) => '`' + f + '`';
const planWith = (files) => `1. WHAT IT DOES — the goal.\n2. FILES —\n${files.map((f) => `   - ${tick(f)} — part of the goal.`).join('\n')}\n3. BUILD ORDER —\n   - write the files.\n4. HOW TO VERIFY — run it.`;
const GAME_PLAN = '1. **SYSTEMS NEEDED**\n   - Input System: arrow keys.\n\n5. **BUILD ORDER**\n   - **Step 1**: Create the canvas.';

// ── rig: a scripted mock model + an isolated hub ──────────────────────────────────
const [mockPort, hubPort] = await freePorts(2);
const rig = { plan: '', script: [], requests: [], k: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'planfiles', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = messages.length === 2;
    const text = planner ? rig.plan : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    rig.requests.push({ planner, messages, reply: text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'planfiles', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'planfilesgate-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'planfiles' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(d.toString()));
hub.stderr.on('data', (d) => rig.log.push(d.toString()));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();

async function runGoal(goal, plan, script) {
  rig.plan = plan;
  rig.script = [...script];
  const from = rig.requests.length;
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 200));
  let run = null;
  const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) {
    run = await api('/agent/' + s.runId).catch(() => null);
    if (run?.status === 'awaiting_approval') {
      await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: false }) });
      continue;
    }
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  assert.ok(run && TERMINAL.includes(run.status), `run never ended (last ${run?.status})`);
  return { run, reqs: rig.requests.slice(from) };
}
const answerTo = (reqs, text) => {
  for (const r of reqs) {
    const i = r.messages.findIndex((m) => m.role === 'assistant' && String(m.content).trim() === text.trim());
    if (i !== -1 && r.messages[i + 1]) return String(r.messages[i + 1].content);
  }
  return null;
};
const asked = (run) => run.steps.some((s) => s.type === 'error' && /under FILES - not written/.test(s.text || ''));

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\nthe finish gate and the plan\'s FILES\n');
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-800)); hub.kill(); mock.close(); process.exit(1); }

const FIN_A = finish('wrote work.js, skipped the notes');
await test('a finish with a plan-listed file missing is blocked ONCE, naming the file (goal 9)', async () => {
  const { run, reqs } = await runGoal('Write work.js and NOTE.md explaining it', planWith(['NOTE.md', 'work.js']),
    [write('work.js', 'module.exports = { ok: true };'), FIN_A]);
  const a = answerTo(reqs, FIN_A);
  assert.ok(a, run.status === 'done' ? 'the finish was ACCEPTED with NOTE.md missing' : `never answered (ended ${run.status})`);
  assert.match(a, /listed NOTE\.md under FILES/, a.slice(0, 200));
  assert.doesNotMatch(a, /work\.js/, 'work.js exists and must not be named as missing');
  // ...and the NEXT finish is accepted: asked once, never a hang.
  assert.equal(run.status, 'done', `the second finish was not accepted (ended ${run.status})`);
  assert.equal(run.steps.filter((s) => s.type === 'error' && /under FILES/.test(s.text || '')).length, 1, 'asked more than once');
  assert.ok(run.steps.some((s) => s.type === 'note' && /Finished without NOTE\.md/.test(s.text || '')), 'no note recording what was left out');
});

await test('a finish with every plan-listed file written is accepted first time', async () => {
  const FIN_B = finish('wrote both');
  const { run } = await runGoal('Write b1.js and b2.js', planWith(['b1.js', 'b2.js']),
    [write('b1.js', 'module.exports = 1;'), write('b2.js', 'module.exports = 2;'), FIN_B]);
  assert.equal(run.status, 'done', `ended ${run.status}`);
  assert.ok(!asked(run), 'asked about files that all exist');
});

await test('a plan with no FILES section (game plans) is never asked', async () => {
  const { run } = await runGoal('Make a small canvas thing in g1.js', GAME_PLAN,
    [write('g1.js', 'module.exports = { draw() {} };'), finish('made it')]);
  assert.ok(!asked(run), 'the FILES check fired on a plan with no FILES section');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
