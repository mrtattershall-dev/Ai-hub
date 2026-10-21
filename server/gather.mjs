/**
 * gather.mjs - collect real local-model runs, unattended, until stopped.
 *
 *   node server/gather.mjs [firstSeed=1] [goalsPerSession=5]
 *   node server/gather.mjs --experiment REL-1      a preregistered experiment's fixed plan, then stop (REL-1, REL-2)
 *
 * The fuzzer replays RECORDED replies, so it can find damage but never shows what the model does next.
 * This is the live counterpart: the real model (AGENT_PROVIDER=ollama, qwen2.5-coder:7b) against the SAME
 * goal pool the fuzzer uses, so a failure seen here can be looked for there and the other way round.
 *
 * Each session is a fresh isolated hub (testHarness.startHub) with its own workspace, runs, queue and
 * port, so it never touches the owner's hub or workspace. Goals run one at a time on the shared session
 * workspace, in a seeded order: later goals build on what earlier ones left ("the EXISTING p1_calc.js").
 *
 * Unattended means nothing waits for a click: AGENT_APPROVAL_MODE=build, with every command executed in the
 * isolated Docker worker (AGENT_WORKER_EXEC=1: no network, only the workspace mounted). The hard denylist
 * still applies. An approval that is asked for anyway is denied after APPROVAL_WAIT, and that is recorded.
 *
 * The Watchers review each finished run (WATCHERS=1, budget in .env); their verdicts land in server/enoch.
 *
 * Output, all under data/gather/:
 *   sessions.jsonl   one line per goal: seed, goal, run id, status, finish, calls, minutes
 *   traces/          the hub's trace rows for these runs (real model output, kept apart from the human corpus)
 *   run-index.jsonl  the hub's run index for these runs
 *   s<seed>/         that session's hub: workspace, runs, transcripts - kept, it is the evidence
 *   gather.pid       this process
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHub } from './testHarness.mjs';
import { enochPath } from './watchers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.env.GATHER_OUT || join(HERE, '..', 'data', 'gather'));
const FIRST = parseInt(/^\d+$/.test(process.argv[2] || '') ? process.argv[2] : '1', 10);
const PER = parseInt(/^\d+$/.test(process.argv[3] || '') ? process.argv[3] : '5', 10);
// Per goal, and only a safety net: local compute is free, so wall time is not a cost (owner, 2026-10-21). A run cut by
// the clock measures the clock, so runs end on their own - finish, failure or the 250-step cap. Was 20 then 45: a call
// takes 4-7 minutes on this CPU. The hub's own limit must fire first: that path finalizes the run (trace, Watchers).
const RUN_MINUTES = parseInt(process.env.GATHER_RUN_MINUTES || '240', 10);
// The hub's first-token wait defaults to 7 minutes, set for a GPU. On CPU the prompt read alone passed it, the hub
// called the model "unreachable" and PAUSED the run - not terminal, so no budget applied and nothing was reviewed.
const FIRST_BYTE_S = process.env.GATHER_FIRST_BYTE_S || '1200';
const APPROVAL_WAIT = 2 * 60_000;
const log = (s) => process.stdout.write(`${new Date().toISOString().slice(0, 19)} ${s}\n`);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// The fuzzer's pool, verbatim, so live and replay results are about the same work. Checked against
// fuzzLoop.mjs at start: if that pool changes, this says so rather than quietly drifting apart.
const GOAL_POOL = [
  'Create p1_calc.js exporting add(a,b) and mul(a,b), with self-checks that throw. Verify with node.',
  'Add sub(a,b) to the EXISTING p1_calc.js, keeping add and mul unchanged. Verify.',
  'In the EXISTING p1_calc.js, change ONLY mul so it throws on non-numeric input. Verify.',
  'Create p2_str.py with a function slug(s) plus asserts at the bottom, and run it with python.',
  'Write P1.md documenting every function that really exists in p1_calc.js. Read the file first.',
  'Create q1_math.js exporting add and mul, throwing a clear Error on bad input. Verify with node.',
  'Build index.html: a plain page with a button that increments a counter. Test it in the browser.',
  'Rename the function add to plus everywhere in p1_calc.js, including its self-checks. Verify.',
];
const fuzzSrc = readFileSync(join(HERE, 'fuzzLoop.mjs'), 'utf8');
const drift = GOAL_POOL.filter((g) => !fuzzSrc.includes(g));
if (drift.length) log(`WARNING: ${drift.length} goal(s) no longer in fuzzLoop.mjs's pool - live and fuzz results are no longer about the same goals`);

// Same PRNG as fuzzLoop.mjs, so a seed means the same thing in both.
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Goals that work on "the EXISTING p1_calc.js" are impossible in a fresh workspace unless the goal that creates it ran
// first. The fuzzer can shuffle freely (it replays, so nothing is asked of the model that it could not answer); a live
// run that starts on a missing file measures the setup, and the reviewer then blames the model for it. So the creator
// is moved before the first goal that needs it, or swapped in for the last unrelated goal if it was not drawn.
const CREATES = GOAL_POOL[0];
const needsP1 = (g) => g !== CREATES && /p1_calc\.js/.test(g);
function withPrerequisites(goals) {
  const first = goals.findIndex(needsP1);
  if (first < 0) return goals;
  const rest = goals.filter((g) => g !== CREATES);
  if (rest.length === goals.length) {
    const drop = rest.map(needsP1).lastIndexOf(false);
    if (drop >= 0) rest.splice(drop, 1); else rest.pop();
  }
  rest.splice(rest.findIndex(needsP1), 0, CREATES);
  return rest;
}

const TERMINAL = ['done', 'error', 'stopped', 'refused_d2', 'stopped_d2_restored'];
let image;
try { image = execFileSync('docker', ['image', 'inspect', 'legasus-worker:1', '--format', '{{.Id}}'], { encoding: 'utf8' }).trim(); }
catch { log('FATAL: worker image legasus-worker:1 not found - run ./start-hub-governed.sh once to build it'); process.exit(1); }

// Only the two providers a session needs, copied from the owner's hub. Owner-only file permissions.
const ownerDb = JSON.parse(readFileSync(join(HERE, 'hub.json'), 'utf8'));
const keys = { ollama: ownerDb.api_keys?.ollama, ...(ownerDb.api_keys?.claude ? { claude: ownerDb.api_keys.claude } : {}) };
if (!keys.ollama?.model) { log('FATAL: no Ollama model saved in the hub'); process.exit(1); }

mkdirSync(join(OUT, 'traces'), { recursive: true });
writeFileSync(join(OUT, 'gather.pid'), String(process.pid));
log(`gather: ${keys.ollama.model} | ${PER} goals/session from seed ${FIRST} | ${RUN_MINUTES} min/goal | watchers ${keys.claude ? 'on' : 'OFF (no Claude key)'} | out ${OUT}`);

// One session: a fresh isolated hub, the seed's goals in order, then the Watchers given time to finish.
// Returns false only when the hub never started, so an experiment can re-run that seed (REL-1: same seed, recorded).
async function session(seed, { tag = '', env: armEnv = {}, meta = {}, model = null } = {}) {
  const sk = model ? { ...keys, ollama: { ...keys.ollama, model } } : keys;
  const dir = join(OUT, `s${seed}${tag ? '-' + tag : ''}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: sk, history: [], settings: {} }));
  chmodSync(join(dir, 'hub.json'), 0o600);
  const goals = withPrerequisites(shuffle(GOAL_POOL, rng(seed)).slice(0, PER));

  let h;
  try {
    h = await startHub(dir, {
      env: {
        AGENT_PROVIDER: 'ollama', AGENT_APPROVAL_MODE: 'build', AGENT_MAX_MINUTES: String(RUN_MINUTES), MODEL_FIRST_BYTE_S: FIRST_BYTE_S,
        AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_IMAGE: image,
        AGENT_GOVERNED_WRITES: '', AGENT_SUPERVISOR: '',
        // LegaVerify / LegaGate (2026-10-21): no finish over a failing self-test; a memory and CPU ceiling on the
        // command worker. 1g, not more: the 7b already takes ~6 GB of this laptop's ~6.6 GB and the rest swaps.
        AGENT_FINISH_EVIDENCE: '1', AGENT_WEB_QUARANTINE: '1', AGENT_WORKER_MEMORY: process.env.AGENT_WORKER_MEMORY || '1g', AGENT_WORKER_CPUS: process.env.AGENT_WORKER_CPUS || '2',
        AGENT_TRACES_DIR: join(OUT, 'traces'), RUN_INDEX: join(OUT, 'run-index.jsonl'),
        WATCHERS: keys.claude ? '1' : '0', WATCHERS_BUDGET_USD: process.env.WATCHERS_BUDGET_USD || '10',
        ...armEnv,
      },
    });
  } catch (e) {
    log(`SESSION ${seed}: hub failed to start - ${e.message.split('\n')[0]}`);
    appendFileSync(join(OUT, 'sessions.jsonl'), JSON.stringify({ at: new Date().toISOString(), seed, ...meta, error: `hub start: ${e.message.slice(0, 300)}` }) + '\n');
    await sleep(60_000);
    return false;
  }

  const sessionIds = [];
  for (const [i, goal] of goals.entries()) {
    const t0 = Date.now();
    const row = { at: new Date().toISOString(), seed, ...meta, i, goal, model: sk.ollama.model };
    try {
      const started = await h.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
      if (!started.runId) throw new Error(`start refused: ${started.error || JSON.stringify(started).slice(0, 200)}`);
      const id = row.runId = started.runId;
      sessionIds.push(id);
      let run, askedAt = null;
      for (;;) {
        await sleep(5000);
        if (h.died()) throw new Error(`hub died: ${h.died()}`);
        run = await h.api(`/agent/${id}`);
        if (TERMINAL.includes(run.status) && !run.busy) break;
        if (run.status === 'awaiting_approval') {
          askedAt ??= Date.now();
          if (Date.now() - askedAt > APPROVAL_WAIT) {
            row.deniedApproval = String(run.pending?.args?.command || run.pending?.tool || '?').slice(0, 200);
            await h.api(`/agent/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve: false }) });
            askedAt = null;
          }
        } else askedAt = null;
        // Backstop only. /stop does not finalize a run (no trace, no review), so it must be rare: the hub's limit comes first.
        if (!row.harnessStopped && Date.now() - t0 > (RUN_MINUTES + 30) * 60_000) {
          await h.api(`/agent/${id}/stop`, { method: 'POST', body: '{}' });
          row.harnessStopped = true;
        }
      }
      Object.assign(row, { status: run.status, finish: run.finishKind || null, modelCalls: run.modelCalls, steps: run.steps?.length || 0 });
    } catch (e) {
      row.error = String(e.message).slice(0, 300);
    }
    row.minutes = +((Date.now() - t0) / 60000).toFixed(1);
    appendFileSync(join(OUT, 'sessions.jsonl'), JSON.stringify(row) + '\n');
    log(`s${seed}${tag ? '-' + tag : ''} ${i + 1}/${goals.length} ${row.status || 'ERROR'}${row.finish ? '/' + row.finish : ''} ${row.minutes}m ${row.modelCalls ?? '-'} calls | ${goal.slice(0, 60)}${row.error ? ' | ' + row.error : ''}`);
    if (row.error && h.died()) break;
  }

  // The Watchers review inside the session's hub, one at a time, after each run. Killing the hub early
  // would lose a review mid-call, so wait until Enoch has stopped growing for this session's runs.
  if (keys.claude) {
    const ids = new Set(sessionIds);
    const reviewed = () => { try { return readFileSync(enochPath(), 'utf8').split('\n').filter((l) => [...ids].some((id) => l.includes(id))).length; } catch { return 0; } };
    let last = -1, stableSince = Date.now();
    const until = Date.now() + 15 * 60_000;
    while (Date.now() < until) {
      const n = reviewed();
      if (n !== last) { last = n; stableSince = Date.now(); }
      if (n >= ids.size || Date.now() - stableSince > 150_000) break;
      await sleep(10_000);
    }
  }
  try { h.hub.kill(); } catch { /* already gone */ }
  await sleep(3000);
  return true;
}

