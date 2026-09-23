/**
 * batch.test.mjs - THE UNATTENDED LOOP, qualified with SCRIPTED COMMANDS.
 *
 *   node server/batch.test.mjs
 *
 * 17/17 evaluator checks do not show that the loop survives interruption. This does, and it
 * costs no model compute: every task's "work" is a scripted command with a known outcome.
 *
 * THE FIVE CASES, plus the two the hard case really needs:
 *     success | task failure | timeout after a write | worker unavailable | interrupted resume
 *
 * The judgement throughout is on the DURABLE RECORD and the FILESYSTEM, not on return values -
 * a runner that returns a tidy object but journals nothing has not survived anything.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { runBatch, reconcile, accountFor, Journal, TASK_STATE } = await import('./batch.js');
const { runInWorker, newAttemptId } = await import('./worker.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const LIB = 'function double(n){return n*2;}\nmodule.exports={double};\n';
const PKG = '{"name":"fx","type":"commonjs"}\n';
const checkDouble = { script: 'node -e "const l=require(\'/candidate/lib.js\'); process.exit(l.double(4)===8?0:1)"' };
const checkHalve = { script: 'node -e "const l=require(\'/candidate/lib.js\'); process.exit(l.halve&&l.halve(10)===5?0:1)"' };

/** Scripted "work": whatever the task says to run, in the real worker. */
const scriptedRunner = async (ws, task, ctx) => {
  try {
    return await runInWorker(ws, task.command, { timeoutSec: task.timeoutSec || ctx.timeoutSec, attemptId: ctx.attemptId });
  } catch (e) {
    return { status: e.name === 'WorkerUnconfirmed' ? 'UNCONFIRMED' : 'NOT_STARTED', error: e.name, attemptId: ctx.attemptId };
  }
};

const TASKS = [
  { id: 'success', seed: { 'lib.js': LIB, 'package.json': PKG },
    command: "node -e \"const fs=require('fs');fs.writeFileSync('lib.js','function double(n){return n*2;}\\nfunction halve(n){return n/2;}\\nmodule.exports={double,halve};\\n')\"; git -c user.email=a@a -c user.name=a commit -aqm work",
    requested: checkHalve, protected: checkDouble },
  { id: 'taskfail', seed: { 'lib.js': LIB, 'package.json': PKG },
    command: 'echo "did nothing useful"',
    requested: checkHalve, protected: checkDouble },
  { id: 'timeout-after-write', seed: { 'lib.js': LIB, 'package.json': PKG },
    command: "node -e \"require('fs').writeFileSync('half_written.txt','PARTIAL')\"; sleep 60",
    timeoutSec: 5, requested: checkHalve, protected: checkDouble },
  { id: 'afterwards', seed: { 'lib.js': LIB, 'package.json': PKG },
    command: 'echo still running',
    requested: checkDouble, protected: checkDouble },
];

const dirs = [];
const scratch = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };

try {
  // ── CASES 1-3 + continuation, in one batch ──
  console.log('=== cases 1-3: success, task failure, timeout after a write ===');
  const root = scratch('batch-');
  const out = await runBatch(TASKS, {
    journalPath: join(root, 'journal.jsonl'),
    workspacesDir: join(root, 'ws'),
    auditDir: join(root, 'audit'),
    perTaskSec: 60, totalSec: 600,
    runTask: scriptedRunner,
  });
  const by = Object.fromEntries(out.results.map((r) => [r.task, r]));

  say(by.success?.state === TASK_STATE.COMPLETED, `success -> COMPLETED (${by.success?.state})`);
  say(by.taskfail?.state === TASK_STATE.FAILED, `a task that does nothing -> FAILED, not an error (${by.taskfail?.state})`);
  note('That is a CODE failure, and the runner still accounted for it cleanly.');

  // the hard case
  say(by['timeout-after-write']?.state === TASK_STATE.FAILED, `timeout after a write -> FAILED (${by['timeout-after-write']?.state})`);
  const partial = by['timeout-after-write']?.partialAt;
  say(!!partial && existsSync(join(partial, 'half_written.txt')), 'its PARTIAL STATE is preserved for audit, including the half-written file');
  say(existsSync(join(root, 'ws', 'afterwards')) , 'and the NEXT task got its own fresh workspace');
  const nextWs = join(root, 'ws', 'afterwards');
  say(!existsSync(join(nextWs, 'half_written.txt')),
    'the timed-out task\'s partial state did NOT become the next task\'s starting state');
  say(by.afterwards?.state === TASK_STATE.COMPLETED, 'and the batch carried on afterwards');

  // ── the durable record ──
  console.log('\n=== the durable record ===');
  const events = new Journal(join(root, 'journal.jsonl')).read();
  say(events.length > 0 && events.some((e) => e.event === 'batch_start'), `the journal exists and is readable (${events.length} events)`);
  for (const t of TASKS) {
    const ends = events.filter((e) => e.event === 'task_end' && e.task === t.id);
    if (ends.length !== 1) { say(false, `${t.id}: expected exactly one terminal record, got ${ends.length}`); }
  }
  say(TASKS.every((t) => events.filter((e) => e.event === 'task_end' && e.task === t.id).length === 1),
    'every task has EXACTLY ONE terminal record - none missing, none duplicated');
  const starts = events.filter((e) => e.event === 'task_start');
  say(starts.every((e) => !!e.attemptId), 'every start recorded an attempt IDENTITY before the work was attempted');

  // ── final accounting ──
  console.log('\n=== final accounting ===');
  say(out.accounting.complete, `every queued task is accounted for (${out.accounting.accountedFor}/${out.accounting.queued})`);
  say(out.accounting.missing.length === 0, 'nothing silently vanished from the denominator');
  say('EVAL_ERROR' in out.accounting.counts, 'evaluator errors have their OWN column, separate from FAILED');
  note(JSON.stringify(out.accounting.counts));

  // ── CASE 4: worker unavailable ──
  console.log('\n=== case 4: worker unavailable ===');
  const root4 = scratch('batch4-');
  const out4 = await runBatch([{ id: 'nowork', seed: { 'lib.js': LIB, 'package.json': PKG }, command: 'echo hi', requested: checkDouble }], {
    journalPath: join(root4, 'journal.jsonl'), workspacesDir: join(root4, 'ws'), auditDir: join(root4, 'audit'),
    perTaskSec: 30, totalSec: 120,
    runTask: async (ws, task, ctx) => {
      try { return await runInWorker(ws, task.command, { timeoutSec: 20, attemptId: ctx.attemptId, image: 'sha256:' + '0'.repeat(64) }); }
      catch (e) { return { status: 'NOT_STARTED', error: e.name, attemptId: ctx.attemptId }; }
    },
  });
  const r4 = out4.results[0];
  say(r4.state === TASK_STATE.UNATTEMPTED, `an unavailable worker leaves the task UNATTEMPTED - nothing ran, so there is nothing to judge (${r4.state})`);
  say(r4.state !== TASK_STATE.COMPLETED && r4.state !== TASK_STATE.FAILED,
    'and it is neither COMPLETED nor FAILED - infrastructure failure is not a coding result');
  // THE BUG THIS CASE CAUGHT: the runner used to evaluate anyway. The seeded workspace
  // already satisfied the check, so it scored COMPLETED for work that never happened.
  say(!!out4.halted, `and the batch HALTS rather than burning the queue against a broken environment (${out4.halted})`);
  say(out4.accounting.complete, 'still fully accounted for');

  // ── CASE 5: INTERRUPTED RUN, RESUMED ──
  // The batch process dies after a task started and before its outcome was recorded. A restart
  // must reconcile, not repeat: repeating a command that may already have half-run is how a
  // runner corrupts state while appearing to recover.
  console.log('\n=== case 5: interruption and resume ===');
  const root5 = scratch('batch5-');
  const jp = join(root5, 'journal.jsonl');
  mkdirSync(join(root5, 'ws'), { recursive: true });
  const j = new Journal(jp);
  const orphan = newAttemptId();
  j.record({ event: 'batch_start', tasks: 1 });
  j.record({ event: 'task_start', task: 'crashy', state: 'started', attemptId: orphan, workspace: join(root5, 'ws', 'crashy') });
  // NOTE: no task_ran, no task_end - exactly the state a crash mid-task leaves behind.

  const rec = await reconcile(j.states().get('crashy'));
  say(rec.action === 'interrupt', `a task left in flight reconciles to INTERRUPT, not to a re-run (${rec.action})`);
  say(/never recorded|may have run|still exists|could not be asked/.test(rec.reason || ''), `and the reason says why (${rec.reason})`);

  let reran = false;
  const out5 = await runBatch([{ id: 'crashy', seed: { 'lib.js': LIB, 'package.json': PKG }, command: 'echo SHOULD_NOT_RUN', requested: checkDouble }], {
    journalPath: jp, workspacesDir: join(root5, 'ws'), auditDir: join(root5, 'audit'),
    perTaskSec: 30, totalSec: 120,
    runTask: async (...a) => { reran = true; return scriptedRunner(...a); },
  });
  say(!reran, 'the restarted batch did NOT re-execute the possibly-executed command');
  say(out5.results[0].state === TASK_STATE.INTERRUPTED, `it is recorded as INTERRUPTED (${out5.results[0].state})`);
  say(out5.accounting.complete, 'and an interrupted task is still accounted for, not dropped');
  note('A resumed task that "just runs again" would be the failure this whole case exists for.');

  // ── a task with no recorded identity cannot be reconciled, so it is not repeated either ──
  const noId = await reconcile({ task: 'x', state: 'started' });
  say(noId.action === 'interrupt', 'a started task with no recorded identity is also INTERRUPTED, never retried');

  // ── accounting is asserted against the QUEUE, so a vanished task is visible ──
  console.log('\n=== accounting cannot hide a lost task ===');
  const bad = accountFor([{ id: 'a' }, { id: 'b' }], [{ task: 'a', state: TASK_STATE.COMPLETED }]);
  say(bad.complete === false && bad.missing.includes('b'),
    'a task missing from the results is reported as MISSING rather than shrinking the denominator');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  batch lifecycle: ${passed} passed, ${failed} failed -> ${failed ? 'THE UNATTENDED LOOP IS NOT QUALIFIED' : 'the loop accounts for its work'}`);
process.exit(failed ? 1 : 0);
