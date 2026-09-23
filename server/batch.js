/**
 * batch.js - THE UNATTENDED BATCH RUNNER.
 *
 * The pilot's first question is not whether the model codes well. It is whether the runner
 * ACCOUNTS FOR ITS WORK: does every queued task end up in a known state, does it respect its
 * limits, and does it stop cleanly rather than continuing into an unknown state? A batch full
 * of failed coding attempts can pass that test.
 *
 * THE HARD CASE IS A TASK THAT STOPS HALFWAY. Everything here is shaped by it.
 *
 * DURABLE JOURNAL, WRITTEN BEFORE THE ACT. Every state change is appended to a JSONL journal
 * and flushed before the thing it describes is attempted. A journal written afterwards cannot
 * survive the crash it exists to describe. So an attempt's identity is recorded BEFORE the
 * container is created - which is also what lets a restart reconcile it.
 *
 * RESUME RECONCILES, IT NEVER BLINDLY REPEATS. On restart, a task left `started` is not re-run.
 * Its recorded attempt identity is checked against the daemon:
 *     the container exists  -> its real status is read
 *     confirmed absent      -> it never started, so it is safe to attempt again
 *     cannot be established -> INTERRUPTED, and the batch does not touch it again
 * Re-running a command that may already have half-executed is how a runner corrupts state while
 * appearing to recover.
 *
 * TIMEOUT CLEANUP IS CONFIRMED, NOT ASSUMED. A container still running against a workspace keeps
 * writing to it while the evaluator reads it. Before evaluation, workspace reuse, or the next
 * task, the container must be CONFIRMED gone. If that cannot be confirmed, the batch HALTS -
 * because the alternative is measuring a workspace that something else is still editing.
 *
 * FRESH WORKSPACE PER TASK, and a timed-out task's partial state is PRESERVED for audit rather
 * than becoming the next task's starting point. Carrying it forward would silently make every
 * later task a different experiment.
 *
 * EVALUATION ERRORS ARE NOT CODE FAILURES. They are counted in their own column, always.
 */
import { appendFileSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { confirmStopped, confirmNoneRunning, attemptExists, newAttemptId } from './worker.js';
import { evaluate, VERDICT } from './evaluator.js';
import { applyAcceptance, DISPOSITION } from './acceptance.js';

/** Terminal states. Every queued task must end in exactly one of them. */
export const TASK_STATE = Object.freeze({
  COMPLETED: 'COMPLETED',       // ran to completion and was evaluated
  FAILED: 'FAILED',             // ran, evaluated, did not meet the requirement
  INTERRUPTED: 'INTERRUPTED',   // started, outcome not established - never silently retried
  UNATTEMPTED: 'UNATTEMPTED',   // never started (budget, halt, or batch end)
  EVAL_ERROR: 'EVAL_ERROR',     // the instrument failed, NOT the code
});

export class Journal {
  constructor(path) {
    this.path = path;
    mkdirSync(join(path, '..'), { recursive: true });
  }

  /**
   * Append and FLUSH. Written before the act it describes, never after.
   *
   * THE ENVELOPE WINS. This used to spread the payload OVER the timestamp, so any field named
   * "at" replaced it - and one did: partial_preserved recorded a Windows path where the time
   * should have been. Renaming that one field fixed the instance and left the SHAPE intact,
   * so the next collision would have done exactly the same thing, just as silently.
   *
   * A colliding payload key is not dropped either - it is kept under a payload_ prefix,
   * because silently discarding recorded data is the same class of fault as overwriting it.
   */
  record(event) {
    const envelope = { at: new Date().toISOString() };
    const body = {};
    for (const [k, v] of Object.entries(event || {})) {
      if (k in envelope) body["payload_" + k] = v;
      else body[k] = v;
    }
    const line = JSON.stringify({ ...body, ...envelope }) + '\n';
    appendFileSync(this.path, line, 'utf8');   // appendFileSync opens, writes and closes
    return event;
  }

  read() {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, 'utf8').split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return { corrupt: l.slice(0, 120) }; }
    });
  }

  /** The last known state of each task, rebuilt from the journal alone. */
  states() {
    const m = new Map();
    for (const e of this.read()) if (e.task) m.set(e.task, e);
    return m;
  }
}

const git = (ws, ...a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };

/**
 * Reconcile ONE task left in-flight by a previous run.
 *
 * Returns what the batch should do with it. It never returns "run it again" for a task whose
 * attempt may have executed.
 */
