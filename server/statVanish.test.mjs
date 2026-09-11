/**
 * statVanish.test.mjs - a file that disappears mid-walk must not take anything down.
 *
 *   node server/statVanish.test.mjs
 *
 * Fuzz seed 39: /agent/start answered 500. startRun builds its opening message with
 * list_dir, list_dir stat'ed every entry readdirSync returned, and python's py_compile had
 * just renamed a __pycache__ temp file away between the two calls - ENOENT, thrown out of
 * the route. The same unguarded readdir-then-stat sat in search_file, GET /files and the
 * run reaper.
 *
 * A real race cannot be timed in a test. A DANGLING JUNCTION is the same condition,
 * deterministically: readdirSync lists it, statSync throws ENOENT. (Junctions need no
 * admin rights on Windows, unlike symlinks.)
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TMP = mkdtempSync(join(tmpdir(), 'statvanish-'));
process.env.AGENT_WORKSPACE = join(TMP, 'workspace');
process.env.AGENT_QUEUE_FILE = join(TMP, 'queue.json');
process.env.AGENT_RUNS_DIR = join(TMP, 'runs');
process.env.RUN_INDEX = join(TMP, 'run-index.jsonl');
process.env.AGENT_TRACES_DIR = join(TMP, 'traces');
delete process.env.AGENT_SUPERVISOR;
mkdirSync(process.env.AGENT_WORKSPACE, { recursive: true });
writeFileSync(process.env.AGENT_QUEUE_FILE, JSON.stringify({ items: [] }), 'utf8');

const { default: express } = await import('express');
const agent = await import('./agent.js');
const { freePort } = await import('./testPort.mjs');
const T = agent.__toolPolicyTest;
const WS = agent.WORKSPACE;
if (!resolve(WS).startsWith(resolve(TMP))) { console.error(`FATAL: workspace ${WS} is not under ${TMP}`); process.exit(1); }

// An entry readdirSync will list and statSync will refuse: the race, frozen.
const vanish = (name) => {
  const target = join(TMP, `target-${name}`);
  mkdirSync(target);
  symlinkSync(target, join(WS, name), 'junction');
  rmSync(target, { recursive: true });
};
writeFileSync(join(WS, 'zzz.js'), 'const needle = 1;\nmodule.exports = { needle };\n');
vanish('aaa_gone');                       // sorts BEFORE the real file, so a walk meets it first

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\na file that vanishes mid-walk\n');

await test('list_dir lists what is there and skips what is not', async () => {
  const r = await T.callTool('list_dir', { path: '.' });
  assert.doesNotMatch(String(r), /^ERROR/, 'list_dir failed: ' + String(r).slice(0, 120));
  assert.match(String(r), /zzz\.js/);
  assert.doesNotMatch(String(r), /aaa_gone/, 'listed an entry that no longer exists');
});

await test('search_file still searches the rest of the workspace', async () => {
  const r = String(await T.callTool('search_file', { query: 'needle' }));
  assert.match(r, /zzz\.js:1:/, 'a vanished entry emptied the whole search: ' + r.slice(0, 120));
});

const app = express();
app.use(express.json());
app.use('/api/agent', agent.default({ loadDb: () => ({ settings: {}, api_keys: {} }), saveDb: () => {}, withDb: (f) => f() }));
const port = await freePort();
const server = app.listen(port, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const api = (p, o = {}) => fetch(`http://127.0.0.1:${port}/api/agent${p}`, { headers: { 'Content-Type': 'application/json' }, ...o });

await test('GET /files answers 200 and lists the real file', async () => {
  const r = await api('/files');
  assert.equal(r.status, 200, `GET /files answered ${r.status}`);
  const files = await r.json();
  assert.ok(files.some((f) => f.path === 'zzz.js'), 'zzz.js missing from ' + JSON.stringify(files));
});

let runId = null;
await test('POST /agent/start is admitted, not a 500 (fuzz seed 39)', async () => {
  const r = await api('/start', { method: 'POST', body: JSON.stringify({ goal: 'Say hello in hello.js' }) });
  const body = await r.json().catch(() => ({}));
  assert.equal(r.status, 200, `start answered ${r.status}: ${JSON.stringify(body).slice(0, 160)}`);
  assert.ok(body.runId, 'no runId');
  runId = body.runId;
});

// Stop the run (there is no model behind it) and let its teardown finish before leaving.
if (runId) {
  await api(`/${runId}/stop`, { method: 'POST' }).catch(() => {});
  for (let i = 0; i < 100; i++) {
    const r = await api(`/${runId}`).then((x) => x.json()).catch(() => null);
    if (r && !['running', 'awaiting_approval'].includes(r.status) && !r.busy) break;
    await new Promise((ok) => setTimeout(ok, 300));
  }
}
server.close();
try { rmSync(join(WS, 'aaa_gone'), { force: true }); } catch {}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
