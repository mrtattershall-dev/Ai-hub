/**
 * googleAuth.js - one Google sign-in for Gmail, Drive, YouTube and Calendar.
 *
 * WHAT THIS IS
 * ------------
 * OAuth 2.0 authorization code + PKCE against Google, with the refresh token kept on the
 * server so the hub can keep working while nobody is at the keyboard. That last part is
 * the whole reason it exists: an agent that runs 24/7 cannot be handed a token that dies
 * in an hour, and it cannot re-consent by itself at 4am.
 *
 * WHAT YOU HAVE TO DO YOURSELF
 * ----------------------------
 * Create the OAuth client. That means signing into your own Google account, and nobody
 * should be automating that on your behalf - see GOOGLE_SETUP.md for the six steps.
 * The hub stores the client id and secret you paste in and never displays the secret again.
 *
 * WHY THE CALLBACK IS NOT UNDER /api
 * ----------------------------------
 * Everything under /api goes through requireAuth. Google's redirect is a plain browser
 * navigation - it carries no hub token, and with HUB_TOKEN set over a tunnel it would be
 * refused. So the callback lives at /oauth/google/callback, outside the gate, and is
 * protected by the thing that actually fits a redirect: a single-use `state` value this
 * server generated minutes earlier. An attacker who has not seen that value cannot get
 * anything but a 400.
 *
 * TOKENS
 * ------
 * Stored in hub.json beside the API keys, because that file is already the hub's secret
 * store and already has atomic, serialised writes. They never leave over the API: /status
 * reports which account and which scopes, never the token, and the client secret is
 * write-only from the UI's point of view.
 */
import { Router, json } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Identity. Always requested - without it "connected as who?" has no answer. */
const BASE_SCOPES = ['openid', 'email', 'profile'];

/**
 * The services you can switch on, and what each one costs you at the consent screen.
 *
 * `restricted` is Google's own word, and it is not a formality: an app asking for a
 * restricted scope has to pass verification (and, above a threshold, a security
 * assessment) before anyone other than the developer's own test users can consent. For a
 * hub you run for yourself that is fine - you add yourself as a test user and move on -
 * but it is the reason a friend cannot just point this at their account.
 *
 * `probe` is a cheap authenticated call used to show real status rather than assumed
 * status: a token can carry a scope for an API that was never enabled in the Cloud
 * project, and the failure only shows up at the first real call otherwise.
 */
export const SERVICES = {
  gmail: {
    label: 'Gmail',
    scopes: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'],
    restricted: true,
    note: 'Read, label and send mail. Restricted scope - needs verification for anyone but your own test users.',
    probe: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
  },
  drive: {
    label: 'Google Drive',
    scopes: ['https://www.googleapis.com/auth/drive'],
    restricted: true,
    note: 'Full read/write on your Drive. Restricted scope. `drive.file` would avoid that but limits the hub to files it created or you picked.',
    probe: 'https://www.googleapis.com/drive/v3/about?fields=user',
  },
  youtube: {
    label: 'YouTube',
    scopes: ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload'],
    restricted: false,
    note: 'Manage your channel and upload videos. Sensitive scope.',
    probe: 'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
  },
  calendar: {
    label: 'Calendar',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    restricted: false,
    note: 'Read and write events. Sensitive, but the least fraught of these to get approved.',
    probe: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
  },
};

export const SERVICE_IDS = Object.keys(SERVICES);

/** Scopes for a set of enabled services. Deduped, identity always included. */
export function scopesFor(enabled = []) {
  const out = [...BASE_SCOPES];
  for (const id of enabled) {
    const svc = SERVICES[id];
    if (svc) out.push(...svc.scopes);
  }
  return [...new Set(out)];
}

/** Which enabled services the granted scopes actually cover. */
export function grantedServices(grantedScopes = [], enabled = SERVICE_IDS) {
  const granted = new Set(grantedScopes);
  return enabled.filter((id) => (SERVICES[id]?.scopes || []).every((s) => granted.has(s)));
}

// ── pending authorizations ────────────────────────────────────────────────────────────
// state -> { verifier, enabled, createdAt }. In memory on purpose: a pending sign-in that
// outlives a restart is not worth resuming, and writing the verifier to disk would put a
// short-lived secret somewhere it has no business being.
const pending = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function sweepPending(now = Date.now()) {
  for (const [k, v] of pending) if (now - v.createdAt > STATE_TTL_MS) pending.delete(k);
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Constant-time compare that cannot throw on length mismatch. */
function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  if (A.length !== B.length || A.length === 0) return false;
  return timingSafeEqual(A, B);
}

