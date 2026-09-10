import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync, renameSync, copyFileSync } from 'fs';
import fetch from 'node-fetch';
import agentRouter, { WORKSPACE } from './agent.js';
import gameVerifyRouter from './gameVerify.js';
import godotVerifyRouter from './godotVerify.js';
import assetsRouter from './assetsRouter.js';
import { ASSETS_DIR, mimeFor } from './assets.js';
import { attachTerminal, sessionCount, viewerCount, writeToNewestSession, writeToSession } from './terminal.js';
import { requireAuth, allowed, isLocal, HUB_TOKEN } from './auth.js';
import { googleRouter, googleCallbackRouter } from './googleAuth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Gate everything under /api. Mounted before any route so nothing slips past.
// Health stays open so a tunnel/uptime check can probe without the token.
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now(), auth: HUB_TOKEN ? 'token' : 'localhost-only' }));

// Localhost-only: lets the local client discover the token automatically, so
// running the hub on your own machine needs no configuration at all.
app.get('/api/auth/hint', (req, res) => {
  if (!isLocal(req)) return res.status(404).end();
  res.json({ token: HUB_TOKEN });
});

app.use('/api', requireAuth);

// ── JSON file database ────────────────────────────────────────────────────────
const DB_PATH = join(__dirname, 'hub.json');

function loadDb() {
  if (!existsSync(DB_PATH)) return { api_keys: {}, history: [], settings: {} };
  try { return JSON.parse(readFileSync(DB_PATH, 'utf8')); } catch { return { api_keys: {}, history: [], settings: {} }; }
}

// Atomic save: write a sibling temp file, fsync it, then rename over the target.
// rename() is atomic on the same volume, so a crash mid-save leaves either the old
// file or the new one - never a truncated one. hub.json holds your API keys AND all
// conversation history; a plain writeFileSync that dies halfway loses both.
//
// A .bak of the last good file is kept as a second line of defence.
// Serialise read-modify-write. saveDb() is atomic, but every handler does
// loadDb() -> mutate -> saveDb(); two overlapping requests both read the old file and
// the second write silently discards the first's change. More likely now that the same
// view can be open in several panes at once. Node is single-threaded, so chaining on a
// promise is enough to make each cycle exclusive.
let dbChain = Promise.resolve();
export function withDb(fn) {
  const next = dbChain.then(() => fn());
  dbChain = next.catch(() => {});     // one failure must not wedge the queue
  return next;
}

function saveDb(db) {
  const tmp = DB_PATH + '.tmp';
  const bak = DB_PATH + '.bak';
  const json = JSON.stringify(db, null, 2);
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, json, 0, 'utf8');
    fsyncSync(fd);                 // force to disk before we swap it in
  } finally {
    closeSync(fd);
  }
  try { if (existsSync(DB_PATH)) copyFileSync(DB_PATH, bak); } catch {}
  renameSync(tmp, DB_PATH);
}

