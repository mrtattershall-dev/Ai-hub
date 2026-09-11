/**
 * assertEvidence.test.mjs - a failing Python assert shows the model BOTH sides.
 *
 *   node server/assertEvidence.test.mjs
 *
 * 14B vs 32B head-to-head (2026-09-10): a model's own test failed 22 times; in 8 of them it was
 * Python, and a bare `assert f(x) == y` printed only "AssertionError" - no value to reason from.
 * In 7 goals the 14B's CODE was right and its TEST wrong. explain_assert.py rewrites the file's
 * comparison asserts to capture both sides in place (pytest's trick), and agent.js inserts that
 * evidence into run_python / run_command results - BEFORE the trailing "EXIT: n" line, because
 * batch mode decides a command failed by the result ending in a non-zero EXIT.
 *
 * The explainer part runs on the REAL failing files the head-to-head left behind.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELPER = join(HERE, 'explain_assert.py');
const DATA = join(HERE, '..', 'measurements', '2026-09-10-14b-vs-32b', 'data');
const HAVE_PY = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

// Copy a real workspace's .py files to a scratch dir, run the helper on one of them there.
function explainReal(set, file) {
  const src = join(DATA, set, 'workspace');
  const tmp = mkdtempSync(join(tmpdir(), 'explain-'));
  for (const f of readdirSync(src).filter((x) => x.endsWith('.py'))) copyFileSync(join(src, f), join(tmp, f));
  return spawnSync('python', ['-B', HELPER, file], { cwd: tmp, encoding: 'utf8', timeout: 30000 }).stdout || '';
}

console.log('\nexplain_assert.py on the real failing files\n');
if (!HAVE_PY) console.log('  (python not on PATH - explainer checks skipped; the hub adds nothing in that case, by design)');

await test('the quoted-KeyError trap BOTH models fell into: the left side shows the extra quotes', () => {
  if (!HAVE_PY) return;
  const out = explainReal('coder14b-base-setA', 't9_csvsum.py');
  assert.match(out, /Its two sides were:/, 'no evidence: ' + out.slice(0, 200));
  assert.match(out, /LEFT {2}str\(e\) {2}-> {2}"'Unknown column: unknown'"/, out);
  assert.match(out, /RIGHT "Unknown column: unknown" {2}-> {2}'Unknown column: unknown'/, out);
});
await test('a wrong expected value: the function\'s real return is shown', () => {
  if (!HAVE_PY) return;
  const out = explainReal('coder14b-base-setB', 'u6_wrap.py');
  assert.match(out, /LEFT {2}wrap\("This is a test", 10\) {2}-> {2}'This is a\\ntest'/, out);
});
await test('a file that passes, or fails on something other than an assert, explains nothing', () => {
  if (!HAVE_PY) return;
  assert.equal(explainReal('coder14b-base-setA', 't2_text.py').trim(), '');
  assert.equal(explainReal('coder14b-base-setA', 't6_stats.py').trim(), '');   // dies on ValueError
});

// ── the loop ────────────────────────────────────────────────────────────────────────
const FENCE = '`'.repeat(3);
const write = (path, body, lang = 'python') => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}${lang}\n${body}\n${FENCE}`;
const runPy = (path) => `THOUGHT: run it.\nACTION: run_python\nPATH: ${path}`;
const runCmd = (cmd) => `THOUGHT: run it.\nACTION: run_command\nCOMMAND: ${cmd}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], k: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'evid', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = messages.length === 2;
    const text = planner ? 'Plan: write it, run it, finish.' : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    rig.requests.push({ planner, messages, reply: text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'evid', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'assertevid-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'evid' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    // Batch ON for the ordering check below; single-action replies behave exactly as usual.
    AGENT_BATCH_ACTIONS: '1',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(d.toString()));
hub.stderr.on('data', (d) => rig.log.push(d.toString()));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
const answerTo = (text) => { for (const r of rig.requests) { const i = r.messages.findIndex((m) => m.role === 'assistant' && m.content === text); if (i !== -1 && r.messages[i + 1]) return String(r.messages[i + 1].content); } return null; };

const WRONG_PY = write('u.py', 'def add(a, b):\n    return a + b\n\nassert add(2, 2) == 5');
const RUN_U = runPy('u.py');
const WRONG_JS = write('j.js', "const assert = require('assert');\nassert.strictEqual(1 + 1, 3);", 'javascript');
const RUN_J = runCmd('node j.js');
// ONE reply, two actions: the failing run, then a write that must NOT happen if the batch sees
// the failure. If the evidence were appended AFTER "EXIT: 1", the batch would miss it.
const BATCH = runPy('u.py') + '\n\n' + write('after.py', 'print("should never be written")');
let run = null;
await test('the loop: a failing Python assert gains both sides; a JS one gains nothing; a batch still stops', async () => {
  assert.ok(up, 'hub did not start');
  if (!HAVE_PY) return;
  rig.script = [WRONG_PY, RUN_U, WRONG_JS, RUN_J, BATCH, finish('x')];
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Write u.py and j.js and run them' }) });
  assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 160));
  for (let i = 0; i < 400; i++) {
    run = await api('/agent/' + s.runId).catch(() => null);
    if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && run.busy !== true) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const py = answerTo(RUN_U);
  assert.ok(py, 'the run_python step was never answered');
  assert.match(py, /Its two sides were:/, 'no evidence after a failing Python assert: ' + py.slice(0, 240));
  assert.match(py, /LEFT {2}add\(2, 2\) {2}-> {2}4/, py);
  assert.match(py, /RIGHT 5 {2}-> {2}5/, py);
  assert.match(py, /Its two sides were:[\s\S]*EXIT: 1/, 'the evidence must come BEFORE the EXIT line');
  const js = answerTo(RUN_J);
  assert.ok(js, 'the run_command step was never answered');
  assert.doesNotMatch(js, /Its two sides were/, 'JS failures already show both sides - nothing should be added');
  assert.ok(!existsSync(join(ws, 'after.py')), 'the batch ran on past a failing assert - the EXIT line is no longer last');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
