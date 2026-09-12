/**
 * gateSoundness.test.mjs - the finish gate must not pass a run on evidence it never got.
 *
 *   node server/gateSoundness.test.mjs
 *
 * Four defects audited 2026-09-11, all in the same region of the loop, all the same shape: success recorded because a
 * check did not happen.
 *
 * 1. A FAILED test_web counts as a CLEAN one. hasErr is a regex over the result string:
 *        const hasErr = /\[JS ERROR\]|\[console\.error\]|\[HTTP \d/.test(result);
 *    test_web's own failure returns are "ERROR: puppeteer is not installed on the server, cannot test." and
 *    "ERROR loading the page: <msg>\nCollected so far:\n(none)". Neither matches, so hasErr is false: needsTest is
 *    CLEARED, cleanTests is INCREMENTED, and at three of them the run is set to 'done' with the summary
 *    "App passed browser tests with no errors (auto-finished after repeated clean tests)". One unavailable browser
 *    turns every web goal green in three steps - and that auto-finish bypasses the ledger gate, the plan-files gate,
 *    the visual gate and verifier.verify() entirely. The tool's own ERROR convention is never consulted, though
 *    batchStepFailed two lines below does exactly that.
 *
 * 2. A failed visual inspection skips the visual gate AND the runtime gate. The block is
 *    `if (r.ok && hasProblems) {...} else if (r.ok) {...}`, so r.ok === false takes neither branch and falls through
 *    setting nothing; gate 4 is then guarded by `(!hasWeb || !run.touchedWeb)`, which is false for a web run that
 *    touched its page. Nothing is blocked, nothing is noted.
 *
 * 3. run.verified caches a pass for the rest of the run. It is set once and reset only by the follow-up route, while
 *    the gate is DESIGNED to block up to three times - so the normal path is: verify passes, another gate blocks, the
 *    model edits the entry file and breaks it, finish again, and the project is never run a second time.
 *
 * 4. One bare `catch {}` wraps the whole verification block, so any throw inside it - an unreadable workspace, a
 *    module that fails to load, a path race against the model's own delete - skips blocked() and lands on done, with
 *    no note, no counter and nothing in the run to distinguish it from a clean pass.
 *
 * Cases marked "(known)" are expected to fail until each is fixed.
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
const testWeb = (p) => `THOUGHT: checking the page.\nACTION: test_web\nPATH: ${p}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: the app works';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe finish gate does not pass a run on evidence it never got\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'gate2', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: test the page.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'gate2', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'gate2-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'gate2' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '90' },
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
  let run = null; const deadline = Date.now() + 5 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return run;
}
const tools = (run) => (run?.steps || []).filter((s) => s.type === 'tool');
const notes = (run) => (run?.steps || []).map((s) => String(s.text || s.summary || '')).join('\n');

// ── 1. three FAILED test_web calls must not auto-finish the run ──
// No index.html exists, so test_web cannot load the page. Whichever failure text this build produces - a missing
// puppeteer or a failed navigation - the result begins with ERROR, and an ERROR is not a clean test.
const bad = await runGoal('Build the page and check it in a browser.', [
  write('app.js', 'document.title = "x";'),
  testWeb('index.html'), testWeb('index.html'), testWeb('index.html'), FINISH,
]);
const webResults = tools(bad).filter((s) => s.tool === 'test_web').map((s) => String(s.result || ''));
// Measured while writing this, and it is a THIRD variant the audit did not list: with puppeteer installed and no
// index.html, the navigation SUCCEEDS onto a 404 page and test_web answers
//     "Loaded http://localhost:PORT/workspace/index.html (HTTP 404). Clicked 0 control(s)."
// That is not an ERROR, so an `^ERROR` check would miss it - and the hasErr regex needs "[HTTP" with a bracket, so
// "(HTTP 404)" does not match either. A 404 page is banked as evidence that the app works.
await test('the premise: the browser test did not actually check a working page', () => {
  assert.ok(webResults.length >= 1, 'test_web never ran');
  assert.ok(/^ERROR|HTTP (4|5)\d\d/.test(webResults[0]),
    'the fixture did not produce a failing browser test: ' + webResults[0].slice(0, 160));
});
await test('(known) three browser tests that never saw a working page do not auto-finish the run', () => {
  assert.doesNotMatch(notes(bad), /auto-finished after repeated clean tests/,
    'the run auto-finished on three non-tests: ' + notes(bad).slice(0, 200));
});
await test('(known) and the run does not reach done on that evidence', () => {
  assert.notEqual(bad.status, 'done', 'status: ' + bad.status + ' - finished without a passing test');
});

// ── 2. run.verified must not outlive the file it verified ──
// The entry runs cleanly, the ledger gate blocks the first finish, the model then breaks the entry, and finishes
// again. A cached pass means the broken file is never run.
// The first version of this fixture proved nothing: the first FINISH passed the gate outright, the run ended at
// modelCalls 2, and the broken write and second finish were never served. For a cached pass to be REUSED there has to
// be a second finish, so the first one must be blocked by a gate that fires BEFORE verification - an open ledger task
// does exactly that. Sequence: write a working entry, add a task, finish (verification passes, ledger blocks), break
// the entry, close the task, finish again. The second finish must run the project again rather than trust the old pass.
// Field names checked against agentParse.js rather than written from memory: task_add reads TEXT: (or a fenced block),
// and task_done reads WHICH: first with TASK: as a fallback. An invented TASKS: block would have parsed to an empty
// task, left the ledger empty, and let the first finish through - the fixture would have proved nothing for a second
// time.
const addTask = 'THOUGHT: recording the work.\nACTION: task_add\nTEXT: polish ok.js before finishing';
const doneTask = 'THOUGHT: closing it.\nACTION: task_done\nWHICH: polish';
const cached = await runGoal('Create ok.js that runs, then finish.', [
  write('ok.js', 'console.log("fine");'),
  addTask,
  FINISH,                                   // verification passes here, then the ledger gate blocks
  write('ok.js', 'syntax ( error ]]'),      // the entry is now broken
  doneTask,
  FINISH,                                   // must NOT finish on the earlier pass
]);
await test('the premise: the run got a second finish attempt after breaking the entry', () => {
  const finishes = (cached?.steps || []).filter((s) => s.type === 'error' && /not finished/i.test(String(s.text || ''))).length;
  const wrote = (cached?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'write_file').length;
  assert.ok(wrote >= 2, `only ${wrote} write(s) - the broken entry was never written, so nothing could be re-verified`);
  assert.ok(finishes >= 1, 'the first finish was never blocked, so there was no second attempt');
});
await test('(known) a pass is not reused after the entry file changed', () => {
  assert.notEqual(cached?.status, 'done',
    'finished with a broken entry on a cached pass: ' + notes(cached).slice(-220));
});

// ── 1b. a browser that cannot LAUNCH: the failure shape with no bracketed marker anywhere ──
// This is the variant the audit named, and the 404 case cannot reach it. With a nonexistent Chrome binary,
// puppeteer.launch throws and test_web returns "ERROR loading the page: ...". hasErr looks for [JS ERROR] /
// [console.error] / [HTTP N] and finds none of them, so the result is banked as a CLEAN test: the re-test flag is
// cleared and three of them auto-finish the run as "App passed browser tests with no errors". A second hub, because
// the broken browser path has to be in the environment from the start.
hub.kill();
const dir2 = mkdtempSync(join(tmpdir(), 'gate2b-'));
const ws2 = join(dir2, 'workspace');
mkdirSync(ws2, { recursive: true });
writeFileSync(join(ws2, 'index.html'), '<!doctype html><title>ok</title><p>hello</p>', 'utf8');
writeFileSync(join(dir2, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'gate2' } }, history: [], settings: {} }), 'utf8');
const [hubPort2] = await freePorts(1);
const hub2 = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort2), HUB_DB: join(dir2, 'hub.json'), AGENT_WORKSPACE: ws2, AGENT_QUEUE_FILE: join(dir2, 'queue.json'),
    AGENT_RUNS_DIR: join(dir2, 'runs'), AGENT_TRACES_DIR: join(dir2, 'traces'), RUN_INDEX: join(dir2, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '90',
    PUPPETEER_EXECUTABLE_PATH: join(dir2, 'no-such-chrome.exe') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub2.stdout.on('data', (d) => rig.log.push(String(d))); hub2.stderr.on('data', (d) => rig.log.push(String(d)));
const API2 = `http://127.0.0.1:${hubPort2}/api`;
let up2 = false; for (let i = 0; i < 240 && !up2; i++) { try { await fetch(API2 + '/auth/hint'); up2 = true; } catch { await sleep(250); } }
const api2 = async (p, o) => (await fetch(API2 + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(90000) })).json();
let noBrowser = null;
if (!up2) { console.error('  FAIL  the second hub did not start'); failed++; }
else {
  rig.script = [testWeb('index.html'), testWeb('index.html'), testWeb('index.html'), FINISH];
  const st2 = await api2('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Check index.html in a browser.' }) });
  const deadline2 = Date.now() + 5 * 60000;
  while (Date.now() < deadline2) { noBrowser = await api2('/agent/' + st2.runId).catch(() => null); if (noBrowser && TERMINAL.includes(noBrowser.status) && noBrowser.busy !== true) break; await sleep(300); }
}
const nbResults = tools(noBrowser).filter((s) => s.tool === 'test_web').map((s) => String(s.result || ''));
await test('the premise: the browser could not launch, and the result carries no bracketed marker', () => {
  assert.ok(nbResults.length >= 1, 'test_web never ran on the second hub');
  assert.match(nbResults[0], /^ERROR/, 'expected an ERROR return: ' + nbResults[0].slice(0, 200));
  assert.doesNotMatch(nbResults[0], /\[JS ERROR\]|\[console\.error\]|\[HTTP \d/,
    'this shape is already caught by hasErr, so it cannot pin the fix: ' + nbResults[0].slice(0, 200));
});
// Assert on the STATE, not the outcome. Measured: this run ends with cleanTests 2 and needsTest false - two failed
// browser tests banked as clean - and it never reaches the 3-clean auto-finish only because the tool-loop guard added
// earlier today stops it at two identical failures first. One fix masking another: the outcome looks fine while the
// bookkeeping that feeds the auto-finish is already wrong. Check the bookkeeping.
await test('(known) a browser that cannot launch banks no clean test and leaves the re-test flag set', () => {
  assert.equal(noBrowser?.cleanTests || 0, 0,
    `cleanTests is ${noBrowser?.cleanTests} - failed browser tests were counted as passing ones`);
  assert.equal(noBrowser?.needsTest, true,
    'needsTest was cleared by a test that never ran, so nothing will insist on a real one');
});
await test('and it never auto-finishes on that evidence', () => {
  assert.doesNotMatch(notes(noBrowser), /auto-finished after repeated clean tests/,
    'auto-finished on tool errors: ' + notes(noBrowser).slice(0, 200));
  assert.notEqual(noBrowser?.status, 'done', 'reached done without any page ever being checked');
});

hub2.kill(); mock.close();
// Measured, not assumed: a 404 page IS handled correctly. test_web's response handler pushes "[HTTP 404] index.html"
// into its collected logs, so the hasErr regex (which needs the bracket form) does match, and the two auto-finish
// cases above pass on today's code. The defect is real but needs the OTHER failure shape - a browser that cannot
// launch at all, which returns "ERROR loading the page: ..." with no bracketed marker anywhere. That is pinned by the
// second hub below, spawned with a deliberately broken Chrome path.
// Both halves are now fixed AND exercised. The browser-test half: a test_web result beginning with ERROR banks no
// clean test and leaves needsTest set. The cached-pass half: the ledger-block fixture gets the run a genuine second
// finish attempt after the entry is broken (its premise asserts that), and the pass is not reused - so run.verifiedAt
// is demonstrated, not merely present. The "(known)" labels stay on the case names as a record of what they caught.
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
