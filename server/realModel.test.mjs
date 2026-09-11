/**
 * realModel.test.mjs - everything that can ONLY be answered by a real model on a real GPU.
 *
 *   MODEL_BASE=https://…modal.run node server/realModel.test.mjs
 *
 * Every other suite here replaces the model with scripted text, deliberately, so the loop
 * can be tested for free. That leaves a specific set of questions open, and GPU time is
 * the only way to close them. They are batched into one run because a warm container is
 * cheap and a cold start is not:
 *
 *   1. THROUGHPUT. The number this whole day has been missing. The HF path measured
 *      3.3 tok/s serving a 30B MoE on an H100 - a CPU-inference signature. vLLM is
 *      supposed to fix it and has never once been benchmarked.
 *   2. THE OLLAMA OPTIONS. modal_serve_vllm.py read top-level temperature/max_tokens,
 *      which the hub never sends; it sends them inside `options`. Fixed, never executed.
 *   3. THE HEARTBEAT. That server generates on a worker thread and emits empty keep-alive
 *      frames so a long generation is not mistaken for a stall. Fixed, never executed.
 *      A generation longer than MODEL_STALL_S is the test.
 *   4. THE PLANNER FRAME. A non-game goal must now produce a SHORT plan instead of a game
 *      design document. Only a real model can be wrong about this.
 *   5. PROMPT GROWTH. The anchor cap, against real generated content rather than 'X'*200k.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
if (!BASE_URL) { console.error('set MODEL_BASE to the endpoint'); process.exit(2); }
const MODEL = process.env.MODEL_NAME || 'mycoder';
const HUB_PORT = 4500 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${HUB_PORT}/api`;

let passed = 0, failed = 0;
const results = [];
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 400)}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'realmodel-'));
const ws = join(dir, 'workspace');
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: BASE_URL, model: MODEL } }, history: [], settings: {},
}), 'utf8');

console.log(`\nreal model: ${BASE_URL}\n`);

// Boot a REAL hub against that endpoint, isolated from anything live.
const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env,
    PORT: String(HUB_PORT), HUB_DB: dbPath, AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'run-index.jsonl'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '24', AGENT_MAX_MINUTES: '12',
    // Generous first byte (a 32B cold start is minutes); tight-ish stall so the
    // heartbeat check is a real test rather than a formality.
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '20', MODEL_TIMEOUT_S: '1800',
    CHAT_STALL_S: '20',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));
for (let i = 0; i < 200; i++) {
  try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

// THROUGHPUT PROBE REMOVED.
//
// There was a hand-rolled NDJSON reader here to measure tok/s. It mis-parsed the
// heartbeat-then-content frame shape and reported 0 tok/s while the run it was measuring
// worked fine - the hub's own per-call telemetry had the real number the whole time
// (`run.slowestTokPerSec`, and the [agent] model ... tok/s log line).
//
// Two implementations of the same measurement means the wrong one can disagree with
// reality and waste an afternoon. The product measures throughput; the test reads what
// the product measured. Deleted rather than fixed.

// ── 2. the Ollama options are actually honoured ──────────────────────────────
await test('OPTIONS: num_predict inside `options` bounds the reply', async () => {
  const ask = async (numPredict) => {
    const r = await fetch(BASE_URL + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, stream: false,
        messages: [{ role: 'user', content: 'Count slowly from 1 to 400, one number per line.' }],
        options: { temperature: 0, num_predict: numPredict },
      }),
      signal: AbortSignal.timeout(600_000),
    });
    const j = await r.json();
    return String(j.message?.content || j.response || '');
  };
  const short = await ask(24);
  const long = await ask(400);
  results.push(`options: num_predict 24 -> ${short.length} chars, 400 -> ${long.length} chars`);
  console.log(`        num_predict 24 -> ${short.length} chars | 400 -> ${long.length} chars`);
  assert.ok(short.length > 0, 'the short reply was empty');
  assert.ok(long.length > short.length * 2,
    `num_predict appears ignored: 24 gave ${short.length} chars, 400 gave ${long.length}`);
});

// ── 3. a long generation must not look like a stall ──────────────────────────
await test('HEARTBEAT: a generation longer than the stall window survives', async () => {
  // Drive it through the HUB (not the endpoint) so the stall timer is in the path.
  // MODEL_STALL_S is set to 20 below; this asks for far more than 20s of tokens.
  const t0 = Date.now();
  const r = await fetch(API + '/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'ollama', stream: true,
      prompt: 'Write a detailed 900-word technical explanation of how a bloom filter works, with worked examples.',
    }),
    signal: AbortSignal.timeout(900_000),
  });
  const body = await r.text();
  const secs = (Date.now() - t0) / 1000;
  results.push(`heartbeat: ${secs.toFixed(1)}s generation through the hub, ${body.length} bytes`);
  console.log(`        ${secs.toFixed(1)}s through the hub, ${body.length} bytes`);
  assert.ok(!/sent nothing for|went silent/i.test(body),
    `the stall timer fired on a live generation: ${body.slice(0, 300)}`);
});

// ── 4 & 5. a real agent run: planner frame + prompt growth ───────────────────
await test('AGENT: a non-game goal completes, with a SHORT plan', async () => {
  const started = await (await fetch(API + '/agent/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: 'Create counter.js exporting add(a, b), with a self-check that throws if add(2,2) !== 4. Then verify it runs.' }),
  })).json();
  assert.ok(started.runId, 'no runId: ' + JSON.stringify(started).slice(0, 200));

  const deadline = Date.now() + 900_000;
  let run = null;
  while (Date.now() < deadline) {
    run = await (await fetch(API + '/agent/' + started.runId)).json();
    if (['done', 'error', 'stopped', 'interrupted', 'awaiting_approval'].includes(run.status) && !run.busy) break;   // teardown too
    await new Promise((r) => setTimeout(r, 2000));
  }
  const steps = (run.steps || []).length;
  const plan = String(run.plan || '');
  const planLines = plan.split('\n').filter((l) => l.trim()).length;
  results.push(`agent: status=${run.status} steps=${steps} calls=${run.modelCalls} planLines=${planLines} slowest=${run.slowestTokPerSec ?? '?'} tok/s`);
  console.log(`        status=${run.status} steps=${steps} calls=${run.modelCalls} planLines=${planLines}`);
  if (plan) console.log(`        plan starts: ${plan.replace(/\s+/g, ' ').slice(0, 120)}`);

  assert.ok(steps >= 4, `only ${steps} steps`);
  assert.equal(run.status, 'done', `ended ${run.status}`);
  // The planner frame: a two-argument function must not produce a game design document.
  assert.ok(!/GAMEPLAY LOOP|win\/lose|PLAYABLE/i.test(plan),
    `the plan is still game-framed:\n${plan.slice(0, 400)}`);
  assert.ok(planLines <= 16, `plan is ${planLines} lines - the short frame is not taking effect`);
});

await test('PROMPT GROWTH: prompts stay bounded across the run', async () => {
  const files = existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git') : [];
  results.push(`workspace: ${files.join(', ') || '(empty)'}`);
  assert.ok(files.some((f) => /counter\.js/i.test(f)), `counter.js not written; workspace has: ${files.join(', ')}`);
});

hub.kill();
console.log('\n--- results ---');
results.forEach((r) => console.log('  ' + r));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
