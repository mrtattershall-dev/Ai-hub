/**
 * finishEvidence.test.mjs - the finish gate must not let a run finish on top of its own failing test.
 *
 *   node server/finishEvidence.test.mjs
 *
 * The gate verifies the file the goal names (verifier.verify on the goal entry). It never looked at what the agent
 * itself ran. So a 7b that writes a self-check, runs it, gets EXIT: 1 and then says finish was judged only on
 * whether the entry file runs - and an entry that runs while its own test fails was recorded "Verified". The same
 * shape sank a published result elsewhere: ATLAS (inferstep/ATLAS, read 2026-10-21) returned its best FAILING
 * candidate and the agent was told to finish.
 *
 * AGENT_FINISH_EVIDENCE=1: when the last run_command/run_python of the run exited non-zero, finish is blocked (one
 * of the gate's three blocks) and the model is told which command failed. Off by default, so frozen experiments run
 * on exactly the gate they were frozen against.
 *
 *   - flag ON, last self-test failed      -> not finished on that turn; the block names the failing command
 *   - flag ON, last self-test passed      -> finishes, Verified (control: the rule is not "always block")
 *   - flag OFF, last self-test failed     -> exactly today's behaviour: Verified on the entry file alone
 *   - the pure check over steps, both ways (positive control: it can say "failed" and can say "fine")
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { lastSelfTestFailure } from './finishEvidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FINISH = 'THOUGHT: the work is complete.\nACTION: finish\nSUMMARY: done';
const runCmd = (c) => `THOUGHT: run my check.\nACTION: run_command\nCOMMAND: ${c}`;
const FENCE = '`'.repeat(3);
// The run must land a write of its own, or the gate's NO_WORK rule (correct, and not under test here) refuses first.
const CALC = 'function add(a, b) { return a - b; }\nmodule.exports = { add };\nconsole.log("calc loaded");';
const writeCalc = `THOUGHT: writing calc.js.\nACTION: write_file\nPATH: calc.js\n${FENCE}js\n${CALC}\n${FENCE}`;
let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};
console.log('\nthe finish gate reads the agent\'s own last test\n');

// ── the pure check ──
const step = (n, tool, result, extra = {}) => ({ n, type: 'tool', tool, result, ...extra });
await test('pure: a last command that exited 1 is reported, with the command', () => {
  const f = lastSelfTestFailure([step(1, 'write_file', 'OK: wrote 10 bytes'), step(2, 'run_command', 'STDOUT:\nboom\nEXIT: 1', { args: { cmd: 'node t.js' } })]);
  assert.ok(f, 'not reported'); assert.equal(f.step, 2); assert.match(f.command, /node t\.js/);
});
await test('pure: a later passing run clears an earlier failure', () => {
  assert.equal(lastSelfTestFailure([step(1, 'run_command', 'EXIT: 1'), step(2, 'run_python', 'STDOUT:\nok\nEXIT: 0')]), null);
});
await test('pure: no command at all is not a failure (other gates handle never-ran)', () => {
  assert.equal(lastSelfTestFailure([step(1, 'write_file', 'OK')]), null);
});
await test('pure: a refused command (no EXIT line) is not read as a test that failed', () => {
  assert.equal(lastSelfTestFailure([step(1, 'run_command', 'ERROR: denied by policy')]), null);
});

// ── through the real gate ──
const [mockPort, hubPort, hubPort2] = await freePorts(3);
const rig = { script: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: the file is written; run its check, then finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'gate', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

async function hubWith(port, flag) {
  const dir = mkdtempSync(join(tmpdir(), 'finevid-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  // The entry RUNS (so the verifier passes it); the agent's own check of it does not.
  writeFileSync(join(ws, 'calc.js'), 'function add(a, b) { return a - b; }\nmodule.exports = { add };\nconsole.log("calc loaded");\n');
  writeFileSync(join(ws, 'check_bad.js'), 'const { add } = require("./calc.js");\nif (add(2, 3) !== 5) { console.error("add(2,3) =", add(2, 3)); process.exit(1); }\nconsole.log("ok");\n');
  writeFileSync(join(ws, 'check_good.js'), 'const { add } = require("./calc.js");\nif (typeof add !== "function") process.exit(1);\nconsole.log("ok");\n');
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'gate' } }, history: [], settings: {} }));
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(port), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_META_DIR: join(dir, 'meta'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0', AGENT_WORKER_EXEC: '', AGENT_GOVERNED_WRITES: '',
      AGENT_FINISH_EVIDENCE: flag, WATCHERS: '0',
      AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = []; hub.stdout.on('data', (d) => log.push(String(d))); hub.stderr.on('data', (d) => log.push(String(d)));
  const API = `http://127.0.0.1:${port}/api`;
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  if (!up) throw new Error('hub did not start\n' + log.join('').slice(-600));
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  const runGoal = async (goal, script) => {
    rig.script = [...script];
    const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
    let run = null; const deadline = Date.now() + 4 * 60000;
    while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
    return run;
  };
  return { hub, runGoal };
}
const errors = (run) => (run?.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || ''));
const notes = (run) => (run?.steps || []).filter((s) => s.type === 'note').map((s) => String(s.text || '')).join('\n');
// The FIRST finish must be refused; the script then offers no fix, so later finishes walk the 3-block cap. What is
// asserted is the refusal on the failing test - the gate's existing cap behaviour is not this rule's business.
const GOAL = 'Check that add() in calc.js is correct and finish.';

const on = await hubWith(hubPort, '1');
const bad = await on.runGoal(GOAL, [writeCalc, runCmd('node check_bad.js'), FINISH]);
await test('flag ON: finish is refused when the agent\'s own last test exited non-zero', () => {
  const block = errors(bad).find((t) => /last (self-)?test|exited non-zero/i.test(t));
  assert.ok(block, 'no evidence block: ' + errors(bad).join(' | ').slice(0, 300));
  assert.match(block, /check_bad\.js/, 'the block does not name the failing command: ' + block);
});
await test('flag ON: such a run is never recorded Verified on the strength of the entry file', () => {
  assert.ok(!/Verified \(/.test(notes(bad)), 'recorded Verified over a failing self-test: ' + notes(bad).slice(0, 200));
});
const good = await on.runGoal(GOAL, [writeCalc, runCmd('node check_good.js'), FINISH]);
await test('flag ON, control: a passing self-test finishes Verified', () => {
  assert.equal(good.status, 'done', 'blocked a passing check: ' + errors(good).join(' | ').slice(0, 300));
  assert.ok(!errors(good).some((t) => /last (self-)?test|exited non-zero/i.test(t)), 'the evidence rule fired on a pass');
  assert.match(notes(good), /Verified/);
});
on.hub.kill();

const off = await hubWith(hubPort2, '');
const legacy = await off.runGoal(GOAL, [writeCalc, runCmd('node check_bad.js'), FINISH]);
await test('flag OFF: unchanged - the gate does not read the self-test (frozen experiments keep their gate)', () => {
  assert.ok(!errors(legacy).some((t) => /last (self-)?test/i.test(t)), 'the rule fired with the flag off');
  assert.equal(legacy.status, 'done');
  // The scenario must reproduce the hole, or the flag-ON checks above prove nothing: today's gate DOES record this
  // run Verified, on the entry file alone, with the agent's own test failing.
  assert.match(notes(legacy), /Verified \(/, 'the scenario does not reproduce the hole: ' + notes(legacy).slice(0, 200));
});
off.hub.kill(); mock.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
