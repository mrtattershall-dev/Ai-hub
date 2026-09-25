/**
 * testcmd1.mjs - TESTCMD-1: current guidance vs a SUPPLIED TEST PACKAGE.
 *
 * THE TREATMENT IS A PACKAGE, NOT A COMMAND: the graded cases, plus a runner that reports
 * them case by case, plus two sentences of instruction naming it. A result here is about
 * that whole bundle. It cannot say which part carried the effect - separating the cases from
 * the runner from the instruction would need three more arms, which this does not have.
 *
 *   node server/testcmd1.mjs <modelBaseUrl>
 *
 * ONE DIFFERENCE BETWEEN THE ARMS, and it is declared here:
 *
 *   CONTROL        the task seed exactly as BENCH-1/2/3 ran it (the buggy module alone),
 *                  with BENCH_GUIDANCE verbatim.
 *   TEST_PACKAGE   the same seed PLUS the graded cases (task_cases.jsonl), PLUS a runner over
 *                  them (run_tests.py), PLUS two sentences naming it. Nothing else differs:
 *                  same model, sampling, limits, worker, acceptance policy, evaluator, order.
 *
 * THE EXPOSED CASES ARE THE GRADED CASES. So a TEST_PACKAGE result is REPAIR WITH SUPPLIED TESTS.
 * It is not evidence of generalization to unseen inputs, and must never be reported as such.
 * (The PROTECTED check remains a subset of those cases, so protected behaviour is not
 * automatically satisfied by passing them - but it is not independent evidence either.)
 *
 * INTERLEAVED, and the order alternates. Arm order flips per task so that a drifting backend
 * cannot advantage one arm systematically - PROTOCOL-1 was run this way for the same reason.
 *
 * WHAT IS MEASURED - the second one is the point, and it is not "did it run the command":
 *
 *   verifiedRepairs      acceptance RETAIN (requested PASS and protected PASS)
 *   newlyPassing /       WHICH graded cases the candidate turned from failing to passing, and
 *   newlyFailing         WHICH it turned from passing to failing - as case numbers, never
 *                        netted against each other. More passing cases can coexist with a
 *                        protected regression, and a net figure hides exactly that. Measured
 *                        on THE CANDIDATE the model produced (a rolled-back run is not scored
 *                        as inert), by a pristine runner on a scratch copy, so a candidate
 *                        that edited its own tests changes nothing here.
 *                        PER TASK ONLY. The tasks carry 5-12 cases each, so a pooled case
 *                        total weights the wide tasks and reads as progress the per-task view
 *                        does not support. verifiedRepairs stays beside these, always.
 *   editsOnTarget        writes that actually targeted the module under test
 *   editAfterFailure     did an edit to the target follow a failing test observation, in order
 *   commandInvoked       (TEST_PACKAGE only) did it run run_tests.py at all
 *   feedbackDelivered    did the runner's OUTPUT actually reach a subsequent model request -
 *                        read from the run's transcript deltas, not inferred from the tool
 *                        call. Invoking a command is not the same as being fed its result:
 *                        this Hub has already shipped one defect where a warning was
 *                        generated and substituted away before it was sent. Without this,
 *                        "invoked but no effect" and "invoked but never delivered" are
 *                        indistinguishable, and only the first is about the model.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { externalTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');
const { testCommandFiles, TEST_COMMAND_GUIDANCE } = await import('./taskTests.js');
const { runBatch } = await import('./batch.js');
const { evaluate } = await import('./evaluator.js');
const { caseSet, caseDiff } = await import('./caseSet.js');
const { recordRun, recordPlan, writeReport } = await import('./campaignReport.js');
const { confirmNoneRunning, WORKER_IMAGE } = await import('./worker.js');

const MODEL_URL = process.argv[2];
if (!MODEL_URL) { console.error('usage: node server/testcmd1.mjs <modelBaseUrl>'); process.exit(2); }

const PER_TASK_SEC = 300;
const TOTAL_SEC = parseInt(process.env.TESTCMD_TOTAL_SEC || String(3 * 60 * 60), 10);
const REPS = Math.max(1, parseInt(process.env.TESTCMD_REPS || '2', 10));
const RESERVE_SEC = 180;
const T0 = Date.now();
const DEADLINE = T0 + (TOTAL_SEC - RESERVE_SEC) * 1000;

const ROOT = mkdtempSync(join(tmpdir(), 'testcmd1-'));
const SUMMARY = join(ROOT, 'summary.jsonl');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = 41200;

const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

// A frozen subset by id, for smoke tests and for re-running a named task. Empty = all 15.
const ONLY = String(process.env.TESTCMD_TASK_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
const BASE = externalTasks().filter((t) => !ONLY.length || ONLY.includes(t.id));
if (ONLY.length && BASE.length !== ONLY.length) { console.error(`TESTCMD_TASK_IDS named ${ONLY.length} but ${BASE.length} matched`); process.exit(2); }

/** A task as one arm presents it. The ONLY differences are seed files and two sentences. */
function armTask(task, arm) {
  const name = task.id.replace(/^ext-/, '');
  if (arm === 'CONTROL') return { ...task, id: task.id, goal: `${task.goal}\n\n${BENCH_GUIDANCE}` };
  const cases = task.requested.files['cases.jsonl'];
  return {
    ...task,
    id: task.id,
    seed: { ...task.seed, ...testCommandFiles(name, cases) },
    goal: `${task.goal}\n\n${BENCH_GUIDANCE} ${TEST_COMMAND_GUIDANCE}`,
  };
}

