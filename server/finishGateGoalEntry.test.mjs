/**
 * finishGateGoalEntry.test.mjs - the GATE, not just the verifier, must judge the goal's own project.
 *
 *   node server/finishGateGoalEntry.test.mjs
 *
 * finishGateEntry.test.mjs pins verifyProject's behaviour directly, and it cannot reach this: the entry-resolution
 * fix lives in the finish gate inside agent.js, so only a real run through `finish` exercises it. Keeping the two
 * apart matters - a unit test on the verifier passing says nothing about what the gate hands it.
 *
 * The bug (set E, and still live in the gate until 2026-09-11): the verify_project TOOL resolves an entry from the
 * goal (agent.js:1261) after it reported "`node q1_stock.js` ran and exited cleanly" for a goal about q8_units.py.
 * The GATE - the code that actually decides 'done' - called verifier.verify(WORKSPACE) with no entry at all. So in a
 * workspace holding several goals' files, a goal whose own code crashes could be finished on the strength of an
 * unrelated leftover script from a different goal. The fix was applied to the advisory path and not the deciding one.
 *
 *   - a run whose own Python crashes is BLOCKED at finish, even though a passing .js from another goal sits beside it;
 *   - the block names the goal's file, not the stranger's;
 *   - control: when the goal's own code runs, the same workspace finishes cleanly.
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
const FINISH = 'THOUGHT: the work is complete.\nACTION: finish\nSUMMARY: done';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe finish gate judges the goal\'s own project\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'gate', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: the file is already written; finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'gate', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'gategoal-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
// The workspace as a chained set leaves it: an earlier goal's script that runs fine, beside this goal's broken one.
writeFileSync(join(ws, 'q1_stock.js'), 'function stock(n) { return n; }\nconsole.log("stock ok", stock(1));\n', 'utf8');
writeFileSync(join(ws, 'q8_units.py'), 'def units(n):\n    return n * 2\n\n\nassert units(2) == 5, "units wrong"\n', 'utf8');

writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'gate' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
const notes = (run) => (run?.steps || []).filter((s) => s.type === 'note' || s.type === 'error').map((s) => String(s.text || '')).join('\n');
const blocks = (run) => (run?.history || []).concat(run?.steps || []).map((s) => String(s.content || s.text || '')).join('\n');

// The goal names its own file. Its assert fails, so the project does NOT run - the gate must say so.
const bad = await runGoal('Fix units() in q8_units.py so the assertion passes.', [FINISH]);
await test('the premise: the run reached the finish gate', () => {
  assert.ok(bad, 'no run');
  assert.ok(/finish|Verified|does not run|not finished/i.test(blocks(bad) + notes(bad)), 'the gate was never reached: ' + String(bad.status));
});
await test('a goal whose own code crashes is not finished on a leftover file from another goal', () => {
  const verified = notes(bad).match(/Verified \([a-z]+\): ([^\n]*)/);
  assert.ok(!(verified && /q1_stock\.js/.test(verified[1])), 'verified using the wrong project: ' + (verified && verified[1]));
  assert.notEqual(bad.status, 'done', 'finished despite its own Python failing: ' + notes(bad).slice(0, 200));
});
// blocked() splits its two arguments: the REASON becomes a step, and the INSTRUCTION - the part carrying
// verifier.format(v), which is where the failing file is named - goes into run.history. GET /agent/:id destructures
// `history` out of the response on purpose, so a test driving the API can never see that text. Assert on what is
// actually observable: the gate blocked, and it blocked about the goal's own language rather than the stranger's.
await test('the block is recorded, and it is about the goal\'s own project', () => {
  const errs = (bad?.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || ''));
  const gateBlock = errs.find((t) => /does not run/i.test(t));
  assert.ok(gateBlock, 'no gate block was recorded: ' + errs.join(' | ').slice(0, 200));
  assert.match(gateBlock, /\(python\)/, 'blocked about the wrong language - it judged the leftover .js: ' + gateBlock);
  assert.ok((bad.finishBlocks || 0) >= 1, 'finishBlocks was not incremented');
});

// Control: the goal's own code runs. The same workspace, the same stranger .js beside it - this must finish.
writeFileSync(join(ws, 'q9_ok.py'), 'def units(n):\n    return n * 2\n\n\nassert units(2) == 4\nprint("units ok")\n', 'utf8');
const good = await runGoal('Check units() in q9_ok.py runs.', [FINISH]);
await test('control: when the goal\'s own code runs, the gate lets it finish', () => {
  assert.equal(good.status, 'done', 'blocked a working goal: ' + notes(good).slice(0, 300));
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;   // bugs known open today; see the header for what and why
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
// The one line the suite runner greps, so a green file can never hide an open bug in the summary.
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
// A count that DROPS means a case labelled "(known)" now passes - the label is a lie and the test is claiming
// a bug is open that is not. A count that RISES means a new failure hid behind the label. Both fail the file.
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
