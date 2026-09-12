/**
 * editTruth.test.mjs - edit_file's success answer must describe the FILE, not the REQUEST.
 *
 *   node server/editTruth.test.mjs
 *
 * Set G (2026-09-11), verified in the kept workspaces rather than taken on report. The base 14B made 363 edit_file
 * calls, 241 of them with byte-identical arguments, and 201 of those repeats wrote to disk AGAIN - because the
 * success string is computed from the REQUEST and is therefore invariant of the outcome. Two shapes, both measured:
 *
 *   SHAPE A (LINES), run 071d5478: `LINES: [67,68]` with an empty REPLACE, sent 11 times. Calls 1-9 each answered
 *   byte-identically `OK: edited s1_library.js lines 67-68 (2 line(s) deleted).` while deleting 18 DIFFERENT lines -
 *   the count N is arithmetic on the request (b-a+1), and the range addresses whatever has shifted into it.
 *
 *   SHAPE B (FIND whose REPLACE contains the FIND), run 33a9d81d: `FIND: "class Graph:"` with a 1575-char REPLACE
 *   containing `class Graph:`, sent 26 times, every one answering `OK: edited s6_graph.py.` The result was 1987 lines
 *   with 28 `def __init__` and 33 `def nodes` in one class. Zero syntax failures, because duplicate Python methods
 *   are legal. 50 of set G's 100 hidden checks were on files this corrupted (s1, s3, s4, s6, s10 all scored 0/10).
 *
 * The two guards that already exist cannot see it. The destructive-write refusal fires on REMOVAL; the end-of-run
 * reparse fires on UNPARSEABILITY; set G's corruption was the ADDITION of syntactically LEGAL duplicates. `lostDefs`
 * structurally cannot see it (`defNames()` returns a Set), and `duplicateDecls.js` is anchored at column 0 and
 * exempts class methods on purpose - which is why "times at the top level" appears twice in all 58 set G runs.
 *
 * What is pinned here:
 *   - two identical LINES deletes do not get the same answer, and each names what it ACTUALLY removed;
 *   - the answer carries the resulting line count and the net delta;
 *   - a FIND whose REPLACE re-introduces definitions the file already has is REFUSED, and the file is untouched;
 *   - a FIND that survives into the result says so, so the model knows a resend will match again;
 *   - THE TRAP: repeat detection for a mutating tool keys on the ARGUMENTS. It used to key on exact answer
 *     equality, so encoding the outcome in the answer would have silently switched off `run.repeatCalls` - and in
 *     run 33a9d81d `repeatCalls: 25` was the ONLY thing that ever reacted to 26 identical corrupting edits.
 *   - controls: a new definition, a rename, a normal edit, and DUPLICATE: <names> on purpose.
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
// The THOUGHT differs on every call so the model's REPLIES are never identical - otherwise the stuck-loop guard
// (which compares replies) ends the run before the repeat under test happens. The CALL is byte-identical, which is
// what both the repeat notice and this bug are about.
let nth = 0;
const editLines = (p, range, repl) =>
  `THOUGHT: editing ${p} by line (attempt ${++nth}).\nACTION: edit_file\nPATH: ${p}\nLINES: ${range}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const editFind = (p, find, repl, extra = '') =>
  `THOUGHT: editing ${p} (attempt ${++nth}).\nACTION: edit_file\nPATH: ${p}\n${extra}FIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';

let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
// A case whose bug is documented as still open: counted, never green, and never a silent failure either.
const knownOpen = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { known++; openCases.push(n); console.log(`  known ${n}\n        ${e.message.split('\n')[0]}`); }
};
console.log('\nedit_file says what it did to the file\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'etruth', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write then edit.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'etruth', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'etruth-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'etruth' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return { run, steps: (run?.steps || []).filter((s) => s.type === 'tool') };
}
const file = (n) => readFileSync(join(dir, 'workspace', n), 'utf8').replace(/\r/g, '');
const editsOf = (steps) => steps.filter((s) => s.tool === 'edit_file').map((s) => String(s.result || ''));
const NOTE = /You already ran this exact/;

// ── SHAPE A: the LINES answer is arithmetic on the request ──────────────────────────────
// Padding lines that define nothing, so the destructive-removal refusal (a different guard) stays out of the way
// and the deletes really do land - which is the point: two identical requests delete two DIFFERENT pairs of lines.
const PAD = ['const cfg = {', '  a: 1,', '  b: 2,', '  c: 3,', '  d: 4,', '  e: 5,', '};', 'function keep() {', '  return cfg;', '}', 'module.exports = { keep };'].join('\n');
const a1 = await runGoal('Delete the same two lines twice.', [write('pad.js', PAD), editLines('pad.js', '3-4', ''), editLines('pad.js', '3-4', ''), FINISH]);
const eA = editsOf(a1.steps);
await test('the premise: two identical LINES deletes reached the tool', () => assert.equal(eA.length, 2, 'edit_file calls: ' + eA.length));
await test('the premise: they really did delete two DIFFERENT pairs of lines', () => {
  const now = file('pad.js');
  assert.ok(!now.includes('b: 2'), 'the first delete did not land');
  assert.ok(!now.includes('d: 4'), 'the second delete did not land');
});
// THE BUG. In run 071d5478 nine of these were byte-identical while eighteen different lines went.
//
// Compare the sentence the TOOL returned, not the whole recorded result: the hub appends its repeat notice and its
// syntax verdict, so the two results differ even when the tool said the same thing. Measured while writing this -
// against the unfixed hub this assertion PASSED on the appended notice alone, which would have made it a test that
// could never fail for the right reason.
const toolSays = (s) => String(s).split('\n')[0];
await test('two identical LINES deletes do NOT get the same answer', () => {
  assert.notEqual(toolSays(eA[0]), toolSays(eA[1]), 'byte-identical answer for a different outcome: ' + toolSays(eA[0]));
});
await test('each answer names the lines it ACTUALLY removed', () => {
  assert.match(eA[0], /b: 2/, 'first answer does not say what went: ' + eA[0]);
  assert.match(eA[1], /d: 4/, 'second answer does not say what went: ' + eA[1]);
});
await test('the answer carries the resulting line count and the net delta', () => {
  assert.match(eA[0], /now 9 lines \(-2\)/, eA[0]);
  assert.match(eA[1], /now 7 lines \(-2\)/, eA[1]);
});
// THE TRAP: once the answer varies, answer-equality can no longer detect a repeat.
await test('the second identical edit is still named as a repeat', () => assert.match(eA[1], NOTE, eA[1].slice(-260)));
await test('run.repeatCalls still counts it (the stuck-run stop depends on this)', () => {
  assert.ok((a1.run?.repeatCalls || 0) >= 1, 'repeatCalls: ' + (a1.run?.repeatCalls || 0));
});

// ── SHAPE B: a FIND whose REPLACE contains the FIND ─────────────────────────────────────
const PY = ['class Graph:', '    def __init__(self):', '        self.adj = {}', '', '    def nodes(self):', '        return list(self.adj)'].join('\n');
// Exactly run 33a9d81d's shape: FIND the class header, REPLACE with the class header plus a body that repeats the
// methods already there. Legal Python, no syntax error, and it duplicates __init__ and nodes.
const REINTRO = ['class Graph:', '    def __init__(self):', '        self.adj = {}', '', '    def nodes(self):', '        return list(self.adj)', '', '    def degree(self, a):', '        return 0'].join('\n');
const b1 = await runGoal('Add degree by replacing the class header.', [write('g.py', PY), editFind('g.py', 'class Graph:', REINTRO), FINISH]);
const eB = editsOf(b1.steps);
await test('the premise: the edit reached the tool', () => assert.equal(eB.length, 1, 'edit_file calls: ' + eB.length));
await test('a REPLACE that re-introduces definitions the file already has is REFUSED', () => {
  assert.match(eB[0], /^ERROR: this edit_file would have DUPLICATED/, eB[0].slice(0, 240));
  assert.match(eB[0], /__init__/, eB[0].slice(0, 400));
  assert.match(eB[0], /\bnodes\b/, eB[0].slice(0, 400));
});
await test('and the file is left exactly as it was', () => assert.equal(file('g.py'), PY));

// The same mechanism with a REPLACE that adds only a NEW definition: allowed (countBefore === 0), but the FIND
// survives into the result, so the answer must say so - that is the fact that makes a resend a duplication.
const ADDNEW = ['class Graph:', '    def degree(self, a):', '        return 0'].join('\n');
const b2 = await runGoal('Add degree, then send it again.', [write('h.py', PY), editFind('h.py', 'class Graph:', ADDNEW), editFind('h.py', 'class Graph:', ADDNEW), FINISH]);
const eB2 = editsOf(b2.steps);
await test('the premise: both edits reached the tool', () => assert.equal(eB2.length, 2, 'edit_file calls: ' + eB2.length));
await test('a new definition is allowed, and the answer warns the FIND survived', () => {
  assert.match(eB2[0], /^OK: edited/, eB2[0].slice(0, 240));
  assert.match(eB2[0], /"class Graph:" still appears 1 time/, eB2[0].slice(0, 400));
  assert.match(eB2[0], /now 8 lines \(\+2\)/, eB2[0].slice(0, 400));
});
await test('sending the very same edit again is REFUSED as a duplicate, not answered OK', () => {
  assert.match(eB2[1], /^ERROR: this edit_file would have DUPLICATED/, eB2[1].slice(0, 240));
  assert.match(eB2[1], /degree/, eB2[1].slice(0, 400));
});
await test('so the file holds exactly one degree, not two', () => {
  assert.equal(file('h.py').split('def degree').length - 1, 1, file('h.py'));
});

// ── controls: everything that must still work ───────────────────────────────────────────
const JS = ['class Store {', '  constructor() { this.m = {}; }', '  get(k) { return this.m[k]; }', '}', 'module.exports = { Store };'].join('\n');
const c1 = await runGoal('Add a new method.', [write('s1.js', JS), editFind('s1.js', '  get(k) { return this.m[k]; }', '  get(k) { return this.m[k]; }\n  has(k) { return k in this.m; }'), FINISH]);
await test('control: adding a genuinely NEW definition is not refused', () => {
  const r = editsOf(c1.steps)[0] || '';
  assert.match(r, /^OK: edited/, r.slice(0, 240));
  assert.ok(file('s1.js').includes('has(k)'), 'the edit did not land');
});
const c2 = await runGoal('Rename a method.', [write('s2.js', JS), editFind('s2.js', '  get(k) { return this.m[k]; }', '  fetch(k) { return this.m[k]; }', 'REMOVE: get\n'), FINISH]);
await test('control: a rename keeps the count at 1 and is not refused as a duplicate', () => {
  const r = editsOf(c2.steps)[0] || '';
  assert.doesNotMatch(r, /DUPLICATED/, r.slice(0, 240));
  assert.match(r, /^OK: edited/, r.slice(0, 240));
});
const c3 = await runGoal('Normal edit.', [write('s3.js', JS), editFind('s3.js', 'this.m = {};', 'this.m = Object.create(null);'), FINISH]);
await test('control: a plain unique FIND/REPLACE still edits and still says OK', () => {
  const r = editsOf(c3.steps)[0] || '';
  assert.match(r, /^OK: edited s3\.js/, r.slice(0, 240));
  assert.ok(file('s3.js').includes('Object.create(null)'), 'the edit did not land');
});
// The escape hatch, exactly like REMOVE: for the destructive guard. A refusal a caller cannot get past is a loop,
// and two classes in one file legitimately having a same-named method is real code.
const c4 = await runGoal('Duplicate on purpose.', [write('s4.py', PY), editFind('s4.py', 'class Graph:', REINTRO, 'DUPLICATE: __init__, nodes\n'), FINISH]);
await test('control: DUPLICATE: <names> performs it on purpose', () => {
  const r = editsOf(c4.steps)[0] || '';
  assert.match(r, /^OK: edited/, r.slice(0, 240));
  assert.ok(file('s4.py').includes('def degree'), 'the confirmed edit did not land');
});

hub.kill(); mock.close();

const KNOWN_EXPECTED = 0;   // bugs known open today; see the header for what and why
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
// The one line the suite runner greps, so a green file can never hide an open bug in the summary.
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