export async function reconcile(entry) {
  if (!entry || entry.state !== 'started') return { action: 'none' };
  if (!entry.attemptId) {
    // Started with no recorded identity: nothing can be checked, so nothing may be repeated.
    return { action: 'interrupt', reason: 'the task was started but no attempt identity was recorded, so it cannot be reconciled' };
  }
  const exists = await attemptExists(entry.attemptId);
  if (exists === null) return { action: 'interrupt', reason: 'the daemon could not be asked whether this attempt ran' };
  if (exists === true) return { action: 'interrupt', reason: 'the attempt container still exists - its outcome was never recorded' };
  // CONFIRMED absent. Note what this does and does not license: the container is gone, which is
  // consistent both with "never created" and with "created, ran and was removed". The journal
  // decides: an attempt whose completion was never recorded is treated as INTERRUPTED, not as
  // free to repeat.
  return entry.completionRecorded
    ? { action: 'none' }
    : { action: 'interrupt', reason: 'the attempt container is gone but no completion was ever recorded - it may have run' };
}

/**
 * Run a batch of tasks unattended.
 *
 * `opts`: { workspacesDir, auditDir, perTaskSec, totalSec, runTask }
 * `runTask(ws, task, ctx)` performs the actual work and resolves when the task's own loop ends.
 * It is supplied by the caller so this module can be qualified with scripted commands, before
 * any model compute.
 */
