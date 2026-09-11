/**
 * rollbackCarryover.test.mjs - the end-of-run syntax rollback names what it removed, and the NEXT goal is told.
 *
 *   node server/rollbackCarryover.test.mjs
 *
 * When a file does not parse at the end of a run, the hub restores the newest committed version that does. That is
 * right - never leave a file that will not run - but in set D (2026-09-11) the restored version predated functions
 * the run had just written correctly: Qwen3-Coder's goal 43 lost earliestStart and goal 93 lost ready() this way.
 * The note said only "restored the last committed version", nothing reached the next goal, and the hidden checks
 * found the holes at the end.
 *
 *   goal 1  writes a.js with one(), then a broken rewrite that adds two(); the step budget ends the run and the
 *           rollback restores the version with only one()
 *           -> the run's note names two() as removed
 *   goal 2  -> its first model call carries a task to re-add two() to a.js
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
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}javascript\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nthe end-of-run rollback names what it removed and tells the next goal\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'rollback', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = m.length === 2;
    const text = planner ? 'Plan: write a.js, extend it.' : (rig.script.length ? rig.script.shift() : FINISH);
    rig.requests.push({ planner, messages: m });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'rollback', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'rollback-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'rollback' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '2', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

const GOOD = 'function one() { return 1; }\nmodule.exports = { one };';
const BROKEN = 'function one() { return 1; }\nfunction two() { return 2;\nmodule.exports = { one, two };';
const g1 = await runGoal('Create a.js with one(), then add two().', [write('a.js', GOOD), write('a.js', BROKEN)]);

await test('the rollback happened and restored the version that parses', () => {
  const note = (g1.run?.steps || []).find((s) => s.type === 'note' && /did not parse at the end of the run/.test(String(s.text)));
  assert.ok(note, 'no rollback note (status ' + g1.run?.status + '): ' + JSON.stringify((g1.run?.steps || []).map((s) => s.type + ' ' + String(s.text || '').slice(0, 60))).slice(0, 400));
  assert.equal(readFileSync(join(dir, 'workspace', 'a.js'), 'utf8').trim(), GOOD);
});
await test('the rollback note names what it removed', () => {
  const note = (g1.run?.steps || []).find((s) => s.type === 'note' && /did not parse at the end of the run/.test(String(s.text)));
  assert.match(String(note && note.text), /removed: two\b/, String(note && note.text));
});
const g2 = await runGoal('Add three() to the EXISTING a.js.', [FINISH]);
await test('the next goal is told to re-add what was lost', () => {
  const first = g2.reqs.find((r) => !r.planner) || g2.reqs[0];
  assert.ok(first, 'the next goal never called the model');
  const all = first.messages.map((m) => String(m.content)).join('\n');
  assert.match(all, /Re-add two[^\n]*a\.js/, 'no carried-over task in the next goal\'s first call');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
