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
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
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
      AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = []; hub.stdout.on('data', (d) => log.push(d.toString())); hub.stderr.on('data', (d) => log.push(d.toString()));
  const API = `http://127.0.0.1:${hubPort}/api`;
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
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
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'].includes(run.status)) break;
      await new Promise((ok) => setTimeout(ok, 400));
    }
    if (!run || !['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'].includes(run.status)) {
      v.push(`HANG: "${goal.slice(0, 40)}" never reached a terminal state (last: ${run?.status})`);
    }
    statuses.push(run?.status);
  }

  // ── invariants ────────────────────────────────────────────────────────────
  if (hub.exitCode !== null) v.push(`CRASH: hub exited ${hub.exitCode}: ${log.join('').slice(-200).replace(/\s+/g, ' ')}`);

  const pkg = join(ws, 'package.json');
  if (existsSync(pkg)) {
    const raw = readFileSync(pkg, 'utf8');
    try { const j = JSON.parse(raw); if (j.type !== 'commonjs' || raw.length < 100) v.push(`MARKER: type=${j.type} ${raw.length}B`); }
    catch { v.push(`MARKER: package.json is not valid JSON (${raw.length}B)`); }
  }

  if (existsSync(ws)) {
    for (const f of readdirSync(ws).filter((x) => /\.(c|m)?js$/i.test(x))) {
      try { execFileSync(process.execPath, ['--check', join(ws, f)], { timeout: 15000, stdio: 'pipe' }); }
      catch { v.push(`BROKEN: ${f} does not parse`); }
    }
  }

  // Nothing may appear beside the workspace except what the harness put there.
  const allowed = new Set(['workspace', 'hub.json', 'queue.json', 'runs', 'index.jsonl', 'hub.json.bak', 'queue.json.bak']);
  for (const f of readdirSync(dir)) if (!allowed.has(f) && !/\.(bak|tmp)$/.test(f)) v.push(`STRAY: ${f} written beside the workspace`);

  // The workspace repo must be its OWN - a real past bug committed agent checkpoints into the
  // hub's own source tree because git walked UP to the nearest .git.
  if (existsSync(join(ws, '.git'))) {
    try {
      const top = execFileSync('git', ['-C', ws, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(resolve(ws)) } }).trim();
      if (resolve(top).toLowerCase() !== resolve(ws).toLowerCase()) v.push(`GIT: workspace repo resolves to ${top}`);
    } catch (e) { v.push(`GIT: could not resolve the workspace repo (${String(e.message).slice(0, 60)})`); }
  }

  // Every persisted run must be valid JSON - a truncated run file loses the history.
  const runsDir = join(dir, 'runs');
  if (existsSync(runsDir)) {
    for (const f of readdirSync(runsDir)) {
      try { JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { v.push(`RUNFILE: ${f} is not valid JSON`); }
    }
  }
  const idx = join(dir, 'index.jsonl');
  if (existsSync(idx)) {
    readFileSync(idx, 'utf8').split('\n').filter(Boolean).forEach((l, i) => {
      try { JSON.parse(l); } catch { v.push(`INDEX: line ${i + 1} is not valid JSON`); }
    });
  }

  hub.kill(); mock.close();
  return { seed, goals: goals.length, served, statuses, violations: v, dir };
}

console.log(`fuzzing: ${ITER} iterations x ${PER} goals, seeds ${SEED0}..${SEED0 + ITER - 1}, corpus ${acting.length} acting responses\n`);
const all = [];
for (let k = 0; k < ITER; k++) {
  const seed = SEED0 + k;
  const t0 = Date.now();
  const res = await iteration(seed).catch((e) => ({ seed, violations: [`HARNESS: ${e.message}`], served: 0, statuses: [] }));
  all.push(res);
  const mark = res.violations.length ? 'FAIL' : 'ok  ';
  console.log(`  ${mark} seed ${String(seed).padStart(3)}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  replayed ${String(res.served).padStart(3)}  [${(res.statuses || []).join(',')}]`);
  for (const x of res.violations) console.log(`         ${x}`);
}

const bad = all.filter((r) => r.violations.length);
const kinds = {};
for (const r of bad) for (const x of r.violations) { const k = x.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; }
console.log(`\n${all.length - bad.length}/${all.length} iterations clean`);
if (bad.length) {
  console.log('violations by kind:', JSON.stringify(kinds));
  console.log('reproduce one:     node server/fuzzLoop.mjs 1 ' + PER + ' ' + bad[0].seed);
}
process.exit(bad.length ? 1 : 0);