/** Graded case counts from the evaluator's own runner output ("OK 9/9" / "FAILED 2/9"). */
const casesFrom = (part) => {
  const m = String(part?.out || '').match(/(?:OK|FAILED) (\d+)\/(\d+)/);
  return m ? { pass: +m[1], total: +m[2] } : { pass: null, total: null };
};

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
    const name = t.id.replace(/^ext-/, '');
    const cs = await caseSet(dir, name, t.requested.files['cases.jsonl']);
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${p}/api`;
  const hardStop = Math.min(started + ctx.timeoutSec * 1000, DEADLINE);
  let run = null, aborted = null, runId = null;   // hoisted: the transcript is read after the finally
  try {
    for (let i = 0; i < 60 && Date.now() < hardStop; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', {
      method: 'POST', body: JSON.stringify({ goal: task.goal, budgetSec: ctx.timeoutSec }),
    });
    if (!start.runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId };
    runId = start.runId;
    while (Date.now() < hardStop) {
      run = await api(base, `/agent/${start.runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      aborted = Date.now() >= DEADLINE ? 'total budget' : 'per-task limit';
      await api(base, `/agent/${start.runId}/stop`, { method: 'POST' }).catch(() => null);
      for (let i = 0; i < 60; i++) {
        run = await api(base, `/agent/${start.runId}`).catch(() => run);
        if (run && run.finalizedAt && !run.busy) break;
        await sleep(1000);
      }
    }
  } finally {
    try { hub.kill('SIGKILL'); } catch { /* best effort */ }
  }

  // ── the behavioural measures, from the run's own steps, in ORDER ──
  const steps = (run?.steps || []).filter((s) => s.type === 'tool');
  const name = task.id.replace(/^ext-/, '');
  const isEdit = (s) => /^(edit_file|write_file|append_file)$/.test(s.tool) && String(s.args?.path || '').includes(`${name}.py`);
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
      feedbackDelivered = lines.some((e) => e && e.kind === 'turn' && Array.isArray(e.sent)
        && e.sent.some((msg) => /TOOL RESULT \((?:run_command|run_python)\)[\s\S]{0,4000}?SUMMARY \d+\/\d+ cases pass/
          .test(String(msg?.content || ''))));
    }
  } catch { /* evidence, never a reason to fail the unit */ }

  const calls = Array.isArray(run?.callStats) ? run.callStats : [];
  return {
    feedbackDelivered,
    status: 'COMPLETED', ok: true, exit: 0, timedOut: !!aborted, attemptId: ctx.attemptId,
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

console.log(`TESTCMD-1 START ${new Date().toISOString()} hub ${process.env.TESTCMD_HUB_COMMIT || 'unrecorded'}`);
console.log(`model: ${MODEL_URL}`);
console.log(`worker: ${WORKER_IMAGE}`);
console.log('arms: CONTROL (seed only) vs TEST_PACKAGE (seed + graded cases + runner + instruction)');
console.log(`queue: ${BASE.length} tasks x 2 arms x ${REPS} replicate(s) = ${BASE.length * 2 * REPS} units`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, no retries\n`);

console.log('measuring seed baselines (no model involved):');
await measureBaselines();

// THE PLAN FIRST, as always: anything planned and not recorded is UNACCOUNTED.
recordPlan(SUMMARY, BASE.flatMap((t) => Array.from({ length: REPS }, (_, r) =>
  ['CONTROL', 'TEST_PACKAGE'].map((a) => `${t.id}@${a}r${r + 1}`)).flat()));

let idx = 0;
const rows = [];
// onTaskEnd is called SYNCHRONOUSLY by the batch and is not awaited, so the case measurement
// (which runs a container) cannot live there - it would race the batch's own cleanup. The
// raw result is captured here and measured after runBatch returns.
const pending = [];
const capture = () => (r) => { pending.push(r); };

async function recordUnit(r, arm, rep, wsDir) {
  const b = baseline.get(r.task) || { passing: new Set(), failing: new Set(), total: null };
  const name = String(r.task).replace(/^ext-/, '');
  const cases = (BASE.find((t) => t.id === r.task) || {}).requested?.files['cases.jsonl'] || '';
  // WHERE THE CANDIDATE IS. A run whose protected behaviour broke has been rolled back, so
  // the workspace now holds the seed; acceptance kept a full copy of what the model produced.
  // Measuring the workspace there would score every restored run as "did nothing" and hide
  // the edits it actually made. Regressions are reported separately, so nothing is
  // double-credited.
  const candidateDir = r.acceptance?.capturedAt || wsDir;
  let after = { passing: new Set(), failing: new Set(), total: null, error: 'not measured' };
  try { if (candidateDir && existsSync(candidateDir)) after = await caseSet(candidateDir, name, cases); }
  catch (e) { after = { passing: new Set(), failing: new Set(), total: null, error: String(e.message || e).slice(0, 120) }; }
  const { newlyPassing, newlyFailing } = caseDiff(b, after);
  const row = {
    idx: ++idx, rep, task: `${r.task}@${arm}r${rep}`, arm,
    termination: r.termination || r.state,
    requested: r.verdict?.requested?.verdict ?? null,
    protected: r.verdict?.protected?.verdict ?? null,
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
    + (arm === 'TEST_PACKAGE' ? ` cmd=${row.commandInvoked} delivered=${row.feedbackDelivered}` : ''));
}

for (let rep = 1; rep <= REPS; rep++) {
  for (let ti = 0; ti < BASE.length; ti++) {
    if (Date.now() >= DEADLINE) { console.log('deadline reached; remaining units are UNATTEMPTED'); break; }
    const task = BASE[ti];
    // ALTERNATING ORDER: even task index runs CONTROL first, odd runs TEST_PACKAGE first.
    const order = ti % 2 === 0 ? ['CONTROL', 'TEST_PACKAGE'] : ['TEST_PACKAGE', 'CONTROL'];
    for (const arm of order) {
      if (Date.now() >= DEADLINE) break;
      const wsDir = join(ROOT, `ws-${arm}-r${rep}`);
      pending.length = 0;
      await runBatch([armTask(task, arm)], {
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
      for (const r of pending) await recordUnit(r, arm, rep, join(wsDir, r.task));
    }
  }
}

const elapsedSec = Math.round((Date.now() - T0) / 1000);
const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

const report = writeReport(SUMMARY, join(ROOT, 'TESTCMD-1_REPORT.json'), {
  experiment: 'TESTCMD-1',
  comparisonArm: 'CONTROL (current guidance, seed only) vs TEST_PACKAGE (seed + graded cases + run_tests.py + two sentences naming it)',
  label: 'REPAIR WITH SUPPLIED TESTS - the exposed cases ARE the graded cases; not held-out generalization',
  config: {
    model: MODEL_URL, workerImage: WORKER_IMAGE, hubCommit: process.env.TESTCMD_HUB_COMMIT || 'unrecorded',
    workerIsolation: true, routeBounding: true, acceptance: true, d2: false, protocolController: false,
    perTaskSec: PER_TASK_SEC, totalSec: TOTAL_SEC, replicates: REPS, retries: 'none',
    armDifference: 'two seed files (the graded cases, and a runner over them) and two sentences naming the runner. Nothing else. The result is about the PACKAGE; it cannot attribute an effect to any one part.',
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
    commandInvoked: g.filter((r) => r.commandInvoked > 0).length,
    feedbackDelivered: g.filter((r) => r.feedbackDelivered).length,
    invokedButNotDelivered: g.filter((r) => r.commandInvoked > 0 && !r.feedbackDelivered).length,
  };
};

console.log('\n=== TESTCMD-1 RESULT ===');
console.log(`elapsed ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s of ${Math.round(TOTAL_SEC / 60)}m`);
console.log(`stopped cleanly: ${stopped.ok ? 'YES' : 'NO - ' + stopped.reason}`);
console.log(`integrity ${report.integrity.ok}  reconciliation ${report.reconciliation.ok}`);
console.log(`status ${JSON.stringify(report.byStatus)}`);
console.log('\nLABEL: repair with SUPPLIED tests. The exposed cases are the graded cases.');
console.log(`\nCONTROL       ${JSON.stringify(summarise('CONTROL'), null, 1)}`);
console.log(`TEST_PACKAGE  ${JSON.stringify(summarise('TEST_PACKAGE'), null, 1)}`);
writeFileSync(join(ROOT, 'arms.json'), JSON.stringify({ CONTROL: summarise('CONTROL'), TEST_PACKAGE: summarise('TEST_PACKAGE'), rows }, null, 2), 'utf8');
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${join(ROOT, 'TESTCMD-1_REPORT.json')}`);
console.log('TESTCMD-1 COMPLETE');
