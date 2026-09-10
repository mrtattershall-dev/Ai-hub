/**
 * repairChain.test.mjs - what happens to a chain when one of its steps fails.
 *
 *   node server/repairChain.test.mjs
 *
 * Runs against its own throwaway backlog (AGENT_QUEUE_FILE), so it cannot touch yours -
 * not even if it dies hard, and not even if a hub is queueing at the same time.
 *
 * Worth pinning because the failure path has no UI and no logs anyone reads at 4am: the
 * only evidence it works is the queue's own shape afterwards.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Its own backlog, decided BEFORE queue.js is loaded - it reads the path once, at module
// load, so these imports have to be dynamic to sit after this line.
//
// This used to run against the real queue and restore it in a `finally`, which cannot
// protect a file a live hub is writing at the same time: on 2026-09-10 a test doing
// exactly that lost a goal a running hub had queued seconds earlier. A test should not be
// able to cost you work, however carefully it tidies up.
const TMP = mkdtempSync(join(tmpdir(), 'repairchain-'));
const FILE = join(TMP, 'agent-queue.json');
process.env.AGENT_QUEUE_FILE = FILE;

const q = await import('./queue.js');
const { repairGoalFor, __supervisorTest } = await import('./agent.js');

const snapshot = null;   // nothing of yours is touched, so there is nothing to restore

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const reset = () => writeFileSync(FILE, JSON.stringify({ items: [] }, null, 2), 'utf8');
const chain = (...goals) => {
  reset();
  let after = null;
  return goals.map((g) => {
    const r = q.enqueue(g, { after });
    after = r.item.id;
    return r.item;
  });
};

try {
  // ---- repairGoalFor ----------------------------------------------------------------
  test('a repair goal restates the original and warns the workspace is half-finished', () => {
    const goal = repairGoalFor({ id: 'a1', goal: 'Add paddles', repairOf: null }, { reason: 'budget', detail: 'out of steps' });
    assert.match(goal, /stopped part-way \(it ran out of budget\)/);
    assert.match(goal, /workspace\/ may be half-finished/);
    assert.match(goal, /Read what is already there before changing anything/);
    assert.match(goal, /Goal: Add paddles/);
    assert.match(goal, /It stopped with:\nout of steps/);
  });

  test('each failure reason gets its own plain-English cause', () => {
    const of = (reason) => repairGoalFor({ id: 'a', goal: 'g' }, { reason });
    assert.match(of('loop'), /repeated itself/);
    assert.match(of('parse'), /could not be parsed/);
    assert.match(of('same_error'), /same error kept coming back/);
    assert.match(of('tunnel'), /connection dropped/);
    assert.match(of('nonsense'), /it errored/);   // unknown reasons must still read as English
  });

  test('A REPAIR IS NEVER REPAIRED - this is what makes retrying terminate', () => {
    assert.equal(repairGoalFor({ id: 'a2', goal: 'g', repairOf: 'a1' }, { reason: 'error' }), null);
    assert.equal(repairGoalFor(null, {}), null);
  });

  test('a long error is trimmed, so one failure cannot fill the goal field', () => {
    const goal = repairGoalFor({ id: 'a', goal: 'g' }, { reason: 'error', detail: 'x'.repeat(5000) });
    assert.ok(goal.length < 1000, `repair goal was ${goal.length} chars`);
  });

  // ---- repoint ------------------------------------------------------------------------
  test('the tail of a chain follows the repair, keeping the plan order', () => {
    const [one, two, three] = chain('step one', 'step two', 'step three');
    q.dequeue({ completedIds: [] });                       // step one is taken
    q.complete(one.id, { status: 'error' });               // ...and fails
    const repair = q.enqueue('retry step one', { repairOf: one.id, priority: 1 }).item;

    const moved = q.repoint(one.id, repair.id);
    assert.deepEqual(moved, [two.id], 'only the direct dependent moves');

    const items = q.list();
    assert.equal(items.find((i) => i.id === two.id).after, repair.id);
    assert.equal(items.find((i) => i.id === three.id).after, two.id, 'the rest of the chain is untouched');
  });

  test('the repair runs before the tail, and the tail only after it is done', () => {
    const [one, two] = chain('step one', 'step two');
    q.dequeue({ completedIds: [] });
    q.complete(one.id, { status: 'error' });
    const repair = q.enqueue('retry step one', { repairOf: one.id, priority: 1 }).item;
    q.repoint(one.id, repair.id);

    const first = q.dequeue({ completedIds: q.list().filter(i => i.status === 'done').map(i => i.id) });
    assert.equal(first.id, repair.id, 'the retry outranks the waiting tail');

    // step two must NOT come out while the retry is still in flight
    assert.equal(q.dequeue({ completedIds: [] }), null);

    q.complete(repair.id, { status: 'done' });
    const next = q.dequeue({ completedIds: [repair.id] });
    assert.equal(next.id, two.id, 'once the retry is done the chain resumes');
  });

  test('a failed step with no repair leaves its tail unrunnable rather than running out of order', () => {
    const [one] = chain('step one', 'step two');
    q.dequeue({ completedIds: [] });
    q.complete(one.id, { status: 'error' });
    assert.equal(q.dequeue({ completedIds: [] }), null, 'step two must not run as if step one had succeeded');
  });

  test('repoint only moves queued items, never one already taken or finished', () => {
    const [one, two] = chain('step one', 'step two');
    q.complete(two.id, { status: 'done' });
    assert.deepEqual(q.repoint(one.id, 'zzzzzzzz'), [], 'a finished dependent is left alone');
  });

  // ---- the whole failure path, as the run's finally block calls it ---------------------
  const failed = (item, status = 'error') => {
    const run = { id: `run-${item.id}`, queueItemId: item.id, steps: [], status };
    __supervisorTest.failItem(run, status === 'error' ? 'loop' : status, 'Same response three times.');
    return run;
  };

  test('a failed step is recorded, retried once, and the tail moved behind the retry', () => {
    const [one, two] = chain('step one', 'step two');
    q.dequeue({ completedIds: [] });
    const run = failed(one);

    const items = q.list();
    const orig = items.find((i) => i.id === one.id);
    assert.equal(orig.status, 'error', 'the item must not be left in taken');
    assert.match(orig.summary, /^loop: Same response three times\./);

    const repair = items.find((i) => i.repairOf === one.id);
    assert.ok(repair, 'exactly one retry should have been queued');
    assert.equal(repair.source, 'repair');
    assert.equal(repair.generation, (one.generation || 0) + 1, 'the retry counts as a hop, so the generation cap bounds it');
    assert.ok(repair.priority > one.priority, 'the retry must outrank the backlog it is blocking');
    assert.match(repair.goal, /Goal: step one/);

    assert.equal(items.find((i) => i.id === two.id).after, repair.id);
    assert.match(run.steps.map((s) => s.text).join(' '), /Retrying once as/);
  });

  test('a retry that itself fails ends the chain instead of retrying forever', () => {
    const [one] = chain('step one');
    q.dequeue({ completedIds: [] });
    failed(one);
    const repair = q.list().find((i) => i.repairOf === one.id);

    const run = failed(repair);
    assert.equal(q.list().find((i) => i.id === repair.id).status, 'error');
    assert.equal(q.list().filter((i) => i.repairOf).length, 1, 'there must be no repair of a repair');
    assert.match(run.steps.map((s) => s.text).join(' '), /the chain stops here and waits for you/);
  });

  test('a run a HUMAN stopped is recorded but never auto-retried', () => {
    const [one, two] = chain('step one', 'step two');
    q.dequeue({ completedIds: [] });
    const run = failed(one, 'stopped');

    const items = q.list();
    assert.equal(items.find((i) => i.id === one.id).status, 'stopped');
    assert.equal(items.filter((i) => i.repairOf).length, 0, 'cancelling something must not queue it again');
    assert.equal(items.find((i) => i.id === two.id).after, one.id, 'the tail stays put, blocked and visible');
    assert.match(run.steps.map((s) => s.text).join(' '), /you stopped this one/);
  });

  test('a dropped connection is recorded but not retried, since the run can be resumed', () => {
    const [one] = chain('step one');
    q.dequeue({ completedIds: [] });
    const run = failed(one, 'interrupted');
    assert.equal(q.list().find((i) => i.id === one.id).status, 'interrupted');
    assert.equal(q.list().filter((i) => i.repairOf).length, 0);
    assert.match(run.steps.map((s) => s.text).join(' '), /resume it rather than starting over/);
  });

  test('the run is never taken down by the queue: a bad item id is survivable', () => {
    reset();
    const run = { id: 'r', queueItemId: 'nosuchid', steps: [] };
    assert.doesNotThrow(() => __supervisorTest.failItem(run, 'error', 'x'));
  });

  test('repairOf is persisted, so the no-second-repair rule survives a restart', () => {
    reset();
    const item = q.enqueue('goal', { repairOf: 'abc12345' }).item;
    assert.equal(item.repairOf, 'abc12345');
    assert.equal(q.list().find((i) => i.id === item.id).repairOf, 'abc12345');
    assert.equal(q.enqueue('plain goal').item.repairOf, null, 'an ordinary goal is not a repair');
  });
} finally {
  // The whole temp directory goes, backlog and all. There is nothing to restore, because
  // nothing of yours was ever opened.
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`repair chain: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
