/**
 * modelBudget.test.mjs - the model-call budget, against servers that misbehave on purpose.
 *
 *   node server/modelBudget.test.mjs
 *
 * Every fix these pin was found by reading code, not by watching a failure. That is
 * exactly the kind of fix that is wrong as often as it is right, so each one gets a
 * server that reproduces the condition deterministically, in seconds, with no GPU.
 *
 * The conditions, and why each mattered:
 *
 *   slow-but-alive   a stream that takes far longer than any per-call wall clock but
 *                    never goes quiet. Measured 2026-09-10: a real backend at 3.3 tok/s
 *                    took 496s for one reply against a 600s budget sized for "a T4 at
 *                    ~15-25 tok/s". The old code would eventually kill work that was
 *                    arriving correctly. This must SUCCEED.
 *   silent           headers, one chunk, then nothing forever. Must fail FAST (stall
 *                    timer) rather than hang to the ceiling.
 *   overflow         a 400 saying the prompt is too long. Recoverable by pruning, so it
 *                    must be typed rather than thrown as a permanent error.
 *   dead             nothing listening. The message must name what is actually wrong
 *                    instead of the old hard-coded "the Ollama tunnel may be down".
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Must be set BEFORE agent.js is imported: the constants are read at module load.
process.env.MODEL_STALL_S = '2';
process.env.MODEL_TIMEOUT_S = '60';
process.env.MODEL_RETRIES = '1';
process.env.MODEL_PROBE_S = '2';

const { __modelCallTest } = await import('./agent.js');
const { callModel, pruneHistory, capMessage, historyBudget, contextTokensFor } = __modelCallTest;
const { estimateTokens } = await import('./escalate.js');
const { getLastModelCall } = await import('./agent.js');

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

/** A one-off Ollama-shaped server that behaves as `mode` says. */
function fakeServer(mode) {
  const srv = createServer((req, res) => {
    if (mode === 'overflow') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "This model's maximum context length is 16384 tokens, however you requested 20000" }));
      return;
    }
    const chunk = (text, done = false) =>
      JSON.stringify({ message: { role: 'assistant', content: text }, done }) + '\n';

    if (mode === 'silent') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write(chunk('THOUGHT: starting'));      // one byte of life, then nothing, ever
      return;                                     // deliberately never end()
    }
    if (mode === 'heartbeat') {
      // What modal_serve_vllm.py now sends while a blocking generation runs: empty-content
      // chunks that prove the connection is alive, then the real reply in one piece.
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      let i = 0;
      const t = setInterval(() => {
        if (i < 5) { res.write(chunk('')); i++; return; }
        clearInterval(t);
        res.write(chunk('REAL CONTENT'));
        res.end(chunk('', true));
      }, 500);
      req.on('close', () => clearInterval(t));
      return;
    }
    if (mode === 'slow') {
      // Six chunks, 600ms apart = ~3.6s total. Far past a 2s-equivalent wall clock, but
      // no single GAP exceeds the 2s stall window, so this stream is alive throughout.
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      let i = 0;
      const t = setInterval(() => {
        if (i < 6) { res.write(chunk('tok' + i + ' ')); i++; return; }
        clearInterval(t);
        res.end(chunk('', true));
      }, 600);
      req.on('close', () => clearInterval(t));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.end(chunk('hello', true));
  });
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const dbFor = (port) => () => ({ api_keys: { ollama: { base_url: `http://127.0.0.1:${port}` } } });
const MSG = [{ role: 'user', content: 'hi' }];

console.log('\nmodel-call budget\n');

// ── the stall timer ──────────────────────────────────────────────────────────
await test('a SLOW but continuous stream is not killed (the 3.3 tok/s case)', async () => {
  const { srv, port } = await fakeServer('slow');
  try {
    const t0 = Date.now();
    const out = await callModel(dbFor(port), MSG, null);
    const secs = (Date.now() - t0) / 1000;
    assert.ok(secs > 3, `should have taken >3s, took ${secs.toFixed(1)}s`);
    assert.match(out, /tok0/, 'content should have accumulated');
    assert.match(out, /tok5/, 'the whole stream should arrive');
  } finally { srv.close(); }
});

