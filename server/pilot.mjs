/**
 * pilot.mjs - THE 30-MINUTE UNATTENDED PILOT.
 *
 *   node server/pilot.mjs <modelBaseUrl>
 *
 * WHAT IS BEING TESTED. Unattended execution and trustworthy ACCOUNTING - not productivity.
 * If all five coding attempts fail but the runner stops correctly and accounts for everything,
 * the pilot PASSES and productivity remains poor. Those are two different findings and this
 * script must not let one stand in for the other.
 *
 * FROZEN BEFORE GENERATION: the five tasks and their checks (pilotTasks.js), each seed verified
 * to fail a requested check and pass its protected checks (pilotSeeds.test.mjs, 19/19).
 *
 * LIMITS
 *   per task    300s, INCLUDING generation, tools and evaluation
 *   total       30 minutes, INCLUDING cleanup and final accounting
 *   reserve     the last 120s are for stopping, reconciliation and reporting
 *   retries     none. A failed task is a result, not something to run again.
 *
 * THE DEADLINE STOPS ACTIVE WORK. A deadline that only stops LAUNCHING new tasks would let one
 * slow task run past the window and turn "30 minutes" into a fiction. The run is aborted at its
 * own limit, and the batch is not extended to finish the queue - remaining tasks are recorded
 * UNATTEMPTED.
 *
 * ENFORCED CONFIGURATION ONLY. One arm. Five different tasks split across two arms would give
 * no causal comparison, so this is not a PROTOCOL-1 result and is not reported as one.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { PILOT_TASKS, TESTING_GUIDANCE, TOOL_SET_NOTE } = await import('./pilotTasks.js');
const { runBatch, TASK_STATE, Journal } = await import('./batch.js');
const { WORKER_IMAGE } = await import('./worker.js');

const MODEL_URL = process.argv[2];
if (!MODEL_URL) { console.error('usage: node server/pilot.mjs <modelBaseUrl>'); process.exit(2); }

const PER_TASK_SEC = 300;
const TOTAL_SEC = 30 * 60;
const RESERVE_SEC = 120;                 // stopping, reconciliation, reporting
const WORK_DEADLINE = Date.now() + (TOTAL_SEC - RESERVE_SEC) * 1000;

const ROOT = mkdtempSync(join(tmpdir(), 'legasus-pilot-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

/** Start a hub bound to ONE task's workspace, in the enforced configuration. */
function startHub(ws, port) {
  const dbPath = join(ROOT, `hub-${port}.json`);
  writeFileSync(dbPath, JSON.stringify({
    api_keys: { ollama: { base_url: MODEL_URL, model: process.env.PILOT_MODEL || 'mycoder' } }, history: [], settings: {},
  }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      HUB_DB: dbPath,
      AGENT_WORKSPACE: ws,
      AGENT_RUNS_DIR: join(ROOT, 'runs'),
      AGENT_TRACES_DIR: join(ROOT, 'traces'),
      AGENT_QUEUE_FILE: join(ROOT, `queue-${port}.json`),
      // The qualified configuration, throughout.
      AGENT_WORKER_EXEC: '1',
      AGENT_BOUND_ROUTES: '1',
      AGENT_D2_ENFORCE: '1',
      AGENT_D2_SEAL_AUDIT: '1',
      AGENT_D2_AUDIT_DIR: join(ROOT, 'audit'),
      AGENT_APPROVAL_MODE: 'build',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  hub.stdout.on('data', (d) => log.push(String(d)));
  hub.stderr.on('data', (d) => log.push(String(d)));
  return { hub, log, base: `http://127.0.0.1:${port}/api` };
}

const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 400) }; }
};

let port = 39100;

/**
 * Run ONE task: start a hub on its workspace, drive the real agent, abort at the limit.
 *
 * Returns the shape batch.js expects, plus the accounting the report needs.
 */
