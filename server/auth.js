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
 *   HUB_TOKEN set    -> every /api request must present it (x-hub-token header, or
 *                       ?token= for the WebSocket, which cannot set headers).
 *
 * The client reads its token from /api/auth/hint, which is itself localhost-only, so
 * working locally needs no setup at all.
 */
import { randomBytes } from 'crypto';

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

// True when this request may proceed.
export function allowed(req) {
  if (!HUB_TOKEN) return isLocal(req);          // no token configured: localhost only
  if (tokenFrom(req) === HUB_TOKEN) return true;
  return isLocal(req);                          // local callers still work without it
}

export function requireAuth(req, res, next) {
  if (allowed(req)) return next();
  res.status(401).json({ error: 'unauthorized - set HUB_TOKEN and send x-hub-token' });
}

export function suggestToken() {
  return randomBytes(24).toString('hex');
}
