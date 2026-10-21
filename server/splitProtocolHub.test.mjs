/**
 * splitProtocolHub.test.mjs - REL-2's treatment through a real hub (benchmarks/REL-2_SPLIT-PROTOCOL_PREREG.md).
 *
 *   node server/splitProtocolHub.test.mjs
 *
 * The mock model answers like Ollama does under a grammar: JSON when the request carries `format`, plain text when
 * it does not. What is asserted is what the HUB sends and what lands on disk:
 *   - flag on: every turn's first request carries the schema, with the action enum; the body request carries none
 *   - flag on: code with quotes, backslashes and JSON-looking text lands byte-exact (it never passed through JSON)
 *   - flag on: every turn yielded an action (parseLog all true) and the run finishes; splitStats counts the work
 *   - flag off: no request carries `format` - the control is the protocol as it was
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const F = '`'.repeat(3);
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nREL-2: the split protocol through the hub\n');

const CODE = 'const s = "a \\"quoted\\" \\\\ path";\nconst j = {"k": [1, 2]};\nconsole.log(s.length, j.k.length);\nmodule.exports = { s, j };';
const heads = [
  { thought: 'write the file', action: 'write_file', path: 'p1.js' },
  { thought: 'run it', action: 'run_command', command: 'node p1.js' },
  { thought: 'it works', action: 'finish', summary: 'p1.js written and run' },
];
const rig = { requests: [], turn: 0 };
const [mockPort, portOn, portOff] = await freePorts(3);
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(body); } catch { /* empty */ }
    rig.requests.push(b);
    const m = b.messages || [];
    let text;
    if (m.length === 2) text = 'Plan: write p1.js, run it, finish.';
    else if (b.format) text = JSON.stringify(heads[Math.min(rig.turn++, heads.length - 1)]);
    else if (/fenced code block/i.test(String(m.at(-1)?.content || ''))) text = `Here is the file:\n${F}js\n${CODE}\n${F}`;
    else text = 'THOUGHT: done.\nACTION: finish\nSUMMARY: plain protocol';
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'split', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

async function runWith(port, flag) {
  rig.requests = []; rig.turn = 0;
  const dir = mkdtempSync(join(tmpdir(), 'split-'));
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'split' } }, history: [], settings: {} }));
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(port), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_META_DIR: join(dir, 'meta'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_PROVIDER: 'ollama', AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
      AGENT_WORKER_EXEC: '', AGENT_GOVERNED_WRITES: '', AGENT_JSON_ACTIONS: flag, WATCHERS: '0',
      AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const API = `http://127.0.0.1:${port}/api`;
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  if (!up) { hub.kill(); throw new Error('hub did not start'); }
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create p1.js and run it.' }) });
  let run = null; const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  hub.kill();
  let file = null; try { file = readFileSync(join(ws, 'p1.js'), 'utf8'); } catch { /* not written */ }
  return { run, file, requests: [...rig.requests] };
}

const on = await runWith(portOn, '1');
const turnReqs = on.requests.filter((b) => (b.messages || []).length > 2);
await test('flag on: turn requests carry the schema, with the action enum of real tools', () => {
  const withFormat = turnReqs.filter((b) => b.format);
  assert.ok(withFormat.length >= 3, `only ${withFormat.length} schema requests`);
  const en = withFormat[0].format.properties.action.enum;
  for (const t of ['write_file', 'run_command', 'finish']) assert.ok(en.includes(t), `enum lacks ${t}`);
  assert.ok(!('content' in withFormat[0].format.properties), 'the schema has a content field');
});
await test('flag on: the body request carries no format (the code is asked for as plain text)', () => {
  const bodyReq = turnReqs.find((b) => !b.format && /fenced code block/i.test(String((b.messages || []).at(-1)?.content || '')));
  assert.ok(bodyReq, 'no plain body request was made');
});
await test('flag on: the code lands byte-exact - quotes, backslashes and JSON-looking text intact', () => {
  assert.equal((on.file || '').trim(), CODE);
});
await test('flag on: every turn yielded an action, the run finished, and the split is counted', () => {
  assert.equal(on.run.status, 'done', 'status ' + on.run.status);
  assert.ok((on.run.parseLog || []).length >= 3 && on.run.parseLog.every(Boolean), 'parseLog ' + JSON.stringify(on.run.parseLog));
  assert.ok(on.run.splitStats && on.run.splitStats.turns >= 3 && on.run.splitStats.bodyCalls === 1, 'splitStats ' + JSON.stringify(on.run.splitStats));
});
const off = await runWith(portOff, '');
await test('flag off: no request carries format - the control protocol is unchanged', () => {
  assert.equal(off.requests.filter((b) => b.format).length, 0);
  assert.ok(!off.run.splitStats || !off.run.splitStats.turns, 'splitStats present with the flag off');
});

mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