await test('a SILENT stream fails at the stall window, not the ceiling', async () => {
  const { srv, port } = await fakeServer('silent');
  try {
    const t0 = Date.now();
    await assert.rejects(() => callModel(dbFor(port), MSG, null), (e) => {
      assert.match(e.message, /silent|sent nothing/i, `message was: ${e.message}`);
      return true;
    });
    const secs = (Date.now() - t0) / 1000;
    assert.ok(secs < 20, `should fail near the 2s stall window, took ${secs.toFixed(1)}s`);
  } finally { srv.close(); }
});

await test('the stall message names the backend, not "the Ollama tunnel"', async () => {
  const { srv, port } = await fakeServer('silent');
  try {
    await assert.rejects(() => callModel(dbFor(port), MSG, null), (e) => {
      assert.ok(!/Re-check the tunnel URL in Settings/.test(e.message), 'old hard-coded advice came back');
      assert.match(e.message, new RegExp(String(port)), 'should name the actual base URL');
      assert.match(e.message, /reachable/i, 'a listening-but-silent server is reachable');
      return true;
    });
  } finally { srv.close(); }
});

await test('keep-alive heartbeats hold the stream open and add no content', async () => {
  // Pins the contract modal_serve_vllm.py depends on. Its generation is blocking, so it
  // emits empty chunks to prove liveness; if the hub either (a) treated the silence
  // between real tokens as a stall or (b) let empty chunks into the reply, a vLLM
  // generation longer than the stall window would break or return corrupted text.
  const { srv, port } = await fakeServer('heartbeat');
  try {
    const t0 = Date.now();
    const out = await callModel(dbFor(port), MSG, null);
    const secs = (Date.now() - t0) / 1000;
    assert.ok(secs > 2.5, `heartbeats should have kept it open >2.5s, took ${secs.toFixed(1)}s`);
    assert.equal(out, 'REAL CONTENT', `heartbeats leaked into the reply: ${JSON.stringify(out)}`);
  } finally { srv.close(); }
});

// ── liveness probe ───────────────────────────────────────────────────────────
await test('a DEAD backend is reported as nothing listening', async () => {
  const { srv, port } = await fakeServer('ok');
  srv.close();                                  // free the port, then aim at it
  await new Promise((r) => setTimeout(r, 100));
  await assert.rejects(() => callModel(dbFor(port), MSG, null), (e) => {
    assert.ok(/listening|unreachable|ECONNREFUSED|fetch failed/i.test(e.message), `message was: ${e.message}`);
    return true;
  });
});

// ── context overflow ─────────────────────────────────────────────────────────
await test('a context-overflow 400 is typed CONTEXT_OVERFLOW, not fatal', async () => {
  const { srv, port } = await fakeServer('overflow');
  try {
    await assert.rejects(() => callModel(dbFor(port), MSG, null), (e) => {
      assert.equal(e.code, 'CONTEXT_OVERFLOW', `code was ${e.code}: ${e.message}`);
      return true;
    });
  } finally { srv.close(); }
});

// ── telemetry ────────────────────────────────────────────────────────────────
await test('throughput is measured and recorded', async () => {
  const { srv, port } = await fakeServer('ok');
  try {
    await callModel(dbFor(port), MSG, null);
    const st = getLastModelCall();
    assert.ok(st, 'no telemetry recorded');
    assert.ok(st.ms >= 0, 'no duration');
    assert.ok(st.promptTok > 0, 'prompt tokens not counted');
    assert.equal(typeof st.tokPerSec, 'number', 'tok/s not computed');
    assert.ok(st.firstByteMs !== null, 'first-byte latency not captured');
  } finally { srv.close(); }
});