// ── Provider config ───────────────────────────────────────────────────────────
const PROVIDER_DEFAULTS = {
  claude:    { base_url: 'https://api.anthropic.com',   model: 'claude-sonnet-4-6', type: 'anthropic', name: 'Claude' },
  openai:    { base_url: 'https://api.openai.com',      model: 'gpt-4o',            type: 'openai',    name: 'OpenAI' },
  deepseek:  { base_url: 'https://api.deepseek.com',    model: 'deepseek-coder',    type: 'openai',    name: 'DeepSeek' },
  kimi:      { base_url: 'https://api.moonshot.cn',     model: 'moonshot-v1-8k',    type: 'openai',    name: 'Kimi (Moonshot)' },
  mistral:   { base_url: 'https://api.mistral.ai',      model: 'codestral-latest',  type: 'openai',    name: 'Mistral' },
  groq:      { base_url: 'https://api.groq.com/openai', model: 'llama3-70b-8192',   type: 'openai',    name: 'Groq' },
  perplexity:{ base_url: 'https://api.perplexity.ai',   model: 'sonar-pro',         type: 'perplexity',name: 'Perplexity' },
  // Gemini exposes an OpenAI-COMPATIBLE surface, so it needs no new request/response
  // code — only a base_url that already carries its version path (like perplexity's).
  // The free tier is what makes this worth having: a frontier-class model at no cost,
  // which is a better agent brain than a 14B fine-tune that scores 9/18.
  google:    { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
               model: 'gemini-3.6-flash', type: 'google', name: 'Google Gemini' },
  // OpenRouter fronts ~430 models behind one OpenAI-compatible API, 18 of them free.
  // base_url stops at /api so the shared openai path appends /v1/chat/completions.
  // Default chosen by SUSTAINED SUCCESS RATE, not peak latency - measured 2026-09-09
  // with six back-to-back calls per model:
  //
  //   nex-n2.5-pro:free              6/6   4,097ms   <- default
  //   nemotron-3-super-120b:free     4/6   2,186ms
  //   gemma-4-26b-a4b:free           0/6     446ms   <- fastest single call, then dies
  //
  // Gemma won the one-shot benchmark at 2.3s and then failed every call under load: its
  // 429 says limit_source=upstream_provider_shared_pool, provider=Google AI Studio. An
  // agent makes hundreds of sequential calls, so a model that is fast once and absent
  // afterwards is worthless. Reliability is the metric; speed is the tiebreak.
  openrouter:{ base_url: 'https://openrouter.ai/api',
               model: 'nex-agi/nex-n2.5-pro:free', type: 'openai', name: 'OpenRouter' },
  // Hugging Face Inference Providers - OpenAI-compatible, and routed to PARTNER pools
  // (Together, Fireworks, Novita, Cerebras...) rather than Google's, so a Google-pool
  // rate-limit does not take it down too. base_url stops before /v1.
  //
  // The free tier's shape decides the default model:
  //   ~300 requests/hour        THE binding constraint for a text agent
  //   models under ~10B only    <- a 32B would simply be refused
  //   cold starts               an unused model must load first; surfaces as a timeout
  //   ~$0.10/month of credit    applies to HEAVY models (image generation, large ones).
  //                             A 7B chat model is not what burns that pool.
  //
  // 300 requests/hour is one call every 12 seconds. A normal build is 20-100 steps, so
  // that fits comfortably. Sustained autonomous operation does not: the scripted
  // marathon on 2026-09-09 made 4,149 calls in ~25 minutes, which would exhaust an
  // hour's allowance in about ninety seconds.
  //
  // So a 7B coder, not a 32B. Cold-start timeouts are already classed as transient and
  // retried with backoff before the run pauses.
  huggingface:{ base_url: 'https://router.huggingface.co',
               model: 'Qwen/Qwen2.5-Coder-7B-Instruct', type: 'openai', name: 'Hugging Face' },
  ollama:    { base_url: 'http://localhost:11434',       model: 'phi3',              type: 'ollama',    name: 'Ollama (local)' },
};

// ── API Keys routes ───────────────────────────────────────────────────────────
app.get('/api/keys', (req, res) => {
  const db = loadDb();
  const connected = {};
  for (const [provider, row] of Object.entries(db.api_keys)) {
    connected[provider] = { model: row.model, base_url: row.base_url, updated_at: row.updated_at };
  }
  res.json(connected);
});

app.post('/api/keys', (req, res) => withDb(async () => {
  const { provider, key_value, model, base_url } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  if (!PROVIDER_DEFAULTS[provider]) return res.status(400).json({ error: `Unknown provider: ${provider}` });
  const defaults = PROVIDER_DEFAULTS[provider];
  const db = loadDb();
  const existing = db.api_keys[provider];
  const finalKey = (key_value && key_value.trim()) ? key_value.trim() : existing?.key_value;
  if (!finalKey) return res.status(400).json({ error: 'key_value required' });
  db.api_keys[provider] = {
    key_value: finalKey,
    model: model || existing?.model || defaults.model,
    base_url: base_url || existing?.base_url || defaults.base_url,
    updated_at: Math.floor(Date.now() / 1000),
  };
  saveDb(db);
  res.json({ ok: true });
}));

app.delete('/api/keys/:provider', (req, res) => withDb(async () => {
  const db = loadDb();
  delete db.api_keys[req.params.provider];
  saveDb(db);
  res.json({ ok: true });
}));

