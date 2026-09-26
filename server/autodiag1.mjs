/**
 * autodiag1.mjs - AUTODIAG-1: plain CONTROL vs automatic execution and delivery of test results.
 *
 *   node server/autodiag1.mjs <modelBaseUrl>
 *
 * Reuses the TESTCMD-1 runner unchanged - same batch path, same acceptance policy, same
 * independent evaluator, same measures, same interleaving with alternating arm order, same
 * mechanical run/summary join. The ONLY difference is what the treatment arm receives:
 *
 *   CONTROL       the seed exactly as BENCH-1/2/3 ran it, BENCH_GUIDANCE verbatim.
 *   AUTODIAG_ARM  the SAME seed and the SAME guidance - no extra files, no extra sentences -
 *                 and the Hub runs the graded cases itself and delivers the RESULT before the
 *                 first model call, and again whenever the target file has actually changed.
 *
 * So the treatment is AUTOMATIC EXECUTION AND DELIVERY OF SUPPLIED TEST RESULTS. It is not
 * the TESTCMD-1 package (a runner source plus an instruction), and it is not a test of the
 * wider framework.
 *
 * SUCCESS IS ACCEPTED REPAIRS. Case gains, regressions, cost and delivered diagnostics are
 * reported separately and never summed into a win: more feedback, or more passing cases, is
 * not by itself a result.
 *
 * THE DIAGNOSTIC IS CHARGED TO THE TASK ALLOWANCE. It runs inside the task's own 300s wall
 * clock - there is no separate budget - and one that would start with under 30s left is
 * skipped and recorded as skipped.
 *
 * THE EXPOSED CASES ARE THE GRADED CASES, so any AUTODIAG result is REPAIR WITH SUPPLIED TEST
 * RESULTS. Never evidence of generalization to unseen inputs.
 *
 * FRESHNESS FOLLOWS CONTENT, NOT TOOL NAMES: the Hub compares the target's sha256 before and
 * after every tool, so a write via run_python or run_command refreshes the report exactly as
 * an edit_file does.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { externalTasks, farmTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');
const { testCommandFiles, TEST_COMMAND_GUIDANCE } = await import('./taskTests.js');
const { runBatch } = await import('./batch.js');
const { evaluate } = await import('./evaluator.js');
const { caseSet, caseDiff } = await import('./caseSet.js');
const { recordRun, recordPlan, writeReport } = await import('./campaignReport.js');
const { confirmNoneRunning, WORKER_IMAGE } = await import('./worker.js');

/** Halt reason set when the runner cannot CONFIRM a unit stopped. Never silently continued. */
let halted = null;

const MODEL_URL = process.argv[2];
if (!MODEL_URL) { console.error('usage: node server/autodiag1.mjs <modelBaseUrl>'); process.exit(2); }

