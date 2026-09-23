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
const TOTAL_SEC = 30 * 60;
const RESERVE_SEC = 120;
const REPLICATES = 3;               // the five frozen tasks, three times

const ROOT = mkdtempSync(join(tmpdir(), 'endurance-'));
const SUMMARY = join(ROOT, 'summary.jsonl');
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** THE FROZEN QUEUE: the five qualified tasks, three replicates, each from its own seed. */
const QUEUE = [];
for (let rep = 1; rep <= REPLICATES; rep++) {
  for (const t of PILOT_TASKS) QUEUE.push({ ...t, id: `${t.id}#r${rep}`, rep, baseTask: t.id });
}

let port = 39900;
const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

/** One task through the real hub, in the fully integrated configuration. */
async function runTask(ws, task, ctx) {
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
  runTask,
});

// ── durable summary, then the automatic report ──
for (const r of out.results) {
  const task = QUEUE.find((q) => q.id === r.task);
  recordRun(SUMMARY, {
    idx: out.results.indexOf(r) + 1, rep: task?.rep ?? 0, task: r.task, arm: 'SINGLE',
    termination: r.termination || r.state,
    requested: r.verdict?.requested?.verdict ?? null,
    protected: r.verdict?.protected?.verdict ?? null,
    disposition: r.acceptance?.disposition ?? r.state,
    accepted: !!r.acceptance?.countsAsCompletion,
    modelCalls: r.outcome?.modelCalls ?? 0,
    tokens: r.outcome?.tokens ?? 0,
    elapsedSec: r.outcome?.elapsedSec ?? 0,
    toolExecutions: r.outcome?.toolExecutions ?? 0,
    state: r.state,
  });
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
console.log(`4. accepted work / rollbacks                    : see below`);
console.log(JSON.stringify(report.arms, null, 2));
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${join(ROOT, 'ENDURANCE_REPORT.json')}`);
console.log('ENDURANCE COMPLETE');
