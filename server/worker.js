/**
 * worker.js - THE ISOLATED AGENT EXECUTION ENVIRONMENT.
 *
 * WHY THIS EXISTS. The same-user ACL boundary was FALSIFIED: the model owns the audit directory,
 * therefore holds WRITE_DAC, therefore can rewrite the DACL and read the capture. Two `icacls`
 * calls - the same two the hub's own cleanup uses. That is a property of the mechanism, so no
 * redesign of quarantine could fix it, and the demonstrated bypass is preserved in
 * d2Revoke.test.mjs as the negative control for everything here.
 *
 * THE ARRANGEMENT THIS IMPLEMENTS
 *
 *     host controller   owns audit captures, restoration decisions, experiment records
 *     agent worker      receives ONLY its workspace and the tools it needs
 *     audit storage     not reachable from the worker, including via credentials or APIs
 *     other runs        not reachable from the worker
 *
 * A DIFFERENT KIND OF BOUNDARY, AND THE TEST MUST JUDGE IT DIFFERENTLY. The ACL attempt denied
 * reads of a path that WAS there. Here the audit store is simply NOT PRESENT in the worker's
 * filesystem namespace: only the workspace is bind-mounted. So a read fails with ENOENT, and in
 * this mechanism ENOENT is the correct and stronger signal - the thing is absent, not merely
 * forbidden. That inverts the rule d2Access.test.mjs had to apply, where ENOENT would have meant
 * a broken probe. Absence only counts as isolation if the worker ALSO cannot make the path
 * appear, which is why the qualification tests attempts to obtain access, not just reads.
 *
 * WHAT IS DELIBERATELY WITHHELD
 *   - no bind mount except the workspace        (audit storage, other runs: not in the namespace)
 *   - no docker socket                          (no control-plane escape)
 *   - --network none                            (no credentials, no APIs, no remote fetch)
 *   - --cap-drop ALL, --security-opt no-new-privileges
 *   - a non-root user inside, so even in-namespace privilege is bounded
 *
 * SYMMETRY. Both arms run through this same worker with the same image, mounts, limits and
 * network policy. Isolation is apparatus, never treatment: the arms still differ only in the
 * AUTHORITY to decide what survives.
 *
 * NOT CLAIMED. Containers are not a security boundary against a determined kernel-level attack,
 * and nothing here claims otherwise. The claim is scoped to what the campaign needs: an agent
 * command route that cannot reach the host's audit storage, other runs, or credentials.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** The image the worker runs. Pinned, because "node:latest" is a different experiment later. */
// PINNED BY DIGEST, not by tag. A tag is a moving pointer: node:22-alpine resolving to a
// different build between ARM A and ARM B would make the two arms differ in their toolchain
// while every record still said they matched. The digest makes the image an experimental
// constant. Changing it is a deliberate act that shows up in a diff.
export const WORKER_IMAGE = process.env.AGENT_WORKER_IMAGE
  || 'sha256:fa49b576430b1288a585522bbf011fbd218cedcb379eb7bb57e3a69fec08a8c3';  // legasus-worker:1
//
// Built from docker/worker.Dockerfile, itself FROM node@sha256:b6f26b36...  The base image had
// NO PYTHON - checked, not inferred from Node being present - so run_python would have failed
// inside the worker while passing on the host. python3 and git are baked in at BUILD time
// because the worker runs with --network none: both arms resolve identical dependencies
// because they are the same image layer, not two network fetches.

