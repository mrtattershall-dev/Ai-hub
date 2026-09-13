/**
 * planAdvisory.test.mjs - plan-seeded tasks must STAY advisory while the agent works through them.
 *
 *   node server/planAdvisory.test.mjs
 *
 * THE DEFECT, found 2026-09-12 by reading taskLedger.js cold and then proving it in a temp workspace.
 *
 * The plan-first gate seeds TASKS.md from the BUILD PLAN and marks the file with PLAN_MARK. The finish gate reads
 * that marker to decide whether those tasks BIND:
 *
 *     const advisory = ledger.isPlanSeeded(WORKSPACE);
 *     if (!advisory && p.total && p.remainingOwn > 0) { blocked(...); continue turn; }
 *
 * and the comment above it records why it has to be advisory: "a free model was handed 15 plan tasks and spent 10
 * steps closing them; three separate scripted tests ended `stopped` instead of `done` because the agent finished its
 * actual work and was blocked on entries it never chose."
 *
 * But write() is `function write(workspace, tasks, fromPlan = false)` and mark() calls `write(workspace, tasks)`
 * with the third argument omitted. So PLAN_MARK is erased from the file by task_done - and isPlanSeeded() is a
 * substring search, so it is gone for the life of the workspace. Measured in a temp workspace:
 *
 *     after seed()       isPlanSeeded = true    remainingOwn 3
 *     after mark(1,done) isPlanSeeded = FALSE   remainingOwn 2   -> the gate now BLOCKS
 *
 * The system prompt tells the agent to mark tasks done as it goes. Obeying it is what arms the gate against it, and
 * the run then burns its three finish blocks on tasks the planner proposed and it never chose.
 *
 * adopt() already shows the intended shape - it passes isPlanSeeded(workspace) through to write() precisely to keep
 * the marker across run starts. mark() is the one writer that does not.
 *
 * add() erasing the marker is CORRECT and is asserted below: its own contract is that the agent's list supersedes a
 * pristine plan, and it reads the marker before the write.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ledger = await import('./taskLedger.js');

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};
const fresh = () => mkdtempSync(join(tmpdir(), 'planadv-'));

/** The finish gate's own condition, copied verbatim from agent.js so the two cannot drift. */
const gateBlocks = (ws) => {
  const p = ledger.progress(ws);
  const advisory = ledger.isPlanSeeded(ws);
  return !advisory && !!p.total && p.remainingOwn > 0;
};

console.log('\nplan-seeded tasks stay advisory while the agent closes them\n');

test('the premise: a freshly seeded plan ledger is plan-seeded and does not block finishing', () => {
  const ws = fresh();
  ledger.seed(ws, ['build the module', 'verify it runs', 'write the docs']);
  assert.equal(ledger.isPlanSeeded(ws), true, 'seed() must mark the file as plan-derived');
  assert.equal(gateBlocks(ws), false, 'and plan tasks must not bind before anything has happened');
});

test('THE BUG: closing ONE plan task must not turn the rest into commitments', () => {
  const ws = fresh();
  ledger.seed(ws, ['build the module', 'verify it runs', 'write the docs']);
  ledger.mark(ws, 1, 'done');
  const p = ledger.progress(ws);
  assert.equal(p.done, 1, 'precondition: the task really was marked done');
  assert.ok(p.remainingOwn > 0, 'precondition: plan tasks remain open, so the gate has something to bind on');
  assert.equal(ledger.isPlanSeeded(ws), true,
    'task_done must NOT erase PLAN_MARK - mark() omits the fromPlan argument, so write() defaults it to false');
  assert.equal(gateBlocks(ws), false,
    'the finish gate must still treat plan tasks as proposals after the agent closes one');
});

test('marking every plan task done is still fine', () => {
  const ws = fresh();
  ledger.seed(ws, ['a', 'b']);
  ledger.mark(ws, 1, 'done');
  ledger.mark(ws, 2, 'done');
  assert.equal(ledger.isPlanSeeded(ws), true, 'the marker survives a fully closed plan ledger');
  assert.equal(gateBlocks(ws), false, 'nothing open, nothing to block on');
});

test('marking one IN PROGRESS also keeps the marker', () => {
  const ws = fresh();
  ledger.seed(ws, ['a', 'b']);
  ledger.mark(ws, 1, 'doing');
  assert.equal(ledger.isPlanSeeded(ws), true, 'a state change of any kind must not drop the marker');
});

test('CONTROL: task_add still supersedes a pristine plan, and still clears the marker', () => {
  const ws = fresh();
  ledger.seed(ws, ['plan task one', 'plan task two']);
  const r = ledger.add(ws, ['my own task']);
  assert.equal(r.tasks.length, 1, 'a pristine plan ledger is replaced by the agent own first task_add');
  assert.equal(r.tasks[0].title, 'my own task');
  assert.equal(ledger.isPlanSeeded(ws), false,
    'add() clearing the marker is correct: the list is now the agent own, so it SHOULD bind');
  assert.equal(gateBlocks(ws), true, 'and a task the agent chose itself does bind the finish gate');
});

test('CONTROL: a ledger the agent built itself was never plan-seeded', () => {
  const ws = fresh();
  ledger.add(ws, ['only my task']);
  assert.equal(ledger.isPlanSeeded(ws), false);
  assert.equal(gateBlocks(ws), true, 'own tasks bind, which is the whole point of the gate');
});

test('CONTROL: adding to a plan ledger that has PROGRESS appends rather than replacing', () => {
  const ws = fresh();
  ledger.seed(ws, ['plan one', 'plan two']);
  ledger.mark(ws, 1, 'done');
  const r = ledger.add(ws, ['discovered work']);
  assert.equal(r.tasks.length, 3, 'real progress is never discarded, so this appends');
  assert.ok(r.tasks.some((t) => t.title === 'plan one' && t.state === 'done'), 'the closed plan task survives');
});

test('the file itself: PLAN_MARK is present after a mark, and the task states are intact', () => {
  const ws = fresh();
  ledger.seed(ws, ['x', 'y']);
  ledger.mark(ws, 1, 'done');
  const body = readFileSync(join(ws, 'TASKS.md'), 'utf8');
  assert.match(body, /seeded-from-plan/, 'the marker must still be in TASKS.md');
  assert.match(body, /- \[x\] 1\. x/, 'and the done state must have been written');
  assert.match(body, /- \[ \] 2\. y/, 'and the open one left open');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
