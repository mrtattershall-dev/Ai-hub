/**
 * runLifecycle.test.mjs - a run is not idle until its teardown has finished.
 *
 *   node server/runLifecycle.test.mjs
 *
 * THE BUG. A run's terminal status is set inside the loop, and only THEN does drive()'s
 * `finally` tear down: roll back files that do not parse (a syntax check and a git-history
 * walk per file), write the trace and run index, persist the run. `busy` was cleared on the
 * FIRST line of that finally, so a client polling GET /agent/:id saw 'done' and could POST
 * /agent/start while the previous run was still restoring files in the same workspace.
 * Found by the fuzzer: the 4th start of an iteration came back as Express's HTML error page,
 * and the 3rd run's file on disk still said 'running'.
 *
 * WHAT THREW. startRun lists the workspace synchronously (tools.list_dir: readdir, then stat
 * each entry). The rollback syntax-checks .py files with `python -m py_compile`, which writes
 * __pycache__/x.pyc through a temp file renamed into place; a listing that sees the temp name
 * and stats it after the rename gets ENOENT, thrown inside the route. That is a genuine race
 * and this test does NOT depend on winning it (a .py file is included when python exists, so
 * the path is exercised, but nothing asserts that it fires).
 *
 * WHAT THIS TEST DEPENDS ON is the teardown window itself, and that is deterministic. The
 * workspace is seeded with files that end the run unparseable, each with several broken
 * versions in git history above the last good one, so the rollback has seconds of real work
 * to do. /start is fired the instant the run turns terminal - deep inside that window.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createServer } from 'node:http';
import { scratch, startHub, freePorts } from './testHarness.mjs';

const FINISHED = ['done', 'error', 'stopped'];   // the statuses whose teardown runs the rollback
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 700)}`); }
};

let HAS_PY = false;
try { execFileSync('python', ['--version'], { stdio: 'pipe', timeout: 20_000 }); HAS_PY = true; } catch {}

// ── a workspace whose rollback takes real time ───────────────────────────────
const JS_FILES = 4, BROKEN_VERSIONS = 6;
const goodJs = (i) => `function f${i}(a, b) {\n  return a + b;\n}\nmodule.exports = { f${i} };\n`;
const brokenJs = (i, v) => `function f${i}(a, b) {\n  return a + b; // edit ${v}\n}\n};\nmodule.exports = { f${i} };\n`;
const goodPy = 'def f(a, b):\n    return a + b\n';
const brokenPy = (v) => `def f(a, b:\n    return a + b  # edit ${v}\n`;

function seedWorkspace(ws) {
  mkdirSync(ws, { recursive: true });
  const git = (...args) => execFileSync('git',
    ['-C', ws, '-c', 'user.name=lifecycle-test', '-c', 'user.email=test@localhost', '-c', 'core.autocrlf=false', ...args],
    { stdio: 'pipe', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(ws) } });
  const files = [];
  for (let i = 0; i < JS_FILES; i++) files.push({ name: `lc_${i}.js`, good: goodJs(i), broken: (v) => brokenJs(i, v) });
  if (HAS_PY) files.push({ name: 'lc_py.py', good: goodPy, broken: brokenPy });

  git('init', '-q');
  for (const f of files) writeFileSync(join(ws, f.name), f.good, 'utf8');
  git('add', '-A'); git('commit', '-q', '-m', 'the last version that parses');
  for (let v = 1; v <= BROKEN_VERSIONS; v++) {
    for (const f of files) writeFileSync(join(ws, f.name), f.broken(v), 'utf8');
    git('add', '-A'); git('commit', '-q', '-m', `broken edit ${v}`);
  }
  // End on a version that is broken AND differs from every committed one, so the rollback
  // tries each broken version in turn before it reaches the one that parses.
  for (const f of files) writeFileSync(join(ws, f.name), f.broken('final'), 'utf8');
  return files.map((f) => f.name);
}

// ── a mock model that just finishes ──────────────────────────────────────────
// The run's work is not the point; its END is. Every reply is distinct, so the repetition
// guard never fires; the planner gets prose with no list in it, so no task ledger is seeded.
function startMock(port) {
  let calls = 0;
  const srv = createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'lifecycle', lora: null }));
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let sys = '';
      try { sys = String(JSON.parse(body).messages?.[0]?.content || ''); } catch {}
      calls++;
      const text = /^You are a senior (software engineer|game architect)/.test(sys)
        ? 'Nothing to build: the files already exist, so the only step is to finish.'
        : `THOUGHT: the files are already in place (reply ${calls}).\nACTION: finish\nSUMMARY: nothing further to change (reply ${calls}).`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'lifecycle', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}

async function isolatedHub(prefix, { supervisor }) {
  const [mockPort, hubPort] = await freePorts(2);
  const mock = await startMock(mockPort);
  const dir = scratch(prefix, { baseUrl: `http://127.0.0.1:${mockPort}`, model: 'lifecycle' });
  const seeded = seedWorkspace(join(dir, 'workspace'));
  const h = await startHub(dir, {
    port: hubPort,
    env: {
      AGENT_SUPERVISOR: supervisor ? '1' : '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      // The periodic tick would eventually start queued work by itself and hide a stalled
      // hand-off, so it is pushed out of reach: only the end-of-run hand-off can start work.
      AGENT_TICK_S: '3600',
      AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '5',
      MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
    },
  });
  // Read every reply as TEXT: the bug arrives as an HTML page, and .json() would discard it.
  const call = async (path, opts = {}) => {
    const r = await fetch(h.base + path, { headers: { 'Content-Type': 'application/json' }, ...opts, signal: AbortSignal.timeout(60_000) });
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch {}
    return { status: r.status, type: r.headers.get('content-type') || '', text, body };
  };
  const post = (path, obj) => call(path, { method: 'POST', body: JSON.stringify(obj) });
  const view = async (id) => (await call('/agent/' + id)).body;
  const onDisk = (id) => { try { return JSON.parse(readFileSync(join(dir, 'runs', `${id}.json`), 'utf8')).status; } catch { return null; } };
  const stop = () => { try { h.hub.kill(); } catch {} mock.close(); };
  return { ...h, call, post, view, onDisk, stop, seeded, dir };
}

const restoreNotes = (run) => (run?.steps || []).filter((s) => s.type === 'note' && /did not parse at the end of the run/.test(s.text || ''));
const lastStepTs = (run) => Math.max(0, ...(run?.steps || []).map((s) => s.ts || 0));
const brief = (t) => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

async function waitFinished(hub, id, { idle = true, ms = 4 * 60_000, every = 150 } = {}) {
  const deadline = Date.now() + ms;
  let v = null;
  while (Date.now() < deadline) {
    v = await hub.view(id).catch(() => null);
    if (v && FINISHED.includes(v.status) && (!idle || v.busy !== true)) return v;
    await sleep(every);
  }
  return v;
}

console.log('\nrun lifecycle: a run is idle only once its teardown is done\n');
if (!HAS_PY) console.log('  (python not found: the .py rollback is skipped; the .js files still make the window)\n');

// ═════ 1. /start fired the instant the previous run turns terminal ═════════════
const A = await isolatedHub('lifecycle', { supervisor: false });
const race = { starts: [], bad: [], sawTerminalBusy: false, admitted: null, onDiskAtAdmit: null, onDiskAtTerminal: null, firstStartAt: 0 };
let run1 = null, v1 = null, v2 = null, final1 = null;

await test('the hub starts against a mock model', async () => {
  const s = await A.post('/agent/start', { goal: 'Leave the existing lc modules as they are and finish.' });
  assert.ok(s.body?.runId, 'first start failed: ' + s.text.slice(0, 200));
  run1 = s.body.runId;
});

if (run1) {
  // Poll as tightly as a real client could, then fire the moment the status is terminal.
  const deadline = Date.now() + 4 * 60_000;
  let v = null;
  while (Date.now() < deadline) {
    v = await A.view(run1).catch(() => null);
    if (v && FINISHED.includes(v.status)) break;
    await sleep(10);
  }
  race.onDiskAtTerminal = A.onDisk(run1);
  race.firstStartAt = Date.now();
  const raceDeadline = Date.now() + 2 * 60_000;
  while (Date.now() < raceDeadline) {
    const r = await A.post('/agent/start', { goal: 'Check the lc modules once more and finish.' });
    race.starts.push(r.status);
    if (r.status >= 500 || !r.body) race.bad.push(`HTTP ${r.status} (${r.type || 'no content-type'}): ${brief(r.text)}`);
    if (r.body?.runId) { race.admitted = { id: r.body.runId, at: Date.now() }; race.onDiskAtAdmit = A.onDisk(run1); break; }
    if (r.status === 409) {
      const pv = await A.view(run1).catch(() => null);
      if (pv && FINISHED.includes(pv.status) && pv.busy === true) race.sawTerminalBusy = true;
    }
    await sleep(20);
  }
  if (race.admitted) v2 = await waitFinished(A, race.admitted.id);
  for (let i = 0; i < 240; i++) { final1 = A.onDisk(run1); if (FINISHED.includes(final1)) break; await sleep(250); }
  v1 = await A.view(run1).catch(() => null);
  const count = (s) => race.starts.filter((x) => x === s).length;
  console.log(`        run 1 ended '${v1?.status}', restored ${restoreNotes(v1).length} file(s); ${race.starts.length} start attempt(s): ${count(409)} x 409, ${count(200)} x 200, ${race.bad.length} bad`);
}

await test('COVERAGE: /start was fired while the previous run was still tearing down', () => {
  assert.ok(v1, 'no view of run 1');
  const notes = restoreNotes(v1);
  // Counted across BOTH runs: without the fix, run 2's own rollback restores some of the
  // files run 1 was still working through, so run 1 alone can come up short.
  const restored = new Set([...notes, ...restoreNotes(v2)].map((s) => String(s.text).split(' did not parse')[0]));
  assert.ok(restored.size >= JS_FILES,
    `the rollback restored ${restored.size} file(s), expected at least ${JS_FILES} - with nothing to restore there is no teardown window and every check below is vacuous`);
  assert.ok(notes.length > 0, 'run 1 restored nothing itself');
  assert.ok(!FINISHED.includes(race.onDiskAtTerminal),
    `run 1's file already said '${race.onDiskAtTerminal}' when the API first reported it terminal - the teardown was over before the race began`);
  const lastRestore = Math.max(...notes.map((s) => s.ts));
  assert.ok(race.firstStartAt < lastRestore,
    `the first /start went out ${race.firstStartAt - lastRestore}ms AFTER the rollback's last restore - the race was never run`);
});

await test('/agent/start never answers with HTML or a 5xx while the previous run tears down', () => {
  assert.equal(race.bad.length, 0, `bad /start replies:\n        ${race.bad.join('\n        ')}`);
});

await test('two runs never execute at once: the next run was admitted only after the teardown finished', () => {
  assert.ok(race.admitted, `no /start was ever accepted (statuses: ${race.starts.slice(-5).join(', ')})`);
  assert.ok(FINISHED.includes(race.onDiskAtAdmit),
    `run 2 was admitted while run 1's file on disk still said '${race.onDiskAtAdmit}' - its teardown was still running in the same workspace`);
  assert.ok(v2 && v2.createdAt >= lastStepTs(v1),
    `run 2 was created ${lastStepTs(v1) - (v2?.createdAt || 0)}ms before run 1's teardown pushed its last step`);
  // Run 1 leaves every seeded file parsing, so run 2 has nothing to roll back - unless the
  // two rollbacks were walking the same files at the same time.
  const both = restoreNotes(v2).map((s) => String(s.text).split(' did not parse')[0]);
  assert.equal(both.length, 0, `run 2 rolled back ${both.join(', ')} while run 1 was still rolling back the same workspace`);
});

await test('GET /agent/:id says busy through the teardown and idle after it', () => {
  assert.ok(race.sawTerminalBusy, 'never saw run 1 reported as terminal AND busy while /start was refused');
  assert.equal(v1?.busy, false, `run 1 should report busy:false once idle (got ${JSON.stringify(v1?.busy)})`);
});

await test("the previous run's persisted JSON reaches its terminal status", () => {
  assert.ok(FINISHED.includes(final1), `runs/${run1}.json still says '${final1}'`);
  assert.equal(final1, v1?.status, 'the file on disk disagrees with the API');
});

await test('the hub is still alive afterwards', () => {
  assert.equal(A.died(), null, 'the hub died:\n' + A.log.join('').slice(-600));
});
A.stop();

// ═════ 2. the supervisor's hand-off must not block on its own run ═════════════
// With the supervisor on, a run that finishes 'done' dequeues the next goal from inside its
// own teardown. If that hand-off saw its own run as still busy it would put the goal back
// and wait for a tick that is an hour away. The tick is out of reach here on purpose, so
// the queued goal can only start through that hand-off.
const B = await isolatedHub('lifecycle-sup', { supervisor: true });
const QUEUED = 'Queued follow-up: look over the lc modules and finish.';
let sa = null, sq = null;

await test('supervisor: the finished run hands the workspace to the next queued goal', async () => {
  const s = await B.post('/agent/start', { goal: 'Leave the lc modules alone and finish (supervised).' });
  assert.ok(s.body?.runId, 'start failed: ' + s.text.slice(0, 200));
  const q = await B.post('/agent/queue', { goal: QUEUED });
  assert.ok(q.body?.ok || q.body?.item, 'queueing failed: ' + q.text.slice(0, 200));
  sa = await waitFinished(B, s.body.runId);
  // Judge the run once it has settled ON DISK too, not by the busy flag alone, so this
  // scenario means the same thing against a hub that does not report busy at all.
  for (let i = 0; i < 240 && !FINISHED.includes(B.onDisk(s.body.runId)); i++) await sleep(250);
  sa = await B.view(s.body.runId);
  assert.equal(sa?.status, 'done', `the first run ended '${sa?.status}' - the hand-off only happens after a clean finish, so this proves nothing`);
  assert.ok(restoreNotes(sa).length >= JS_FILES, 'the first run had no teardown work - vacuous');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !sq) {
    const list = (await B.call('/agent/list')).body || [];
    const hit = list.find((r) => r.goal === QUEUED);
    if (hit) sq = await B.view(hit.id);
    else await sleep(250);
  }
  assert.ok(sq, 'the queued goal was never started - the hand-off blocked on the finishing run');
  const refused = (sa.steps || []).filter((st) => /holds the workspace/.test(st.text || ''));
  assert.equal(refused.length, 0, `the hand-off refused itself: ${refused.map((st) => st.text).join(' | ')}`);
  assert.ok(sq.createdAt >= Math.max(...restoreNotes(sa).map((st) => st.ts)),
    "the queued run started before the finishing run's rollback was done");
});

await test('supervisor: the queued run finishes too, and the hub is still alive', async () => {
  assert.ok(sq, 'no queued run to wait for');
  const end = await waitFinished(B, sq.id);
  assert.ok(end && FINISHED.includes(end.status) && end.busy !== true, `queued run ended as ${end?.status} busy=${end?.busy}`);
  assert.equal(B.died(), null, 'the hub died:\n' + B.log.join('').slice(-600));
});
B.stop();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
