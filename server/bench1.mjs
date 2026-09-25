/**
 * bench1.mjs - THE BOUNDED BENCHMARK, as frozen in legasus/screen/BENCH-1_DEFINITION.md.
 *
 *   node server/bench1.mjs <modelBaseUrl>
 *
 * TWO GROUPS, RUN AND REPORTED SEPARATELY:
 *   EXTERNAL (15)    independent QuixBugs bug-fixes, each from its own frozen seed
 *   SEQUENTIAL (5)   one project, each step from the previous ACCEPTED state, BLOCKED if the
 *                    prerequisite was not accepted
 *
 * NO COMPARISON ARM. This measures what this configuration achieved. It cannot show that
 * anything beats anything.
 *
 * The external group runs first so that a chain failure cannot consume the budget the
 * independent tasks need. That order is fixed here, before the run, for that reason alone.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { externalTasks, SEQUENTIAL_TASKS, BENCH_GUIDANCE } = await import('./benchTasks.js');
const { runBatch } = await import('./batch.js');
const { recordRun, recordPlan, writeReport } = await import('./campaignReport.js');
const { confirmNoneRunning, WORKER_IMAGE } = await import('./worker.js');

const MODEL_URL = process.argv[2];
// The same frozen definition can be run again under a new label. Everything else - tasks,
// seeds, limits, order, guidance - is fixed in this file and benchTasks.js. Label the RUN, not
// the definition: BENCH-2 is BENCH-1's definition on a later hub commit.
const EXPERIMENT = process.env.BENCH_EXPERIMENT || 'BENCH-1';
const HUB_COMMIT = process.env.BENCH_HUB_COMMIT || 'unrecorded';
if (!MODEL_URL) { console.error('usage: node server/bench1.mjs <modelBaseUrl>'); process.exit(2); }

const PER_TASK_SEC = 300;
// REPLICATES (BENCH-3). Every earlier count was n=1 per task, which is descriptive only. With
// BENCH_REPS=N the EXTERNAL group runs N times, each replicate from the same frozen seeds in
// fresh workspaces, recorded as its own planned unit (task@rN) so the report's denominator and
// duplicate check stay exact. The sequential chain runs once regardless - accumulation
// replicates are a different design and are not smuggled in here.
const REPS = Math.max(1, parseInt(process.env.BENCH_REPS || '1', 10));
const TOTAL_SEC = parseInt(process.env.BENCH_TOTAL_SEC || String(2 * 60 * 60), 10);
const RESERVE_SEC = 180;
const T0 = Date.now();
const DEADLINE = T0 + (TOTAL_SEC - RESERVE_SEC) * 1000;

const ROOT = mkdtempSync(join(tmpdir(), 'bench1-'));
const SUMMARY = join(ROOT, 'summary.jsonl');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = 40100;

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
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up yet */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', {
      method: 'POST',
      body: JSON.stringify({ goal: `${task.goal}\n\n${BENCH_GUIDANCE}`, budgetSec: ctx.timeoutSec }),
    });
    if (!start.runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId };
    while (Date.now() < hardStop) {
      run = await api(base, `/agent/${start.runId}`).catch(() => null);
      // Settled AND FINALIZED: finalizedAt is the hub's acknowledgment that the terminal
      // state has been persisted. Killing the hub before it produced CHECK-1's contradictory
      // status:"running" record for completed work.
      if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      aborted = Date.now() >= DEADLINE ? 'total budget' : 'per-task limit';
      await api(base, `/agent/${start.runId}/stop`, { method: 'POST' }).catch(() => null);
      // After a forced stop, wait (bounded) for the finalization ack too - the teardown still
      // has acceptance/d2 to run, and killing under it is exactly the demonstrated defect.
      for (let i = 0; i < 60; i++) {
        run = await api(base, `/agent/${start.runId}`).catch(() => run);
        if (run && run.finalizedAt && !run.busy) break;
        await sleep(1000);
      }
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
    unconfirmedRemoteCalls: run?.unconfirmedRemoteCalls || 0,   // aborted locally; may still be computing and billing
  };
}

