/**
 * transcript.test.mjs - every model call is kept, untrimmed, in <runs>/<id>.transcript.jsonl.
 *
 *   node server/transcript.test.mjs
 *
 * run.history is a context window: pruneHistory drops old messages in place (MAX_HISTORY_MSGS = 16), so the run
 * file cannot say what the model actually said. Set C lost 248 of Qwen3-Coder's 568 replies that way and 75 of
 * 120 recorded runs could not be replayed. This drives the real loop with a scripted mock through enough steps
 * to force pruning, then checks the transcript kept what the history lost:
 *   - the premise: the run file's history really did lose scripted replies (otherwise this proves nothing);
 *   - a 'plan' record holding the planner's reply;
 *   - one 'turn' record per model call, carrying every scripted reply verbatim and in order;
 *   - the first turn sends everything (system prompt included), later turns only what is new since the model
 *     last spoke - which is how the hub's answer to each reply is kept too.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
const FENCE = '`'.repeat(3);
const write = (path, body) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}javascript\n${body}\n${FENCE}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;
const PLAN = 'Plan: write the ten files, then finish.';

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'transcript', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = []; try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = messages.length === 2 ? PLAN : (rig.script.length ? rig.script.shift() : finish('scripted finish'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'transcript', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'transcript-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'transcript' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();

let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nthe full transcript survives history pruning\n');
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-800)); hub.kill(); mock.close(); process.exit(1); }

const SCRIPT = Array.from({ length: 10 }, (_, i) => write(`t${i + 1}.js`, `module.exports = { n: ${i + 1}, tag: 'file-${i + 1}-${'x'.repeat(i)}' };`));
rig.script = [...SCRIPT, finish('wrote ten files')];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create t1.js through t10.js, each exporting its number.' }) });
let run = null;
const deadline = Date.now() + 4 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
const runFile = join(dir, 'runs', `${st.runId}.json`);
const tFile = join(dir, 'runs', `${st.runId}.transcript.jsonl`);
const saved = existsSync(runFile) ? JSON.parse(readFileSync(runFile, 'utf8')) : null;
const lines = existsSync(tFile) ? readFileSync(tFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const turns = lines.filter((l) => l.kind === 'turn');

await test('the run ended and its history was really pruned (the premise)', () => {
  assert.ok(run && TERMINAL.includes(run.status), `run never ended (last ${run?.status})`);
  const kept = (saved.history || []).filter((m) => m.role === 'assistant').map((m) => String(m.content));
  const lost = SCRIPT.filter((t) => !kept.includes(t));
  assert.ok(lost.length > 0, `history kept all ${SCRIPT.length} scripted replies - pruning never happened, so this test proves nothing`);
});
await test('a transcript file exists beside the run file', () => { assert.ok(existsSync(tFile), 'no ' + tFile); });
await test('the planner call is recorded with its reply', () => {
  const plan = lines.find((l) => l.kind === 'plan');
  assert.ok(plan, 'no plan record'); assert.equal(plan.reply, PLAN); assert.equal(plan.sent.length, 2);
});
await test('one turn record per model call', () => { assert.equal(turns.length, saved.modelCalls, `turns ${turns.length} vs modelCalls ${saved.modelCalls}`); });
await test('every scripted reply is in the transcript, verbatim and in order', () => {
  const replies = turns.map((t) => t.reply);
  let k = 0; for (const t of SCRIPT) { const at = replies.indexOf(t, k); assert.ok(at >= 0, 'missing or out of order: ' + t.slice(0, 60)); k = at + 1; }
});
await test('the first turn sends everything, later turns only what is new', () => {
  assert.ok(turns[0].sent.some((m) => m.role === 'system'), 'first turn has no system prompt');
  assert.ok(turns.slice(1).every((t) => !t.sent.some((m) => m.role === 'system')), 'a later turn repeats the system prompt');
  assert.ok(turns.slice(1).every((t) => !t.sent.some((m) => m.role === 'assistant')), 'a later turn repeats an assistant message');
  assert.ok(turns.slice(1, 6).every((t) => t.sent.some((m) => /TOOL RESULT \(write_file\)/.test(String(m.content)))), 'the hub\'s answer to a write is not in the next turn');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
