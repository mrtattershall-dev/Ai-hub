/**
 * endurance.mjs - THE 30-MINUTE UNATTENDED RUN of the fully integrated system.
 *
 *   node server/endurance.mjs <modelBaseUrl>
 *
 * NOT a comparison. One configuration, run unattended, to see whether the whole repaired path
 * holds together for a sustained period. Everything here has been qualified separately; what has
 * NOT been tested is all of it running together for longer than a short scripted check.
 *
 * THE FOUR SUCCESS CRITERIA, fixed before launch:
 *   1. stops within budget, with NO ACTIVE WORK LEFT BEHIND
 *   2. preserves accepted work and ROLLS BACK detected regressions
 *   3. accounts for EVERY task
 *   4. produces the final report AUTOMATICALLY, with no manual repair
 *
 * Criterion 4 is the one that has failed three times. It is the reason this run exists.
 *
 * DURATION IS REPORTED AS MEASURED. If the queue finishes early that is reported as the actual
 * elapsed time, not as "30 minutes of endurance". A short run that passes is a short run that
 * passes.
 */
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { PILOT_TASKS, TESTING_GUIDANCE, TOOL_SET_NOTE } = await import('./pilotTasks.js');
const { runBatch, TASK_STATE } = await import('./batch.js');
const { recordRun, recordPair, writeReport } = await import('./campaignReport.js');
const { confirmNoneRunning, WORKER_IMAGE } = await import('./worker.js');

const MODEL_URL = process.argv[2];
if (!MODEL_URL) { console.error('usage: node server/endurance.mjs <modelBaseUrl>'); process.exit(2); }

const PER_TASK_SEC = 300;
const TOTAL_SEC = parseInt(process.env.ENDURANCE_TOTAL_SEC || String(30 * 60), 10);
const RESERVE_SEC = 120;
const REPLICATES = parseInt(process.env.ENDURANCE_REPLICATES || '3', 10);
const PROBE_EVERY = parseInt(process.env.ENDURANCE_PROBE_EVERY || '1', 10);

const ROOT = mkdtempSync(join(tmpdir(), 'endurance-'));
const SUMMARY = join(ROOT, 'summary.jsonl');
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A SCRIPTED FAULT PROBE, to exercise the rollback path under load.
 *
 * NOT a task chosen because the model tends to break it - that would bias the workload and
 * still would not guarantee the restore path executes. This is a deterministic scripted edit
 * that breaks protected behaviour on purpose, run through the SAME batch path, in its own
 * disposable workspace.
 *
 * It is EXCLUDED from the productivity totals. It measures the machinery, not the model, and
 * counting it either way would corrupt both numbers.
 */
const FAULT_PROBE = {
  id: 'FAULT-PROBE#scripted',
  faultProbe: true,
  goal: '(scripted fault probe - no model involved)',
  seed: {
    'package.json': '{"name":"probe","type":"commonjs"}\n',
    'pricing.js': 'function round2(n) { return Math.round(n * 100) / 100; }\nmodule.exports = { round2 };\n',
    'cart.js': "const { round2 } = require('./pricing');\nfunction cartTotal(items) { return round2(items.reduce((a, i) => a + i.price * i.qty, 0)); }\nmodule.exports = { cartTotal };\n",
  },
  // the deterministic break: cartTotal(items) becomes NaN
  brokenEdit: { 'cart.js': "const { round2 } = require('./pricing');\nfunction cartTotal(items, percent) {\n  return round2(items.reduce((a, i) => a + i.price * i.qty, 0) * (1 - percent / 100));\n}\nmodule.exports = { cartTotal };\n" },
  requested: { script: 'node -e "const p=require(\'/candidate/pricing.js\'); process.exit(typeof p.applyDiscount===\'function\'?0:1)"' },
  protected: { script: 'node -e "const c=require(\'/candidate/cart.js\'); process.exit(c.cartTotal([{price:10,qty:2},{price:5,qty:1}])===25?0:1)"' },
};

/** THE FROZEN QUEUE: the five qualified tasks x replicates, each from its own seed. */
const QUEUE = [];
for (let rep = 1; rep <= REPLICATES; rep++) {
  for (const t of PILOT_TASKS) QUEUE.push({ ...t, id: `${t.id}#r${rep}`, rep, baseTask: t.id });
  // Probes are SPACED through the run, so the rollback path is exercised repeatedly over
  // hours rather than only at the start - without spending a meaningful share of the budget
  // on machinery checks.
  if (rep % PROBE_EVERY === 0) QUEUE.push({ ...FAULT_PROBE, id: `${FAULT_PROBE.id}#r${rep}`, rep });
}

