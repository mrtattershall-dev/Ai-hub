/**
 * protocol1.mjs - THE FROZEN PROTOCOL-1 COMPARISON.
 *
 *   node server/protocol1.mjs <modelBaseUrl>
 *
 * Runs the order frozen in legasus/screen/PROTOCOL-1_ORDER.md: the five tasks, each in BOTH
 * arms, interleaved in adjacent pairs with the leading arm alternating.
 *
 * The ONLY difference between arms is AGENT_PROTOCOL=1. Same model, backend, tasks, seeds,
 * tools, worker, budgets, evaluator and acceptance policy.
 *
 * ACCUMULATION IS OFF. Every run starts from its task's own seed, so an early success cannot
 * change a later task's difficulty and the arms stay comparable after any divergence.
 *
 * MEASURED SEPARATELY, NEVER SUMMED: requested behaviour, protected behaviour, accepted
 * improvements, effort (calls/time/tokens), and controller refusals. The last is mandatory - a
 * controller that "wins" by refusing most actions is a different finding from one that helps.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { PILOT_TASKS, TESTING_GUIDANCE } = await import('./pilotTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');
const { applyAcceptance, DISPOSITION } = await import('./acceptance.js');
const { confirmNoneRunning } = await import('./worker.js');

const MODEL_URL = process.argv[2];
if (!MODEL_URL) { console.error('usage: node server/protocol1.mjs <modelBaseUrl>'); process.exit(2); }

const PER_TASK_SEC = 300;
const TOTAL_SEC = 60 * 60;
const RESERVE_SEC = 120;
const DEADLINE = Date.now() + (TOTAL_SEC - RESERVE_SEC) * 1000;

/** THE FROZEN ORDER. Pairs are adjacent; the leading arm alternates. */
/**
 * THE FROZEN SCHEDULE: replicate-major, pairs adjacent, leading arm alternating within a
 * replicate and flipping between replicates.
 *
 * Every task gets its first pair before any gets its second, so a truncated campaign yields
 * complete replicates across all five tasks rather than three replicates of one task.
 */
const TASK_IDS = PILOT_TASKS.map((t) => t.id);
const PAIRS = [];
for (let rep = 1; rep <= 3; rep++) {
  TASK_IDS.forEach((id, i) => {
    // alternate within the replicate, and flip the whole replicate
    const controlFirst = ((i + rep) % 2) === 0;
    PAIRS.push({ rep, task: id, arms: controlFirst ? ['CONTROL', 'TREATMENT'] : ['TREATMENT', 'CONTROL'] });
  });
}

/** Both runs at maximum allowance, plus cleanup. Adjacency alone does not guarantee a pair. */
const PAIR_RESERVE_MS = (2 * PER_TASK_SEC + 60) * 1000;

