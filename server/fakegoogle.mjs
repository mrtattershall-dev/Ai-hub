/**
 * fakegoogle.mjs - a scripted Google OAuth server, for testing the half that never ran.
 *
 *   node server/fakegoogle.mjs --port 11600 [--script happy]
 *   then point the hub at it:
 *     GOOGLE_TOKEN_URL=http://localhost:11600/token
 *     GOOGLE_USERINFO_URL=http://localhost:11600/userinfo
 *     GOOGLE_REVOKE_URL=http://localhost:11600/revoke
 *     GOOGLE_AUTH_URL=http://localhost:11600/auth
 *
 * WHY
 * ---
 * Same reason `fakemodel.mjs` exists. Everything past "Google returned a token" - storing
 * it, keeping the refresh token across a refresh, recovering from invalid_grant, reporting
 * what was actually granted rather than what was asked for - could only be exercised by
 * connecting a real account, which needs a Cloud project, a consent screen and a human.
 * So it was never exercised at all, and the failure modes it guards against are precisely
 * the ones that show up a week later at 4am.
 *
 * A real Google cannot be asked to deny a scope on cue, to omit a refresh token, or to
 * declare a grant dead. This one can:
 *
 *   happy        everything works
 *   partial      grants only SOME requested scopes (you unticked one on the consent screen)
 *   no_refresh   returns an access token but NO refresh token
 *   dead_grant   the refresh token is rejected with invalid_grant
 *
 * It is deliberately dumb. It checks that the client id, secret and PKCE verifier arrive,
 * and otherwise plays its script.
 */
import { createServer } from 'http';
import { createHash } from 'crypto';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = parseInt(val('port', '11600'), 10);
const SCRIPT = val('script', 'happy');

/** Codes handed out by /auth, so the exchange can verify PKCE the way Google does. */
const codes = new Map();
let issuedRefreshTokens = 0;

const ACCOUNT = { email: 'you@example.com', name: 'Test Account', sub: '1234567890' };

const json = (res, status, body) => {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
};

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const readBody = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', (d) => { b += d; });
  req.on('end', () => resolve(new URLSearchParams(b)));
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── the consent screen ──────────────────────────────────────────────────────────────
  // A real one shows a page and redirects. Here the caller just needs a code, so /auth
  // records the request and hands one back as JSON; the test performs the redirect itself.
  if (url.pathname === '/auth') {
    const code = `code_${Math.random().toString(36).slice(2, 10)}`;
    codes.set(code, {
      challenge: url.searchParams.get('code_challenge'),
      scope: url.searchParams.get('scope') || '',
      redirect_uri: url.searchParams.get('redirect_uri'),
    });
    return json(res, 200, { code, state: url.searchParams.get('state') });
  }

  if (url.pathname === '/token') {
    const form = await readBody(req);
    if (!form.get('client_id') || !form.get('client_secret')) {
      return json(res, 400, { error: 'invalid_client', error_description: 'client id and secret are required' });
    }

    // ── refreshing an existing grant ─────────────────────────────────────────────────
    if (form.get('grant_type') === 'refresh_token') {
      if (SCRIPT === 'dead_grant') {
        return json(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
      }
      // Note what a real Google does and this copies: NO refresh_token in the response.
      // A client that overwrites its stored one with undefined logs itself out here.
      return json(res, 200, { access_token: `access_${Date.now()}`, expires_in: 3600, token_type: 'Bearer' });
    }

    // ── exchanging an authorization code ─────────────────────────────────────────────
    const code = form.get('code');
    const known = codes.get(code);
    if (!known) return json(res, 400, { error: 'invalid_grant', error_description: 'Bad authorization code' });
    codes.delete(code);                              // single use, like the real thing

    const verifier = form.get('code_verifier');
    if (known.challenge) {
      const expected = b64url(createHash('sha256').update(String(verifier || '')).digest());
      if (expected !== known.challenge) {
        return json(res, 400, { error: 'invalid_grant', error_description: 'PKCE verifier does not match' });
      }
    }

    // The consent screen lets a person untick individual services, and the token response
    // reports what they actually approved. `partial` drops every scope after the identity
    // ones plus the first service, which is what unticking looks like from here.
    let scope = known.scope;
    if (SCRIPT === 'partial') {
      const parts = known.scope.split(' ').filter(Boolean);
      scope = parts.filter((s) => !s.startsWith('https://') || s.includes('calendar')).join(' ');
    }

    const body = { access_token: `access_${Date.now()}`, expires_in: 3600, token_type: 'Bearer', scope };
    if (SCRIPT !== 'no_refresh') { body.refresh_token = `refresh_${++issuedRefreshTokens}`; }
    return json(res, 200, body);
  }

  if (url.pathname === '/userinfo') {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, ACCOUNT);
  }

  if (url.pathname === '/revoke') {
    return json(res, 200, {});
  }

  return json(res, 404, { error: 'not_found', path: url.pathname });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake google (${SCRIPT}) on http://127.0.0.1:${PORT}`);
});
