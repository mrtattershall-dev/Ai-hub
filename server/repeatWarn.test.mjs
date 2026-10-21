/**
 * repeatWarn.test.mjs - REL-1's treatment (benchmarks/REL-1_REPEAT-WARN_PREREG.md, frozen at be11fb53).
 *
 *   node server/repeatWarn.test.mjs
 *
 * AGENT_REPEAT_WARN=1: the FIRST time either repetition guard would stop a run, the model is warned instead; the
 * SECOND detection stops it exactly as the control does. One warning per run, across both guards.
 *
 *   reply guard (identical replies)      flag off: stops, no warning   |  flag on: one warning, later the same stop
 *   call guard  (identical calls that SUCCEED, with different replies)  -  the same pair of checks
 *   the warning reaches the model (it is in the run's history) and names what was repeated
 *   sensitivity: the flag-on run makes MORE model calls than flag-off on the same script, so the arms differ
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
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nREL-1: warn once before the repetition guards stop\n');

// Reply guard: the byte-identical reply, every turn, asking for a file that is not there - an identical FAILURE,
// so the call guard (which stops on identical SUCCESSES) is not the one that fires. A byte-identical list_dir hits the
// substitution pardon and then the call guard first, which is the hub's ordering and not this case.
const SAME_REPLY = 'THOUGHT: read the notes.\nACTION: read_file\nPATH: missing_notes.txt';
// Call guard: the same SUCCEEDING call, with a different reply each turn so the reply guard cannot be what fires.
const sameCall = (i) => `THOUGHT: checking the directory again, attempt ${i}.\nACTION: list_dir\nPATH: .`;

const [mockPort, ...ports] = await freePorts(5);
const rig = { reply: () => SAME_REPLY, n: 0 };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: list the directory.' : rig.reply(rig.n++);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'rep', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

async function runOnce(port, flag, reply) {
  const dir = mkdtempSync(join(tmpdir(), 'repwarn-'));
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'a.txt'), 'x\n');
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'rep' } }, history: [], settings: {} }));
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(port), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_META_DIR: join(dir, 'meta'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0', AGENT_WORKER_EXEC: '', AGENT_GOVERNED_WRITES: '',
      AGENT_REPEAT_WARN: flag, WATCHERS: '0',
      AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const API = `http://127.0.0.1:${port}/api`;
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  if (!up) { hub.kill(); throw new Error('hub did not start'); }
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  rig.reply = reply; rig.n = 0;
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'List the files in the workspace.' }) });
  let run = null; const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  hub.kill();
  // GET /agent/:id leaves history out on purpose; the persisted run file holds what the model was actually sent.
  const onDisk = JSON.parse(readFileSync(join(dir, 'runs', `${st.runId}.json`), 'utf8'));
  return { run, history: onDisk.history || [] };
}
const errors = (r) => (r.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || ''));
const warnings = (r) => (r.steps || []).filter((s) => s.type === 'note' && /Repeat warned/.test(String(s.text || '')));
// Both wordings of the reply guard: "same response", or "identical answer" when its repeats were tool refusals.
const REPLY_STOP = /produced the same response \d+ times|returned the identical answer \d+ times/;
const CALL_STOP = /was sent \d+ times and SUCCEEDED every time/;

const replyOff = await runOnce(ports[0], '', () => SAME_REPLY);
const replyOn = await runOnce(ports[1], '1', () => SAME_REPLY);
await test('reply guard, flag off: stops on the repeat, with no warning (control unchanged)', () => {
  assert.equal(replyOff.run.status, 'stopped'); assert.ok(errors(replyOff.run).some((t) => REPLY_STOP.test(t)), errors(replyOff.run).join(' | '));
  assert.equal(warnings(replyOff.run).length, 0);
});
await test('reply guard, flag on: warned exactly once, then the same stop', () => {
  assert.equal(warnings(replyOn.run).length, 1, 'warnings: ' + warnings(replyOn.run).length);
  assert.equal(replyOn.run.status, 'stopped'); assert.ok(errors(replyOn.run).some((t) => REPLY_STOP.test(t)), errors(replyOn.run).join(' | '));
});
await test('reply guard, flag on: the warning reached the model and names the repetition', () => {
  assert.ok(replyOn.history.some((m) => m.role === 'user' && /repeat/i.test(String(m.content)) && /DIFFERENT/.test(String(m.content))), 'no warning in the history the model was sent');
});
await test('sensitivity: the warned run made more model calls than the control on the same script', () => {
  assert.ok(replyOn.run.modelCalls > replyOff.run.modelCalls, `${replyOn.run.modelCalls} vs ${replyOff.run.modelCalls}`);
});

const callOff = await runOnce(ports[2], '', sameCall);
const callOn = await runOnce(ports[3], '1', sameCall);
await test('call guard, flag off: stops on the repeated succeeding call, with no warning', () => {
  assert.equal(callOff.run.status, 'stopped'); assert.ok(errors(callOff.run).some((t) => CALL_STOP.test(t)), errors(callOff.run).join(' | '));
  assert.equal(warnings(callOff.run).length, 0);
});
await test('call guard, flag on: warned exactly once, then the same stop', () => {
  assert.equal(warnings(callOn.run).length, 1, 'warnings: ' + warnings(callOn.run).length);
  assert.equal(callOn.run.status, 'stopped', 'ended ' + callOn.run.status + ': ' + errors(callOn.run).join(' | ')); assert.ok(errors(callOn.run).some((t) => CALL_STOP.test(t)), errors(callOn.run).join(' | '));
});

mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
