/**
 * governance.js - THE CAMPAIGN'S ACCEPTANCE PATH, FOR RUNS STARTED FROM THE HUB ITSELF.
 *
 * COMPONENT-CONNECTIONS.md (2026-09-24): the evaluator, the acceptance policy and the rollback
 * were reachable only from campaign runners (batch.js). A run started from the served hub's UI
 * got none of it - it could finish with a broken workspace and nothing would say so. This
 * module reuses that path, unchanged, for a run that DECLARES what it is protecting:
 *
 *   governed = { checks: { requested: { script, files? }, protected: { script, files? } } }
 *
 * Both checks are the evaluator's own shape (a shell script run inside the qualified worker
 * with the candidate mounted read-only at /candidate and the check at /check). Nothing here
 * invents a new evaluator or a new policy; it is applyAcceptance() on a run instead of a task.
 *
 * THREE PRECONDITIONS, each refused loudly rather than degraded silently:
 *   1. the hub must be running with the qualified execution path (worker exec + bounded
 *      routes) - a "protected" run whose model executes on the host is not the thing measured
 *      in the campaigns, and must not carry the campaigns' label;
 *   2. the checks must validate - shape, and a script for each;
 *   3. the STARTING STATE must be verified: committed, and the protected check must PASS on
 *      it. A restore to an unverified start only moves the problem (acceptance.js says the
 *      same). The requested check is evaluated too and recorded - a goal whose requested
 *      behaviour already passes is recorded as such, not refused.
 *
 * PROTECTION STATUS IS A FIELD ON EVERY RUN, governed or not:
 *   NONE                      no checks declared: no verified start, no evaluation, no rollback
 *   BEHAVIORAL_ACCEPTANCE     declared checks, verified start, evaluated and dispositioned at end
 *   FAILED_TO_APPLY           governed, but the conclusion itself threw - visible, never silent
 * The UI shows this on the run. A run without protection says so in words.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, VERDICT } from './evaluator.js';
import { applyAcceptance, DISPOSITION } from './acceptance.js';
import { WORKER_IMAGE, workerAvailable } from './worker.js';

const exec = promisify(execFile);
const git = async (ws, args) => {
  try {
    const { stdout } = await exec('git', ['-C', ws, ...args], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, GIT_AUTHOR_NAME: 'hub-governance', GIT_AUTHOR_EMAIL: 'governance@hub.local', GIT_COMMITTER_NAME: 'hub-governance', GIT_COMMITTER_EMAIL: 'governance@hub.local' },
    });
    return { ok: true, out: String(stdout).trim() };
  } catch (e) { return { ok: false, err: String(e.stderr || e.message || '').trim() }; }
};

export const PROTECTION = Object.freeze({
  NONE: 'NONE',
  BEHAVIORAL_ACCEPTANCE: 'BEHAVIORAL_ACCEPTANCE',
  FAILED_TO_APPLY: 'FAILED_TO_APPLY',
});

export const NO_PROTECTION_NOTE = 'No behavioral acceptance protection: no checks were declared, the starting state was not verified, the result will not be evaluated, and nothing will be rolled back.';

/** Shape validation only. Says exactly what is missing. */
export function validateChecks(checks) {
  const errors = [];
  if (!checks || typeof checks !== 'object') return ['checks must be an object with requested and protected'];
  for (const kind of ['requested', 'protected']) {
    const c = checks[kind];
    if (!c || typeof c !== 'object') { errors.push(`${kind}: missing`); continue; }
    if (typeof c.script !== 'string' || !c.script.trim()) errors.push(`${kind}.script: a non-empty shell script is required`);
    if (c.files !== undefined) {
      if (!c.files || typeof c.files !== 'object' || Array.isArray(c.files)) errors.push(`${kind}.files: must be an object of name -> contents`);
      else for (const [name, body] of Object.entries(c.files)) {
        if (!/^[A-Za-z0-9._-]+$/.test(name)) errors.push(`${kind}.files: "${name}" is not a plain file name`);
        if (typeof body !== 'string') errors.push(`${kind}.files.${name}: contents must be a string`);
      }
    }
  }
  return errors;
}

const taskOf = (runId, checks) => ({ id: runId, requested: checks.requested, protected: checks.protected });

/**
 * Establish the verified starting state, or say why it cannot be.
 * Returns { ok: true, startRef, startTree, startVerdict } or { ok: false, reason }.
 */
