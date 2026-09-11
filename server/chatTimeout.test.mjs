/**
 * chatTimeout.test.mjs - the Chat/Code tabs must not hang forever on a dead backend.
 *
 *   node server/chatTimeout.test.mjs
 *
 * Both upstream fetches in index.js were written with no signal and no timeout. Node's
 * fetch has no default timeout, so a backend that accepted the connection and then went
 * quiet held the request open indefinitely: the spinner never stopped and the socket was
 * never released. That is not a rare condition - it is what every Chat request does the
 * moment a Modal endpoint is stopped, which is a normal end to a working day.
 *
 * Runs the REAL server against a scratch hub.json (HUB_DB) so the developer's own config,
 * which holds live API keys, is never touched.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3400 + Math.floor(Math.random() * 400);
const STALL_S = 3;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

// A backend that accepts the connection, sends headers, then never speaks again.
const silent = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  res.write(JSON.stringify({ message: { role: 'assistant', content: 'thinking' }, done: false }) + '\n');
  // and then nothing, forever
});
await new Promise((r) => silent.listen(0, '127.0.0.1', r));
const silentPort = silent.address().port;

// Scratch config: the ollama provider points at the silent server.
const dir = mkdtempSync(join(tmpdir(), 'hubchat-'));
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${silentPort}`, model: 'test' } },
  history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HUB_DB: dbPath, AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'run-index.jsonl'), CHAT_STALL_S: String(STALL_S), HUB_TOKEN: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stderr.on('data', (d) => { const s = d.toString(); if (/Error|error:/i.test(s)) process.stderr.write('  [hub] ' + s); });

// Wait for it to listen.
const BASE = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 80; i++) {
  try { await fetch(BASE + '/api/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

console.log('\nchat timeouts\n');

await test('a silent backend fails near the stall window instead of hanging forever', async () => {
  const t0 = Date.now();
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'ollama', prompt: 'hello', stream: true }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await r.text();
  const secs = (Date.now() - t0) / 1000;
  assert.ok(secs < 30, `should fail near ${STALL_S}s, took ${secs.toFixed(1)}s`);
  assert.match(body, /sent nothing|silent/i, `expected a stall message, got: ${body.slice(0, 300)}`);
});

await test('the stall message explains what to look at', async () => {
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'ollama', prompt: 'hello', stream: true }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await r.text();
  assert.match(body, /loading, crash-looping, or out of memory/i, `unhelpful message: ${body.slice(0, 300)}`);
  assert.match(body, new RegExp(String(silentPort)), 'should name the backend that misbehaved');
});

hub.kill();
silent.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
