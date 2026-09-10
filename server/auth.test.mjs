/**
 * auth.test.mjs - the gate must not trust the loopback interface once a token is set.
 *
 *   node server/auth.test.mjs
 *
 * `allowed()` used to end with `return isLocal(req)` even when HUB_TOKEN was configured.
 * That defeated the gate in precisely the situation it was written for: a tunnel
 * (Cloudflare, ngrok, an SSH forward, any reverse proxy) TERMINATES ON THIS MACHINE and
 * then dials the hub over loopback, so every request forwarded from the public internet
 * arrived with remoteAddress 127.0.0.1 and was waved through as a trusted local caller.
 * Anyone holding the tunnel URL got the PTY, the agent and the verifiers, unauthenticated.
 *
 * HUB_TOKEN is captured at module load, so each posture needs its own process.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH = join(__dirname, 'auth.js').replace(/\\/g, '/');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

/** Run a snippet in a child with the given HUB_TOKEN, return its JSON stdout. */
function inChild(hubToken, body) {
  const src = `
    const { allowed, isLocal } = await import('file:///${AUTH}');
    const reqFrom = (ip, headers = {}, url = '/api/x') => ({ socket: { remoteAddress: ip }, headers, url });
    const out = (${body});
    process.stdout.write(JSON.stringify(out));
  `;
  const env = { ...process.env };
  if (hubToken === null) delete env.HUB_TOKEN; else env.HUB_TOKEN = hubToken;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', src], { env, encoding: 'utf8' }));
}

console.log('\nauth gate\n');

// ── no token configured: localhost only (unchanged behaviour) ────────────────
test('with no token, a local caller is allowed', () => {
  assert.equal(inChild(null, `allowed(reqFrom('127.0.0.1'))`), true);
});

test('with no token, a remote caller is refused', () => {
  assert.equal(inChild(null, `allowed(reqFrom('203.0.113.9'))`), false);
});

// ── token configured: the token is the ONLY key ──────────────────────────────
test('with a token, the correct token is accepted', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('203.0.113.9', { 'x-hub-token': 's3cret' }))`), true);
});

test('with a token, a wrong token is refused', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('203.0.113.9', { 'x-hub-token': 'nope' }))`), false);
});

test('THE TUNNEL HOLE: a loopback caller with no token is refused once a token is set', () => {
  assert.equal(
    inChild('s3cret', `allowed(reqFrom('127.0.0.1'))`), false,
    'a locally-terminated tunnel would hand the PTY to anyone with the URL',
  );
});

test('...including the IPv6 and mapped loopback forms', () => {
  assert.deepEqual(
    inChild('s3cret', `[allowed(reqFrom('::1')), allowed(reqFrom('::ffff:127.0.0.1'))]`),
    [false, false],
  );
});

test('a loopback caller WITH the token still works (local UI keeps functioning)', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('127.0.0.1', { 'x-hub-token': 's3cret' }))`), true);
});

test('the websocket query-string form is accepted', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('203.0.113.9', {}, '/api/terminal?token=s3cret'))`), true);
});

// ── constant-time compare ────────────────────────────────────────────────────
test('a token of the wrong length is refused without throwing', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('203.0.113.9', { 'x-hub-token': 'x' }))`), false);
});

test('a missing token is refused without throwing', () => {
  assert.equal(inChild('s3cret', `allowed(reqFrom('203.0.113.9', {}, '/api/x'))`), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
