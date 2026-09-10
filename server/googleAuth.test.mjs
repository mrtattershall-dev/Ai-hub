/**
 * googleAuth.test.mjs - the parts of the Google connection that must not be wrong.
 *
 *   node server/googleAuth.test.mjs
 *
 * Talks to no network and touches no stored state: everything here is the pure logic
 * around the exchange - which scopes get asked for, what the UI is allowed to see, and the
 * single-use lifetime of the `state` that protects the un-gated callback.
 *
 * The redaction tests are the ones to keep. An endpoint that quietly starts returning a
 * refresh token still looks fine in the UI, and nothing else in the system would notice.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  scopesFor, grantedServices, publicStatus, newAuthRequest, claimAuthRequest,
  SERVICES, SERVICE_IDS, __testing,
} from './googleAuth.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---- scopes -------------------------------------------------------------------------
test('identity scopes are always requested, so "connected as who?" has an answer', () => {
  for (const s of ['openid', 'email', 'profile']) assert.ok(scopesFor([]).includes(s));
});

test('each service contributes its own scopes', () => {
  const s = scopesFor(['gmail', 'calendar']);
  assert.ok(s.includes('https://www.googleapis.com/auth/gmail.send'));
  assert.ok(s.includes('https://www.googleapis.com/auth/calendar'));
  assert.ok(!s.includes('https://www.googleapis.com/auth/drive'), 'a service that was off must not be requested');
});

test('scopes are deduped, and an unknown service is ignored rather than fatal', () => {
  const s = scopesFor(['gmail', 'gmail', 'not-a-service']);
  assert.equal(new Set(s).size, s.length);
  assert.deepEqual(scopesFor(['not-a-service']), scopesFor([]));
});

test('every service declares scopes and a probe, or status would silently skip it', () => {
  for (const id of SERVICE_IDS) {
    assert.ok(SERVICES[id].scopes?.length, `${id} has no scopes`);
    assert.ok(/^https:\/\//.test(SERVICES[id].probe || ''), `${id} has no probe URL`);
    assert.ok(SERVICES[id].label, `${id} has no label`);
  }
});

// ---- what was actually granted --------------------------------------------------------
test('a service counts as granted only when ALL of its scopes came back', () => {
  const partial = ['https://www.googleapis.com/auth/gmail.modify'];   // .send was unticked
  assert.deepEqual(grantedServices(partial, ['gmail']), []);
  assert.deepEqual(grantedServices([...partial, 'https://www.googleapis.com/auth/gmail.send'], ['gmail']), ['gmail']);
});

test('unticking one service on the consent screen does not take the others down', () => {
  const granted = [...SERVICES.calendar.scopes, ...SERVICES.youtube.scopes];
  assert.deepEqual(grantedServices(granted, ['gmail', 'calendar', 'youtube']), ['calendar', 'youtube']);
});

// ---- redaction ------------------------------------------------------------------------
const CONNECTED = {
  config: { client_id: 'abc.apps.googleusercontent.com', client_secret: 'GOCSPX-supersecret' },
  tokens: { access_token: 'ya29.at', refresh_token: '1//rt', expires_at: Date.now() + 3600_000 },
  profile: { email: 'me@example.com', name: 'Me', connectedAt: 1789000000000 },
  enabled: ['gmail'],
  grantedScopes: SERVICES.gmail.scopes,
};

test('status never carries the client secret or either token', () => {
  const blob = JSON.stringify(publicStatus(CONNECTED));
  for (const secret of ['GOCSPX-supersecret', 'ya29.at', '1//rt']) {
    assert.ok(!blob.includes(secret), `status leaked ${secret}`);
  }
});

test('status still says enough to be useful: who, what, and how long left', () => {
  const now = Date.now();
  const s = publicStatus(CONNECTED, now);
  assert.equal(s.connected, true);
  assert.equal(s.configured, true);
  assert.equal(s.email, 'me@example.com');
  assert.deepEqual(s.granted, ['gmail']);
  assert.equal(s.clientId, 'abc.apps.googleusercontent.com', 'the client id is not a secret and identifies the project');
  assert.ok(s.accessTokenExpiresIn > 3500 && s.accessTokenExpiresIn <= 3600);
});

test('a configured but unconnected account reads as configured, not connected', () => {
  const s = publicStatus({ ...CONNECTED, tokens: null, profile: null, grantedScopes: [] });
  assert.equal(s.configured, true);
  assert.equal(s.connected, false);
  assert.deepEqual(s.granted, [], 'nothing is granted without a token');
  assert.equal(s.accessTokenExpiresIn, null);
});

test('an expired access token reports 0 rather than a negative countdown', () => {
  const s = publicStatus({ ...CONNECTED, tokens: { ...CONNECTED.tokens, expires_at: Date.now() - 5000 } });
  assert.equal(s.accessTokenExpiresIn, 0);
});

// ---- the state that guards the un-gated callback ---------------------------------------
test('the PKCE challenge really is S256 of the verifier', () => {
  __testing.clearPending();
  const { verifier, challenge } = newAuthRequest(['gmail']);
  assert.equal(challenge, b64url(createHash('sha256').update(verifier).digest()));
  assert.ok(!/[+/=]/.test(challenge), 'the challenge must be base64URL, not base64');
});

test('state is single use - a replayed callback cannot mint a second token', () => {
  __testing.clearPending();
  const { state } = newAuthRequest(['drive']);
  assert.ok(claimAuthRequest(state));
  assert.equal(claimAuthRequest(state), null, 'the second claim must fail');
});

test('a state this server never issued is refused', () => {
  __testing.clearPending();
  newAuthRequest(['drive']);
  assert.equal(claimAuthRequest('made-up-state'), null);
  assert.equal(claimAuthRequest(''), null);
  assert.equal(claimAuthRequest(undefined), null);
});

test('a stale sign-in expires instead of waiting around to be used', () => {
  __testing.clearPending();
  const { state } = newAuthRequest(['gmail']);
  __testing.expirePending();
  assert.equal(claimAuthRequest(state), null);
  assert.equal(__testing.pendingSize(), 0, 'expired entries are swept, not merely ignored');
});

test('the claim carries back the services the redirect was started with', () => {
  __testing.clearPending();
  const { state } = newAuthRequest(['gmail', 'youtube']);
  assert.deepEqual(claimAuthRequest(state).enabled, ['gmail', 'youtube']);
});

test('two sign-ins in flight do not disturb each other', () => {
  __testing.clearPending();
  const a = newAuthRequest(['gmail']);
  const b = newAuthRequest(['drive']);
  assert.notEqual(a.state, b.state);
  assert.deepEqual(claimAuthRequest(b.state).enabled, ['drive']);
  assert.deepEqual(claimAuthRequest(a.state).enabled, ['gmail'], 'claiming one must not evict the other');
});

console.log(`google auth: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
