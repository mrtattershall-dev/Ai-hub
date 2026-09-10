/**
 * googleRefresh.test.mjs - what happens when several tools need a token at once.
 *
 *   node server/googleRefresh.test.mjs
 *
 * `gmail_search` fetches metadata for every hit with Promise.all, so a search returning ten
 * messages asks for a token ten times in the same tick. If the access token has expired,
 * every one of those sees an expired token and starts its own refresh.
 *
 * `fetch` is stubbed here - no network, no real credentials.
 */
import assert from 'node:assert/strict';
import { getAccessToken } from './googleAuth.js';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

/** A db whose stored token is already expired, so any call must refresh. */
function fakeDb(expiresInMs = -1000) {
  const state = {
    google: {
      config: { client_id: 'id', client_secret: 'secret' },
      tokens: { access_token: 'old', refresh_token: 'rt', expires_at: Date.now() + expiresInMs },
      grantedScopes: [], enabled: [], profile: null,
    },
  };
  return {
    loadDb: () => JSON.parse(JSON.stringify(state)),
    saveDb: (db) => { Object.assign(state, db); },
    withDb: (fn) => fn(),
    peek: () => state,
  };
}

function stubFetch(onRefresh) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      onRefresh();
      // A little latency is what makes the race real: without it each call resolves
      // before the next begins and the bug cannot reproduce.
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, json: async () => ({ access_token: 'fresh', expires_in: 3600 }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return () => { globalThis.fetch = real; };
}

await test('ten tools needing a token at once cause exactly ONE refresh', async () => {
  const db = fakeDb();
  let refreshes = 0;
  const restore = stubFetch(() => { refreshes++; });
  try {
    const tokens = await Promise.all(Array.from({ length: 10 }, () => getAccessToken(db)));
    assert.ok(tokens.every((t) => t === 'fresh'), 'every caller must get the refreshed token');
    assert.equal(refreshes, 1,
      `${refreshes} refresh requests fired for one expired token - each concurrent caller started its own`);
  } finally { restore(); }
});

await test('a later call reuses the stored token instead of refreshing again', async () => {
  const db = fakeDb();
  let refreshes = 0;
  const restore = stubFetch(() => { refreshes++; });
  try {
    await getAccessToken(db);
    await getAccessToken(db);
    assert.equal(refreshes, 1, 'the second call should have used the token the first one stored');
  } finally { restore(); }
});

await test('a token with plenty of life left triggers no refresh at all', async () => {
  const db = fakeDb(3600_000);
  let refreshes = 0;
  const restore = stubFetch(() => { refreshes++; });
  try {
    assert.equal(await getAccessToken(db), 'old');
    assert.equal(refreshes, 0);
  } finally { restore(); }
});

await test('a token inside the 60s margin is refreshed early, not handed out to expire mid-call', async () => {
  const db = fakeDb(30_000);
  let refreshes = 0;
  const restore = stubFetch(() => { refreshes++; });
  try {
    assert.equal(await getAccessToken(db), 'fresh');
    assert.equal(refreshes, 1);
  } finally { restore(); }
});

await test('the refresh token is kept - Google does not resend it, and losing it logs you out', async () => {
  const db = fakeDb();
  const restore = stubFetch(() => {});
  try {
    await getAccessToken(db);
    assert.equal(db.peek().google.tokens.refresh_token, 'rt');
  } finally { restore(); }
});

console.log(`google refresh: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
