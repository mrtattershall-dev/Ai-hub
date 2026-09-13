/**
 * trialF.mjs - set F.s copy (same as trialE.mjs, set E.s) of trial35.mjs (set D's harness), changed only where set D showed it lost data:
 *   - AGENT_MAX_RUN_FILES is raised so the hub keeps every run file (and its transcript) for the whole set;
 *   - each goal's runId is logged, and RESULTS_JSON writes the per-goal rows, so goals map to run files
 *     even if something is lost again;
 *   - the hub's git commit is logged, so the result names the exact hub it measured.
 * Approvals: with AGENT_UNATTENDED=1 in the environment the hub itself denies anything that would ask; without
 * it, this harness answers as set D did (git_commit and git_undo approved, the rest denied).
 *
 * trial35.mjs - 35 goals, sequential, against one model.
 *
 * NOT chained. fullAgent.mjs links its goals with `after:` and lets the supervisor advance
 * them, but a chained item only moves once its predecessor reaches 'done' - and a `stopped`
 * predecessor strands everything behind it forever (reproduced today; the patch is with the
 * agent.js owner). The 14B reaches 'done' about half the time, so a chained 35-goal run
 * would measure the first two goals and then idle a warm GPU for the rest of the window.
 * This harness owns the ordering itself: start, wait for ANY terminal status, score, next.
 *
 * Scores WORK ON DISK separately from run status, because `stopped` routinely means "the
 * work is correct and the model never said so" - completion rate alone understates badly.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
const MODEL = process.env.MODEL_NAME || 'coder14b';
const LABEL = process.env.LABEL || MODEL;
if (!BASE) { console.error('set MODEL_BASE'); process.exit(2); }
const HUB = process.env.HUB_ENTRY || 'C:/Users/tatte/Projects/ai-coding-hub/server/index.js';
const ASSETS_ROOT = 'C:/Users/tatte/Projects/ai-coding-hub/assets';
const PORT = 5900 + Math.floor(Math.random() * 90);
const API = `http://127.0.0.1:${PORT}/api`;

// PREFLIGHT - never measure an endpoint whose identity is unverified. Three times today a
// healthy endpoint served a different model than its label claimed.
// POLL, do not one-shot. A single long fetch failed against a cold 30B: weights 34s +
// engine init 114s + container spin-up exceeded the timeout, so the harness gave up on a
// model that came up healthy seconds later and reported it as a preflight failure. Readiness
// and identity are different questions - wait for ready, THEN check identity.
let health = null;
for (let i = 0; i < 40; i++) {
  health = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(30000) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (health && health.ok) break;
  if (i === 0) console.log('waiting for the endpoint to come up (cold start)...');
  await new Promise((r) => setTimeout(r, 20000));
}
if (!health || !health.ok) { console.error('PREFLIGHT FAILED: endpoint never became ready'); process.exit(2); }
console.log('ENDPOINT ' + JSON.stringify(health));
const want = process.env.EXPECT_LORA;
if (want && String(health.lora || '') !== want) {
  console.error(`PREFLIGHT FAILED: expected lora=${want}, endpoint reports lora=${health.lora || 'null'} - refusing to measure the base model under an adapter name.`);
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'trial35-'));
const ws = join(dir, 'workspace');
// SEED_DIR: start the workspace from a saved state (continuing a sequence from a given goal's start state).
if (process.env.SEED_DIR) { mkdirSync(ws, { recursive: true }); cpSync(process.env.SEED_DIR, ws, { recursive: true }); console.log('seeded from ' + process.env.SEED_DIR); }
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: BASE, model: MODEL } }, history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [HUB], {
  env: {
    ...process.env, PORT: String(PORT), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'index.jsonl'),
    // Real model output, kept in THIS run's folder so it can be turned into replay corpus
    // rows deliberately, rather than mixed into the repo's traces.jsonl.
    AGENT_TRACES_DIR: process.env.TRIAL_TRACES_DIR || join(dir, 'traces'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_AUTO_STARTS: '400', AGENT_MAX_RUNS: '1000', AGENT_MAX_RUN_FILES: '100000', AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '8',
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const log = [];
hub.stdout.on('data', (d) => log.push(d.toString()));
hub.stderr.on('data', (d) => log.push(d.toString()));
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(180000) })).json();
for (let i = 0; i < 500; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

// Reuse fullAgent's 30 goals - they already span create / append / surgical / multi-site /
// cross-file / fix-a-bug / docs / game - then add five that cover shapes those miss.
// GOALS_FILE runs a FRESH prompt set through the SAME harness, which is the only way two
// runs are comparable - a new scorer plus new prompts measures nothing. Without it, falls
// back to fullAgent's 30 plus the 5 extras.
const loadGoals = () => {
  if (process.env.GOALS_FILE) return JSON.parse(readFileSync(process.env.GOALS_FILE, 'utf8'));
  const src = readFileSync('C:/Users/tatte/Projects/ai-coding-hub/server/fullAgent.mjs', 'utf8');
  const block = src.match(/const GOALS = \[([\s\S]*?)\n\];/)[1];
  return [...block.matchAll(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)].map((m) => m[1].replace(/\\'/g, "'"));
};
const GOALS = loadGoals();
if (!process.env.GOALS_FILE) GOALS.push(
  'Create q11_json.js exporting parseConfig(text) that JSON.parses and throws a clear Error naming the bad field. Verify with node.',
  'Add a defaults(obj) function to the EXISTING q11_json.js that fills missing keys. Keep parseConfig unchanged. Verify.',
  'Create q12_args.py with a function parse_args(argv) returning a dict, plus asserts at the bottom. Run it with python.',
  'In the EXISTING q9_slow.js, add a memo cache to fib WITHOUT changing its signature or breaking the existing test. Run it.',
  'Write Q_INDEX.md listing every q file that really exists in the workspace and one line on what each does. Read them first.',
);

console.log(`\n${GOALS.length} goals, sequential: ${LABEL}`);
console.log(`workspace ${ws}`);
console.log(`runs ${join(dir, 'runs')}`);
let hubSha = '?'; try { hubSha = execFileSync('git', ['-C', 'C:/Users/tatte/Projects/ai-coding-hub', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a repo */ }
console.log(`hub ${hubSha} | AGENT_UNATTENDED=${process.env.AGENT_UNATTENDED || '0'} | AGENT_BATCH_ACTIONS=${process.env.AGENT_BATCH_ACTIONS || 'default'}\n`);
console.log('   #  status      steps calls err grd  secs  ON DISK');

