/**
 * fuzzLoop.mjs - throw recorded real model output at the loop in many orders, and look for
 * anything that breaks.
 *
 *   node server/fuzzLoop.mjs [iterations=12] [goalsPerIteration=4] [firstSeed=1] [--mode=...]
 *   node server/fuzzLoop.mjs 1 4 37          # re-run exactly the iteration that failed
 *   node server/fuzzLoop.mjs 20 4 1 --mode=hostile         # only the nastiest real replies
 *   node server/fuzzLoop.mjs 20 4 1 --mode=chain           # one ordered chain, supervisor on
 *   node server/fuzzLoop.mjs 20 4 1 --mode=hostile,chain   # both
 *
 * MODES (the flag may go anywhere; positional arguments keep their meaning):
 *   default  the whole acting corpus, shuffled; the harness starts each goal itself and
 *            answers approvals itself. Unchanged from before modes existed.
 *   hostile  serve ONLY the replies fuzzCorpus.mjs classes as hostile: multi-action, first
 *            action writes package.json, leaked line-number prefixes in a fence, no THOUGHT
 *            outside a planner turn. The pool is printed per category at start. Implies
 *            --settle.
 *   --settle (flag, any mode) after each goal, wait until the run's FINAL state is on disk
 *            before checking or starting the next goal - otherwise the check races the
 *            hub's end-of-run syntax rollback (see waitFinal). Off in default mode so that
 *            mode's behaviour is unchanged; add it to re-check a BROKEN from a default run.
 *   chain    AGENT_SUPERVISOR=1 with the shortest tick (15s) and approval timeout (1 min) the
 *            hub accepts. The goals are queued as ONE ordered chain, each `after` the one
 *            before; the head is started and the supervisor drives the rest, denying stale
 *            approvals itself. Once nothing is running and the queue has stopped changing
 *            (or a deadline passes), checkQueueInvariants adds STRANDED / ORPHAN / QUEUEFILE
 *            to the usual checks.
 *
 * mockLoop.test.mjs replays ONE fixed sequence. That proves the loop survives that sequence.
 * The bugs found today all depended on ORDER - a marker write only destroys the marker if it
 * lands before anything that would have rescued it; a broken edit only survives if a
 * checkpoint commits it before teardown. So this shuffles the corpus with a seeded PRNG,
 * drives a fresh isolated hub per iteration, and checks invariants after each.
 *
 * Every violation prints the seed that produced it. Reproducible exactly, no GPU.
 *
 * A REPLAY CANNOT REACT. It proves the loop SURVIVES real output, never that it makes
 * progress - so this checks for damage, hangs and crashes, and never scores a goal.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { checkInvariants, checkQueueInvariants } from './fuzzInvariants.mjs';
import { HOSTILE, hostileCategories } from './fuzzCorpus.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const live = new Set();   // hub children still running - killed on ANY exit so no port is left held
const ARGV = process.argv.slice(2);
const POS = ARGV.filter((a) => !a.startsWith('--'));
const FLAGS = Object.fromEntries(ARGV.filter((a) => a.startsWith('--'))
  .map((a) => { const [k, ...x] = a.slice(2).split('='); return [k, x.join('=') || true]; }));
const ITER = parseInt(POS[0] || '12', 10);
const PER = parseInt(POS[1] || '4', 10);
const SEED0 = parseInt(POS[2] || '1', 10);
const MODES = new Set(String(FLAGS.mode || 'default').split(',').map((m) => m.trim()).filter(Boolean));
for (const m of MODES) {
  if (!['default', 'hostile', 'chain'].includes(m)) {
    console.error(`unknown --mode=${m}: use default, hostile or chain (comma-combine, e.g. --mode=hostile,chain)`);
    process.exit(2);
  }
}
const HOSTILE_POOL = MODES.has('hostile');
const CHAIN = MODES.has('chain');
const MODE = [...MODES].filter((m) => m !== 'default').join(',');   // '' = default mode
// --settle: wait for each run's end-of-run block before checking or moving on (see waitFinal).
// Implied by hostile; opt-in for default so default mode's behaviour stays exactly as it was.
const SETTLE = HOSTILE_POOL || FLAGS.settle === true;
const MODE_ARG = (MODE ? ` --mode=${MODE}` : '') + (SETTLE && !HOSTILE_POOL ? ' --settle' : '');
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const acting = rows.filter((r) => r.actions.length > 0);

// hostile: every reply in at least one category - NOT only acting ones. A reply with no
// THOUGHT and no parseable action is exactly the kind of input the loop has to survive.
const hostileCount = Object.fromEntries(Object.keys(HOSTILE).map((k) => [k, 0]));
const hostile = HOSTILE_POOL
  ? rows.filter((r) => { const c = hostileCategories(r); for (const k of c) hostileCount[k]++; return c.length > 0; })
  : [];
const pool = HOSTILE_POOL ? hostile : acting;

// mulberry32 - small, fast, and identical on every machine, which is the whole point.
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

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

async function iteration(seed) {
  const r = rng(seed);
  const order = shuffle(pool, r);
  const goals = shuffle(GOAL_POOL, r).slice(0, PER);
  const [mockPort, hubPort] = await freePorts(2);

  let served = 0;
  const mock = createServer((req, res) => {
    if (req.url === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"engine":"mock","lora":null}'); }
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const text = order[served++ % order.length].text;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'fuzz', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((ok) => mock.listen(mockPort, '127.0.0.1', ok));

  const dir = mkdtempSync(join(tmpdir(), `fuzz${seed}-`));
  const ws = join(dir, 'workspace');
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'fuzz' } }, history: [], settings: {} }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws,
      AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: CHAIN ? '1' : '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      // chain: the shortest tick and approval timeout the hub accepts (its floors are 15s / 1 min).
      ...(CHAIN ? { AGENT_TICK_S: '15', AGENT_APPROVAL_TIMEOUT_MIN: '1' } : {}),
      AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  live.add(hub);
  const log = []; hub.stdout.on('data', (d) => log.push(d.toString())); hub.stderr.on('data', (d) => log.push(d.toString()));
  const API = `http://127.0.0.1:${hubPort}/api`;
  // Read the body as TEXT first. A route that throws gets Express's default error handler,
  // which answers with an HTML page holding the stack trace - and `.json()` on that throws
  // "Unexpected token '<'", discarding the one thing that says what went wrong. Seed 39 hit
  // exactly that on the 4th /agent/start of an iteration, and all the report could say was
  // that the reply was not JSON.
  const api = async (p, o) => {
    const res = await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) });
    const body = await res.text();
    try { return JSON.parse(body); }
    catch { throw new Error(`HTTP ${res.status} non-JSON from ${p}: ${body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}`); }
  };
  for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((ok) => setTimeout(ok, 250)); } }

  const v = [];                       // violations
  const statuses = [];
  if (CHAIN) {
    const c = await driveChain(api, goals);
    v.push(...c.violations);
    statuses.push(...c.statuses);
  }
  for (const goal of CHAIN ? [] : goals) {
    let s;
    try { s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) }); }
    catch (e) { v.push(`START threw: ${e.message}`); continue; }
    if (!s.runId) { v.push(`START refused: ${JSON.stringify(s).slice(0, 100)}`); continue; }
    const deadline = Date.now() + 4 * 60000;
    let run = null;
    let denied = 0;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      // Answer approvals the way the supervisor tick does in production: a stale request is
      // DENIED, never approved. The first version of this fuzzer ran with the supervisor off,
      // so nobody answered, a parked run held the workspace lock, and every later goal was
      // refused - 14 false violations in one campaign, each of them `rm <file>`, which is
      // exactly what SHOULD need a human. That was the harness, not the hub.
      if (run && run.status === 'awaiting_approval') {
        if (denied >= 5) await api(`/agent/${s.runId}/stop`, { method: 'POST', body: '{}' }).catch(() => null);
        else { denied++; await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: false }) }).catch(() => null); }
        await new Promise((ok) => setTimeout(ok, 400));
        continue;
      }
      // Terminal is not finished: the syntax rollback runs in teardown AFTER the status flips,
      // and `busy` stays set until it is done. Seed 14 checked the workspace the moment it saw
      // 'stopped', then killed the hub mid-rollback, and reported p1_calc.js BROKEN although its
      // history held a version that parsed - the repair simply had not happened yet.
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && !run.busy) break;
      await new Promise((ok) => setTimeout(ok, 400));
    }
    // A run still waiting on a human at the deadline IS a stall now - denials are answered
    // above, so anything left parked means the denial path itself did not resume the run.
    // main waits for busy:false above, and busy now clears only once the end-of-run block has
    // restored files and persisted - so a run still busy at the deadline is a HANG too.
    // --settle's on-disk check is kept as a second, independent witness of the same thing.
    if (!run || !['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) || run.busy) {
      v.push(`HANG: "${goal.slice(0, 40)}" never reached a terminal state (last: ${run?.status}${run?.busy ? ', still tearing down' : ''}, denied ${denied})`);
    } else if (SETTLE && !(await waitFinal(dir, s.runId))) {
      v.push(`HANG: "${goal.slice(0, 40)}" reported ${run.status} but never persisted its final state (end-of-run block still going after 90s)`);
    }
    statuses.push(run?.status);
  }

  // ── invariants ─ one source of truth, shared with fuzzInvariants.test.mjs, which proves
  // each check actually fires on the damage it names.
  v.push(...checkInvariants(dir, { hubExitCode: hub.exitCode, hubLog: log.join('') }));
  if (CHAIN) v.push(...checkQueueInvariants(dir));

  hub.kill(); live.delete(hub); mock.close();
  return { seed, goals: goals.length, served, statuses, violations: v, dir };
}

// ── chain mode ──────────────────────────────────────────────────────────────────────────
// The supervisor, not the harness, drives: it pulls the next link when a run ends 'done',
// denies approvals left unanswered for AGENT_APPROVAL_TIMEOUT_MIN, resumes interrupted runs,
// and picks up runnable work on its tick. The harness only queues, starts the head, and
// waits for the chain to SETTLE - nothing running, and the queue and run list unchanged for
// longer than two ticks - because the queue invariants only mean something at rest.
const LIVE = ['running', 'awaiting_approval', 'interrupted'];
const SETTLE_MS = 40000;             // > 2 supervisor ticks of 15s
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// A run's status turns terminal in the API BEFORE its end-of-run block runs: agent.js sets
// 'stopped' / 'done' inside the loop, then its `finally` restores any .js that no longer
// parses from git history, writes the trace and index line, and only THEN persists the run.
// The default loop checks invariants and kills the hub the moment it sees the terminal
// status - measured 2026-09-10: in 122 of 153 default/hostile iteration dirs the last run was
// still 'running' on disk, i.e. the hub died before that block finished. A BROKEN file the
// rollback would have restored is then reported anyway (hostile seed 6: p1_calc.js, with a
// parseable version sitting in git history). The final persist is the last thing the block
// does, so a terminal status ON DISK means the rollback is over.
const FINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];
async function waitFinal(dir, runId, ms = 90000) {
  const f = join(dir, 'runs', `${runId}.json`);
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if (FINAL.includes(JSON.parse(readFileSync(f, 'utf8')).status)) return true; } catch { /* mid-write or not yet there */ }
    await sleep(300);
  }
  return false;
}

