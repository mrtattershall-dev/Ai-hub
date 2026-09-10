/**
 * googleE2E.test.mjs - the whole Google connection, against a scripted Google.
 *
 *   node server/googleE2E.test.mjs
 *
 * Boots a real hub (its own PORT, HUB_DB and AGENT_QUEUE_FILE in a temp dir) pointed at
 * `fakegoogle.mjs`, and drives the flow the way a browser does: save the OAuth client, ask
 * for an authorize URL, follow it, come back to the callback with the code and state.
 *
 * Everything here was previously reachable only by connecting a real Google account, which
 * means it had never been executed once. The four scripts cover the cases a real Google
 * cannot be asked to produce on demand: a partial grant, a missing refresh token, and a
 * grant that has been revoked.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from 'node:os';
import { freePorts } from './testPort.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, deadlineMs = 20000, log = () => '') {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await wait(150);
  }
  throw new Error(`nothing answered at ${url}\n${log()}`);
}

/**
 * One hub + one fake Google, both disposable.
 *
 * `script` picks the fake's behaviour. Each harness gets its own temp HUB_DB, so a test
 * that connects an account cannot leave a token behind in yours.
 */
async function harness(script = 'happy') {
  const TMP = mkdtempSync(join(tmpdir(), `google-e2e-${script}-`));
  // Asked for, not guessed: these bands used to overlap chatTimeout's and loopSmoke's, so
  // the suite passed alone and collided in a full sweep. See testPort.mjs.
  const [gPort, hPort] = await freePorts(2);
  const G = `http://127.0.0.1:${gPort}`;
  const H = `http://127.0.0.1:${hPort}`;

  let google = spawn(process.execPath, [join(__dirname, 'fakegoogle.mjs'), '--port', String(gPort), '--script', script], { stdio: 'ignore' });
  const restartGoogle = async (nextScript) => {
    google.kill();
    // Wait for the port to actually free up; spawning straight away just gets EADDRINUSE
    // and leaves the OLD behaviour answering, which is how a test like this passes without
    // testing anything.
    await wait(300);
    google = spawn(process.execPath, [join(__dirname, 'fakegoogle.mjs'), '--port', String(gPort), '--script', nextScript], { stdio: 'ignore' });
    await waitFor(`${G}/revoke`);
  };

  let log = '';
  const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
    env: {
      ...process.env,
      PORT: String(hPort),
      HUB_DB: join(TMP, 'hub.json'),
      AGENT_QUEUE_FILE: join(TMP, 'agent-queue.json'),
      AGENT_SUPERVISOR: '0',
      GOOGLE_AUTH_URL: `${G}/auth`,
      GOOGLE_TOKEN_URL: `${G}/token`,
      GOOGLE_USERINFO_URL: `${G}/userinfo`,
      GOOGLE_REVOKE_URL: `${G}/revoke`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  hub.stdout.on('data', (d) => { log += d; });
  hub.stderr.on('data', (d) => { log += d; });

  await waitFor(`${G}/revoke`);
  await waitFor(`${H}/api/health`, 20000, () => log.slice(-800));

  const api = async (path, options) => {
    const res = await fetch(H + '/api' + path, {
      ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  return {
    api, H, G, TMP, restartGoogle,
    dbFile: join(TMP, 'hub.json'),
    /** Age the stored access token so the next call has to refresh. */
    expireAccessToken() {
      const file = join(TMP, 'hub.json');
      const db = JSON.parse(readFileSync(file, 'utf8'));
      db.google.tokens.expires_at = Date.now() - 60_000;
      writeFileSync(file, JSON.stringify(db, null, 2), 'utf8');
    },
    stop() {
      hub.kill(); google.kill();
      try { rmSync(TMP, { recursive: true, force: true }); } catch {}
    },
    /** Save an OAuth client, then walk the redirect the way a browser would. */
    async connect(services = ['gmail', 'calendar']) {
      await api('/google/config', { method: 'POST', body: JSON.stringify({ client_id: 'test.apps.googleusercontent.com', client_secret: 'GOCSPX-test' }) });
      const { body: auth } = await api('/google/authorize', { method: 'POST', body: JSON.stringify({ enabled: services }) });
      const authUrl = new URL(auth.url);
      // The fake consent screen hands back a code instead of redirecting.
      const consent = await (await fetch(auth.url)).json();
      const cb = await fetch(`${H}/oauth/google/callback?code=${consent.code}&state=${encodeURIComponent(authUrl.searchParams.get('state'))}`);
      return { authUrl, consent, callbackStatus: cb.status, callbackHtml: await cb.text() };
    },
  };
}

// ── the happy path ──────────────────────────────────────────────────────────────────────
{
  const h = await harness('happy');
  try {
    await test('a full sign-in stores a refresh token and reports the account', async () => {
      const { callbackStatus, callbackHtml } = await h.connect(['gmail', 'calendar']);
      assert.equal(callbackStatus, 200, callbackHtml.slice(0, 300));
      assert.match(callbackHtml, /Connected as you@example\.com/);

      const { body } = await h.api('/google/status');
      assert.equal(body.connected, true);
      assert.equal(body.email, 'you@example.com');
      assert.deepEqual(body.granted.sort(), ['calendar', 'gmail']);
    });

    await test('the token is on disk, and the API still refuses to hand it out', async () => {
      const raw = readFileSync(h.dbFile, 'utf8');
      assert.match(raw, /refresh_/, 'the refresh token should be persisted');
      const { body } = await h.api('/google/status');
      const shown = JSON.stringify(body);
      assert.ok(!shown.includes('refresh_'), 'status leaked the refresh token');
      assert.ok(!shown.includes('GOCSPX-test'), 'status leaked the client secret');
    });

    await test('the same authorization code cannot be replayed', async () => {
      const { body: auth } = await h.api('/google/authorize', { method: 'POST', body: JSON.stringify({ enabled: ['gmail'] }) });
      const state = new URL(auth.url).searchParams.get('state');
      const consent = await (await fetch(auth.url)).json();
      const first = await fetch(`${h.H}/oauth/google/callback?code=${consent.code}&state=${encodeURIComponent(state)}`);
      assert.equal(first.status, 200);
      // State is single use, so the replay is refused before the code is even presented.
      const replay = await fetch(`${h.H}/oauth/google/callback?code=${consent.code}&state=${encodeURIComponent(state)}`);
      assert.equal(replay.status, 400);
      assert.match(await replay.text(), /expired/);
    });

    await test('disconnect clears the token and revokes it upstream', async () => {
      const { body } = await h.api('/google/disconnect', { method: 'POST' });
      assert.equal(body.connected, false);
      assert.equal(body.revoked, true, 'the grant should have been revoked at Google, not just forgotten');
      const raw = readFileSync(h.dbFile, 'utf8');
      assert.ok(!/refresh_/.test(raw), 'the refresh token should be gone from disk');
    });
  } finally { h.stop(); }
}

// ── a partial grant: services unticked on the consent screen ────────────────────────────
{
  const h = await harness('partial');
  try {
    await test('a service the user unticked is reported as NOT granted', async () => {
      const { callbackHtml } = await h.connect(['gmail', 'calendar']);
      const { body } = await h.api('/google/status');
      assert.equal(body.connected, true, 'the connection still succeeds for what WAS granted');
      assert.deepEqual(body.granted, ['calendar']);
      assert.match(callbackHtml, /Not granted: Gmail/);
    });
  } finally { h.stop(); }
}

// ── Google returns no refresh token ─────────────────────────────────────────────────────
{
  const h = await harness('no_refresh');
  try {
    await test('a sign-in with no refresh token is refused, not stored', async () => {
      const { callbackStatus, callbackHtml } = await h.connect(['gmail']);
      assert.equal(callbackStatus, 400);
      assert.match(callbackHtml, /no refresh token/i);
      // Storing the access token would look connected and then stop working in an hour,
      // with nothing to refresh from and no way to tell why.
      const { body } = await h.api('/google/status');
      assert.equal(body.connected, false);
    });
  } finally { h.stop(); }
}

// ── the grant is revoked from the Google side ───────────────────────────────────────────
{
  // Connect against a working Google first, then restart the fake as dead_grant so the
  // stored refresh token is the one that gets rejected - which is what a revoke, a password
  // change, or six months of inactivity looks like to the hub.
  const h = await harness('happy');
  try {
    await h.connect(['calendar']);

    await test('a refresh keeps the refresh token Google did not resend', async () => {
      const before = JSON.parse(readFileSync(h.dbFile, 'utf8')).google.tokens;
      h.expireAccessToken();
      const { body } = await h.api('/google/probe', { method: 'POST' });
      assert.ok(!body.error, `probe failed: ${body.error}`);
      const after = JSON.parse(readFileSync(h.dbFile, 'utf8')).google.tokens;
      assert.equal(after.refresh_token, before.refresh_token, 'the refresh token was lost on refresh');
      assert.notEqual(after.access_token, before.access_token, 'the access token should have been replaced');
      assert.ok(after.expires_at > Date.now(), 'the new expiry should be in the future');
    });

    await test('a grant revoked at Google is CLEARED locally, not retried forever', async () => {
      await h.restartGoogle('dead_grant');
      h.expireAccessToken();
      const { body } = await h.api('/google/probe', { method: 'POST' });
      assert.match(body.error || '', /expired or been revoked/, 'the dead grant should be reported in plain words');

      // The point of clearing it: every later call now fails as "not connected", which is
      // actionable, instead of retrying a token that can never work again.
      const { body: status } = await h.api('/google/status');
      assert.equal(status.connected, false);
      assert.ok(!/refresh_/.test(readFileSync(h.dbFile, 'utf8')), 'the dead refresh token should be gone from disk');
    });
  } finally { h.stop(); }
}

console.log(`google e2e: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
