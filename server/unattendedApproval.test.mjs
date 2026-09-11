/**
 * unattendedApproval.test.mjs - AGENT_UNATTENDED=1 denies instead of parking; without it, the run still asks.
 *
 *   node server/unattendedApproval.test.mjs
 *
 * In set D the base 14B ran `open r9_app.html` ("open" is on no allowlist). The run parked in awaiting_approval,
 * nobody was there, and because a parked run holds the workspace, all 91 later goals failed to start. With
 * AGENT_UNATTENDED=1 the same action is DENIED with a reason and the run keeps working; with the flag off the
 * behaviour is unchanged (the run parks and waits for a human).
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
const OPEN = 'THOUGHT: I will open the page in a browser to check it.\nACTION: run_command\nCOMMAND: open notes.html';
const WRITE = `THOUGHT: writing a.js instead.\nACTION: write_file\nPATH: a.js\n${FENCE}javascript\nmodule.exports = { a: 1 };\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: a.js written';

async function rig(extraEnv) {
  const [mockPort, hubPort] = await freePorts(2);
  const r = { script: [], requests: [], log: [] };
  r.mock = createServer((req, res) => {
    if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'unattended', lora: null, models: [] })); }
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let messages = []; try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
      const text = messages.length === 2 ? 'Plan: check the page, write a.js, finish.' : (r.script.length ? r.script.shift() : FINISH);
      r.requests.push(messages);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'unattended', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((ok) => r.mock.listen(mockPort, '127.0.0.1', ok));
  r.dir = mkdtempSync(join(tmpdir(), 'unattended-'));
  writeFileSync(join(r.dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'unattended' } }, history: [], settings: {} }), 'utf8');
  r.hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(hubPort), HUB_DB: join(r.dir, 'hub.json'), AGENT_WORKSPACE: join(r.dir, 'workspace'), AGENT_QUEUE_FILE: join(r.dir, 'queue.json'),
      AGENT_RUNS_DIR: join(r.dir, 'runs'), AGENT_TRACES_DIR: join(r.dir, 'traces'), RUN_INDEX: join(r.dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0', AGENT_UNATTENDED: '0',
      AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  r.hub.stdout.on('data', (d) => r.log.push(String(d))); r.hub.stderr.on('data', (d) => r.log.push(String(d)));
  const API = `http://127.0.0.1:${hubPort}/api`;
  let up = false;
  for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  if (!up) throw new Error('hub did not start: ' + r.log.join('').slice(-400));
  r.api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  r.stop = () => { r.hub.kill(); r.mock.close(); };
  return r;
}

async function runGoal(r, goal) {
  r.script = [OPEN, WRITE, FINISH];
  const st = await r.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 200));
  let run = null, parked = 0; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) {
    run = await r.api('/agent/' + st.runId).catch(() => null);
    if (run?.status === 'awaiting_approval') { parked++; await r.api(`/agent/${st.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: false }) }); continue; }
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  return { run, parked };
}

let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nunattended runs deny instead of parking\n');

const on = await rig({ AGENT_UNATTENDED: '1' });
const a = await runGoal(on, 'Write a.js exporting a, and check notes.html.');
await test('with AGENT_UNATTENDED=1 the run never parks and finishes', () => {
  assert.equal(a.parked, 0, `it parked ${a.parked} time(s)`);
  assert.equal(a.run?.status, 'done', 'status ' + a.run?.status);
});
await test('the model is told it was DENIED because nobody is watching', () => {
  // Search every message: the hub appends the task ledger LAST on each call, so the refusal is not the final one.
  const answer = on.requests.flat().find((m) => m && m.role === 'user' && /TOOL REFUSED \(run_command\)/.test(String(m.content)));
  assert.ok(answer, 'no refusal reached the model');
  assert.match(String(answer.content), /DENIED: .*unattended/i);
});
await test('the denial is on record and the run carried on', () => {
  assert.ok((a.run.steps || []).some((s) => s.type === 'policy_denied' && s.unattended === true), 'no unattended policy_denied step');
  assert.ok(existsSync(join(on.dir, 'workspace', 'a.js')), 'a.js was never written - the run did not carry on');
});
on.stop();

const off = await rig({});
const b = await runGoal(off, 'Write a.js exporting a, and check notes.html.');
await test('without the flag the same action still asks a human (parks)', () => {
  assert.ok(b.parked >= 1, 'the attended run did not park');
});
off.stop();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
