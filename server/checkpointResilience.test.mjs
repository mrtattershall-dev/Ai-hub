/**
 * checkpointResilience.test.mjs - auto-checkpoints cannot silently die, and run files survive a long sequence.
 *
 *   node server/checkpointResilience.test.mjs
 *
 * In set D (2026-09-11) BOTH runs lost their undo history partway through, and nothing in either run said so:
 *   - a model-made file named "10 + 20 + 5 = 35, not 45." - Windows cannot open a name ending in '.', so
 *     `git add -A` failed, and every checkpoint after goal 53 failed with it;
 *   - a stale .git/index.lock blocked every commit in the other workspace for the rest of the run.
 * And evictOldRuns deleted run FILES past AGENT_MAX_RUNS (40), so 100-goal runs kept only their last 40 records.
 *
 *   unit   commitAll commits the rest when one file cannot be added, and names it; clears a STALE lock; leaves a
 *          FRESH lock (git genuinely busy) alone and reports the failure
 *   loop   a checkpoint that fails puts one "checkpoint FAILED" note in the run, not one per step
 *   loop   with AGENT_MAX_RUNS=2, three finished runs still leave three run files on disk
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, existsSync, utimesSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { ensureRepo, commitAll } from './workspaceGit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
const gitLog = (d) => execFileSync('git', ['-C', d, 'log', '--name-only', '--format=%s'], { encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(d) } });
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\ncheckpoints cannot silently die; run files survive\n');

// ── unit ────────────────────────────────────────────────────────────────────────────
await test('one file git cannot add does not stop the rest from being committed', async () => {
  const ws = join(mkdtempSync(join(tmpdir(), 'cpres-')), 'w');
  await ensureRepo(ws);
  writeFileSync(join(ws, 'good.js'), 'module.exports = 1;\n');
  // A name ending in '.' - what the model made. Node strips the dot on Windows; the MSYS shell does not.
  execFileSync('bash', ['-c', `cd "${ws.replace(/\\/g, '/')}" && echo x > 'sum = 35, not 45.'`]);
  assert.ok(readdirSync(ws).some((f) => f.endsWith('.') && f.startsWith('sum')), 'could not create the trailing-dot file on this machine');
  const cp = await commitAll(ws, 'before write_file: test');
  assert.equal(cp.ok, true, 'commit failed: ' + cp.error);
  assert.ok(cp.sha, 'no sha');
  assert.match(gitLog(ws), /good\.js/, 'good.js was not committed');
  assert.ok((cp.skipped || []).some((f) => f.startsWith('sum')), 'the skipped file is not reported: ' + JSON.stringify(cp.skipped));
});

await test('a STALE index.lock is cleared and the commit goes through', async () => {
  const ws = join(mkdtempSync(join(tmpdir(), 'cpres-')), 'w');
  await ensureRepo(ws);
  writeFileSync(join(ws, 'a.js'), 'module.exports = 2;\n');
  const lock = join(ws, '.git', 'index.lock');
  writeFileSync(lock, '');
  const old = (Date.now() - 5 * 60_000) / 1000; utimesSync(lock, old, old);
  const cp = await commitAll(ws, 'before write_file: stale');
  assert.equal(cp.ok, true, 'commit failed: ' + cp.error);
  assert.equal(cp.clearedLock, true, 'the stale lock was not reported as cleared');
  assert.match(gitLog(ws), /a\.js/);
});

await test('a FRESH index.lock (git busy) is left alone and the failure is reported', async () => {
  const ws = join(mkdtempSync(join(tmpdir(), 'cpres-')), 'w');
  await ensureRepo(ws);
  writeFileSync(join(ws, 'b.js'), 'module.exports = 3;\n');
  const lock = join(ws, '.git', 'index.lock');
  writeFileSync(lock, '');
  const cp = await commitAll(ws, 'before write_file: fresh');
  assert.equal(cp.ok, false, 'committed through a fresh lock');
  assert.ok(existsSync(lock), 'a fresh lock was removed');
  assert.match(String(cp.error), /index\.lock/);
});

// ── loop rig: a scripted mock and an isolated hub ───────────────────────────────────
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}javascript\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: written';
async function rig(extraEnv, prepare) {
  const [mockPort, hubPort] = await freePorts(2);
  const r = { script: [], log: [] };
  r.mock = createServer((req, res) => {
    if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'cp', lora: null, models: [] })); }
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
      const text = m.length === 2 ? 'Plan: write the files, then finish.' : (r.script.length ? r.script.shift() : FINISH);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'cp', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((ok) => r.mock.listen(mockPort, '127.0.0.1', ok));
  r.dir = mkdtempSync(join(tmpdir(), 'cpres-hub-'));
  r.ws = join(r.dir, 'workspace'); mkdirSync(r.ws, { recursive: true });
  if (prepare) await prepare(r.ws);
  writeFileSync(join(r.dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'cp' } }, history: [], settings: {} }), 'utf8');
  r.hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(hubPort), HUB_DB: join(r.dir, 'hub.json'), AGENT_WORKSPACE: r.ws, AGENT_QUEUE_FILE: join(r.dir, 'queue.json'),
      AGENT_RUNS_DIR: join(r.dir, 'runs'), AGENT_TRACES_DIR: join(r.dir, 'traces'), RUN_INDEX: join(r.dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
      AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  r.hub.stdout.on('data', (d) => r.log.push(String(d))); r.hub.stderr.on('data', (d) => r.log.push(String(d)));
  const API = `http://127.0.0.1:${hubPort}/api`;
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  if (!up) throw new Error('hub did not start: ' + r.log.join('').slice(-400));
  r.api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  r.run = async (goal, script) => {
    r.script = [...script];
    const st = await r.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
    let run = null; const deadline = Date.now() + 3 * 60000;
    while (Date.now() < deadline) { run = await r.api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
    return run;
  };
  r.stop = () => { r.hub.kill(); r.mock.close(); };
  return r;
}

// A lock kept FRESH for the whole run: git really is "busy", so every checkpoint fails.
let keepFresh = null;
const locked = await rig({}, async (ws) => {
  await ensureRepo(ws);
  const lock = join(ws, '.git', 'index.lock');
  writeFileSync(lock, '');
  keepFresh = setInterval(() => { try { const t = Date.now() / 1000; utimesSync(lock, t, t); } catch { /* gone */ } }, 2000);
});
const lr = await locked.run('Create a1.js, a2.js and a3.js.', [write('a1.js', 'module.exports = 1;'), write('a2.js', 'module.exports = 2;'), write('a3.js', 'module.exports = 3;'), FINISH]);
clearInterval(keepFresh);
await test('a failing checkpoint puts ONE visible note in the run', () => {
  const notes = (lr?.steps || []).filter((s) => s.type === 'note' && /checkpoint FAILED/.test(String(s.text)));
  assert.equal(notes.length, 1, `expected exactly one checkpoint FAILED note, got ${notes.length}`);
  assert.match(String(notes[0].text), /index\.lock/);
});
locked.stop();

const many = await rig({ AGENT_MAX_RUNS: '2' });
for (const k of [1, 2, 3]) await many.run(`Create m${k}.js.`, [write(`m${k}.js`, `module.exports = ${k};`), FINISH]);
await test('with AGENT_MAX_RUNS=2, all three run files stay on disk', () => {
  const files = readdirSync(join(many.dir, 'runs')).filter((f) => f.endsWith('.json') && !f.endsWith('.transcript.jsonl'));
  assert.equal(files.length, 3, 'run files on disk: ' + files.length);
});
many.stop();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
