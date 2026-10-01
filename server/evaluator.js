/**
 * evaluator.js - THE INDEPENDENT EVALUATOR.
 *
 * The same evaluator in BOTH arms. It answers one question per task: does the candidate do what
 * the task required, and does it still do what it was already required to do?
 *
 * WHY IT IS NOT THE MODEL'S JOB. The model owns proposing edits and declaring that it BELIEVES
 * it is done. It does not own whether the behaviour works. Those were previously conflated as
 * "acceptance", and keeping them apart is what lets a completion claim be wrong without the
 * measurement being wrong.
 *
 * FOUR RULES, each closing a specific failure this project has already recorded.
 *
 * 1. THE CANDIDATE RUNS INSIDE THE QUALIFIED WORKER. Evaluating means executing model-written
 *    code; doing that on the host would be a hole in the boundary exactly where the campaign's
 *    conclusions are produced.
 *
 * 2. REQUESTED AND PROTECTED BEHAVIOUR ARE CHECKED SEPARATELY. "It does the new thing" and "it
 *    still does the old thing" are different results and are never summed. A run that adds a
 *    feature by breaking an existing one is not a partial success.
 *
 * 3. PASS / FAIL / EVALUATION_ERROR - three outcomes, never two. An unavailable worker, an
 *    unconfirmed completion, or a broken check is NOT a coding failure. Scoring apparatus
 *    failure as FAIL would silently convert infrastructure flakiness into evidence about the
 *    model, which is the single most expensive mistake available here.
 *
 * 4. EXPECTED ANSWERS AND EVALUATOR CODE LIVE OUTSIDE THE CANDIDATE'S WRITABLE CONTROL. The
 *    check is materialised into a private directory at evaluation time and the candidate's
 *    workspace is mounted READ-ONLY beneath it. A candidate that could edit the test could pass
 *    by editing the test.
 *
 * RESULTS BIND TO THE EXACT CANDIDATE EVALUATED - the tree id, not "the workspace". A verdict
 * that does not name what it judged cannot be checked afterwards, and this project has already
 * compared two different baselines with no error raised anywhere.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { WORKER_IMAGE, WorkerUnavailable, WorkerUnconfirmed } from './worker.js';
import { cid1 } from './cid1.mjs';
import { copySnapshot } from './snapshotCopy.mjs';

const exec = promisify(execFile);

export const VERDICT = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', EVALUATION_ERROR: 'EVALUATION_ERROR' });

const dockerRaw = async (args, timeoutMs) => {
  try {
    const { stdout, stderr } = await exec('docker', args, { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    return { ok: true, out: String(stdout), err: String(stderr) };
  } catch (e) {
    // Never e.message - it carries the whole argv, including host paths.
    return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || ''), code: e.code ?? null };
  }
};

/** The tree id of the candidate being judged, so a verdict names exactly what it saw. */
async function candidateTree(workspace) {
  try {
    const { stdout } = await exec('git', ['-C', workspace, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8', windowsHide: true });
    return String(stdout).trim();
  } catch { return null; }
}

/**
 * Run ONE check script against the candidate, in the worker.
 *
 * MOUNT LAYOUT, and every part of it is deliberate:
 *   /candidate  the workspace, READ-ONLY - the code under test cannot rewrite the test
 *   /check      the evaluator's own directory, READ-ONLY - expected answers live here
 *   /scratch    a writable tmpfs, so a check that needs to write has somewhere that is not
 *               the candidate and not the host
 *
 * Returns { ran, exit, out } or throws for apparatus failure.
 */
async function runCheck(workspace, checkDir, script, { timeoutSec = 120, image = WORKER_IMAGE } = {}) {
  const args = [
    'run', '-d',
    '--network', 'none',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--user', '1000:1000',
    '--pids-limit', '512',
    '-v', `${workspace}:/candidate:ro`,       // READ-ONLY: rule 4
    '-v', `${checkDir}:/check:ro`,            // READ-ONLY: the expected answers
    '--tmpfs', '/scratch:rw,size=64m',
    '-w', '/scratch',
    image,
    'sh', '-c', script,
  ];
  const started = await dockerRaw(args, 120_000);
  const cid = started.ok ? started.out.trim().split(/\s+/).pop() : '';
  if (!started.ok || !/^[0-9a-f]{12,64}$/.test(cid)) {
    throw new WorkerUnavailable({ phase: 'evaluator-start', stderrHead: started.err.replace(/\s+/g, ' ').trim().slice(0, 300) });
  }
  let timedOut = false;
  try {
    let timer;
    const waited = await Promise.race([
      dockerRaw(['wait', cid], timeoutSec * 1000 + 60_000),
      new Promise((r) => { timer = setTimeout(() => r('TIMEOUT'), timeoutSec * 1000); }),
    ]).finally(() => clearTimeout(timer));
    let res = waited;
    if (waited === 'TIMEOUT') { timedOut = true; await dockerRaw(['kill', cid], 60_000); res = await dockerRaw(['wait', cid], 60_000); }
    const logs = await dockerRaw(['logs', cid], 60_000);
    const exit = parseInt(String(res.out || '').trim(), 10);
    if (!res.ok || Number.isNaN(exit)) throw new WorkerUnconfirmed({ phase: 'evaluator-wait', timedOut });
    return { ran: true, exit, timedOut, out: logs.out + logs.err };
  } finally {
    await dockerRaw(['rm', '-f', cid], 60_000);
  }
}

/**
 * Evaluate one candidate against one task requirement.
 *
 * `task` is the PREDEFINED requirement, fixed before the run:
 *   { id, requested: {script}, protected: {script} }
 * Each script exits 0 for satisfied, non-zero for not satisfied. They are written by the
 * experimenter and never by the model.
 *
 * A TIMED-OUT CHECK IS AN EVALUATION_ERROR, NOT A FAIL. The check did not finish, so it did not
 * establish anything about the candidate - and a slow machine must never read as a broken
 * program.
 */
// `image` is injectable so the EVALUATION_ERROR path can actually be exercised. It cannot be
// forced through the environment: WORKER_IMAGE binds at import, so a test that set the env var
// changed nothing and the check quietly ran normally - an inert probe reporting a real PASS,
// which is the same shape as every other apparatus artifact recorded in this project.
export async function evaluate(workspace, task, { timeoutSec = 120, image = WORKER_IMAGE } = {}) {
  const tree = await candidateTree(workspace);
  const base = { task: task.id, candidateTree: tree, at: new Date().toISOString(), image };
  if (!tree) {
    return { ...base, verdict: VERDICT.EVALUATION_ERROR, reason: 'the candidate could not be identified (no git tree) - a verdict that cannot name what it judged is not a verdict' };
  }

  // D-CONS-1 (legasus/screen/D-CONS-1_PREREG.md, 9165f9e4): IMMUTABLE JUDGMENT.
  //
  // The checks used to run against the LIVE workspace. Anything that wrote to it during a check
  // changed what was being judged: a mutation mid-check was judged PASS, and a mutate-then-restore
  // left both endpoints equal while the check had read the transient bytes (K5, run d8318c57).
  // Endpoint hashing cannot see that; construction can. So the checks run against a PRIVATE
  // snapshot built with D-COPY's rule and verified to be C0 - an object nothing else writes to.
  //
  // C0 is the SUBJECT of the verdict. The candidateTree receipt above is unchanged in this step:
  // what the receipt names is D-BIND's boundary, not this one.
  const subject = cid1(workspace);
  if (!subject.ok) {
    return { ...base, subject: null, verdict: VERDICT.EVALUATION_ERROR, reason: `the candidate snapshot could not be identified (${subject.reason}) - a judgment needs a subject` };
  }
  const C0 = subject.id;
  base.subject = C0;
  const snapRoot = mkdtempSync(join(tmpdir(), 'legasus-judged-'));
  const judged = join(snapRoot, 'candidate');
  // Materialise the checks OUTSIDE the workspace, fresh each time.
  const checkDir = mkdtempSync(join(tmpdir(), 'legasus-check-'));
  try {
    try { copySnapshot(workspace, judged); } catch (e) {
      return { ...base, verdict: VERDICT.EVALUATION_ERROR, reason: `the candidate could not be copied for judgment: ${e.code || e.name}` };
    }
    const S0 = cid1(judged);
    if (!S0.ok || S0.id !== C0) {
      return { ...base, verdict: VERDICT.EVALUATION_ERROR, reason: `the copy made for judgment is not the candidate (${S0.ok ? S0.id : S0.reason}) - it changed while being copied` };
    }
    const parts = {};
    for (const kind of ['requested', 'protected']) {
      const spec = task[kind];
      if (!spec) { parts[kind] = { verdict: null, reason: 'not specified for this task' }; continue; }
      const file = join(checkDir, `${kind}.sh`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, spec.script, 'utf8');
      if (spec.files) for (const [name, body] of Object.entries(spec.files)) writeFileSync(join(checkDir, name), body, 'utf8');
      try {
        const r = await runCheck(judged, checkDir, `sh /check/${kind}.sh`, { timeoutSec, image });   // the private snapshot, never the live workspace
        if (r.timedOut) {
          parts[kind] = { verdict: VERDICT.EVALUATION_ERROR, reason: `the ${kind} check timed out after ${timeoutSec}s - it established nothing about the candidate`, out: r.out.slice(0, 2000) };
        } else {
          parts[kind] = { verdict: r.exit === 0 ? VERDICT.PASS : VERDICT.FAIL, exit: r.exit, out: r.out.slice(0, 2000) };
        }
      } catch (e) {
        // Apparatus failure. NEVER a coding failure.
        parts[kind] = {
          verdict: VERDICT.EVALUATION_ERROR,
          reason: e instanceof WorkerUnconfirmed
            ? `the ${kind} check started but its completion could not be confirmed`
            : `the ${kind} check could not be run: ${e.name}`,
          detail: e.detail || null,
        };
      }
    }

    // REPORTED SEPARATELY, never summed. The overall verdict is deliberately conservative:
    // any EVALUATION_ERROR makes the whole result an EVALUATION_ERROR, because a run whose
    // measurement partly failed has not been measured.
    const vals = Object.values(parts).map((p) => p.verdict).filter(Boolean);
    const verdict = vals.includes(VERDICT.EVALUATION_ERROR) ? VERDICT.EVALUATION_ERROR
      : vals.includes(VERDICT.FAIL) ? VERDICT.FAIL
        : vals.length ? VERDICT.PASS : VERDICT.EVALUATION_ERROR;

    // THE HAND-OFF GUARD. The judged object must still be C0, and the LIVE workspace - the thing the
    // caller will retain or restore - must still be C0 too. A judgment of C0 cannot authorize C1.
    // When it fails, the checks' results are kept as an AUDIT record about C0, and every verdict
    // field a consumer might act on becomes EVALUATION_ERROR - a caller reading only `requested`
    // must not find a PASS that authorizes a different object.
    const S1 = cid1(judged), C1 = cid1(workspace);
    const consistency = { subject: C0, judgedAfter: S1.ok ? S1.id : null, liveAfter: C1.ok ? C1.id : null };
    if (!S1.ok || S1.id !== C0 || !C1.ok || C1.id !== C0) {
      const why = !S1.ok || S1.id !== C0
        ? 'the judged snapshot changed during evaluation'
        : `the candidate changed during evaluation (live ${C1.ok ? C1.id : C1.reason}) - a judgment of ${C0} cannot authorize it`;
      const neuter = (p) => (p && p.verdict ? { verdict: VERDICT.EVALUATION_ERROR, reason: why, judgedVerdict: p.verdict } : p);
      return { ...base, verdict: VERDICT.EVALUATION_ERROR, reason: why, consistency,
        requested: neuter(parts.requested), protected: neuter(parts.protected),
        auditOfSubject: { verdict, requested: parts.requested, protected: parts.protected } };
    }
    return { ...base, verdict, consistency, requested: parts.requested, protected: parts.protected };
  } finally {
    try { rmSync(checkDir, { recursive: true, force: true }); } catch { /* best effort */ }
    try { rmSync(snapRoot, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
