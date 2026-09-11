/**
 * duplicateDecls.test.mjs - a top-level function declared twice is reported, with its lines.
 *
 *   node server/duplicateDecls.test.mjs
 *
 * The evidence is the real files the 14B-vs-32B head-to-head left behind (committed in
 * measurements/2026-09-10-14b-vs-32b/data), where both models broke a working canvas game by
 * appending second, third and fourth copies of functions that already existed - legal code
 * that `node --check` passes. See duplicateDecls.js.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { duplicateTopLevel, duplicateNote } from './duplicateDecls.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MEAS = join(HERE, '..', 'measurements');
const H2H = join(MEAS, '2026-09-10-14b-vs-32b', 'data');
const real = (set, file) => readFileSync(join(H2H, set, 'workspace', file), 'utf8');
const find = (list, name) => list.find((d) => d.name === name)?.lines;

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\nduplicate top-level declarations - on the real broken games\n');

await test('the 14B\'s u8_game.js: update() declared 4 times, at its real lines', () => {
  assert.deepEqual(find(duplicateTopLevel(real('coder14b-base-setB', 'u8_game.js'), 'u8_game.js'), 'update'), [13, 90, 138, 199]);
});
await test('the 32B\'s u8_game.js: update x2, checkCollisions x3, gameOver x3', () => {
  const d = duplicateTopLevel(real('coder32b-awq-setB', 'u8_game.js'), 'u8_game.js');
  assert.deepEqual(find(d, 'update'), [25, 159]);
  assert.deepEqual(find(d, 'checkCollisions'), [115, 133, 202]);
  assert.deepEqual(find(d, 'gameOver'), [123, 145, 214]);
});
await test('Python too: the 32B\'s u6_wrap.py defines wrap() twice', () => {
  assert.deepEqual(find(duplicateTopLevel(real('coder32b-awq-setB', 'u6_wrap.py'), 'u6_wrap.py'), 'wrap'), [1, 20]);
});
await test('the warning names the function, the count, the lines, and what to do', () => {
  const n = duplicateNote('function tick() { return 1; }\nfunction tick() { return 2; }\n', 'g.js');
  assert.match(n, /g\.js declares tick\(\) 2 times at the top level \(lines 1, 2\)/);
  assert.match(n, /Only the LAST one runs/);
});

console.log('\nwhat must NOT be reported\n');

await test('same-named methods in two classes are not duplicates', () => {
  assert.deepEqual(duplicateTopLevel('class A {\n  update() {}\n}\nclass B {\n  update() {}\n}\n', 'x.js'), []);
});
await test('same-named nested helpers are not duplicates', () => {
  assert.deepEqual(duplicateTopLevel('function a() {\n  function h() {}\n}\nfunction b() {\n  function h() {}\n}\n', 'x.js'), []);
});
await test('a normal file, and empty or junk input, report nothing', () => {
  assert.deepEqual(duplicateTopLevel(real('coder14b-base-setA', 't1_temp.js'), 't1_temp.js'), []);
  for (const x of ['', null, undefined, 42]) assert.deepEqual(duplicateTopLevel(x, 'x.js'), []);
  assert.equal(duplicateNote('function f() {}\n', 'x.js'), '');
});
await test('across ALL 72 code files both runs left behind, exactly the 4 known files are flagged', () => {
  const flagged = [];
  for (const root of [H2H, join(MEAS, '2026-09-10-14b-30min', 'data')]) {
    for (const d of readdirSync(root)) {
      const ws = join(root, d, 'workspace');
      if (!existsSync(ws)) continue;
      for (const f of readdirSync(ws).filter((x) => /\.(m?js|cjs|py)$/i.test(x))) {
        if (duplicateTopLevel(readFileSync(join(ws, f), 'utf8'), f).length) flagged.push(`${d}/${f}`);
      }
    }
  }
  assert.deepEqual(flagged.sort(), ['coder14b-base-setB/u8_game.js', 'coder32b-awq-setB/u6_wrap.py', 'coder32b-awq-setB/u8_game.js', 'pass1/s13_game.js']);
});

// ── the loop: the model is told, right after the write ───────────────────────────────
const FENCE = '`'.repeat(3);
const write = (path, body) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}javascript\n${body}\n${FENCE}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], k: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'dups', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = messages.length === 2;
    const text = planner ? 'Plan: write it, then finish.' : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    rig.requests.push({ planner, messages, reply: text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'dups', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'dupdecls-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'dups' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
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

const DUP = write('g.js', 'function tick() { return 1; }\nfunction tick() { return 2; }\nmodule.exports = { tick };');
const CLEAN = write('h.js', 'function tock() { return 3; }\nmodule.exports = { tock };');
await test('the loop tells the model right after a write that duplicates a function - and not after a clean one', async () => {
  assert.ok(up, 'hub did not start');
  rig.script = [DUP, CLEAN, finish('x')];
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Write g.js and h.js' }) });
  assert.ok(s.runId, 'start failed');
  for (let i = 0; i < 400; i++) {
    const run = await api('/agent/' + s.runId).catch(() => null);
    if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && run.busy !== true) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const a = answerTo(DUP), b = answerTo(CLEAN);
  assert.ok(a && b, 'a write was never answered');
  assert.match(a, /declares tick\(\) 2 times/, 'no duplicate warning after the duplicating write: ' + a.slice(0, 200));
  assert.doesNotMatch(b, /declares .*times at the top level/, 'a warning after a clean write');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
