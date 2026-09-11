/**
 * shadowHint.test.mjs - "x.name is not a function" caused by a stored value hiding a method is named, with lines.
 *
 *   node server/shadowHint.test.mjs
 *
 * Set D r1 (this.history vs history()) and set E q7 (this.text vs text()), 2026-09-11: the constructor stored a value
 * under a method's name, every call failed, and the model re-read the method, saw it defined, and looped until the
 * repeat guard ended the goal. The run result now names both lines. A plain "is not a function" with no such
 * collision must add nothing.
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
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const runCmd = (c) => `THOUGHT: run it.\nACTION: run_command\nCOMMAND: ${c}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na stored value hiding a method is named\n');

// V8 words this one "(intermediate value).text is not a function" - the form the first pattern missed.
const JS = "class Buf {\n  constructor(t = '') {\n    this.text = t;\n  }\n  text() { return this.text; }\n}\nconsole.log(new Buf('hi').text());";
const PY = "class Buf:\n    def __init__(self, t=''):\n        self.text = t\n\n    def text(self):\n        return self.text\n\n\nb = Buf('hi')\nprint(b.text())";
const NEG = 'const o = {};\no.nope();';
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'shadow', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write, run, finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'shadow', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'shadow-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'shadow' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

rig.script = [write('q7b.js', JS), runCmd('node q7b.js'), write('q5b.py', PY), runCmd('python q5b.py'), write('qneg.js', NEG), runCmd('node qneg.js'), FINISH];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Write and run q7b.js, q5b.py and qneg.js.' }) });
let run = null; const deadline = Date.now() + 3 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
const ran = (cmd) => (run?.steps || []).find((s) => s.type === 'tool' && s.tool === 'run_command' && String(s.args?.command || s.args?.cmd || '').includes(cmd));
const res = (cmd) => String(ran(cmd)?.result || '');

await test('the premise: all three commands ran and failed the way they should', () => {
  assert.match(res('node q7b.js'), /is not a function/, 'q7b: ' + res('node q7b.js').slice(0, 200) + ' | status ' + run?.status);
  assert.match(res('python q5b.py'), /object is not callable/, 'q5b: ' + res('python q5b.py').slice(0, 200));
  assert.match(res('node qneg.js'), /is not a function/, 'qneg: ' + res('node qneg.js').slice(0, 200));
});
await test('JS: the hint names this.text (line 3) and the text() method (line 5)', () => {
  assert.match(res('node q7b.js'), /q7b\.js stores a value in this\.text \(line 3\) AND defines a text\(\) method \(line 5\)/, res('node q7b.js').slice(-400));
});
await test('Python: the hint names self.text (line 3) and the text() method (line 5)', () => {
  assert.match(res('python q5b.py'), /q5b\.py stores a value in self\.text \(line 3\) AND defines a text\(\) method \(line 5\)/, res('python q5b.py').slice(-400));
});
await test('no collision, no hint', () => {
  assert.doesNotMatch(res('node qneg.js'), /HIDES/, res('node qneg.js').slice(-300));
});
hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
