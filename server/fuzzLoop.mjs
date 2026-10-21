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
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, appendFileSync, cpSync, mkdirSync, rmSync, statfsSync } from 'node:fs';
import { tmpdir, freemem, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { defNames } from './defNames.js';
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
// Stable corpus index of every reply, so a row can say WHICH replies were served in WHICH order
// without copying the text. Indices are into model-corpus.jsonl itself, not into `pool`.
const idxOf = new Map(rows.map((r, i) => [r, i]));

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

// ── DETAIL CAPTURE (fuzz2-detail) ───────────────────────────────────────────────────────────
// Everything in this block only OBSERVES. It never changes which replies are served, which goals
// run, which ports are used or how the hub is started, so a seed means exactly what it meant in
// earlier campaigns. Its purpose is to answer WHY a violation happened, not only that it did.
const clip = (s, n) => String(s ?? '').slice(0, n);
const cap = (x, n = 1500) => { try { return JSON.stringify(x).length <= n ? x : undefined; } catch { return undefined; } };
const gitOut = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });

// Machine pressure. The only crash seen so far (0xC0000409) and the spawnSync-git-UNKNOWN cascade
// both happened under load and never reproduced alone, so load has to be a recorded column.
function envSnap() {
  const s = { at: new Date().toISOString(), freeMemMB: Math.round(freemem() / 1048576), totalMemMB: Math.round(totalmem() / 1048576),
    rssMB: Math.round(process.memoryUsage().rss / 1048576), activeHandles: process.getActiveResourcesInfo?.().length ?? null, liveHubs: live.size };
  try { const f = statfsSync(tmpdir()); s.diskFreeGB = +((f.bavail * f.bsize) / 1073741824).toFixed(1); } catch { s.diskFreeGB = null; }
  try {
    const t = spawnSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    s.nodeProcs = t.status === 0 ? t.stdout.split('\n').filter((l) => l.startsWith('"node.exe"')).length : null;
  } catch { s.nodeProcs = null; }
  return s;
}

