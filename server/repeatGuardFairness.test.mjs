/**
 * repeatGuardFairness.test.mjs - the stuck-loop guard must not kill a run that is getting work done.
 *
 *   node server/repeatGuardFairness.test.mjs
 *
 * Set F (2026-09-11): 77 of the base 14B's 100 goals were stopped by this guard, after a median of SIX tool calls,
 * usually right after three identical FAILING edits. The guard keys on the model's REPLY, while the thing that
 * failed is the TOOL RESULT - so a tool refusing three times and a model looping three times are indistinguishable
 * to it, and the run is recorded as "the model produced the same response 3 times without making progress".
 *
 * Three properties, each measured from the code as it stands:
 *   1. run.recent is only ever trimmed at length > 8 - nothing clears it when a step succeeds. ctxSquashes and
 *      connRetries are both reset on a successful call two lines earlier; this window is not. So A,B,A,B,A with real
 *      work at every B is three "identical" replies inside the window, and the run dies at step 5 having written
 *      two files.
 *   2. norm is the reply whitespace-collapsed and cut to 2000 chars, so two DIFFERENT large writes that share a
 *      preamble count as the same response.
 *   3. The pardon requires run.justSubstituted, which only the orientation-tool substitution sets. A model whose
 *      edit_file has failed identically three times gets no pardon at all.
 *
 * This test does not assert a fix; it pins the behaviour so a fix can be measured. Cases that document a CURRENT
 * failure are named "(known)" and are expected to fail until the guard is changed.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const readF = (p) => `THOUGHT: reading ${p}.\nACTION: read_file\nPATH: ${p}`;
const editMiss = (p, find) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\nconst fixed = 1;\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe stuck-loop guard, measured against work actually done\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'rep', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: work.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'rep', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'repfair-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'rep' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
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
const wsFile = (n) => (existsSync(join(dir, 'workspace', n)) ? readFileSync(join(dir, 'workspace', n), 'utf8') : null);
const stoppedForRepeat = (run) => (run?.steps || []).some((s) => s.type === 'error' && /same response/i.test(String(s.text || '')));

// 1. A,B,A,B,A where every B is a real, different, successful write. The three A replies are identical, but the run
//    is plainly making progress - two files exist by the end of it.
const READ = readF('notes.md');
const s1 = await runGoal('Work steadily.', [
  write('notes.md', 'line one'), READ, write('one.js', 'const one = 1;'), READ, write('two.js', 'const two = 2;'), READ, FINISH,
]);
// The premise cannot ask for three reads: the guard fires ON the third identical reply, so the third read never
// happens. What has to be true for the cases below to mean anything is that the run repeated a reply at all AND got
// real work done in between - two reads and one successful write is exactly that.
await test('the premise: the reply repeated, with real work in between', () => {
  const tools = (s1?.steps || []).filter((s) => s.type === 'tool');
  const reads = tools.filter((s) => s.tool === 'read_file').length;
  const writes = tools.filter((s) => s.tool === 'write_file' && /^OK/.test(String(s.result || ''))).length;
  assert.ok(reads >= 2, 'read_file ran ' + reads + ' time(s) - no reply was ever repeated');
  assert.ok(writes >= 2, 'only ' + writes + ' write(s) succeeded - there was no progress to be punished for');
});
await test('(known) a run writing new files between repeats is not stopped as stuck', () => {
  assert.ok(!stoppedForRepeat(s1), 'stopped for repetition despite real work: ' + String(s1?.status));
});
await test('(known) and the work it completed is not thrown away', () => {
  assert.equal(wsFile('one.js'), 'const one = 1;', 'one.js missing');
  assert.equal(wsFile('two.js'), 'const two = 2;', 'two.js missing');
});

// 2. Three DIFFERENT large writes that share a long preamble. They differ only past 2000 characters, so the
//    normalised key collides and they count as the same reply.
const pad = 'const filler = "' + 'x'.repeat(2200) + '";';
const big = (n) => write('big.js', `${pad}\nconst version = ${n};`);
const s2 = await runGoal('Iterate on a big file.', [big(1), big(2), big(3), FINISH]);
await test('(known) three different large writes are not treated as the same response', () => {
  assert.ok(!stoppedForRepeat(s2), 'the 2000-char key collided: ' + String(s2?.status));
});
await test('(known) and the last of those writes reached the file', () => {
  assert.match(String(wsFile('big.js') || ''), /const version = 3;/, 'the third write never landed');
});

// 2b. The key ON ITS OWN. The case above cannot pin it: those three writes SUCCEED, so `landed` moves between them
//     and the window condition alone stops the guard firing - keys or no keys. Found by a mutant escaping: reverting
//     the key to a 2000-char slice broke nothing, meaning the key fix could have been deleted unnoticed.
//     Here nothing lands (read_file never counts as work landing), so the window condition cannot help, and the three
//     replies differ ONLY past 2000 characters. If the key is truncated they collide and the run is stopped for
//     repeating itself; with a whole-reply key they are three different replies, which is what they are.
//     This is the shape that matters in practice: a model iterating on a large file whose writes keep FAILING.
const preamble = 'THOUGHT: ' + 'reasoning about the failure at length. '.repeat(70);   // > 2000 chars
const bigRead = (n) => `${preamble}\nDetail number ${n} that only appears after two thousand characters.\nACTION: read_file\nPATH: notes.md`;
const s2b = await runGoal('Look again, thinking hard each time.', [
  write('notes.md', 'line one'), bigRead(1), bigRead(2), bigRead(3), FINISH,
]);
await test('the premise: the three long replies differ only past 2000 characters', () => {
  const a = bigRead(1).replace(/\s+/g, ' ').trim(), b = bigRead(2).replace(/\s+/g, ' ').trim();
  assert.equal(a.slice(0, 2000), b.slice(0, 2000), 'the fixture differs inside the first 2000 chars - it proves nothing');
  assert.notEqual(a, b, 'the fixture replies are actually identical');
});
await test('three long replies that differ only past 2000 chars are not treated as one', () => {
  assert.ok(!stoppedForRepeat(s2b), 'stopped for repetition on three different replies: ' + String(s2b?.status));
  const reads = (s2b?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'read_file').length;
  assert.ok(reads >= 3, `only ${reads} read(s) ran - the guard cut it short`);
});

// 3. The measured set F shape: the same edit_file failing identically three times. The TOOL refused every time; the
//    model is what gets blamed, and there is no pardon on this path.
const s3 = await runGoal('Fix the helper in miss.js.', [
  write('miss.js', 'const a = 1;\nconst b = 2;\n'),
  editMiss('miss.js', 'function nowhere() {}'), editMiss('miss.js', 'function nowhere() {}'), editMiss('miss.js', 'function nowhere() {}'), FINISH,
]);
await test('the premise: the edit really did fail three times', () => {
  const errs = (s3?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'edit_file' && /^ERROR/.test(String(s.result || ''))).length;
  assert.ok(errs >= 2, 'edit_file failed ' + errs + ' time(s)');
});
await test('(known) a run whose TOOL failed three times is not reported as the model repeating itself', () => {
  const err = (s3?.steps || []).find((s) => s.type === 'error' && /same response/i.test(String(s.text || '')));
  assert.ok(!err, 'blamed the model for a tool that refused: ' + String(err?.text || '').slice(0, 160));
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
process.exit(failed ? 1 : 0);