export function newAuthRequest(enabled) {
  sweepPending();
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(32));
  pending.set(state, { verifier, enabled: [...enabled], createdAt: Date.now() });
  return { state, verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

/**
 * Claim a pending request. Single use: a replayed callback must not be able to mint a
 * second token, so the entry is deleted whether or not the rest of the exchange works.
 */
export function claimAuthRequest(state) {
  sweepPending();
  for (const [k, v] of pending) {
    if (safeEqual(k, state)) { pending.delete(k); return v; }
  }
  return null;
}

export const __testing = {
  pendingSize: () => pending.size,
  clearPending: () => pending.clear(),
  expirePending: () => { for (const v of pending.values()) v.createdAt = 0; sweepPending(); },
};

// ── stored shape ──────────────────────────────────────────────────────────────────────
const emptyGoogle = () => ({ config: null, tokens: null, profile: null, enabled: [], grantedScopes: [] });

function readGoogle(db) {
  return { ...emptyGoogle(), ...(db.google || {}) };
}

/**
 * What /status is allowed to say. No token, no refresh token, no client secret - the UI
 * has no use for any of them, and an endpoint that returns a secret is one XSS away from
 * handing over the account.
 */
export function publicStatus(g, now = Date.now()) {
  const configured = !!(g.config?.client_id && g.config?.client_secret);
  const connected = !!g.tokens?.refresh_token;
  return {
    configured,
    connected,
    clientId: g.config?.client_id || null,          // not a secret; useful for "is this the right project?"
    email: g.profile?.email || null,
    name: g.profile?.name || null,
    picture: g.profile?.picture || null,
    enabled: g.enabled || [],
    granted: connected ? grantedServices(g.grantedScopes, g.enabled) : [],
    grantedScopes: g.grantedScopes || [],
    accessTokenExpiresIn: g.tokens?.expires_at ? Math.max(0, Math.round((g.tokens.expires_at - now) / 1000)) : null,
    connectedAt: g.profile?.connectedAt || null,
    services: SERVICE_IDS.map((id) => ({ id, ...SERVICES[id], scopes: SERVICES[id].scopes })),
  };
}

// ── token exchange ────────────────────────────────────────────────────────────────────
async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Google's error bodies are terse but exact; passing them through beats inventing a
    // friendlier message that hides which of six things went wrong.
    const err = new Error(body.error_description || body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.googleError = body.error || null;
    throw err;
  }
  return body;
}

const expiryFrom = (body, now = Date.now()) => now + (Number(body.expires_in || 0) * 1000);

/**
 * A valid access token, refreshing if it is about to expire.
 *
 * The 60-second margin matters more here than in a normal app: a token that passes the
 * check and then expires mid-request fails an unattended job that nobody is watching, and
 * the retry costs a whole run.
 *
 * Exported so other server code (an agent tool, a future Gmail route) has one place to get
 * a token from, rather than each growing its own refresh logic and its own race.
 */
export async function getAccessToken({ loadDb, saveDb, withDb }) {
  const g = readGoogle(loadDb());
  if (!g.tokens?.refresh_token) throw new Error('Google is not connected');
  if (g.tokens.access_token && g.tokens.expires_at - Date.now() > 60_000) return g.tokens.access_token;

  // SINGLE FLIGHT. Tools fan out - gmail_search fetches metadata for every hit with
  // Promise.all - so an expired token is discovered by ten callers in the same tick, and
  // without this each one starts its own refresh. Measured: ten. That is ten round trips
  // for one token, ten racing writes to hub.json, and it would be outright broken against
  // an issuer that rotates refresh tokens. Joiners await the first caller's promise.
  if (refreshInFlight) return refreshInFlight;
  const flight = doRefresh({ loadDb, saveDb, withDb }, g);
  refreshInFlight = flight;
  try { return await flight; }
  finally { if (refreshInFlight === flight) refreshInFlight = null; }
}

let refreshInFlight = null;

async function doRefresh({ loadDb, saveDb, withDb }, g) {
  let body;
  try {
    body = await postForm(TOKEN_URL, {
      client_id: g.config.client_id,
      client_secret: g.config.client_secret,
      refresh_token: g.tokens.refresh_token,
      grant_type: 'refresh_token',
    });
  } catch (e) {
    // invalid_grant means the refresh token is dead for good - revoked, password changed,
    // or six months idle. Clearing it turns every later call into a clean "not connected"
    // instead of a retry loop against a token that can never work again.
    if (e.googleError === 'invalid_grant') {
      await withDb(async () => {
        const db = loadDb();
        db.google = { ...readGoogle(db), tokens: null, profile: null, grantedScopes: [] };
        saveDb(db);
      });
      throw new Error('Google sign-in has expired or been revoked - reconnect in Settings');
    }
    throw e;
  }

  await withDb(async () => {
    const db = loadDb();
    const cur = readGoogle(db);
    db.google = {
      ...cur,
      // Google does not resend the refresh token on a refresh; keeping the old one is the
      // difference between staying connected and silently logging out on the first refresh.
      tokens: { ...cur.tokens, access_token: body.access_token, expires_at: expiryFrom(body) },
    };
    saveDb(db);
  });
  return body.access_token;
}