// M1 (RECOV-1): bad candidates = LANDED writes after which the hub's own check told the model the file does not parse.
// The tool step's `result` does NOT carry that note (agent.js appends syntaxNote only to the model-facing feedback), so
// it is read from the per-run transcripts. Each transcript entry's `sent` is the WHOLE conversation so far, so only the
// messages an entry ADDS over the previous one are counted - otherwise one failure is counted once per later turn.
const BAD_RE = /TOOL RESULT \((write_file|edit_file|append_file)\):\s*\n?OK[^\n]*?\b(?:to|in) ([^\s(]+)[\s\S]*?SYNTAX CHECK FAILED for ([^\s:]+)/g;
export function badCandidatesFromTranscripts(runsDir) {
  const out = {};
  let files = [];
  try { files = readdirSync(runsDir).filter((f) => f.endsWith('.transcript.jsonl')); } catch { return out; }
  for (const tf of files) {
    const runId = tf.replace('.transcript.jsonl', '');
    const hits = [];
    let prev = [];
    for (const line of readFileSync(join(runsDir, tf), 'utf8').split('\n').filter(Boolean)) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      const sent = Array.isArray(e.sent) ? e.sent : [];
      let k = 0;
      while (k < sent.length && k < prev.length && JSON.stringify(sent[k]) === JSON.stringify(prev[k])) k++;   // common prefix
      for (const m of sent.slice(k)) {
        if (m.role !== 'user') continue;
        // A tool-result message can hold several results (batch mode); split on the marker so each is judged alone.
        for (const part of String(m.content || '').split(/(?=TOOL RESULT \()/)) {
          BAD_RE.lastIndex = 0;
          const x = BAD_RE.exec(part);
          if (x) hits.push(`${e.n}:${x[1]}:${x[3]}`);
        }
      }
      prev = sent;
    }
    out[runId] = hits;
  }
  return out;
}

// What one goal's run actually did, from the run object the hub returns. `touches` is the ordered
// sequence of file operations and whether each landed (OK) or was refused/failed (ERR) - the thing
// needed to see HOW a file ended up in the state it did.
function summarizeRun(run, goal, denied, ms) {
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  const kinds = {}, errors = [], touches = [];
  for (const s of steps) {
    const k = s.type === 'tool' ? `tool:${s.tool}` : String(s.type);
    kinds[k] = (kinds[k] || 0) + 1;
    if (s.type === 'error' && errors.length < 8) errors.push(clip(s.text, 220));
    if (s.type === 'tool' && /^(write_file|edit_file|append_file|delete_file|read_file|run_command)$/.test(String(s.tool)) && touches.length < 40) {
      touches.push(`${s.n}:${s.tool}:${clip(s.args?.path || s.args?.cmd || '', 40)}:${/^OK/.test(String(s.result || '')) ? 'OK' : 'ERR'}`);
    }
  }
  return {
    goal: clip(goal, 80), runId: run?.id, status: run?.status ?? null, busy: !!run?.busy, ms, denied,
    steps: steps.length, modelCalls: run?.modelCalls, tokens: run?.tokens, stepKinds: kinds, touches, errors,
    policyRestoredFiles: cap(run?.policyRestoredFiles, 3000),
    repairRefused: !!run?.repairRefused, unrepairedFiles: run?.unrepairedFiles, rolledBack: !!run?.rolledBack,
    restoredFiles: cap(run?.restoredFiles), destructiveRefused: cap(run?.destructiveRefused), connRetries: run?.connRetries,
    ctxSquashes: run?.ctxSquashes, sameErr: run?.sameErr, callStats: cap(run?.callStats),
  };
}

const parses = (file) => {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  const err = r.status === 0 ? '' : String(r.stderr);
  return { ok: r.status === 0, esm: /ES module|Cannot use import statement|Unexpected token 'export'/i.test(err),
    err: clip(err.replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(0, 4).join(' | ').replace(/[A-Za-z]:[\\/][^\s|]*?[\\/]workspace[\\/]/g, ''), 260) };
};
// recov-exp FIX (2026-10-01): `node --check`'s verdict depends on the nearest package.json, not only on the bytes.
// The fuzz2 postmortem checked historical versions from a bare temp path while checking the live file inside the
// workspace (package.json type=commonjs), so an ESM file "had a parsing version" that was the SAME bytes. Every
// historical candidate is now checked in a box holding a copy of the workspace's package.json - the same context the
// hub's own quickCheck sees - and that box is outside the run dir so it cannot trip the STRAY invariant.
function parsesInContext(ws, name, buf) {
  const box = mkdtempSync(join(tmpdir(), 'pmctx-'));
  try {
    if (existsSync(join(ws, 'package.json'))) writeFileSync(join(box, 'package.json'), readFileSync(join(ws, 'package.json')));
    writeFileSync(join(box, name), buf);
    return parses(join(box, name));
  } finally { try { rmSync(box, { recursive: true, force: true }); } catch { /* scratch */ } }
}

// The end state of the workspace. For every .js that does not parse: the syntax error, how the file
// ends, and - the part earlier campaigns never recorded - whether ANY committed version of it parses.
// 895 of 895 broken files in the old kept dirs had one; the hub's end-of-run repair left them anyway.
function postmortem(ws) {
  const pm = { files: [], broken: [], esmOnly: [], commits: null, lastCommits: [] };
  try {
    for (const f of readdirSync(ws)) {
      if (f === '.git' || f === '__pycache__' || f === 'node_modules') continue;
      const p = join(ws, f);
      const st = statSync(p);
      if (!st.isFile()) continue;
      const rec = { f, bytes: st.size, sha256: createHash('sha256').update(readFileSync(p)).digest('hex') };
      pm.files.push(rec);
      if (!/\.js$/.test(f)) continue;
      const c = parses(p);
      // recov-exp: usable work = definitions in .js files that parse in their own workspace context. A definition inside
      // a file that does not parse cannot be required by anything, so it is counted separately, never as usable.
      const names = [...defNames(readFileSync(p, 'utf8'), f)];
      rec.parses = c.ok; rec.esm = !!c.esm; rec.defs = names.length;
      if (c.ok) { pm.usableDefs = (pm.usableDefs || 0) + names.length; pm.usableDefNames = [...(pm.usableDefNames || []), ...names.map((n) => `${f}:${n}`)]; }
      else pm.unusableDefs = (pm.unusableDefs || 0) + names.length;
      if (c.ok) continue;
      // ESM in a commonjs workspace is valid syntax under the other module system - reported apart, never as damage.
      if (c.esm) { pm.esmOnly.push(f); continue; }
      const cur = readFileSync(p);
      const b = { file: f, bytes: st.size, sha256: createHash('sha256').update(cur).digest('hex'), syntaxError: c.err, tail: clip(cur.toString('utf8').slice(-160), 160), goodVersion: null, goodVersionBack: null, commitsTouching: 0, checkedInContext: true };
      try {
        const shas = gitOut(ws, ['log', '--format=%h', '--', f]).split('\n').filter(Boolean);
        b.commitsTouching = shas.length;
        for (let i = 0; i < shas.length; i++) {
          const body = execFileSync('git', ['show', `${shas[i]}:${f}`], { cwd: ws, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 << 20, timeout: 20000 });
          if (parsesInContext(ws, f, body).ok) { b.goodVersion = shas[i]; b.goodVersionBack = i; b.goodBytes = body.length; b.goodSha256 = createHash('sha256').update(body).digest('hex'); break; }
        }
      } catch (e) { b.gitError = clip(e.message, 120); }
      pm.broken.push(b);
    }
    try { pm.commits = Number(gitOut(ws, ['rev-list', '--count', 'HEAD']).trim()); } catch { /* no repo */ }
    try { pm.lastCommits = gitOut(ws, ['log', '-n', '6', '--format=%h %s']).split('\n').filter(Boolean).map((l) => clip(l, 90)); } catch { /* no repo */ }
  } catch (e) { pm.error = clip(e.message, 160); }
  return pm;
}

// A durable copy of everything needed to investigate one failing iteration without the temp dir:
// the whole scratch dir minus .git/caches, the hub log, the last parsing version of each broken file
// (so a proposed fix can be tried against it), the workspace's git log, and the full row.
function writeEvidence(root, seed, dir, pm, detail) {
  const dest = join(root, String(seed));
  mkdirSync(dest, { recursive: true });
  cpSync(dir, dest, { recursive: true, force: true, filter: (src) => !/[\\/](\.git|__pycache__|node_modules)([\\/]|$)/.test(src) });
  const ws = join(dir, 'workspace');
  for (const b of pm.broken) {
    if (!b.goodVersion) continue;
    try { writeFileSync(join(dest, `${b.file}.GOOD-${b.goodVersion}`), execFileSync('git', ['show', `${b.goodVersion}:${b.file}`], { cwd: ws, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 << 20, timeout: 20000 })); } catch { /* best effort */ }
  }
  try { writeFileSync(join(dest, 'git-log.txt'), gitOut(ws, ['log', '--stat', '-n', '80', '--date=format:%H:%M:%S', '--format=%h %ad %s'])); } catch { /* no repo */ }
  writeFileSync(join(dest, 'detail.json'), JSON.stringify(detail, null, 1));
}

async function iteration(seed) {
  const r = rng(seed);
  const order = shuffle(pool, r);
  const goals = shuffle(GOAL_POOL, r).slice(0, PER);
  const [mockPort, hubPort] = await freePorts(2);

  let served = 0;
  const T0 = Date.now(), startedAt = new Date().toISOString();
  const envStart = envSnap();
  const replyIdx = [], promptChars = [];      // which corpus replies were served, in order, and how big each prompt was
  const mock = createServer((req, res) => {
    if (req.url === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"engine":"mock","lora":null}'); }
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const pick = order[served++ % order.length];
      if (replyIdx.length < 600) { replyIdx.push(idxOf.get(pick) ?? -1); promptChars.push(b.length); }
      const text = pick.text;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'fuzz', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((ok) => mock.listen(mockPort, '127.0.0.1', ok));

  const dir = mkdtempSync(join(tmpdir(), `fuzz${seed}-`));
  const ws = join(dir, 'workspace');
  // recov-exp: the hub's recovery log and preserved broken candidates live OUTSIDE the run dir (STRAY invariant) and
  // outside the `fuzz<seed>-` pattern the running campaign's cleanup sweeps.
  const recovDir = mkdtempSync(join(tmpdir(), `recov${seed}-`));
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'fuzz' } }, history: [], settings: {} }), 'utf8');
  // CRASH-2 DIAGNOSTIC DELTA 2 — isolated worktree only. --report-on-fatalerror may capture
  // nothing: a native fast-fail can terminate a process without a Node diagnostic report.
  // Supplementary evidence, never a substitute for the raw process log.
  const hub = spawn(process.execPath, [
    ...(process.env.FUZZ_RAW ? ['--report-on-fatalerror', `--report-directory=${process.env.FUZZ_RAW}`] : []),
    join(HERE, 'index.js')], {
    env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws,
      AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_META_DIR: join(dir, 'meta'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: CHAIN ? '1' : '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_RECOVERY_DIR: recovDir,
      // chain: the shortest tick and approval timeout the hub accepts (its floors are 15s / 1 min).
      ...(CHAIN ? { AGENT_TICK_S: '15', AGENT_APPROVAL_TIMEOUT_MIN: '1' } : {}),
      // Operational replay must use the same self-test finish safeguard as live collection.
      AGENT_FINISH_EVIDENCE: process.env.AGENT_FINISH_EVIDENCE ?? '1',
      AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '3', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  live.add(hub);
  // CRASH-2 DIAGNOSTIC DELTA 1 — isolated worktree only. `log` keeps its original merged
  // contents so checkInvariants sees byte-identical input; stdout and stderr are ALSO kept
  // apart and written raw on exit. The existing report keeps only slice(-200) of the merge,
  // which is simultaneously why the fatal line is missing and why 52 instances of one event
  // produced 52 distinct "kinds".
  const log = [];
  const rawOut = []; const rawErr = [];
  hub.stdout.on('data', (d) => { log.push(d.toString()); rawOut.push(d); });
  hub.stderr.on('data', (d) => { log.push(d.toString()); rawErr.push(d); });
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
  const hubReadyMs = Date.now() - T0;

  const v = [];                       // violations
  const statuses = [];
  const goalsDetail = [];
  if (CHAIN) {
    const c = await driveChain(api, goals);
    v.push(...c.violations);
    statuses.push(...c.statuses);
  }
  for (const goal of CHAIN ? [] : goals) {
    let s;
    const gT0 = Date.now();
    try { s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) }); }
    catch (e) { v.push(`START threw: ${e.message}`); goalsDetail.push({ goal: clip(goal, 80), startError: clip(e.message, 300), hubExitCode: hub.exitCode, hubSignal: hub.signalCode }); continue; }
    if (!s.runId) { v.push(`START refused: ${JSON.stringify(s).slice(0, 100)}`); goalsDetail.push({ goal: clip(goal, 80), startRefused: clip(JSON.stringify(s), 300) }); continue; }
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
    goalsDetail.push(summarizeRun(run, goal, denied, Date.now() - gT0));
  }

  // ── invariants ─ one source of truth, shared with fuzzInvariants.test.mjs, which proves
  // each check actually fires on the damage it names.
  v.push(...checkInvariants(dir, { hubExitCode: hub.exitCode, hubLog: log.join('') }));
  if (CHAIN) v.push(...checkQueueInvariants(dir));

  // CRASH-2 DIAGNOSTIC DELTA 1 (corrected). Written SYNCHRONOUSLY here, on the same code path
  // that produced the CRASH violation above, so the raw log and the report cannot disagree.
  //
  // The first version registered hub.on('exit') instead. It never fired: hub.kill() is async,
  // so the exit event is queued and the harness process ends before that event-loop turn.
  // A crash would have captured NOTHING and the silence would have read as "no diagnostic
  // available". Caught only because a non-crash positive control was run first.
  // fuzz2-detail: capture while the hub's state is still live. The raw capture below now fires only when
  // something went wrong (or FUZZ_RAW_ALL is set, which the positive control uses) - writing three
  // files per iteration for a campaign that runs for days would bury the failures it exists to keep.
  const hubLog = log.join('');
  try { writeFileSync(join(dir, 'hub.log'), hubLog); } catch { /* evidence only */ }
  const interesting = v.some((x) => !x.startsWith('ESM')) || hub.exitCode !== null;
  const pm = postmortem(ws);
  const envEnd = envSnap();
  if (process.env.FUZZ_RAW && (interesting || process.env.FUZZ_RAW_ALL)) {
    try {
      const tag = `${seed}-${Date.now()}`;
      const so = Buffer.concat(rawOut); const se = Buffer.concat(rawErr);
      writeFileSync(join(process.env.FUZZ_RAW, `${tag}.stdout.raw`), so);
      writeFileSync(join(process.env.FUZZ_RAW, `${tag}.stderr.raw`), se);
      writeFileSync(join(process.env.FUZZ_RAW, `${tag}.exit.json`), JSON.stringify({
        seed, hubExitCode: hub.exitCode, hubKilled: hub.killed, hubPid: hub.pid,
        hubPort, mockPort, dir, statuses, served, violations: v,
        stdoutBytes: so.length, stderrBytes: se.length,
        capturedAt: new Date().toISOString(),
      }, null, 2));
    } catch (e) { process.stdout.write(`RAWCAPTURE FAILED: ${e.message}\n`); }
  }

  let recovery = [];
  try { recovery = readFileSync(join(recovDir, 'recovery.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* none written */ }
  const bad = badCandidatesFromTranscripts(join(dir, 'runs'));
  for (const g of goalsDetail) if (g.runId) g.badCandidates = bad[g.runId] || [];
  const detail = {
    startedAt, ms: Date.now() - T0, hubReadyMs, dir, recovDir,
    policy: process.env.AGENT_RECOVERY_POLICY || 'control',
    recovery,
    goals: goalsDetail,
    replies: { idx: replyIdx, promptChars },
    env: { start: envStart, end: envEnd },
    hub: { pid: hub.pid, exitCode: hub.exitCode, signal: hub.signalCode, logBytes: hubLog.length, ...(interesting ? { logTail: hubLog.slice(-3000) } : {}) },
    postmortem: pm,
    safeguards: { sourceSyntax: process.env.AGENT_SOURCE_SYNTAX !== '0', finishEvidence: (process.env.AGENT_FINISH_EVIDENCE ?? '1') === '1' },
  };
  hub.kill(); live.delete(hub); mock.close();
  if (interesting && process.env.FUZZ_EVIDENCE) {
    try { writeEvidence(process.env.FUZZ_EVIDENCE, seed, dir, pm, detail); }
    catch (e) { detail.evidenceError = clip(e.message, 160); }
  }
  return { seed, goals: goals.length, served, statuses, violations: v, dir, detail };
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
// fuzz2-detail: a heartbeat the status script reads, so "is it still running?" is a file read instead of
// process archaeology, and an uncaught harness exception leaves a record instead of the silent exit-127
// death the first campaign had.
const beat = (extra = {}) => {
  if (!process.env.FUZZ_HEARTBEAT) return;
  try { writeFileSync(process.env.FUZZ_HEARTBEAT, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), seed0: SEED0, iterationsDone: all.length, of: ITER, ...extra })); } catch { /* best effort */ }
};
process.on('uncaughtException', (e) => {
  console.log(`  HARNESS uncaughtException: ${String((e && e.stack) || e).slice(0, 600)}`);
  beat({ phase: 'uncaughtException', error: String((e && e.message) || e).slice(0, 200) });
  process.exit(99);
});

for (let k = 0; k < ITER; k++) {
  const seed = SEED0 + k;
  const t0 = Date.now();
  beat({ seed, phase: 'start' });
  const res = await iteration(seed).catch((e) => ({ seed, violations: [`HARNESS: ${e.message}`], served: 0, statuses: [], detail: { harnessError: String(e && e.stack || e).slice(0, 800), env: { at: new Date().toISOString(), liveHubs: live.size } } }));
  all.push(res);
  beat({ seed, phase: 'done', ms: Date.now() - t0 });
  try { appendFileSync(OUT, JSON.stringify({ seed, ...(MODE ? { mode: MODE } : {}), served: res.served, statuses: res.statuses, violations: res.violations, detail: res.detail }) + '\n'); }
  catch { /* the console line below is still the record */ }
  const mark = res.violations.length ? 'FAIL' : 'ok  ';
  console.log(`  ${mark} seed ${String(seed).padStart(3)}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s  replayed ${String(res.served).padStart(3)}  [${(res.statuses || []).join(',')}]`);
  for (const x of res.violations) console.log(`         ${x}`);
}
summarize();
process.exit(all.some((r) => r.violations.length) ? 1 : 0);
