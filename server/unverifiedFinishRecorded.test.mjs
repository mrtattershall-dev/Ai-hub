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
 * So unverified code entered the training corpus labelled as success, and the kept-forever series could not tell a
 * forced finish from a clean one. This test pins the contract: whatever the route, the durable records carry the verdict.
 *
 * FIXED 2026-09-12. Both routes now stamp run.finishKind, and ONE field of that name is written into both durable
 * records by finishVerdict() in agent.js: 'forced' (route 1), 'auto_clean_tests' (route 2), 'verified' /
 * 'screen_checked' / 'unverified' for a finish through the gate, 'not_finished' otherwise. It is a top-level field in
 * both rows rather than prose in a note step, because saveTrace strips note text and a corpus consumer must not have
 * to regex prose - and because route 2 pushed no note at all, so unstripping text would have recorded nothing for it.
 * The control case below is what makes the field mean anything: a verified finish must say 'verified'.
 *
 * STILL OPEN, and deliberately not fixed here (the one remaining "(known)" case): route 2 also bypasses every gate -
 * the ledger gate, the plan-FILES gate, the re-test gate, the VISUAL check and the runtime verifier. The run in this
 * file reaches 'done' with its own ledger task still open, which a finish through the normal branch is blocked for.
 * That is a change to what the hub DOES, not to what it records, so it needs its own decision and its own fix.
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
// The finish replies must DIFFER in text. Four identical FINISH replies trip the reply-repeat guard (3 identical in a
// window of 8) before the gate reaches its third block, so the run ends 'stopped' and never forces a finish at all -
// which is exactly how the first version of this fixture failed. Same trap as the gate fixture earlier: one guard
// masking the path under test.
const finishN = (n) => `THOUGHT: attempt ${n}, I believe this is complete.\nACTION: finish\nSUMMARY: finished, attempt ${n}`;
const forced = await runGoal('Create app.js and finish.', [
  write('app.js', 'console.log("hi");'),
  addTask('polish the output'), addTask('add a second feature'), addTask('write a readme'),
  finishN(1), finishN(2), finishN(3), finishN(4),
]);
await test('the premise: the run was forced to finish unverified', () => {
  assert.equal(forced?.status, 'done', 'status: ' + forced?.status);
  assert.equal(forced?.forcedFinish, true, 'forcedFinish on the run object: ' + forced?.forcedFinish);
  assert.ok((forced?.finishBlocks || 0) >= 3, 'finishBlocks: ' + forced?.finishBlocks);
});
await test('the run index says this finish was not verified', () => {
  const row = indexRows().find((r) => r.id === forced.id);
  assert.ok(row, 'no index row for the run at all');
  const marks = JSON.stringify(row);
  assert.match(marks, /unverified|forcedFinish|finishKind/,
    'the kept-forever series cannot tell this from a clean finish: ' + marks.slice(0, 240));
  // The VALUE, not just the presence of a field: a verdict that said 'verified' here, or the same word for every run,
  // would satisfy a presence check and record nothing.
  assert.equal(row.finishKind, 'forced', 'the verdict does not name this route: ' + marks.slice(0, 240));
});
await test('and so does the training trace', () => {
  const row = traceRows().find((r) => r.id === forced.id);
  assert.ok(row, 'no trace row for the run at all');
  const marks = JSON.stringify(row).slice(0, 400);
  assert.match(marks, /unverified|forcedFinish|finishKind/,
    'unverified code enters the corpus labelled as success: ' + marks);
  assert.equal(row.finishKind, 'forced', 'the corpus row does not name this route: ' + marks);
});
await test('control: the index and the trace both exist and carry the status', () => {
  const i = indexRows().find((r) => r.id === forced.id);
  const t = traceRows().find((r) => r.id === forced.id);
  assert.equal(i?.status, 'done');
  assert.equal(t?.status, 'done');
});

