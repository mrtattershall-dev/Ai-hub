/**
 * resetGuard.test.mjs - POST /agent/reset must never delete a workspace something is using.
 *
 *   node server/resetGuard.test.mjs
 *
 * Reset deletes EVERY file in the workspace. It used to do that without checking anything,
 * relying on the client to grey out "New project" - which left three holes, each pinned
 * below: a run still tearing down (status already 'done', rollback still rewriting files), a
 * run in any state reached by a second tab or a plain API call, and the 250ms gap between
 * two steps of a supervisor chain, where nothing is technically running at all.
 *
 * In-process on purpose: the router is mounted on a local express app, so the fake runs this
 * inserts are visible to the very guard being tested, and no model or GPU is involved.
 *
 * THIS TEST DELETES A WORKSPACE, so the first thing it does is prove the workspace is a
 * scratch directory. If the AGENT_WORKSPACE override were ever ignored, it would otherwise
 * be deleting yours.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = mkdtempSync(join(tmpdir(), 'resetguard-'));
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
const q = await import('./queue.js');
const { freePort } = await import('./testPort.mjs');
const T = agent.__toolPolicyTest;
const WORKSPACE = agent.WORKSPACE;

// Hard stop BEFORE any reset is ever sent.
if (!resolve(WORKSPACE).startsWith(resolve(TMP))) {
  console.error(`FATAL: WORKSPACE is ${WORKSPACE}, not the scratch dir ${TMP}. Refusing to run a test that deletes it.`);
  process.exit(1);
}

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const app = express();
app.use(express.json());
app.use('/api/agent', agent.default({ loadDb: () => ({ settings: {} }), saveDb: () => {}, withDb: (f) => f() }));
const port = await freePort();
const server = app.listen(port, '127.0.0.1');
await new Promise((r) => server.once('listening', r));

const reset = async () => {
  const r = await fetch(`http://127.0.0.1:${port}/api/agent/reset`, { method: 'POST' });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const FILE = join(WORKSPACE, 'index.html');
const seed = () => writeFileSync(FILE, '<h1>work in progress</h1>', 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Guarded case: a run in `status` (optionally still busy) must make reset refuse and keep files.
async function refusedWhile(status, { busy = false } = {}) {
  seed();
  const run = T.fakeActiveRun(status);
  run.busy = busy;
  try {
    const r = await reset();
    assert.equal(r.status, 409, `reset returned ${r.status} while a run was '${status}'${busy ? ' and busy' : ''}`);
    assert.ok(existsSync(FILE), 'reset refused but the file is gone anyway');
    return r;
  } finally { T.forgetRun(run.id); }
}

try {
  await test('HOLE 2 - a RUNNING run: reset refuses and the files survive', async () => {
    const r = await refusedWhile('running');
    assert.match(r.body.error, /stop it first/, 'the refusal should say what to do about it');
  });

  await test('a run PAUSED on an approval prompt still owns the workspace', async () => {
    // It resumes writing the instant someone approves, so it is as live as a running one.
    await refusedWhile('awaiting_approval');
  });

  await test('HOLE 1 - a run TEARING DOWN (status done, still busy): reset refuses', async () => {
    // The case the client could not cover: the status already says 'done', so "New project"
    // was enabled, while the syntax rollback was still rewriting files underneath it.
    const r = await refusedWhile('done', { busy: true });
    assert.match(r.body.error, /finishing up/, 'the message should name WHY a finished run still blocks');
  });

  await test('HOLE 3 - the gap between two chained steps: reset refuses', async () => {
    seed();
    const item = q.enqueue('step two of a chain').item;
    q.dequeue({ completedIds: [] });            // taken, exactly as the supervisor leaves it
    // A loadDb that throws: the scheduled start will fire and fail harmlessly inside the
    // run, which is fine - what is under test is the 250ms BEFORE it fires.
    T.autoStart(() => { throw new Error('not under test'); }, item);
    assert.ok(T.pendingAutoStarts() > 0, 'the scheduled start should be counted');
    const r = await reset();
    assert.equal(r.status, 409, 'reset landed in the gap between steps - the next step would start on an empty workspace');
    assert.match(r.body.error, /about to start/);
    assert.ok(existsSync(FILE), 'the step before this one lost its output');
  });

  await test('the gap counter drains to zero, so the guard cannot jam shut for ever', async () => {
    await wait(700);                               // the scheduled start fires, the run errors out
    assert.equal(T.pendingAutoStarts(), 0, 'a leaked count would make reset refuse permanently');
  });

  await test('with nothing active and nothing scheduled, reset still works', async () => {
    // The guard must not simply turn reset off - that would pass every check above.
    for (let i = 0; i < 20 && T.pendingAutoStarts() > 0; i++) await wait(100);
    seed();
    const r = await reset();
    assert.equal(r.status, 200, `an idle reset was refused: ${JSON.stringify(r.body)}`);
    assert.equal(readdirSync(WORKSPACE).length, 0, 'an idle reset should empty the workspace');
  });
} finally {
  server.close();
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows may still hold a handle */ }
}

console.log(`reset guard: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
process.exit(process.exitCode || 0);   // the supervisor tick keeps the loop alive otherwise
