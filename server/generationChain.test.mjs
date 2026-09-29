/**
 * generationChain.test.mjs — does the queue_task hop counter actually count?
 *
 *   node server/generationChain.test.mjs
 *
 * WHY THIS EXISTS. While building the authority crossing I found `_activeRun` was assigned ONLY on
 * the spawn_subtask branch, so every other tool saw null - and `queue_task` computes
 * `generation = (_activeRun && _activeRun.generation || 0) + 1`. Read off the source, that means a
 * queued run queueing further work produced generation 1 FOREVER, and MAX_GENERATIONS could not bind
 * along this route. "Stops after 5 hops from something you asked for" is a UI claim resting on it.
 *
 * I had asserted that from reading. This measures it, because a claim about a counter taken from
 * source is exactly the kind this project has been wrong about before.
 *
 * Each run gets its OWN mock on its own port (loadDb re-reads HUB_DB per request), so no script can
 * be mis-served - see queuedAuthority.test.mjs for the two text-routing designs that failed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok    ' + what); } else { fail++; console.log('  FAIL  ' + what); } };
const freePort = () => new Promise((res) => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const NL = '\n';
const fin = ['ACTION: finish', 'SUMMARY: done'].join(NL);
const plan = ['1. Queue', '2. FILES: none', '3. BUILD ORDER: 1) queue', '4. HOW TO VERIFY: queue'].join(NL);
const q = (goal) => ['ACTION: queue_task', 'GOAL: ' + goal, 'SCOPE: a.py'].join(NL);

const pPort = await freePort(), cPort = await freePort(), hubPort = await freePort();
let pi = 0, ci = 0;
const serve = (script, get) => createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'script', lora: null }));
  }
  let b = ''; req.on('data', (d) => { b += d; });
  req.on('end', () => {
    const i = get();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'script', message: { role: 'assistant', content: i < script.length ? script[i] : fin }, done: true }));
  });
});
const mockP = serve([plan, q('SECOND hop work'), fin], () => pi++);
const mockC = serve([plan, q('THIRD hop work'), fin], () => ci++);
await new Promise((r) => mockP.listen(pPort, '127.0.0.1', r));
await new Promise((r) => mockC.listen(cPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'genchain-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
const point = (port) => writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: 'http://127.0.0.1:' + port, model: 'script' } }, history: [], settings: {},
}), 'utf8');
point(pPort);

const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'),
    RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '10', AGENT_MAX_MINUTES: '3',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
    AGENT_GOVERNED_WRITES: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', () => {}); hub.stderr.on('data', () => {});

const API = 'http://127.0.0.1:' + hubPort + '/api';
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
for (let i = 0; i < 240; i++) {
  try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}
const settle = async (id) => {
  const deadline = Date.now() + 100000;
  while (Date.now() < deadline) {
    const r = await api('/agent/' + id).catch(() => null);
    if (r && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(r.status) && !r.busy) return r;
    await new Promise((x) => setTimeout(x, 350));
  }
  return null;
};

let gens = [];
try {
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Queue the second hop.', writeScope: ['a.py'] }) });
  await settle(s.runId);
  let qv = await api('/agent/queue');
  const first = (qv.items || []).find((i) => /SECOND/.test(i.goal));
  gens.push(first ? first.generation : null);

  point(cPort);
  const d = await api('/agent/queue/run', { method: 'POST' });
  if (d.runId) await settle(d.runId);
  qv = await api('/agent/queue');
  const second = (qv.items || []).find((i) => /THIRD/.test(i.goal));
  gens.push(second ? second.generation : null);
} finally { hub.kill(); mockP.close(); mockC.close(); }

console.log('queue_task generation chain');
console.log('  observed generations: ' + JSON.stringify(gens));
ok(gens[0] === 1, 'hop 1: a HUMAN run (generation 0) queues work at generation 1');
ok(gens[1] === 2,
  'hop 2: the QUEUED run (generation 1) queues work at generation 2 - the counter INCREMENTS.'
  + ' Before the _activeRun fix this was 1, so MAX_GENERATIONS could never bind on this route');

try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