// ── token-aware pruning ──────────────────────────────────────────────────────
await test('a single huge message is truncated, keeping both ends', () => {
  const big = { role: 'user', content: 'A'.repeat(40_000) + 'ZEBRA' };
  const out = capMessage(big, 1000);
  assert.ok(out.content.length < 5000, `still ${out.content.length} chars`);
  assert.match(out.content, /^A{100}/, 'lost the head');
  assert.match(out.content, /ZEBRA$/, 'lost the tail');
  assert.match(out.content, /characters trimmed/, 'no trim marker');
});

await test('pruning fits a TOKEN budget, not a message count', () => {
  // Twelve messages - comfortably under MAX_HISTORY_MSGS(16), so the OLD count-based
  // prune would return immediately and send ~150k tokens at a 16k-context backend.
  const run = { history: [
    { role: 'system', content: 'you are an agent' },
    { role: 'user', content: 'GOAL: build the thing' },
  ] };
  for (let i = 0; i < 10; i++) {
    run.history.push({ role: 'assistant', content: 'step ' + i });
    run.history.push({ role: 'user', content: `TOOL RESULT (read_file):\n` + 'X'.repeat(30_000) });
  }
  const before = estimateTokens(run.history);
  assert.ok(before > 60_000, `fixture should be huge, was ${before}`);

  pruneHistory(run, 4000);
  const after = estimateTokens(run.history);
  assert.ok(after <= 4000 * 1.6, `still ${after} tokens against a 4000 budget`);
  assert.ok(after < before / 4, `barely shrank: ${before} -> ${after}`);
});

await test('a GIANT anchor is capped, not carried forever', () => {
  // Anchors (goal / notes / BUILD PLAN) are preserved by design, which made them exempt
  // from trimming - and therefore unbounded. Found by hostileModel.test.mjs: a model that
  // answers every request with 200KB answers the PLANNER that way too, so "BUILD PLAN:"
  // became a 50,000-token anchor and prompts sat at ~57,000 against a 13,516 budget for
  // the entire run, never coming down.
  const run = { history: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'GOAL: build the thing' },
    { role: 'assistant', content: 'BUILD PLAN:\n' + 'P'.repeat(200_000) },
  ] };
  for (let i = 0; i < 6; i++) {
    run.history.push({ role: 'assistant', content: 'step ' + i });
    run.history.push({ role: 'user', content: 'TOOL RESULT (write_file):\nOK' });
  }
  pruneHistory(run, 8000);
  const after = estimateTokens(run.history);
  assert.ok(after <= 8000 * 1.6, `prompt still ${after} tokens against an 8000 budget`);
  const plan = run.history.find((m) => /^BUILD PLAN:/.test(m.content || ''));
  assert.ok(plan, 'the plan anchor was dropped entirely - it must be kept, just trimmed');
  assert.ok(estimateTokens([plan]) < 4000, 'the plan anchor was not capped');
  assert.match(plan.content, /characters trimmed/, 'no trim marker on the capped anchor');
});

await test('pruning preserves the GOAL anchor', () => {
  const run = { history: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'GOAL: keep me' }] };
  for (let i = 0; i < 30; i++) run.history.push({ role: 'user', content: 'noise '.repeat(2000) });
  pruneHistory(run, 2000);
  assert.ok(run.history.some((m) => /GOAL: keep me/.test(m.content)), 'the goal was pruned away');
});

await test('a small history is left completely alone', () => {
  const h = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'GOAL: x' }, { role: 'assistant', content: 'ok' }];
  const run = { history: [...h] };
  pruneHistory(run, 8000);
  assert.deepEqual(run.history, h, 'a short history must not be rewritten');
});

await test('the OpenAI-shaped path declares a context, Ollama uses NUM_CTX', () => {
  const ollamaCtx = contextTokensFor({ api_keys: { ollama: {} } });
  assert.ok(ollamaCtx > 0, 'no ollama context');
  assert.ok(historyBudget({ api_keys: { ollama: {} } }) < ollamaCtx, 'budget must reserve room for the reply');
  const declared = contextTokensFor({ api_keys: { ollama: { context_tokens: 8192 } } });
  assert.equal(declared, 8192, 'a provider row must be able to declare its own window');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
