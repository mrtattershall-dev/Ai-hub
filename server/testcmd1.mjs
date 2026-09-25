/**
 * testcmd1.mjs - TESTCMD-1: current guidance vs an explicit test command.
 *
 *   node server/testcmd1.mjs <modelBaseUrl>
 *
 * ONE DIFFERENCE BETWEEN THE ARMS, and it is declared here:
 *
 *   CONTROL    the task seed exactly as BENCH-1/2/3 ran it (the buggy module alone), with
 *              BENCH_GUIDANCE verbatim.
 *   TESTCMD    the same seed PLUS run_tests.py and task_cases.jsonl, and two sentences of
 *              guidance naming the command. Nothing else differs: same model, same sampling,
 *              same limits, same worker, same acceptance policy, same evaluator, same order.
 *
 * THE EXPOSED CASES ARE THE GRADED CASES. So a TESTCMD result is REPAIR WITH SUPPLIED TESTS.
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
 *   caseDelta            how many graded cases THE CANDIDATE THE MODEL PRODUCED passes,
 *                        against the seed's baseline. A run that moves 2/9 -> 7/9 did useful
 *                        work even if it never finished; 2/9 -> 2/9 did not. Measured on the
 *                        candidate rather than the surviving workspace, so a rolled-back run
 *                        is not scored as having done nothing - regressions are counted
 *                        separately, so nothing is double-credited. This is the "failures
 *                        lead to useful edits" measure, and it is graded, not binary.
 *   editsOnTarget        writes that actually targeted the module under test
 *   editAfterFailure     did an edit to the target follow a failing test observation, in order
 *   commandInvoked       (TESTCMD only) did it run run_tests.py at all - recorded LAST,
 *                        because a treatment that is invoked and changes nothing is a
 *                        negative result, and a treatment that is never invoked is a
 *                        different negative result. Both are distinguishable here.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { externalTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');
const { testCommandFiles, TEST_COMMAND_GUIDANCE } = await import('./taskTests.js');
const { runBatch } = await import('./batch.js');
const { evaluate } = await import('./evaluator.js');
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

const BASE = externalTasks();

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
    const v = await evaluate(dir, t, { timeoutSec: 90 });
    baseline.set(t.id, casesFrom(v.requested));
    console.log(`  baseline ${t.id}: ${baseline.get(t.id).pass}/${baseline.get(t.id).total} graded cases pass on the seed`);
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
  let run = null, aborted = null;
  try {
    for (let i = 0; i < 60 && Date.now() < hardStop; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', {
      method: 'POST', body: JSON.stringify({ goal: task.goal, budgetSec: ctx.timeoutSec }),
    });
    if (!start.runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId };
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
  const ranCommand = (s) => /^(run_python|run_command)$/.test(s.tool) && /run_tests\.py/.test(JSON.stringify(s.args || ''));
  // A FAILING OBSERVATION: any executed test whose output carries a failure signal.
  const isFailingTest = (s) => /^(run_python|run_command)$/.test(s.tool)
    && /(FAIL|ERROR|Traceback|EXPECTED|FAILED \d+\/)/.test(String(s.result || ''));
  let editAfterFailure = false, sawFailure = false;
  for (const s of steps) {
    if (isFailingTest(s)) sawFailure = true;
    else if (sawFailure && isEdit(s)) { editAfterFailure = true; break; }
  }
  const calls = Array.isArray(run?.callStats) ? run.callStats : [];
  return {
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
console.log(`arms: CONTROL (seed only) vs TESTCMD (seed + run_tests.py + cases)`);
console.log(`queue: ${BASE.length} tasks x 2 arms x ${REPS} replicate(s) = ${BASE.length * 2 * REPS} units`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, no retries\n`);

console.log('measuring seed baselines (no model involved):');
await measureBaselines();

// THE PLAN FIRST, as always: anything planned and not recorded is UNACCOUNTED.
recordPlan(SUMMARY, BASE.flatMap((t) => Array.from({ length: REPS }, (_, r) =>
  ['CONTROL', 'TESTCMD'].map((a) => `${t.id}@${a}r${r + 1}`)).flat()));

let idx = 0;
const rows = [];
const persist = (arm, rep) => async (r) => {
  const b = baseline.get(r.task) || { pass: null, total: null };
  // THE CANDIDATE the model produced, not the surviving workspace. A run that broke
  // protected behaviour is rolled back, so its surviving tree is the seed again - measuring
  // there would score every restored run as "did nothing" and hide the edits it did make.
  // Regressions are counted separately (regressionsProduced), so nothing is double-credited.
  const candidateCases = casesFrom(r.verdict?.requested);
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
    baselineCasesPass: b.pass, casesTotal: b.total,
    candidateCasesPass: candidateCases.pass,
    caseDelta: (candidateCases.pass !== null && b.pass !== null) ? candidateCases.pass - b.pass : null,
    state: r.state,
  };
  rows.push(row);
  recordRun(SUMMARY, row);
  console.log(`${String(idx).padStart(3)}. [${arm}] ${r.task} ${r.termination || r.state} req=${row.requested ?? '-'} cases ${b.pass}->${candidateCases.pass ?? '?'}/${b.total} edits=${row.editsOnTarget} ${row.disposition}`);
};

for (let rep = 1; rep <= REPS; rep++) {
  for (let ti = 0; ti < BASE.length; ti++) {
    if (Date.now() >= DEADLINE) { console.log('deadline reached; remaining units are UNATTEMPTED'); break; }
    const task = BASE[ti];
    // ALTERNATING ORDER: even task index runs CONTROL first, odd runs TESTCMD first.
    const order = ti % 2 === 0 ? ['CONTROL', 'TESTCMD'] : ['TESTCMD', 'CONTROL'];
    for (const arm of order) {
      if (Date.now() >= DEADLINE) break;
      await runBatch([armTask(task, arm)], {
        journalPath: join(ROOT, `journal-${arm}-r${rep}.jsonl`),
        workspacesDir: join(ROOT, `ws-${arm}-r${rep}`),
        auditDir: join(ROOT, 'audit'),
        perTaskSec: PER_TASK_SEC,
        totalSec: Math.max(1, Math.round((DEADLINE - Date.now()) / 1000)),
        chain: false,
        onTaskEnd: persist(arm, rep),
        runTask,
      });
    }
  }
}

const elapsedSec = Math.round((Date.now() - T0) / 1000);
const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

const report = writeReport(SUMMARY, join(ROOT, 'TESTCMD-1_REPORT.json'), {
  experiment: 'TESTCMD-1',
  comparisonArm: 'CONTROL (current guidance, seed only) vs TESTCMD (seed + run_tests.py + graded cases)',
  label: 'REPAIR WITH SUPPLIED TESTS - the exposed cases ARE the graded cases; not held-out generalization',
  config: {
    model: MODEL_URL, workerImage: WORKER_IMAGE, hubCommit: process.env.TESTCMD_HUB_COMMIT || 'unrecorded',
    workerIsolation: true, routeBounding: true, acceptance: true, d2: false, protocolController: false,
    perTaskSec: PER_TASK_SEC, totalSec: TOTAL_SEC, replicates: REPS, retries: 'none',
    armDifference: 'two seed files (run_tests.py, task_cases.jsonl) and two sentences of guidance. Nothing else.',
  },
  elapsedSec,
  noActiveWorkLeftBehind: stopped.ok,
  root: ROOT,
});

const arm = (a) => rows.filter((r) => r.arm === a);
const sum = (xs, f) => xs.reduce((n, x) => n + (f(x) || 0), 0);
const summarise = (a) => {
  const g = arm(a);
  const withDelta = g.filter((r) => r.caseDelta !== null);
  return {
    runs: g.length,
    verifiedRepairs: g.filter((r) => r.accepted).length,
    regressionsProduced: g.filter((r) => r.protected === 'FAIL').length,
    casesGained: sum(withDelta, (r) => r.caseDelta),   // on the CANDIDATE, before any rollback
    runsThatGainedCases: withDelta.filter((r) => r.caseDelta > 0).length,
    runsThatLostCases: withDelta.filter((r) => r.caseDelta < 0).length,
    editsOnTarget: sum(g, (r) => r.editsOnTarget),
    runsThatEdited: g.filter((r) => r.editsOnTarget > 0).length,
    sawFailingTest: g.filter((r) => r.sawFailingTest).length,
    editAfterFailure: g.filter((r) => r.editAfterFailure).length,
    commandInvoked: g.filter((r) => r.commandInvoked > 0).length,
  };
};

console.log('\n=== TESTCMD-1 RESULT ===');
console.log(`elapsed ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s of ${Math.round(TOTAL_SEC / 60)}m`);
console.log(`stopped cleanly: ${stopped.ok ? 'YES' : 'NO - ' + stopped.reason}`);
console.log(`integrity ${report.integrity.ok}  reconciliation ${report.reconciliation.ok}`);
console.log(`status ${JSON.stringify(report.byStatus)}`);
console.log('\nLABEL: repair with SUPPLIED tests. The exposed cases are the graded cases.');
console.log(`\nCONTROL  ${JSON.stringify(summarise('CONTROL'), null, 1)}`);
console.log(`TESTCMD  ${JSON.stringify(summarise('TESTCMD'), null, 1)}`);
writeFileSync(join(ROOT, 'arms.json'), JSON.stringify({ CONTROL: summarise('CONTROL'), TESTCMD: summarise('TESTCMD'), rows }, null, 2), 'utf8');
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${join(ROOT, 'TESTCMD-1_REPORT.json')}`);
console.log('TESTCMD-1 COMPLETE');
