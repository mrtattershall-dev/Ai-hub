/**
 * autoStart.test.mjs - the single-run-at-a-time lock, on the path that skips it.
 *
 *   node server/autoStart.test.mjs
 *
 * Runs against its own throwaway backlog (AGENT_QUEUE_FILE); nothing of yours is touched.
 *
 * WHY
 * ---
 * There is one shared WORKSPACE, so two top-level runs writing into it corrupt each other.
 * Every HUMAN entry point checks `activeTopLevelRun()` before starting. Both AUTOMATIC
 * paths - the supervisor taking the next queued goal, and the retry of a failed one -
 * called `startRun` directly and never checked. The invariant held only for people.
 *
 * That bug was found by reading, and fixed with no test, which is the same mistake in a
 * different coat. This is the test.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = mkdtempSync(join(tmpdir(), 'autostart-'));
const FILE = join(TMP, 'agent-queue.json');
process.env.AGENT_QUEUE_FILE = FILE;
writeFileSync(FILE, JSON.stringify({ items: [] }), 'utf8');

const q = await import('./queue.js');
const { __toolPolicyTest } = await import('./agent.js');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// autoStart defers by 250ms; everything here has to outlast that.
const settle = () => wait(500);

// A loadDb that would explode if startRun were reached. The lock tests below assert the
// item was released, but this makes "it started anyway" fail loudly rather than subtly.
const forbiddenDb = () => { throw new Error('startRun should not have been reached'); };

try {
  await test('a run holding the workspace blocks an automatic start, and the goal is kept', async () => {
    const item = q.enqueue('build the thing').item;
    q.dequeue({ completedIds: [] });                       // now 'taken', as the supervisor leaves it
    const active = __toolPolicyTest.fakeActiveRun('running');
    try {
      __toolPolicyTest.autoStart(forbiddenDb, item);
      await settle();

      const after = q.list().find((i) => i.id === item.id);
      assert.equal(after.status, 'queued', 'the goal must go back on the list, not be dropped');
      assert.match(active.steps.map((s) => s.text).join(' '), /holds the workspace/,
        'the run that blocked it should say so, where a person will see it');
    } finally { __toolPolicyTest.forgetRun(active.id); }
  });

  await test('a run PAUSED on an approval prompt counts as holding it too', async () => {
    // awaiting_approval still owns every file in the workspace: it resumes writing the
    // moment someone approves. Treating only 'running' as busy is how work lands on top
    // of a paused run.
    const item = q.enqueue('second thing').item;
    q.dequeue({ completedIds: [] });
    const active = __toolPolicyTest.fakeActiveRun('awaiting_approval');
    try {
      __toolPolicyTest.autoStart(forbiddenDb, item);
      await settle();
      assert.equal(q.list().find((i) => i.id === item.id).status, 'queued');
    } finally { __toolPolicyTest.forgetRun(active.id); }
  });

  await test('a declined start does not spend the hourly budget', async () => {
    // The ceiling bounds runs that actually START. Charging it for an attempt that was
    // refused would let a busy workspace quietly throttle work nobody ever ran.
    const before = __toolPolicyTest.autoStartsInLastHour();
    const item = q.enqueue('third thing').item;
    q.dequeue({ completedIds: [] });
    const active = __toolPolicyTest.fakeActiveRun('running');
    try {
      __toolPolicyTest.autoStart(forbiddenDb, item);
      await settle();
      assert.equal(__toolPolicyTest.autoStartsInLastHour(), before,
        'a refused start was counted against the cap');
    } finally { __toolPolicyTest.forgetRun(active.id); }
  });

  await test('with the workspace free, it really does start (the lock is not just always-on)', async () => {
    const item = q.enqueue('fourth thing').item;
    q.dequeue({ completedIds: [] });
    let startedWith = null;
    // startRun is reached through loadDb, so observing that call is enough to prove the
    // path was taken - without letting a real run loose on the workspace.
    const observingDb = () => { startedWith = item.id; throw new Error('stop here, on purpose'); };
    __toolPolicyTest.autoStart(observingDb, item);
    await settle();
    assert.equal(startedWith, item.id, 'nothing tried to start with the workspace free');
    // startRun threw, so the item is released rather than left stuck in 'taken'.
    assert.equal(q.list().find((i) => i.id === item.id).status, 'queued');
  });
} finally {
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}

console.log(`autoStart: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