// ── Chat / completion route ───────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider, prompt, messages, temperature = 0.3, tab = 'code', task = 'explain', stream = false } = req.body;
  const hasMsgs = Array.isArray(messages) && messages.length > 0;
  if (!provider || (!prompt && !hasMsgs)) return res.status(400).json({ error: 'provider and prompt (or messages) required' });
  if (!PROVIDER_DEFAULTS[provider]) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  const db = loadDb();
  const keyRow = db.api_keys[provider];
  const defaults = PROVIDER_DEFAULTS[provider];

  if (!keyRow && provider !== 'ollama') {
    return res.status(401).json({ error: `No API key configured for ${defaults.name || provider}. Add it in Settings.` });
  }

  const apiKey   = keyRow?.key_value || 'ollama';
  const model    = keyRow?.model     || defaults.model;
  const base_url = (keyRow?.base_url || defaults.base_url).replace(/\/+$/, '');
  const type     = defaults.type     || 'openai';

  // The conversation the model actually sees: the client's multi-turn `messages`
  // (system + prior turns + latest), or a single-shot prompt wrapped as one turn.
  const convo = hasMsgs ? messages : [{ role: 'user', content: prompt }];
  const logPrompt = prompt || [...convo].reverse().find(m => m.role === 'user')?.content || '';

  const startTime = Date.now();
  let responseText = '';
  let tokensUsed = 0;

  const saveHistory = () => {
    const db2 = loadDb();
    db2.history.unshift({
      id: randomUUID(),
      tab, task, provider, model,
      prompt: logPrompt.slice(0, 4000),
      response: responseText.slice(0, 16000),
      tokens_used: tokensUsed,
      duration_ms: Date.now() - startTime,
      created_at: Math.floor(Date.now() / 1000),
    });
    // Keep only last 500 entries
    if (db2.history.length > 500) db2.history = db2.history.slice(0, 500);
    saveDb(db2);
  };

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const { url, headers, body } = buildRequest(type, base_url, apiKey, model, convo, temperature, true);
      let upstream;
      try {
        upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (fetchErr) {
        res.write(`data: ${JSON.stringify({ error: `Could not reach ${base_url}: ${fetchErr.message}` })}\n\n`);
        return res.end();
      }

      if (!upstream.ok) {
        const err = await upstream.text();
        let msg = err;
        try { msg = JSON.parse(err).error?.message || err; } catch {}
        res.write(`data: ${JSON.stringify({ error: msg.slice(0, 500) })}\n\n`);
        return res.end();
      }

      // Buffer across chunks: a single JSON line can be split at a network
      // chunk boundary (common over a tunnel). Only parse complete lines and
      // carry the incomplete remainder forward, so no tokens get dropped.
      let streamBuf = '';
      const handleLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line) return;
        // Ollama sends raw NDJSON; other providers send "data: <json>"
        let data = line;
        if (line.startsWith('data:')) data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          // Ollama: { response: "...", done: false }
          // Anthropic: { delta: { text: "..." } }
          // OpenAI: { choices: [{ delta: { content: "..." } }] }
          const delta = extractDelta(type, parsed);
          if (delta) { responseText += delta; res.write(`data: ${JSON.stringify({ delta })}\n\n`); }
          // Ollama signals end with done:true
          if (type === 'ollama' && parsed.done) {
            tokensUsed = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0) || estimateTokens(logPrompt) + estimateTokens(responseText);
          }
          const usage = parsed.usage;
          if (usage) tokensUsed = usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0) || tokensUsed;
        } catch {}
      };
      for await (const chunk of upstream.body) {
        streamBuf += chunk.toString();
        const lines = streamBuf.split('\n');
        streamBuf = lines.pop(); // keep the (possibly incomplete) last line
        for (const line of lines) handleLine(line);
      }
      if (streamBuf) handleLine(streamBuf); // flush any final complete line

      if (!tokensUsed) tokensUsed = estimateTokens(logPrompt) + estimateTokens(responseText);
      saveHistory();
      res.write(`data: ${JSON.stringify({ done: true, tokens: tokensUsed })}\n\n`);
      res.end();
    } else {
      const { url, headers, body } = buildRequest(type, base_url, apiKey, model, convo, temperature, false);
      let upstream;
      try {
        upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (fetchErr) {
        return res.status(502).json({ error: `Could not reach ${base_url}: ${fetchErr.message}` });
      }
      // Read as text first — a flaky tunnel can return an HTML error/timeout
      // page instead of JSON, and a blind .json() would throw "Unexpected token '<'".
      const raw = await upstream.text();
      let data;
      try { data = JSON.parse(raw); }
      catch {
        const looksHtml = /<!doctype|<html|cloudflare/i.test(raw);
        const msg = looksHtml
          ? 'Model tunnel returned an error page (often a Cloudflare timeout on a slow reply). Retry, or lower max_new_tokens on the Kaggle server.'
          : `Model endpoint returned non-JSON (HTTP ${upstream.status}).`;
        return res.status(502).json({ error: msg });
      }
      if (!upstream.ok) return res.status(upstream.status).json({ error: data.error?.message || data.error || 'Provider error' });

      responseText = extractContent(type, data);
      const usage = data.usage;
      tokensUsed = usage?.total_tokens || (usage ? (usage.input_tokens || 0) + (usage.output_tokens || 0) : 0) || estimateTokens(logPrompt) + estimateTokens(responseText);
      saveHistory();
      res.json({ response: responseText, model, tokens: tokensUsed });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch {}
    }
  }
});

