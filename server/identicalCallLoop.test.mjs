/**
 * identicalCallLoop.test.mjs - a run that repeats an identical SUCCESSFUL call is stopped.
 *
 *   node server/identicalCallLoop.test.mjs
 *
 * THE DEFECT, measured 2026-09-13 on a real hub run (qwen2.5:1.5b, level 1, 20-minute wall):
 * the model wrote the same 53-byte add.js EIGHT times. Every write SUCCEEDED, every one after the first
 * carried the "You already ran this exact write_file" notice, and nothing stopped the run - it ground to
 * its time budget with the correct file already on disk.
 *
 * Why nothing stopped it. The repetition stop compares three identical REPLIES, and this model varied
 * its THOUGHT prose every turn while sending a byte-identical CALL. `run.repeatCalls` counted the
 * identical calls correctly and NOTHING WAS WIRED TO IT. `repeatFailures` only counts answers matching
 * /^ERROR/, and these all succeeded. Across the corpus: 264 of the 14B's 279 repeats SUCCEEDED, so
 * repeatFailures saw 15 of 279. The detector fired and had no consumer - the house pattern.
 *
 * THE THRESHOLD IS FORCED, NOT CHOSEN. repeatCall.test.mjs scripts read, read, list_dir, read, read and
 * asserts every later call is NAMED as a repeat - 3 per-key repeats - so a threshold of 3 would stop
 * that run and break it. Hence >= 4, with no distinct call in between (case 4 below is that control).
 *
 * THE PREMISE THAT MAKES THIS NON-VACUOUS is case 2. If the REPLY guard ends the run, everything else
 * here passes for the wrong reason and the fixture proves nothing - which is how earlier versions of
 * unverifiedFinishRecorded's and repeatGuardFairness's fixtures went wrong. So the THOUGHT differs on
 * every reply (repeatCall.test.mjs records the same requirement) and case 2 asserts no /same response/
 * step exists.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);

// The CALL is byte-identical every time; only the THOUGHT changes. That is the whole point: it is
// invisible to a guard that compares replies, and visible to one that compares calls.
let nth = 0;
const sameWrite = () => `THOUGHT: writing it again (attempt ${++nth}).\nACTION: write_file\nPATH: x.js\n${FENCE}\n`
  + `function x() { return 1; }\nmodule.exports = { x };\n${FENCE}`;
const read = (p) => `THOUGHT: reading ${p} (look ${++nth}).\nACTION: read_file\nPATH: ${p}`;
const list = () => 'THOUGHT: looking around.\nACTION: list_dir\nPATH: .';
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${String(e.message).split('\n').slice(0, 4).join('\n        ')}`); }
};

console.log('\nan identical SUCCESSFUL call, repeated, stops the run\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'callloop', lora: null, models: [] }));
  }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    // m.length === 2 is the PLANNER call, which happens before the loop and must not eat a scripted reply.
    const text = m.length === 2 ? 'Plan: write the file.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'callloop', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'callloop-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'callloop' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d)));
hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

async function runGoal(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) {
    run = await api('/agent/' + st.runId).catch(() => null);
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  return run;
}
const steps = (run) => (run?.steps || []);
const tools = (run) => steps(run).filter((s) => s.type === 'tool');
const NOTE = /You already ran this exact/;
// repeatGuardFairness.test.mjs:84 uses exactly this predicate for the REPLY guard.
const stoppedForReply = (run) => steps(run).some((s) => s.type === 'error' && /same response/i.test(String(s.text || '')));
const stoppedForCall = (run) => steps(run).some((s) => s.type === 'error' && /the same call/i.test(String(s.text || '')));

// ── THE DEFECT: six byte-identical successful writes, each with different prose ───────────────
const loop = await runGoal('Write x.js.', [sameWrite(), sameWrite(), sameWrite(), sameWrite(), sameWrite(), sameWrite(), FINISH]);
const writes = tools(loop).filter((s) => s.tool === 'write_file');

await test('PREMISE: at least 5 identical write_file calls reached the tool', () => {
  assert.ok(writes.length >= 5, 'write_file calls: ' + writes.length + ' (status ' + loop?.status + ')');
});
await test('PREMISE: every write after the first was NAMED as a repeat', () => {
  const named = writes.slice(1).filter((s) => NOTE.test(String(s.result || '')));
  assert.ok(named.length >= 4, 'only ' + named.length + ' of ' + (writes.length - 1) + ' carried the repeat notice');
});
await test('PREMISE: the REPLY guard did NOT end this run (or the fixture proves nothing)', () => {
  assert.ok(!stoppedForReply(loop), 'ended by the reply guard, so the call guard was never exercised');
});
await test('THE FIX: the run is STOPPED, naming the repeated call', () => {
  assert.equal(loop?.status, 'stopped', 'status was ' + loop?.status + ' - the identical-call loop did not stop it');
  assert.ok(stoppedForCall(loop), 'stopped, but no step names the repeated call: '
    + JSON.stringify(steps(loop).filter((s) => s.type === 'error').map((s) => String(s.text || '').slice(0, 90))));
});
await test('THE FIX: it stops EARLY, not at the step budget', () => {
  assert.ok(writes.length <= 7, 'took ' + writes.length + ' identical writes before stopping');
});

// ── CONTROL 1: repeatCall.test.mjs's exact shape must still finish ───────────────────────────
const fair = await runGoal('Read it twice.', [write('r.js', 'const a = 1;'), read('r.js'), read('r.js'), list(), read('r.js'), read('r.js'), FINISH]);
await test('CONTROL: 4 identical reads with a different call between still finishes', () => {
  assert.ok(!stoppedForCall(fair), 'the call guard stopped a run repeatCall.test.mjs requires to continue');
  assert.equal(fair?.status, 'done', 'status was ' + fair?.status);
});

// ── CONTROL 2: two identical calls are not a loop ────────────────────────────────────────────
const twice = await runGoal('Write y.js.', [write('y.js', 'const y = 1;'), write('y.js', 'const y = 1;'), FINISH]);
await test('CONTROL: two identical calls do NOT stop the run', () => {
  assert.ok(!stoppedForCall(twice), 'stopped after only two identical calls');
});

console.log(`\n${passed} passed, ${failed} failed`);
hub.kill(); mock.close();
process.exit(failed ? 1 : 0);
