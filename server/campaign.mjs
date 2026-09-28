#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// campaign.mjs — run a list of pages and FAIL THE CAMPAIGN when any of them fails.
//
//   node server/campaign.mjs --pages <dir> --out <dir> [--model ...] [--model-url ...]
//
// WHY THIS EXISTS. The pilot's 1.5B arm was launched with a shell loop:
//
//     for p in p1 p2 p3 p4; do node server/managerRun.mjs ... ; done; echo DONE
//
// p4 died in round 4 and wrote no record. The loop's exit status is its LAST command - the echo - so
// the campaign reported success, the task notification said "exit code 0", and a missing file was the
// only trace. An echo decided whether an experiment succeeded.
//
// So this launcher:
//   propagates failure     a non-zero child exit makes the campaign exit non-zero
//   records interruption   a page with no record, or one still marked INTERRUPTED, is named as such
//   reconciles counts      calls the runner reports against attempts on record against attempts in
//                          the corpus on disk, per page, and any disagreement fails the campaign
//
// A campaign summary is written whatever happens. "No file" is never allowed to mean "nothing to see".
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const PAGES = opt('pages', null);
const OUTDIR = opt('out', null);
const MODEL = opt('model', null);
const MODEL_URL = opt('model-url', null);
const GUIDANCE = opt('guidance', null);
// THE WATCHDOG. A billing read cannot enforce a spend cap: billing lags, so it reports money already
// gone and says nothing about money in flight. Wall-clock time is the quantity this process can meter
// directly and in real time, so it is the enforcement.
//
// A BETWEEN-PAGE CHECK IS NOT A BOUND. It prevents STARTING after the deadline and does nothing about a
// page already running, and nothing at all about a request that never returns - which is precisely the
// case where a hosted GPU keeps billing. So there are three layers, and the first two act IN FLIGHT:
//
//   per-request  managerRun's own fetch deadline, so one hung call cannot run forever
//   in-flight    each child is given the REMAINING budget as a hard timeout, so the deadline lands
//                mid-page and kills the runner rather than waiting for it to finish
//   backstop     a timer in THIS process that stops the hosted app even if the child ignores
//                termination or never returns
//
// WHAT THE BACKSTOP IS NOT INDEPENDENT OF, stated because a bound nobody has bounded is not a bound:
// it lives in the campaign process. It survives a hung child, a child that ignores SIGTERM, and a
// request that never returns. It does NOT survive this process being killed, the machine sleeping
// (which has already cost this project a campaign), power loss, or the host being suspended. In
// every one of those cases the hosted app keeps its own scaledown window and then scales to zero on
// its own - so `scaledown_window` is the only bound that holds when this process is gone, and it is
// the reason it is set to 45s rather than left at the hub's 15 minutes.
//
// STARTUP IS INSIDE THE BUDGET ONLY IF DEPLOYMENT HAPPENS AFTER THIS CLOCK STARTS. Deploying the
// hosted app in a separate command beforehand - which is how AUDIT-1 ran - puts deployment and the
// first cold start OUTSIDE the measured window. Pass --deploy to bring it inside.
//
// A TESTED STOP INVOCATION IS NOT AN OBSERVED SHUTDOWN. The local tests establish that this process
// calls `modal app stop --yes` and records the outcome. They cannot establish that the provider
// stopped billing; only the provider's own app state and billing report can, and those are read
// separately and reconciled.
//
// The clock starts at process start, BEFORE the first page, so deployment and startup exposure are
// inside the budget rather than outside it.
const MAX_GPU_SECONDS = parseInt(opt('max-gpu-seconds', '0'), 10);
const STOP_APP = opt('stop-app', null);
// Deploying here rather than in a prior command is what puts deployment and the first cold start
// INSIDE the measured budget. Deployed beforehand, that exposure is real and simply unmeasured.
const DEPLOY = opt('deploy', null);
// WHICH ARM. Both run through this same launcher, so campaign accounting - interruption detection,
// corpus reconciliation, the wall-clock watchdog - is identical for the manager and the control. A
// comparison where only one arm is supervised is not a comparison.
const ARM = opt('arm', 'manager');
const RUNNER = ARM === 'direct' ? 'server/directRun.mjs' : 'server/managerRun.mjs';
const T_START = Date.now();
const elapsed = () => (Date.now() - T_START) / 1000;
let shutdown = null;
async function stopHostedApp(why) {
  const t0 = Date.now();
  if (!STOP_APP) return { attempted: false, why, shutdownSeconds: 0 };
  try {
    await exec('python', ['-m', 'modal', 'app', 'stop', STOP_APP, '--yes'],
      { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    return { attempted: true, stopped: true, why, shutdownSeconds: +((Date.now() - t0) / 1000).toFixed(1) };
  } catch (e) {
    return { attempted: true, stopped: false, why, shutdownSeconds: +((Date.now() - t0) / 1000).toFixed(1), error: String(e.message || e).slice(0, 200) };
  }
}

// THE BACKSTOP, armed before any page runs. It does not depend on a child returning, on a loop
// iterating, or on any request completing - including one that never returns.
if (MAX_GPU_SECONDS) {
  const timer = setTimeout(async () => {
    shutdown = { trippedAt: +elapsed().toFixed(1), budget: MAX_GPU_SECONDS, by: 'backstop timer' };
    console.log(`
WATCHDOG BACKSTOP at ${elapsed().toFixed(0)}s: stopping the hosted app regardless of what is in flight`);
    shutdown.appStop = await stopHostedApp('backstop timer fired');
    try { writeFileSync(join(OUTDIR, '_watchdog.json'), JSON.stringify(shutdown, null, 2), 'utf8'); } catch { /* reported below */ }
  }, MAX_GPU_SECONDS * 1000);
  timer.unref();
}
if (!PAGES || !OUTDIR) { console.error('usage: node server/campaign.mjs --pages <dir> --out <dir>'); process.exit(2); }

mkdirSync(OUTDIR, { recursive: true });

let deployment = null;
if (DEPLOY) {
  const t0 = Date.now();
  try {
    await exec('python', ['-m', 'modal', 'deploy', DEPLOY],
      { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    deployment = { file: DEPLOY, ok: true, seconds: +((Date.now() - t0) / 1000).toFixed(1), insideBudget: true };
  } catch (e) {
    deployment = { file: DEPLOY, ok: false, seconds: +((Date.now() - t0) / 1000).toFixed(1), error: String(e.message || e).slice(0, 300) };
    console.error(`deployment FAILED after ${deployment.seconds}s: ${deployment.error.split(String.fromCharCode(10))[0]}`);
    writeFileSync(join(OUTDIR, '_campaign.json'), JSON.stringify({ at: new Date().toISOString(), deployment, results: [] }, null, 2), 'utf8');
    process.exit(1);
  }
  console.log(`deployed in ${deployment.seconds}s, inside the ${MAX_GPU_SECONDS || 'unbounded'}s budget`);
}
const pages = readdirSync(PAGES).filter((d) => {
  try { return statSync(join(PAGES, d)).isDirectory() && existsSync(join(PAGES, d, 'task.json')); } catch { return false; }
}).sort();

const results = [];
let watchdog = null;
let timedOutGlobally = false;
for (const p of pages) {
  // Checked BEFORE starting a page, with that page's own maximum included, so the budget bounds what
  // is about to be spent rather than reporting what already was.
  if (timedOutGlobally || (MAX_GPU_SECONDS && elapsed() >= MAX_GPU_SECONDS)) {
    watchdog = { trippedAt: elapsed(), budget: MAX_GPU_SECONDS, stoppedBefore: p };
    watchdog.appStop = await stopHostedApp(`wall-clock budget of ${MAX_GPU_SECONDS}s reached`);
    console.log(`
WATCHDOG: ${elapsed().toFixed(0)}s of a ${MAX_GPU_SECONDS}s budget - stopping before ${p}`);
    break;
  }
  const outFile = join(OUTDIR, `${p}.json`);
  const args = [RUNNER, '--dir', join(PAGES, p), '--out', outFile];
  if (MODEL) args.push('--model', MODEL);
  if (MODEL_URL) args.push('--model-url', MODEL_URL);
  if (GUIDANCE && ARM !== 'direct') args.push('--guidance', GUIDANCE);
  console.log(`\n######## ${p} ########`);
  let exitCode = 0; let err = null; let timedOut = false;
  // THE REMAINING BUDGET IS THE CHILD'S TIMEOUT, so the deadline lands mid-page. Without this the bound
  // is only ever enforced between pages, and a page that hangs runs forever on a billing meter.
  const remainingMs = MAX_GPU_SECONDS ? Math.max(1000, (MAX_GPU_SECONDS - elapsed()) * 1000) : undefined;
  try {
    const r = await exec(process.execPath, args, { cwd: process.cwd(), windowsHide: true, maxBuffer: 50e6, timeout: remainingMs, killSignal: 'SIGKILL' });
    process.stdout.write(String(r.stdout || '').split('\n').slice(-6).join('\n'));
  } catch (e) {
    exitCode = e.code ?? 1;
    timedOut = e.killed === true || e.signal === 'SIGKILL' || /ETIMEDOUT/.test(String(e.code));
    err = String(e.stderr || e.message || '').slice(0, 400);
    process.stdout.write(String(e.stdout || '').split('\n').slice(-6).join('\n'));
    console.log(`  CHILD FAILED exit ${exitCode}: ${err.split('\n')[0]}`);
  }

  // ── what is actually on disk, independent of what the child said ──
  const run = existsSync(outFile) ? (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')); } catch { return null; } })() : null;
  const corpusDir = outFile.replace(/\.json$/, '') + '.attempts';
  const corpus = existsSync(corpusDir) ? readdirSync(corpusDir).filter((f) => f.endsWith('.json')).length : 0;

  const rec = {
    page: p, exitCode,
    status: run ? run.status : (corpus ? 'INTERRUPTED_NO_RECORD' : 'NO_RECORD'),
    accepted: run ? !!run.accepted : null,
    callsMade: run ? run.calls : null,
    attemptsRecorded: run ? run.attempts.length : null,
    attemptsInCorpus: corpus,
    endedBecause: run && run.reconciliation ? run.reconciliation.endedBecause : null,
    error: err,
  };
  // RECONCILIATION. The corpus is written per attempt and the run record at the end, so the corpus can
  // legitimately hold MORE than the record if the run died between the two. It must never hold fewer.
  rec.problems = [];
  rec.killedByWatchdog = timedOut;
  if (timedOut) rec.problems.push('the runner was TERMINATED IN FLIGHT by the wall-clock budget');
  else if (exitCode !== 0) rec.problems.push(`the runner exited ${exitCode}`);
  if (!run) rec.problems.push(corpus ? `no run record, though ${corpus} attempt(s) survive in the corpus` : 'no run record and no corpus');
  else {
    if (run.status !== 'COMPLETE') rec.problems.push(`the run record says ${run.status}`);
    if (corpus < run.attempts.length) rec.problems.push(`the corpus holds ${corpus} attempts but the record claims ${run.attempts.length}`);
  }
  rec.ok = rec.problems.length === 0;
  if (timedOut) timedOutGlobally = true;
  results.push(rec);
  console.log(`  ${rec.ok ? 'OK' : 'PROBLEM'}  status ${rec.status}  accepted ${rec.accepted}  calls ${rec.callsMade}  attempts ${rec.attemptsRecorded}/${rec.attemptsInCorpus} (record/corpus)`);
  for (const q of rec.problems) console.log(`     ! ${q}`);
}

if (MAX_GPU_SECONDS && !watchdog) await stopHostedApp('campaign finished');
const summary = {
  at: new Date().toISOString(), arm: ARM, runner: RUNNER, pages: pages.length,
  wallClockSeconds: +elapsed().toFixed(1), maxGpuSeconds: MAX_GPU_SECONDS || null, watchdog, deployment,
  terminatedInFlight: results.some((r) => r.killedByWatchdog), backstop: shutdown,
  pagesNotRun: watchdog ? pages.length - results.length : 0,
  completed: results.filter((r) => r.ok).length,
  interrupted: results.filter((r) => !r.ok).length,
  accepted: results.filter((r) => r.accepted).length,
  results,
};
writeFileSync(join(OUTDIR, '_campaign.json'), JSON.stringify(summary, null, 2), 'utf8');

console.log(`\n${summary.completed} of ${summary.pages} pages COMPLETED, ${summary.interrupted} interrupted, ${summary.accepted} accepted`);
if (summary.terminatedInFlight) {
  console.log(`WATCHDOG TERMINATED A RUNNING PAGE IN FLIGHT. This is a truncated campaign, not a null result.`);
  process.exit(1);
}
if (watchdog) {
  console.log(`WATCHDOG TRIPPED: ${summary.pagesNotRun} page(s) were never run. This is a truncated campaign, not a null result.`);
  process.exit(1);
}
if (summary.interrupted) {
  console.log('CAMPAIGN FAILED: an interrupted page is not a completed page with a null result.');
  process.exit(1);
}
console.log('campaign complete: every page ran to a recorded end');