const rows = [];
const approvals = [];
for (let i = 0; i < GOALS.length; i++) {
  const goal = GOALS[i];
  // A timed GPU window: start no new goal after TRIAL_STOP_AT (epoch ms). The app itself is
  // stopped by a separate watchdog; this only keeps the last goal from being cut mid-run.
  if (process.env.TRIAL_STOP_AT && Date.now() > Number(process.env.TRIAL_STOP_AT)) {
    console.log(`  -- window closed: ${GOALS.length - i} goal(s) not started --`);
    break;
  }
  const t0 = Date.now();
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) }).catch((e) => ({ error: e.message }));
  if (!s.runId) {
    // LOUD, 2026-09-13: a START FAILED carrying busy:true means a PREVIOUS goal parked a run and THIS goal
    // never executed. Silently continuing turned that into 89 invisible non-runs scored as model failures.
    const parked = !!(s && (s.busy || /already working in this workspace/.test(String(s.error || ""))));
    const tag = parked ? " (PARKED RUN - goal never executed, NOT a model failure)" : "";
    console.log(`  ${String(i + 1).padStart(2)}  START FAILED${tag} ${JSON.stringify(s).slice(0, 80)}`);
    rows.push({ n: i + 1, runId: null, status: parked ? "never_started_parked" : "never_started",
      steps: 0, calls: 0, err: 0, grd: 0, secs: 0, disk: "GOAL NEVER RAN", good: false, forcedFinish: false });
    continue;
  }
  let run = null;
  // DEADLINE RAISED 10 -> 30 min, 2026-09-13. At 10 min this harness ABANDONED a still-running goal and
  // moved on, leaving the run ACTIVE in the hub - so every later /agent/start was refused 409 and goals
  // 12-100 never ran (11 rows out of a 100-iteration loop, 57.7 min wall, scored a meaningless 0/100).
  // The run always terminates on its own: agent.js:3190 checks budgetExhausted at the top of every turn,
  // so once a long call returns AGENT_MAX_MINUTES ends it. The harness gave up ~380s too early.
  // Sizing: a full 16384-token repetition collapse at the observed FLOOR of 16.7 tok/s is ~981s, and
  // MODEL_TIMEOUT_S=1800 bounds any single call. 30 min clears the 8-min budget + one worst-case call.
  // Only reachable for a model producing >10-min goals; no 14B/30B arm goal exceeded 600s, so this is a
  // no-op for them and the comparison holds in substance even though the file hash changes.
  const deadline = Date.now() + 30 * 60000;
  while (Date.now() < deadline) {
    run = await api('/agent/' + s.runId).catch(() => null);
    // Wait for teardown too: the status flips before the syntax rollback finishes, and the hub
    // now refuses the next start with a 409 until `busy` clears. Breaking on status alone would
    // turn every goal after the first into a false "START FAILED" on the next GPU run.
    // Nobody answers approvals in a measurement. A scratch workspace's own git history is harmless, so commits and
    // undos are approved; anything else is denied and the model carries on another way (rungoals.mjs's policy).
    // Without this one parked run held the workspace and every later goal failed to start (set D, 14B, goal 9: 'open').
    if (run && run.status === 'awaiting_approval' && run.pending) {
      const ok = ['git_commit', 'git_undo'].includes(run.pending.tool);
      await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: ok }) }).catch(() => null);
      approvals.push(`${i + 1}:${run.pending.tool}:${ok ? 'approved' : 'denied'}`);
      console.log(`      approval ${ok ? 'approved' : 'denied'}: ${run.pending.tool} ${JSON.stringify(run.pending.args || {}).slice(0, 60)}`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (run && ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'].includes(run.status) && run.busy !== true) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  const secs = (Date.now() - t0) / 1000;
  const steps = (run?.steps || []).length;
  const toolErrs = (run?.steps || []).filter((x) => x.type === 'tool' && /^ERROR:/.test(String(x.result || '')));
  // A guard refusal is the system WORKING - counted apart so it cannot penalise the fix.
  const grd = toolErrs.filter((x) => /boundary marker and/.test(String(x.result || ''))).length;
  const err = toolErrs.length - grd;

  // ON DISK: every file the goal names must exist, and any .js/.py it names must RUN.
  // q-series (the original set) and r-series (the fresh set) - matching only 'q' silently
  // scored every new goal as "(no file named)", which counts as a miss.
  const named = [...new Set(goal.match(/\b[qrstu][\w.]*\.(?:js|py|html|md)\b/gi) || [])];
  const verdict = [];
  for (const f of named) {
    const full = join(ws, f);
    if (!existsSync(full)) { verdict.push(`${f}:MISSING`); continue; }
    if (/\.js$/i.test(f)) {
      // BROWSER code must not be executed under node. r5_form.js is a correct DOM script
      // and `node r5_form.js` throws "document is not defined" - which the scorer read as
      // a broken deliverable. Third time today a measurement flaw looked like a model
      // failure. Browser files are judged by whether they PARSE.
      const src = readFileSync(full, 'utf8');
      const isBrowser = /\b(document|window|addEventListener|Phaser)\b/.test(src);
      const cmd = isBrowser ? [process.execPath, ['--check', full]] : [process.execPath, [full]];
      try { execFileSync(cmd[0], cmd[1], { timeout: 25000, stdio: 'pipe' }); verdict.push(`${f}:${isBrowser ? 'parses' : 'runs'}`); }
      catch { verdict.push(`${f}:THROWS`); }
    } else if (/\.py$/i.test(f)) {
      try { execFileSync('python', [full], { timeout: 25000, stdio: 'pipe' }); verdict.push(`${f}:runs`); }
      catch { verdict.push(`${f}:THROWS`); }
    } else if (/\.html$/i.test(f)) {
      // ":ok for existing" is how I called a real Phaser game a stub and then called its
      // docs hallucinated - both wrong. The logic lived in the linked .js, exactly as the
      // prompt tells the model to structure it. So judge the PAGE PLUS what it links, and
      // check any asset path actually resolves, since a missing asset fails by design.
      const html = readFileSync(full, 'utf8');
      const linked = [...html.matchAll(/src=["']([\w./-]+\.js)["']/gi)].map((m) => m[1])
        .filter((s) => !/^https?:/i.test(s));
      const linkedSrc = linked.map((s) => { try { return readFileSync(join(ws, s), 'utf8'); } catch { return ''; } }).join('\n');
      const all = html + '\n' + linkedSrc;
      const missingLink = linked.find((s) => !existsSync(join(ws, s)));
      const assets = [...new Set(all.match(/assets\/[\w./-]+/g) || [])];
      const badAsset = assets.find((a) => !existsSync(join(ASSETS_ROOT, a.replace(/^assets\//, ''))));
      if (missingLink) verdict.push(`${f}:LINKS-MISSING(${missingLink})`);
      else if (badAsset) verdict.push(`${f}:BAD-ASSET(${badAsset})`);
      else if (all.replace(/\s+/g, '').length < 200) verdict.push(`${f}:EMPTY`);
      else verdict.push(`${f}:ok`);
    } else verdict.push(`${f}:ok`);
  }
  // THE FUNCTIONS THE GOAL ASKED FOR MUST EXIST. "The named file runs" is not "the goal was
  // done": in the 14B data run goal 19 asked for transfer(from, to, amount) and goal 23 for
  // quickSort(arr) - neither was ever written, the files still ran, and both scored as work
  // done. Every `name(` in the goal must be DEFINED in one of the named .js/.py files.
  // Goals that list methods without parentheses ("on, off and emit") are not checked here.
  const codeFiles = named.filter((f) => /\.(?:js|py)$/i.test(f) && existsSync(join(ws, f)));
  if (codeFiles.length) {
    const src = codeFiles.map((f) => { try { return readFileSync(join(ws, f), 'utf8'); } catch { return ''; } }).join('\n');
    const wanted = [...new Set([...goal.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))]
      .filter((n) => !/^(?:require|console|assert|print|len|node|python)$/.test(n));
    const defined = (n) => new RegExp(
      `\\bfunction\\s*\\*?\\s*${n}\\b|\\b${n}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|[\\w$]+\\s*=>)`
      + `|^\\s*(?:static\\s+)?(?:async\\s+)?${n}\\s*\\([^)]*\\)\\s*\\{|^\\s*def\\s+${n}\\b`, 'm').test(src);
    const absent = wanted.filter((n) => !defined(n));
    if (absent.length) verdict.push(`FN-MISSING(${absent.join(',')})`);
  }
  const disk = verdict.join(' ') || '(no file named)';
  const good = verdict.length > 0 && verdict.every((v) => /:runs$|:ok$|:parses$/.test(v));
  rows.push({ n: i + 1, runId: s.runId, status: run?.status, steps, calls: run?.modelCalls, err, grd, secs, disk, good, forcedFinish: !!run?.forcedFinish });
  if (process.env.RESULTS_JSON) writeFileSync(process.env.RESULTS_JSON, JSON.stringify(rows, null, 1));
  console.log(`      run ${s.runId}`);
  console.log(`  ${String(i + 1).padStart(2)}  ${String(run?.status).padEnd(11)} ${String(steps).padStart(4)} ${String(run?.modelCalls ?? '?').padStart(5)} ${String(err).padStart(3)} ${String(grd).padStart(3)} ${String(secs.toFixed(0)).padStart(5)}  ${disk}`);
}

console.log('\n--- summary ---');
const done = rows.filter((r) => r.status === 'done').length;
const worked = rows.filter((r) => r.good).length;
console.log(`goals run           : ${rows.length}`);
console.log(`status 'done'       : ${done}/${rows.length}`);
console.log(`WORK ACTUALLY DONE  : ${worked}/${rows.length}   <- the number that matters`);
console.log(`tool errors         : ${rows.reduce((a, r) => a + r.err, 0)}`);
console.log(`guard refusals      : ${rows.reduce((a, r) => a + r.grd, 0)}   (the system working)`);
console.log(`total model calls   : ${rows.reduce((a, r) => a + (r.calls || 0), 0)}`);
console.log(`wall clock          : ${(rows.reduce((a, r) => a + r.secs, 0) / 60).toFixed(1)} min`);
console.log(`files: ${existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git').join(', ') : '(none)'}`);
const rates = (log.join('').match(/= ([0-9.]+) tok\/s/g) || []).map((m) => parseFloat(m.match(/[0-9.]+/)[0]));
if (rates.length) console.log(`tok/s: min ${Math.min(...rates)} max ${Math.max(...rates)}`);
console.log(`approvals           : ${approvals.length ? approvals.join(', ') : 'none'}`);
hub.kill();
