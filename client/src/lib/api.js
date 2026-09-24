const BASE = '/api';

// The hub gates /api behind a shared secret whenever HUB_TOKEN is set on the server
// (see server/auth.js). Locally there is nothing to configure: /api/auth/hint is
// localhost-only and tells the client what to send, so the token is picked up once
// at startup and attached to every request and to the terminal WebSocket.
let hubToken = null;
const TOKEN_KEY = 'hub_token';
export function getHubToken() { return hubToken; }

/**
 * Where the token comes from, in order.
 *
 * A REMOTE browser can never use /auth/hint: that route is localhost-only on purpose,
 * and once HUB_TOKEN is set the server no longer exempts loopback callers (a tunnel
 * terminates locally, so "it came from 127.0.0.1" proves nothing). So a tunnelled
 * client needs another way in, or token-gated remote access is simply unusable:
 *
 *   1. ?token=... in the page URL - how you open the hub through a tunnel. It is
 *      stored and then stripped from the address bar so it does not linger in
 *      screenshots, browser history or a shared link.
 *   2. whatever was stored last, so a reload does not need the query string again.
 *   3. /auth/hint - the zero-setup path when you are sitting at the machine.
 */
export async function loadHubToken() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('token');
    if (fromUrl) {
      hubToken = fromUrl;
      try { localStorage.setItem(TOKEN_KEY, fromUrl); } catch {}
      try { history.replaceState(null, '', location.pathname + location.hash); } catch {}
      return hubToken;
    }
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) { hubToken = saved; return hubToken; }
  } catch { /* no URL/localStorage in this context - fall through to the hint */ }

  try {
    const res = await fetch(BASE + '/auth/hint');
    if (res.ok) hubToken = (await res.json()).token || null;
  } catch { hubToken = null; }
  return hubToken;
}

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (hubToken) headers['x-hub-token'] = hubToken;
  const res = await fetch(BASE + path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Carry the status and body onto the Error. Callers need to tell "this failed" from
    // "this was refused for a specific reason I can act on" - e.g. 409 busy, where the
    // right response is to offer the queue rather than show a dead end.
    const e = new Error(err.error || 'Request failed');
    e.status = res.status;
    e.body = err;
    throw e;
  }
  return res.json();
}

// Keys
export const getKeys      = ()              => req('/keys');
export const saveKey      = (body)          => req('/keys', { method: 'POST', body: JSON.stringify(body) });
export const deleteKey    = (provider)      => req(`/keys/${provider}`, { method: 'DELETE' });

// Chat (non-streaming)
export const chat         = (body)          => req('/chat', { method: 'POST', body: JSON.stringify(body) });

// Game: run the code in real headless Chromium and report whether it actually works.
export const verifyGame   = (body)          => req('/game/verify', { method: 'POST', body: JSON.stringify(body) });

// Godot: parse-check / run GDScript in the real engine, headless.
// Terminal: push text into the live shell (used by "To Terminal").
export const sendToTerminalApi = (body) => req('/terminal/send', { method: 'POST', body: JSON.stringify(body) });

export const godotStatus  = ()              => req('/godot/status');
export const verifyGodot  = (body)          => req('/godot/verify', { method: 'POST', body: JSON.stringify(body) });

// Streaming chat. Pass an AbortSignal as the 5th arg to allow a Stop button.
export async function chatStream(body, onDelta, onDone, onError, signal) {
  try {
    const res = await fetch(BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(hubToken ? { 'x-hub-token': hubToken } : {}) },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      onError(err.error || 'Stream failed');
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.delta) onDelta(parsed.delta);
          if (parsed.done)  { onDone(parsed.tokens); return; }
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    onError(err.message);
  }
}