const ROOT = mkdtempSync(join(tmpdir(), 'protocol1-'));
const byId = Object.fromEntries(PILOT_TASKS.map((t) => [t.id, t]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (ws, ...a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };
let port = 39500;

const api = async (base, path, init) => {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json' }, ...init });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
};

async function runOne(taskId, armName, idx) {
  const task = byId[taskId];
  const treatment = armName === 'TREATMENT';
  const ws = join(ROOT, `${idx}-${taskId}-${armName}`);
  rmSync(ws, { recursive: true, force: true });
  mkdirSync(ws, { recursive: true });
  // EACH RUN FROM ITS OWN SEED. No accumulation, in either arm.
  for (const [f, body] of Object.entries(task.seed)) writeFileSync(join(ws, f), body, 'utf8');
  git(ws, 'init', '-q'); git(ws, 'add', '-A');
  git(ws, '-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-q', '-m', 'seed');
  const startRef = git(ws, 'rev-parse', 'HEAD');
  const startTree = git(ws, 'rev-parse', 'HEAD^{tree}');

  const p = port++;
  const dbPath = join(ROOT, `hub-${p}.json`);
  writeFileSync(dbPath, JSON.stringify({ api_keys: { ollama: { base_url: MODEL_URL, model: process.env.PILOT_MODEL || 'mycoder' } }, history: [], settings: {} }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(p), HUB_DB: dbPath, AGENT_WORKSPACE: ws,
      AGENT_RUNS_DIR: join(ROOT, 'runs'), AGENT_TRACES_DIR: join(ROOT, 'traces'),
      AGENT_QUEUE_FILE: join(ROOT, `q-${p}.json`),
      AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1', AGENT_APPROVAL_MODE: 'build',
      ...(treatment ? { AGENT_PROTOCOL: '1' } : {}),   // THE ONLY DIFFERENCE
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${p}/api`;
  const started = Date.now();
  const hardStop = Math.min(started + PER_TASK_SEC * 1000, DEADLINE);
  let run = null, aborted = null;

  try {
    for (let i = 0; i < 60 && Date.now() < hardStop; i++) {
      try { const h = await api(base, '/agent'); if (h && !h.error) break; } catch { /* not up */ }
      await sleep(500);
    }
    const start = await api(base, '/agent/start', { method: 'POST', body: JSON.stringify({ goal: `${task.goal}\n\n${TESTING_GUIDANCE}` }) });
    const runId = start.runId;
    if (!runId) return { task: taskId, arm: armName, error: 'the hub did not start a run', startTree };

    while (Date.now() < hardStop) {
      run = await api(base, `/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(2000);
    }
    if (run && run.status === 'running') {
      aborted = Date.now() >= DEADLINE ? 'total budget' : 'per-task limit';
      await api(base, `/agent/${runId}/stop`, { method: 'POST' }).catch(() => null);
      await sleep(1500);
      run = await api(base, `/agent/${runId}`).catch(() => run);
    }
  } finally {
    try { hub.kill('SIGKILL'); } catch { /* best effort */ }
  }

  // Confirm execution really stopped before anything reads the workspace.
  const stopped = await confirmNoneRunning({ timeoutMs: 30_000 });

  // Give the terminal candidate an identity, then evaluate and apply acceptance.
  git(ws, 'add', '-A');
  git(ws, '-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-q', '-m', 'terminal candidate');
  let verdict;
  try { verdict = await evaluate(ws, task, { timeoutSec: 120 }); }
  catch (e) { verdict = { verdict: VERDICT.EVALUATION_ERROR, reason: String(e?.name || e) }; }
  const acc = await applyAcceptance(ws, task, verdict, { startRef, captureDir: join(ROOT, 'rejected'), taskId: `${idx}-${taskId}-${armName}` });

  const calls = Array.isArray(run?.callStats) ? run.callStats : [];
  const refusals = run?.controllerRefusals || [];
  const attempted = (run?.steps || []).filter((s) => s.tool).map((s) => s.tool);

  return {
    idx, task: taskId, arm: armName,
    termination: aborted ? 'TIMEOUT' : (run?.status || 'unknown'),
    stoppedConfirmed: stopped.ok,
    requested: verdict.requested?.verdict ?? null,
    protected: verdict.protected?.verdict ?? null,
    disposition: acc.disposition,
    accepted: acc.countsAsCompletion,
    startTree, candidateTree: verdict.candidateTree ?? null,
    survivingVerdict: acc.survivingWorkspaceVerdict?.overall ?? null,
    elapsedSec: Math.round((Date.now() - started) / 1000),
    modelCalls: calls.length,
    tokens: calls.reduce((a, c) => a + (c.outTok || 0) + (c.promptTok || 0), 0),
    attemptedTools: attempted,
    controllerRefusals: refusals.map((r) => ({ tool: r.tool, reason: r.reason })),
  };
}

console.log(`PROTOCOL-2 START ${new Date().toISOString()}`);
console.log(`model: ${MODEL_URL}   order: frozen in PROTOCOL-2_SCHEDULE.md`);
console.log(`limits: ${PER_TASK_SEC}s/run, ${TOTAL_SEC}s total, ${RESERVE_SEC}s reserve, no retries\n`);

const results = [];
let idx = 0;
let truncatedAt = null;

for (const pair of PAIRS) {
  // PAIR RESERVATION. Adjacency does not guarantee a complete pair: a pair begun with 310s
  // left would strand its second run, which is the exact half-pair the ordering exists to
  // prevent. Both runs at maximum allowance plus cleanup must fit BEFORE the pair starts.
  const remaining = DEADLINE - Date.now();
  if (remaining < PAIR_RESERVE_MS) {
    if (!truncatedAt) {
      truncatedAt = `replicate ${pair.rep}, ${pair.task}`;
      console.log(`\n-- budget reserve reached: ${Math.round(remaining / 1000)}s left, a pair needs ${PAIR_RESERVE_MS / 1000}s. Remaining runs UNATTEMPTED. --`);
    }
    for (const a of pair.arms) {
      idx++;
      results.push({ idx, rep: pair.rep, task: pair.task, arm: a, termination: 'UNATTEMPTED', reason: 'pair reservation not satisfiable within the budget' });
    }
    continue;
  }

  for (const armName of pair.arms) {
    idx++;
    const r = await runOne(pair.task, armName, idx);
    r.rep = pair.rep;
    results.push(r);
    console.log(`r${pair.rep} ${String(idx).padStart(2)}. ${pair.task} [${armName}] ${r.termination} req=${r.requested} prot=${r.protected} ${r.disposition} calls=${r.modelCalls} ${r.elapsedSec}s refusals=${r.controllerRefusals?.length ?? 0}`);
  }
}
const arms = {};
for (const a of ['CONTROL', 'TREATMENT']) {
  // SPEND IS COUNTED OVER EVERY ATTEMPTED RUN, successes and failures alike. Counting only
  // successes would let a cheap arm look efficient by failing early.
  const rs = results.filter((r) => r.arm === a && r.termination !== 'UNATTEMPTED');
  arms[a] = {
    runs: rs.length,
    acceptedImprovements: rs.filter((r) => r.accepted).length,
    requestedPass: rs.filter((r) => r.requested === VERDICT.PASS).length,
    protectedRetained: rs.filter((r) => r.protected === VERDICT.PASS).length,
    protectedBroken: rs.filter((r) => r.protected === VERDICT.FAIL).length,
    evalErrors: rs.filter((r) => r.requested === VERDICT.EVALUATION_ERROR || r.protected === VERDICT.EVALUATION_ERROR).length,
    modelCalls: rs.reduce((x, r) => x + (r.modelCalls || 0), 0),
    tokens: rs.reduce((x, r) => x + (r.tokens || 0), 0),
    seconds: rs.reduce((x, r) => x + (r.elapsedSec || 0), 0),
    toolsExecuted: rs.reduce((x, r) => x + (r.attemptedTools?.length || 0), 0),
    controllerRefusals: rs.reduce((x, r) => x + (r.controllerRefusals?.length || 0), 0),
  };
}

const byReplicate = {};
for (const r of results) {
  const k = `rep${r.rep}`;
  (byReplicate[k] ||= []).push({ task: r.task, arm: r.arm, accepted: !!r.accepted, requested: r.requested ?? null, protected: r.protected ?? null, disposition: r.disposition ?? null });
}

const report = { experiment: 'PROTOCOL-2', controller: 'v2', kind: 'DEVELOPMENT COMPARISON (already-inspected tasks)', at: new Date().toISOString(), model: MODEL_URL, order: PAIRS, arms, byReplicate, truncatedAt, results, root: ROOT };
writeFileSync(join(ROOT, 'PROTOCOL-2_REPORT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('\n=== ARMS ===');
console.log(JSON.stringify(arms, null, 2));
console.log(`\nreport: ${join(ROOT, 'PROTOCOL-1_REPORT.json')}`);
console.log('PROTOCOL-2 COMPLETE');
