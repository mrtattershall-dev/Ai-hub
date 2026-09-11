/**
 * truncatedFence.test.mjs - a reply cut off inside its code block writes NOTHING.
 *
 *   node server/truncatedFence.test.mjs
 *
 * 14B vs 32B head-to-head, 2026-09-10, 14B set A goal 19: the reply opened a code block for
 * t12_bits.js and wrote console.asserts until the token limit - 31,046 characters, no closing
 * fence. parseAction's fence regex matched nothing, the write branch fell back to an empty
 * string, and the hub wrote a 0-byte t12_bits.js. parserCorpus caught it the moment that reply
 * joined the replay corpus. The reply is used here VERBATIM, from the committed run data.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { parseAction, replyWasTruncated } from './agentParse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROWS = join(HERE, '..', 'measurements', '2026-09-10-14b-vs-32b', 'data', 'coder14b-base-setA', 'corpus-rows.jsonl');
// The goal-19 run left SEVERAL replies with this goal - the first is its short PLAN. Select the
// runaway itself: over 30,000 characters and an unclosed fence. (Matching on goal alone picked
// the plan, and "parses to nothing" then passed vacuously - a plan has no action either.)
const REAL = readFileSync(ROWS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .find((r) => r.model === 'coder14b' && /^Create t12_bits\.js/.test(r.goal)
    && r.text.length > 30000 && (r.text.match(/```/g) || []).length % 2 === 1)?.text;

const FENCE = '`'.repeat(3);
const write = (path, body) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}javascript\n${body}\n${FENCE}`;
const finish = (s) => `THOUGHT: done.\nACTION: finish\nSUMMARY: ${s}`;

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\na reply cut off inside its code block\n');

await test('the real 31k-char runaway reply is recognised as truncated', () => {
  assert.ok(REAL && REAL.length > 30000, 'the committed runaway reply was not found');
  assert.equal(replyWasTruncated(REAL), true);
});
await test('...and parses to NOTHING, not a write_file with empty content (the 0-byte file)', () => {
  assert.ok(REAL && REAL.length > 30000, 'the runaway reply is not loaded - this check would pass vacuously');
  assert.match(REAL, /ACTION:\s*write_file/, 'not the write reply');
  assert.equal(parseAction(REAL, null), null);
});
await test('a normal complete write still carries its full content', () => {
  const r = parseAction(write('a.js', 'module.exports = 1;'), null);
  assert.equal(r.tool, 'write_file');
  assert.equal(r.args.content, 'module.exports = 1;');
  assert.equal(replyWasTruncated(write('a.js', 'x')), false);
});
await test('a reply whose FIRST block closed still writes that block even if a later one was cut off', () => {
  const t = write('b.js', 'const b = 2;') + '\n\nTHOUGHT: and more\nACTION: append_file\nPATH: b.js\n' + FENCE + 'javascript\nconst c = 3;\nconst d =';
  const r = parseAction(t, null);
  assert.equal(r.tool, 'write_file');
  assert.equal(r.args.content, 'const b = 2;');
});
await test('an append_file cut off mid-block is refused too', () => {
  const t = 'THOUGHT: adding.\nACTION: append_file\nPATH: c.js\n' + FENCE + 'javascript\nfunction c() {\n  return 1;';
  assert.equal(replyWasTruncated(t), true);
  assert.equal(parseAction(t, null), null);
});
await test('a stray lone fence after a complete reply is NOT truncation (387 real replies end this way)', () => {
  assert.equal(replyWasTruncated('THOUGHT: listing.\nACTION: task_list\n' + FENCE), false);
  assert.equal(replyWasTruncated('THOUGHT: done.\nACTION: task_done\nWHICH: 5\n' + FENCE + '\n'), false);
});

// ── the loop: the model is TOLD, and no 0-byte file appears ──────────────────────────
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], requests: [], k: 0, log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'trunc', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = messages.length === 2;
    const text = planner ? 'Plan: write the file, then finish.' : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    rig.requests.push({ planner, messages, reply: text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'trunc', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'truncfence-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'trunc' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(d.toString()));
hub.stderr.on('data', (d) => rig.log.push(d.toString()));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();

const GOOD = write('t12_bits.js', 'function countBits(n) { let c = 0; while (n > 0) { c += n & 1; n >>= 1; } return c; }\nmodule.exports = { countBits };');
let run = null, reqs = [];
await test('the loop answers a cut-off reply with "CUT OFF", writes no 0-byte file, and the next complete write lands', async () => {
  assert.ok(up, 'hub did not start');
  rig.script = [REAL, GOOD, finish('bits')];
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create t12_bits.js exporting countBits(n).' }) });
  assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 160));
  for (let i = 0; i < 400; i++) {
    run = await api('/agent/' + s.runId).catch(() => null);
    if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && run.busy !== true) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  reqs = rig.requests;
  const after = (() => { for (const r of reqs) { const i = r.messages.findIndex((m) => m.role === 'assistant' && m.content === REAL); if (i !== -1 && r.messages[i + 1]) return String(r.messages[i + 1].content); } return null; })();
  assert.ok(after, 'the cut-off reply was never answered');
  assert.match(after, /CUT OFF/, 'answered, but not told it was cut off: ' + after.slice(0, 160));
  const zeroWrite = run.steps.some((st) => st.type === 'tool' && /wrote 0 bytes/.test(String(st.result || '')));
  assert.ok(!zeroWrite, 'a 0-byte write still happened');
  assert.ok(existsSync(join(ws, 't12_bits.js')) && statSync(join(ws, 't12_bits.js')).size > 20, 'the complete follow-up write did not land');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