// ── ROUTE 2: `cleanTests >= 3` auto-finishes from inside the test_web handler ─────────────────────────────────────
//
// Three CLEAN browser tests set run.status = 'done' and `break turn` inside the tool handler, so the finish branch is
// never entered at all: no ledger gate, no plan-FILES gate, no re-test gate, no VISUAL check, no runtime verifier -
// and no marker of any kind on the run. It is the route with nothing to record, which is why it needs its own red.
//
// Getting REAL clean tests past the loop's own guards took both of these, and either one alone fails the fixture:
//   - the three replies must DIFFER in text, or the reply-repeat guard (3 identical in a window of 8) stops the run
//     first - the same trap that broke the forced-finish fixture above;
//   - the three tool ANSWERS must differ too, or the repeated-call notice fires; so the three pages carry different
//     visible text, which test_web echoes back in its report.
// These are genuine passes, not a stubbed browser: puppeteer resolves from server/node_modules and Chromium launches
// here in ~0.5s, the pages are served by the hub itself at /workspace/, and each report is HTTP 200 with no
// [JS ERROR], no [console.error] and no [HTTP 4xx].
const notes = (run) => (run?.steps || []).map((s) => String(s.text || s.summary || '')).join('\n');
const page = (n, body) => write(`p${n}.html`, `<!doctype html><title>p${n}</title><h1>page ${n}</h1><p>${body}</p>`);
const testWeb = (p, n) => `THOUGHT: checking ${p} in the browser (check ${n} of three).\nACTION: test_web\nPATH: ${p}`;
const auto = await runGoal('Build three pages and check each one in the browser.', [
  page(1, 'alpha counts one'), page(2, 'beta counts two'), page(3, 'gamma counts three'),
  addTask('an open task that the auto-finish never looks at'),
  testWeb('p1.html', 1), testWeb('p2.html', 2), testWeb('p3.html', 3),
]);
await test('the premise: three clean browser tests auto-finished the run from inside the tool handler', () => {
  assert.equal(auto?.status, 'done', 'status: ' + auto?.status + ' — ' + notes(auto).slice(-240));
  assert.ok((auto?.cleanTests || 0) >= 3, 'cleanTests: ' + auto?.cleanTests);
  assert.match(notes(auto), /auto-finished after repeated clean tests/, 'this is not the auto-finish path');
  assert.notEqual(auto?.forcedFinish, true, 'this must be route 2, not the forced-finish route');
});
await test('the auto-finished run carries the verdict itself', () => {
  assert.ok(auto?.finishKind, 'the run object holds no verdict at all: finishKind=' + auto?.finishKind);
  assert.notEqual(auto.finishKind, 'verified', 'an unverified auto-finish is labelled verified');
});
// PRESENCE FIRST, then the value. The first version of these two asserted only
// `row.finishKind === auto.finishKind` and `row.finishKind !== 'verified'` - both of which PASS when the field is
// absent everywhere (undefined === undefined, and undefined is not 'verified'), so they reported green over the exact
// hole they were written for, while route 2's own marker case next to them went red. An absent field is the bug; it
// has to be asserted as present before anything is asserted about its value.
await test('the run index says the auto-finish was not verified', () => {
  const row = indexRows().find((r) => r.id === auto.id);
  assert.ok(row, 'no index row for the run at all');
  assert.ok(row.finishKind, 'the kept-forever series carries no verdict field: ' + JSON.stringify(row).slice(0, 240));
  assert.equal(row.finishKind, auto?.finishKind, 'the index disagrees with the run: ' + JSON.stringify(row).slice(0, 240));
  assert.notEqual(row.finishKind, 'verified', 'the kept-forever series calls this verified');
});
await test('and the training trace says so too', () => {
  const row = traceRows().find((r) => r.id === auto.id);
  assert.ok(row, 'no trace row for the run at all');
  assert.ok(row.finishKind, 'the training corpus carries no verdict field: ' + JSON.stringify(row).slice(0, 240));
  assert.equal(row.finishKind, auto?.finishKind, 'the trace disagrees with the run: ' + JSON.stringify(row).slice(0, 240));
  assert.notEqual(row.finishKind, 'verified', 'unverified code enters the corpus labelled as success');
});
// A SEPARATE OPEN BUG, deliberately not fixed by the record change above: this route also skips every gate. The run
// above closed none of its own ledger tasks, and a finish through the normal branch would have been blocked for
// exactly that (see the forced run at the top of this file, which was blocked three times for it). Kept red on
// purpose - making the record honest is not the same as making the path safe, and changing the gating here would
// change what the hub DOES, not just what it records.
await test('(known) an open ledger task blocks the auto-finish the same way it blocks a finish', () => {
  const opened = (auto?.steps || []).filter((s) => s.tool === 'task_add').length;
  assert.ok(opened >= 1, 'the fixture added no task, so it cannot show the bypass');
  assert.notEqual(auto?.status, 'done',
    'the auto-finish reached done with this run\'s own ledger task still open - it entered no gate at all');
});

