/**
 * budgetAccounting.test.mjs - the budgets must count what the run actually spent.
 *
 *   node server/budgetAccounting.test.mjs
 *
 * Two findings from the 2026-09-11 audit, both confirmed by reading the code:
 *
 * 1. TIME SPENT PAUSED IS CHARGED. budgetExhausted measures from run.budgetStart, and budgetStart is written in
 *    exactly three places: sub-task creation, run creation, and the follow-up route (agent.js:2462, 3901, 4259).
 *    POST /:id/resume (agent.js:4219) is NOT one of them. So a run interrupted at minute 20 - a dropped tunnel, a
 *    laptop asleep, which is what cut set E short - and resumed later is billed for every minute it was not running,
 *    and can be stopped with ZERO turns executed. Nothing distinguishes that from a genuine overrun: the message
 *    reads "ran out of time budget", and a repair goal is queued that starts the work again from nothing.
 *    The comment above budgetExhausted reasons about exactly this hazard for FOLLOW-UPS and gives them a fresh
 *    clock; resume never got the same treatment.
 *
 * 2. RETRIES ARE CHARGED AS STEPS. run.modelCalls is incremented at the top of every turn, and both recovery paths -
 *    a context squash and a dropped connection - `continue` back to that top, so each retry costs a step from
 *    AGENT_MAX_STEPS. With the drop retry now waiting 15s then 30s, a flapping endpoint can spend a fifth of a
 *    30-call budget on calls that produced no assistant turn, and the run is then reported as "ran out of step
 *    budget" - the wrong diagnosis, which produces the wrong repair.
 *
 * These cases pin the behaviour so a fix can be measured; they do not assert a fix. Cases named "(known)" document
 * the current failure and are expected to fail until the accounting changes.
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
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nbudgets count what the run actually spent\n');

const [mockPort, hubPort] = await freePorts(2);
// `drops` makes the next N model calls fail the way a dropped tunnel does: the socket is destroyed mid-flight.
const rig = { script: [], drops: 0, dropped: 0, hold: false, log: [], calls: 0 };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'bud', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', async () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    // Drop only a REAL turn, never the planner call: dropping the planner is a different code path (it is caught and
    // the run continues without a plan), so it would not exercise the retry ladder at all. Counted out loud so the
    // premise can say what actually happened instead of assuming.
    if (rig.drops > 0 && m.length > 2) { rig.drops--; rig.dropped++; return res.socket.destroy(); }
    rig.calls++;
    const planner = m.length === 2;
    if (!planner && !rig.script.length && rig.hold) { await sleep(120000); return; }
    const text = planner ? 'Plan: work.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'bud', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'budget-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'bud' } }, history: [], settings: {} }), 'utf8');
const ENV = { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
  AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
  AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
  AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '90', AGENT_CONN_RETRY_MS: '200',
  MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' };
const API = `http://127.0.0.1:${hubPort}/api`;
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
async function boot() {
  const h = spawn(process.execPath, [join(HERE, 'index.js')], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  h.stdout.on('data', (d) => rig.log.push(String(d))); h.stderr.on('data', (d) => rig.log.push(String(d)));
  for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); return h; } catch { await sleep(250); } }
  console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); h.kill(); mock.close(); process.exit(1);
}
let hub = await boot();

// ── 1. retries charged as steps ──
rig.drops = 2;                       // two dropped connections, then it works
rig.script = [write('a.js', 'const a = 1;'), FINISH];
const st1 = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create a.js.' }) });
let r1 = null;
for (let i = 0; i < 400; i++) { r1 = await api('/agent/' + st1.runId).catch(() => null); if (r1 && TERMINAL.includes(r1.status) && r1.busy !== true) break; await sleep(300); }
// The drops are injected by destroying the socket, which the hub treats as a RESUMABLE pause - so after the retries
// the run parks as 'interrupted' rather than finishing, and measuring modelCalls on it measures the wrong run.
// What discriminates the accounting question is narrower and does not need the run to finish: how many model calls
// the hub charged for a turn that produced no assistant reply.
await test('the premise: the drops were served and the run kept going', () => {
  assert.ok(r1, 'the run vanished');
  assert.ok(rig.dropped >= 1, `no turn was ever dropped (dropped ${rig.dropped}, answered ${rig.calls}, status ${r1.status})`);
  assert.ok((r1.steps || []).some((s) => s.type === 'tool'), `no tool step ran after the drops - status ${r1.status}, dropped ${rig.dropped}, answered ${rig.calls}`);
});
await test('(known) a retried call does not spend a step from the budget', () => {
  // One planner call + one real turn reached the model (rig.calls counts only calls actually answered). Anything
  // charged beyond that is a dropped attempt billed as a step.
  const answered = rig.calls;
  assert.ok((r1.modelCalls || 0) <= answered, `modelCalls ${r1.modelCalls} but only ${answered} call(s) were ever answered - the dropped attempts were charged as steps`);
});

// ── 2. paused time charged ──
rig.hold = true;
rig.script = [write('b.js', 'const b = 1;')];        // then the script runs dry and the run parks, mid-flight
const st2 = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create b.js.' }) });
for (let i = 0; i < 240; i++) {
  const r = await api('/agent/' + st2.runId).catch(() => null);
  if ((r?.steps || []).some((s) => s.type === 'tool')) break;
  await sleep(250);
}
await sleep(1200);
hub.kill('SIGKILL'); await sleep(800);

// Age the run on disk: it was interrupted 100 minutes ago, well past AGENT_MAX_MINUTES of 90.
const runFile = join(dir, 'runs', st2.runId + '.json');
const saved = JSON.parse(readFileSync(runFile, 'utf8'));
saved.budgetStart = Date.now() - 100 * 60000;
saved.createdAt = Date.now() - 100 * 60000;
writeFileSync(runFile, JSON.stringify(saved));

rig.hold = false;
rig.script = [write('c.js', 'const c = 1;'), FINISH];
hub = await boot();
await api('/agent/' + st2.runId + '/resume', { method: 'POST', body: '{}' }).catch(() => null);
let r2 = null;
for (let i = 0; i < 400; i++) {
  r2 = await api('/agent/' + st2.runId).catch(() => null);
  if (r2 && TERMINAL.includes(r2.status) && r2.busy !== true && r2.status !== 'interrupted') break;
  await sleep(300);
}
const callsBefore = saved.modelCalls || 0;
await test('the premise: the run was interrupted and then resumed', () => {
  assert.ok(r2, 'the run vanished');
  assert.notEqual(r2.status, 'interrupted', 'resume never took effect');
});
await test('(known) a resumed run is not killed by time it spent paused', () => {
  const stoppedOnTime = (r2.steps || []).some((s) => s.type === 'error' && /time budget/i.test(String(s.text || '')));
  assert.ok(!stoppedOnTime, 'stopped for a 90-minute budget it spent asleep');
});
await test('(known) and it gets to take at least one turn after being resumed', () => {
  assert.ok((r2.modelCalls || 0) > callsBefore, `modelCalls did not move (${callsBefore} -> ${r2.modelCalls}) - the run died before acting`);
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
process.exit(failed ? 1 : 0);