async function driveChain(api, goals) {
  const v = [];
  const ids = [];
  let prev = null;
  for (const goal of goals) {
    let q;
    try { q = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) }); }
    catch (e) { v.push(`QUEUE threw: ${e.message}`); break; }
    const id = q?.item?.id || q?.id;
    if (!id) { v.push(`QUEUE refused: ${JSON.stringify(q).slice(0, 100)}`); break; }
    ids.push(id); prev = id;
  }
  if (!ids.length) return { violations: v, statuses: [] };

  let s = null;
  try { s = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: ids[0] }) }); }
  catch (e) { v.push(`START threw: ${e.message}`); }
  if (s && !s.runId) v.push(`START refused: ${JSON.stringify(s).slice(0, 100)}`);

  const budgetMin = goals.length * 5 + 3;
  const deadline = Date.now() + budgetMin * 60000;
  let sig = '', since = Date.now(), items = [], runList = [], settled = false;
  while (Date.now() < deadline) {
    await sleep(2000);
    const q = await api('/agent/queue').catch(() => null);
    const l = await api('/agent/list').catch(() => null);
    if (!q || !Array.isArray(q.items) || !Array.isArray(l)) continue;
    items = q.items; runList = l;
    const now = JSON.stringify([items.map((i) => [i.id, i.status, i.after]), runList.map((x) => [x.id, x.status, x.steps])]);
    if (now !== sig) { sig = now; since = Date.now(); }
    const busy = runList.some((x) => LIVE.includes(x.status));
    const open = items.some((i) => ['queued', 'taken'].includes(i.status));
    if (!busy && (!open || Date.now() - since >= SETTLE_MS)) { settled = true; break; }
  }
  if (!settled) {
    v.push(`HANG: chain did not settle in ${budgetMin} min (runs: ${runList.map((x) => x.status).join(',')}; items: ${items.map((i) => i.status).join(',')})`);
  }
  // Final state of every item in queue order; R: marks a repair the hub spliced in.
  return { violations: v, statuses: items.map((i) => (i.repairOf ? 'R:' : '') + i.status) };
}

