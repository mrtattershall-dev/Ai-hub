/**
 * fuzzLoop.mjs - throw recorded real model output at the loop in many orders, and look for
 * anything that breaks.
 *
 *   node server/fuzzLoop.mjs [iterations=12] [goalsPerIteration=4] [firstSeed=1]
 *   node server/fuzzLoop.mjs 1 4 37          # re-run exactly the iteration that failed
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
import { checkInvariants } from './fuzzInvariants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const live = new Set();   // hub children still running - killed on ANY exit so no port is left held
const ITER = parseInt(process.argv[2] || '12', 10);
const PER = parseInt(process.argv[3] || '4', 10);
const SEED0 = parseInt(process.argv[4] || '1', 10);
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const acting = rows.filter((r) => r.actions.length > 0);

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
  const order = shuffle(acting, r);
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
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
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
  for (const goal of goals) {
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
    if (!run || !['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) || run.busy) {
      v.push(`HANG: "${goal.slice(0, 40)}" never reached a terminal state (last: ${run?.status}${run?.busy ? ', still tearing down' : ''}, denied ${denied})`);
    }
    statuses.push(run?.status);
  }

  // ── invariants ─ one source of truth, shared with fuzzInvariants.test.mjs, which proves
  // each check actually fires on the damage it names.
  v.push(...checkInvariants(dir, { hubExitCode: hub.exitCode, hubLog: log.join('') }));

  hub.kill(); live.delete(hub); mock.close();
  return { seed, goals: goals.length, served, statuses, violations: v, dir };
}

// A campaign that dies must still leave its tally.
//
// Campaign A of the first fuzz run exited 127 after 10 of 40 iterations, with no summary and
// no stack trace. The per-iteration lines survived in the log, but nothing said how many were
// clean or what kinds had failed, and whatever killed it left its hub children holding ports.
// Results now stream to a JSONL file as each iteration finishes, the summary prints on every
// exit path, and live hubs are killed on the way out.
const OUT = process.env.FUZZ_OUT || join(tmpdir(), `fuzz-results-${SEED0}-${Date.now()}.jsonl`);
console.log(`fuzzing: ${ITER} iterations x ${PER} goals, seeds ${SEED0}..${SEED0 + ITER - 1}, corpus ${acting.length} acting responses`);
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
    console.log('reproduce one:     node server/fuzzLoop.mjs 1 ' + PER + ' ' + bad[0].seed);
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
  try { appendFileSync(OUT, JSON.stringify({ seed, served: res.served, statuses: res.statuses, violations: res.violations }) + '\n'); }
  catch { /* the console line below is still the record */ }
  const mark = res.violations.length ? 'FAIL' : 'ok  ';
  console.log(`  ${mark} seed ${String(seed).padStart(3)}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  replayed ${String(res.served).padStart(3)}  [${(res.statuses || []).join(',')}]`);
  for (const x of res.violations) console.log(`         ${x}`);
}
summarize();
process.exit(all.some((r) => r.violations.length) ? 1 : 0);
