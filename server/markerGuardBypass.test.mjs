/**
 * markerGuardBypass.test.mjs - the workspace boundary marker cannot be edited by any route.
 *
 *   node server/markerGuardBypass.test.mjs
 *
 * package.json is not a normal file in a workspace: it stops npm and node from treating the hub's own checkout as the
 * project, and the system prompt tells the model "this workspace is CommonJS" as a fact built on it. The guard's own
 * comment says it plainly - "a guard that silently stops matching is worse than no guard" - and it has two holes:
 *
 * 1. markerRefusal is called from write_file (agent.js:494) and edit_file (:592) and NOWHERE ELSE. append_file, which
 *    is auto-approved and is the tool the hub actively steers a model toward when a FIND misses, has no guard at all.
 *    One append of a line to package.json makes it invalid JSON.
 * 2. The guard normalises by splitting on both separators and dropping '.' segments, so './package.json' is caught -
 *    but 'sub/../package.json' normalises to itself, compares unequal to 'package.json', and passes. safePath then
 *    resolves it to exactly the marker. The guard and the writer disagree about what a path means.
 *
 * Why it is silent: all three routes answer OK. The damage is not in the file the model was working on, it is in the
 * boundary that keeps `node` and `npm` pointed at the workspace - so the next command behaves differently and nothing
 * connects that to this write. This already happened in production once: two of four audited run workspaces had
 * acquired "type": "module", each internally consistent, which is why it stayed invisible.
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
const append = (p, body) => `THOUGHT: appending to ${p}.\nACTION: append_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe workspace boundary marker is protected from every route\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'mark', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: touch the marker.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'mark', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'marker-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'mark' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
const marker = () => readFileSync(join(dir, 'workspace', 'package.json'), 'utf8');
const markerIsIntact = () => {
  const src = marker();
  let j = null;
  try { j = JSON.parse(src); } catch { return 'package.json is no longer valid JSON: ' + JSON.stringify(src.slice(-60)); }
  if (j.type !== 'commonjs') return 'the marker no longer says type commonjs: ' + JSON.stringify(j);
  return null;
};

// The hub writes the marker itself when the workspace is created, so a run has to exist first.
const s0 = await runGoal('Write a first file.', [write('a.js', 'const a = 1;'), FINISH]);
await test('the premise: the workspace has its boundary marker', () => {
  assert.equal(s0.length >= 1, true, 'no tool ran');
  assert.equal(markerIsIntact(), null, String(markerIsIntact()));
});

// 1. append_file has no guard at all.
const s1 = await runGoal('Add a field to package.json.', [append('package.json', '# appended by the agent'), FINISH]);
await test('append_file may not change the marker', () => {
  const r = String(s1.find((s) => s.tool === 'append_file')?.result || '');
  assert.match(r, /^ERROR/, 'append_file was allowed: ' + r.slice(0, 160));
});
await test('and the marker is still valid after the attempt', () => {
  assert.equal(markerIsIntact(), null, String(markerIsIntact()));
});

// 2. a traversal path the guard and safePath disagree about.
const s2 = await runGoal('Set the module type.', [write('sub/../package.json', '{"type":"module"}'), FINISH]);
await test('a traversal path does not get past the guard', () => {
  const r = String(s2.find((s) => s.tool === 'write_file')?.result || '');
  assert.match(r, /^ERROR/, 'write_file through sub/../ was allowed: ' + r.slice(0, 160));
});
await test('and the marker still says commonjs', () => {
  assert.equal(markerIsIntact(), null, String(markerIsIntact()));
});

// ── controls: the guard already works on these, and ordinary files are untouched ──
const s3 = await runGoal('Write the marker directly.', [write('package.json', '{"type":"module"}'), FINISH]);
await test('control: the direct path is still refused', () => {
  assert.match(String(s3.find((s) => s.tool === 'write_file')?.result || ''), /^ERROR/);
});
const s4 = await runGoal('Append to a normal file.', [write('notes.md', 'one'), append('notes.md', 'two'), FINISH]);
await test('control: append_file still works on an ordinary file', () => {
  const r = String(s4.find((s) => s.tool === 'append_file')?.result || '');
  assert.match(r, /^OK: appended/, r.slice(0, 160));
  assert.match(readFileSync(join(dir, 'workspace', 'notes.md'), 'utf8'), /two/);
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;
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
