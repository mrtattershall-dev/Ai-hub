/**
 * terminal.js — a real terminal, over a WebSocket.
 *
 * Not `exec`: this spawns a genuine PTY, so you get interactivity, colours, Ctrl+C,
 * long-running dev servers, and prompts — everything a shell does. xterm.js renders
 * it in the client and the bytes flow both ways untouched.
 *
 * Deliberately lives in the Express server rather than an Electron main process:
 * the terminal then works in the browser today, and keeps working unchanged if the
 * hub is later wrapped in Electron (no native module rebuilt against Electron's ABI).
 *
 * Protocol (JSON frames, client -> server):
 *   { type: 'input',  data: '<keystrokes>' }
 *   { type: 'resize', cols, rows }
 * Server -> client:
 *   { type: 'output', data } | { type: 'exit', code } | { type: 'error', msg }
 *
 * Each WebSocket connection owns exactly one shell, killed when the socket closes,
 * so a reload can't leak orphaned shells.
 */
import { WebSocketServer } from 'ws';
import { allowed } from './auth.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// PowerShell over cmd.exe on Windows: it's what this project's tooling assumes
// (npm scripts, modal, git). Override per-connection with ?shell=, or globally
// with HUB_SHELL (e.g. "C:/Program Files/Git/bin/bash.exe").
const DEFAULT_SHELL = process.env.HUB_SHELL || (process.platform === 'win32'
  ? 'powershell.exe'
  : (process.env.SHELL || 'bash'));

// Sessions the agent can also write into (see attachAgentWriter below).
const sessions = new Map();
let nextId = 1;

export function attachTerminal(httpServer, { cwd } = {}) {
  let pty = null;
  try { pty = require('node-pty'); }
  catch (e) { console.warn('[terminal] node-pty unavailable:', e.message); }

  const wss = new WebSocketServer({ server: httpServer, path: '/api/terminal' });

  wss.on('connection', (ws, req) => {
    // A WebSocket upgrade never passes through Express middleware, so the
    // gate has to be re-applied here. This is the endpoint that hands out a
    // shell; it must not be reachable without the token.
    if (!allowed(req)) {
      ws.send(JSON.stringify({ type: 'error', msg: 'unauthorized' }));
      ws.close();
      return;
    }
    if (!pty) {
      ws.send(JSON.stringify({ type: 'error', msg: 'node-pty is not installed on the server — terminal unavailable.' }));
      ws.close();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const shell = url.searchParams.get('shell') || DEFAULT_SHELL;
    const startDir = url.searchParams.get('cwd') || cwd || process.env.USERPROFILE || process.env.HOME;

    let term;
    try {
      term = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: parseInt(url.searchParams.get('cols') || '80', 10),
        rows: parseInt(url.searchParams.get('rows') || '24', 10),
        cwd: startDir,
        env: process.env,
      });
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', msg: `Could not start shell "${shell}": ${e.message}` }));
      ws.close();
      return;
    }

    const id = nextId++;
    sessions.set(id, term);
    viewers.add(ws);

    term.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'output', data }));
    });
    term.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      sessions.delete(id);
      try { ws.close(); } catch {}
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'input') { try { term.write(msg.data); } catch {} }
      else if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
        try { term.resize(msg.cols, msg.rows); } catch {}
      }
    });

    // One shell per socket: closing the tab or reloading must not leak a shell.
    ws.on('close', () => { sessions.delete(id); viewers.delete(ws); try { term.kill(); } catch {} });
    ws.on('error', () => { sessions.delete(id); viewers.delete(ws); try { term.kill(); } catch {} });

    ws.send(JSON.stringify({ type: 'session', id }));
    ws.send(JSON.stringify({ type: 'output', data: `\x1b[90m[hub terminal] ${shell} in ${startDir}\x1b[0m\r\n` }));
  });

  return wss;
}

// ---------------------------------------------------------------------------
// Agent mirroring.
//
// When the agent runs a command it still executes through exec(), NOT through the
// PTY — the model needs deterministic captured stdout/stderr and an exit code, and
// you cannot reliably parse those back out of a shell's byte stream. But running it
// invisibly is what makes the hub feel like three separate tools, so we ECHO the
// command and its result into every open terminal view. You see what the AI ran, in
// the same window you type in, without compromising what the agent can read back.
// ---------------------------------------------------------------------------
const viewers = new Set();

function paint(text) {
  const frame = JSON.stringify({ type: 'output', data: text });
  for (const ws of viewers) { if (ws.readyState === 1) { try { ws.send(frame); } catch {} } }
}

// Show a command the agent is about to run.
export function mirrorAgentCommand(label, cmd) {
  if (!viewers.size) return false;
  const E = String.fromCharCode(27);            // build ESC explicitly - avoids escape mangling
  const CYAN = E + '[36m', OFF = E + '[0m', NL = '\r\n';
  const body = String(cmd).split(/\r?\n/).join(NL + CYAN + '|' + OFF + ' ');
  paint(NL + CYAN + '+- agent - ' + label + OFF + NL + CYAN + '|' + OFF + ' ' + body + NL);
  return true;
}

// Show what came back. Truncated - the terminal is for watching, not for the record.
export function mirrorAgentResult(text, ok = true) {
  if (!viewers.size) return false;
  const E = String.fromCharCode(27);
  const COL = E + (ok ? '[32m' : '[31m'), OFF = E + '[0m', NL = '\r\n';
  const body = String(text || '(no output)').split(/\r?\n/).slice(0, 20).join(NL + '   ');
  paint(COL + '+-' + OFF + ' ' + body + NL);
  return true;
}

export function viewerCount() { return viewers.size; }

// Write into a SPECIFIC shell. Once terminals gained tabs, "newest" stopped being
// a sane target for "send this to my terminal" - the tab you are looking at is.
// The client learns its id from the {type:'session'} frame sent on connect.
export function writeToSession(id, text) {
  const term = sessions.get(Number(id));
  if (!term) return false;
  try { term.write(text); return true; } catch { return false; }
}

// Fallback only: used when no session id is supplied (single-shell callers).
export function writeToNewestSession(text) {
  const ids = [...sessions.keys()];
  if (!ids.length) return false;
  const term = sessions.get(ids[ids.length - 1]);
  try { term.write(text); return true; } catch { return false; }
}

export function sessionCount() { return sessions.size; }