// Agent
// `governed` = { checks: { requested: { script, files? }, protected: { script, files? } } } opts a run
// into behavioral acceptance: verified start, evaluation in the isolated worker, rollback if
// protected behaviour breaks. Omitted = an ordinary run, labelled as unprotected by the server.
export const agentStart   = (goal, queueIfBusy = false, governed = null) => req('/agent/start', { method: 'POST', body: JSON.stringify({ goal, queueIfBusy, ...(governed ? { governed } : {}) }) });
export const agentGet     = (id)          => req(`/agent/${id}`);
export const agentApprove = (id, approve) => req(`/agent/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve }) });
export const agentStop    = (id)          => req(`/agent/${id}/stop`, { method: 'POST' });
export const agentResume  = (id)          => req(`/agent/${id}/resume`, { method: 'POST' });
export const agentFollowup = (id, goal)   => req(`/agent/${id}/followup`, { method: 'POST', body: JSON.stringify({ goal }) });
export const agentList     = ()            => req('/agent/list');
export const agentFiles   = ()            => req('/agent/files');
export const agentUpload  = (path, content) => req('/agent/upload', { method: 'POST', body: JSON.stringify({ path, content }) });
export const agentUploadZip = (dataB64)     => req('/agent/upload-zip', { method: 'POST', body: JSON.stringify({ dataB64 }) });
export const agentDeleteFile = (path)     => req('/agent/files?path=' + encodeURIComponent(path), { method: 'DELETE' });
export const agentReset       = ()          => req('/agent/reset', { method: 'POST' });
export const AGENT_EXPORT_URL = BASE + '/agent/export/zip';

// Work queue — the backlog the supervisor pulls from when a run finishes cleanly.
// These four routes shipped on the server with no client binding at all, so the queue
// existed and was unreachable from the hub. GET also returns the current approval mode
// (strict / build / yolo), which is worth surfacing: it decides what runs unattended.
export const queueList    = ()                   => req('/agent/queue');
export const queueAdd     = (goal, priority = 0, force = false) => req('/agent/queue', { method: 'POST', body: JSON.stringify({ goal, priority, force }) });
export const queueRemove  = (id)                 => req(`/agent/queue/${id}`, { method: 'DELETE' });
export const queueRunNext = ()                   => req('/agent/queue/run', { method: 'POST' });
// Queue an ordered chain - each goal runs only after the previous one finished. Resolves
// to { queued, skipped, ... }: a chain can be partly accepted, so callers must read
// `skipped` rather than assume every goal landed.
export const queueChain   = (goals, priority = 0, force = false) => req('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals, priority, force }) });

// Asset library. Files themselves are served at /assets/<name> (outside /api, so game code
// and <img> tags load them without a token - the same path the agent writes into games).
export const assetsList    = ()      => req('/assets');
export const assetsAdd     = (files) => req('/assets/batch', { method: 'POST', body: JSON.stringify({ files }) });
export const assetsRemove  = (id)    => req(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const assetsReindex = ()      => req('/assets/reindex', { method: 'POST' });
export const ASSET_URL     = (name)  => `/assets/${encodeURIComponent(name)}`;
// The canonical vocabulary: names guaranteed to resolve (placeholders until real art lands).
export const assetsCanonical = (force = false) => req('/assets/canonical', { method: 'POST', body: JSON.stringify({ force }) });

// Unattended operation. Persisted server-side, so it survives a restart and does not
// depend on remembering an environment variable at launch.
export const supervisorGet = ()   => req('/agent/supervisor');
export const supervisorSet = (on) => req('/agent/supervisor', { method: 'POST', body: JSON.stringify({ on }) });

// Google account. `status` is the only shape the client ever sees: the signed-in identity,
// which services were actually granted, and how long the access token has left. Never the
// tokens themselves and never the client secret - see server/googleAuth.js.
export const googleStatus      = ()        => req('/google/status');
export const googleSaveConfig  = (body)    => req('/google/config', { method: 'POST', body: JSON.stringify(body) });
export const googleSetServices = (enabled) => req('/google/services', { method: 'POST', body: JSON.stringify({ enabled }) });
export const googleAuthorize   = (enabled) => req('/google/authorize', { method: 'POST', body: JSON.stringify({ enabled }) });
export const googleDisconnect  = ()        => req('/google/disconnect', { method: 'POST' });
export const googleProbe       = ()        => req('/google/probe', { method: 'POST' });

// History
export const getHistory        = (params = {}) => req('/history?' + new URLSearchParams(params));
export const getHistoryItem    = (id)           => req(`/history/${id}`);
export const deleteHistoryItem = (id)           => req(`/history/${id}`, { method: 'DELETE' });
export const clearHistory      = ()             => req('/history', { method: 'DELETE' });

// Settings
export const getSettings  = ()             => req('/settings');
export const saveSettings = (body)         => req('/settings', { method: 'POST', body: JSON.stringify(body) });

// Providers
export const getProviders = ()             => req('/providers');
