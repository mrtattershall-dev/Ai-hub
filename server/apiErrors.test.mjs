/**
 * apiErrors.test.mjs - an /api route that throws answers JSON, never a stack trace.
 *
 *   node server/apiErrors.test.mjs
 *
 * Express's default error handler answers an exception with an HTML page carrying the full
 * stack: file paths, module layout, line numbers. This hub can be reached through a tunnel,
 * so that page went to whoever asked. And every /api client parses JSON, so it surfaced as
 * "Unexpected token '<'" with the real error lost - fuzz seed 39, the 4th /agent/start.
 *
 * No test hook makes a route throw. The workspace path is a FILE, so every route that lists
 * the workspace throws ENOTDIR synchronously from readdirSync - the same kind of throw
 * (ENOENT on a file that vanished mid-listing) that hit /agent/start in the fuzz race.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scratch, startHub, freePort } from './testHarness.mjs';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 500)}`); }
};

console.log('\n/api errors are JSON without a stack\n');

const dir = scratch('apierrors');
writeFileSync(join(dir, 'workspace'), 'not a directory\n', 'utf8');
// Port passed explicitly: startHub's own fallback calls a freePort it re-exports but never imports.
const { hub, base, log, died } = await startHub(dir, { port: await freePort(), env: { AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build' } });

const call = async (path, opts = {}) => {
  const r = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts, signal: AbortSignal.timeout(30_000) });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { status: r.status, type: r.headers.get('content-type') || '', text, body };
};

// A V8 stack frame ("at fn (C:\...\agent.js:263:30)"), or any sign of the default page.
const STACK = /\bat .*[\/][^\/]+\.m?js:\d+:\d+|<!DOCTYPE|<pre>/i;
const jsonNoStack = (r, status) => {
  assert.equal(r.status, status, `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  assert.match(r.type, /application\/json/, `content-type was "${r.type}"`);
  assert.ok(r.body && typeof r.body.error === 'string' && r.body.error.length > 0, `no { error } in: ${r.text.slice(0, 200)}`);
  assert.equal(r.body.stack, undefined, 'the body carries a stack field');
  assert.doesNotMatch(r.text, STACK, `the response leaks a stack trace: ${r.text.slice(0, 300)}`);
};

await test('the hub boots with an unusable workspace (so routes can fail for real)', async () => {
  const r = await call('/health');
  assert.equal(r.status, 200, 'health check failed');
});

await test('GET /api/agent/files throws inside the route -> 500 JSON, no stack', async () => {
  jsonNoStack(await call('/agent/files'), 500);
});

await test('POST /api/agent/start throws inside the route -> 500 JSON, no stack', async () => {
  jsonNoStack(await call('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'anything' }) }), 500);
});

await test('a malformed JSON body keeps its 400, as JSON, no stack', async () => {
  jsonNoStack(await call('/agent/start', { method: 'POST', body: '{"goal": ' }), 400);
});

await test('the stack is logged server-side instead', () => {
  const out = log.join('');
  assert.match(out, /ENOTDIR|not a directory/i, 'the failure was not logged');
  assert.match(out, /\bat .*\.m?js:\d+:\d+/, 'the stack was not logged');
});

await test('the hub is still alive afterwards', () => {
  assert.equal(died(), null, 'the hub died:\n' + log.join('').slice(-500));
});

try { hub.kill(); } catch {}
await new Promise((r) => { if (died()) return r(); hub.once('exit', r); setTimeout(r, 5000); });
console.log(`\n${passed} passed, ${failed} failed\n`);
// Natural exit, not process.exit(): on Windows the forced exit tripped a libuv assertion
// (UV_HANDLE_CLOSING) after every test had passed, turning a green run into exit 127.
process.exitCode = failed ? 1 : 0;
