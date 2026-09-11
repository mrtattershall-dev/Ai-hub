/**
 * defLoss.test.mjs - a write that drops definitions the file had tells the model, by name.
 *
 *   node server/defLoss.test.mjs
 *
 * Set D (2026-09-11): Qwen3-Coder rewrote whole files while fixing something and silently lost functions it had
 * written correctly - add_days, is_weekend and add_business_days in one rewrite of r6_days.py; earliestStart and
 * ready() during the very goals that added them. Seven working functions, found missing only by the hidden checks
 * at the end. defNames.js compares the names before and after each write/edit; the tool result now says which
 * ones went.
 *
 *   unit  JS functions / classes / methods / arrow consts and Python defs and classes are found; a reformat that
 *         keeps every name loses none; keywords are never names
 *   loop  a rewrite that drops a function is answered with its name; a rewrite that keeps them all is not;
 *         an edit_file that deletes a method is caught too
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { defNames, lostDefs } from './defNames.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na write that drops definitions says so\n');

const JS_A = `class Ledger {\n  constructor() { this.a = {}; }\n  deposit(n, x) {\n    if (x > 0) { return 1; }\n  }\n  history(n) {\n    return [];\n  }\n}\nfunction helper(x) { return x; }\nconst fmt = (c) => '$' + c;\nmodule.exports = { Ledger, helper, fmt };\n`;
const PY_A = 'class Store:\n    def get(self, k):\n        return 1\n\n    def delete(self, k):\n        return True\n\n\ndef add_days(s, n):\n    return s\n\n\ndef is_weekend(s):\n    return False\n';

await test('unit: JS names are found (class, methods, function, arrow), keywords are not', () => {
  const n = [...defNames(JS_A, 'r1.js')].sort();
  assert.deepEqual(n, ['Ledger', 'deposit', 'fmt', 'helper', 'history']);
});
await test('unit: Python defs and classes are found', () => {
  assert.deepEqual([...defNames(PY_A, 'r6.py')].sort(), ['Store', 'add_days', 'delete', 'get', 'is_weekend']);
});
await test('unit: dropping names is reported; a reformat that keeps them is not', () => {
  assert.deepEqual(lostDefs(PY_A, 'def add_days(s, n):\n    return s\n', 'r6.py'), ['Store', 'delete', 'get', 'is_weekend']);
  assert.deepEqual(lostDefs(JS_A, JS_A.replace('  history(n) {\n    return [];\n  }\n', ''), 'r1.js'), ['history']);
  assert.deepEqual(lostDefs(JS_A, JS_A.replace(/\n\n/g, '\n').replace('return x;', 'return x + 0;'), 'r1.js'), []);
  assert.deepEqual(lostDefs('whatever', 'other', 'notes.md'), []);
});

// ── loop rig ──
const FENCE = '`'.repeat(3);
const write = (p, body, lang) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}${lang}\n${body}\n${FENCE}`;
const edit = (p, find, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: written';
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'defloss', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write, rewrite, finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    rig.requests.push(m);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'defloss', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'defloss-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'defloss' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
async function runGoal(goal, script) {
  rig.script = [...script]; const from = rig.requests.length;
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return { run, reqs: rig.requests.slice(from) };
}
// What the hub said right after the assistant reply `text` (every new message, not just the last).
const answerTo = (reqs, text) => {
  for (const m of reqs) { const i = m.findIndex((x) => x.role === 'assistant' && String(x.content).trim() === text.trim()); if (i !== -1) return m.slice(i + 1).map((x) => String(x.content)).join('\n---\n'); }
  return null;
};
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

const PY_B = 'def add_days(s, n):\n    return s\n\n\ndef business_days_between(a, b):\n    return 0\n';
const REWRITE = write('r6_days.py', PY_B, 'python');
await test('loop: a rewrite that drops functions is answered with their names', async () => {
  const { reqs } = await runGoal('Add business_days_between to the EXISTING r6_days.py.', [write('r6_days.py', PY_A, 'python'), REWRITE, FINISH]);
  const a = answerTo(reqs, REWRITE);
  assert.ok(a, 'the rewrite was never answered');
  assert.match(a, /REMOVED 4 definition\(s\)/, a.slice(0, 300));
  for (const n of ['Store', 'delete', 'get', 'is_weekend']) assert.ok(a.includes(n), 'does not name ' + n);
});
const KEEP = write('k.js', JS_A.replace('return x;', 'return x + 0;'), 'javascript');
await test('loop: a rewrite that keeps every name says nothing', async () => {
  const { reqs } = await runGoal('Tweak helper in the EXISTING k.js.', [write('k.js', JS_A, 'javascript'), KEEP, FINISH]);
  const a = answerTo(reqs, KEEP);
  assert.ok(a, 'the rewrite was never answered');
  assert.ok(!/REMOVED/.test(a), 'a warning on a rewrite that lost nothing: ' + a.slice(0, 200));
});
const DEL = edit('e.js', '  history(n) {\n    return [];\n  }', '');
await test('loop: an edit_file that deletes a method is caught', async () => {
  const { reqs } = await runGoal('Clean up the EXISTING e.js.', [write('e.js', JS_A, 'javascript'), DEL, FINISH]);
  const a = answerTo(reqs, DEL);
  assert.ok(a, 'the edit was never answered');
  assert.match(a, /REMOVED 1 definition\(s\)[^\n]*history/, a.slice(0, 300));
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
