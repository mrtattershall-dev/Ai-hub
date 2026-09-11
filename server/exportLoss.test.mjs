/**
 * exportLoss.test.mjs - a write or edit that drops names from what a JS file EXPORTS says so, by name.
 *
 *   node server/exportLoss.test.mjs
 *
 * Set E (2026-09-11), Qwen3-Coder goal 54: two edits to q4_template.js missed, the model rewrote the file whole, and the
 * rewrite dropped `module.exports = { render };`. render() was still defined, so the definition-loss warning stayed
 * silent and the hub said "OK: wrote 10932 bytes". Every later require('./q4_template') got undefined - the rest of
 * q4 and all of q10 failed at the end.
 *   unit  exportNames reads the CommonJS and ESM forms; goal 54's before/after loses render; a file that never
 *         exported render (the 14B's q4) is not a loss
 *   hub   the goal-54 shape (export dropped by a rewrite) is named in what the model is sent next; writes that keep
 *         or restore the export add nothing
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { exportNames, lostExports } from './defNames.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}javascript\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na dropped export is named\n');

const sorted = (s) => [...s].sort();
await test('exportNames reads the CommonJS forms', () => {
  assert.deepEqual(sorted(exportNames('module.exports = { render, compile: c, parse };', 'a.js')), ['compile', 'parse', 'render']);
  assert.deepEqual(sorted(exportNames('function f() {}\nmodule.exports = f;\n', 'a.js')), ['f']);
  assert.deepEqual(sorted(exportNames('module.exports.compile = compile;\nexports.run = run;', 'a.js')), ['compile', 'run']);
  assert.deepEqual(sorted(exportNames('module.exports = {\n  render,\n  compile\n};', 'a.js')), ['compile', 'render']);
});
await test('exportNames reads the ESM forms, and nothing for Python', () => {
  // `export { c, d as e }` exports c and e (d is only the local name).
  assert.deepEqual(sorted(exportNames('export function a() {}\nexport const b = 1;\nexport { c, d as e };', 'a.mjs')), ['a', 'b', 'c', 'e']);
  assert.deepEqual(sorted(exportNames('def render(t):\n    return t\n', 'a.py')), []);
});
await test('goal 54: the rewrite lost render', () => {
  const before = '// Template rendering function\nfunction render(template, data) { return template; }\nmodule.exports = { render };\n';
  const after = '// Template rendering function\nfunction render(template, data) { return template; }\nconsole.log(render("x"));\n';
  assert.deepEqual(lostExports(before, after, 'q4_template.js'), ['render']);
});
await test('a file that never exported render is not a loss (the 14B q4)', () => {
  const before = 'function renderTemplate(t) { return t; }\nmodule.exports.compile = compile;\n';
  const after = 'function renderTemplate(t) { return t + 1; }\nmodule.exports.compile = compile;\n';
  assert.deepEqual(lostExports(before, after, 'q4_template.js'), []);
});

// The hub: the same shape through a real write_file. The warning travels in what the model is sent NEXT (like the
// definition-loss warning), so the mock keeps, for every call, the hub messages that are new since the model spoke.
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], news: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'exp', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = m.length === 2;
    if (!planner) { const la = m.map((x) => x.role).lastIndexOf('assistant'); rig.news.push(m.slice(la + 1).map((x) => String(x.content || '')).join('\n---\n')); }
    const text = planner ? 'Plan: write, rewrite, finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'exp', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'exportloss-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'exp' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

const V1 = 'function render(template, data) { return template; }\nmodule.exports = { render };';
const V2 = 'function render(template, data) { return template.trim(); }\nconsole.log(render(" x "));';   // export dropped
const V3 = 'function render(template, data) { return template.trim(); }\nmodule.exports = { render };';  // export back
const V4 = '// tidied\nfunction render(template, data) { return template.trim(); }\nmodule.exports = { render };'; // kept
rig.script = [write('q4.js', V1), write('q4.js', V2), write('q4.js', V3), write('q4.js', V4), FINISH];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create q4.js exporting render(template, data).' }) });
let run = null; const deadline = Date.now() + 3 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
// news[k] = what the hub sent after the model's k-th action (news[0] is the opening call).
const after = (k) => String(rig.news[k] || '');

await test('the premise: the four writes were answered', () => {
  const writes = (run?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'write_file').length;
  assert.equal(writes, 4, 'writes: ' + writes + ' / status ' + run?.status);
  assert.ok(rig.news.length >= 5, 'model calls seen: ' + rig.news.length);
});
await test('the rewrite that dropped the export is named in what the model is sent next', () => {
  assert.match(after(2), /REMOVED what q4\.js exported: render/, after(2).slice(0, 500));
});
await test('writes that keep (or restore) the export add nothing about exports', () => {
  for (const k of [1, 3, 4]) assert.doesNotMatch(after(k), /exported:/, `after write ${k}: ` + after(k).slice(0, 300));
});
hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
