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

  // Materialise the checks OUTSIDE the workspace, fresh each time.
  const checkDir = mkdtempSync(join(tmpdir(), 'legasus-check-'));
  try {
    const parts = {};
    for (const kind of ['requested', 'protected']) {
      const spec = task[kind];
      if (!spec) { parts[kind] = { verdict: null, reason: 'not specified for this task' }; continue; }
      // A PLAY spec: the declared browser play (playCheck.js) against the candidate, in the
      // machine's headless Chrome - the candidate's JS runs in the browser sandbox, not in the
      // worker container. requested = every listed step; protected = the steps it names.
      // SEVERAL SEQUENCES, EACH FROM A FRESH LOAD. Accumulated requirements cannot be concatenated
      // into one sequence: these plays are stateful, so running the seed-exhaustion sequence and then
      // a planting sequence would fail a perfectly good page. Each accumulated requirement is its own
      // play, run independently, and ALL must pass.
      if (spec.plays) {
        const { playCheck } = await import('./playCheck.js');
        const results = [];
        let allOk = true, apparatus = null;
        for (const entry of spec.plays) {
          try {
            const r = await playCheck(workspace, entry.spec, { timeoutMs: timeoutSec * 1000 });
            if (r.status !== 'OK') { apparatus = `the ${kind} play from ${entry.from} could not run: ${r.reason}`; break; }
            const needed = Array.isArray(entry.steps) && entry.steps.length ? entry.steps : (entry.spec.steps || []).map((x) => x.n);
            const ok = needed.every((n) => r.passing.has(n));
            if (!ok) allOk = false;
            results.push({ from: entry.from, verdict: ok ? VERDICT.PASS : VERDICT.FAIL, steps: needed, passing: [...r.passing], failing: [...r.failing], errors: (r.errors || []).length });
          } catch (e) {
            apparatus = `the ${kind} play from ${entry.from} threw: ${String(e.message || e).slice(0, 160)}`;
            break;
          }
        }
        if (apparatus) { parts[kind] = { verdict: VERDICT.EVALUATION_ERROR, reason: apparatus, sequences: results }; continue; }
        parts[kind] = {
          verdict: allOk ? VERDICT.PASS : VERDICT.FAIL,
          exit: allOk ? 0 : 1,
          sequences: results,
          isolation: 'headless browser on the host (not the worker container)',
          out: results.map((r) => `${r.from}: ${r.verdict} passing [${r.passing.join(',')}] failing [${r.failing.join(',')}]`).join('\n'),
        };
        continue;
      }
      if (spec.play) {
        try {
          const { playCheck } = await import('./playCheck.js');
          const r = await playCheck(workspace, spec.play.spec, { timeoutMs: timeoutSec * 1000 });
          if (r.status !== 'OK') { parts[kind] = { verdict: VERDICT.EVALUATION_ERROR, reason: `the ${kind} play could not run: ${r.reason}` }; continue; }
          const needed = Array.isArray(spec.play.steps) && spec.play.steps.length ? spec.play.steps : (spec.play.spec.steps || []).map((s) => s.n);
          const ok = needed.every((n) => r.passing.has(n));
          parts[kind] = { verdict: ok ? VERDICT.PASS : VERDICT.FAIL, exit: ok ? 0 : 1, out: String(r.log).slice(0, 2000), isolation: 'headless browser on the host (not the worker container)', steps: needed, passing: [...r.passing], failing: [...r.failing] };
        } catch (e) {
          parts[kind] = { verdict: VERDICT.EVALUATION_ERROR, reason: `the ${kind} play threw: ${String(e.message || e).slice(0, 160)}` };
        }
        continue;
      }
      const file = join(checkDir, `${kind}.sh`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, spec.script, 'utf8');
      if (spec.files) for (const [name, body] of Object.entries(spec.files)) writeFileSync(join(checkDir, name), body, 'utf8');
      try {
        const r = await runCheck(workspace, checkDir, `sh /check/${kind}.sh`, { timeoutSec, image });
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
    return { ...base, verdict, requested: parts.requested, protected: parts.protected };
  } finally {
    try { rmSync(checkDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
