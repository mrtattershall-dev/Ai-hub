/**
 * gitUndo.test.mjs - git_undo must actually undo, from the real approve route.
 *
 *   node server/gitUndo.test.mjs
 *
 * Found by calling every tool once in an isolated hub: git_undo was the only one of 29 that
 * failed - "Your local changes to the following files would be overwritten by merge".
 * Checkpoints are taken BEFORE each mutating tool, so the latest change is normally still
 * uncommitted when git_undo runs, and git_undo took no checkpoint of its own. So it failed in
 * the ORDINARY case, not an edge case.
 *
 * What is asserted:
 *   1. workspaceGit.undo: a revert that conflicts leaves no conflict markers and no revert
 *      "in progress" - the working tree is exactly as it was.
 *   2. the loop: write "one", write "two", remember a note, git_undo (approved through the
 *      real /approve route) -> the result is OK, the file is "one" again, and the note the
 *      hub keeps in NOTES.md survives the undo.
 */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { freePorts } from './testPort.mjs';
import { ensureRepo, commitAll, undo } from './workspaceGit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 400)}`); }
};

console.log('\ngit_undo\n');

await test('a revert that conflicts is backed out: no conflict markers, no revert in progress', async () => {
  const ws = join(mkdtempSync(join(tmpdir(), 'undo-unit-')), 'workspace');
  await ensureRepo(ws);
  writeFileSync(join(ws, 'a.txt'), '1\n'); await commitAll(ws, 'one');
  writeFileSync(join(ws, 'a.txt'), '2\n'); await commitAll(ws, 'two');
  const two = execFileSync('git', ['-C', ws, 'rev-parse', 'HEAD']).toString().trim();
  writeFileSync(join(ws, 'a.txt'), '3\n'); await commitAll(ws, 'three');
  const r = await undo(ws, { sha: two });          // undoing 1->2 conflicts with the later 2->3
  assert.equal(r.ok, false, 'this revert must conflict');
  const text = readFileSync(join(ws, 'a.txt'), 'utf8');
  assert.ok(!/<<<<<<<|>>>>>>>/.test(text), 'conflict markers left in the file:\n' + text);
  // Line endings normalised: with core.autocrlf=true (Git for Windows' default) the abort's
  // checkout writes the file back as CRLF. The CONTENT is what matters here.
  assert.equal(text.replace(/\r\n/g, '\n'), '3\n');
  assert.ok(!existsSync(join(ws, '.git', 'REVERT_HEAD')), 'a revert is still in progress');
  assert.equal(execFileSync('git', ['-C', ws, 'status', '--porcelain']).toString().trim(), '');
});

// ── the loop, through the real approve route ────────────────────────────────────
const F = '```';
const write = (path, body) => `THOUGHT: write ${path}\nACTION: write_file\nPATH: ${path}\n${F}\n${body}\n${F}`;
const reply = (thought, action) => `THOUGHT: ${thought}\nACTION: ${action}`;
const finish = (why) => reply(why, 'finish');
const SCRIPT = [
  write('a.txt', 'one'),
  write('a.txt', 'two'),
  reply('keep a note', 'remember\nTEXT: keep this note through the undo'),
  reply('the last change was wrong - undo it', 'git_undo\nSHA: HEAD'),
];

const [mockPort, hubPort] = await freePorts(2);
let k = 0;
const script = [...SCRIPT];
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'undo', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = [];
    try { messages = JSON.parse(body).messages || []; } catch { /* treated as a turn */ }
    const text = messages.length === 2 ? 'Plan: do what the goal says, then finish.'
      : (script.length ? script.shift() : finish(`scripted finish ${++k}`));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'undo', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'undo-loop-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'undo' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '5',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));
const API = `http://127.0.0.1:${hubPort}/api`;
const api = async (p, o) => (await fetch(API + p, {
  headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000),
})).json();
for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await sleep(250); } }

await test('the loop: git_undo, approved through the route, undoes the latest change and keeps NOTES.md', async () => {
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Write a.txt, then undo the last change.' }) });
  assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 200));
  const approved = [];
  let run = null;
  const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) {
    run = await api('/agent/' + s.runId).catch(() => null);
    if (run?.status === 'awaiting_approval' && run.pending) {
      approved.push(run.pending.tool);
      await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: true }) });
      continue;
    }
    if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  const step = (run?.steps || []).find((x) => x.type === 'tool' && x.tool === 'git_undo');
  assert.ok(step, `git_undo never ran (approved: ${approved.join(',') || 'none'}; status ${run?.status})`);
  assert.match(String(step.result), /^OK/, 'git_undo failed: ' + String(step.result).slice(0, 300));
  const a = readFileSync(join(ws, 'a.txt'), 'utf8');
  assert.ok(!/<<<<<<<|>>>>>>>/.test(a), 'conflict markers in a.txt');
  assert.equal(a.trim(), 'one', 'the latest change ("two") was not undone');
  assert.ok(existsSync(join(ws, 'NOTES.md')) && /keep this note/.test(readFileSync(join(ws, 'NOTES.md'), 'utf8')),
    'the undo rolled back the hub\'s own NOTES.md');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) console.log(hubLog.join('').slice(-1500));
process.exit(failed ? 1 : 0);
