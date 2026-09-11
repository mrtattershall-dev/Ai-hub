/**
 * forcedFinish.test.mjs - a finish accepted after the gate gave up is marked UNVERIFIED.
 *
 *   node server/forcedFinish.test.mjs
 *
 * The finish gate is capped at 3 blocks so a run that can never satisfy it does not hang. The 4th finish used to
 * be recorded exactly like a clean one: Qwen3-Coder (set B goal 14) wrote a page whose script never existed,
 * test_web reported the 404 four times, and the run ended 'done' with nothing to say otherwise. Now the run keeps
 * status 'done' (harnesses and the UI key on it) but carries forcedFinish: true and a note saying so. A clean
 * finish carries neither.
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
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
const FENCE = '`'.repeat(3);
const write = (path, body, lang) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${FENCE}${lang}\n${body}\n${FENCE}`;
const finish = (s) => `THOUGHT: it is done.\nACTION: finish\nSUMMARY: ${s}`;

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [], k: 0 };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'forced', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let messages = []; try { messages = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = messages.length === 2 ? 'Plan: write it, then finish.' : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'forced', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'forcedfinish-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'forced' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '5', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(180000) })).json();

async function runGoal(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 200));
  let run = null; const deadline = Date.now() + 5 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(400); }
  const f = join(dir, 'runs', `${st.runId}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : run;
}

let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na forced finish is marked UNVERIFIED\n');
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-800)); hub.kill(); mock.close(); process.exit(1); }

const PAGE = '<!doctype html>\n<html><body>\n<canvas id="c" width="200" height="100"></canvas>\n<script src="missing_game.js"></script>\n</body></html>';
const forced = await runGoal('Create game.html: a canvas game. Put the logic in missing_game.js.', [write('game.html', PAGE, 'html'), finish('one'), finish('two'), finish('three'), finish('four'), finish('five')]);
await test('a finish the gate never accepted ends done, but forcedFinish is set', () => {
  assert.equal(forced.status, 'done', 'status ' + forced.status);
  assert.ok((forced.finishBlocks || 0) >= 3, `the gate blocked only ${forced.finishBlocks} times - the scenario did not reach the cap`);
  assert.equal(forced.forcedFinish, true, 'forcedFinish not set');
});
await test('the run says so in its steps', () => {
  assert.ok((forced.steps || []).some((s) => s.type === 'note' && /Finished UNVERIFIED/.test(String(s.text))), 'no UNVERIFIED note');
});
const clean = await runGoal('Create ok.js exporting one().', [write('ok.js', 'module.exports = { one: () => 1 };', 'javascript'), finish('ok.js written')]);
await test('a clean finish carries neither', () => {
  assert.equal(clean.status, 'done', 'status ' + clean.status);
  assert.ok(!clean.forcedFinish, 'a clean finish was marked forced');
  assert.ok(!(clean.steps || []).some((s) => /Finished UNVERIFIED/.test(String(s.text || ''))), 'a clean finish got the UNVERIFIED note');
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
