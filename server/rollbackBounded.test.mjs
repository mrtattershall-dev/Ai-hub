/**
 * rollbackBounded.test.mjs - the end-of-run repair may not reach back past the goal that is being repaired.
 *
 *   node server/rollbackBounded.test.mjs
 *
 * Measured 2026-09-12 against real run data (setE coder14b, 100 interleaved goals):
 *   - 267 checkpoints across 100 goals: mean 2.67, median 2, p75 4, max 7. A checkpoint commits the WHOLE tree, so
 *     `git log -25 -- <file>` reaches roughly 9-12 GOALS back - and each long-lived file is edited by 6-10 goals
 *     spanning nearly the whole set (q2_table.py goals 2..92, q3_calendar.js 3..93). The 25-commit cap is therefore not
 *     a bound at all: it covers essentially the entire lifetime of exactly the files that matter.
 *   - 29 of 100 goals ended in a rollback. FOUR had <=1 checkpoint of their own and FOURTEEN had <=2. Because a
 *     checkpoint is taken BEFORE each mutating write, a goal with one checkpoint has only the state from before its
 *     first write - so for those the rollback cannot restore anything the goal wrote. The "repair" discards the goal.
 *
 * THE LINE THIS DRAWS, and why the two cases below look alike but are not:
 *   A run's first checkpoint holds the state from BEFORE its first write - the PREVIOUS goal's result. So "restoring
 *   the first checkpoint" is not a repair at all: it deletes the goal and calls it a repair. The version installed
 *   must be one the RUN ITSELF produced, strictly after its own first checkpoint.
 *     GOAL 2 writes a good V2, then breaks it. The run owns a version that parses (V2), so restoring V2 keeps the
 *       goal's work. That must happen, be recorded, and be committed.
 *     GOAL 3 writes only broken versions. NOTHING it produced parses; the only parsing version predates the goal. The
 *       repair must REFUSE - leave the file, say so as an error, and not report a clean finish over it.
 *   An earlier draft of this file asserted BOTH of those about the same shape (one breaking write on a good file),
 *   which is incoherent: it would have forced the implementation either to break a passing case or to weaken the rule
 *   to match whatever the code already did.
 *
 * FIXTURE NOTE, kept because it cost real time. The first version used a write that dropped render()'s body AND
 * `module.exports`. That write is REFUSED by the destructive-write guard, so nothing broken ever reached disk and the
 * end-of-run repair never ran: `rolledBack` stayed undefined across four goals while the cases reported green. A
 * fixture blocked by a different protection measures nothing, forever. The writes below keep every definition and the
 * export and merely fail to parse - the shape that actually reaches the repair, confirmed by probe first.
 *
 * The contract, with where each part is observable:
 *   1. the version installed is one the run produced (goal 2: V2, not the pre-goal V1);
 *   2. when nothing the run produced parses, it REFUSES rather than reinstating a pre-goal version (goal 3);
 *   3. it records an ERROR, not only a note. The note STAYS: four consumers read that wording
 *      (rollbackCarryover.test.mjs x2, runLifecycle.test.mjs, setE/tools/fix-triggers.mjs). The error is added beside it;
 *   4. the run carries a machine-readable marker. Today `run.rolledBack` is undefined and the only trace is prose, so
 *      trace, run index and runstates cannot tell a repaired run from a clean one. Worse, the note is pushed inside
 *      `if (restored)` (agent.js:3633), so a repair that FAILED records nothing at all - which is why set G's
 *      s3_matrix.js has no record of its failed restore;
 *   5. the result is committed, so the next goal's checkpoint cannot absorb it and mis-attribute the change
 *      (runstates.mjs reads those checkpoints to decide what each goal did). Only observable at goal 3: at goal 2 the
 *      restored bytes coincide with HEAD, so a clean tree there would pass vacuously.
 *
 * All five landed on 2026-09-12. The bound asks git for ancestry (fileHistorySince: <floor>..HEAD) rather than looking
 * up the floor commit's INDEX in this file's history - that earlier draft returned -1 whenever the checkpoint touched
 * only TASKS.md, and its fallback then walked UNBOUNDED, reporting a bound while restoring a pre-goal version.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
// Finish replies must DIFFER: three identical replies in a short window trip the same-response guard, which stops the
// run before the path under test is reached. That is how the sibling unverifiedFinishRecorded fixture failed.
const finishN = (n) => `THOUGHT: that is the change I wanted (${n}).\nACTION: finish\nSUMMARY: done, pass ${n}`;
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe end-of-run repair stays inside the goal it is repairing\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'rb', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write it.' : (rig.script.length ? rig.script.shift() : finishN('last'));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'rb', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'rbound-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'rb' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
const file = (n) => readFileSync(join(ws, n), 'utf8').replace(/\r/g, '');
const git = (...a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim(); } catch { return '(git unavailable)'; } };
// Scoped to r.js: ESCALATIONS.md and TASKS.md are legitimately untracked, so whole-tree cleanliness would never be
// true and the assertion would say nothing about the repair.
const dirtyRjs = () => git('status', '--porcelain').split('\n').filter((l) => /\br\.js$/.test(l)).join(' | ');
const stepsOfType = (run, t) => (run?.steps || []).filter((s) => s.type === t).map((s) => String(s.text || '')).join('\n');
const text = (run) => (run?.steps || []).map((s) => String(s.text || '')).join('\n');

const V1 = ['function render(t) {', '  return t.trim();', '}', 'module.exports = { render };'].join('\n');
const V2 = ['function render(t) {', '  return String(t).trim();', '}', 'module.exports = { render };'].join('\n');
// Parse-breaking but NOT destructive: render survives, the export survives, a new malformed function is added. This is
// the shape the destructive-write guard allows through, so the end-of-run repair is actually reached.
const BREAK_A = ['function render(t) {', '  return String(t).trim();', '}', 'function extra(t) {', '  return t.(', '}', 'module.exports = { render };'].join('\n');
const BREAK_B = ['function render(t) {', '  return String(t).trim();', '}', 'function extra(t) {', '  return t.(', '}', 'function extra2(t) {', '  return t.[[', '}', 'module.exports = { render };'].join('\n');

await runGoal('Create r.js exporting render(t).', [write('r.js', V1), finishN(1)]);
await test('the premise: goal 1 left a good, exporting r.js', () => {
  assert.equal(file('r.js'), V1);
});

// GOAL 2 - the REPAIRABLE case. Writes a good V2, then breaks it. The checkpoint taken before the breaking write holds
// V2, so the run itself owns a version that parses. Restoring V2 keeps the goal's work and is a legitimate repair.
const g2 = await runGoal('Tidy render in r.js.', [write('r.js', V2), write('r.js', BREAK_A), finishN(2)]);
await test('the premise: goal 2 reached the end-of-run repair', () => {
  assert.match(text(g2), /did not parse at the end of the run/,
    'the repair never ran, so nothing below is measuring it:\n' + text(g2).slice(0, 300));
});
await test('it restores the version the RUN ITSELF produced, not the one from before the goal', () => {
  assert.equal(file('r.js'), V2,
    'expected goal 2\'s own good version V2; got '
    + (file('r.js') === V1 ? 'V1, the state from BEFORE the goal - that deletes the goal rather than repairing it' : 'something else:\n' + file('r.js')));
});
await test('the run records the repair as an error, not only a note', () => {
  assert.match(stepsOfType(g2, 'error'), /did not parse|rolled back|restored/i,
    'the only record is a note, which nothing downstream reads as a failure: ' + text(g2).slice(0, 200));
});
await test('and the run carries a machine-readable marker of the repair', () => {
  const marks = JSON.stringify({ rolledBack: g2?.rolledBack, restored: g2?.restoredFiles, repaired: g2?.repaired });
  assert.match(marks, /r\.js/,
    'no field on the run names what was repaired, so the trace, the run index and runstates cannot tell this\n'
    + '        from a clean run: ' + marks);
});

// GOAL 3 - the REFUSAL case. Both writes are broken, so nothing this run produced parses. The only parsing version is
// V2, which predates the goal; installing it would delete everything goal 3 wrote. It must refuse and say so.
const g3 = await runGoal('Rewrite render in r.js twice.', [write('r.js', BREAK_A), write('r.js', BREAK_B), finishN(3)]);
await test('the premise: goal 3 committed a broken version, so nothing it produced parses', () => {
  assert.match(git('show', 'HEAD:r.js'), /return t\.\(/,
    'HEAD does not hold a broken version, so this goal is not the shape under test: ' + git('show', 'HEAD:r.js'));
});
await test('it refuses to install a version older than the goal it is repairing', () => {
  assert.notEqual(file('r.js'), V2,
    'the repair reached back past this goal and reinstalled V2, deleting everything goal 3 wrote');
  assert.notEqual(file('r.js'), V1, 'the repair reached back TWO goals and reinstalled V1');
});
await test('whatever the repair did, r.js is committed afterwards', () => {
  assert.equal(dirtyRjs(), '',
    'the repair left r.js uncommitted, so the NEXT goal\'s checkpoint will absorb it and runstates will\n'
    + '        attribute the change to the wrong goal: ' + dirtyRjs());
});
await test('and it says so, rather than reporting a clean finish', () => {
  assert.match(stepsOfType(g3, 'error'), /could not|refus|no version|does not parse/i,
    'nothing in the run says the file was left broken on purpose: ' + text(g3).slice(0, 220));
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;   // all five landed 2026-09-12: the ancestry bound, the error step, the marker, and the commit
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
