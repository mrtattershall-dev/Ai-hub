/**
 * connRetry.test.mjs - a dropped model connection is retried in the run, not left for a human to Resume.
 *
 *   node server/connRetry.test.mjs
 *
 * Set E (2026-09-11), base 14B, goal 4: a runaway 35,113-char reply, then the next call's stream closed before any
 * content ("Premature close"). isConnError classed it resumable, so the run paused as 'interrupted' - and in an
 * unattended run nobody presses Resume: the goal was lost to one network blip. Nothing had run and nothing had entered
 * the history, so the same call can simply be made again.
 *
 *   goal 1  three separate drops, each followed by a good call -> the run finishes 'done', the file is written, three
 *           retry notes, and no pause (three drops > AGENT_CONN_RETRIES=2 proves the count resets after a good call)
 *   goal 2  a backend that drops every call -> still pauses as 'interrupted', after exactly 2 retries (bounded)
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
const DROP = 'DROP';
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}javascript\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na dropped model connection is retried, not paused\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], always: false, drops: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'drop', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write the file, finish.' : (rig.always ? DROP : (rig.script.length ? rig.script.shift() : FINISH));
    if (text === DROP) {
      // Headers out, then the socket dies with no body: the hub sees the stream fail before any content.
      rig.drops++;
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.flushHeaders();
      return setTimeout(() => res.socket.destroy(), 30);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'drop', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'connretry-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'drop' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0', AGENT_CONN_RETRIES: '2', AGENT_CONN_RETRY_MS: '20',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
async function runGoal(goal) {
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return run;
}
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }
const retryNotes = (run) => (run?.steps || []).filter((s) => s.type === 'note' && /connection dropped/.test(String(s.text)));
const paused = (run) => (run?.steps || []).filter((s) => s.type === 'error' && /Run paused/.test(String(s.text)));

rig.script = [DROP, write('a.js', 'module.exports = { a: 1 };'), DROP, write('b.js', 'module.exports = { b: 2 };'), DROP, FINISH];
const g1 = await runGoal('Create a.js and b.js.');
await test('three separate drops are each retried and the run finishes', () => {
  assert.equal(rig.drops, 3, 'the mock dropped ' + rig.drops + ' times (the premise)');
  assert.equal(g1?.status, 'done', 'status ' + g1?.status + ': ' + JSON.stringify(paused(g1).map((s) => s.text)).slice(0, 300));
  assert.ok(existsSync(join(dir, 'workspace', 'a.js')) && existsSync(join(dir, 'workspace', 'b.js')), 'the files the retried calls asked for were not written');
});
await test('each retry is a visible note, and nothing paused the run', () => {
  assert.equal(retryNotes(g1).length, 3, 'retry notes: ' + retryNotes(g1).length);
  assert.equal(paused(g1).length, 0, 'the run was paused');
});

rig.always = true; rig.drops = 0;
const g2 = await runGoal('Create c.js.');
await test('a backend that always drops still pauses - after exactly 2 retries', () => {
  assert.equal(g2?.status, 'interrupted', 'status ' + g2?.status);
  assert.equal(retryNotes(g2).length, 2, 'retry notes: ' + retryNotes(g2).length);
  assert.equal(rig.drops, 3, 'calls to the dropping backend: ' + rig.drops + ' (1 + 2 retries)');
  assert.equal(paused(g2).length, 1, 'no pause step');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