async function runTask(ws, task, ctx) {
  const p = port++;
  const started = Date.now();
  const { hub, log, base } = startHub(ws, p);
  const hardStopAt = Math.min(started + ctx.timeoutSec * 1000, WORK_DEADLINE);
  let runId = null, run = null, aborted = null;

  try {
    // wait for the hub to answer
    for (let i = 0; i < 60 && Date.now() < hardStopAt; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up yet */ }
      await sleep(500);
    }

    const goal = `${task.goal}\n\n${TESTING_GUIDANCE}`;
    const start = await api(base, '/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    runId = start.runId || start.id || null;
    if (!runId) return { status: 'NOT_STARTED', error: 'the hub did not start a run', attemptId: ctx.attemptId, elapsedSec: Math.round((Date.now() - started) / 1000), hubLog: log.join('').slice(-600) };

    // poll until the run ends OR the limit is reached
    while (Date.now() < hardStopAt) {
      run = await api(base, `/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      // THE DEADLINE STOPS ACTIVE WORK.
      aborted = Date.now() >= WORK_DEADLINE ? 'total budget reached' : 'per-task limit reached';
      await api(base, `/agent/${runId}/stop`, { method: 'POST' }).catch(() => null);
      await sleep(1500);
      run = await api(base, `/agent/${runId}`).catch(() => run);
    }

    return {
      status: 'COMPLETED',
      ok: true,
      exit: 0,
      timedOut: !!aborted,
      attemptId: ctx.attemptId,
      // accounting the report needs
      elapsedSec: Math.round((Date.now() - started) / 1000),
      terminationReason: aborted || run?.finishReason || run?.status || 'ended',
      // callStats is an ARRAY of per-call records ({ms, outTok, promptTok, ...}), not a summary
      // object. It is also capped at the last 60 calls, so modelCalls is a LOWER BOUND on a very
      // long run and is reported as one rather than as a total.
      modelCalls: Array.isArray(run?.callStats) ? run.callStats.length : null,
      modelCallsIsLowerBound: Array.isArray(run?.callStats) && run.callStats.length >= 60,
      tokens: Array.isArray(run?.callStats)
        ? run.callStats.reduce((a, c) => a + (c.outTok || 0) + (c.promptTok || 0), 0)
        : null,
      steps: Array.isArray(run?.steps) ? run.steps.length : null,
      d2: run?.d2 ? { violated: run.d2.violated ?? null, enforced: true, auditSealed: run.d2.auditSealed ?? null } : null,
      workerFailures: Array.isArray(run?.workerFailures) ? run.workerFailures.length : 0,
      unconfirmed: Array.isArray(run?.unconfirmed) ? run.unconfirmed.length : 0,
      uncoveredTraversals: Array.isArray(run?.uncoveredTraversals) ? run.uncoveredTraversals.length : 0,
    };
  } finally {
    try { hub.kill('SIGKILL'); } catch { /* best effort */ }
  }
}

/** The starting identity of each workspace, captured before the model touches it. */
const startTrees = {};
const gitTree = (ws) => { try { return execFileSync('git', ['-C', ws, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(); } catch { return null; } };

console.log(`PILOT START ${now()}`);
console.log(`model: ${MODEL_URL}  worker image: ${WORKER_IMAGE}`);
console.log(`limits: ${PER_TASK_SEC}s/task, ${TOTAL_SEC}s total, ${RESERVE_SEC}s reserved for stopping and reporting`);
console.log(`tool set: removed ${TOOL_SET_NOTE.removed.join(', ')}`);
console.log('');

const out = await runBatch(PILOT_TASKS, {
  journalPath: join(ROOT, 'journal.jsonl'),
  workspacesDir: join(ROOT, 'ws'),
  auditDir: join(ROOT, 'audit-partial'),
  perTaskSec: PER_TASK_SEC,
  totalSec: TOTAL_SEC - RESERVE_SEC,
  runTask: async (ws, task, ctx) => { startTrees[task.id] = gitTree(ws); return runTask(ws, task, ctx); },
});

// ── REPORT ──
const events = new Journal(join(ROOT, 'journal.jsonl')).read();
const report = {
  pilot: 'unattended-runner-30min',
  startedAt: events[0]?.at || null,
  endedAt: now(),
  configuration: {
    model: MODEL_URL, workerImage: WORKER_IMAGE,
    enforced: true, arms: 'ENFORCED ONLY - not a PROTOCOL-1 comparison',
    perTaskSec: PER_TASK_SEC, totalSec: TOTAL_SEC, reserveSec: RESERVE_SEC, retries: 'none',
    toolSet: TOOL_SET_NOTE, testingGuidance: TESTING_GUIDANCE,
  },
  halted: out.halted,
  accounting: out.accounting,
  tasks: out.results.map((r) => {
    const end = events.find((e) => e.event === 'task_end' && e.task === r.task) || {};
    const ran = events.find((e) => e.event === 'task_ran' && e.task === r.task) || {};
    const o = r.outcome || {};
    return {
      task: r.task,
      state: r.state,
      terminationReason: r.reason || o.terminationReason || end.reason || null,
      requestedBehavior: end.requested ?? r.verdict?.requested?.verdict ?? null,
      protectedBehavior: end.protected ?? r.verdict?.protected?.verdict ?? null,
      startingCandidate: startTrees[r.task] || null,
      survivingCandidate: end.candidateTree ?? r.verdict?.candidateTree ?? null,
      elapsedSec: o.elapsedSec ?? null,
      modelCalls: o.modelCalls ?? null,
      tokens: o.tokens ?? null,
      modelCallsIsLowerBound: o.modelCallsIsLowerBound ?? null,
      partialPreservedAt: r.partialAt || null,
      d2: o.d2 ?? null,
      workerFailures: o.workerFailures ?? null,
      unconfirmed: o.unconfirmed ?? null,
      uncoveredTraversals: o.uncoveredTraversals ?? null,
    };
  }),
  interventions: ['none - the pilot ran unattended from start to final accounting'],
  journal: join(ROOT, 'journal.jsonl'),
  root: ROOT,
};

const reportPath = join(ROOT, 'PILOT-REPORT.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log('\n=== PILOT REPORT ===');
console.log(JSON.stringify(report, null, 2));
console.log(`\nreport: ${reportPath}`);
console.log(`ACCOUNTING COMPLETE: ${out.accounting.complete}  (${out.accounting.accountedFor}/${out.accounting.queued})`);
process.exit(out.accounting.complete ? 0 : 1);