// Operational knob, not a design change: the deadline-recovery test needs a bound it can
// exercise in seconds rather than minutes.
const PER_TASK_SEC = parseInt(process.env.AUTODIAG_PER_TASK_SEC || '300', 10);
// How long after the per-task bound the runner will wait for a unit to wind itself up before
// it stops waiting and takes the unit apart itself.
const UNIT_GRACE_MS = parseInt(process.env.AUTODIAG_UNIT_GRACE_MS || '45000', 10);
const TOTAL_SEC = parseInt(process.env.AUTODIAG_TOTAL_SEC || String(3 * 60 * 60), 10);
const REPS = Math.max(1, parseInt(process.env.AUTODIAG_REPS || '2', 10));
// THE EXPERIMENT'S NAME, from the launch, never hard-coded: the AUTODIAG-2 campaign printed
// "AUTODIAG-1 START/RESULT/COMPLETE" and wrote AUTODIAG-1_REPORT.json because it was.
const EXPERIMENT = process.env.AUTODIAG_EXPERIMENT || 'AUTODIAG-1';
// ARMS. Every arm gets the IDENTICAL seed files and the IDENTICAL guidance; arms differ only in
// the diagnostic spec attached to the start request, which the Hub runs and delivers itself.
const ARM_DESC = {
  CONTROL: 'nothing delivered',
  NOTIFY: 'the Hub runs the graded cases and delivers ONLY the counts (attempted/passed/failed) - no case, input, expected or actual value',
  AUTODIAG_ARM: 'the Hub runs the graded cases and delivers the full result (counts plus up to 6 failing cases, expected vs actual)',
  // RECOV-1: the SAME full opening report in all three; only the feedback after an edit differs.
  INIT_ONLY: 'full opening report; after an edit the diagnostic is re-run and recorded but NOTHING is delivered',
  INIT_COUNTS: 'full opening report; after an edit only the counts are delivered',
  INIT_FULL: 'full opening report; after an edit the full result is delivered (identical to AUTODIAG_ARM)',
  // PILOT: the full diagnostic AND the recovery controller (recovery.js) - restores rejected
  // edits, refuses repeats, stops on exhausted attempts / provisionals. Policy from
  // AUTODIAG_RECOVERY_POLICY (JSON), default {maxAttempts:2,maxRepeats:2,maxProvisional:3}.
  RECOVERY_ARM: 'full diagnostic (opening + after every edit) PLUS the recovery controller: verified checkpoint, exact rollback of rejected edits, repeat refusal, attempt/provisional bounds',
};
const RECOVERY_POLICY = (() => { try { return process.env.AUTODIAG_RECOVERY_POLICY ? JSON.parse(process.env.AUTODIAG_RECOVERY_POLICY) : { maxAttempts: 2, maxRepeats: 2, maxProvisional: 3 }; } catch { console.error('AUTODIAG_RECOVERY_POLICY is not JSON'); process.exit(2); } })();
const ARMS = String(process.env.AUTODIAG_ARMS || 'CONTROL,AUTODIAG_ARM').split(',').map((x) => x.trim()).filter(Boolean);
for (const a of ARMS) if (!ARM_DESC[a]) { console.error(`unknown arm "${a}" - one of ${Object.keys(ARM_DESC).join(', ')}`); process.exit(2); }
if (new Set(ARMS).size !== ARMS.length) { console.error('AUTODIAG_ARMS repeats an arm'); process.exit(2); }
// SEEDS. One sampling seed per replicate, sent to the backend on every request of that
// replicate (AGENT_SEED). Unset = nothing sent, as every earlier campaign ran.
const SEEDS = String(process.env.AUTODIAG_SEEDS || '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
if (SEEDS.length && (SEEDS.length !== REPS || SEEDS.some((x) => !Number.isInteger(x)))) { console.error(`AUTODIAG_SEEDS must name exactly ${REPS} integer seed(s)`); process.exit(2); }
const seedFor = (rep) => (SEEDS.length ? SEEDS[rep - 1] : null);
// A file the campaign writes the moment it is COMPLETE, for an external watchdog that must
// not depend on this process exiting (gpuWatchdog.mjs).
const DONE_FILE = process.env.AUTODIAG_DONE_FILE || null;
const stamp = () => new Date().toISOString();
const RESERVE_SEC = 180;
const T0 = Date.now();
const DEADLINE = T0 + (TOTAL_SEC - RESERVE_SEC) * 1000;

// RESUME. AUTODIAG_ROOT names an existing campaign root: units already recorded there are
// skipped, the plan is not rewritten, and the summary is appended. This is how a campaign whose
// PROCESS died (OVERNIGHT-1 attempt 1: exit 127 after unit 1, no message) completes its pairs
// instead of starting over. Without it, a fresh root as before.
const ROOT = process.env.AUTODIAG_ROOT ? process.env.AUTODIAG_ROOT : mkdtempSync(join(tmpdir(), 'autodiag1-'));
const RESUMING = !!process.env.AUTODIAG_ROOT && existsSync(join(ROOT, 'summary.jsonl'));
const SUMMARY = join(ROOT, 'summary.jsonl');
// CRASH LOG. A process that dies without a message leaves nothing to diagnose; every abnormal
// path now writes to <root>/crash.log before the process goes.
const CRASH_LOG = join(ROOT, 'crash.log');
const crash = (kind, detail) => { try { appendFileSync(CRASH_LOG, JSON.stringify({ at: new Date().toISOString(), kind, detail: String(detail && (detail.stack || detail.message || detail)).slice(0, 2000) }) + '\n'); } catch { /* nothing left to do */ } };
process.on('uncaughtException', (e) => { crash('uncaughtException', e); console.error('uncaughtException', e); process.exit(70); });
process.on('unhandledRejection', (e) => { crash('unhandledRejection', e); console.error('unhandledRejection', e); process.exit(71); });
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK']) { try { process.on(sig, () => { crash('signal', sig); process.exit(72); }); } catch { /* not on this platform */ } }
process.on('exit', (code) => { if (code !== 0) crash('exit', `code ${code}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = 41300;
// One task runs per runBatch call, so the arm's diagnostic is carried here rather than
// threaded through batch.js - which owns ctx and must stay identical in both arms.
let currentDiagnostic = null;
let currentSeed = null;
// The unit whose post-processing (acceptance capture, case measurement, row) is running now.
let inFlight = null;
let currentRecovery = null;

// NO UNBOUNDED WAITS. AUTODIAG-1 lost 31 of 60 units to a single unit that ran 99 minutes:
// a model call whose local deadline fired at 295s but whose await did not unwind for 5,964s.
// Whatever stalled underneath, a runner that polls with an untimed fetch cannot bound a unit.
// Every request now carries its own timeout.
const API_TIMEOUT_MS = 30_000;
const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(API_TIMEOUT_MS), ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

// A frozen subset by id, for smoke tests and for re-running a named task. Empty = all 15.
const ONLY = String(process.env.AUTODIAG_TASK_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
// BENCH_GROUP=farm runs the builder's own target (benchTasks.farmTasks) instead of QuixBugs.
const POOL = process.env.BENCH_GROUP === 'farm' ? farmTasks() : externalTasks();
const BASE = POOL.filter((t) => !ONLY.length || ONLY.includes(t.id));
if (ONLY.length && BASE.length !== ONLY.length) { console.error(`AUTODIAG_TASK_IDS named ${ONLY.length} but ${BASE.length} matched`); process.exit(2); }

/**
 * A task as one arm presents it. BOTH ARMS GET THE IDENTICAL SEED AND THE IDENTICAL GUIDANCE:
 * the treatment adds no files and no sentences. It is delivered entirely by the Hub running
 * the graded cases itself and handing over the RESULT - which is why the baseline here is
 * plain CONTROL rather than the TESTCMD-1 package.
 */
function armTask(task, arm) {
  return { ...task, id: task.id, goal: `${task.goal}\n\n${BENCH_GUIDANCE}` };
}
// CHAINED INCREMENTS (dependsOn): the accepted files of the previous unit in the same arm and
// replicate become this unit's seed. Recorded per (arm, rep) as the units complete.
const acceptedFiles = new Map();   // `${arm}|r${rep}|${taskId}` -> { files } of the ACCEPTED workspace
function chainedSeed(task, arm, rep) {
  if (!task.dependsOn) return { ok: true, seed: task.seed };
  const got = acceptedFiles.get(`${arm}|r${rep}|${task.dependsOn}`);
  if (!got) return { ok: false, reason: `prerequisite ${task.dependsOn} was not accepted in this arm/replicate` };
  return { ok: true, seed: got.files };
}

/** The diagnostic the Hub runs FOR the model. Null in control - nothing is delivered there. */
function armDiagnostic(task, arm) {
  if (arm === 'CONTROL') return null;
  if (task.diagnostic) {
    return { ...task.diagnostic, ...(arm === 'NOTIFY' ? { mode: 'summary' } : {}), ...(arm === 'INIT_ONLY' ? { afterEditMode: 'silent' } : {}), ...(arm === 'INIT_COUNTS' ? { afterEditMode: 'summary' } : {}) };
  }
  return {
    moduleName: task.id.replace(/^ext-/, ''), casesJsonl: task.requested.files['cases.jsonl'],
    // NOTIFY: the same diagnostic, the same delivery points, counts only. See autodiag.js.
    ...(arm === 'NOTIFY' ? { mode: 'summary' } : {}),
    ...(arm === 'INIT_ONLY' ? { afterEditMode: 'silent' } : {}),
    ...(arm === 'INIT_COUNTS' ? { afterEditMode: 'summary' } : {}),
  };
}

/** Graded case counts from the evaluator's own runner output ("OK 9/9" / "FAILED 2/9"). */
const casesFrom = (part) => {
  const m = String(part?.out || '').match(/(?:OK|FAILED) (\d+)\/(\d+)/);
  return m ? { pass: +m[1], total: +m[2] } : { pass: null, total: null };
};

/** Case measurement for either task kind: the declared play, or the pristine case runner. */
async function measureCases(t, dir) {
  if (t.requested?.play) {
    const { playCheck } = await import('./playCheck.js');
    const r = await playCheck(dir, t.requested.play.spec, { timeoutMs: 90_000 });
    if (r.status !== 'OK') return { passing: new Set(), failing: new Set(), total: null, error: r.reason || 'play unavailable' };
    return { passing: r.passing, failing: r.failing, total: r.total, error: null, exact: true };
  }
  const name = t.id.replace(/^ext-/, '');
  return caseSet(dir, name, t.requested.files['cases.jsonl']);
}

/** The seed's own baseline, measured once per task, before any model runs. */
const baseline = new Map();
async function measureBaselines() {
  for (const t of BASE) {
    const dir = mkdtempSync(join(tmpdir(), 'tc1-base-'));
    for (const [f, body] of Object.entries(t.seed)) writeFileSync(join(dir, f), body, 'utf8');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const ex = promisify(execFile);
    await ex('git', ['-C', dir, 'init', '-q'], { windowsHide: true }).catch(() => {});
    await ex('git', ['-C', dir, 'config', 'core.autocrlf', 'false'], { windowsHide: true }).catch(() => {});
    await ex('git', ['-C', dir, 'add', '-A'], { windowsHide: true }).catch(() => {});
    await ex('git', ['-C', dir, '-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '-m', 'seed'], { windowsHide: true }).catch(() => {});
    const cs = await measureCases(t, dir);
    baseline.set(t.id, cs);
    console.log(`  baseline ${t.id}: ${cs.passing.size}/${cs.total} graded cases pass on the seed${cs.error ? ' [' + cs.error + ']' : ''}`);
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

async function runTask(ws, task, ctx) {
  const p = port++;
  const started = Date.now();
  const dbPath = join(ROOT, `hub-${p}.json`);
  writeFileSync(dbPath, JSON.stringify({
    api_keys: { ollama: { base_url: MODEL_URL, model: process.env.PILOT_MODEL || 'mycoder' } },
    history: [], settings: {},
  }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(p), HUB_DB: dbPath, AGENT_WORKSPACE: ws,
      AGENT_RUNS_DIR: join(ROOT, 'runs'), AGENT_TRACES_DIR: join(ROOT, 'traces'),
      AGENT_QUEUE_FILE: join(ROOT, `q-${p}.json`),
      AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1', AGENT_APPROVAL_MODE: 'build',
      ...(currentSeed !== null ? { AGENT_SEED: String(currentSeed) } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${p}/api`;
  const hardStop = Math.min(started + ctx.timeoutSec * 1000, DEADLINE);
  let run = null, aborted = null, runId = null;   // hoisted: the transcript is read after the finally
  const clockJumps = [];

  // THE BOUND MUST HOLD REGARDLESS OF ANY AWAIT. AUTODIAG-1 lost 31 of 60 units because the
  // polling loop only tested its deadline BETWEEN iterations: one await that never settled
  // escaped it entirely and the unit ran 99 minutes. A wall-clock race cannot be escaped by
  // an await that ignores cancellation - the race resolves whether or not the other side does.
  // The timer is CLEARED after the race. Until MECH-1 it was not: every unit left a pending
  // timer of up to per-task + grace seconds, and the campaign process stayed alive after
  // COMPLETE until the last one fired - the ~5-minute "shutdown latency" seen after AUTODIAG-2
  // and the 300s+ exit delay seen after MECH-1. The watchdog made shutdown independent of it;
  // this makes the process exit when it is done.
  let wallTimer = null;
  const wall = new Promise((resolve) => { wallTimer = setTimeout(() => resolve('WALL'), Math.max(1000, hardStop - Date.now()) + UNIT_GRACE_MS); });
  const body = (async () => {
    for (let i = 0; i < 60 && Date.now() < hardStop; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', {
      method: 'POST',
      // The diagnostic spec travels with the start request; the Hub runs it and delivers.
      body: JSON.stringify({ goal: task.goal, budgetSec: ctx.timeoutSec, ...(currentDiagnostic ? { diagnostic: currentDiagnostic } : {}), ...(currentRecovery ? { recovery: currentRecovery } : {}) }),
    });
    if (!start.runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId };
    runId = start.runId;
    // ── FAULT INJECTION, TEST ONLY ────────────────────────────────────────────────────
    // AUTODIAG-1 lost 31 of 60 units to an operation the runner awaited that never settled
    // even after its cancellation fired. That exact backend failure cannot be reproduced on
    // demand, but its RELEVANT CONDITION can be injected: await something that never settles
    // and cannot be cancelled. Everything downstream - the outer wall, SIGKILL, the bounded
    // exit wait, confirmNoneRunning, the explicit halt, the UNATTEMPTED rows and the final
    // report - is the real path, untouched. Off unless the env names a task.
    if (process.env.AUTODIAG_INJECT_HANG_TASK && task.id === process.env.AUTODIAG_INJECT_HANG_TASK) {
      console.log(`   [fault injection] awaiting an operation that will never settle for ${task.id}`);
      await new Promise(() => {});          // never resolves, never rejects, ignores abort
    }
    let lastTick = Date.now();
    while (Date.now() < hardStop) {
      run = await api(base, `/agent/${start.runId}`).catch(() => null);
      // A SLEEPING MACHINE shows up as a jump in wall clock between two iterations that should
      // be ~2s apart. Timers do not run while asleep, so the outer wall cannot fire; the jump
      // is recorded so the unit's elapsed time is not mistaken for model work.
      const now = Date.now();
      if (now - lastTick > 60_000) clockJumps.push({ at: new Date(now).toISOString(), jumpSec: Math.round((now - lastTick) / 1000) });
      lastTick = now;
      if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      aborted = Date.now() >= DEADLINE ? 'total budget' : 'per-task limit';
      await api(base, `/agent/${start.runId}/stop`, { method: 'POST' }).catch(() => null);
      for (let i = 0; i < 30 && Date.now() < hardStop + UNIT_GRACE_MS; i++) {
        run = await api(base, `/agent/${start.runId}`).catch(() => run);
        if (run && run.finalizedAt && !run.busy) break;
        await sleep(1000);
      }
    }
    return 'BODY';
  })();

  let wallHit = false;
  try {
    wallHit = (await Promise.race([body, wall])) === 'WALL';
  } catch { /* the body's own errors are handled inside it */ }
  if (wallTimer) clearTimeout(wallTimer);

  // TAKE THE UNIT APART, AND CONFIRM IT. Killing the hub is not evidence that execution
  // stopped: the model's containers outlive their parent. So the process is killed, its exit
  // is awaited under a bound, and the worker is asked to CONFIRM no attempt is still running.
  try { hub.kill('SIGKILL'); } catch { /* best effort */ }
  const exited = await new Promise((resolve) => {
    if (hub.exitCode !== null || hub.signalCode !== null) return resolve(true);
    const t = setTimeout(() => resolve(false), 10_000);
    hub.once('exit', () => { clearTimeout(t); resolve(true); });
  });
  const stopped = await confirmNoneRunning({ timeoutMs: 30_000 }).catch((e) => ({ ok: false, reason: String(e.message || e).slice(0, 120) }));

  const elapsed = Math.round((Date.now() - started) / 1000);
  const overran = elapsed - (ctx.timeoutSec + Math.round(UNIT_GRACE_MS / 1000));
  if (wallHit) console.log(`   !! unit hit the hard wall at ${elapsed}s - taken apart by the runner`);
  if (overran > 0) console.log(`   !! unit ran ${overran}s past its bound${clockJumps.length ? ' (wall clock jumped ' + clockJumps.map((j) => j.jumpSec + 's').join('+') + ' - the machine was asleep)' : ''}`);

  // EXPLICIT HALT, never a silent continue. If the process would not die or containers cannot
  // be confirmed gone, the next unit would start on top of live execution - so it does not.
  if (!exited || !stopped.ok) {
    halted = !exited
      ? `the hub for ${task.id} did not exit after SIGKILL - refusing to start another unit on top of it`
      : `execution could not be confirmed stopped after ${task.id}: ${stopped.reason || 'unconfirmed'}`;
    console.error(`   !! HALTING: ${halted}`);
  }

  // ── the behavioural measures, from the run's own steps, in ORDER ──
  const steps = (run?.steps || []).filter((s) => s.type === 'tool');
  const name = task.id.replace(/^ext-/, '');
  // The TARGET: a module's file, or - for a play task - any tracked game file.
  const isEdit = (s) => /^(edit_file|write_file|append_file)$/.test(s.tool) && (task.requested?.play ? /\.(html|js|mjs|css)$/i.test(String(s.args?.path || '')) : String(s.args?.path || '').includes(`${name}.py`));
  // MATCH EVERY WAY THE RUNNER CAN BE INVOKED, not just the one the guidance suggests.
  // The first version required the literal "run_tests.py" and therefore MISSED
  // `import run_tests; run_tests.main()` - which is how the model actually reached it in the
  // mergesort unit of the first live run. That produced commandInvoked=0 with
  // feedbackDelivered=true, an internally inconsistent pair that exposed the gap. A bare
  // module reference counts: what is being measured is "did the supplied runner execute",
  // not "did it type the documented command".
  const ranCommand = (s) => /^(run_python|run_command)$/.test(s.tool)
    && /\brun_tests\b/.test(JSON.stringify(s.args || ''));
  // A FAILING OBSERVATION: any executed test whose output carries a failure signal.
  const isFailingTest = (s) => /^(run_python|run_command)$/.test(s.tool)
    && /(FAIL|ERROR|Traceback|EXPECTED|FAILED \d+\/)/.test(String(s.result || ''));
  let editAfterFailure = false, sawFailure = false;
  for (const s of steps) {
    if (isFailingTest(s)) sawFailure = true;
    else if (sawFailure && isEdit(s)) { editAfterFailure = true; break; }
  }
  // ── DID THE FEEDBACK ACTUALLY REACH THE MODEL? ──
  // Invoking the command is not the same as being fed its result. This Hub has already
  // shipped a defect where a warning was generated and then substituted away before it was
  // sent, so "the tool ran" is not evidence about what the next request contained. The
  // transcript's `sent` field is the per-turn delta - the messages new since the model last
  // spoke - so the runner's output having reached a LATER request is readable directly.
  let feedbackDelivered = false;
  // WHAT THE ARM ACTUALLY SAW, counted from the transcript rather than assumed from the arm
  // name: how many diagnostic messages reached a request, and how many case-detail lines.
  // CONTROL must see none of either; NOTIFY must see messages but no case lines.
  let diagnosticMessagesSeen = 0, caseDetailLinesSeen = 0, afterEditCaseLinesSeen = 0;
  try {
    const tpath = join(ROOT, 'runs', `${runId}.transcript.jsonl`);
    if (runId && existsSync(tpath)) {
      const lines = readFileSync(tpath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } });
      // MATCH THE DELIVERED RESULT, NOT THE SOURCE CODE. The first version also matched
      // "FIRST FAILING CASE:", which appears verbatim inside run_tests.py itself - and the
      // supplied-file feature inlines that file into the opening context, because the new
      // guidance names it. So delivery read TRUE on a run whose command never executed.
      // Caught by the fake-backend smoke test, before any spend. A delivered result is
      // identified by its TOOL RESULT framing plus a NUMERIC summary line; neither appears
      // in the runner source, which carries %d placeholders.
      // DELIVERY HERE IS THE AUTOMATIC DIAGNOSTIC REACHING A REQUEST. Running it is the Hub's
      // job now, so "did the model invoke a command" is not the question; "did the result get
      // into the prompt" still is - this Hub has shipped a defect where a message was
      // generated and then substituted away before it was sent.
      feedbackDelivered = lines.some((e) => e && e.kind === 'turn' && Array.isArray(e.sent)
        && e.sent.some((msg) => /^AUTOMATIC DIAGNOSTIC/.test(String(msg?.content || ''))));
      for (const e of lines) {
        if (!e || e.kind !== 'turn' || !Array.isArray(e.sent)) continue;
        for (const msg of e.sent) {
          const c = String(msg?.content || '');
          if (/^AUTOMATIC DIAGNOSTIC/.test(c)) {
            diagnosticMessagesSeen++;
            const lines = (c.match(/^ {2}(FAIL|ERROR) case \d+ /gm) || []).length;
            caseDetailLinesSeen += lines;
            if (diagnosticMessagesSeen > 1) afterEditCaseLinesSeen += lines;
          }
        }
      }
    }
  } catch { /* evidence, never a reason to fail the unit */ }

  const calls = Array.isArray(run?.callStats) ? run.callStats : [];
  return {
    feedbackDelivered, diagnosticMessagesSeen, caseDetailLinesSeen, afterEditCaseLinesSeen,
    diagnosticsMeasuredSilently: (run?.diagnostics || []).filter((d) => !d.skipped && d.delivered === false).length,
    // THE CONTROLLER'S OWN ACCOUNT, from the run record: what it decided, whether every
    // restore was byte-exact, and whether it stopped the run. Compared with acceptance below.
    recovery: run?.recovery ? {
      enabled: !!run.recovery.enabled, state: run.recovery.state || null,
      attempts: run.recovery.attempts ?? 0, repeats: run.recovery.repeats ?? 0, provisionals: run.recovery.provisionals ?? 0,
      rejected: (run.recovery.rejected || []).length,
      decisions: (run.recovery.decisions || []).map((d) => d.action),
      restores: (run.steps || []).filter((s) => s.type === 'recovery' && /^(RESTORE|DISCARD|REPEAT)$/.test(s.action)).length,
      restoresExact: (run.steps || []).filter((s) => s.type === 'recovery' && /^(RESTORE|DISCARD|REPEAT)$/.test(s.action) && s.restoredExact === true).length,
      stoppedByController: (run.steps || []).some((s) => s.type === 'error' && /recovery controller/.test(String(s.text || ''))),
      verifiedSha: run.recovery.verified?.sha256 || null,
    } : null,
    seedSent: currentSeed, samplingRecorded: run?.sampling ?? null,
    clockJumps,
    status: 'COMPLETED', ok: true, exit: 0, timedOut: !!aborted, attemptId: ctx.attemptId,
    runId,   // THE join key. Task names are not one when a task is replicated (linkRuns.js).
    // OPERATIONAL RELIABILITY, recorded per unit and reported beside productivity.
    hitHardWall: wallHit, hubExited: exited, executionConfirmedStopped: !!stopped.ok,
    overranBySec: Math.max(0, overran),
    // Reported SEPARATELY from repairs. More delivered feedback is not a win.
    diagnosticsDelivered: (run?.diagnostics || []).filter((d) => !d.skipped).length,
    diagnosticsSkipped: (run?.diagnostics || []).filter((d) => d.skipped).length,
    diagnosticsUnavailable: (run?.diagnostics || []).filter((d) => d.status && d.status !== 'OK').length,
    elapsedSec: Math.round((Date.now() - started) / 1000),
    terminationReason: aborted || run?.status || 'ended',
    modelCalls: calls.length,
    tokens: calls.reduce((a, c) => a + (c.outTok || 0) + (c.promptTok || 0), 0),
    toolExecutions: steps.length,
    unconfirmedRemoteCalls: run?.unconfirmedRemoteCalls || 0,
    editsOnTarget: steps.filter(isEdit).length,
    commandInvoked: steps.filter(ranCommand).length,
    sawFailingTest: sawFailure,
    editAfterFailure,
  };
}

