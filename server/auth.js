/**
 * auth.js - a shared-secret gate for the whole hub API.
 *
 * WHY: the hub hands out a live PTY (/api/terminal), an agent that writes files and
 * runs commands (/api/agent), and two code-execution verifiers. On localhost that is
 * fine. The moment it is reachable from anywhere else - a tunnel, a LAN, a port
 * forward - an unauthenticated shell is the single most valuable thing a scanner can
 * find. This makes exposure a deliberate choice rather than an accident.
 *
 * BEHAVIOUR
 *   HUB_TOKEN unset  -> localhost-only. Requests from other hosts are refused, so the
 *                       default posture is safe even if someone tunnels it by mistake.
 *   HUB_TOKEN set    -> EVERY /api request must present it (x-hub-token header, or
 *                       ?token= for the WebSocket, which cannot set headers). There is
 *                       no localhost exemption once a token is configured - see below.
 *
 * The client reads its token from /api/auth/hint, which is itself localhost-only, so
 * working locally needs no setup at all.
 */
import { randomBytes, timingSafeEqual } from 'crypto';

export const HUB_TOKEN = process.env.HUB_TOKEN || null;

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

export function isLocal(req) {
  const ip = (req.socket && (req.socket.remoteAddress || '')) || '';
  return LOCAL.has(ip);
}

export function tokenFrom(req) {
  const h = req.headers && (req.headers['x-hub-token'] || req.headers['X-Hub-Token']);
  if (h) return String(h);
  try {
    const u = new URL(req.url, 'http://localhost');
    return u.searchParams.get('token');
  } catch { return null; }
}

/**
 * Constant-time compare, so a wrong token cannot be narrowed down by timing the reply.
 * `a === b` on a secret returns as soon as two bytes differ.
 */
function sameSecret(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length) return false;      // length is not secret; content is
  return timingSafeEqual(a, b);
}

/**
 * True when this request may proceed.
 *
 * NO LOCALHOST EXEMPTION ONCE A TOKEN IS SET.
 *
 * This used to end with `return isLocal(req)` even when HUB_TOKEN was configured, which
 * quietly defeated the entire gate in the one situation it was built for. A tunnel -
 * Cloudflare quick tunnel, ngrok, an SSH forward, any reverse proxy - TERMINATES ON THIS
 * MACHINE and then connects onward to the hub over the loopback interface. So every
 * request arriving through the tunnel has remoteAddress 127.0.0.1 and was treated as a
 * trusted local caller. Anyone with the public URL got the PTY, the agent and the
 * verifiers without ever presenting the token.
 *
 * Setting HUB_TOKEN is a deliberate act that means "this may be reachable from
 * elsewhere", so from that point the token is required from everyone. Local browsers
 * still need no setup: they fetch it from /api/auth/hint, which is itself localhost-only
 * AND is registered before this middleware.
 *
 * X-Forwarded-For is deliberately NOT consulted. It is set by the proxy and can be set
 * by anyone, so trusting it would reintroduce the same hole through a different door.
 */
export function allowed(req) {
  if (!HUB_TOKEN) return isLocal(req);          // no token configured: localhost only
  return sameSecret(tokenFrom(req), HUB_TOKEN);
}

export function requireAuth(req, res, next) {
  if (allowed(req)) return next();
  res.status(401).json({
    error: HUB_TOKEN
      ? 'unauthorized - send the hub token in the x-hub-token header (or ?token= for websockets)'
      : 'unauthorized - this hub only accepts local connections. Set HUB_TOKEN to allow remote access.',
  });
}

export function suggestToken() {
  return randomBytes(24).toString('hex');
}