// A campaign that dies must still leave its tally.
//
// Campaign A of the first fuzz run exited 127 after 10 of 40 iterations, with no summary and
// no stack trace. The per-iteration lines survived in the log, but nothing said how many were
// clean or what kinds had failed, and whatever killed it left its hub children holding ports.
// Results now stream to a JSONL file as each iteration finishes, the summary prints on every
// exit path, and live hubs are killed on the way out.
const OUT = process.env.FUZZ_OUT || join(tmpdir(), `fuzz-results-${SEED0}-${Date.now()}.jsonl`);
console.log(`fuzzing: ${ITER} iterations x ${PER} goals, seeds ${SEED0}..${SEED0 + ITER - 1}, corpus ${pool.length} ${HOSTILE_POOL ? 'hostile' : 'acting'} responses${MODE ? `, mode ${MODE}` : ''}`);
if (HOSTILE_POOL) {
  console.log(`hostile pool (a reply can be in several): ${Object.entries(hostileCount).map(([k, n]) => `${k}=${n}`).join('  ')}  -> ${hostile.length} distinct`);
}
console.log(`results: ${OUT}\n`);
const all = [];
let summarized = false;
const summarize = (why) => {
  if (summarized) return;
  summarized = true;
  for (const h of live) { try { h.kill(); } catch { /* already gone */ } }
  const bad = all.filter((r) => r.violations.length);
  const kinds = {};
  for (const r of bad) for (const x of r.violations) { const k = x.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; }
  console.log(`\n${all.length - bad.length}/${all.length} iterations clean${why ? `  (${why})` : ''}`);
  if (bad.length) {
    console.log('violations by kind:', JSON.stringify(kinds));
    console.log('reproduce one:     node server/fuzzLoop.mjs 1 ' + PER + ' ' + bad[0].seed + MODE_ARG);
  }
  if (all.length < ITER) console.log(`INCOMPLETE: only ${all.length} of ${ITER} iterations ran`);
};
process.on('SIGINT', () => { summarize('interrupted'); process.exit(130); });
process.on('SIGTERM', () => { summarize('terminated'); process.exit(143); });
process.on('exit', () => summarize());
// Recorded, not swallowed silently - a stray rejection from a mock socket must not end the
// campaign, but it must not disappear either.
process.on('unhandledRejection', (e) => { console.log(`  HARNESS unhandledRejection: ${String((e && e.message) || e).slice(0, 160)}`); });

for (let k = 0; k < ITER; k++) {
  const seed = SEED0 + k;
  const t0 = Date.now();
  const res = await iteration(seed).catch((e) => ({ seed, violations: [`HARNESS: ${e.message}`], served: 0, statuses: [] }));
  all.push(res);
  try { appendFileSync(OUT, JSON.stringify({ seed, ...(MODE ? { mode: MODE } : {}), served: res.served, statuses: res.statuses, violations: res.violations }) + '\n'); }
  catch { /* the console line below is still the record */ }
  const mark = res.violations.length ? 'FAIL' : 'ok  ';
  console.log(`  ${mark} seed ${String(seed).padStart(3)}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  replayed ${String(res.served).padStart(3)}  [${(res.statuses || []).join(',')}]`);
  for (const x of res.violations) console.log(`         ${x}`);
}
summarize();
process.exit(all.some((r) => r.violations.length) ? 1 : 0);