// A FROZEN SUBSET, by id, for a small check (CHECK-1). The ids are listed in the check's
// definition before the run; the filter changes WHICH tasks run and nothing about how.
const ONLY = String(process.env.BENCH_TASK_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
const pick = (list) => (ONLY.length ? list.filter((t) => ONLY.includes(t.id)) : list);
const EXTERNAL = pick(externalTasks());
const SEQ = pick(SEQUENTIAL_TASKS);
const ALL = [...EXTERNAL, ...SEQ];
if (ONLY.length && ALL.length !== ONLY.length) { console.error(`BENCH_TASK_IDS names ${ONLY.length} tasks but ${ALL.length} matched: ${ALL.map((t) => t.id).join(',')}`); process.exit(2); }

console.log(`${EXPERIMENT} START ${new Date().toISOString()} hub ${HUB_COMMIT}`);
console.log(`model: ${MODEL_URL}`);
console.log(`worker: ${WORKER_IMAGE}`);
console.log(`queue: ${EXTERNAL.length} external x ${REPS} replicate(s) + ${SEQ.length} sequential`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, ${RESERVE_SEC}s reserve, no retries\n`);

// THE PLAN IS RECORDED FIRST. Without it a recovered report reconciles only against the records
// that survived, which can never reveal work that is missing.
recordPlan(SUMMARY, [
  ...EXTERNAL.flatMap((t) => Array.from({ length: REPS }, (_, r) => `${t.id}@r${r + 1}`)),
  ...SEQ.map((t) => t.id),
]);

const rowOf = (r, task, idx, rep) => ({
  idx, rep, task: rep ? `${r.task}@r${rep}` : r.task, arm: task?.group || 'UNKNOWN',
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
  state: r.state,
});

let idx = 0;
const persist = (group, rep) => (r) => {
  const task = ALL.find((t) => t.id === r.task) || { group };
  recordRun(SUMMARY, rowOf(r, task, ++idx, rep));
  const req = r.verdict?.requested?.verdict ?? '-';
  const prot = r.verdict?.protected?.verdict ?? '-';
  console.log(`${String(idx).padStart(2)}. [${task.group}] ${r.task} ${r.termination || r.state} req=${req} prot=${prot} ${r.acceptance?.disposition ?? r.state}`);
};

// ── EXTERNAL: independent, each replicate from the same frozen seeds in fresh workspaces ──
const extAccounting = [];
for (let rep = 1; rep <= REPS; rep++) {
  if (Date.now() >= DEADLINE) { console.log(`replicate ${rep} not started: total budget reached`); break; }
  console.log(`\n-- external replicate ${rep} of ${REPS} --`);
  const out = await runBatch(EXTERNAL, {
    journalPath: join(ROOT, `journal-ext-r${rep}.jsonl`),
    workspacesDir: join(ROOT, `ws-ext-r${rep}`),
    auditDir: join(ROOT, 'audit'),
    perTaskSec: PER_TASK_SEC,
    totalSec: Math.max(1, Math.round((DEADLINE - Date.now()) / 1000)),
    chain: false,
    onTaskEnd: persist('EXTERNAL', rep),
    runTask,
  });
  extAccounting.push({ rep, accounting: out.accounting });
}

// ── SEQUENTIAL: chained, advancing only from accepted states ──
const seqOut = await runBatch(SEQ, {
  journalPath: join(ROOT, 'journal-seq.jsonl'),
  workspacesDir: join(ROOT, 'ws-seq'),
  auditDir: join(ROOT, 'audit'),
  perTaskSec: PER_TASK_SEC,
  totalSec: Math.max(1, Math.round((DEADLINE - Date.now()) / 1000)),
  chain: true,
  onTaskEnd: persist('SEQUENTIAL', 0),
  runTask,
});

const elapsedSec = Math.round((Date.now() - T0) / 1000);
const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

const report = writeReport(SUMMARY, join(ROOT, `${EXPERIMENT}_REPORT.json`), {
  experiment: EXPERIMENT, definition: 'BENCH-1 (legasus/screen/BENCH-1_DEFINITION.md), unchanged',
  comparisonArm: 'NONE - this measures one configuration, not a comparison',
  taskSource: {
    external: 'QuixBugs - independently authored, but PUBLIC and plausibly in training data',
    sequential: 'internally authored',
  },
  config: {
    model: MODEL_URL, workerImage: WORKER_IMAGE, hubCommit: HUB_COMMIT,
    sampling: { temperature: process.env.AGENT_TEMPERATURE || '0.2 (default)', top_p: process.env.AGENT_TOP_P || 'unset', top_k: process.env.AGENT_TOP_K || 'unset', repeat_penalty: process.env.AGENT_REPEAT_PENALTY || 'unset' },
    supplyMaxBytes: process.env.AGENT_SUPPLY_MAX_BYTES || '8192 (default)',
    workerIsolation: true, routeBounding: true, acceptance: true,
    d2: false, protocolController: false,
    perTaskSec: PER_TASK_SEC, totalSec: TOTAL_SEC, retries: 'none',
  },
  elapsedSec,
  noActiveWorkLeftBehind: stopped.ok,
  externalAccounting: extAccounting,
  sequentialAccounting: seqOut.accounting,
  interventions: ['none - unattended from launch to final report'],
  root: ROOT,
});

const byGroup = (g) => report.runs.filter((r) => r.arm === g);
const acc = (g) => byGroup(g).filter((r) => r.accepted).length;
// CONSECUTIVE depth, not a count: the chain question is how far it got before stopping.
const chainDepth = (() => {
  let n = 0;
  for (const t of SEQ) {
    const r = report.runs.find((x) => x.task === t.id);
    if (r && r.accepted) n++; else break;
  }
  return n;
})();

console.log(`
=== ${EXPERIMENT} RESULT ===`);
console.log(`elapsed ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s of ${TOTAL_SEC / 60}m`);
console.log(`stopped cleanly: ${stopped.ok ? 'YES' : 'NO - ' + stopped.reason}`);
console.log(`integrity ${report.integrity.ok}  reconciliation ${report.reconciliation.ok}`);
console.log(`status ${JSON.stringify(report.byStatus)}`);
console.log(`\nEXTERNAL   accepted ${acc('EXTERNAL')}/${EXTERNAL.length}`);
console.log(`SEQUENTIAL accepted ${acc('SEQUENTIAL')}/${SEQ.length}   CONSECUTIVE steps accumulated: ${chainDepth}`);
console.log('   (different questions - never summed)');
console.log(JSON.stringify(report.arms, null, 2));
console.log(`\nsummary: ${SUMMARY}`);
console.log(`report:  ${join(ROOT, `${EXPERIMENT}_REPORT.json`)}`);
console.log(`${EXPERIMENT} COMPLETE`);
