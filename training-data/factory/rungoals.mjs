/**
 * rungoals.mjs - run validated "edit an existing game" goals through the REAL hub, grade each
 * result with gamecheck.mjs, and keep the full run (every model reply and tool result).
 *
 *   node factory/rungoals.mjs --base <ollama-shaped model URL> --model <served name> --label <tag>
 *        [--goals factory/raw/game_goals.jsonl] [--out factory/raw/traces]
 *        [--offset 0] [--limit 0] [--concurrency 1]
 *
 * WHAT THIS PRODUCES, AND WHY IT IS SHAPED THIS WAY
 * --------------------------------------------------
 * run5 looped in the hub because every one of its 13,762 training rows was single-turn: it had
 * never seen a tool result followed by a next move. Training data for the hub has to BE hub
 * runs - reply -> tool result -> next reply - on goals whose outcome can be checked without a
 * human. So each goal here gets:
 *   - a fresh copy of its harvested game as the workspace (the original is never touched),
 *   - its own isolated hub (spare port, temp queue/runs/traces - never the live hub on :3001),
 *     with the same settings the head-to-head harness (trial35) used,
 *   - a black-box verdict from `gamecheck.mjs check` on the workspace the run left behind.
 * The saved record carries the hub's own run file (history included), so a later step can turn
 * PASSING runs into per-turn training rows. Resume-safe: a goal already recorded for this label
 * is skipped.
 */
import { spawn, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..', '..', 'server');
const { freePorts } = await import(pathToFileURL(join(SERVER, 'testPort.mjs')).href);

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const BASE = (flag('base', '') || '').replace(/\/+$/, '');
const MODEL = flag('model', 'coder14b');
const LABEL = flag('label', MODEL);
const GOALS = resolve(flag('goals', join(HERE, 'raw', 'game_goals.jsonl')));
const OUT = resolve(flag('out', join(HERE, 'raw', 'traces')), LABEL);
const OFFSET = Number(flag('offset', 0));
const LIMIT = Number(flag('limit', 0));
const CONCURRENCY = Math.max(1, Number(flag('concurrency', 1)));
if (!BASE) { console.error('set --base <model URL>'); process.exit(2); }

const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = (g) => `${g.repo.replace(/[^\w.-]/g, '__')}__${g.goal}`;

mkdirSync(OUT, { recursive: true });
const RESULTS = join(OUT, 'results.jsonl');
const done = new Set(existsSync(RESULTS) ? readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []);
const all = readFileSync(GOALS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const slice = LIMIT ? all.slice(OFFSET, OFFSET + LIMIT) : all.slice(OFFSET);
const queue = slice.filter((g) => !done.has(idOf(g)));
console.log(`${all.length} goals | ${done.size} already recorded for "${LABEL}" | this run: ${queue.length} | concurrency ${CONCURRENCY} | model ${MODEL} @ ${BASE}`);

async function runOne(g) {
  const id = idOf(g);
  const t0 = Date.now();
  const dir = mkdtempSync(join(tmpdir(), 'rungoal-'));
  const ws = join(dir, 'workspace');
  cpSync(join(HERE, g.dir), ws, { recursive: true });
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: BASE, model: MODEL } }, history: [], settings: {},
  }), 'utf8');
  const [port] = await freePorts(1);
  const hub = spawn(process.execPath, [join(SERVER, 'index.js')], {
    env: {
      ...process.env, PORT: String(port), HUB_DB: join(dir, 'hub.json'),
      AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'index.jsonl'), AGENT_TRACES_DIR: join(dir, 'traces'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      AGENT_MAX_AUTO_STARTS: '400', AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '8',
      MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  hub.stdout.on('data', (d) => log.push(d.toString()));
  hub.stderr.on('data', (d) => log.push(d.toString()));
  const API = `http://127.0.0.1:${port}/api`;
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(180000) })).json();
  let rec = { id, label: LABEL, model: MODEL, repo: g.repo, license: g.license, sha: g.sha, goal: g.goal, entry: g.entry };
  try {
    for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await sleep(250); } }
    const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: g.text }) });
    if (!s.runId) throw new Error('start failed: ' + JSON.stringify(s).slice(0, 120));
    let run = null;
    const deadline = Date.now() + 12 * 60000;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      // Nobody answers approvals here. A scratch workspace's own git history is harmless, so
      // commits/undos are approved; anything else is denied and the model carries on another way.
      // (The Modal pilot cut 6 runs short parked on git_commit / run_command.)
      if (run?.status === 'awaiting_approval' && run.pending) {
        const ok = ['git_commit', 'git_undo'].includes(run.pending.tool);
        await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: ok }) }).catch(() => null);
        (rec.approvals = rec.approvals || []).push(`${run.pending.tool}:${ok ? 'approved' : 'denied'}`);
        await sleep(1000);
        continue;
      }
      // Wait for teardown too: status flips before the syntax rollback finishes (trial35's lesson).
      if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
      await sleep(3000);
    }
    rec.runId = s.runId;
    rec.status = run?.status || 'timeout';
    rec.steps = (run?.steps || []).length;
    rec.modelCalls = run?.modelCalls ?? null;
    // How often the hub's finish gate said "not yet". A run that only ended because the gate's
    // cap (3 blocks) let a repeated finish through must not become training data as-is - it
    // would teach pushing past the gate. The converter filters or trims on these.
    rec.finishBlocks = run?.finishBlocks ?? 0;
    rec.forcedFinish = rec.finishBlocks >= 3;
    // The hub's own run file holds the history - the thing training rows are made from.
    const runFile = join(dir, 'runs', s.runId + '.json');
    rec.runFile = existsSync(runFile) ? `${id}.run.json` : null;
    if (rec.runFile) cpSync(runFile, join(OUT, rec.runFile));
  } catch (e) {
    rec.status = 'harness-error';
    rec.error = String(e.message || e).slice(0, 200);
  } finally {
    hub.kill();
    await sleep(500);
  }
  // Grade the workspace the run left behind - in a separate process, the same CLI anyone can rerun.
  const v = spawnSync(process.execPath, [join(HERE, 'gamecheck.mjs'), 'check', ws, g.entry, g.goal], { encoding: 'utf8', timeout: 180000 });
  const last = (v.stdout || '').trim().split('\n').pop() || '';
  try { rec.verdict = JSON.parse(last); } catch { rec.verdict = { pass: false, why: 'grader produced no verdict: ' + (v.stderr || '').slice(-160) }; }
  rec.pass = rec.verdict.pass === true;
  rec.secs = Math.round((Date.now() - t0) / 1000);
  appendFileSync(RESULTS, JSON.stringify(rec) + '\n');
  rmSync(dir, { recursive: true, force: true });
  return rec;
}

let next = 0, passed = 0, finished = 0;
async function worker() {
  while (next < queue.length) {
    const g = queue[next++];
    const r = await runOne(g);
    finished++;
    if (r.pass) passed++;
    console.log(`${String(finished).padStart(4)}/${queue.length} ${r.pass ? 'PASS' : 'fail'} ${r.id.padEnd(58)} ${String(r.status).padEnd(12)} steps ${String(r.steps ?? '-').padStart(2)} ${r.secs}s | ${String(r.verdict?.why || r.error || '').slice(0, 90)}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\n${passed}/${finished} passed -> ${RESULTS}`);