// ── routes ────────────────────────────────────────────────────────────────────────────
export function googleRouter({ loadDb, saveDb, withDb, redirectUri }) {
  const router = Router();
  router.use(json({ limit: '64kb' }));

  // Every route that returns status returns the SAME shape, redirectUri included. It used
  // to be added only by /status, so saving the OAuth client or disconnecting replaced the
  // client's status object with one missing it - and the "paste this into Google" field
  // silently went blank at exactly the moment someone was using it.
  const status = (db) => ({ ...publicStatus(readGoogle(db)), redirectUri });

  router.get('/status', (_req, res) => res.json(status(loadDb())));

  // Save the OAuth client. The secret is accepted and never handed back; posting an empty
  // secret keeps the stored one, so you can change the id without retyping it.
  router.post('/config', (req, res) => withDb(async () => {
    const client_id = String(req.body?.client_id || '').trim();
    const client_secret = String(req.body?.client_secret || '').trim();
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    const db = loadDb();
    const cur = readGoogle(db);
    const secret = client_secret || cur.config?.client_secret;
    if (!secret) return res.status(400).json({ error: 'client_secret is required the first time' });

    // Changing the client invalidates any token minted by the old one, so drop them rather
    // than leave a token that will fail confusingly on its next refresh.
    const clientChanged = cur.config?.client_id && cur.config.client_id !== client_id;
    db.google = {
      ...cur,
      config: { client_id, client_secret: secret },
      ...(clientChanged ? { tokens: null, profile: null, grantedScopes: [] } : {}),
    };
    saveDb(db);
    res.json({ ...status(db), clientChanged: !!clientChanged });
  }));

  // Which services to ask for. Stored before the redirect so the callback knows what was
  // requested even though the browser round-trip carries nothing but `state` and `code`.
  router.post('/services', (req, res) => withDb(async () => {
    const wanted = Array.isArray(req.body?.enabled) ? req.body.enabled : [];
    const enabled = wanted.filter((id) => SERVICE_IDS.includes(id));
    const db = loadDb();
    db.google = { ...readGoogle(db), enabled };
    saveDb(db);
    res.json(status(db));
  }));

  router.post('/authorize', (req, res) => {
    const g = readGoogle(loadDb());
    if (!g.config?.client_id) return res.status(400).json({ error: 'Add your OAuth client id and secret first' });

    const wanted = Array.isArray(req.body?.enabled) ? req.body.enabled.filter((id) => SERVICE_IDS.includes(id)) : g.enabled;
    if (!wanted.length) return res.status(400).json({ error: 'Turn on at least one service before connecting' });

    const { state, challenge } = newAuthRequest(wanted);
    const url = `${AUTH_URL}?` + new URLSearchParams({
      client_id: g.config.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopesFor(wanted).join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      // offline + consent is what actually produces a refresh token. Without `consent`,
      // Google silently omits it on every sign-in after the first, and the hub works
      // until the first hour is up and then cannot refresh.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    }).toString();

    res.json({ url });
  });

  router.post('/disconnect', (_req, res) => withDb(async () => {
    const db = loadDb();
    const g = readGoogle(db);
    const token = g.tokens?.refresh_token || g.tokens?.access_token;
    db.google = { ...g, tokens: null, profile: null, grantedScopes: [] };
    saveDb(db);
    // Tell Google too. Dropping our copy only stops the hub using it; the grant stays on
    // the account until it is revoked, and "disconnect" should mean disconnected.
    let revoked = false;
    if (token) {
      try { await postForm(REVOKE_URL, { token }); revoked = true; }
      catch { revoked = false; }
    }
    res.json({ ...status(db), revoked });
  }));

  /**
   * Ask each connected service whether it really works.
   *
   * A granted scope is not the same as a working API: the matching API also has to be
   * enabled in the Cloud project, and when it is not, the only symptom is a 403 at the
   * first real call. Better to find that out from a button in Settings than from a failed
   * unattended run.
   */
  router.post('/probe', async (_req, res) => {
    const g = readGoogle(loadDb());
    if (!g.tokens?.refresh_token) return res.status(400).json({ error: 'Google is not connected' });

    let token;
    try { token = await getAccessToken({ loadDb, saveDb, withDb }); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    const targets = grantedServices(g.grantedScopes, g.enabled);
    const results = {};
    await Promise.all(targets.map(async (id) => {
      try {
        const r = await fetch(SERVICES[id].probe, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { results[id] = { ok: true }; return; }
        const body = await r.json().catch(() => ({}));
        const msg = body?.error?.message || `HTTP ${r.status}`;
        results[id] = {
          ok: false,
          error: /has not been used|is disabled/i.test(msg)
            ? `The ${SERVICES[id].label} API is not enabled in your Google Cloud project.`
            : msg,
        };
      } catch (e) {
        results[id] = { ok: false, error: e.message };
      }
    }));
    res.json({ results });
  });

  return router;
}

/**
 * The redirect target. Deliberately mounted outside the /api gate - see the header.
 * Returns a small HTML page either way, because what lands here is a person's browser,
 * not a client that can read JSON.
 */
export function googleCallbackRouter({ loadDb, saveDb, withDb, redirectUri, appUrl }) {
  const router = Router();

  router.get('/callback', async (req, res) => {
    const done = (ok, title, detail) => res.status(ok ? 200 : 400).type('html').send(page(ok, title, detail, appUrl));

    const { code, state, error } = req.query || {};
    // The user pressed Cancel, or Google refused. Not an error worth a stack trace.
    if (error) return done(false, 'Google did not grant access', String(error));
    if (!code || !state) return done(false, 'Malformed redirect', 'No authorization code was present.');

    const req_ = claimAuthRequest(String(state));
    if (!req_) return done(false, 'That sign-in link has expired', 'Start the connection again from Settings. Links are single-use and last ten minutes.');

    const g = readGoogle(loadDb());
    if (!g.config?.client_id) return done(false, 'No OAuth client configured', 'Add your client id and secret in Settings.');

    try {
      const body = await postForm(TOKEN_URL, {
        code: String(code),
        client_id: g.config.client_id,
        client_secret: g.config.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: req_.verifier,
      });

      if (!body.refresh_token) {
        return done(false, 'Google returned no refresh token',
          'Without one the hub would stop working in an hour. Remove the hub from your Google account permissions and connect again.');
      }

      const granted = String(body.scope || '').split(' ').filter(Boolean);
      let profile = {};
      try {
        const r = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${body.access_token}` } });
        if (r.ok) profile = await r.json();
      } catch { /* the connection is still good without a display name */ }

      await withDb(async () => {
        const db = loadDb();
        const cur = readGoogle(db);
        db.google = {
          ...cur,
          enabled: req_.enabled,
          grantedScopes: granted,
          tokens: {
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            expires_at: expiryFrom(body),
            token_type: body.token_type || 'Bearer',
          },
          profile: {
            email: profile.email || null,
            name: profile.name || null,
            picture: profile.picture || null,
            connectedAt: Date.now(),
          },
        };
        saveDb(db);
      });

      // Say what was actually granted, not what was asked for. Google lets you untick
      // individual services on the consent screen, and a hub that claims four when you
      // approved two is lying to you at the least convenient moment.
      const got = grantedServices(granted, req_.enabled).map((id) => SERVICES[id].label);
      const missed = req_.enabled.filter((id) => !grantedServices(granted, req_.enabled).includes(id))
        .map((id) => SERVICES[id].label);
      return done(true, `Connected as ${profile.email || 'your Google account'}`,
        `Granted: ${got.join(', ') || 'sign-in only'}.` + (missed.length ? ` Not granted: ${missed.join(', ')}.` : ''));
    } catch (e) {
      return done(false, 'Could not complete the sign-in', e.message);
    }
  });

  return router;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function page(ok, title, detail, appUrl) {
  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px;
         background: #0c0d11; color: #e7e8ee; }
  .card { max-width: 30rem; text-align: center; }
  .mark { font-size: 34px; line-height: 1; margin-bottom: 12px; }
  h1 { font-size: 17px; margin: 0 0 8px; }
  p { color: #9aa0ad; margin: 0 0 18px; }
  a { color: #8b7cff; }
  @media (prefers-color-scheme: light) { body { background: #fff; color: #111110; } p { color: #6b6b65; } }
</style>
<div class="card">
  <div class="mark">${ok ? '&#10003;' : '&#9888;'}</div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(detail)}</p>
  <p><a href="${escapeHtml(appUrl)}">Back to the hub</a> - you can close this tab.</p>
</div>`;
}