// ── History routes ────────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  const { tab, provider, limit = 50, offset = 0 } = req.query;
  const db = loadDb();
  let rows = db.history;
  if (tab && tab !== 'all') rows = rows.filter(r => r.tab === tab);
  if (provider && provider !== 'all') rows = rows.filter(r => r.provider === provider);
  const total = rows.length;
  rows = rows.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ rows, total });
});

app.get('/api/history/:id', (req, res) => {
  const db = loadDb();
  const row = db.history.find(r => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.delete('/api/history/:id', (req, res) => withDb(async () => {
  const db = loadDb();
  db.history = db.history.filter(r => r.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
}));

app.delete('/api/history', (req, res) => withDb(async () => {
  const db = loadDb();
  db.history = [];
  saveDb(db);
  res.json({ ok: true });
}));

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const db = loadDb();
  res.json(db.settings || {});
});

app.post('/api/settings', (req, res) => withDb(async () => {
  const db = loadDb();
  db.settings = db.settings || {};
  for (const [k, v] of Object.entries(req.body)) db.settings[k] = String(v);
  saveDb(db);
  res.json({ ok: true });
}));

// ── Provider info ─────────────────────────────────────────────────────────────
app.get('/api/providers', (req, res) => res.json(PROVIDER_DEFAULTS));

// ── Health check ──────────────────────────────────────────────────────────────


// ── Autonomous agent routes ───────────────────────────────────────────────────
app.use('/api/agent', agentRouter({ loadDb, saveDb, withDb }));
app.use('/api/game', gameVerifyRouter());
app.use('/api/godot', godotVerifyRouter());
app.use('/api/assets', assetsRouter());

// ── Google account ────────────────────────────────────────────────────────────
// The redirect target must match a URI registered on the OAuth client character for
// character, so it is derived from PORT in one place and reported by /api/google/status
// for pasting into the Cloud console rather than being written down twice.
const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/oauth/google/callback`;
const APP_URL = process.env.HUB_APP_URL || 'http://localhost:5173';
app.use('/api/google', googleRouter({ loadDb, saveDb, withDb, redirectUri: GOOGLE_REDIRECT }));
// Outside the /api gate on purpose: Google's redirect is a plain browser navigation with
// no hub token. It is protected by the single-use `state` this server issued instead.
app.use('/oauth/google', googleCallbackRouter({ loadDb, saveDb, withDb, redirectUri: GOOGLE_REDIRECT, appUrl: APP_URL }));
app.get('/api/terminal/status', (_req, res) => res.json({ sessions: sessionCount(), viewers: viewerCount() }));
// Push text into a shell - powers "Send to Terminal" from other tabs. Targets the
// session the client says is active; falls back to the newest only if none given.
app.post('/api/terminal/send', (req, res) => {
  const { text = '', newline = true, sessionId = null } = req.body || {};
  // An empty body with newline:true is a bare Enter - a legitimate request, used by
  // the terminal's Enter button. Only reject when there is nothing to send at all.
  if (!text && !newline) return res.status(400).json({ error: 'no text' });
  const CR = String.fromCharCode(13);
  const body = newline ? String(text).replace(/[\r\n]+$/, '') + CR : String(text);
  const ok = sessionId != null ? writeToSession(sessionId, body) : writeToNewestSession(body);
  if (!ok) return res.status(409).json({ error: 'no open terminal - open the Terminal tab first' });
  res.json({ ok: true, sessionId });
});

// Serve whatever the agent builds so web apps open at http://localhost:3001/workspace/
app.use('/workspace', express.static(WORKSPACE));

// A game opened from /workspace/index.html resolves `assets/hero.png` to
// /workspace/assets/hero.png - NOT /assets/hero.png. Found 2026-09-09 by the first
// agent-level test: the agent looked the sprite up correctly, wrote the exact path, the
// verifier would have served it, and the hub's own test_web returned 404. So the library
// is ALSO mounted under the workspace path. Registered after the workspace static, so a
// project's own assets/ folder still wins and the library is the fallback.
app.use('/workspace/assets', express.static(ASSETS_DIR, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', mimeFor(path));
  },
}));

// The asset library, at the SAME path game code references (`assets/hero.png`). A game
// built in the workspace therefore works unmodified both here and in the verifiers.
//
// nosniff + an explicit Content-Type are load-bearing, not boilerplate: these are
// user-uploaded files served from the hub's own origin, so a file whose type the browser
// guessed wrong is a way to get script to run as the hub. assets.js also refuses to store
// .svg/.html/.js at all, which is the other half of that defence.
app.use('/assets', express.static(ASSETS_DIR, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', mimeFor(path));
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function estimateTokens(text = '') { return Math.ceil(text.length / 4); }

function buildRequest(type, base_url, apiKey, model, convo, temperature, stream) {
  // Providers handle the system role differently, so split it out of the convo.
  let system = '';
  const msgs = [];
  for (const m of convo) {
    if (m.role === 'system') system += (system ? '\n\n' : '') + m.content;
    else msgs.push({ role: m.role, content: m.content });
  }

  if (type === 'anthropic') return {
    url: `${base_url}/v1/messages`,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    // Anthropic takes system as a top-level field, not a message.
    body: { model, max_tokens: 4096, temperature, stream, ...(system ? { system } : {}), messages: msgs }
  };
  if (type === 'ollama') {
    // /api/generate takes a single prompt string — flatten the conversation with
    // role markers and end on the Assistant turn for the model to continue.
    const flat = (system ? system + '\n\n' : '')
      + msgs.map(m => `### ${m.role === 'assistant' ? 'Assistant' : 'User'}:\n${m.content}`).join('\n\n')
      + '\n\n### Assistant:\n';
    return {
      url: `${base_url}/api/generate`,
      headers: { 'Content-Type': 'application/json' },
      body: { model, prompt: flat, stream, options: { temperature, num_ctx: 32768, num_predict: -1 } }
    };
  }
  // OpenAI-compatible (incl. perplexity): system is a normal leading message.
  const full = system ? [{ role: 'system', content: system }, ...msgs] : msgs;
  // perplexity and google both publish a base_url that already includes the version
  // segment, so appending /v1 would produce .../v1beta/openai/v1/chat/completions.
  const versioned = type === 'perplexity' || type === 'google';
  const url = versioned ? `${base_url}/chat/completions` : `${base_url}/v1/chat/completions`;
  return {
    url,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: { model, temperature, stream, messages: full }
  };
}

function extractDelta(type, parsed) {
  if (type === 'anthropic') return parsed.delta?.text || '';
  if (type === 'ollama')    return parsed.response || '';
  return parsed.choices?.[0]?.delta?.content || '';
}

function extractContent(type, data) {
  if (type === 'anthropic') return data.content?.map(c => c.text || '').join('') || '';
  if (type === 'ollama')    return data.response || '';
  return data.choices?.[0]?.message?.content || '';
}

// Keep the http.Server so the terminal's WebSocket can share the same port.
const server = app.listen(PORT, () => console.log(`AI Hub server running on http://localhost:${PORT}`));
attachTerminal(server, { cwd: process.env.HUB_TERMINAL_CWD || WORKSPACE });
