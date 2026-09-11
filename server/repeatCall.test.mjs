/**
 * repeatCall.test.mjs - the same tool call, returning the same answer, is named as a repeat.
 *
 *   node server/repeatCall.test.mjs
 *
 * Set E (2026-09-11) counted the same tool called with the same arguments and returning the same answer 155 times for
 * the base 14B and 221 times for Qwen3-Coder: a file re-read unchanged, a command re-run to the same failure, an edit
 * re-applied. The repeat guard only compares identical REPLIES, so a loop built from identical CALLS was invisible to
 * everything - the model was never told that a step had changed nothing.
 *   - the second identical call carries the notice, the first does not;
 *   - a repeated call whose answer CHANGED stays silent (that is progress, not a loop);
 *   - two different calls stay silent.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
// The THOUGHT differs every time so the REPLIES are not identical - otherwise the stuck-loop guard (which compares
// replies) ends the run before the third call. The CALL is identical, which is what the repeat notice looks at.
let nth = 0;
const read = (p) => `THOUGHT: reading ${p} (look ${++nth}).\nACTION: read_file\nPATH: ${p}`;
const list = () => 'THOUGHT: looking around.\nACTION: list_dir\nPATH: .';
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na repeated call with the same answer is named\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'repeat', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: read the file.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'repeat', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'repeatcall-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'repeat' } }, history: [], settings: {} }), 'utf8');
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
const NOTE = /You already ran this exact/;

// read the same file twice (the answer cannot change), then list_dir twice, with one different call between
// Scripted replies do not map one-to-one onto model calls (a gate or a nudge can take one), so assert on what the
// reads say, not on their positions.
const s1 = await runGoal('Read it twice.', [write('r.js', 'const a = 1;'), read('r.js'), read('r.js'), list(), read('r.js'), read('r.js'), FINISH]);
const reads = s1.filter((s) => s.tool === 'read_file').map((s) => String(s.result || ''));
await test('the premise: at least three reads of the same file reached the tool', () => { assert.ok(reads.length >= 3, 'read_file calls: ' + reads.length); });
await test('the first read says nothing about repeating', () => { assert.doesNotMatch(reads[0], NOTE, reads[0].slice(0, 160)); });
await test('every later identical read is named as a repeat', () => {
  for (const [i, r] of reads.slice(1).entries()) assert.match(r, NOTE, `read ${i + 2}: ` + r.slice(-200));
});
await test('the list_dir between them is not named', () => {
  for (const l of s1.filter((s) => s.tool === 'list_dir').map((s) => String(s.result || ''))) assert.doesNotMatch(l, NOTE, l.slice(0, 160));
});

// a repeated call whose answer changed: read, edit the file, read again
const s2 = await runGoal('Read, change, read.', [write('c.js', 'const a = 1;'), read('c.js'), write('c.js', 'const a = 2;'), read('c.js'), FINISH]);
const reads2 = s2.filter((s) => s.tool === 'read_file').map((s) => String(s.result || ''));
await test('a repeated call whose answer changed stays silent', () => {
  assert.equal(reads2.length, 2, 'read_file calls: ' + reads2.length);
  assert.doesNotMatch(reads2[1], NOTE, reads2[1].slice(-200));
});
await test('different calls stay silent', () => {
  const others = s2.filter((s) => s.tool !== 'read_file').map((s) => String(s.result || ''));
  for (const o of others) assert.doesNotMatch(o, NOTE, o.slice(0, 160));
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
