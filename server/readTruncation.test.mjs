/**
 * readTruncation.test.mjs - what read_file hands back is either the whole file, or says it is not.
 *
 *   node server/readTruncation.test.mjs
 *
 * Audited 2026-09-11: read_file built `[header][numbered body][... N more lines below]` and then sliced the whole
 * string to 14,000 characters - so the truncation removed the notice that announced it. Measured on a 240-line file:
 * 183 lines came back, the last one cut mid-token, with no notice, under a header that read "lines 1-240 of 240".
 * The model cannot tell that from a complete file. It then edits what it has and sends it back as the whole file,
 * and since the hidden checks score the FINAL workspace, everything below the cut is gone.
 *
 * The contract, whatever the sizes involved:
 *   - the header names the lines ACTUALLY included, never more;
 *   - a cut is always announced, and says where to continue from;
 *   - lines are whole - a result never ends in the middle of one;
 *   - a file that fits comes back whole, with nothing added.
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
const read = (p) => `THOUGHT: reading ${p}.\nACTION: read_file\nPATH: ${p}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nread_file never pretends a part is the whole\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'trunc', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: read the file.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'trunc', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'trunc-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });

// 240 lines is under BIG_FILE_LINES (250), so this is read "whole" rather than mapped - and at ~75 chars a line it
// is comfortably over the 14,000-character cap. This is an ordinary source file, not a pathological one.
const LINES = 240;
const big = Array.from({ length: LINES }, (_, i) => `const someReasonablyLongVariableName${i} = computeSomething(alpha${i}, beta${i}, gamma${i});`);
// No trailing newline: a trailing newline is a 241st (empty) line, and then the totals in every assertion below
// would be describing a different file than the one named here.
writeFileSync(join(ws, 'big.js'), big.join('\n'), 'utf8');
const SMALL = 20;
const small = Array.from({ length: SMALL }, (_, i) => `const s${i} = ${i};`);
writeFileSync(join(ws, 'small.js'), small.join('\n'), 'utf8');

writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'trunc' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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

const s1 = await runGoal('Read big.js.', [read('big.js'), FINISH]);
const R = String(s1.find((s) => s.tool === 'read_file')?.result || '');
// Every "N: " line the model was actually given.
const shown = [...R.matchAll(/^(\d+): (.*)$/gm)].map((m) => ({ n: +m[1], text: m[2] }));

await test('the premise: the file really is too big to hand over whole', () => {
  assert.ok(R.length > 0, 'no read_file result at all');
  assert.ok(shown.length > 0 && shown.length < LINES, `lines shown: ${shown.length} of ${LINES} - the cap did not bite, so this test proves nothing`);
});
await test('the header does not claim lines it did not include', () => {
  const m = R.match(/^\[big\.js — lines (\d+)-(\d+) of (\d+)/);
  assert.ok(m, 'no header: ' + R.slice(0, 120));
  assert.equal(+m[3], LINES, 'wrong total');
  const last = shown[shown.length - 1].n;
  assert.equal(+m[2], last, `header says it ends at line ${m[2]} but the last line actually present is ${last}`);
});
await test('the cut is announced, and says where to continue from', () => {
  assert.match(R, /more lines below/, 'no truncation notice: ' + R.slice(-200));
  const m = R.match(/OFFSET: (\d+)/);
  assert.ok(m, 'the notice does not say where to continue: ' + R.slice(-200));
  assert.equal(+m[1], shown[shown.length - 1].n + 1, 'OFFSET does not continue from the last line shown');
});
await test('no line is handed back cut in half', () => {
  const last = shown[shown.length - 1];
  assert.equal(last.text, big[last.n - 1], `line ${last.n} was cut mid-line:\n        got  ${last.text.slice(-40)}\n        real ${big[last.n - 1].slice(-40)}`);
});
await test('it still fits in the cap', () => assert.ok(R.length <= 14_000, 'result is ' + R.length + ' chars'));

const s2 = await runGoal('Read small.js.', [read('small.js'), FINISH]);
const R2 = String(s2.find((s) => s.tool === 'read_file')?.result || '');
await test('control: a file that fits comes back whole, with no cut announced', () => {
  assert.match(R2, /^\[small\.js — lines 1-20 of 20\]/, R2.slice(0, 120));
  assert.doesNotMatch(R2, /more lines below/, 'announced a cut on a complete file');
  assert.ok(R2.includes(`${SMALL}: ${small[SMALL - 1]}`), 'the last line is missing');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
