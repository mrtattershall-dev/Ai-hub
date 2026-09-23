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
export function workerArgs(workspace, cmd, { image = WORKER_IMAGE } = {}) {
  return [
    'run', '--rm',
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

/** Marks output produced INSIDE the container. Absence means the command never ran there. */
const RAN_SENTINEL = '__LEGASUS_WORKER_EXIT__';

/**
 * Thrown when the worker itself could not run the command.
 *
 * THE FROZEN RULE: worker failure is an EXECUTION ERROR, never permission to retry on the host.
 * A fallback would silently move model-written code outside the qualified boundary at exactly
 * the moment something was already wrong - and the run would look normal. There is no host
 * fallback anywhere in this module, and the run must fail instead.
 */
export class WorkerUnavailable extends Error {
  constructor(detail) {
    // Deliberately terse and argv-free. Docker's own failure text embeds the full command line,
    // including the host workspace path and every isolation flag.
    super('the isolated worker could not run this command');
    this.name = 'WorkerUnavailable';
    this.detail = detail;          // host-side diagnostics, for the run record only
  }
}

/**
 * Run one model-chosen command inside the isolated worker.
 *
 * TWO OUTCOMES THAT MUST NOT BE CONFUSED:
 *
 *   the command RAN in the worker and exited non-zero   -> an ordinary result the model sees
 *   the worker could not run it at all                  -> WorkerUnavailable, the run errors
 *
 * Exit codes cannot make that distinction reliably: docker reuses the command's status, and its
 * own 125/126/127 conventions overlap with statuses a real command can return. So the container
 * PRINTS A SENTINEL carrying the true exit code. Output containing it was produced inside the
 * worker; output without it never got there, whatever the exit code says.
 *
 * The sentinel is stripped before the model sees anything.
 */
export async function runInWorker(workspace, cmd, opts = {}) {
  // Single-quote the model's command so nothing in it is reinterpreted by the wrapper, and
  // run it under `timeout` INSIDE the container. A command killed by the timeout still ran
  // in the worker, so it reports an exit code rather than an infrastructure failure.
  const quoted = "'" + String(cmd).replace(/'/g, `'\\''`) + "'";
  const sec = opts.timeoutSec || 600;
  const wrapped = `timeout ${sec} sh -c ${quoted}; printf '%s%d' '${RAN_SENTINEL}' "$?"`;
  const args = workerArgs(workspace, wrapped, opts);
  let raw, failure = null;
  try {
    const { stdout, stderr } = await exec('docker', args, { timeout: (opts.timeoutSec || 600) * 1000 + 30_000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    raw = String(stdout) + String(stderr);
  } catch (e) {
    // NEVER read e.message here: execFile puts the ENTIRE argv in it, which would leak the host
    // workspace path and the isolation flags into model-visible output. This already caused a
    // probe to report the host filesystem as visible when it was not.
    raw = String(e.stdout || '') + String(e.stderr || '');
    failure = { code: e.code ?? null, killed: !!e.killed };
  }

  const at = raw.lastIndexOf(RAN_SENTINEL);
  if (at < 0) {
    // No sentinel: the command never executed inside the worker. Infrastructure, not a result.
    throw new WorkerUnavailable({ ...failure, stderrHead: raw.replace(/\s+/g, ' ').trim().slice(0, 300) });
  }
  const exit = parseInt(raw.slice(at + RAN_SENTINEL.length), 10);
  const out = raw.slice(0, at);
  return { ok: exit === 0, ran: true, exit: Number.isNaN(exit) ? null : exit, out };
}
