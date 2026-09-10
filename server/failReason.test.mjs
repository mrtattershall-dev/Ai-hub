/**
 * failReason.test.mjs - which failures earn an automatic retry, and which must not.
 *
 *   node server/failReason.test.mjs
 *
 * Runs against its own queue file (AGENT_QUEUE_FILE), so it cannot touch yours.
 *
 * THE BUG THIS PINS. A person pressing Stop and the stuck-loop guard tripping both leave
 * the run in status 'stopped'. `failQueueItem` decided retries from `status` alone, so it
 * treated a model that got stuck as a human cancellation: no repair, the rest of the chain
 * stranded on an id that could never reach 'done', and a note reading "you stopped this
 * one" when nobody had. Observed on a real unattended run, 2026-09-10 — the chain died on
 * its first goal and looked, from the outside, exactly like an idle queue.
 *
 * `reason` is what tells them apart. It was already computed a frame up (the escalation
 * writes it to ESCALATIONS.md — that file correctly said "loop") and already passed into
 * failQueueItem, which returned before ever reading it.
 *
 * The asymmetry is the whole point, so both directions are tested: a guard must retry, a
 * human must never be second-guessed.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'failreason-'));
process.env.AGENT_QUEUE_FILE = join(dir, 'agent-queue.json');
writeFileSync(process.env.AGENT_QUEUE_FILE, JSON.stringify({ items: [] }, null, 2), 'utf8');

const q = await import('./queue.js');
const { __supervisorTest } = await import('./agent.js');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const reset = () => writeFileSync(process.env.AGENT_QUEUE_FILE, JSON.stringify({ items: [] }, null, 2), 'utf8');

/** Queue a two-step chain and fail the first with (status, reason). */
function failFirst(status, reason) {
  reset();
  const one = q.enqueue('step one', { force: true }).item;
  const two = q.enqueue('step two', { after: one.id, force: true }).item;
  q.dequeue({ completedIds: [] });
  const run = { id: `run-${one.id}`, queueItemId: one.id, steps: [], status };
  __supervisorTest.failItem(run, reason, 'the detail');
  const items = q.list();
  return {
    run,
    one: items.find((i) => i.id === one.id),
    two: items.find((i) => i.id === two.id),
    repair: items.find((i) => i.repairOf === one.id),
    notes: run.steps.map((s) => s.text).join(' | '),
  };
}

try {
  // ---- the bug: a guard tripping is a MODEL failure, not a human one -----------------

  test('the stuck-loop guard earns a retry even though the run reads as "stopped"', () => {
    const r = failFirst('stopped', 'loop');
    assert.ok(r.repair, 'a repair must be spliced in — this is the case that stranded a real chain');
    assert.match(r.repair.goal, /repeated itself and got stuck/);
    assert.equal(r.two.after, r.repair.id, 'and the tail must follow the retry, not the dead id');
    assert.ok(!/you stopped this one/.test(r.notes), 'and it must not blame the operator');
  });

  test('budget, parse and same_error are machine failures too', () => {
    for (const reason of ['budget', 'parse', 'same_error']) {
      const r = failFirst('stopped', reason);
      assert.ok(r.repair, `${reason} should retry`);
      assert.equal(r.two.after, r.repair.id, `${reason} should repoint the tail`);
    }
  });

  // ---- the other direction: a human is never second-guessed -------------------------

  test('a human pressing Stop is NEVER retried', () => {
    // A human Stop leaves no guard-shaped error text, so the reason falls through to
    // 'error' while the status stays 'stopped'. That pair must stay non-retryable.
    const r = failFirst('stopped', 'error');
    assert.ok(!r.repair, 'cancelling something must not re-queue it at 4am');
    assert.match(r.notes, /you stopped this one/);
    assert.equal(r.one.status, 'stopped', 'and the item is still recorded, not left in taken');
  });

  test('a dropped connection is not retried either — those runs are resumable', () => {
    const r = failFirst('interrupted', 'tunnel');
    assert.ok(!r.repair, 'retrying from scratch would throw away history the run still has');
    assert.match(r.notes, /resume it rather than starting over/);
  });

  // ---- unchanged behaviour --------------------------------------------------------

  test('an ordinary error still retries exactly as before', () => {
    const r = failFirst('error', 'error');
    assert.ok(r.repair);
    assert.equal(r.repair.source, 'repair');
    assert.ok(r.repair.priority > r.one.priority, 'the retry outranks the backlog it blocks');
    assert.equal(r.repair.generation, (r.one.generation || 0) + 1, 'a retry is a hop, so the generation cap bounds it');
  });

  test('TERMINATION HOLDS: a repair that loops is not itself repaired', () => {
    // Without this, the new retry path would be an infinite one: loop -> repair -> loop.
    reset();
    const one = q.enqueue('original', { force: true }).item;
    const repair = q.enqueue('retry of original', { repairOf: one.id, force: true }).item;
    q.dequeue({ completedIds: [] });
    const run = { id: 'r', queueItemId: repair.id, steps: [], status: 'stopped' };
    __supervisorTest.failItem(run, 'loop', 'stuck again');
    assert.equal(q.list().filter((i) => i.repairOf === repair.id).length, 0, 'no repair of a repair');
    assert.match(run.steps.map((s) => s.text).join(' '), /already the retry of/);
  });

  test('an unknown queue item does not throw', () => {
    const run = { id: 'r', queueItemId: 'nosuchid', steps: [], status: 'stopped' };
    assert.doesNotThrow(() => __supervisorTest.failItem(run, 'loop', 'x'));
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`failReason: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
