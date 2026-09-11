/**
 * noopEdit.test.mjs - an edit that changes nothing says NO CHANGE instead of "OK: edited".
 *
 *   node server/noopEdit.test.mjs
 *
 * Set E (2026-09-11), base 14B, goal 5: the model sent the same 13-line edit_file three times with FIND identical to
 * REPLACE. Each time the hub answered "OK: edited q5_limits.py" plus a passing syntax check, so the model believed
 * it had fixed its failing assert, and repeated itself until the repeat guard ended the goal.
 *   - FIND === REPLACE                           -> NO CHANGE, file untouched
 *   - an indentation-tolerant match that rewrites the lines to what they already were -> NO CHANGE
 *   - a real edit (the control)                  -> still "OK: edited", and the file changed
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const edit = (p, find, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nan edit that changes nothing says so\n');

const SRC = 'def f():\n    x = 1\n    y = 2\n    return x + y';
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'noop', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write, edit, finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'noop', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'noop-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'noop' } }, history: [], settings: {} }), 'utf8');
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

rig.script = [
  write('n.py', SRC),
  edit('n.py', '    x = 1', '    x = 1'),                          // FIND === REPLACE
  edit('n.py', 'x = 1\ny = 2', '    x = 1\n    y = 2'),            // tolerant match, rewritten to what it already is
  edit('n.py', '    y = 2', '    y = 3'),                          // the control: a real edit
  FINISH,
];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Write n.py and tidy it.' }) });
let run = null; const deadline = Date.now() + 3 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
const edits = (run?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'edit_file').map((s) => String(s.result || ''));
const now = readFileSync(join(dir, 'workspace', 'n.py'), 'utf8').replace(/\r/g, '');

await test('the premise: three edits reached the tool', () => { assert.equal(edits.length, 3, 'edit_file steps: ' + edits.length + ' / status ' + run?.status); });
await test('FIND identical to REPLACE says NO CHANGE, not OK', () => {
  assert.match(edits[0], /^NO CHANGE/, edits[0].slice(0, 200)); assert.doesNotMatch(edits[0], /OK: edited/);
});
await test('a tolerant match rewritten to the same lines says NO CHANGE', () => {
  assert.match(edits[1], /^NO CHANGE/, edits[1].slice(0, 200));
});
await test('a real edit still says OK and changes the file (the control)', () => {
  assert.match(edits[2], /^OK: edited n\.py/, edits[2].slice(0, 200));
  assert.equal(now.trim(), SRC.replace('y = 2', 'y = 3'), now);
});
hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
