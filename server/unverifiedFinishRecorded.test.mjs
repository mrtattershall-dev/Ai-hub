/**
 * unverifiedFinishRecorded.test.mjs - a finish that was never verified says so in the records that outlive the run.
 *
 *   node server/unverifiedFinishRecorded.test.mjs
 *
 * Audited 2026-09-12, after set G. A run can reach status 'done' without ever being verified, by two routes:
 *
 *   1. the finish gate steps aside after 3 blocks: run.forcedFinish = true, an UNVERIFIED note is pushed, status 'done'
 *   2. `cleanTests >= 3` inside the test_web handler sets status 'done' and `break turn`s - so it never enters the
 *      finish branch at all, and bypasses the ledger gate, the plan-FILES gate, the re-test gate, the VISUAL check and
 *      the runtime verifier. It sets NO marker of any kind.
 *
 * Neither route is distinguishable afterwards in either record that outlives the run:
 *   - run-index.jsonl (the series kept forever to answer "is this getting better?") stores `status: run.status` and no
 *     verification field. It can never be back-filled: the only copy of forcedFinish lives in run JSONs capped at 40 in
 *     memory and 300 on disk, and reaped.
 *   - traces.jsonl (the fine-tuning corpus) stores `status: run.status`, and saveTrace maps steps to {type, tool, path},
 *     so the UNVERIFIED note arrives as a bare {"type":"note"} with its text stripped. Measured on the live corpus:
 *     2161 of 3303 rows have note steps and every one is text-free. Set G: all 8 runs with forcedFinish:true appear in
 *     traces as plain status "done".
 *
 * So unverified code enters the training corpus labelled as success, and the kept-forever series cannot tell a forced
 * finish from a clean one. This test pins the contract: whatever the route, the durable records carry the verdict.
 *
 * Cases marked "(known)" are expected to fail until that lands.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const addTask = (t) => `THOUGHT: noting work.\nACTION: task_add\nTEXT: ${t}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: finished';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nan unverified finish is recorded as one\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'unver', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write it and finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'unver', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'unver-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
const INDEX = join(dir, 'index.jsonl');
const TRACES = join(dir, 'traces');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'unver' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: TRACES, RUN_INDEX: INDEX,
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }
async function runGoal(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return run;
}
const indexRows = () => (existsSync(INDEX) ? readFileSync(INDEX, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const traceRows = () => {
  const f = join(TRACES, 'traces.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
};

// A forced finish: three open ledger tasks the model never closes, so the gate blocks three times and steps aside.
const forced = await runGoal('Create app.js and finish.', [
  write('app.js', 'console.log("hi");'),
  addTask('polish the output'), addTask('add a second feature'), addTask('write a readme'),
  FINISH, FINISH, FINISH, FINISH,
]);
await test('the premise: the run was forced to finish unverified', () => {
  assert.equal(forced?.status, 'done', 'status: ' + forced?.status);
  assert.equal(forced?.forcedFinish, true, 'forcedFinish on the run object: ' + forced?.forcedFinish);
  assert.ok((forced?.finishBlocks || 0) >= 3, 'finishBlocks: ' + forced?.finishBlocks);
});
await test('(known) the run index says this finish was not verified', () => {
  const row = indexRows().find((r) => r.id === forced.id);
  assert.ok(row, 'no index row for the run at all');
  const marks = JSON.stringify(row);
  assert.match(marks, /unverified|forcedFinish|finishKind/,
    'the kept-forever series cannot tell this from a clean finish: ' + marks.slice(0, 240));
});
await test('(known) and so does the training trace', () => {
  const row = traceRows().find((r) => r.id === forced.id);
  assert.ok(row, 'no trace row for the run at all');
  const marks = JSON.stringify(row).slice(0, 400);
  assert.match(marks, /unverified|forcedFinish|finishKind/,
    'unverified code enters the corpus labelled as success: ' + marks);
});
await test('control: the index and the trace both exist and carry the status', () => {
  const i = indexRows().find((r) => r.id === forced.id);
  const t = traceRows().find((r) => r.id === forced.id);
  assert.equal(i?.status, 'done');
  assert.equal(t?.status, 'done');
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 2;   // the index and the trace; both fixed by carrying one verdict into both records
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