hub.kill();

// ── THE CONTROL: a clean, verified finish must be recorded as verified ────────────────────────────────────────────
// On a SECOND hub with an empty workspace, because the workspace above now holds three html pages and a leftover
// ledger, and a control that inherits those is not a control. Without this case, a verdict field that said "not
// verified" for every run would satisfy every assertion above.
const dirC = mkdtempSync(join(tmpdir(), 'unver-clean-'));
const wsC = join(dirC, 'workspace');
mkdirSync(wsC, { recursive: true });
const INDEX_C = join(dirC, 'index.jsonl');
const TRACES_C = join(dirC, 'traces');
writeFileSync(join(dirC, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'unver' } }, history: [], settings: {} }), 'utf8');
const [hubPortC] = await freePorts(1);
const hubC = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPortC), HUB_DB: join(dirC, 'hub.json'), AGENT_WORKSPACE: wsC, AGENT_QUEUE_FILE: join(dirC, 'queue.json'),
    AGENT_RUNS_DIR: join(dirC, 'runs'), AGENT_TRACES_DIR: TRACES_C, RUN_INDEX: INDEX_C,
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hubC.stdout.on('data', (d) => rig.log.push(String(d))); hubC.stderr.on('data', (d) => rig.log.push(String(d)));
const API_C = `http://127.0.0.1:${hubPortC}/api`;
let upC = false; for (let i = 0; i < 240 && !upC; i++) { try { await fetch(API_C + '/auth/hint'); upC = true; } catch { await sleep(250); } }
const apiC = async (p, o) => (await fetch(API_C + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
const readRows = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
let clean = null;
if (!upC) { console.error('  FAIL  the control hub did not start'); failed++; }
else {
  rig.script = [write('clean.js', 'console.log("clean");'), finishN(1), finishN(2)];
  const stC = await apiC('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create clean.js that runs, then finish.' }) });
  const deadlineC = Date.now() + 4 * 60000;
  while (Date.now() < deadlineC) { clean = await apiC('/agent/' + stC.runId).catch(() => null); if (clean && TERMINAL.includes(clean.status) && clean.busy !== true) break; await sleep(300); }
}
await test('the premise: the control run finished cleanly, verified, unforced', () => {
  assert.equal(clean?.status, 'done', 'status: ' + clean?.status + ' — ' + notes(clean).slice(-240));
  assert.notEqual(clean?.forcedFinish, true, 'the control was forced');
  assert.equal(clean?.verified, true, 'the control was never verified, so it cannot show the verdict is discriminating');
});
await test('control: a verified finish is recorded as verified in both records', () => {
  const i = readRows(INDEX_C).find((r) => r.id === clean.id);
  const t = readRows(join(TRACES_C, 'traces.jsonl')).find((r) => r.id === clean.id);
  assert.ok(i && t, 'the control produced no index row or no trace row');
  assert.equal(i.finishKind, 'verified', 'index: ' + JSON.stringify(i).slice(0, 200));
  assert.equal(t.finishKind, 'verified', 'trace: ' + JSON.stringify(t).slice(0, 200));
});

hubC.kill(); mock.close();
// The record is now honest for both routes (6 cases that were open on 2026-09-12 now pass). What remains open is a
// DIFFERENT bug in the same place: route 2 enters no gate at all. See the header.
const KNOWN_EXPECTED = 1;   // the gate bypass, which this change deliberately did not touch
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