console.log(`${EXPERIMENT} START ${stamp()} hub ${process.env.AUTODIAG_HUB_COMMIT || 'unrecorded'}${RESUMING ? ' (RESUMED)' : ''}`);
// Publish the root for a supervisor that may need to resume this campaign after a crash.
if (process.env.AUTODIAG_ROOT_FILE) { try { writeFileSync(process.env.AUTODIAG_ROOT_FILE, ROOT, 'utf8'); } catch { /* best effort */ } }
console.log(`model: ${MODEL_URL}`);
console.log(`worker: ${WORKER_IMAGE}`);
console.log(`arms (identical seed + guidance in every arm): ${ARMS.map((a) => `${a} = ${ARM_DESC[a]}`).join(' | ')}`);
console.log(`seeds: ${SEEDS.length ? SEEDS.join(',') : 'none sent (backend default)'}   order: arm order for task index ti in replicate r starts at (ti + r - 1) mod ${ARMS.length}`);
console.log(`queue: ${BASE.length} tasks x ${ARMS.length} arms x ${REPS} replicate(s) = ${BASE.length * ARMS.length * REPS} units`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, no retries\n`);

console.log('measuring seed baselines (no model involved):');
await measureBaselines();

// THE PLAN FIRST, as always: anything planned and not recorded is UNACCOUNTED. On a resume the
// plan already stands; the units already recorded are read back and skipped.
const ALREADY = new Set();
if (RESUMING) {
  for (const line of readFileSync(SUMMARY, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(line); if (r.kind === 'run' && r.state !== 'UNATTEMPTED') ALREADY.add(r.task); } catch { /* skip */ }
  }
  console.log(`RESUMING ${ROOT}: ${ALREADY.size} unit(s) already recorded will be skipped`);
} else {
  recordPlan(SUMMARY, BASE.flatMap((t) => Array.from({ length: REPS }, (_, r) =>
    ARMS.map((a) => `${t.id}@${a}r${r + 1}`)).flat()));
}
let idxBase = 0;
if (RESUMING) idxBase = ALREADY.size;

let idx = 0;
const rows = [];
// onTaskEnd is called SYNCHRONOUSLY by the batch and is not awaited, so the case measurement
// (which runs a container) cannot live there - it would race the batch's own cleanup. The
// raw result is captured here and measured after runBatch returns.
const pending = [];
const capture = () => (r) => { pending.push(r); };

async function recordUnit(r, arm, rep, wsDir, { position = null, workspaceFresh = null } = {}) {
  // FAULT INJECTION, TEST ONLY: post-processing that never returns, after unit N - EVAL-1's
  // failure condition (an unbounded docker wait in case measurement). Everything downstream -
  // the campaign wall, the UNATTEMPTED rows, the report, the exit code - is the real path.
  if (process.env.AUTODIAG_INJECT_HANG_IN_RECORD && idx + 1 >= parseInt(process.env.AUTODIAG_INJECT_HANG_IN_RECORD, 10) && !process.env.AUTODIAG_ROOT) {
    console.log(`   [fault injection] post-processing of unit ${idx + 1} will never return`);
    await new Promise(() => {});
  }
  const b = baseline.get(r.task) || { passing: new Set(), failing: new Set(), total: null };
  const name = String(r.task).replace(/^ext-/, '');
  const taskDef = BASE.find((t) => t.id === r.task) || {};
  // WHERE THE CANDIDATE IS. A run whose protected behaviour broke has been rolled back, so
  // the workspace now holds the seed; acceptance kept a full copy of what the model produced.
  // Measuring the workspace there would score every restored run as "did nothing" and hide
  // the edits it actually made. Regressions are reported separately, so nothing is
  // double-credited.
  const candidateDir = r.acceptance?.capturedAt || wsDir;
  let after = { passing: new Set(), failing: new Set(), total: null, error: 'not measured' };
  try { if (candidateDir && existsSync(candidateDir)) after = await measureCases(taskDef, candidateDir); }
  catch (e) { after = { passing: new Set(), failing: new Set(), total: null, error: String(e.message || e).slice(0, 120) }; }
  const { newlyPassing, newlyFailing } = caseDiff(b, after);
  const row = {
    idx: ++idx, rep, task: `${r.task}@${arm}r${rep}`, arm,
    runId: r.outcome?.runId ?? null,
    // DESIGN PROVENANCE on the row: where this arm sat in the task's order, which sampling
    // seed was sent, and whether the workspace was fresh before the unit started.
    position, seedSent: r.outcome?.seedSent ?? null, samplingRecorded: r.outcome?.samplingRecorded ?? null,
    workspaceFresh,
    clockJumps: r.outcome?.clockJumps ?? [],
    clockJumpSec: (r.outcome?.clockJumps || []).reduce((a, j) => a + j.jumpSec, 0),
    // ISOLATION, measured: what the transcript shows this arm was actually sent.
    diagnosticMessagesSeen: r.outcome?.diagnosticMessagesSeen ?? null,
    caseDetailLinesSeen: r.outcome?.caseDetailLinesSeen ?? null,
    afterEditCaseLinesSeen: r.outcome?.afterEditCaseLinesSeen ?? null,
    diagnosticsMeasuredSilently: r.outcome?.diagnosticsMeasuredSilently ?? 0,
    recovery: r.outcome?.recovery ?? null,
    // AN UNVERIFIED PROVISIONAL CANDIDATE MUST NEVER BE DELIVERED AS ACCEPTED. RETAIN comes
    // from the independent evaluator; if the controller never reached ACCEPT and the unit is
    // RETAIN, either the evaluator and the diagnostic disagree or something delivered an
    // unverified state - flagged on the row either way, never silently counted.
    provisionalDeliveredAsAccepted: !!(r.outcome?.recovery?.enabled && r.acceptance?.countsAsCompletion && r.outcome.recovery.state !== 'ACCEPTED'),
    controllerAcceptNotRetained: !!(r.outcome?.recovery?.enabled && r.outcome.recovery.state === 'ACCEPTED' && !r.acceptance?.countsAsCompletion),
    isolationOk: r.outcome ? (
      arm === 'CONTROL' ? (r.outcome.diagnosticMessagesSeen === 0)
        : arm === 'NOTIFY' ? (r.outcome.caseDetailLinesSeen === 0)
          : arm === 'INIT_ONLY' ? (r.outcome.diagnosticMessagesSeen <= 1)
            : arm === 'INIT_COUNTS' ? (r.outcome.afterEditCaseLinesSeen === 0)
              : true) : null,
    termination: r.termination || r.state,
    requested: r.verdict?.requested?.verdict ?? null,
    // A task with NO protected spec (an increment built from nothing) owes no protected verdict:
    // NOT_SPECIFIED is a value, not a gap, so the report's integrity check reads it as present.
    protected: r.verdict?.protected?.verdict ?? (taskDef.protected ? null : 'NOT_SPECIFIED'),
    disposition: r.acceptance?.disposition ?? r.state,
    accepted: !!r.acceptance?.countsAsCompletion,
    reason: r.reason ?? null,
    candidateTree: r.acceptance?.candidateVerdict?.candidateTree ?? null,
    survivingTree: r.acceptance?.survivingWorkspaceVerdict?.candidateTree ?? null,
    modelCalls: r.outcome?.modelCalls ?? 0,
    tokens: r.outcome?.tokens ?? 0,
    elapsedSec: r.outcome?.elapsedSec ?? 0,
    toolExecutions: r.outcome?.toolExecutions ?? 0,
    unconfirmedRemoteCalls: r.outcome?.unconfirmedRemoteCalls ?? 0,
    editsOnTarget: r.outcome?.editsOnTarget ?? 0,
    commandInvoked: r.outcome?.commandInvoked ?? 0,
    sawFailingTest: !!r.outcome?.sawFailingTest,
    editAfterFailure: !!r.outcome?.editAfterFailure,
    feedbackDelivered: !!r.outcome?.feedbackDelivered,
    // OPERATIONAL RELIABILITY on the row itself, not only on the outcome - a field that
    // never reaches the durable summary cannot be reported or asserted. outerDeadline.test
    // caught these arriving as undefined.
    hitHardWall: !!r.outcome?.hitHardWall,
    hubExited: r.outcome?.hubExited ?? null,
    executionConfirmedStopped: r.outcome?.executionConfirmedStopped ?? null,
    overranBySec: r.outcome?.overranBySec ?? 0,
    diagnosticsDelivered: r.outcome?.diagnosticsDelivered ?? 0,
    diagnosticsSkipped: r.outcome?.diagnosticsSkipped ?? 0,
    diagnosticsUnavailable: r.outcome?.diagnosticsUnavailable ?? 0,
    // CASE-LEVEL, per task, never pooled and never netted against each other.
    casesTotal: b.total,
    baselineCasesPass: b.passing.size,
    candidateCasesPass: after.passing.size,
    newlyPassing, newlyFailing,
    caseMeasurementError: after.error || null,
    state: r.state,
  };
  rows.push(row);
  recordRun(SUMMARY, row);
  const gained = newlyPassing.length ? ` +[${newlyPassing.join(',')}]` : '';
  const lost = newlyFailing.length ? ` -[${newlyFailing.join(',')}]` : '';
  console.log(`${String(idx).padStart(3)}. [${arm}] ${r.task} ${r.termination || r.state}`
    + ` req=${row.requested ?? '-'} prot=${row.protected ?? '-'}`
    + ` cases ${b.passing.size}->${after.passing.size}/${b.total ?? '?'}${gained}${lost}`
    + ` edits=${row.editsOnTarget} ${row.disposition}`
    + (arm !== 'CONTROL' ? ` delivered=${row.feedbackDelivered} msgs=${row.diagnosticMessagesSeen} caseLines=${row.caseDetailLinesSeen}` : '')
    + (row.isolationOk === false ? '  !! ISOLATION VIOLATED' : '')
    + (row.recovery ? ` ctl=${row.recovery.state} ${row.recovery.decisions.join('>') || '-'} restores=${row.recovery.restoresExact}/${row.recovery.restores}` : '')
    + (row.provisionalDeliveredAsAccepted ? '  !! PROVISIONAL DELIVERED AS ACCEPTED' : '')
    + (row.controllerAcceptNotRetained ? '  !! CONTROLLER ACCEPT NOT RETAINED' : ''));
}

// Every planned unit, in the order it would run. Anything still here at the end never started.
const REMAINING = new Set();
for (let rep = 1; rep <= REPS; rep++) for (const t of BASE) for (const a of ARMS) if (!ALREADY.has(`${t.id}@${a}r${rep}`)) REMAINING.add(`${t.id}@${a}r${rep}`);
idx = idxBase;

// THE CAMPAIGN WALL, armed BEFORE the loop: deadline + one unit's bound + grace + a minute.
// If it fires, whatever is still awaited is abandoned, the account is written by
// finalizeCampaign (declared below; function declarations hoist), and the process exits 3 so a
// supervisor can tell the wall from completion. Cleared by a normal finish.
let finalized = false;
// Registered here, not after the loop: a handler after the loop is never reached when the
// loop hangs, and the EXIT line is exactly what a supervisor reads then.
process.on('exit', (code) => console.log(`${EXPERIMENT} EXIT ${stamp()} code ${code}`));
const CAMPAIGN_WALL_MS = Math.max(5_000, DEADLINE - Date.now()) + PER_TASK_SEC * 1000 + UNIT_GRACE_MS + 60_000;
const campaignWall = setTimeout(async () => {
  await finalizeCampaign(`the campaign wall clock (${Math.round(CAMPAIGN_WALL_MS / 1000)}s from start) hit while work was still in flight - a unit or its post-processing did not return`);
  process.exit(3);
}, CAMPAIGN_WALL_MS);

outer:
for (let rep = 1; rep <= REPS; rep++) {
  for (let ti = 0; ti < BASE.length; ti++) {
    if (halted) { console.error(`halted: ${halted}`); break outer; }
    if (Date.now() >= DEADLINE) { console.log('deadline reached; remaining units are UNATTEMPTED'); break outer; }
    const task = BASE[ti];
    // COUNTERBALANCED ORDER: a rotation of the arm list that advances with the task index and
    // the replicate, so every arm runs first (and last) equally often across the campaign.
    // With two arms this is exactly the earlier alternation.
    const rot = (ti + rep - 1) % ARMS.length;
    const order = ARMS.slice(rot).concat(ARMS.slice(0, rot));
    for (const arm of order) {
      if (halted || Date.now() >= DEADLINE) break outer;
      if (ALREADY.has(`${task.id}@${arm}r${rep}`)) continue;     // resumed: already recorded
      const wsDir = join(ROOT, `ws-${arm}-r${rep}`);
      currentDiagnostic = armDiagnostic(task, arm);
      currentSeed = seedFor(rep);
      const chained = chainedSeed(task, arm, rep);
      if (!chained.ok) {
        // BLOCKED, never attempted from a seed: running it from an empty seed would silently
        // turn a chain into independent tasks. Its own row says why.
        const key = `${task.id}@${arm}r${rep}`;
        REMAINING.delete(key);
        const row = { idx: ++idx, rep, task: key, arm, termination: 'BLOCKED', state: 'BLOCKED', disposition: 'BLOCKED', accepted: false, reason: chained.reason, requested: null, protected: null, position: order.indexOf(arm) };
        rows.push(row); recordRun(SUMMARY, row);
        console.log(`${String(idx).padStart(3)}. [${arm}] ${task.id} BLOCKED - ${chained.reason}`);
        continue;
      }
      currentRecovery = arm === 'RECOVERY_ARM' ? RECOVERY_POLICY : null;
      const position = order.indexOf(arm);
      const workspaceFresh = !existsSync(join(wsDir, task.id));
      pending.length = 0;
      // dependsOn is resolved HERE (seed from the previous accepted workspace); the batch's own
      // per-call chain logic must not see it, or it blocks the unit for lacking a prerequisite
      // inside a one-task batch.
      await runBatch([{ ...armTask(task, arm), seed: chained.seed, dependsOn: null }], {
        journalPath: join(ROOT, `journal-${arm}-r${rep}.jsonl`),
        workspacesDir: wsDir,
        auditDir: join(ROOT, 'audit'),
        perTaskSec: PER_TASK_SEC,
        totalSec: Math.max(1, Math.round((DEADLINE - Date.now()) / 1000)),
        chain: false,
        onTaskEnd: capture(),
        runTask,
      });
      // Measured HERE, after the batch has finished with the workspace.
      for (const r of pending) {
        const key = `${r.task}@${arm}r${rep}`;
        REMAINING.delete(key);
        inFlight = { key, arm, rep, since: Date.now() };
        await recordUnit(r, arm, rep, join(wsDir, r.task), { position, workspaceFresh });
        inFlight = null;
        // The ACCEPTED workspace of a chained task feeds the next increment.
        if (r.acceptance?.countsAsCompletion && task.requested?.play) {
          try { const { gameSnapshot } = await import('./autodiag.js'); const snap = gameSnapshot(join(wsDir, r.task)); acceptedFiles.set(`${arm}|r${rep}|${task.id}`, { files: snap.files }); console.log(`     chain: ${task.id} accepted - ${snap.count} tracked file(s) carried to the next increment (sha ${snap.sha256.slice(0, 12)})`); }
          catch (e) { console.error(`     chain: could not snapshot the accepted workspace of ${task.id}: ${e.message}`); }
        }
      }
      // FAULT INJECTION, TEST ONLY: die the way OVERNIGHT-1 attempt 1 died - silently, with
      // exit 127, right after a unit was recorded - so the resume path can be proven.
      if (process.env.AUTODIAG_INJECT_EXIT_AFTER_UNIT && idx >= parseInt(process.env.AUTODIAG_INJECT_EXIT_AFTER_UNIT, 10)) {
        console.log(`   [fault injection] exiting 127 after unit ${idx}`);
        process.exit(127);
      }
    }
  }
}

// FINALIZATION, callable from the normal end of the loop OR from the campaign wall below.
// EVAL-1 hung for two hours in a unit's post-processing (an unbounded docker wait in case
// measurement): the per-unit wall covers the unit, not what the runner does after it, and the
// campaign deadline was only tested between units. This timer fires regardless, writes every
// unexecuted unit as UNATTEMPTED with the reason, reports, and exits.
async function finalizeCampaign(wallReason) {
  if (finalized) return;
  finalized = true;
  if (wallReason) { halted = halted || wallReason; console.error(`   !! CAMPAIGN WALL: ${wallReason}`); }
  // A unit taken out of the queue whose row was never written: it ran, and its post-processing
  // did not return. It is INTERRUPTED with that reason - never silently missing.
  if (wallReason && inFlight) {
    const row = {
      idx: ++idx, rep: inFlight.rep, task: inFlight.key, arm: inFlight.arm, termination: 'INTERRUPTED', state: 'INTERRUPTED',
      disposition: 'INTERRUPTED', accepted: false, requested: null, protected: null,
      reason: `post-processing did not return within the campaign wall (in flight ${Math.round((Date.now() - inFlight.since) / 1000)}s): ${wallReason}`,
    };
    rows.push(row); recordRun(SUMMARY, row);
    inFlight = null;
  }
// EVERY UNEXECUTED QUEUE ENTRY GETS ITS OWN ROW, with the reason it never ran. Without this
// they appear only as UNACCOUNTED in the reconciliation - a true signal, but not an account.
for (const key of REMAINING) {
  const [task, tail] = key.split('@');
  // (An earlier version of these two regexes had lost their backslashes - /rd+$/ - so an
  // UNATTEMPTED row carried arm "AUTODIAG_ARMr1" and rep 0. No live campaign wrote such a
  // row: AUTODIAG-1 predates UNATTEMPTED rows and AUTODIAG-2 had none. outerDeadline.test
  // now asserts the parse.)
  const arm = tail.replace(/r\d+$/, ''), rep = +(tail.match(/r(\d+)$/) || [0, 0])[1];
  const row = {
    idx: ++idx, rep, task: key, arm, termination: 'UNATTEMPTED', state: 'UNATTEMPTED',
    disposition: 'UNATTEMPTED', accepted: false,
    reason: halted ? `never started: ${halted}` : 'never started: the campaign wall clock expired first',
    requested: null, protected: null,
  };
  rows.push(row);
  recordRun(SUMMARY, row);
}
if (REMAINING.size) console.log(`
${REMAINING.size} planned unit(s) never started - each recorded as UNATTEMPTED with its reason`);

const elapsedSec = Math.round((Date.now() - T0) / 1000);
const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

const REPORT_PATH = join(ROOT, `${EXPERIMENT}_REPORT.json`);
const report = writeReport(SUMMARY, REPORT_PATH, {
  experiment: EXPERIMENT,
  comparisonArm: ARMS.map((a) => `${a}: ${ARM_DESC[a]}`).join(' | '),
  label: 'REPAIR WITH SUPPLIED TEST RESULTS - the diagnostic runs the graded cases; not held-out generalization',
  config: {
    model: MODEL_URL, workerImage: WORKER_IMAGE, hubCommit: process.env.AUTODIAG_HUB_COMMIT || 'unrecorded',
    workerIsolation: true, routeBounding: true, acceptance: true, d2: false, protocolController: false,
    perTaskSec: PER_TASK_SEC, totalSec: TOTAL_SEC, replicates: REPS, retries: 'none',
    arms: ARMS, seeds: SEEDS.length ? SEEDS : 'none sent (backend default)',
    order: `arm order for task index ti in replicate r is the arm list rotated by (ti + r - 1) mod ${ARMS.length}`,
    armDifference: 'ONLY the diagnostic spec attached to the start request (none / counts only / full result). Seed files, guidance, model, sampling, worker and acceptance are identical in every arm.',
  },
  elapsedSec,
  noActiveWorkLeftBehind: stopped.ok,
  root: ROOT,
});

const arm = (a) => rows.filter((r) => r.arm === a);
const sum = (xs, f) => xs.reduce((n, x) => n + (f(x) || 0), 0);
const summarise = (a) => {
  const g = arm(a);
  const measured = g.filter((r) => !r.caseMeasurementError);
  return {
    runs: g.length,
    // OUTCOME FIRST, always. Case movement never appears without it.
    verifiedRepairs: g.filter((r) => r.accepted).length,
    dispositions: g.reduce((acc, r) => (acc[r.disposition] = (acc[r.disposition] || 0) + 1, acc), {}),
    regressionsProduced: g.filter((r) => r.protected === 'FAIL').length,
    regressionsSurviving: g.filter((r) => r.disposition === 'RESTORE_FAILED').length,
    // CASE MOVEMENT: runs, not pooled cases. The tasks carry 5-12 cases each, so a summed
    // case count weights the wide tasks; a count of RUNS does not. Gains and losses are
    // reported apart, and a run can appear in both.
    runsWithNewlyPassing: measured.filter((r) => r.newlyPassing?.length).length,
    runsWithNewlyFailing: measured.filter((r) => r.newlyFailing?.length).length,
    runsWithBoth: measured.filter((r) => r.newlyPassing?.length && r.newlyFailing?.length).length,
    runsAllCasesPassing: measured.filter((r) => r.casesTotal && r.candidateCasesPass === r.casesTotal).length,
    caseMeasurementErrors: g.length - measured.length,
    // ACTION
    editsOnTarget: sum(g, (r) => r.editsOnTarget),
    runsThatEdited: g.filter((r) => r.editsOnTarget > 0).length,
    sawFailingTest: g.filter((r) => r.sawFailingTest).length,
    editAfterFailure: g.filter((r) => r.editAfterFailure).length,
    // DELIVERY - last, and only meaningful for the treatment arm.
    // DELIVERED FEEDBACK - reported separately, never counted as a win on its own.
    runsWithDiagnosticDelivered: g.filter((r) => r.feedbackDelivered).length,
    diagnosticsDelivered: sum(g, (r) => r.diagnosticsDelivered),
    diagnosticsSkippedForBudget: sum(g, (r) => r.diagnosticsSkipped),
    diagnosticsUnavailable: sum(g, (r) => r.diagnosticsUnavailable),
  };
};

console.log(`report written ${stamp()}: ${REPORT_PATH}`);
console.log(`\n=== ${EXPERIMENT} RESULT ===`);
console.log(`elapsed ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s of ${Math.round(TOTAL_SEC / 60)}m`);
console.log(`stopped cleanly: ${stopped.ok ? 'YES' : 'NO - ' + stopped.reason}`);
console.log(`integrity ${report.integrity.ok}  reconciliation ${report.reconciliation.ok}`);
console.log(`status ${JSON.stringify(report.byStatus)}`);
console.log('\nLABEL: repair with SUPPLIED tests. The exposed cases are the graded cases.');
const armSummaries = Object.fromEntries(ARMS.map((a) => [a, summarise(a)]));
for (const a of ARMS) console.log(`\n${a.padEnd(13)} ${JSON.stringify(armSummaries[a], null, 1)}`);
const violations = rows.filter((r) => r.isolationOk === false);
console.log(`\nisolation: ${violations.length ? 'VIOLATED in ' + violations.map((r) => r.task).join(', ') : 'held in every recorded unit'}`);
writeFileSync(join(ROOT, 'arms.json'), JSON.stringify({ ...armSummaries, rows }, null, 2), 'utf8');
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${REPORT_PATH}`);
// COMPLETE, with a clock, and a file for the watchdog. Written BEFORE the final line so a
// reader of the file never sees "complete" that the log does not also show.
const done = { experiment: EXPERIMENT, completedAt: stamp(), elapsedSec, integrity: report.integrity.ok, root: ROOT };
try { writeFileSync(join(ROOT, `${EXPERIMENT}_DONE`), JSON.stringify(done) + '\n', 'utf8'); } catch { /* best effort */ }
if (DONE_FILE) { try { writeFileSync(DONE_FILE, JSON.stringify(done) + '\n', 'utf8'); } catch (e) { console.error(`could not write ${DONE_FILE}: ${e.message}`); } }
console.log(`${EXPERIMENT} COMPLETE ${done.completedAt}${wallReason ? ' (HALTED BY THE CAMPAIGN WALL - see UNATTEMPTED rows)' : ''}`);
}
// THE CAMPAIGN WALL: deadline + one unit's bound + grace + a minute, armed now, cleared by a
// normal finish. If it fires, whatever is still awaited is abandoned, the account is written,
// and the process exits 3 so a supervisor can see it was the wall, not completion.
await finalizeCampaign(null);
clearTimeout(campaignWall);