let port = 39900;
const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

/** The summary row for one result. One definition, used incrementally AND at the end. */
function toSummaryRow(r, task, idx) {
  return {
    idx, rep: task?.rep ?? 0, task: r.task,
    arm: task?.faultProbe ? 'FAULT_PROBE' : 'SINGLE',
    termination: r.termination || r.state,
    requested: r.verdict?.requested?.verdict ?? null,
    protected: r.verdict?.protected?.verdict ?? null,
    disposition: r.acceptance?.disposition ?? r.state,
    accepted: !!r.acceptance?.countsAsCompletion,
    reason: r.reason ?? null,
    modelCalls: r.outcome?.modelCalls ?? 0,
    tokens: r.outcome?.tokens ?? 0,
    elapsedSec: r.outcome?.elapsedSec ?? 0,
    toolExecutions: r.outcome?.toolExecutions ?? 0,
    state: r.state,
  };
}

/** One task through the real hub, in the fully integrated configuration. */
async function runTask(ws, task, ctx) {
  // THE FAULT PROBE BYPASSES THE MODEL ENTIRELY. It applies its scripted break and returns,
  // so the batch path, the evaluator and the acceptance policy all run exactly as they do
  // for a real task - and no generation is spent on it.
  if (task.faultProbe) {
    for (const [f, body] of Object.entries(task.brokenEdit || {})) writeFileSync(join(ws, f), body, 'utf8');
    return { status: 'COMPLETED', ok: true, exit: 0, timedOut: false, attemptId: ctx.attemptId,
      elapsedSec: 0, terminationReason: 'scripted fault probe', modelCalls: 0, tokens: 0, toolExecutions: 0, faultProbe: true };
  }
  const p = port++;
  const started = Date.now();
  const dbPath = join(ROOT, `hub-${p}.json`);
  writeFileSync(dbPath, JSON.stringify({ api_keys: { ollama: { base_url: MODEL_URL, model: process.env.PILOT_MODEL || 'mycoder' } }, history: [], settings: {} }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(p), HUB_DB: dbPath, AGENT_WORKSPACE: ws,
      AGENT_RUNS_DIR: join(ROOT, 'runs'), AGENT_TRACES_DIR: join(ROOT, 'traces'),
      AGENT_QUEUE_FILE: join(ROOT, `q-${p}.json`),
      AGENT_WORKER_EXEC: '1',       // isolated worker, qualified
      AGENT_BOUND_ROUTES: '1',      // uncovered routes closed
      AGENT_APPROVAL_MODE: 'build',
      // d2 is OFF: enabling it would need a target set this run has never been tested with,
      // and d2 is not what this run is testing. Recorded rather than left ambiguous.
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${p}/api`;
  const hardStop = Math.min(started + ctx.timeoutSec * 1000, T0 + (TOTAL_SEC - RESERVE_SEC) * 1000);
  let run = null, aborted = null;
  try {
    for (let i = 0; i < 60 && Date.now() < hardStop; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', { method: 'POST', body: JSON.stringify({ goal: `${task.goal}\n\n${TESTING_GUIDANCE}` }) });
    if (!start.runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId };
    while (Date.now() < hardStop) {
      run = await api(base, `/agent/${start.runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      aborted = 'per-task or total limit';
      await api(base, `/agent/${start.runId}/stop`, { method: 'POST' }).catch(() => null);
      await sleep(1500);
      run = await api(base, `/agent/${start.runId}`).catch(() => run);
    }
  } finally {
    try { hub.kill('SIGKILL'); } catch { /* best effort */ }
  }
  const calls = Array.isArray(run?.callStats) ? run.callStats : [];
  return {
    status: 'COMPLETED', ok: true, exit: 0, timedOut: !!aborted, attemptId: ctx.attemptId,
    elapsedSec: Math.round((Date.now() - started) / 1000),
    terminationReason: aborted || run?.status || 'ended',
    modelCalls: calls.length,
    tokens: calls.reduce((a, c) => a + (c.outTok || 0) + (c.promptTok || 0), 0),
    toolExecutions: (run?.steps || []).filter((s) => s.tool).length,
  };
}

console.log(`ENDURANCE START ${new Date().toISOString()}`);
console.log(`model: ${MODEL_URL}  worker: ${WORKER_IMAGE}`);
console.log(`queue: ${QUEUE.length} tasks (${PILOT_TASKS.length} frozen tasks x ${REPLICATES} replicates)`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, ${RESERVE_SEC}s reserve, no retries`);
console.log(`config: worker isolation ON, route bounding ON, acceptance ON, d2 OFF\n`);

const out = await runBatch(QUEUE, {
  journalPath: join(ROOT, 'journal.jsonl'),
  workspacesDir: join(ROOT, 'ws'),
  auditDir: join(ROOT, 'audit'),
  perTaskSec: PER_TASK_SEC,
  totalSec: TOTAL_SEC - RESERVE_SEC,
  chain: false,                       // each task from its own seed
  // PERSIST INCREMENTALLY. This used to write the summary AFTER runBatch returned, so a
  // crash at minute 110 would have left the report with no input at all - the exact defect
  // fixed in protocol2.mjs and not carried here. It did not bite in ENDURANCE-2; it was
  // recorded as a weakness the run passed WITH, not because it was absent.
  onTaskEnd: (r) => {
    const task = QUEUE.find((q) => q.id === r.task);
    recordRun(SUMMARY, toSummaryRow(r, task, QUEUE.findIndex((q) => q.id === r.task) + 1));
  },
  runTask,
});

// ── durable summary, then the automatic report ──
// BACKFILL ONLY. Every attempt was already persisted as it finished; this catches anything
// the hook could not see (for example results produced by an early-exit path).
const { readSummary } = await import('./campaignReport.js');
const already = new Set(readSummary(SUMMARY).runs.map((r) => r.task));
for (const r of out.results) {
  if (already.has(r.task)) continue;
  const task = QUEUE.find((q) => q.id === r.task);
  recordRun(SUMMARY, toSummaryRow(r, task, out.results.indexOf(r) + 1));
}
const elapsedSec = Math.round((Date.now() - T0) / 1000);
const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

const report = writeReport(SUMMARY, join(ROOT, 'ENDURANCE_REPORT.json'), {
  experiment: 'ENDURANCE-1',
  config: { workerIsolation: true, routeBounding: true, acceptance: true, d2: false, model: MODEL_URL, workerImage: WORKER_IMAGE, toolSet: TOOL_SET_NOTE },
  budgetSec: TOTAL_SEC,
  elapsedSec,
  finishedEarly: elapsedSec < TOTAL_SEC - RESERVE_SEC,
  noActiveWorkLeftBehind: stopped.ok,
  batchAccounting: out.accounting,
  halted: out.halted,
  root: ROOT,
});

console.log('\n=== ENDURANCE RESULT ===');
console.log(`elapsed: ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s of a ${TOTAL_SEC / 60}-minute budget`
  + (report.finishedEarly ? '  (QUEUE EXHAUSTED EARLY - this is the measured duration, not 30 minutes of endurance)' : ''));
console.log(`1. stopped within budget, nothing still running : ${stopped.ok ? 'YES' : 'NO - ' + stopped.reason}`);
console.log(`2. accounted for every task                     : ${out.accounting.complete ? 'YES' : 'NO'} (${out.accounting.accountedFor}/${out.accounting.queued})`);
console.log(`3. report produced automatically                : YES (integrity ${report.integrity.ok}, reconciliation ${report.reconciliation.ok})`);
const probes = report.runs.filter((r) => r.arm === 'FAULT_PROBE');
const restored = probes.filter((r) => r.disposition === 'RESTORED').length;
console.log(`4. accepted work / rollbacks                    : see below`);
const probesAttempted = probes.filter((r) => r.termination !== 'UNATTEMPTED').length;
console.log(`   scripted fault probes: ${probesAttempted} attempted (${probes.length} queued), RESTORED ${restored}/${probesAttempted}` + (probesAttempted && restored === probesAttempted ? '  (rollback exercised under load)' : ''));
console.log('   (probes are excluded from the productivity totals below)');
console.log(JSON.stringify(report.arms, null, 2));
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${join(ROOT, 'ENDURANCE_REPORT.json')}`);
console.log('ENDURANCE COMPLETE');
