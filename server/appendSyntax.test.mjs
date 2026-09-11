/**
 * appendSyntax.test.mjs - an append is an edit: it gets the same post-write checks.
 *
 *   node server/appendSyntax.test.mjs
 *
 * drive() ran its post-write block - syntax check, needsTest, lastPath, touchedWeb - for
 * write_file and edit_file only. append_file (added because EDIT goals were burning whole
 * step budgets) got none of it, so:
 *   - an append that broke an EXISTING file was never flagged to the model mid-run;
 *   - an append to a script index.html loads did not set needsTest, so the finish gate let
 *     the run finish without the browser test a write or edit would have demanded;
 *   - a batch (AGENT_BATCH_ACTIONS) did not stop after an append that broke a file.
 * A REFUSED append (a fragment for a file that does not exist) wrote nothing, so it must
 * not collect a syntax verdict about a file that is not there.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];

const FENCE = '`'.repeat(3);
const fence = (lang, body) => `${FENCE}${lang}\n${body}\n${FENCE}`;
const write = (path, body, lang = 'javascript') => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${fence(lang, body)}`;
const append = (path, body) => `THOUGHT: adding to ${path}.\nACTION: append_file\nPATH: ${path}\n${fence('javascript', body)}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;

// ── rig: a scripted mock model + an isolated hub ──────────────────────────────────
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], k: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'appendsyntax', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = messages.length === 2;
    const text = planner ? 'Plan: do what the goal says, then finish.'
      : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    rig.requests.push({ planner, messages, reply: text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'appendsyntax', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'appendsyntax-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'appendsyntax' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
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

async function runGoal(goal, script) {
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
    // Wait for teardown too: the hub answers the next /start with a 409 until busy clears.
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  assert.ok(run && TERMINAL.includes(run.status), `run never ended (last ${run?.status})`);
  return { run, reqs: rig.requests.slice(from) };
}
// What the hub sent back right after the assistant reply `text`.
const answerTo = (reqs, text) => {
  for (const r of reqs) {
    const i = r.messages.findIndex((m) => m.role === 'assistant' && String(m.content).trim() === text.trim());
    if (i !== -1 && r.messages[i + 1]) return String(r.messages[i + 1].content);
  }
  return null;
};

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\nappend_file gets the post-write checks\n');
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-800)); hub.kill(); mock.close(); process.exit(1); }

const BROKEN = append('base.js', 'function broken( {');
await test('an append that breaks an EXISTING file is flagged to the model', async () => {
  const { reqs } = await runGoal('Add a helper to base.js', [write('base.js', 'module.exports = { a: 1 };'), BROKEN, finish('x')]);
  const a = answerTo(reqs, BROKEN);
  assert.ok(a, 'the append was never answered');
  assert.match(a, /SYNTAX CHECK FAILED for base\.js/, 'no syntax verdict after a breaking append: ' + a.slice(0, 200));
});

const GOOD = append('good.js', 'function two() { return 2; }\nmodule.exports.two = two;');
await test('a clean append is reported as passing', async () => {
  const { reqs } = await runGoal('Add two() to good.js', [write('good.js', 'module.exports = {};'), GOOD, finish('x')]);
  const a = answerTo(reqs, GOOD);
  assert.ok(a, 'the append was never answered');
  assert.match(a, /good\.js passed a syntax check/, a.slice(0, 200));
});

const FRAG = append('nothere.js', '  zip: function (a, b) {\n    return a;\n  }\n};');
await test('a REFUSED append (fragment, no such file) gets no syntax verdict', async () => {
  const { reqs } = await runGoal('Add zip to the EXISTING nothere.js', [FRAG, finish('x')]);
  const a = answerTo(reqs, FRAG);
  assert.ok(a, 'the append was never answered');
  assert.match(a, /does not exist/, a.slice(0, 200));
  assert.doesNotMatch(a, /SYNTAX CHECK|passed a syntax check/, 'a verdict about a file that was never written: ' + a.slice(0, 240));
  assert.ok(!existsSync(join(ws, 'nothere.js')));
});

// The page is built by an EARLIER run, so the run under test starts with needsTest and
// touchedWeb both false: the ONLY thing that can make its finish gate ask for a browser test
// is the append itself.
const PAGE = write('index.html', '<!doctype html><html><body><canvas id="c"></canvas><script src="game.js"></script></body></html>', 'html');
const APPEND_GAME = append('game.js', 'function tick() { return 1; }');
const FIN = finish('appended to a loaded script without a browser test');
await test('an append to a script index.html loads must be browser-tested before finish', async () => {
  await runGoal('Create index.html and game.js', [PAGE, write('game.js', 'var c = document.getElementById("c");'), finish('page')]);
  const { run, reqs } = await runGoal('Add a tick() to game.js', [APPEND_GAME, FIN]);
  const a = answerTo(reqs, FIN);
  assert.ok(a, run.status === 'done'
    ? 'finish was ACCEPTED straight after an untested append to a loaded script'
    : `the finish was never answered (run ended ${run.status})`);
  assert.match(a, /Do NOT finish yet/, 'finish accepted after an untested append to a loaded script: ' + a.slice(0, 200));
  assert.match(a, /browser/i, 'blocked, but not for the browser test: ' + a.slice(0, 200));
  // NOT asserting the final status: once blocked, the finish gate may run its own browser
  // check and then accept a later finish - that is the gate working. The requirement is only
  // that the UNTESTED finish straight after the append was refused, checked above.
  void run;
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
