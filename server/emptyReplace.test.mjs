/**
 * emptyReplace.test.mjs - an edit that never said what to put back is not a deletion.
 *
 *   node server/emptyReplace.test.mjs
 *
 * Audited 2026-09-11. `ACTION: edit_file` + `PATH:` + a fenced `FIND:` and NO `REPLACE:` anywhere parsed to
 * {find: "<the snippet>", replace: ""} - because the replacement defaulted to '' when its pattern did not match -
 * and edit_file then wrote content.replace(find, '') and answered `OK: edited a.js.` The model asked to change
 * something and the hub silently removed it.
 *
 * Two ways in, both measured: the model omits REPLACE, or the reply is cut off right after the FIND block. Neither
 * is an instruction to delete. The BARE form is already safe - its pattern requires a following REPLACE: marker, so
 * a missing REPLACE yields no FIND at all and a loud error - which is exactly the asymmetry that made the fenced
 * form a bug rather than a policy.
 *
 * Deliberate deletion keeps working, and is pinned here: LINES: a-b with an empty REPLACE, and an explicitly empty
 * REPLACE block, both still delete.
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
const findNoReplace = (p, find) => `THOUGHT: removing the old helper.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}`;
const findReplace = (p, find, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const linesRepl = (p, range, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nLINES: ${range}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const linesReplRemove = (p, range, repl, remove) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nLINES: ${range}\nREMOVE: ${remove}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na missing REPLACE is a mistake, not a deletion\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'empt', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write then edit.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'empt', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'empt-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'empt' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
  return (run?.steps || []).filter((s) => s.type === 'tool');
}
const file = (n) => readFileSync(join(dir, 'workspace', n), 'utf8').replace(/\r/g, '');

const SRC = ['function len(v) {', '  return Math.sqrt(v.x * v.x + v.y * v.y);', '}', 'function scale(v, k) {', '  return { x: v.x * k, y: v.y * k };', '}', 'module.exports = { len, scale };'].join('\n');
const HELPER = 'function len(v) {\n  return Math.sqrt(v.x * v.x + v.y * v.y);\n}';

// The refusal gets its own goal, so the file is read while the refusal is the last thing that happened.
const s1 = await runGoal('Edit vec.js.', [write('vec.js', SRC), findNoReplace('vec.js', HELPER), FINISH]);
const e1 = s1.filter((s) => s.tool === 'edit_file').map((s) => String(s.result || ''));
await test('the premise: the edit reached the tool', () => assert.equal(e1.length, 1, 'edit_file calls: ' + e1.length));
// Measured while writing this: the destructive-write refusal ALREADY stops this, by a different route - it notices
// that len would disappear and restores the file. So the contract to pin is the outcome (refused, nothing written,
// and the reason names what would have been lost), not a particular sentence about REPLACE.
await test('a FIND with no REPLACE at all is refused, not treated as a deletion', () => {
  assert.match(e1[0], /^ERROR/, e1[0].slice(0, 200));
  assert.match(e1[0], /REMOVED|REPLACE/i, e1[0].slice(0, 300));
  assert.match(e1[0], /\blen\b/, 'does not say what would have been lost: ' + e1[0].slice(0, 300));
});
await test('and the file is left exactly as it was', () => assert.equal(file('vec.js'), SRC));

const s2 = await runGoal('Edit w.js properly.', [write('w.js', SRC), findReplace('w.js', '  return { x: v.x * k, y: v.y * k };', '  return { x: v.x * k, y: v.y * k, k };'), FINISH]);
await test('control: a normal FIND/REPLACE still edits', () => {
  const r = String(s2.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^OK: edited/, r.slice(0, 200));
  assert.ok(file('w.js').includes('y: v.y * k, k };'), 'the edit did not land');
});

// Lines 4-6 ARE the scale() definition, so deleting them by number is not "deliberate" in the sense that matters:
// a line range is not evidence the caller knows a method lives there - all the more so while read_file could hand
// out numbers for a file it only partly showed. So the rule pinned here is: a LINES deletion that removes no
// definition or export just works, and one that removes a name needs REMOVE:, like every other destructive act.
// (An earlier version of this test asserted the opposite, and the code was briefly patched to satisfy it - which
// broke destructiveWrite's guarantee that an edit deleting a method is refused. The test was the thing that was wrong.)
const s3 = await runGoal('Delete a line on purpose.', [write('x.js', SRC), linesRepl('x.js', '5-5', ''), FINISH]);
await test('control: LINES with an empty REPLACE deletes lines that define nothing', () => {
  const r = String(s3.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^OK: edited/, r.slice(0, 200));
  assert.ok(!file('x.js').includes('x: v.x * k'), 'the deliberate deletion did not happen');
  assert.ok(file('x.js').includes('function scale'), 'it removed more than the line asked for');
});

const s3b = await runGoal('Delete a method by line number.', [write('z.js', SRC), linesRepl('z.js', '4-6', ''), FINISH]);
await test('a LINES deletion that would remove a method is refused, and names it', () => {
  const r = String(s3b.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^ERROR/, r.slice(0, 200));
  assert.match(r, /\bscale\b/, r.slice(0, 300));
  assert.ok(file('z.js').includes('function scale'), 'the method went anyway');
});

const s3c = await runGoal('Delete a method on purpose.', [write('zz.js', SRC), linesReplRemove('zz.js', '4-6', '', 'scale'), FINISH]);
await test('REMOVE: <names> performs a LINES deletion of a method on purpose', () => {
  const r = String(s3c.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^OK: edited/, r.slice(0, 200));
  assert.ok(!file('zz.js').includes('function scale'), 'the confirmed deletion did not happen');
});

const s4 = await runGoal('Delete the helper on purpose.', [write('y.js', SRC), findReplace('y.js', HELPER, ''), FINISH]);
await test('control: an explicitly empty REPLACE block still deletes', () => {
  const r = String(s4.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^(OK: edited|ERROR: this edit_file would have REMOVED)/, r.slice(0, 200));
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