// A preregistered experiment runs its fixed plan and stops; there is no extension on the result.
// REL-1 (benchmarks/REL-1_REPEAT-WARN_PREREG.md, frozen at be11fb53): seeds 101-110, each on both arms, the arm
// order alternating by seed (odd: control first), AGENT_REPEAT_WARN the only difference.
const EXPERIMENTS = {
  'REL-1': {
    model: 'qwen3.5:4b',   // Amendment 1 (benchmarks/REL-1_AMENDMENT-1.md): the 7b was oom-killed twice on this laptop
    seeds: Array.from({ length: 10 }, (_, k) => 101 + k),
    arms: { control: { AGENT_REPEAT_WARN: '' }, treatment: { AGENT_REPEAT_WARN: '1' } },
    order: (seed) => (seed % 2 ? ['control', 'treatment'] : ['treatment', 'control']),
  },
  // REL-2 (benchmarks/REL-2_SPLIT-PROTOCOL_PREREG.md, frozen at c6dd4a8e): the split protocol. AGENT_REPEAT_WARN is
  // unset in both arms, so REL-1's treatment cannot leak into this comparison.
  'REL-2': {
    model: 'qwen3.5:4b',
    seeds: Array.from({ length: 10 }, (_, k) => 201 + k),
    arms: { control: { AGENT_JSON_ACTIONS: '', AGENT_REPEAT_WARN: '' }, treatment: { AGENT_JSON_ACTIONS: '1', AGENT_REPEAT_WARN: '' } },
    order: (seed) => (seed % 2 ? ['control', 'treatment'] : ['treatment', 'control']),
  },
};
const experiment = process.argv.includes('--experiment') ? process.argv[process.argv.indexOf('--experiment') + 1] : null;
if (experiment) {
  const x = EXPERIMENTS[experiment];
  if (!x) { log(`FATAL: no experiment ${experiment}`); process.exit(2); }
  log(`experiment ${experiment}: ${x.model || keys.ollama.model}, seeds ${x.seeds[0]}-${x.seeds.at(-1)}, arms ${Object.keys(x.arms).join('/')}`);
  for (const seed of x.seeds) {
    for (const arm of x.order(seed)) {
      let tries = 0;
      while (!(await session(seed, { tag: `${experiment}-${arm}`, env: x.arms[arm], meta: { experiment, arm }, model: x.model })) && ++tries < 5) { /* same seed again */ }
    }
  }
  log(`experiment ${experiment} complete - stopping (the plan is fixed; no extension)`);
  process.exit(0);
}
for (let seed = FIRST; ; seed++) await session(seed);