export async function prepareGoverned(workspace, runId, checks, { qualifiedPath, image = WORKER_IMAGE, timeoutSec = 120 } = {}) {
  if (!qualifiedPath) {
    return { ok: false, reason: 'this hub is not running the qualified execution path (start it with AGENT_WORKER_EXEC=1 and AGENT_BOUND_ROUTES=1); a governed run cannot carry the protection label without it' };
  }
  const errors = validateChecks(checks);
  if (errors.length) return { ok: false, reason: `checks did not validate: ${errors.join('; ')}` };
  if (!(await workerAvailable())) return { ok: false, reason: 'the isolated worker is unavailable (Docker), so the starting state cannot be verified' };

  if (!existsSync(workspace)) mkdirSync(workspace, { recursive: true });
  if (!existsSync(join(workspace, '.git'))) {
    const init = await git(workspace, ['init', '-q']);
    if (!init.ok) return { ok: false, reason: `git init failed: ${init.err}` };
  }
  // BYTES, NOT GIT'S IDEA OF BYTES. With core.autocrlf on (the Windows default here) a restore
  // checks out CRLF where LF was committed: the tree id matches, the recheck passes, and the
  // file is not what was verified. governedRun.test caught it. Repo-local, so the hub's own
  // global setting is untouched.
  await git(workspace, ['config', 'core.autocrlf', 'false']);
  await git(workspace, ['add', '-A', '--ignore-errors']);
  const commit = await git(workspace, ['commit', '-q', '--allow-empty', '-m', `governed start: run ${runId}`]);
  if (!commit.ok && !/nothing to commit/.test(commit.err)) return { ok: false, reason: `the starting state could not be committed: ${commit.err}` };
  const ref = await git(workspace, ['rev-parse', 'HEAD']);
  const tree = await git(workspace, ['rev-parse', 'HEAD^{tree}']);
  if (!ref.ok || !tree.ok) return { ok: false, reason: 'the starting state has no identity (rev-parse failed)' };

  const startVerdict = await evaluate(workspace, taskOf(runId, checks), { timeoutSec, image });
  const prot = startVerdict.protected?.verdict;
  if (prot !== VERDICT.PASS) {
    return {
      ok: false,
      reason: prot === VERDICT.EVALUATION_ERROR
        ? `the protected check could not be evaluated on the starting state: ${startVerdict.protected?.reason || 'evaluation error'}`
        : 'the protected check FAILS on the starting state - there is no verified state to protect or restore to',
      startVerdict,
    };
  }
  if (startVerdict.requested?.verdict === VERDICT.EVALUATION_ERROR) {
    return { ok: false, reason: `the requested check could not be evaluated on the starting state: ${startVerdict.requested?.reason || 'evaluation error'}`, startVerdict };
  }
  return {
    ok: true, startRef: ref.out, startTree: tree.out,
    startVerdict: { requested: startVerdict.requested?.verdict ?? null, protected: prot, candidateTree: startVerdict.candidateTree },
    requestedAlreadyPasses: startVerdict.requested?.verdict === VERDICT.PASS,
  };
}

/**
 * At the run's terminal boundary: evaluate the candidate, apply the policy, report both
 * verdicts. Never throws - a failure here is itself a recorded outcome.
 */
export async function concludeGoverned(workspace, run, { captureDir, image = WORKER_IMAGE, timeoutSec = 120 } = {}) {
  const g = run.governed;
  try {
    const task = taskOf(run.id, g.checks);
    const candidateVerdict = await evaluate(workspace, task, { timeoutSec, image });
    const acceptance = await applyAcceptance(workspace, task, candidateVerdict, { startRef: g.startRef, captureDir, taskId: run.id, image });
    return {
      protection: PROTECTION.BEHAVIORAL_ACCEPTANCE,
      candidateVerdict: acceptance.candidateVerdict,
      survivingWorkspaceVerdict: acceptance.survivingWorkspaceVerdict,
      disposition: acceptance.disposition,
      countsAsCompletion: acceptance.countsAsCompletion,
      capturedAt: acceptance.capturedAt,
      workspaceRestored: acceptance.disposition === DISPOSITION.RESTORED,
      concludedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { protection: PROTECTION.FAILED_TO_APPLY, error: String(e && e.message || e).slice(0, 300), concludedAt: new Date().toISOString() };
  }
}

export { DISPOSITION };
