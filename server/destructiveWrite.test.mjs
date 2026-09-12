/**
 * destructiveWrite.test.mjs - a write that would delete what a file already has is refused, not narrated.
 *
 *   node server/destructiveWrite.test.mjs
 *
 * Set F (2026-09-11): Qwen3-Coder's goal 81 rewrote s1_library.js without titles, returnBook, getLoans, holds,
 * overdue and pay. The hub warned; the code never came back; and because the hidden checks score the FINAL
 * workspace, that one write erased the credit for eight earlier steps of the chain. 7 of its 8 definition-loss
 * warnings ended with the names still missing. Warning is not protection.
 *   - a rewrite that drops a method is REFUSED and the file is left exactly as it was;
 *   - resending the file complete succeeds;
 *   - REMOVE: <names> performs the deletion on purpose;
 *   - an edit_file that deletes a method is refused the same way;
 *   - a write that drops only the export is refused too;
 *   - controls: a write that keeps everything, and a brand-new file, are untouched by this.
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
const write = (p, body, remove) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${remove ? `REMOVE: ${remove}\n` : ''}${FENCE}\n${body}\n${FENCE}`;
const editLines = (p, range, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nLINES: ${range}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na write that would delete existing work is refused\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'destr', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write the file.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'destr', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'destr-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'destr' } }, history: [], settings: {} }), 'utf8');
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
  return (run?.steps || []).filter((s) => s.type === 'tool');
}
const file = (n) => readFileSync(join(dir, 'workspace', n), 'utf8').replace(/\r/g, '');

const FULL = ['class Lib {', '  add(x) { return x; }', '  titles() { return []; }', '}', 'module.exports = { Lib };'].join('\n');
const DROPPED = ['class Lib {', '  add(x) { return x; }', '}', 'module.exports = { Lib };'].join('\n');
const NO_EXPORT = FULL.replace('module.exports = { Lib };', 'console.log(new Lib());');

// The refused write gets its own goal, so the file can be inspected while the refusal is the last thing that
// happened - checking after a later resend would read the resent content and prove nothing.
const s1 = await runGoal('Write, then rewrite badly.', [write('a.js', FULL), write('a.js', DROPPED), FINISH]);
const w1 = s1.filter((s) => s.tool === 'write_file').map((s) => String(s.result || ''));
await test('the premise: two writes reached the tool', () => assert.equal(w1.length, 2, 'write_file calls: ' + w1.length));
await test('a rewrite that drops a method is refused and names it', () => {
  assert.match(w1[1], /^ERROR: this write_file would have REMOVED/, w1[1].slice(0, 200));
  assert.match(w1[1], /titles/, w1[1].slice(0, 300));
  assert.match(w1[1], /REMOVE: /, w1[1].slice(-200));
});
await test('the file is left exactly as it was', () => assert.equal(file('a.js'), FULL));

const s1b = await runGoal('Resend it complete.', [write('a.js', FULL.replace('return x;', 'return x + 1;')), FINISH]);
await test('resending the file complete succeeds', () => {
  const w = s1b.filter((s) => s.tool === 'write_file').map((s) => String(s.result || ''));
  assert.match(w[0], /^OK: wrote/, w[0].slice(0, 120));
  assert.equal(file('a.js'), FULL.replace('return x;', 'return x + 1;'));
});

const s2 = await runGoal('Delete on purpose.', [write('b.js', FULL), write('b.js', DROPPED, 'titles'), FINISH]);
const w2 = s2.filter((s) => s.tool === 'write_file').map((s) => String(s.result || ''));
await test('REMOVE: <names> performs the deletion on purpose', () => {
  assert.match(w2[1], /^OK: wrote/, w2[1].slice(0, 160));
  assert.equal(file('b.js'), DROPPED);
});

const s3 = await runGoal('Edit away a method.', [write('c.js', FULL), editLines('c.js', '3-3', ''), FINISH]);
const e3 = s3.filter((s) => s.tool === 'edit_file').map((s) => String(s.result || ''));
await test('an edit_file that deletes a method is refused too, and the file survives', () => {
  assert.match(e3[0], /^ERROR: this edit_file would have REMOVED/, e3[0].slice(0, 200));
  assert.equal(file('c.js'), FULL);
});

const s4 = await runGoal('Drop the export.', [write('d.js', FULL), write('d.js', NO_EXPORT), FINISH]);
const w4 = s4.filter((s) => s.tool === 'write_file').map((s) => String(s.result || ''));
await test('a write that drops only the export is refused as well', () => {
  assert.match(w4[1], /^ERROR: this write_file would have REMOVED/, w4[1].slice(0, 200));
  assert.equal(file('d.js'), FULL);
});

const s5 = await runGoal('Keep everything.', [write('e.js', FULL), write('e.js', FULL + '\n// a comment'), write('f.js', 'function fresh() { return 1; }'), FINISH]);
const w5 = s5.filter((s) => s.tool === 'write_file').map((s) => String(s.result || ''));
await test('controls: a write that keeps every name, and a brand-new file, are untouched', () => {
  assert.match(w5[1], /^OK: wrote/, w5[1].slice(0, 120));
  assert.match(w5[2], /^OK: wrote/, w5[2].slice(0, 120));
  assert.equal(file('f.js'), 'function fresh() { return 1; }');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