export async function runBatch(tasks, opts) {
  const { workspacesDir, auditDir, perTaskSec = 300, totalSec = 1800, runTask, evalImage } = opts;
  const journal = new Journal(opts.journalPath);
  mkdirSync(workspacesDir, { recursive: true });
  mkdirSync(auditDir, { recursive: true });

  const deadline = Date.now() + totalSec * 1000;
  const prior = journal.states();
  const results = [];
  let halted = null;

  // THE ACCEPTED BASELINE. Updated only by an acceptance decision, never by a task merely
  // finishing. `chain` is off by default so independent task sets are unaffected.
  const chain = !!opts.chain;
  const acceptedBaselineDir = join(workspacesDir, '.accepted-baseline');
  let acceptedBaselineTask = 'none';
  let acceptedBaselineTree = null;

  journal.record({ event: 'batch_start', tasks: tasks.length, perTaskSec, totalSec, chain });

  /**
   * Apply the acceptance policy and decide what the NEXT task receives.
   *
   * THE SOLE WRITER OF task_end. Two call sites used to record their own terminal event before
   * calling this, which produced TWO terminal records for one task - the precise thing the
   * one-record invariant forbids.
   *
   * The baseline advances ONLY on RETAIN. Preserved-incomplete work, restored damage and
   * held candidates all leave the baseline exactly where it was - passing a limited
   * preservation suite does not make a partial change fit to build upon.
   */
  async function finalise(ws, task, candidateVerdict, startRef, termination) {
    const acceptance = await applyAcceptance(ws, task, candidateVerdict, {
      startRef, captureDir: join(auditDir, 'rejected'), taskId: task.id, image: evalImage,
    });

    let halt = null;
    if (acceptance.disposition === DISPOSITION.RETAIN) {
      // The only path that advances the baseline.
      try {
        rmSync(acceptedBaselineDir, { recursive: true, force: true });
        cpSync(ws, acceptedBaselineDir, { recursive: true, filter: (src) => !src.includes(`${sep}.git`) });
        acceptedBaselineTree = acceptance.survivingWorkspaceVerdict?.candidateTree || null;
        acceptedBaselineTask = task.id;
      } catch (e) {
        halt = `the accepted baseline could not be stored: ${e.message}`;
      }
    } else if (acceptance.disposition === DISPOSITION.RESTORE_FAILED || acceptance.disposition === DISPOSITION.HELD) {
      // Damage that could not be undone, or a verdict that was never established. Either way
      // the batch must stop rather than advance on an unknown state.
      halt = acceptance.disposition === DISPOSITION.HELD
        ? 'the evaluation failed, so nothing may be promoted'
        : 'the workspace could not be restored after a protected-behaviour failure';
    }

    const state = acceptance.countsAsCompletion ? TASK_STATE.COMPLETED
      : acceptance.disposition === DISPOSITION.HELD ? TASK_STATE.EVAL_ERROR
        : TASK_STATE.FAILED;

    journal.record({
      event: 'task_end', task: task.id, state, finalState: state, termination,
      disposition: acceptance.disposition,
      candidateVerdict: acceptance.candidateVerdict,
      survivingWorkspaceVerdict: acceptance.survivingWorkspaceVerdict,
      capturedAt: acceptance.capturedAt,
      baselineTree: acceptedBaselineTree,
      baselineTask: acceptedBaselineTask,
      promotable: acceptance.promotable,
    });
    return { state, acceptance, halt };
  }

  for (const task of tasks) {
    // RESUME: a task the previous run left in flight is reconciled, never blindly repeated.
    const before = prior.get(task.id);
    if (before) {
      const r = await reconcile(before);
      if (r.action === 'interrupt') {
        journal.record({ event: 'task_end', task: task.id, state: TASK_STATE.INTERRUPTED, reason: r.reason });
        results.push({ task: task.id, state: TASK_STATE.INTERRUPTED, reason: r.reason });
        continue;
      }
      if (before.state === 'ended') { results.push({ task: task.id, state: before.finalState, resumedFromJournal: true }); continue; }
    }

    if (halted) {
      journal.record({ event: 'task_end', task: task.id, state: TASK_STATE.UNATTEMPTED, reason: `batch halted: ${halted}` });
      results.push({ task: task.id, state: TASK_STATE.UNATTEMPTED, reason: `batch halted: ${halted}` });
      continue;
    }
    if (Date.now() >= deadline) {
      journal.record({ event: 'task_end', task: task.id, state: TASK_STATE.UNATTEMPTED, reason: 'total budget exhausted' });
      results.push({ task: task.id, state: TASK_STATE.UNATTEMPTED, reason: 'total budget exhausted' });
      continue;
    }

    // THE NEXT TASK STARTS FROM THE ACCEPTED BASELINE - never from whatever files happened
    // to remain in the previous workspace.
    //
    // This is the link PILOT-2 was missing. It detected a regression and then left the broken
    // workspace in place; nothing connected the verdict to what the next task would receive.
    // When chaining, the starting content comes from the baseline directory, which is updated
    // ONLY by an acceptance decision - never by a task simply finishing.
    const ws = join(workspacesDir, task.id);
    rmSync(ws, { recursive: true, force: true });
    mkdirSync(ws, { recursive: true });
    const fromBaseline = chain && acceptedBaselineDir && existsSync(acceptedBaselineDir);
    if (fromBaseline) {
      cpSync(acceptedBaselineDir, ws, { recursive: true, filter: (src) => !src.includes(`${sep}.git`) });
    } else if (task.seed) {
      for (const [f, body] of Object.entries(task.seed)) writeFileSync(join(ws, f), body, 'utf8');
    }
    git(ws, 'init', '-q'); git(ws, 'add', '-A');
    git(ws, '-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '-m', 'verified starting state');
    const startRef = git(ws, 'rev-parse', 'HEAD');
    const startTree = git(ws, 'rev-parse', 'HEAD^{tree}');
    journal.record({
      event: 'task_baseline', task: task.id,
      baselineSource: fromBaseline ? `accepted baseline from ${acceptedBaselineTask}` : 'task seed',
      startTree,
    });

    // IDENTITY RECORDED BEFORE THE WORK IS ATTEMPTED.
    const attemptId = newAttemptId();
    journal.record({ event: 'task_start', task: task.id, state: 'started', attemptId, workspace: ws });

    const budget = Math.min(perTaskSec, Math.max(1, Math.round((deadline - Date.now()) / 1000)));
    let outcome;
    try {
      outcome = await runTask(ws, task, { attemptId, timeoutSec: budget });
    } catch (e) {
      outcome = { status: 'ERROR', error: String(e && e.name || e) };
    }
    journal.record({ event: 'task_ran', task: task.id, state: 'started', attemptId, completionRecorded: true, outcome: { status: outcome.status, exit: outcome.exit ?? null, timedOut: !!outcome.timedOut } });

    // TIMEOUT CLEANUP, CONFIRMED. Nothing may read or reuse this workspace until the container
    // that was writing to it is provably gone.
    // TERMINATION EVIDENCE MUST BE ABOUT THE CONTAINERS THAT EXIST.
    //
    // This used to call confirmStopped(attemptId) alone - but agent.js generates its OWN
    // container names, so that id was never attached to anything. It confirmed the absence of
    // a container that was never created, and reported success. A stop request returning 200
    // plus a vacuous confirmation is not evidence that execution stopped.
    await confirmStopped(outcome.attemptId || attemptId);   // harmless if it was never used
    const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });
    if (!stopped.ok) {
      halted = `could not confirm the worker stopped: ${stopped.reason}`;
      journal.record({ event: 'batch_halt', task: task.id, reason: halted });
      journal.record({ event: 'task_end', task: task.id, state: TASK_STATE.INTERRUPTED, reason: halted });
      results.push({ task: task.id, state: TASK_STATE.INTERRUPTED, reason: halted });
      continue;
    }

    // THE WORK NEVER RAN -> DO NOT EVALUATE.
    //
    // Caught by the scripted worker-unavailable case, where the runner went on to evaluate
    // the SEEDED workspace, which already satisfied the check, and scored the task COMPLETED.
    // An infrastructure failure had become a coding result - the precise mistake the
    // three-state contract exists to prevent, reintroduced one layer up by evaluating
    // unconditionally. Evaluating a workspace the candidate never touched measures the seed.
    //
    // It also HALTS the batch: an unavailable worker is systemic, so continuing would burn
    // the remaining queue against a broken environment and produce a page of results that
    // say nothing about any model.
    if (outcome.status === 'NOT_STARTED' || outcome.status === 'ERROR') {
      halted = `the worker could not run the task: ${outcome.error || outcome.status}`;
      journal.record({ event: 'batch_halt', task: task.id, reason: halted });
      journal.record({ event: 'task_end', task: task.id, state: TASK_STATE.UNATTEMPTED, finalState: TASK_STATE.UNATTEMPTED, reason: halted });
      results.push({ task: task.id, state: TASK_STATE.UNATTEMPTED, reason: halted });
      continue;
    }

    // A TIMED-OUT TASK'S PARTIAL STATE IS PRESERVED FOR AUDIT, and does not travel forward.
    //
    // AND IT IS STILL EVALUATED. Skipping evaluation here was wrong: once execution is
    // CONFIRMED STOPPED (above), the preserved workspace is not an arbitrary mid-edit
    // snapshot - it is exactly what survived the allotted budget, which is what the budget
    // was there to measure. A model can also write working code and never call task_done;
    // skipping evaluation would score that delivered behaviour as no completion.
    //
    // TERMINATION AND BEHAVIOUR STAY SEPARATE. The task is recorded as having terminated by
    // TIMEOUT regardless of what the evaluator then finds, and the behavioural verdict is
    // recorded on its own axis. A timeout does not imply a behavioural failure, and a
    // behavioural pass does not erase the timeout.
    let terminalEval = null;
    if (outcome.timedOut || outcome.status === 'UNCONFIRMED') {
      const keep = join(auditDir, `${task.id}-partial`);
      try { cpSync(ws, keep, { recursive: true }); } catch { /* audit copy is best effort */ }
      journal.record({ event: 'partial_preserved', task: task.id, preservedAt: keep, why: outcome.timedOut ? 'timed out' : 'completion unconfirmed' });

      // Give the surviving candidate an IDENTITY before judging it.
      git(ws, 'add', '-A');
      git(ws, '-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '-m', 'terminal candidate as it survived the budget');
      try {
        terminalEval = await evaluate(ws, task, { timeoutSec: Math.min(120, perTaskSec), image: evalImage });
      } catch (e) {
        terminalEval = { verdict: VERDICT.EVALUATION_ERROR, reason: String((e && e.name) || e) };
      }

      const termination = outcome.timedOut ? 'TIMEOUT' : 'COMPLETION_UNCONFIRMED';
      // ACCEPTANCE IS MANDATORY, including for a task that ran out of budget.
      const acc = await finalise(ws, task, terminalEval, startRef, termination);
      results.push({ task: task.id, state: acc.state, termination, verdict: terminalEval, partialAt: keep, outcome, acceptance: acc.acceptance, baselineTree: acceptedBaselineTree });
      if (acc.halt) { halted = acc.halt; journal.record({ event: 'batch_halt', task: task.id, reason: halted }); }
      continue;
    }
    // EVALUATE - the same independent evaluator in both arms.
    let verdict;
    try {
      verdict = await evaluate(ws, task, { timeoutSec: Math.min(120, perTaskSec), image: evalImage });
    } catch (e) {
      verdict = { verdict: VERDICT.EVALUATION_ERROR, reason: String(e && e.name || e) };
    }
    // ACCEPTANCE IS MANDATORY. No task is finalised without it.
    const acc = await finalise(ws, task, verdict, startRef, 'ENDED');
    results.push({ task: task.id, state: acc.state, termination: 'ENDED', verdict, outcome, acceptance: acc.acceptance, baselineTree: acceptedBaselineTree });
    if (acc.halt) { halted = acc.halt; journal.record({ event: 'batch_halt', task: task.id, reason: halted }); }
  }

  const accounting = accountFor(tasks, results);
  journal.record({ event: 'batch_end', halted, accounting });
  return { results, accounting, halted, journalPath: journal.path };
}

/**
 * FINAL ACCOUNTING. Every queued task appears exactly once, in exactly one column, with
 * evaluator errors kept apart from code failures.
 *
 * The total is asserted against the queue length rather than computed from the results, so a
 * task that silently vanished shows up as a mismatch instead of as a smaller denominator.
 */
export function accountFor(tasks, results) {
  const counts = { COMPLETED: 0, FAILED: 0, INTERRUPTED: 0, UNATTEMPTED: 0, EVAL_ERROR: 0 };
  const seen = new Set();
  for (const r of results) { counts[r.state] = (counts[r.state] || 0) + 1; seen.add(r.task); }
  const missing = tasks.filter((t) => !seen.has(t.id)).map((t) => t.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    queued: tasks.length,
    accountedFor: total,
    complete: total === tasks.length && missing.length === 0,
    missing,
    counts,
  };
}