/** Is an isolated worker available at all? The campaign must refuse to start without one. */
export async function workerAvailable() {
  try {
    const { stdout } = await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 30_000, windowsHide: true });
    return { ok: true, server: String(stdout).trim() };
  } catch (e) {
    return { ok: false, error: String(e.stderr || e.message || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
}

/**
 * The flags that constitute the boundary. Exported so a test can assert on the ACTUAL argument
 * list rather than on a description of it - a comment claiming "--network none" is not evidence
 * that the flag is passed, and this project has already asserted a bug from the wrong side twice.
 */
export function workerArgs(workspace, cmd, { image = WORKER_IMAGE, name = null } = {}) {
  return [
    'run',
    // IDENTITY BEFORE CREATION. The name is chosen by the caller and recorded before the
    // create request is sent, so a lost response can be RECONCILED against it rather than
    // guessed at. Without this, "docker run failed" and "docker run succeeded but the answer
    // never came back" are indistinguishable - the sentinel's ambiguity moved one layer out.
    ...(name ? ['--name', name] : []),
    // NO --rm. The detached flow asks the DAEMON for the exit status, and --rm deletes the
    // container the instant it exits, so  reported "No such container" for every
    // command that finished normally - an authoritative status destroyed by a cleanup flag.
    // Removal is explicit in the finally block instead.
    '--network', 'none',              // no credentials, no APIs, no remote anything
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--user', '1000:1000',            // not root inside the namespace either
    '--pids-limit', '512',
    '-v', `${workspace}:/work`,       // THE ONLY MOUNT. No audit store, no other runs, no socket.
    '-w', '/work',
    image,
    // The script arrives FULLY FORMED. workerArgs must not wrap it further: an earlier version
    // prepended `timeout N` here, which turned the sentinel wrapper into
    // `timeout 600 { cmd; }` - a shell syntax error that looked exactly like infrastructure
    // failure. Timeout now lives inside the script, where it can be quoted correctly.
    'sh', '-c', cmd,
  ];
}

/**
 * Outcome of an attempt to run a command in the worker. THREE states, not two.
 *
 *   COMPLETED     the daemon reported an exit status. An ordinary result.
 *   UNCONFIRMED   the container STARTED but no authoritative status came back. The command may
 *                 have run partially. EFFECTS ARE POSSIBLE.
 *   NOT_STARTED   the container was never created or started. No effects are possible.
 *
 * WHY THREE. An earlier version had two, and inferred "never ran" from a missing completion
 * sentinel printed by the command itself. That was wrong twice over:
 *
 *   1. A missing sentinel does NOT prove the command never ran. It is equally consistent with
 *      partial execution before a timeout, a kill, or lost output - after which the workspace
 *      may already have been modified. Treating that as "never ran" would invite a retry
 *      against a workspace that had already been half-written.
 *   2. The sentinel sat on COMMAND-CONTROLLED stdout. The model's command runs as a child of
 *      the wrapper shell and can read the wrapper's argv from /proc, so it could print the
 *      sentinel and any exit code it liked. Status must never come from the thing being judged.
 *
 * Status now comes from the DAEMON (`docker wait`), which the command cannot influence.
 */
export const WORKER_STATUS = Object.freeze({ COMPLETED: 'COMPLETED', UNCONFIRMED: 'UNCONFIRMED', NOT_STARTED: 'NOT_STARTED' });

/**
 * Thrown when the worker could not run the command AT ALL (NOT_STARTED).
 *
 * THE FROZEN RULE: worker failure is an EXECUTION ERROR, never permission to retry on the host.
 * There is no host fallback in this module.
 */
export class WorkerUnavailable extends Error {
  constructor(detail) {
    // Terse and argv-free: docker's own failure text embeds the full command line, including
    // the host workspace path and every isolation flag.
    super('the isolated worker could not run this command');
    this.name = 'WorkerUnavailable';
    this.detail = detail;
  }
}

/** Raised when the container ran but its completion could not be confirmed. */
export class WorkerUnconfirmed extends Error {
  constructor(detail) {
    super('the command started but its completion could not be confirmed');
    this.name = 'WorkerUnconfirmed';
    this.effectsPossible = true;      // the workspace may already have been modified
    this.detail = detail;
  }
}

const dockerRaw = async (args, timeoutMs = 60_000) => {
  try {
    const { stdout, stderr } = await exec('docker', args, { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    return { ok: true, out: String(stdout), err: String(stderr) };
  } catch (e) {
    // NEVER e.message: execFile puts the ENTIRE argv in it, leaking the workspace path and the
    // isolation flags. This already made a probe report the host filesystem as visible.
    return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || ''), code: e.code ?? null };
  }
};

/**
 * Run one model-chosen command inside the isolated worker.
 *
 * Detached start + `docker wait` deliberately, rather than a single blocking `docker run`:
 * it separates "the container never started" from "it started and we lost the answer", and it
 * takes the exit status from the daemon instead of from the command's own output.
 */
/**
 * Does a container with this identity exist?
 *
 * Returns true / false / null, and NULL IS NOT FALSE: null means the question could not be
 * answered, which must become UNCONFIRMED rather than "no". Collapsing them would reintroduce
 * exactly the ambiguity this identity exists to remove.
 */
export async function attemptExists(name) {
  const q = await dockerRaw(['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.ID}}'], 60_000);
  if (!q.ok) return null;                       // the daemon could not be asked
  return q.out.trim().length > 0;
}

/** A fresh attempt identity. Recorded by the caller BEFORE the create request is sent. */
export function newAttemptId() {
  return 'legasus-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Run one model-chosen command inside the isolated worker.
 *
 * The command goes in UNWRAPPED. An in-container `timeout` was tried and abandoned: BusyBox
 * returns 143 rather than coreutils' 124, and nested under `sh -c` the container still reported
 * exit 0 for a command demonstrably killed mid-way. In-container status is not an instrument.
 * The timeout is enforced HOST-side and every status comes from the daemon.
 *
 * `onAttempt` is called with the attempt id BEFORE creation is requested, so a caller keeping a
 * journal can reconcile after a crash. It is the caller's only chance to record the identity.
 */
export async function runInWorker(workspace, cmd, opts = {}) {
  const sec = opts.timeoutSec || 600;
  const name = opts.attemptId || newAttemptId();
  if (typeof opts.onAttempt === 'function') await opts.onAttempt(name);

  const args = workerArgs(workspace, cmd, { ...opts, name });
  const started = await dockerRaw(['run', '-d', ...args.slice(1)], 120_000);
  let cid = started.ok ? started.out.trim().split(/\s+/).pop() : '';

  if (!/^[0-9a-f]{12,64}$/.test(cid)) {
    // THE CREATE REQUEST FAILED - which does NOT establish that nothing was created. The daemon
    // may have created and started the container while the response was lost. Reconcile against
    // the identity recorded above.
    const exists = await attemptExists(name);
    if (exists === null) {
      throw new WorkerUnconfirmed({ phase: 'start-unreconcilable', attemptId: name,
        reason: 'the create request failed AND the daemon could not be asked whether it ran anyway' });
    }
    if (exists === true) {
      // It DID start. Fall through and read its real status.
      const q = await dockerRaw(['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.ID}}'], 60_000);
      cid = q.out.trim().split(/\s+/)[0] || '';
      if (!/^[0-9a-f]{12,64}$/.test(cid)) {
        throw new WorkerUnconfirmed({ phase: 'start-raced', attemptId: name,
          reason: 'a container with this identity exists but its id could not be read' });
      }
    } else {
      // CONFIRMED absent. Only now is "never created" a fact rather than an inference.
      throw new WorkerUnavailable({ phase: 'start', attemptId: name, confirmedAbsent: true,
        code: started.code ?? null, stderrHead: started.err.replace(/\s+/g, ' ').trim().slice(0, 300) });
    }
  }

  let timedOut = false;
  try {
    let timer;
    const waited = await Promise.race([
      dockerRaw(['wait', cid], sec * 1000 + 60_000),
      new Promise((r) => { timer = setTimeout(() => r('TIMEOUT'), sec * 1000); }),
    ]).finally(() => clearTimeout(timer));

    let result = waited;
    if (waited === 'TIMEOUT') {
      timedOut = true;
      await dockerRaw(['kill', cid], 60_000);
      result = await dockerRaw(['wait', cid], 60_000);
    }

    const logs = await dockerRaw(['logs', cid], 60_000);
    const out = logs.out + logs.err;
    const exit = parseInt(String(result.out || '').trim(), 10);
    if (!result.ok || Number.isNaN(exit)) {
      throw new WorkerUnconfirmed({ phase: 'wait', attemptId: name, timedOut, cid: cid.slice(0, 12), outHead: out.replace(/\s+/g, ' ').trim().slice(0, 300) });
    }
    return { status: WORKER_STATUS.COMPLETED, ok: exit === 0 && !timedOut, exit, timedOut, out, attemptId: name };
  } finally {
    await dockerRaw(['rm', '-f', cid], 60_000);
  }
}

/**
 * CONFIRM a container is stopped and gone. Used before a workspace is reused or evaluated.
 *
 * A container still running against the workspace would keep writing to it while the evaluator
 * read it, so "probably finished" is not good enough: if this cannot be confirmed, the caller
 * must halt rather than proceed.
 */
export async function confirmStopped(name) {
  await dockerRaw(['rm', '-f', name], 60_000);
  const exists = await attemptExists(name);
  if (exists === null) return { ok: false, reason: 'the daemon could not be asked whether the container is gone' };
  if (exists === true) return { ok: false, reason: 'the container still exists after a forced removal' };
  return { ok: true };
}

/**
 * Names of worker containers still RUNNING.
 *
 * Termination evidence needs this. `confirmStopped(id)` answers "that one id is gone", and in
 * the pilot the id it was given was the BATCH's attempt id, which agent.js never uses for its
 * containers - so it confirmed the absence of something that was never created and reported
 * success. A stop REQUEST plus a vacuous confirmation is not evidence that execution stopped.
 *
 * Returns null when the daemon cannot be asked, because "no containers" and "I could not look"
 * must not collapse into the same answer.
 */
export async function runningAttempts() {
  const q = await dockerRaw(['ps', '--filter', 'name=legasus-', '--format', '{{.Names}}'], 60_000);
  if (!q.ok) return null;
  return q.out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Wait until no worker container is still running, and SAY whether that was established.
 *
 * Tasks run one at a time, so "nothing of ours is running" is the invariant that means this
 * task's execution has actually stopped - not merely that a stop request returned 200.
 */
export async function confirmNoneRunning({ timeoutMs = 30_000, pollMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = await runningAttempts();
    if (last === null) return { ok: false, reason: 'the daemon could not be asked which containers are running' };
    if (last.length === 0) return { ok: true, running: [] };
    if (Date.now() >= deadline) return { ok: false, reason: `worker containers are still running after ${Math.round(timeoutMs / 1000)}s: ${last.join(', ')}`, running: last };
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
