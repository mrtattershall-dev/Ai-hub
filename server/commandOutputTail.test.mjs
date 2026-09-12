/**
 * commandOutputTail.test.mjs - a command's exit code and error output survive a large stdout.
 *
 *   node server/commandOutputTail.test.mjs
 *
 * Audited 2026-09-11, agent.js:1012 (run_command) and :1041 (run_python), identical shape:
 *
 *     const out = [
 *       stdout && `STDOUT:\n${stdout}`,
 *       stderr && `STDERR:\n${stderr}`,
 *       err && err.killed && `(timed out after ...)`,
 *       `EXIT: ${err ? (err.code ?? 1) : 0}`,
 *     ].filter(Boolean).join('\n');
 *     res(out.slice(0, 8_000));
 *
 * STDOUT is assembled FIRST and EXIT LAST, and the slice cuts from the FRONT. So for any command that prints more
 * than ~8k of stdout and then fails, the model is handed a wall of passing lines with:
 *   - no STDERR section - the failing assertion is gone;
 *   - no EXIT line - there is nothing to say it failed;
 *   - no marker that anything was dropped.
 * A verbose test runner that fails on its last case reads as unambiguous success. And batchStepFailed decides a command
 * failed by the result ENDING in a non-zero `EXIT:`, so with the exit line cut away the batch also treats it as a pass
 * and runs every following action on the assumption it worked. withAssertEvidence runs on the already-truncated string,
 * so a cut-off traceback yields no assert evidence either.
 *
 * `npm test`, a pytest run, or any "print every case" script exceeds 8k routinely - this is the normal shape, not a
 * pathological one.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const cmd = (c) => `THOUGHT: running it.\nACTION: run_command\nCOMMAND: ${c}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\na failing command still says that it failed\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'cmd', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: run the tests.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'cmd', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'cmdtail-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'cmd' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '90' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(90000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }
async function runGoal(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return (run?.steps || []).filter((s) => s.type === 'tool');
}

// A test runner of exactly the ordinary kind: 400 passing lines, then a failure on stderr and a non-zero exit.
// 400 x ~40 chars is comfortably over the 8,000-char cut.
const RUNNER = [
  'for (let i = 1; i <= 400; i++) console.log(`test ${i} ok ..............`);',
  'console.error("AssertionError: expected 5 but got 3 (case 401)");',
  'process.exit(1);',
].join('\n');

const steps = await runGoal('Run the test suite in runner.js.', [
  write('runner.js', RUNNER), cmd('node runner.js'), FINISH,
]);
const result = String(steps.find((s) => s.tool === 'run_command')?.result || '');

await test('the premise: the command produced more output than the cap allows', () => {
  assert.ok(result.length > 0, 'run_command never ran');
  assert.match(result, /test 1 ok/, 'the stdout is not in the result at all: ' + result.slice(0, 120));
});
await test('(known) the exit code survives a large stdout', () => {
  assert.match(result, /EXIT: 1\b/, 'no non-zero EXIT line - the model cannot tell this failed:\n' + result.slice(-200));
});
await test('(known) and so does the failing assertion on stderr', () => {
  assert.match(result, /AssertionError: expected 5 but got 3/, 'the failure text was cut away:\n' + result.slice(-200));
});
await test('(known) and the model is told that output was dropped', () => {
  assert.match(result, /trimmed|dropped|truncat/i, 'nothing says the output was cut:\n' + result.slice(-200));
});
await test('control: the result still respects a size cap', () => {
  assert.ok(result.length <= 9_000, 'result is ' + result.length + ' chars - the cap is gone');
});
// ASSEMBLY ORDER, pinned directly. The per-section caps (stdout 6,000, stderr 1,500) mean the assembled result lands
// around 6.2k and never reaches the final 9,000 guard - so restoring the old `out.slice(0, 8_000)` front-slice cuts
// nothing and every case above stays green. Measured: a mutant that put the front-slice back ESCAPED. The half of the
// fix that says "the verdict lives at the END, so never cut from the front" therefore needs pinning by order, not by
// length: whatever is trimmed, stderr and the exit code must come after it.
await test('the exit code and stderr come AFTER any trim marker, so a front-cut can never remove them', () => {
  const trimAt = result.search(/trimmed from the middle/);
  const stderrAt = result.indexOf('STDERR:');
  const exitAt = result.search(/EXIT: \d/);
  assert.ok(trimAt >= 0, 'no trim happened, so this ordering proves nothing: ' + result.slice(0, 120));
  assert.ok(stderrAt > trimAt, `STDERR (${stderrAt}) must follow the trim marker (${trimAt})`);
  assert.ok(exitAt > stderrAt, `EXIT (${exitAt}) must be last, after STDERR (${stderrAt})`);
  assert.ok(exitAt > result.length - 40, 'the EXIT line is not at the very end, where batchStepFailed looks for it');
});

// A short, failing command must be unchanged by any of this.
const short = await runGoal('Run the small check.', [
  write('small.js', 'console.log("one line");\nconsole.error("boom");\nprocess.exit(2);'),
  cmd('node small.js'), FINISH,
]);
const shortResult = String(short.find((s) => s.tool === 'run_command')?.result || '');
await test('control: a short failing command is reported exactly as before', () => {
  assert.match(shortResult, /one line/, shortResult.slice(0, 160));
  assert.match(shortResult, /boom/, shortResult.slice(0, 160));
  assert.match(shortResult, /EXIT: 2\b/, shortResult.slice(-160));
});

hub.kill(); mock.close();
// All three were red when this file was written and all three are fixed: stdout is trimmed in the MIDDLE (announced,
// with real sizes) while stderr and the EXIT line always survive, at both run_command and run_python. The "(known)"
// labels stay on the case names as a record of what each was written to catch.
const KNOWN_EXPECTED = 0;
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
