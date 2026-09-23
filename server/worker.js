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
  || 'node@sha256:b6f26b36c8ff49624cfdac716b8ea1138d606df02586a77d364bb5536a634f85';  // node:22-alpine

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
export function workerArgs(workspace, cmd, { image = WORKER_IMAGE, timeoutSec = 600 } = {}) {
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
    'sh', '-c', `timeout ${timeoutSec} ${cmd}`,
  ];
}

/**
 * Run one model-chosen command inside the isolated worker.
 *
 * Returns combined output like the hub's run_command does, so the model sees the same shape of
 * result in both arms and the isolation is not itself a visible difference.
 */
export async function runInWorker(workspace, cmd, opts = {}) {
  const args = workerArgs(workspace, cmd, opts);
  try {
    const { stdout, stderr } = await exec('docker', args, { timeout: (opts.timeoutSec || 600) * 1000 + 30_000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    return { ok: true, out: String(stdout) + String(stderr) };
  } catch (e) {
    // NEVER fall back to e.message. execFile puts the ENTIRE argv in it, so a failing command
    // would hand back the host workspace path and every isolation flag - leaking the mount
    // location into model-visible output, and giving a probe something to match on that came
    // from the harness rather than from the container. That is exactly how this probe first
    // reported the host filesystem as visible when it was not.
    const out = String(e.stdout || '') + String(e.stderr || '');
    return { ok: false, out: out || `ERROR: command failed (exit ${e.code ?? 'unknown'})` };
  }
}
