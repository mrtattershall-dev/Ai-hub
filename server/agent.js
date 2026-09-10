// ── Autonomous coding agent ───────────────────────────────────────────────────
// A simple, transparent ReAct-style loop: the model emits ONE JSON action per
// step, the server executes it against a sandboxed workspace, feeds the result
// back, and repeats until the goal is met or a step limit is hit.
//
// Safety model (v1): file/list operations run automatically; run_command pauses
// and waits for explicit human approval. Everything is confined to WORKSPACE.

import express from 'express';
import { launchOptions } from './browser.js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, relative, sep } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync, rmSync, appendFileSync, renameSync } from 'fs';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
import { mirrorAgentCommand, mirrorAgentResult } from './terminal.js';
import { ensureRepo, commitAll, diff as gitDiff, log as gitLog, undo as gitUndo, isDirty } from './workspaceGit.js';
import { classifyCommand, classifyPython, describeMode, MODE as APPROVAL_MODE } from './approvalPolicy.js';
import * as ledger from './taskLedger.js';
import * as visual from './visualCheck.js';
import * as verifier from './verifyProject.js';
import { escalate, estimateTokens, tokenBudgetExceeded } from './escalate.js';
import * as workQueue from './queue.js';
import * as assetLib from './assets.js';
import { canonicalSummary } from './canonicalAssets.mjs';
import { googleTools, parseGoogleArgs, GOOGLE_TOOLS, GOOGLE_READ_TOOLS, GOOGLE_WRITE_TOOLS, GOOGLE_TOOL_DOCS } from './googleTools.js';

/**
 * The database handle the Google tools use, filled in by agentRouter.
 *
 * The tools themselves are registered at module load (below), NOT inside the router. They
 * were registered in the router at first, which meant `tools.gmail_search` did not exist
 * until an HTTP router had been constructed - so the only way to check the wiring was to
 * construct one, and constructing one runs requeueOrphans() against the shared work queue.
 * A test should not have to disturb live state to ask "is this tool registered?".
 */
const googleDb = { loadDb: () => ({}), saveDb: () => {}, withDb: (fn) => fn() };

// True once an account is connected. Reads through googleDb, so connecting an account
// takes effect without a restart, and returns false until the router binds a real db.
const googleReady = () => {
  try { return !!googleDb.loadDb().google?.tokens?.refresh_token; } catch { return false; }
};

/**
 * Exposed so a test can assert the read/write split for real, rather than trusting the
 * comment next to it. AUTO_TOOLS is the difference between "the agent read your calendar"
 * and "the agent mailed your contacts at 3am"; it deserves an assertion.
 */
export const __toolPolicyTest = {
  autoTools: () => new Set(AUTO_TOOLS),
  writeReason: (tool, args) => googleWriteReason(tool, args),
  // The lookup the run loop actually does (`tools[tool]`), so a test can ask whether a tool
  // the model might emit is callable - without constructing a router, which would run
  // requeueOrphans() against the live work queue.
  hasTool: (name) => typeof tools[name] === 'function',
};

/** What an approval prompt for a Google write should say, in terms of the real effect. */
function googleWriteReason(tool, args = {}) {
  if (tool === 'gmail_send') return `sends mail AS YOU to ${args.to || '(no recipient given)'} — subject "${(args.subject || '').slice(0, 60)}"`;
  if (tool === 'drive_upload') return `uploads ${args.path || '(no file)'} from the workspace to your Google Drive`;
  if (tool === 'calendar_add') return `creates "${(args.title || '(untitled)').slice(0, 60)}" in your calendar at ${args.start || '(no time)'}`;
  return `${tool} changes your Google account`;
}

export const WORKSPACE = join(__dirname, '..', 'workspace');
const PORT = process.env.PORT || 3001;

// A step COUNT was the right guard when a bad edit was permanent: 30 steps kept a
// supervised demo from running away. Now that every destructive step auto-commits, a
// long run is recoverable, and 30 is just a wall - a real build (read the code, install
// deps, write ten files, run tests, fix them) spends that on setup.
//
// So: budgets instead of a step count. Wall-clock and model-calls, both configurable,
// whichever trips first. The sliding-window loop guard still catches genuine spinning,
// which is what the step cap was really standing in for.
const MAX_STEPS = parseInt(process.env.AGENT_MAX_STEPS || '250', 10);
const MAX_MINUTES = parseInt(process.env.AGENT_MAX_MINUTES || '90', 10);

// The clock runs from budgetStart, NOT createdAt. A follow-up on a run that started
// two hours ago must get a fresh 90 minutes - otherwise the first follow-up to a
// long-lived run dies on arrival, having spent its whole time budget before it began.
function budgetExhausted(run) {
  if (run.modelCalls >= (run.maxSteps || MAX_STEPS)) return `step budget (${run.maxSteps || MAX_STEPS} model calls)`;
  const mins = (Date.now() - (run.budgetStart || run.createdAt)) / 60000;
  if (mins >= MAX_MINUTES) return `time budget (${MAX_MINUTES} min)`;
  // Steps and minutes both miss the case that actually costs money: a run making
  // few but enormous calls. Off unless AGENT_MAX_TOKENS is set.
  const tok = tokenBudgetExceeded(run);
  if (tok) return tok;
  return null;
}
const CMD_TIMEOUT_MS = 60_000;   // per shell command
// Qwen2.5 supports 32k natively. On a Kaggle/Colab T4 (16GB), 24k is the practical
// cap for a 14B: KV cache ~4.5GB + ~9GB model + buffers ≈ 14.5GB (fits, tight). Enable
// OLLAMA_KV_CACHE_TYPE=q8_0 server-side to halve the KV and run it comfortably. Drop
// NUM_CTX to 8192 if you OOM; a 7B has room to spare either way.
const NUM_CTX = parseInt(process.env.NUM_CTX, 10) || 24_576;
const NUM_PREDICT = parseInt(process.env.NUM_PREDICT, 10) || -1; // -1 = generate until done; never truncate a long file mid-write
const TEMPERATURE = 0.2;
const MAX_HISTORY_MSGS = 16;     // keep recent context dense; older tool dumps are pruned

// ── Workspace sandbox helpers ────────────────────────────────────────────────
function ensureWorkspace() {
  if (!existsSync(WORKSPACE)) mkdirSync(WORKSPACE, { recursive: true });
}

// Resolve a user/model-supplied path and refuse anything outside WORKSPACE.
// Confine a model-supplied path to WORKSPACE.
//
// The previous check used path.relative() and rejected results starting with '..'.
// That blocks relative traversal but NOT a drive-absolute path: relative(C:\ws, 'D:\x')
// returns 'D:\x', which has no '..' and slipped through. Same for UNC shares
// (\server\share). Since write_file/edit_file are auto-approved, that let a model
// write outside the sandbox unattended. Verified: 'D:/anything.txt' and
// '//server/share/x.txt' were both ALLOWED before this fix.
//
// Now the resolved path must literally sit under WORKSPACE (case-insensitive on
// Windows, where C:\ and c:\ are the same directory).
function safePath(p) {
  const full = resolve(WORKSPACE, p || '.');
  const base = resolve(WORKSPACE);
  const norm = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  const okRoot = norm(full) === norm(base) || norm(full).startsWith(norm(base + sep));
  if (!okRoot) throw new Error(`Path escapes workspace: ${p}`);
  return full;
}

// At/above this size, a blind read_file (no LINES) returns a MAP instead of the
// contents — forcing the model to navigate by range like a human reads code.
const BIG_FILE_LINES = 250;

// Compact map of a file: every function/class/top-level declaration + its line.
// Shared by outline_file and read_file's big-file redirect. Handles JS and Python.
function buildOutline(lines) {
  const pats = [
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
    /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|\{|\[)/,
    /^\s*([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?function/,
    /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,        // python def
    /^\s*class\s+([A-Za-z_]\w*)\s*[:(]/,                 // python class
  ];
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    for (const re of pats) {
      if (re.test(lines[i])) { out.push(`${i + 1}: ${lines[i].trim().slice(0, 90)}`); break; }
    }
  }
  return out;
}

// ── Tools ────────────────────────────────────────────────────────────────────
const tools = {
  list_dir({ path = '.' }) {
    const full = safePath(path);
    if (!existsSync(full)) return `(empty — ${path} does not exist yet)`;
    const walk = (dir, prefix = '') => {
      let out = '';
      for (const name of readdirSync(dir).sort()) {
        if (name === 'node_modules' || name === '.git') continue;
        const fp = join(dir, name);
        const isDir = statSync(fp).isDirectory();
        out += `${prefix}${name}${isDir ? '/' : ''}\n`;
        if (isDir) out += walk(fp, prefix + '  ');
      }
      return out;
    };
    return walk(full).trim() || '(empty)';
  },

  // Read a file. Shows line numbers (for navigation/search follow-up) and, on a
  // big file, only a window — so a 10k-line file never blows the model's context.
  read_file({ path, offset, limit }) {
    const full = safePath(path);
    if (!existsSync(full)) return `ERROR: file not found: ${path}`;
    const all = readFileSync(full, 'utf8').split('\n');
    const total = all.length;

    // Blind read of a BIG file → don't slurp. Hand back the MAP + the first lines,
    // and make the model pick a range or search. This is how you read code: orient
    // from the structure, then zoom into the one part you need.
    if (offset == null && limit == null && total > BIG_FILE_LINES) {
      const map = buildOutline(all);
      const head = all.slice(0, 30).map((l, i) => `${i + 1}: ${l}`).join('\n');
      return [
        `[${path} — ${total} lines. Too big to read whole; here is its MAP and the first 30 lines.]`,
        `MAP (declaration → line):`,
        map.length ? map.join('\n') : '(no declarations detected — use search_file to find what you need)',
        ``,
        `FIRST 30 LINES:`,
        head,
        ``,
        `➜ Now read ONLY what you need: read_file PATH with LINES <start>-<end> for a section, or search_file to jump to a symbol. Do NOT ask for the whole file.`,
      ].join('\n').slice(0, 14_000);
    }

    const start = offset != null ? Math.max(0, (parseInt(offset, 10) || 1) - 1) : 0;
    const count = limit != null ? Math.max(1, parseInt(limit, 10) || 1) : 400;
    const numbered = all.slice(start, start + count).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
    const shownEnd = Math.min(start + count, total);
    const more = shownEnd < total
      ? `\n... ${total - shownEnd} more lines below. Use read_file with OFFSET: ${shownEnd + 1} to continue, or search_file to jump to a symbol.`
      : '';
    return `[${path} — lines ${start + 1}-${shownEnd} of ${total}]\n${numbered}${more}`.slice(0, 14_000);
  },

  // Find where a symbol/string lives in a big file (or across the workspace).
  // Returns "path:line: text" so the model can then read_file a range and edit it.
  search_file({ path, query }) {
    if (!query) return 'ERROR: missing QUERY to search for.';
    let re;
    try { re = new RegExp(query, 'i'); }
    catch { re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
    const targets = [];
    if (path) targets.push(path);
    else {
      const walk = (dir, rel = '') => {
        for (const name of readdirSync(dir)) {
          if (name === 'node_modules' || name === '.git') continue;
          const fp = join(dir, name), r = rel ? `${rel}/${name}` : name;
          statSync(fp).isDirectory() ? walk(fp, r) : targets.push(r);
        }
      };
      try { walk(WORKSPACE); } catch {}
    }
    const out = [];
    for (const t of targets) {
      let full;
      try { full = safePath(t); } catch { continue; }
      if (!existsSync(full) || statSync(full).isDirectory()) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      for (let i = 0; i < lines.length && out.length < 60; i++) {
        if (re.test(lines[i])) out.push(`${t}:${i + 1}: ${lines[i].trim().slice(0, 150)}`);
      }
      if (out.length >= 60) break;
    }
    return out.length
      ? out.join('\n') + (out.length >= 60 ? '\n... more matches — refine QUERY.' : '')
      : `(no matches for "${query}")`;
  },

  // Compact MAP of a big file — every function/class/top-level const + its line
  // number. Lets the model grasp a 10k-line file's structure in ~100 lines, then
  // read_file just the slice it needs. The right FIRST move on any large file.
  outline_file({ path }) {
    const full = safePath(path);
    if (!existsSync(full)) return `ERROR: file not found: ${path}`;
    const lines = readFileSync(full, 'utf8').split('\n');
    const out = buildOutline(lines);
    return out.length
      ? `[${path} — ${lines.length} lines, ${out.length} declarations]\n${out.join('\n')}`.slice(0, 13_000)
      : `(no declarations found — use read_file with LINES or search_file)`;
  },

  write_file({ path, content = '' }) {
    const full = safePath(path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    return `OK: wrote ${Buffer.byteLength(content)} bytes to ${path}`;
  },

  // Surgical edit: replace a snippet in an existing file. Tries an exact match
  // first; if that fails, falls back to whitespace-tolerant line matching (small
  // models rarely reproduce exact indentation). Refuses if not found or ambiguous.
  edit_file({ path, find, replace = '' }) {
    const full = safePath(path);
    if (!existsSync(full)) return `ERROR: file not found: ${path} (use write_file to create it)`;
    if (find == null || find === '') return 'ERROR: missing FIND snippet.';
    const content = readFileSync(full, 'utf8');

    // 1) exact unique match
    const exact = content.split(find).length - 1;
    if (exact === 1) { writeFileSync(full, content.replace(find, replace), 'utf8'); return `OK: edited ${path}.`; }
    // An ambiguous EXACT match falls through to the line-based path below, which computes
    // where each match is - the caller needs those positions to disambiguate.

    // 2) whitespace-tolerant: match by trimmed non-blank lines (ignores indentation)
    const fileLines = content.split('\n');
    const findLines = find.split('\n').map(l => l.replace(/^\s*\d+:\s?/, '').trim()).filter(Boolean);
    if (!findLines.length) return `ERROR: the FIND snippet was not found in ${path}.`;
    let start = -1, end = -1, hits = 0;
    const where = [];
    for (let i = 0; i < fileLines.length; i++) {
      let fi = i, ki = 0;
      while (fi < fileLines.length && ki < findLines.length) {
        const t = fileLines[fi].trim();
        if (t === '') { fi++; continue; }            // skip blank lines in the file
        if (t === findLines[ki]) { fi++; ki++; } else break;
      }
      if (ki === findLines.length) {
        // Resume AFTER this match, not at the next line.
        //
        // Blank lines in the file are skipped while matching, so a search starting on a
        // blank line and one starting on the first real line resolve to the SAME region -
        // and counting both made a unique snippet look ambiguous. Measured 2026-09-10: the
        // 32B was told "matches 2 places" for lines 25-28 and 26-28, which are one match;
        // it correctly extended FIND with the preceding line and was told the same thing
        // again, because that line was also preceded by a blank. No extension could ever
        // win, so the run looped until the repeat guard killed it. The tool made the task
        // impossible and blamed the model.
        hits++;
        where.push({ start: i, end: fi - 1 });
        if (hits === 1) { start = i; end = fi - 1; }
        i = fi - 1;
      }
    }
    if (hits === 1) {
      const out = [...fileLines.slice(0, start), replace, ...fileLines.slice(end + 1)].join('\n');
      writeFileSync(full, out, 'utf8');
      return `OK: edited ${path} (matched ignoring indentation).`;
    }

    // A REFUSAL HAS TO HAND BACK SOMETHING TO ACT ON.
    //
    // Measured 2026-09-10 against the 32B: told only "the snippet matches 2 places;
    // include more lines so it is unique", the model re-sent the IDENTICAL snippet five
    // times and the run died on the repeat guard. The instruction was correct and
    // unusable - it named the problem while withholding the one fact needed to solve it,
    // which is WHERE the matches are. An error that a caller cannot act on is a loop.
    const preview = (m) => {
      const from = Math.max(0, m.start - 1);
      const to = Math.min(fileLines.length - 1, m.end + 1);
      return fileLines.slice(from, to + 1)
        .map((l, k) => `      ${String(from + k + 1).padStart(4)}| ${l}`.slice(0, 130))
        .join('\n');
    };

    if (hits > 1) {
      const sites = where.slice(0, 4)
        .map((m, n) => `  match ${n + 1} - lines ${m.start + 1}-${m.end + 1}:\n${preview(m)}`)
        .join('\n');
      return `ERROR: the FIND snippet matches ${hits} places in ${path}, so it is ambiguous.\n`
        + `Here is each one, with the line above and below:\n${sites}\n`
        + `Pick the one you meant and extend FIND with a neighbouring line - the line above or below is usually enough. `
        + `Do NOT resend the same snippet; it will match ${hits} places again.`;
    }

    // Not found: show what IS there, anchored on the most distinctive word the caller
    // asked for, so the next attempt sees how the file actually reads.
    const longest = [...findLines].sort((a, b) => b.length - a.length)[0] || '';
    const token = longest.replace(/[^A-Za-z0-9_$]+/g, ' ').split(' ').filter((w) => w.length > 3)[0];
    let near = '';
    if (token) {
      const idx = fileLines.findIndex((l) => l.includes(token));
      if (idx >= 0) {
        const from = Math.max(0, idx - 3);
        const to = Math.min(fileLines.length - 1, idx + 5);
        near = `\nThe closest match in the file is around "${token}":\n`
          + fileLines.slice(from, to + 1)
            .map((l, k) => `      ${String(from + k + 1).padStart(4)}| ${l}`.slice(0, 130))
            .join('\n');
      }
    }
    return `ERROR: the FIND snippet was not found in ${path} (${fileLines.length} lines).${near}\n`
      + `Copy the target lines EXACTLY as read_file shows them, or use write_file to replace the whole file.`;
  },

  // ---- durable memory --------------------------------------------------------
  // The context window is 16 messages. The DISK is unbounded. A human coder does not
  // hold a project in their head either - they keep notes and re-read them. These give
  // the agent the same thing: recall that costs no context until it asks for it, and
  // that survives both history pruning and the end of the run.

  // Append a durable note. Use for decisions, dead ends, and anything a future step
  // (or a future RUN) would otherwise have to rediscover.
  async remember({ text }) {
    if (!text || !String(text).trim()) return 'ERROR: nothing to remember — provide TEXT.';
    const line = `- [${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${String(text).trim().replace(/\s+/g, ' ').slice(0, 500)}\n`;
    const full = join(WORKSPACE, 'NOTES.md');
    try {
      if (!existsSync(full)) writeFileSync(full, '# Project notes\n\nWritten by the agent. Read this before deciding anything.\n\n', 'utf8');
      appendFileSync(full, line, 'utf8');
      return `OK: noted. NOTES.md now has ${readFileSync(full, 'utf8').split('\n').filter((l) => l.startsWith('- [')).length} entries.`;
    } catch (e) { return `ERROR: ${e.message}`; }
  },

  // Read the notes back. Cheap - it is one file, not a re-derivation.
  async recall() {
    const full = join(WORKSPACE, 'NOTES.md');
    if (!existsSync(full)) return 'No notes yet. Use `remember` to record decisions worth keeping.';
    const body = readFileSync(full, 'utf8');
    // Newest last, and only the tail: old notes matter less and the context is small.
    const lines = body.split('\n').filter(Boolean);
    const tail = lines.slice(-60).join('\n');
    return `NOTES.md (${lines.length} lines, showing the last ${Math.min(60, lines.length)}):\n${tail}`.slice(0, 8000);
  },

  // ---- version control -------------------------------------------------------
  // These are what make unsupervised running safe: with history, a bad edit is one
  // command from undone, so the agent can be bold instead of gated on every action.

  // See what changed. The agent otherwise has NO way to know what it has done.
  async git_diff({ ref } = {}) {
    const r = await gitDiff(WORKSPACE, ref || 'HEAD~1');
    if (!r.ok) return `ERROR: ${r.error}`;
    return `CHANGES SINCE ${ref || 'HEAD~1'}:\n${r.summary}\n\n${r.patch || '(no textual diff)'}`;
  },

  async git_log({ n } = {}) {
    const r = await gitLog(WORKSPACE, Math.min(parseInt(n || 15, 10) || 15, 50));
    return r.ok ? `HISTORY (newest first):\n${r.out}` : `ERROR: ${r.error}`;
  },

  // Save a checkpoint. Auto-commit already runs before destructive steps, so this is
  // for the agent marking a deliberate "this works" point.
  async git_commit({ message } = {}) {
    const r = await commitAll(WORKSPACE, message || 'agent checkpoint');
    if (!r.ok) return `ERROR: ${r.error}`;
    return r.sha ? `OK: committed ${r.sha} — ${r.note}` : 'OK: nothing had changed, no commit made.';
  },

  // Undo. Defaults to `revert` (a new commit undoing the old one) so history is never
  // lost; HARD: true resets and discards, which is why it is not the default.
  async git_undo({ sha, hard } = {}) {
    const r = await gitUndo(WORKSPACE, { sha: sha || 'HEAD', hard: String(hard) === 'true' });
    return r.ok ? `OK: ${r.out}` : `ERROR: ${r.error}`;
  },

  // Download a file into the workspace.
  //
  // OFF BY DEFAULT. Requires AGENT_ALLOW_DOWNLOADS=1, and even then it is approval-gated
  // (deliberately absent from AUTO_TOOLS). The intended use is a disposable environment -
  // a Modal container or a scratch machine - where a bad file cannot hurt anything that
  // matters. Do not enable it on a machine you care about.
  //
  // Guards, in the order they matter:
  //   1. feature flag        - the whole tool is inert unless explicitly switched on
  //   2. scheme allowlist    - http/https only; no file://, no data:, no ftp
  //   3. SSRF block          - refuses localhost, private ranges and cloud metadata.
  //                            Without this an autonomous agent could fetch
  //                            http://localhost:3001/api/keys and write your API keys
  //                            into the workspace, or read cloud instance credentials.
  //   4. safePath            - the destination must resolve inside WORKSPACE
  //   5. size + time caps    - a stream that never ends cannot fill the disk
  //   6. no execution        - it only writes bytes; nothing runs what it fetched
  async download_file({ url, path }) {
    if (process.env.AGENT_ALLOW_DOWNLOADS !== '1') {
      return 'ERROR: downloads are disabled. Set AGENT_ALLOW_DOWNLOADS=1 to enable, and only '
           + 'do that in a disposable environment - a downloaded file is untrusted by definition.';
    }
    if (!url || !path) return 'ERROR: provide both URL and PATH (destination inside the workspace).';

    let u;
    try { u = new URL(String(url)); } catch { return `ERROR: not a valid URL: ${url}`; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `ERROR: only http and https are allowed (got ${u.protocol}).`;
    }

    // SSRF: block loopback, link-local, private ranges, and cloud metadata endpoints.
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isPrivate =
      host === 'localhost' || host === '::1' || host.endsWith('.localhost') ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||                      // link-local, incl. 169.254.169.254
      /^0\./.test(host) || host === '0.0.0.0' ||
      /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host) ||
      host === 'metadata.google.internal';
    if (isPrivate) {
      return `ERROR: refusing to fetch a private or loopback address (${host}). That path leads to `
           + 'your own API keys and cloud metadata, not to assets.';
    }

    let full;
    try { full = safePath(path); } catch (e) { return `ERROR: ${e.message}`; }

    const MAX_BYTES = parseInt(process.env.AGENT_DOWNLOAD_MAX_MB || '64', 10) * 1024 * 1024;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 120_000);
    try {
      const res = await fetch(u.href, { signal: ac.signal, redirect: 'follow' });
      if (!res.ok) return `ERROR: HTTP ${res.status} fetching ${u.href}`;

      // Re-check after redirects: a public URL can 302 to a loopback address.
      try {
        const finalHost = new URL(res.url).hostname.toLowerCase();
        if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(finalHost) || finalHost === '::1') {
          return `ERROR: redirected to a private address (${finalHost}) - refusing.`;
        }
      } catch {}

      const declared = Number(res.headers.get('content-length') || 0);
      if (declared && declared > MAX_BYTES) {
        return `ERROR: file is ${(declared / 1048576).toFixed(1)}MB, over the ${MAX_BYTES / 1048576}MB limit.`;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        return `ERROR: file is ${(buf.length / 1048576).toFixed(1)}MB, over the ${MAX_BYTES / 1048576}MB limit.`;
      }

      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, buf);
      const type = res.headers.get('content-type') || 'unknown';
      return `OK: saved ${(buf.length / 1024).toFixed(1)}KB to ${path} (content-type: ${type}, from ${res.url}).\n`
           + 'NOTE: this file is untrusted. It has been written, not executed or opened.';
    } catch (e) {
      if (e.name === 'AbortError') return 'ERROR: download timed out after 120s.';
      return `ERROR: ${e.message}`;
    } finally {
      clearTimeout(timer);
    }
  },

  run_command({ cmd }) {
    // A SERVER COMMAND NEVER RETURNS, AND THE WORKSPACE IS ALREADY SERVED.
    //
    // Measured 2026-09-10: the 32B ran `python -m http.server 8000` to preview the game it
    // had just written. It blocks forever, is killed at the 60s timeout, reports EXIT 1 -
    // which reads as a transient failure - so the model ran it again, and again. Three
    // identical timeouts, three minutes of GPU, no progress.
    //
    // The agent was reaching for something that already exists: index.js serves WORKSPACE
    // at /workspace, and test_web loads it in headless Chromium and reports what rendered.
    // So this refuses and points at it, rather than letting the run burn on a command whose
    // success condition is "hangs forever".
    const blocking = [
      [/\bpython3?\s+-m\s+http\.server\b/i, 'python -m http.server'],
      [/\bnpx?\s+(-y\s+)?(serve|http-server|live-server|browser-sync)\b/i, 'a node static server'],
      [/\bnpm\s+(start|run\s+(dev|serve|start|watch))\b/i, 'npm start / npm run dev'],
      [/\b(vite|webpack(-dev-server)?|parcel|next|nuxt)\s+(dev|serve|start)?\b/i, 'a dev server'],
      [/\bphp\s+-S\b/i, 'php -S'],
      [/\bruby\s+-run\s+-e\s+httpd\b/i, 'ruby httpd'],
      [/\bcaddy\s+file-server\b|\bdarkhttpd\b|\bminiserve\b/i, 'a static file server'],
    ];
    const hit = blocking.find(([rx]) => rx.test(String(cmd || '')));
    if (hit) {
      return Promise.resolve(
        `ERROR: refusing to run ${hit[1]} - it never exits, so it will hit the ${CMD_TIMEOUT_MS / 1000}s timeout `
        + `and report EXIT 1 no matter how many times you try.\n`
        + `You do not need a server: this workspace is ALREADY served at `
        + `http://localhost:${PORT}/workspace/ (index.html is at /workspace/index.html).\n`
        + `To check that your page actually works, use:\n`
        + `ACTION: test_web\nPATH: index.html\n`
        + `That loads it in a real headless browser and reports console errors and what rendered.`,
      );
    }

    return new Promise((res) => {
      // Mirror into any open Terminal view so you SEE what the agent runs. The
      // command still executes via exec(), not the PTY: the model needs a clean
      // stdout/stderr/exit-code triple, which you cannot parse back out of a shell
      // byte stream. Mirroring gives visibility without costing reliability.
      mirrorAgentCommand('run_command', cmd);
      exec(cmd, { cwd: WORKSPACE, timeout: CMD_TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
        const out = [
          stdout && `STDOUT:\n${stdout}`,
          stderr && `STDERR:\n${stderr}`,
          err && err.killed && `(timed out after ${CMD_TIMEOUT_MS / 1000}s)`,
          `EXIT: ${err ? (err.code ?? 1) : 0}`,
        ].filter(Boolean).join('\n');
        mirrorAgentResult(out, !err);
        res(out.slice(0, 8_000));
      });
    });
  },

  // Run Python. Either an inline CODE block (written to _snippet.py and executed)
  // or an existing PATH in the workspace. Same risk profile as run_command, so it
  // is approval-gated. Lets the agent compute, test, or run a data script.
  run_python({ code, path }) {
    return new Promise((res) => {
      let target = path;
      if (code != null && code !== '') {
        try { writeFileSync(join(WORKSPACE, '_snippet.py'), code, 'utf8'); target = '_snippet.py'; }
        catch (e) { return res(`ERROR: ${e.message}`); }
      }
      if (!target) return res('ERROR: provide CODE (a python code block) or PATH to a .py file.');
      let full; try { full = safePath(target); } catch (e) { return res(`ERROR: ${e.message}`); }
      if (!existsSync(full)) return res(`ERROR: file not found: ${target}`);
      // Mirror python runs too - run_command was visible in the terminal and this
      // was not, which made the agent look like it did half its work invisibly.
      mirrorAgentCommand('run_python', target);
      exec(`python "${full}"`, { cwd: WORKSPACE, timeout: CMD_TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
        const out = [
          stdout && `STDOUT:\n${stdout}`,
          stderr && `STDERR:\n${stderr}`,
          err && err.killed && `(timed out after ${CMD_TIMEOUT_MS / 1000}s)`,
          `EXIT: ${err ? (err.code ?? 1) : 0}`,
        ].filter(Boolean).join('\n');
        mirrorAgentResult(out, !err);
        res(out.slice(0, 8_000));
      });
    });
  },

  // ── Internet reference lookup (free, no API key) ─────────────────────────────
  // A LAST-RESORT escape hatch: when local context isn't enough, search the web
  // for guidance. Read-only network reads, output is truncated to protect the
  // model's limited context, so these auto-run. Use sparingly (the prompt says so).
  async web_search({ query, max_results = 5 }) {
    if (!query) return 'ERROR: missing QUERY to search for.';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    let html;
    try {
      const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
      html = await r.text();
    } catch (e) { return `ERROR: web search failed: ${e.message}`; }

    const titles = [], snips = [];
    const tre = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = tre.exec(html)) && titles.length < max_results) {
      let href = m[1];
      const ud = href.match(/uddg=([^&]+)/);          // DDG wraps links in a redirect — unwrap it
      if (ud) { try { href = decodeURIComponent(ud[1]); } catch {} }
      titles.push({ href, title: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    const sre = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = sre.exec(html)) && snips.length < max_results) snips.push(m[1].replace(/<[^>]+>/g, '').trim());

    if (!titles.length) return `(no results for "${query}")`;
    return titles.map((t, i) =>
      `${i + 1}. ${t.title}\n   ${t.href}\n   ${(snips[i] || '').slice(0, 240)}`).join('\n\n')
      + `\n\n(Use web_fetch on the most relevant URL to read its content.)`;
  },

  // Fetch a page and strip it to clean text (never dump raw HTML into the model).
  async web_fetch({ url, max_chars = 4000 }) {
    if (!/^https?:\/\//i.test(url || '')) return 'ERROR: URL must start with http:// or https://';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    let html;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return `ERROR: fetch returned HTTP ${r.status}`;
      html = await r.text();
    } catch (e) { return `ERROR: fetch failed: ${e.message}`; }
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
    return `[${url} — ${text.length} chars of text extracted]\n${text.slice(0, max_chars)}`
      + (text.length > max_chars ? '\n... (truncated)' : '');
  },

  // Load the web app in a headless browser, click its controls, and report
  // console/page errors + the visible text after interaction. Lets the agent
  // catch its own runtime bugs by actually running the app.
  async test_web({ path = 'index.html' } = {}) {
    let puppeteer;
    try { puppeteer = require('puppeteer'); }
    catch { return 'ERROR: puppeteer is not installed on the server, cannot test.'; }
    const url = `http://localhost:${PORT}/workspace/${String(path).replace(/^\/+/, '')}`;
    const logs = [];
    let browser;
    try {
      browser = await puppeteer.launch(launchOptions());
      const page = await browser.newPage();
      page.on('console', (m) => {
        const t = m.text();
        // skip generic "Failed to load resource" (favicon noise — real 404s are caught below with their URL)
        if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/i.test(t)) logs.push(`[console.${m.type()}] ${t}`);
      });
      page.on('pageerror', (e) => logs.push(`[JS ERROR] ${e.message}`));
      page.on('response', (r) => { if (r.status() >= 400 && !/favicon/i.test(r.url())) logs.push(`[HTTP ${r.status()}] ${r.url().split('/').pop()}`); });
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      const status = resp ? resp.status() : 'no response';
      await new Promise((r) => setTimeout(r, 700));
      const before = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 400);
      // exercise the UI: click up to 12 buttons / onclick elements
      const clickable = await page.$$('button, [onclick]');
      let clicked = 0;
      for (const el of clickable.slice(0, 12)) {
        try { await el.click({ delay: 10 }); clicked++; await new Promise((r) => setTimeout(r, 120)); } catch {}
      }
      await new Promise((r) => setTimeout(r, 400));
      const after = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 700);
      await browser.close();
      const errs = logs.length ? logs.slice(0, 25).join('\n') : '(none)';
      return [
        `Loaded ${url} (HTTP ${status}). Clicked ${clicked} control(s).`,
        `ERRORS:\n${errs}`,
        `VISIBLE TEXT (on load): ${before.replace(/\n+/g, ' | ')}`,
        `VISIBLE TEXT (after clicking): ${after.replace(/\n+/g, ' | ')}`,
        `(Review the visible text for wrong values, e.g. "$0" where money was expected, or features that did nothing.)`,
      ].join('\n\n');
    } catch (e) {
      try { if (browser) await browser.close(); } catch {}
      return `ERROR loading the page: ${e.message}\nCollected so far:\n${logs.join('\n') || '(none)'}`;
    }
  },

  // ---- the task ledger -------------------------------------------------------
  // A plan says what to build; it never says what is DONE. On a long run the agent was
  // re-deriving its own progress from a 16-message window, which is how you get the same
  // file built three times. TASKS.md is the durable answer, and it is re-injected fresh
  // before every model call so pruning can never drop it.

  async task_list() {
    const b = ledger.contextBlock(WORKSPACE);
    return b || 'No tasks yet. Use task_add to write down what this build needs.';
  },

  // ---- the asset library --------------------------------------------------------
  // Per-call context carries only a SUMMARY of the library (12k+ files); this is how the
  // agent gets exact paths. Exact paths are the whole point: an invented sprite name is a
  // 404 and a blank canvas, and the verifier reports the missing file by name.
  async list_assets({ filter = '' } = {}) {
    const r = assetLib.search(filter, { limit: 60 });
    if (!r.total) {
      return filter
        ? `No assets match "${filter}". Try fewer or shorter words, or list_assets with no FILTER for a summary.`
        : (assetLib.contextBlock() || 'The asset library is empty.');
    }
    const lines = r.items.map((i) => `  ${i.path}${i.width ? ` ${i.width}x${i.height}` : ''}${i.label ? `  — ${i.label}` : ''}`);
    const more = r.total > r.items.length ? ` (showing ${r.items.length} - add a word to narrow it)` : '';
    return `${r.total} asset(s) match${filter ? ` "${filter}"` : ''}${more}:\n${lines.join('\n')}\nLoad with the EXACT path shown.`;
  },

  async task_add({ text }) {
    if (!text || !String(text).trim()) return 'ERROR: provide TEXT — one task per line.';
    const titles = String(text).split('\n').map((s) => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
    if (!titles.length) return 'ERROR: no task text found.';
    const r = ledger.add(WORKSPACE, titles);
    const p = ledger.progress(WORKSPACE);
    // Report what ACTUALLY happened, not what was asked for. The old message said
    // "added N" unconditionally, so once the ledger reached its cap the agent was told
    // it had recorded work that had been silently discarded.
    const notes = [];
    if (r.added < titles.length) notes.push(`${titles.length - r.added} were already on the list`);
    if (r.evicted) notes.push(`${r.evicted} completed task(s) evicted to make room (still in the git log)`);
    if (r.dropped) notes.push(`WARNING: ${r.dropped} could NOT be recorded - the ledger is at its cap. Close open tasks before adding more`);
    return `OK: added ${r.added} task(s)${notes.length ? ` - ${notes.join('; ')}` : ''}. Ledger now ${p.done}/${p.total} done.\n${ledger.contextBlock(WORKSPACE)}`;
  },

  async task_done({ which }) {
    const r = ledger.mark(WORKSPACE, which, 'done');
    if (!r.ok) return `ERROR: ${r.error}. Use task_list to see the numbered list.`;
    const p = ledger.progress(WORKSPACE);
    // Counted against THIS run's own tasks, matching the finish gate. Carried-over work
    // from an earlier run must not stop the agent being told it is done.
    return p.remainingOwn === 0
      ? `OK: "${r.task.title}" done. ALL ${p.total - p.carried} TASKS FOR THIS GOAL ARE COMPLETE — verify, then finish.`
      : `OK: "${r.task.title}" done (${p.done}/${p.total}). ${p.remainingOwn} left.\n${ledger.contextBlock(WORKSPACE)}`;
  },

  // ---- looking at the result -------------------------------------------------
  // test_web reads the CONSOLE, so code that throws nothing and draws nothing passes it
  // clean. This interrogates the rendered page instead and reports what is (and is not)
  // on screen. The model is text-only, so it gets sentences; the PNG is saved for you.
  async see_screen({ path = 'index.html' } = {}) {
    const url = `http://localhost:${PORT}/workspace/${String(path).replace(/^\/+/, '')}`;
    const r = await visual.inspect(url, { saveTo: join(WORKSPACE, '.screenshots'), label: 'agent' });
    return r.report;
  },

  // ---- does it actually run? -------------------------------------------------
  // The finish gate only understood web apps. This detects what kind of project this is
  // and runs the proof appropriate to it, so a Python script or a Node service can no
  // longer be declared finished having never executed.
  async verify_project({ entry } = {}) {
    const r = await verifier.verify(WORKSPACE, { entry });
    return verifier.format(r);
  },

  // ---- delegate a self-contained piece of work -------------------------------
  // The context window is the hard ceiling on how much one run can hold. A sub-task gets
  // a FRESH window: it shares the workspace (so the files are real) but not the history,
  // and hands back only a summary. That trades detail for room - the parent sees the
  // outcome, not the twenty steps that produced it.
  //
  // Bounded on purpose: nesting is capped, and a sub-task gets a fraction of the parent's
  // budget, because runaway recursion here costs real money and real time.
  async spawn_subtask({ goal, depth = 1 }) {
    if (!goal || !String(goal).trim()) return 'ERROR: provide a GOAL for the sub-task.';
    if (depth > SUBTASK_MAX_DEPTH) {
      return `ERROR: sub-task nesting limit (${SUBTASK_MAX_DEPTH}) reached. Do this work directly instead of delegating it again.`;
    }
    // The parent comes from module scope, NOT from args. Putting it on args made
    // run.steps[n].args._parent point back at the run, so JSON.stringify(run) threw
    // "Converting circular structure to JSON" - which broke BOTH the GET /agent/:id
    // route and persist(), meaning a run that delegated could not even be checkpointed.
    // Found 2026-09-09 the first time spawn_subtask was ever executed.
    return runSubtask(String(goal).trim(), depth, _activeRun);
  },

  // ---- queue work for later --------------------------------------------------
  // Lets the agent write down work it has NOTICED but should not do now, instead of
  // either derailing the current goal or forgetting it entirely.
  async queue_task({ goal }) {
    if (!goal || !String(goal).trim()) return 'ERROR: provide a GOAL to queue.';
    // Machine-queued work inherits its parent's generation + 1, so the supervisor can
    // tell a human's goal from the fourth hop of a self-extending chain.
    const generation = ((_activeRun && _activeRun.generation) || 0) + 1;
    const r = workQueue.enqueue(String(goal).trim(), { source: 'agent', generation });
    // A duplicate is not a failure - the work IS tracked, which is what the agent
    // wanted. Reporting it as an error invites a retry with reworded text, which is
    // exactly how a dedup-by-text guard gets defeated.
    if (r.duplicate) return `OK (already tracked): ${r.error}. Do not queue it again.`;
    if (!r.ok) return `ERROR: ${r.error}`;
    return `OK: queued "${r.item.goal.slice(0, 80)}" (${r.depth} item(s) waiting). It will be picked up after this run.`;
  },
};

// The Google tools join the same table, at load time. safePath confines drive_upload to the
// workspace by exactly the check that confines write_file - without it, PATH: ../../.ssh/id_rsa
// is a one-line exfiltration that the approval prompt would ask about in a form nobody reads
// carefully at 3am.
Object.assign(tools, googleTools({
  loadDb: () => googleDb.loadDb(),
  saveDb: (db) => googleDb.saveDb(db),
  withDb: (fn) => googleDb.withDb(fn),
  safePath,
}));

// Tools that run WITHOUT human approval.
//
// The line is "can this reach outside the sandbox, or spend/destroy something
// beyond it?" - not "does this change state". Requiring a click for every
// write_file would make an autonomous coding agent unusable, so file writes are
// auto-approved and CONFINED instead.
//
// That confinement is load-bearing: write_file/edit_file are only safe here
// because safePath() guarantees the target is under WORKSPACE. On 2026-09-08 it
// did not - path.relative() let drive-absolute (D:\...) and UNC (\server\...)
// paths through, so an auto-approved write could land anywhere on the machine.
// Fixed by requiring the resolved path to sit under WORKSPACE. If safePath is
// ever weakened, these three entries become a hole, not an inconvenience.
//
// run_python and run_command execute code and are NOT here.
// web_search/web_fetch are read-only network reads with truncated output.
const AUTO_TOOLS = new Set(['list_dir', 'read_file', 'search_file', 'outline_file', 'write_file', 'edit_file', 'test_web', 'web_search', 'web_fetch',
  // Reading history is as safe as reading a file. Committing and undoing change state,
  // so they stay gated.
  'git_diff', 'git_log',
  // Notes are the agent's own memory - gating them would defeat the purpose.
  'remember', 'recall',
  // The ledger is bookkeeping about work, not the work itself.
  'task_list', 'task_add', 'task_done',
  // Reading a connected Google account changes nothing in it. The WRITE half
  // (gmail_send, drive_upload, calendar_add) is deliberately NOT here: those act on a real
  // account belonging to a person, and with the supervisor on this agent works while
  // nobody is watching. Leaving them out routes each one through the human gate below.
  ...GOOGLE_READ_TOOLS,
  // (the read/write split above is asserted in googleTools.test.mjs via __toolPolicyTest —
  //  a safety boundary that only a comment defends is one that quietly stops holding)
  // Looking at and verifying its own output. Both only READ - see_screen loads a local
  // page in a headless browser, verify_project runs the project's own entry point.
  // (verify_project executes workspace code, which is exactly what it is for: a claim
  // of "done" that never ran anything is the failure this closes.)
  'see_screen', 'verify_project',
  // Queueing costs nothing and running a bounded sub-task is just more model calls.
  'queue_task', 'spawn_subtask',
  // Reading the asset manifest is a lookup, nothing more.
  'list_assets']);

// Sub-task recursion bounds. Depth 2 is enough for "build the thing" -> "build this
// part" -> "fix this file"; deeper is almost always a model losing the plot, and each
// level multiplies cost.
const SUBTASK_MAX_DEPTH = parseInt(process.env.AGENT_SUBTASK_DEPTH || '2', 10);
const SUBTASK_MAX_STEPS = parseInt(process.env.AGENT_SUBTASK_STEPS || '40', 10);

// TWO separate switches for downloads, because they carry very different risk:
//
//   AGENT_ALLOW_DOWNLOADS=1  the tool works at all. Each download still stops for a
//                            human, who sees the URL and destination before it runs.
//   AGENT_AUTO_DOWNLOAD=1    downloads happen with NO approval. Only sensible in a
//                            disposable environment - an unattended agent can then pull
//                            arbitrary bytes from the internet onto this machine while
//                            nobody is watching. The SSRF, path, size and scheme guards
//                            still apply; what you lose is the human check on WHAT.
if (process.env.AGENT_ALLOW_DOWNLOADS === '1' && process.env.AGENT_AUTO_DOWNLOAD === '1') {
  AUTO_TOOLS.add('download_file');
  console.warn('[agent] download_file is AUTO-APPROVED - downloads will run unattended.');
}

// Cheap, automatic verification: after the model writes/edits a .py or .js file,
// compile-check it (no execution). Catches the most common failure mode — broken
// syntax — instantly and for free, the same way test_web catches runtime bugs.
function quickCheck(path) {
  return new Promise((res) => {
    if (!path) return res(null);
    let full; try { full = safePath(path); } catch { return res(null); }
    let cmd;
    if (/\.py$/i.test(path)) cmd = `python -m py_compile "${full}"`;
    else if (/\.(c|m)?js$/i.test(path)) cmd = `node --check "${full}"`;
    else return res(null);                       // not a checkable language
    exec(cmd, { cwd: WORKSPACE, timeout: 20_000, windowsHide: true }, (err, _o, stderr) => {
      res(err ? (stderr || 'syntax error').slice(0, 1200) : null);
    });
  });
}

// ── Model call (Ollama /api/chat, non-streaming for reliability) ──────────────
// Uncapped num_predict at 32K ctx means a long file can take minutes on a T4 (~15-25 tok/s).
// 180s would abort it mid-write; 600s tolerates a full long generation while still bounding a dead tunnel.
const MODEL_TIMEOUT_MS = (parseInt(process.env.MODEL_TIMEOUT_S, 10) || 600) * 1000;
// How many times a transient upstream failure (429 / 5xx) is retried before the run
// pauses. Free-tier endpoints 503 under load; three tries with backoff covers a spike.
const MODEL_RETRIES = parseInt(process.env.MODEL_RETRIES || '3', 10);
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m'; // keep the 14B resident; avoids 20-60s cold reloads between steps

/**
 * Which provider should the agent think with?
 *
 * The agent was hardwired to `api_keys.ollama` while the Chat and Code tabs could already
 * reach eight providers. That made the agent the ONLY part of the hub locked to a
 * self-hosted 14B — the weakest model in the building, and the one measured at 9/18.
 *
 * AGENT_PROVIDER picks; otherwise ollama stays the default so nothing changes for anyone
 * who has not asked for this. An OpenAI-compatible provider (google, openai, deepseek,
 * groq, mistral, kimi) needs no new response parsing — only a different URL and auth.
 */
function agentProvider(db) {
  const want = process.env.AGENT_PROVIDER || 'ollama';
  const row = db.api_keys?.[want];
  if (!row) return { name: 'ollama', row: db.api_keys?.ollama || {}, kind: 'ollama' };
  // Anything that is not ollama is treated as OpenAI-shaped. google and perplexity ship a
  // base_url that already carries its version segment, so /v1 must not be appended.
  const kind = want === 'ollama' ? 'ollama' : 'openai';
  const versioned = want === 'google' || want === 'perplexity';
  return { name: want, row, kind, versioned };
}

async function callModel(loadDb, messages, signal, override) {
  const db = loadDb();
  const prov = agentProvider(db);
  const o = prov.row || {};
  const base = ((override && override.base_url) || o.base_url || 'http://localhost:11434').replace(/\/+$/, '');
  const model = (override && override.model) || o.model || 'qwen2.5-coder:7b';
  // abort on either the run's stop signal OR a hard timeout
  const sigs = [AbortSignal.timeout(MODEL_TIMEOUT_MS)];
  if (signal) sigs.push(signal);
  const merged = AbortSignal.any(sigs);
  try {
    // STREAM the reply. A non-streaming 14B reply sends no bytes until the whole
    // generation is done — on a Cloudflare quick tunnel (~100s idle cap) that
    // returns a 524 HTML error page mid-think. Streaming keeps bytes flowing per
    // token so the connection stays alive; we accumulate and return the full text
    // so every caller (planner + action loop) is unchanged.
    const isOllama = prov.kind === 'ollama';
    const url = isOllama ? `${base}/api/chat`
      : `${base}${prov.versioned ? '' : '/v1'}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (!isOllama && o.key_value) headers.Authorization = `Bearer ${o.key_value}`;
    const payload = isOllama
      ? { model, messages, stream: true, keep_alive: KEEP_ALIVE,
          options: { temperature: TEMPERATURE, num_ctx: NUM_CTX, num_predict: NUM_PREDICT } }
      // OpenAI-compatible: no keep_alive, no num_ctx — the server owns those.
      : { model, messages, stream: true, temperature: TEMPERATURE };

    // Transient upstream failures get retried HERE rather than surfacing as a paused run.
    //
    // A free-tier endpoint returns 503 "experiencing high demand" and 429 rate-limits
    // routinely - measured against Gemini, one in two calls during a spike. Those are
    // already classed as resumable, but "resumable" means a human clicks Resume, which
    // is exactly what an unattended agent cannot rely on. A few seconds of backoff turns
    // a stalled overnight run into a slightly slower one.
    let r, lastErr;
    for (let attempt = 0; attempt < MODEL_RETRIES; attempt++) {
      r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: merged });
      if (r.ok) break;
      const transient = r.status === 429 || r.status >= 500;
      lastErr = `Model error ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`;
      if (!transient || attempt === MODEL_RETRIES - 1) throw new Error(lastErr);
      // Exponential backoff, and honour Retry-After when the server sends one.
      const hinted = parseInt(r.headers.get('retry-after') || '', 10);
      const waitMs = Number.isFinite(hinted) ? hinted * 1000 : Math.min(30_000, 2000 * 2 ** attempt);
      await new Promise((res) => setTimeout(res, waitMs));
      if (signal?.aborted) throw new Error('stopped');
    }
    if (!r.ok) throw new Error(lastErr || `Model error ${r.status}`);

    // Ollama /api/chat streams NDJSON: { message: { content }, done }. Buffer
    // across network chunk boundaries so a split JSON line isn't dropped.
    // Two stream shapes. Ollama sends bare NDJSON objects; OpenAI-compatible servers
    // send Server-Sent Events - "data: {...}" lines ending with "data: [DONE]".
    let full = '', buf = '';
    const take = (line) => {
      let s = line.trim();
      if (!s) return;
      if (!isOllama) {
        if (!s.startsWith('data:')) return;
        s = s.slice(5).trim();
        if (s === '[DONE]') return;
      }
      try {
        const j = JSON.parse(s);
        if (isOllama) { if (j.message?.content) full += j.message.content; }
        else { const d = j.choices?.[0]?.delta?.content; if (d) full += d; }
      } catch {}
    };
    // A streaming provider can drop the connection mid-body ("Premature close",
    // "terminated"). Measured against OpenRouter's free tier on 2026-09-09: the plan
    // arrived, the next stream died, and the whole run was marked 'error'.
    //
    // If bytes already arrived, KEEP them. A truncated reply is not automatically
    // useless - the parser decides, and a genuinely unusable one is caught by the
    // parse-failure window. Discarding a nearly complete response and killing the run
    // is strictly worse. Only a drop with NOTHING accumulated is a real error.
    try {
      for await (const chunk of r.body) {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const l of lines) take(l);
      }
      if (buf) take(buf);
    } catch (streamErr) {
      if (buf) take(buf);
      if (!full) throw new Error('Model stream failed before any content: ' + streamErr.message);
      console.warn('[agent] stream ended early (' + streamErr.message + ') - keeping ' + full.length + ' chars already received');
    }
    return full;
  } catch (e) {
    if (e.name === 'TimeoutError' || (merged.aborted && !(signal && signal.aborted))) {
      throw new Error(`Model call timed out after ${MODEL_TIMEOUT_MS / 1000}s — the Ollama tunnel may be down. Re-check the tunnel URL in Settings.`);
    }
    throw e;
  }
}

const SYSTEM_PROMPT = `You are an autonomous coding agent. You build software by taking ONE action per step.

You work inside a sandboxed workspace directory. All paths are relative to it.

Respond in this EXACT plain-text format (NOT JSON). Start with a one-line THOUGHT, then an ACTION line, then any fields for that action.

The actions are:

list_dir — list files/folders:
THOUGHT: <why>
ACTION: list_dir
PATH: .

read_file — read a file. For a BIG file, read only a line range with LINES (read_file shows line numbers, and tells you how many lines are below). If you read a big file with NO LINES, you get its MAP (declarations → line numbers) instead of the contents — read the map, then request the exact range you need:
THOUGHT: <why>
ACTION: read_file
PATH: <a file from the workspace listing>
LINES: 200-260

outline_file — get a COMPACT map of a big file: every function/class with its line number. Do this FIRST on any large file, then read_file only the lines you need (never try to read a whole big file — it will not fit):
THOUGHT: <why>
ACTION: outline_file
PATH: <a file from the workspace listing>

search_file — find which line a specific symbol is on. Use the REAL name from the goal or the outline — NEVER a placeholder name from these examples:
THOUGHT: <why>
ACTION: search_file
PATH: <a file from the listing, or omit to search every file>
QUERY: <the exact symbol you are looking for>

write_file — create/overwrite a file. Put the COMPLETE file in a fenced code block. Write code NORMALLY — do NOT escape quotes or backslashes:
THOUGHT: <why>
ACTION: write_file
PATH: main.py
\`\`\`python
print("hello")
\`\`\`

edit_file — change a small part of an EXISTING file (preferred over rewriting it). The FIND text must match the file EXACTLY and be unique:
THOUGHT: <why>
ACTION: edit_file
PATH: <the file from the listing>
FIND:
\`\`\`
the exact old code to replace
\`\`\`
REPLACE:
\`\`\`
the new code
\`\`\`

remember — write something down that a later step, or a later RUN, would otherwise have to rediscover. Your context only holds the last few messages; NOTES.md is permanent:
THOUGHT: <why this is worth keeping>
ACTION: remember
TEXT: the collision check must run before the move, not after — fixing it the other way broke the paddle

recall — read your notes back. Do this at the START of a run, and whenever you are unsure whether you already tried something:
THOUGHT: <why>
ACTION: recall

git_diff — see what you changed. Use this before finishing, and after any edit you are unsure about:
THOUGHT: <why>
ACTION: git_diff
REF: HEAD~1

git_log — recent checkpoints, newest first:
THOUGHT: <why>
ACTION: git_log

git_commit — save a checkpoint once something works (a human must approve it):
THOUGHT: <why this is a good state to save>
ACTION: git_commit
MESSAGE: working farm loop with tests passing

git_undo — undo a bad change (a human must approve it). Defaults to a safe revert commit:
THOUGHT: <what went wrong>
ACTION: git_undo
SHA: HEAD

download_file — save a file from the internet into the workspace (a human must approve it). Only available when downloads are enabled; http/https only, and private/loopback addresses are refused. The file is written, never executed:
THOUGHT: <why you need this file>
ACTION: download_file
URL: https://example.com/sprite.png
PATH: assets/sprite.png

run_command — run a shell command (a human must approve it):
THOUGHT: <why>
ACTION: run_command
COMMAND: python main.py

run_python — run Python: put the code in a fenced block (it runs as a script), or give PATH to a .py file in the workspace (a human must approve it):
THOUGHT: <why>
ACTION: run_python
\`\`\`python
print(2 + 2)
\`\`\`

web_search — LAST RESORT only: when the workspace and your own knowledge are not enough, search the web for guidance. Returns titles, URLs, and snippets:
THOUGHT: <why you are stuck and what you need>
ACTION: web_search
QUERY: <a focused search query>

web_fetch — read the text of ONE web page (usually a URL from web_search). Output is stripped to plain text and truncated:
THOUGHT: <why>
ACTION: web_fetch
URL: https://example.com/docs/page

test_web — load your web app in a real browser, click its controls, and get back any errors + the on-screen text:
THOUGHT: <why>
ACTION: test_web
PATH: index.html

see_screen — check what the page actually LOOKS like. test_web only reads the console, so code that throws no error and draws nothing passes it. This reports whether the canvas is blank, whether anything is on screen, invisible text, collapsed or off-screen elements. Run it for any game or visual app:
THOUGHT: <why>
ACTION: see_screen
PATH: index.html

verify_project — prove the project runs. Detects what kind of project this is (web, Node, Python, Godot) and runs the right check: compiles the sources, runs the tests if there are any, otherwise runs the entry point. Use this before finishing anything that is NOT a web page:
THOUGHT: <why>
ACTION: verify_project

task_list — see your checklist: what is done, what is left:
THOUGHT: <why>
ACTION: task_list

task_add — write down work that needs doing, ONE PER LINE. Do this when you discover something the plan missed:
THOUGHT: <why>
ACTION: task_add
TEXT:
add collision detection between ball and paddle
show the score in the corner

task_done — mark a task finished. Do this the moment it works, not at the end. Give the NUMBER from task_list:
THOUGHT: <why>
ACTION: task_done
WHICH: 3

spawn_subtask — hand a self-contained piece of work to a fresh sub-agent. It sees the same files but starts with an empty context and reports back a summary. Use this when a piece is big enough that doing it here would crowd out everything else — NOT for small steps, which cost less done directly:
THOUGHT: <why this is worth delegating>
ACTION: spawn_subtask
GOAL: write the level-loading module in levels.js, with a loadLevel(n) that returns the tile grid

list_assets — find sprites, sounds, tilesets and fonts in the shared asset library. Load them by the EXACT path returned (this.load.image('key', 'assets/<name>')). Never invent an asset filename:
THOUGHT: <what you need>
ACTION: list_assets
FILTER: orc idle

queue_task — note work for AFTER this run. Use it when you notice something real that is not part of the current goal, instead of derailing or forgetting:
THOUGHT: <why>
ACTION: queue_task
GOAL: add sound effects once the core loop is stable

finish — the goal is fully complete:
THOUGHT: <why>
ACTION: finish
SUMMARY: <what you built>

RULES:
- Exactly ONE action per response. Nothing after the action's content.
- Write real, complete, working code — no placeholders, no "...".
- Code goes in ONE fenced block exactly as it should appear on disk. Never add backslashes before quotes.
- To CREATE a new file use write_file. To FIX or change an EXISTING file, prefer edit_file (replace just the broken snippet) instead of rewriting the whole file — it's faster and safer. read_file first so your FIND snippet matches exactly.
- If an edit_file FAILS (the FIND snippet was not found), do NOT retry the same patch and do NOT re-read the file in a loop. search_file for the symbol to get its REAL current line, then copy those EXACT lines for a new FIND. (For SMALL files you may instead write_file the whole corrected file.)
- BIG FILES (hundreds/thousands of lines): never read or rewrite the whole file — it will NOT fit in one read. FIRST outline_file to get its map, then search_file/read_file ONLY the exact LINES you need, then edit_file that snippet. Watch for "... N more lines below" — the file is longer than one read shows.
- NEVER invent a variable, constant, function, or API name. If you have not actually seen it in the file, search_file for it first. Do not guess names or values.
- When copying lines into edit_file FIND/REPLACE, do NOT include the "N: " line-number prefix that read_file shows — it is only for navigation.
- Do NOT run programs that loop forever; if you must, the command will time out and that is fine.

WHEN TO USE THE INTERNET (web_search / web_fetch):
- These are a LAST RESORT, not a first move. Try the workspace files and your own knowledge FIRST.
- Only search the web when you are genuinely STUCK — an unfamiliar API, an error you cannot explain, or a spec you do not know. State in your THOUGHT what you tried and what you need.
- After web_search, web_fetch ONLY the single most relevant URL, take what you need, then get back to building. Do NOT browse, and do NOT search for things you already know.

WORKED EXAMPLE (this is the rhythm to follow — explore, build, VERIFY, fix, finish):

  Step 1 — orient:
  THOUGHT: New project. See what exists before writing anything.
  ACTION: list_dir
  PATH: .

  Step 2 — build the smallest playable slice (one fenced block, real code):
  THOUGHT: Empty workspace. Create the entry point with the core loop wired up.
  ACTION: write_file
  PATH: index.html
  \`\`\`html
  <!doctype html><html><body><button onclick="tick()">Go</button><p id="out">0</p>
  <script>let n=0;function tick(){n++;document.getElementById('out').textContent=n;}</script>
  </body></html>
  \`\`\`

  Step 3 — VERIFY by actually running it (required for web apps):
  THOUGHT: Wrote the app; run it in a browser to catch errors before finishing.
  ACTION: test_web
  PATH: index.html

  Step 4 — only after a CLEAN test:
  THOUGHT: test_web reported no errors and the counter updates. Goal met.
  ACTION: finish
  SUMMARY: A one-button counter that increments and displays the count.

BUILDING APPS (IMPORTANT):
- Default to a WEB APP that opens in a browser, unless the user clearly asks for something else.
- Use plain HTML, CSS, and JavaScript with NO build tools and NO frameworks that need installing.
- The entry point MUST be a file named index.html that works by simply opening it (all logic client-side).
- Put markup in index.html, styles in style.css, logic in script.js (link them from index.html).
- For 3D graphics or 3D games, use three.js (no install) via an ES-module import map in index.html, since the app is served over http:
    <script type="importmap">{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }</script>
    <script type="module">import * as THREE from 'three'; /* scene, camera, renderer, animate loop */</script>
  Set up a Scene, a PerspectiveCamera, and a WebGLRenderer (append renderer.domElement to the page); animate with requestAnimationFrame and handle window resize. Keep everything client-side; it still opens via index.html.
- Only use run_command / a server for things that genuinely need it (e.g. a Python data script).

WORKING THROUGH A LONG BUILD — the task ledger:
- Your context only holds the last few messages. TASKS.md is what stops you losing track, and it is shown to you before EVERY step, so it is always current.
- At the start, task_add the work the goal needs — one line per task. Keep them concrete ("draw the paddle and move it with the arrow keys"), not vague ("do the UI").
- Work the list top to bottom. The moment something WORKS, task_done it. Do not batch this up for the end — if the run stops early, the ledger is the only record of where you got to.
- When you discover work the plan missed, task_add it rather than trying to hold it in your head.
- Do not call finish while tasks remain unfinished. If a task turns out to be unnecessary, say so in your THOUGHT and task_done it deliberately.

VERIFY BEFORE FINISHING — this is required, and what counts as proof depends on what you built:
- WEB APP (index.html): run test_web. It opens the app in a real browser, clicks the controls, and reports JS errors plus the on-screen text.
  - Any [JS ERROR], [console.error], or [failed load] = a real bug. Fix the file(s) and run test_web again.
  - Check the VISIBLE TEXT for wrong values or dead features (e.g. it shows "$0" after selling, a counter never changes, a button did nothing). Those are logic bugs — fix them and test_web again.
- ANY GAME OR VISUAL APP: also run see_screen. test_web cannot tell "works" from "runs cleanly and draws nothing" — a blank canvas throws no error. see_screen can. A blank canvas is a BUG, not a pass.
- EVERYTHING ELSE (Python, Node, a CLI, Godot): run verify_project. It compiles your sources and actually runs the thing. A project you have never executed is not finished, no matter how correct it looks.
- Only call finish once the checks for YOUR kind of project come back clean.

CORRECTNESS RULES (avoid the common bugs):
- Every variable and function you reference must be defined somewhere.
- When you change a value AND report it, compute the report BEFORE changing the value.
- Any UI label that implies state (money, $, counts, score) must have a backing variable that is updated AND shown on screen.
- Trace every clickable control to its handler, and every handler to its full, correct effect.
- Build the SIMPLEST fully-working version first; don't add features that aren't wired up.
- Put your <script> at the END of <body> (or wrap DOM code in a DOMContentLoaded handler) so every element exists before your JS runs — this avoids "Cannot read properties of null".
- Prefer wiring buttons with onclick="fn()" attributes (functions defined in the script) over addEventListener on elements fetched at load time.`;

// Parse one plain-text action from a model response. File content lives in a raw
// fenced code block (never JSON), so quotes/backslashes/escape-sequences survive
// intact — the thing that broke JSON-string encoding on smaller models.
function parseAction(text, lastPath) {
  if (!text) return null;
  const thought = (text.match(/THOUGHT:\s*(.+)/i)?.[1] || '').trim();
  const fenceM = text.match(/```([^\n]*)\n([\s\S]*?)```/);
  const fenceLang = fenceM ? fenceM[1].trim().toLowerCase() : '';
  const fenced = fenceM ? fenceM[2].replace(/\n$/, '') : undefined;
  const pathM = text.match(/PATH:\s*(.+)/i);
  let path = pathM ? pathM[1].trim().replace(/[`"']/g, '') : undefined;
  // if no PATH given, try a filename mentioned anywhere in the text
  if (!path) { const fm = text.match(/\b([\w.\-/]+\.(?:html|css|js|py|json|md|txt))\b/i); if (fm) path = fm[1]; }

  const langFile = { html: 'index.html', css: 'style.css', js: 'script.js', javascript: 'script.js', python: 'main.py', py: 'main.py' };
  const am = text.match(/ACTION:\s*([a-z_]+)/i);
  let tool = am ? am[1].toLowerCase() : null;

  // Forgiving fallback: small models often "fix" a file by just pasting a code
  // block with no ACTION header — treat any lone code block as a write_file.
  if (!tool && fenced !== undefined) tool = 'write_file';
  if (!tool) return null;

  if (tool === 'write_file') {
    if (!path) path = langFile[fenceLang] || lastPath || 'index.html';
    return { tool, thought, args: { path, content: fenced ?? '' } };
  }
  if (tool === 'edit_file') {
    const findM = text.match(/FIND:\s*```[^\n]*\n([\s\S]*?)```/i);
    const replM = text.match(/REPLACE:\s*```[^\n]*\n([\s\S]*?)```/i);
    return { tool, thought, args: { path: path || lastPath, find: findM?.[1]?.replace(/\n$/, ''), replace: replM ? replM[1].replace(/\n$/, '') : '' } };
  }
  if (tool === 'run_command') {
    const cmd = (text.match(/COMMAND:\s*(.+)/i)?.[1]?.trim()) || (fenced ? fenced.trim().split('\n')[0] : undefined);
    return { tool, thought, args: { cmd } };
  }
  if (tool === 'run_python') {
    return { tool, thought, args: { code: fenced, path } };   // inline CODE block, or a .py PATH
  }
  if (tool === 'web_search') {
    const query = (text.match(/QUERY:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { query } };
  }
  if (tool === 'web_fetch') {
    const url = (text.match(/URL:\s*(\S+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    return { tool, thought, args: { url } };
  }
  // download_file needs BOTH a URL and a destination. Without its own branch it fell
  // through to the generic PATH handler, arrived with url undefined, and could never
  // run - enabled and documented but silently unusable.
  if (tool === 'remember') {
    const t = (text.match(/TEXT:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]+:/)[0].trim();
    return { tool, thought, args: { text: t } };
  }
  if (tool === 'recall') return { tool, thought, args: {} };
  if (tool === 'git_diff')   return { tool, thought, args: { ref: (text.match(/REF:\s*(\S+)/i)?.[1] || '').trim() || undefined } };
  if (tool === 'git_log')    return { tool, thought, args: { n: (text.match(/N:\s*(\d+)/i)?.[1] || '').trim() || undefined } };
  if (tool === 'git_commit') return { tool, thought, args: { message: (text.match(/MESSAGE:\s*(.+)/i)?.[1] || '').trim() } };
  if (tool === 'git_undo')   return { tool, thought, args: { sha: (text.match(/SHA:\s*(\S+)/i)?.[1] || '').trim() || undefined, hard: /HARD:\s*true/i.test(text) } };
  if (tool === 'download_file') {
    const url = (text.match(/URL:\s*(\S+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    const dest = (text.match(/PATH:\s*(.+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    return { tool, thought, args: { url, path: dest } };
  }
  if (tool === 'finish') {
    const summary = (text.match(/SUMMARY:\s*([\s\S]+)/i)?.[1] || '').trim();
    return { tool, thought, args: { summary } };
  }
  // Ledger + verification + delegation. Each needs its own branch for the same reason
  // download_file did: without one they fall through to the generic PATH handler, arrive
  // with their real argument undefined, and are silently unusable.
  if (tool === 'task_list') return { tool, thought, args: {} };
  if (tool === 'task_add') {
    const t = (text.match(/TEXT:\s*([\s\S]+)/i)?.[1] || fenced || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { text: t } };
  }
  if (tool === 'task_done') {
    // WHICH: 3, or a fragment of the title - the model produces both.
    const w = (text.match(/WHICH:\s*(.+)/i)?.[1] || text.match(/TASK:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { which: w } };
  }
  if (tool === 'see_screen') return { tool, thought, args: { path: path || 'index.html' } };
  if (tool === 'verify_project') return { tool, thought, args: { entry: path || undefined } };
  if (tool === 'spawn_subtask') {
    const g = (text.match(/GOAL:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { goal: g } };
  }
  if (tool === 'queue_task') {
    const g = (text.match(/GOAL:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { goal: g } };
  }
  if (tool === 'list_assets') {
    const filter = (text.match(/FILTER:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { filter } };
  }
  // Google tools parse their own fields (see googleTools.js) - each has a different shape
  // and gmail_send's BODY is multi-line, which the generic PATH handler would truncate to
  // its first line and send anyway.
  if (GOOGLE_TOOLS.includes(tool)) return { tool, thought, args: parseGoogleArgs(tool, text, fenced) };
  if (tool === 'test_web') return { tool, thought, args: { path: path || 'index.html' } };
  if (tool === 'search_file') {
    const query = (text.match(/QUERY:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { path, query } };   // path optional — omit = search all files
  }
  if (tool === 'read_file') {
    let offset, limit;
    const lm = text.match(/LINES:\s*(\d+)\s*-\s*(\d+)/i);
    if (lm) { offset = +lm[1]; limit = (+lm[2] - +lm[1]) + 1; }
    else {
      const om = text.match(/OFFSET:\s*(\d+)/i); if (om) offset = +om[1];
      const li = text.match(/LIMIT:\s*(\d+)/i);  if (li) limit = +li[1];
    }
    return { tool, thought, args: { path: path || '.', offset, limit } };
  }
  if (tool === 'outline_file') return { tool, thought, args: { path: path || '.' } };
  if (tool === 'list_dir') return { tool, thought, args: { path: path || '.' } };
  return { tool, thought, args: {} };
}

// ── Run state (in-memory, mirrored to disk) ───────────────────────────────────
// The Map is the live copy; each run is also checkpointed to agent-runs/<id>.json
// so a dropped tunnel or a server restart never loses an in-progress build.
const runs = new Map();

// Runs used to live forever: no delete, no TTL, no cap. Each holds up to MAX_STEPS
// steps with tool outputs of 8-14KB, so ~150-250KB apiece - fine for a demo, a slow
// leak for a hub that is meant to stay running for days. Evict finished runs oldest
// first, and never evict one that is still running or waiting on a human.
const MAX_RUNS = parseInt(process.env.AGENT_MAX_RUNS || '40', 10);
function evictOldRuns() {
  if (runs.size <= MAX_RUNS) return;
  const finished = [...runs.values()]
    .filter(r => r.status !== 'running' && r.status !== 'awaiting_approval')
    .sort((a, b) => a.createdAt - b.createdAt);
  let over = runs.size - MAX_RUNS;
  for (const r of finished) {
    if (over-- <= 0) break;
    runs.delete(r.id);
    try { const f = join(RUNS_DIR, `${r.id}.json`); if (existsSync(f)) unlinkSync(f); } catch {}
  }
}
const RUNS_DIR = join(__dirname, 'agent-runs');

function pushStep(run, step) {
  run.steps.push({ n: run.steps.length + 1, ts: Date.now(), ...step });
}

// Write the full run (incl. history) to disk. abort is an AbortController (not
// serializable) and busy is transient — both are rebuilt on resume, so drop them.
function persist(run) {
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    const { abort, busy, ...save } = run;
    writeFileSync(join(RUNS_DIR, `${run.id}.json`), JSON.stringify(save));
  } catch {}
}

// Restore checkpointed runs on boot. Anything caught mid-flight (the process died
// while it was running/awaiting) becomes 'interrupted' so the UI can offer Resume.
function loadRuns() {
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    for (const name of readdirSync(RUNS_DIR)) {
      if (!name.endsWith('.json')) continue;
      try {
        const run = JSON.parse(readFileSync(join(RUNS_DIR, name), 'utf8'));
        run.busy = false; run.abort = null;
        if (['running', 'awaiting_approval'].includes(run.status)) run.status = 'interrupted';
        runs.set(run.id, run);
        evictOldRuns();
      } catch {}
    }
  } catch {}
}

// A model call that failed because the tunnel/Ollama is unreachable — NOT a real
// agent error. These are resumable once the tunnel is back, so we pause (not kill).
function isConnError(e) {
  const s = `${e?.name} ${e?.message} ${e?.cause?.code || ''}`;
  // Network/tunnel failures AND Cloudflare/gateway pages (524/502/503) or a
  // timed-out reply — all are "tunnel down / too slow", i.e. resumable once the
  // tunnel is re-pointed, NOT a real agent error that should kill the run.
  return /TimeoutError|AbortError|fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|network|socket hang up|timed out|tunnel may be down|Model error 5\d\d|Model error 429|Premature close|terminated|stream failed|cloudflare|<!doctype|<html|gateway/i.test(s);
}

/**
 * What actually went wrong, and what the person should do about it.
 *
 * Every paused run used to say "Re-point the Ollama tunnel in Settings" no matter what.
 * Measured 2026-09-09: two runs on OPENROUTER were rate-limited (429) and both told the
 * user to go fix an Ollama tunnel that was not involved, for a problem no tunnel change
 * could fix. A wrong remedy is worse than none - it sends someone to change working
 * configuration while the real cause (too many concurrent runs on a free key) persists.
 *
 * So the message names the provider actually in use, and the cause actually seen.
 */
function pauseAdvice(e) {
  const provider = (process.env.AGENT_PROVIDER || 'ollama').toLowerCase();
  const s = `${e?.name} ${e?.message} ${e?.cause?.code || ''}`;
  const where = provider === 'ollama' ? 'the model' : provider;

  if (/Model error 429|rate.?limit|too many requests/i.test(s)) {
    // A per-DAY cap and a per-minute throttle both arrive as 429 and need opposite
    // advice. Measured 2026-09-09: OpenRouter's free tier is 50 requests per DAY, which a
    // single burst of concurrent runs spends entirely - telling someone to "wait and
    // Resume" then leaves them retrying against a wall until the quota resets.
    if (/per.?day|daily/i.test(s)) {
      return `this key's DAILY free allowance is gone, not a temporary throttle — Resume will keep failing until it resets. `
           + `Switch provider (AGENT_PROVIDER) or add credits. An agent run costs roughly 8-15 model calls, so a 50/day tier is about four runs.`;
    }
    return `${where} is throttling this key. Nothing is misconfigured — wait a minute, then Resume. `
         + `Concurrent runs are the usual cause: a free tier will not carry several at once.`;
  }
  if (/Model error 5\d\d|cloudflare|<!doctype|<html|gateway/i.test(s)) {
    return `${where} answered with a server error rather than a completion. Usually transient — Resume in a minute.`;
  }
  if (/TimeoutError|timed out|AbortError/i.test(s)) {
    return `${where} did not answer in time. Resume to retry`
         + (provider === 'ollama' ? '; if this repeats, the model may be too large for this machine.' : '.');
  }
  return provider === 'ollama'
    ? 'the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume.'
    : `${where} is unreachable. Check the base URL and key in Settings, then Resume.`;
}

// Keep the model's context dense: preserve the anchors it must never forget —
// system prompt, the goal+file listing, and the BUILD PLAN — plus the most recent
// exchanges, and trim the stale middle (old read_file/test_web dumps). Without this,
// long runs grow unbounded and Ollama silently drops the oldest (goal-bearing) messages.
function pruneHistory(run) {
  const h = run.history;
  if (h.length <= MAX_HISTORY_MSGS) return;
  // Preserve by MARKER, not by index. NOTES.md is injected at the start when it exists,
  // which shifted the goal from h[1] to h[2] - an index-based head silently pruned the
  // goal and left the agent working from notes with no objective.
  const head = [h[0]];                                    // system prompt
  const goal = h.find(m => m.role === 'user' && /GOAL:/.test(m.content || ''));
  if (goal && !head.includes(goal)) head.push(goal);
  const notes = h.find(m => m.role === 'user' && /^Your notes from earlier work/.test(m.content || ''));
  if (notes && !head.includes(notes)) head.push(notes);
  const plan = h.find(m => m.role === 'assistant' && /^BUILD PLAN:/.test(m.content || ''));
  if (plan && !head.includes(plan)) head.push(plan);
  if (head.length === 1 && h[1]) head.push(h[1]);        // fallback: no marker found
  const tail = h.slice(-(MAX_HISTORY_MSGS - head.length - 1));
  const dropped = h.length - head.length - tail.length;
  if (dropped <= 0) return;                 // nothing meaningful to trim
  run.history = [
    ...head,
    { role: 'user', content: `(… ${dropped} earlier steps trimmed to save context. The GOAL and PLAN above still stand — keep following them. Recent steps follow.)` },
    ...tail,
  ];
}

/**
 * Append the live task ledger to the messages for ONE call.
 *
 * Why not push it into run.history like everything else: history is pruned, and a
 * pinned message is exactly the kind of thing pruning is bad at - it either survives as
 * a stale step-1 snapshot or gets dropped for being old. Building it per call sidesteps
 * both. It costs a few dozen tokens per step and it is the difference between an agent
 * that knows what it has finished and one that guesses.
 */
function withLedger(history) {
  const extra = [];
  // Google tool docs ride along only while an account is actually connected. Documenting
  // gmail_send to a model that has no token spends context teaching it a tool whose every
  // call returns "not connected", and invites it to plan a run around one.
  if (googleReady()) extra.push({ role: 'user', content: `GOOGLE ACCOUNT TOOLS (an account is connected):\n${GOOGLE_TOOL_DOCS}` });
  let block;
  try { block = ledger.contextBlock(WORKSPACE); } catch { block = null; }
  if (block) extra.push({ role: 'user', content: block });
  // The asset library SUMMARY rides along the same way, for the same reason: it has to
  // survive pruning. It is a handful of lines - the full listing is a tool call away.
  let lib;
  try { lib = assetLib.contextBlock(); } catch { lib = null; }
  // The canonical vocabulary rides with it. These names ALWAYS resolve (a generated
  // placeholder stands in until real art arrives under the same name), so a model that
  // prefers them writes games that verify in every library, not just this one.
  let canon;
  try { canon = canonicalSummary(); } catch { canon = null; }
  if (lib) extra.push({ role: 'user', content: canon ? `${lib}\n${canon}` : lib });
  return extra.length ? [...history, ...extra] : history;
}

// ── Plan-first gate (Stage 1) ─────────────────────────────────────────────────
const PLANNER_SYSTEM = 'You are a senior game/software architect. You produce a short, concrete BUILD PLAN. You do NOT write code.';
const PLAN_TASK = `Before any code is written, produce a BUILD PLAN for the goal above. Do NOT write code. Be concise — a numbered list.

1. SYSTEMS NEEDED — the distinct systems required (e.g. input, player, physics, inventory, save, UI).
2. GAMEPLAY LOOP — what the user/player does moment to moment, and the win/lose/end condition.
3. STATE / DATA — the key state each system owns; note any state machine (e.g. crop: untilled -> tilled -> growing -> harvestable -> dead).
4. MISSING / REQUIRED — anything the goal implies but does not spell out (data, UI, save data, balancing values).
5. BUILD ORDER — the smallest first-PLAYABLE slice, then what to add after.

Output ONLY the plan.`;

// Append a (goal -> plan -> code) trace for later v0.3 training. Lives OUTSIDE the
// workspace so a "New project" reset never wipes it.
function saveTrace(run) {
  if (run.traced) return;
  run.traced = true;
  try {
    const dir = join(__dirname, 'agent-traces');
    mkdirSync(dir, { recursive: true });
    const code = run.steps
      .filter(s => s.tool === 'write_file' || s.tool === 'edit_file')
      .map(s => ({ tool: s.tool, path: s.args?.path, content: String(s.args?.content ?? s.args?.replace ?? '').slice(0, 30_000) }));
    const rec = {
      ts: Date.now(), status: run.status, goal: run.goal, plan: run.plan || null,
      followups: run.followups || [],   // later instructions that built on the first
      steps: run.steps.map(s => ({ type: s.type, tool: s.tool, path: s.args?.path })),
      code,
    };
    appendFileSync(join(dir, 'traces.jsonl'), JSON.stringify(rec) + '\n');
  } catch {}
}

// Sub-tasks need to call the model, and the tools table has no database handle.
// drive() parks the current one here rather than threading it through every signature.
let _loadDb = null;
// The run currently executing a tool. Sub-tasks need a handle on their parent to push
// progress steps into it; routing that through the tool ARGS created a cycle
// (run -> steps -> args -> run) that made the run unserialisable.
let _activeRun = null;

/**
 * Run a self-contained sub-task in a FRESH context, and hand back a summary.
 *
 * This is the answer to the context ceiling. The parent's window is finite; a sub-task
 * starts empty, does one bounded job against the same real files, and returns a few
 * lines instead of the twenty steps it took. The parent pays summary-sized context for
 * work that would otherwise have filled its window.
 *
 * The honest cost: the summary is LOSSY. The parent never sees what the sub-task saw,
 * so a wrong decision inside it surfaces as a confident sentence with no way to check
 * it. Sub-tasks are for work that is genuinely separable, not for cramming.
 *
 * It deliberately does NOT handle approvals. A sub-task that needs a human stops and
 * says so, and the parent (which has the run, the UI and the human) does that step
 * itself. Nesting approval state inside a nested run buys nothing and can deadlock.
 */
async function runSubtask(goal, depth, parent) {
  if (!_loadDb) return 'ERROR: sub-tasks are unavailable (no model connection).';
  ensureWorkspace();
  const started = Date.now();
  const sub = {
    id: `${parent ? parent.id.slice(0, 8) : 'sub'}-${randomUUID().slice(0, 4)}`,
    goal, depth, status: 'running', modelCalls: 0, steps: [],
    createdAt: started, budgetStart: started, maxSteps: SUBTASK_MAX_STEPS,
    history: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content:
        `You are a SUB-AGENT. You have been given ONE self-contained job, not the whole project.\n\n`
        + `Files currently in the workspace (these are the ONLY files — use these EXACT names):\n${tools.list_dir({ path: '.' })}\n\n`
        + `GOAL: ${goal}\n\n`
        + `Do exactly this and nothing more. Do not redesign anything outside it. When it is done, `
        + `ACTION: finish with a SUMMARY that states what you changed, which files, and anything the `
        + `parent agent must know — that summary is ALL it will see of your work.` },
    ],
  };
  if (parent) pushStep(parent, { type: 'subtask_start', text: `sub-task (depth ${depth}): ${goal.slice(0, 120)}` });

  const done = [];
  let summary = null;
  while (sub.status === 'running' && sub.modelCalls < SUBTASK_MAX_STEPS) {
    sub.modelCalls++;
    pruneHistory(sub);
    let raw;
    try { raw = await callModel(_loadDb, withLedger(sub.history), null); }
    catch (e) { summary = `sub-task failed to reach the model: ${e.message}`; break; }
    sub.history.push({ role: 'assistant', content: raw });

    const action = parseAction(raw, sub.lastPath);
    if (!action || !action.tool || (!tools[action.tool] && action.tool !== 'finish')) {
      sub.history.push({ role: 'user', content: 'Your last response had no valid ACTION. Reply with a THOUGHT line, an ACTION line, then its fields.' });
      continue;
    }
    const { tool, args = {} } = action;
    if (tool === 'finish') { summary = args.summary || '(no summary given)'; sub.status = 'done'; break; }

    // A sub-task never spawns another: depth is enforced here as well as in the tool,
    // because this is the path that actually recurses.
    if (tool === 'spawn_subtask') {
      sub.history.push({ role: 'user', content: 'You are already a sub-task. Do this work yourself instead of delegating it.' });
      continue;
    }
    if (!AUTO_TOOLS.has(tool)) {
      const v = tool === 'run_command' ? classifyCommand(args.cmd) : tool === 'run_python' ? classifyPython() : { decision: 'ask', reason: 'needs a human' };
      if (v.decision !== 'allow') {
        summary = `STOPPED: this sub-task needs "${tool}" (${args.cmd || args.path || ''}) which ${v.decision === 'deny' ? 'is refused' : 'needs approval'} — ${v.reason}. `
          + `Work completed so far: ${done.join('; ') || 'none'}. Do that step yourself in the parent run.`;
        sub.status = 'stopped';
        break;
      }
    }
    let result;
    try { result = await tools[tool](args); } catch (e) { result = `ERROR: ${e.message}`; }
    if (tool === 'write_file' || tool === 'edit_file') { sub.lastPath = args.path; done.push(`${tool} ${args.path}`); }
    if (parent) pushStep(parent, { type: 'subtask_step', tool, args, text: `  ↳ ${tool} ${args.path || args.cmd || ''}`.slice(0, 160) });
    sub.history.push({ role: 'user', content: `TOOL RESULT (${tool}):\n${result}` });
  }

  if (!summary) summary = `sub-task ran out of budget after ${sub.modelCalls} steps. Work completed: ${done.join('; ') || 'none'}.`;
  const secs = Math.round((Date.now() - started) / 1000);
  if (parent) {
    pushStep(parent, { type: 'subtask_done', text: `sub-task ${sub.status} in ${sub.modelCalls} steps / ${secs}s` });
    parent.tokens = (parent.tokens || 0) + (sub.tokens || 0);
  }
  return `SUB-TASK RESULT (${sub.status}, ${sub.modelCalls} steps, ${secs}s)\n${summary}\n\n`
    + `Files it touched: ${done.length ? [...new Set(done)].join(', ') : 'none'}.\n`
    + `You did NOT see its steps — if you need to be sure of something it claims, check the file yourself.`;
}

// Drive the loop until it finishes, errors, hits the step ceiling, or needs
// approval. Auto-tools execute inline; run_command pauses the run.
async function drive(loadDb, run) {
  if (run.busy) return;
  run.busy = true;
  _loadDb = loadDb;          // sub-tasks call the model through this
  try {
    // ── Stage 1: PLAN-FIRST GATE — a build plan is produced before ANY code (runs once) ──
    if (!run.planned && run.status === 'running') {
      run.planned = true;
      run.abort = new AbortController();
      try {
        const planner = loadDb().api_keys?.ollama_planner;   // optional: a stronger/base model just for planning
        const planText = await callModel(loadDb, [
          { role: 'system', content: PLANNER_SYSTEM },
          { role: 'user', content: `${run.history[1]?.content || ('GOAL: ' + run.goal)}\n\n${PLAN_TASK}` },
        ], run.abort.signal, planner);
        if (planText && planText.trim()) {
          run.plan = planText.trim();
          pushStep(run, { type: 'plan', text: run.plan });
          // Turn the plan into a CHECKLIST. The plan is written once and never updated,
          // so on its own it says what to build but never what is done. Only seed when
          // the ledger is empty - a follow-up must not wipe the progress already made.
          try {
            if (!ledger.read(WORKSPACE).length) {
              const items = ledger.fromPlan(run.plan);
              if (items.length) {
                ledger.seed(WORKSPACE, items);
                pushStep(run, { type: 'note', text: `Task ledger seeded with ${items.length} item(s) from the plan.` });
              }
            }
          } catch { /* the ledger is a helper, never a reason to fail planning */ }
          run.history.push(
            { role: 'assistant', content: `BUILD PLAN:\n${run.plan}` },
            { role: 'user', content: 'Good. Now BUILD it with the tools, following the plan — the smallest PLAYABLE slice FIRST, then extend. One action per step.' },
          );
        }
      } catch (e) {
        if (run.status === 'stopped') return;   // stop aborted planning — exit (finally resets busy)
        if (isConnError(e)) {                    // tunnel down before we even planned — pause as resumable
          run.planned = false;                   // so Resume re-plans instead of silently skipping the plan
          run.status = 'interrupted';
          pushStep(run, { type: 'error', text: `Run paused during planning — ${pauseAdvice(e)} (${e.message})` });
          return;
        }
        pushStep(run, { type: 'error', text: `Planning step skipped: ${e.message}` });  // don't kill the run
      } finally {
        run.abort = null;
      }
    }

    while (run.status === 'running' && !budgetExhausted(run)) {
      run.modelCalls++;
      pruneHistory(run);                 // keep context dense before each model call
      let raw;
      run.abort = new AbortController();
      // The ledger is appended to the messages for THIS call only — never pushed into
      // run.history. Two consequences, both wanted: pruneHistory cannot drop it (it was
      // never in the history), and it is always the CURRENT state rather than a stale
      // copy taken at step 1.
      const msgs = withLedger(run.history);
      try {
        raw = await callModel(loadDb, msgs, run.abort.signal);
      } catch (e) {
        if (run.status === 'stopped') break;        // Stop aborted the call — exit quietly
        if (isConnError(e)) {                        // tunnel/Ollama unreachable — pause (resumable), don't kill
          run.status = 'interrupted';
          pushStep(run, { type: 'error', text: `Run paused at step ${run.modelCalls} — ${pauseAdvice(e)} (${e.message})` });
          break;
        }
        run.status = 'error';
        pushStep(run, { type: 'error', text: e.message });
        break;
      } finally {
        run.abort = null;
      }
      if (run.status !== 'running') break;            // stopped during the call — don't run another step
      run.tokens = (run.tokens || 0) + estimateTokens(msgs, raw);
      run.history.push({ role: 'assistant', content: raw });

      // Stuck-loop guard.
      //
      // The old check compared only against the PREVIOUS response, so a model that
      // alternates - A, B, A, B - reset the counter every step and ran to the 30-step
      // ceiling. Two-cycles are one of the most common ways an agent loops, and for an
      // unattended run nobody is watching to kill it.
      //
      // Now: remember a window of recent responses and stop when the same one comes
      // back too often, regardless of what sat between.
      const norm = raw.replace(/\s+/g, ' ').trim().slice(0, 2000);
      run.recent = run.recent || [];
      run.recent.push(norm);
      if (run.recent.length > 8) run.recent.shift();
      const seenTimes = run.recent.filter((r) => r === norm).length;
      if (seenTimes >= 3) {
        run.status = 'stopped';
        pushStep(run, { type: 'error', text: `Stopped: the model produced the same response ${seenTimes} times in the last ${run.recent.length} steps without making progress.` });
        break;
      }

      const action = parseAction(raw, run.lastPath);
      if (!action || !action.tool || !tools[action.tool] && action.tool !== 'finish') {
        run.parseLog = (run.parseLog || []).concat(false).slice(-10);
        if (run.parseLog.filter((ok) => !ok).length >= 5) {
          run.status = 'error';
          pushStep(run, { type: 'error', text: `Gave up: ${run.parseLog.filter((ok) => !ok).length} of the last ${run.parseLog.length} responses could not be parsed.` });
          break;
        }
        pushStep(run, { type: 'error', text: 'Could not parse an action; asking the model to retry.' });
        run.history.push({ role: 'user', content: 'Your last response did not contain a valid ACTION. Reply using the exact plain-text format: a THOUGHT line, an ACTION line, then its fields (file content in a single fenced code block, written normally).' });
        continue;
      }
      // A WINDOW, not a streak. A plain counter reset to zero on every success, so a
      // model alternating valid/invalid never gave up - and decaying by one per success
      // cancels exactly, which fails the same way (verified: both let A,B,A,B run to the
      // ceiling). Counting failures within the last 10 responses catches a persistently
      // half-broken model while tolerating the occasional bad parse.
      run.parseLog = (run.parseLog || []).concat(true).slice(-10);

      const { tool, args = {}, thought = '' } = action;

      // AUTO-CHECKPOINT before anything destructive.
      //
      // The agent cannot be relied on to commit at the right moment, and the whole point
      // of history is that it exists when you did NOT plan to need it. Committing the
      // state BEFORE each mutating step means every bad edit has a restore point, so a
      // run can be let loose and still be recoverable.
      //
      // Read-only tools are skipped: committing before list_dir would bury the log in
      // noise and make the history useless for finding the change that mattered.
      const MUTATING = new Set(['write_file', 'edit_file', 'run_command', 'run_python', 'download_file']);
      if (MUTATING.has(tool)) {
        try {
          if (await isDirty(WORKSPACE)) {
            const cp = await commitAll(WORKSPACE, `before ${tool}: ${(thought || '').slice(0, 80)}`);
            if (cp.ok && cp.sha) pushStep(run, { type: 'checkpoint', text: `checkpoint ${cp.sha}` });
          }
        } catch { /* never let bookkeeping stop the run */ }
      }

      if (tool === 'finish') {
        // ── The finish gate ────────────────────────────────────────────────────
        // It used to ask one question: does index.html exist and has it been browser-
        // tested? So a web app was held to a real standard and a Python script, a CLI,
        // or a Godot project was held to none — any of them could be declared DONE
        // having never been executed once.
        //
        // Now the gate asks what KIND of thing this is and demands the matching proof.
        // Still capped at 3 blocks: a gate that can never be satisfied is a hang, and a
        // stuck run is worse than an imperfect one.
        const blocked = (why, instruction) => {
          run.finishBlocks = (run.finishBlocks || 0) + 1;
          pushStep(run, { type: 'error', thought, text: why });
          run.history.push({ role: 'user', content: instruction });
        };

        if ((run.finishBlocks || 0) < 3) {
          const hasWeb = existsSync(join(WORKSPACE, 'index.html'));

          // 1. unfinished work on the ledger
          const p = ledger.progress(WORKSPACE);
          // Plan-seeded tasks are a SUGGESTION, not a commitment.
          //
          // The plan-first gate writes a ledger before the agent has done anything, and
          // the finish gate then treated those entries as binding. Measured tonight: a
          // free model was handed 15 plan tasks and spent 10 steps closing them; three
          // separate scripted tests ended `stopped` instead of `done` because the agent
          // finished its actual work and was blocked on entries it never chose. One of
          // those blocked the supervisor from ever firing.
          //
          // So: the agent must close what IT committed to via task_add. A list the
          // planner proposed and the agent never adopted does not block finishing - it
          // is reported instead, so nothing is silently dropped.
          // Tasks CARRIED OVER from an earlier run in this workspace are the same story:
          // this run never agreed to them, so they are reported, not enforced. Without
          // that, serializing runs meant every run inherited the last one's leftovers
          // and could not finish.
          const advisory = ledger.isPlanSeeded(WORKSPACE);
          if (advisory && p.remaining > 0) {
            pushStep(run, { type: 'note',
              text: `Finished with ${p.remaining} suggested task(s) from the build plan left open — they were proposals, not commitments.` });
          } else if (p.carried > 0) {
            pushStep(run, { type: 'note',
              text: `Finished. ${p.carried} task(s) left over from earlier work in this workspace are still open — they were not part of this goal.` });
          }
          if (!advisory && p.total && p.remainingOwn > 0) {
            blocked(`${p.remainingOwn} task(s) still open — not finished yet.`,
              `Do NOT finish yet — ${p.remainingOwn} of ${p.total} tasks on your ledger are not done:\n${ledger.contextBlock(WORKSPACE)}\n`
              + `Either complete them, or if one is genuinely unnecessary say why and task_done it. Then finish.`);
            continue;
          }

          // 2. web apps: a browser test since the last edit.
          //    Gated on touchedWeb, not merely "index.html exists" — otherwise a Node or
          //    Python build in a workspace that once held a web app is blocked forever.
          if (hasWeb && run.touchedWeb && run.needsTest) {
            blocked('Verifying in a browser before finishing…',
              'Do NOT finish yet — you changed files since the last clean browser test. Run test_web, read the report, fix any [JS ERROR]/console errors or wrong on-screen values, and only finish once test_web is clean.');
            continue;
          }

          // 3. anything visual: is there actually something on the screen? test_web
          //    reads the console, so "no errors, blank canvas" passes it clean.
          if (hasWeb && run.touchedWeb && !run.sawScreen) {
            // The flag is set only when the check PASSES.
            //
            // It used to be set BEFORE the check, so a FAILING check was never re-run:
            // call finish, get blocked, call finish again and the gate was skipped
            // entirely. A one-shot gate that a second attempt walks straight past is not
            // a gate. finishBlocks (capped at 3) is what stops this looping.
            try {
              const r = await visual.inspect(`http://localhost:${PORT}/workspace/index.html`,
                { saveTo: join(WORKSPACE, '.screenshots'), label: 'finish' });
              if (r.ok && visual.hasProblems(r)) {
                blocked('The page renders, but something is wrong with what is on screen.',
                  `Do NOT finish yet — the app loads without errors but it does not LOOK right:\n\n${r.report}\n\nFix these, then finish.`);
                continue;
              }
              if (r.ok) {
                run.sawScreen = true;   // passed — no need to launch a browser again
                pushStep(run, { type: 'note', text: 'Visual check passed — content is actually on screen.' });
              }
            } catch { /* an inspection failure must not block a good run */ }
          }

          // 4. everything else: it has to actually RUN
          if ((!hasWeb || !run.touchedWeb) && !run.verified) {
            // Same rule: only mark verified once it actually verifies.
            try {
              const v = await verifier.verify(WORKSPACE);
              if (!v.ok) {
                blocked(`Project does not run (${v.kind}) — not finished.`,
                  `Do NOT finish yet — the project does not run:\n\n${verifier.format(v)}\n\nFix these, then finish.`);
                continue;
              }
              run.verified = true;    // passed — do not pay for it again
              pushStep(run, { type: 'note', text: `Verified (${v.kind}): ${v.evidence.join('; ')}` });
            } catch { /* verification is evidence, not a gate that can hang a run */ }
          }
        }

        run.status = 'done';
        pushStep(run, { type: 'finish', thought, summary: args.summary || '' });
        break;
      }

      if (!tools[tool]) {
        pushStep(run, { type: 'error', thought, text: `Unknown tool: ${tool}` });
        run.history.push({ role: 'user', content: `TOOL ERROR: unknown tool "${tool}". Use only the listed tools.` });
        continue;
      }

      // ── Approval: three answers, not two ──────────────────────────────────────
      //
      // This used to be `if (!AUTO_TOOLS.has(tool)) wait for a human`. Which meant an
      // unattended run stopped dead on `npm install` and stayed stopped, because the
      // only alternative to asking was not gating at all.
      //
      // The policy layer classifies the actual command: allow it, refuse it with a
      // reason the model can act on, or ask. Refusing beats asking for the commands
      // that are never right, because "wake a human at 3am to approve rm -rf /" is
      // the mistake, not the safeguard.
      if (!AUTO_TOOLS.has(tool)) {
        const verdict = tool === 'run_command' ? classifyCommand(args.cmd)
          : tool === 'run_python' ? classifyPython()
          // Name what is about to happen to a real account, in the words of the thing it
          // affects. "gmail_send always needs a human" is not what you want to read at 3am;
          // "sends mail as you, to someone@example.com" is.
          : GOOGLE_WRITE_TOOLS.includes(tool) ? { decision: 'ask', reason: googleWriteReason(tool, args) }
          : { decision: 'ask', reason: `${tool} always needs a human` };

        if (verdict.decision === 'deny') {
          const msg = `REFUSED: ${verdict.reason}.`
            + (verdict.segment ? ` (the offending part: \`${verdict.segment}\`)` : '')
            + ' This will not be run under any approval mode. Achieve the goal another way.';
          pushStep(run, { type: 'policy_denied', tool, args, thought, text: msg });
          run.history.push({ role: 'user', content: `TOOL REFUSED (${tool}): ${msg}` });
          continue;                                   // keep working — do NOT halt
        }
        if (verdict.decision === 'ask') {
          run.pending = { tool, args, thought, why: verdict.reason };
          run.status = 'awaiting_approval';
          pushStep(run, { type: 'approval_request', tool, args, thought, why: verdict.reason });
          await escalate(WORKSPACE, {
            runId: run.id, goal: run.goal, status: run.status, reason: 'approval',
            detail: `${tool}: ${args.cmd || args.path || ''} — ${verdict.reason}`,
          });
          break;
        }
        // allow → fall through and run it, recording WHY it was allowed so the step
        // feed shows an auto-run command was a policy decision, not an ungated hole.
        pushStep(run, { type: 'policy_allowed', tool, args, thought, text: `auto-approved (${verdict.mode} mode: ${verdict.reason})` });
      }

      // Auto tool → execute inline
      // Nesting depth and the parent handle are supplied HERE rather than trusted from
      // the model's own arguments — otherwise a model could pass depth: 0 forever and
      // recurse without bound.
      // Depth is supplied here rather than trusted from the model. The parent is passed
      // through module scope - see spawn_subtask for why it must not go on args.
      if (tool === 'spawn_subtask') { args.depth = (run.depth || 0) + 1; _activeRun = run; }
      let result;
      try { result = await tools[tool](args); }
      catch (e) { result = `ERROR: ${e.message}`; }
      let syntaxNote = '';
      if (tool === 'write_file' || tool === 'edit_file') {
        run.needsTest = true; if (args.path) run.lastPath = args.path; // edited → needs a fresh test
        // Did this run touch WEB content specifically?
        //
        // The finish gate used to demand a browser test whenever index.html merely
        // EXISTED and any file had been written. So an agent that built calc.js in a
        // workspace containing a stale index.html from a previous project was blocked
        // forever, told to browser-test a page it had never touched. Found 2026-09-09
        // by driving the loop with a scripted model.
        if (args.path) {
          if (/\.html?$/i.test(args.path)) run.touchedWeb = true;
          else if (/\.(css|c?js|mjs)$/i.test(args.path)) {
            // A stylesheet or script counts only if the entry point actually loads it.
            try {
              const idx = join(WORKSPACE, 'index.html');
              if (existsSync(idx) && readFileSync(idx, 'utf8').includes(args.path.split('/').pop())) {
                run.touchedWeb = true;
              }
            } catch { /* unreadable entry point - leave the flag alone */ }
          }
        }
        const err = await quickCheck(args.path);
        if (err) syntaxNote = `\n\n❌ SYNTAX CHECK FAILED for ${args.path}:\n${err}\nFix this before doing anything else — it will not run as written.`;
        else if (/\.(py|c?js|mjs)$/i.test(args.path || '')) syntaxNote = `\n\n✅ ${args.path} passed a syntax check.`;
      }

      let feedback = `TOOL RESULT (${tool}):\n${result}${syntaxNote}`;
      if (tool === 'test_web') {
        const hasErr = /\[JS ERROR\]|\[console\.error\]|\[HTTP \d/.test(result);
        run.needsTest = hasErr;
        if (hasErr) {
          // signature of the JS error (digits stripped) to detect the SAME bug recurring
          const sig = (result.match(/\[JS ERROR\][^\n]*/)?.[0] || '').replace(/\d+/g, '').slice(0, 80);
          run.sameErr = sig && sig === run.lastErrSig ? (run.sameErr || 0) + 1 : 0;
          run.lastErrSig = sig;
          if (run.sameErr >= 4) {
            pushStep(run, { type: 'error', tool, args, thought, result, text: 'Same error persisted after several fix attempts — stopping. Likely a structural cause (script load order / id mismatch) that needs a stronger model or a manual fix.' });
            run.status = 'stopped';
            break;
          }
          if (run.sameErr >= 2) {
            feedback += `\n\n⚠️ This is the SAME error ${run.sameErr + 1} times. STOP rewriting the same file the same way. A null element means EITHER (a) your <script> runs before the DOM exists — move it to the very END of <body> or add defer; OR (b) an id used in your JS does not exist in index.html. READ index.html, then fix the <script> placement and make every getElementById id match a real element.`;
          }
        } else {
          // clean test — nudge it to FINISH instead of endlessly re-editing a working app
          run.sameErr = 0; run.lastErrSig = null;
          run.cleanTests = (run.cleanTests || 0) + 1;
          feedback += `\n\n✅ The app loaded with NO errors. If it fulfills the goal, call finish NOW (ACTION: finish with a SUMMARY). Do NOT keep editing a working app.`;
          if (run.cleanTests >= 3) {
            pushStep(run, { type: 'tool', tool, args, thought, result });
            pushStep(run, { type: 'finish', thought: 'auto', summary: 'App passed browser tests with no errors (auto-finished after repeated clean tests).' });
            run.status = 'done';
            break;
          }
        }
      }
      pushStep(run, { type: 'tool', tool, args, thought, result });
      run.history.push({ role: 'user', content: feedback });
      persist(run);   // checkpoint after each completed step — a drop loses at most one step
    }

    const spent = budgetExhausted(run);
    if (run.status === 'running' && spent) {
      run.status = 'stopped';
      pushStep(run, { type: 'error', text: `Stopped: ran out of ${spent}. Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.` });
    }
  } finally {
    run.busy = false;
    if (['done', 'error', 'stopped'].includes(run.status)) saveTrace(run);
    persist(run);   // capture final/paused state (incl. 'interrupted' and 'awaiting_approval')

    // ── Tell someone ────────────────────────────────────────────────────────────
    // A run that gave up used to flip a status field and go quiet. Fine when a human
    // is watching the screen; useless at 4am, which is exactly when an unattended
    // agent stops. ESCALATIONS.md always; a webhook if one is configured.
    if (['error', 'stopped', 'interrupted'].includes(run.status)) {
      const last = [...run.steps].reverse().find((s) => s.type === 'error');
      const text = (last && last.text) || '';
      const reason = /budget/i.test(text) ? 'budget'
        : /same response/i.test(text) ? 'loop'
        : /could not be parsed/i.test(text) ? 'parse'
        : /Same error persisted/i.test(text) ? 'same_error'
        : run.status === 'interrupted' ? 'tunnel' : 'error';
      await escalate(WORKSPACE, { runId: run.id, goal: run.goal, status: run.status, reason, detail: text })
        .catch(() => {});

      // ── Don't leave the chain stranded ────────────────────────────────────────
      // The queue item was only ever completed on a clean finish, so a failed step
      // stayed 'taken' for good: invisible to dequeue, and re-queued on the next restart
      // by requeueOrphans as if nothing had happened. Everything behind it waited on an
      // id that could never reach 'done'. Record the failure, then splice in ONE repair
      // attempt and move the tail behind it, so the plan's order survives the stumble.
      if (!run.depth && run.queueItemId) {
        try { failQueueItem(loadDb, run, reason, text); } catch { /* never take a run down with the queue */ }
      }
    }

    // ── Take the next ticket ────────────────────────────────────────────────────
    // Every entry point was a human pressing something, so "autonomous" meant
    // autonomous within one goal and then idle. A finished run now pulls the next
    // queued item by itself.
    //
    // Only on a CLEAN finish, and never from inside a sub-task: moving on to the NEXT
    // goal after a failure compounds it instead of surfacing it. A failure takes the
    // other path above - one retry of the same goal, then it stops and waits for a human.
    if (supervisorEnabled && run.status === 'done' && !run.depth) {
      try {
        if (run.queueItemId) workQueue.complete(run.queueItemId, { status: 'done', runId: run.id });
        const next = workQueue.dequeue({ completedIds: completedQueueIds() });
        if (next) {
          const stop = supervisorBrake(next);
          if (stop) {
            // Put it back: this is "a human should look at this", not "throw the work away".
            workQueue.release(next.id);
            pushStep(run, { type: 'note', text: `Supervisor stopped: ${stop} The queue keeps "${next.goal.slice(0, 60)}" — start it from the queue panel to continue.` });
          } else {
            autoStarts.push(Date.now());
            pushStep(run, { type: 'note', text: `Supervisor: picking up the next queued goal (gen ${next.generation || 0}) — ${next.goal.slice(0, 100)}` });
            setTimeout(() => {
              try { startRun(loadDb, next.goal, { queueItemId: next.id, source: 'queue', generation: next.generation || 0 }); } catch {}
            }, 250);
          }
        }
      } catch { /* the queue must never take a finished run down with it */ }
    }
  }
}

/**
 * Whether a finished run pulls the next queued goal by itself.
 *
 * This was an env var only, which made it unreachable in practice: start-hub.bat never set
 * it, so the queue, the chains and the retry path were all correct code that had executed
 * zero times. It is a persisted setting now, so turning 24/7 on is a decision you can make
 * from Settings instead of an environment variable you have to remember at launch.
 *
 * AGENT_SUPERVISOR=1 still forces it on at boot and cannot be switched off from the UI:
 * a headless deployment that was started with it should not be silently disarmed by a
 * browser tab someone left open.
 */
const SUPERVISOR_FORCED = process.env.AGENT_SUPERVISOR === '1';
let supervisorEnabled = SUPERVISOR_FORCED;
export const supervisorOn = () => supervisorEnabled;

/** The ceilings that bound unattended work, reported wherever it is switched on. */
const supervisorLimits = () => ({
  maxGenerations: MAX_GENERATIONS,
  maxAutoStartsPerHour: MAX_AUTO_STARTS_PER_HOUR,
  autoStartsLastHour: autoStarts.filter((t) => t > Date.now() - 3600_000).length,
});
// How many goals one POST /queue/chain may add. A plan with forty milestones is a plan
// that wants splitting, not forty unattended runs kicked off by one click.
const MAX_CHAIN = 12;

// How far a chain of machine-queued work may extend before a human has to look at it,
// and how many runs the supervisor may start per hour no matter what.
const MAX_GENERATIONS = Math.max(1, Number(process.env.AGENT_MAX_GENERATIONS || 5));
const MAX_AUTO_STARTS_PER_HOUR = Math.max(1, Number(process.env.AGENT_MAX_AUTO_STARTS || 12));
const autoStarts = [];   // timestamps of supervisor-started runs, rolling 1h window

/**
 * Should the supervisor REFUSE to auto-start this item? Returns a human-readable
 * reason, or '' to go ahead.
 *
 * WHY THIS EXISTS. Measured 2026-09-09, the first time the supervisor and the queue ran
 * together: a model that ends each run by proposing a follow-up produced 40 completed
 * runs in 60 seconds. Dedup in queue.js kills the same-goal case, but a model that
 * proposes a DIFFERENT plausible next step every time - which is the behaviour we
 * actually want from a good model - would chain forever and dedup would never fire. On a
 * metered API that is an unbounded bill with nobody watching, and the whole point of the
 * supervisor is that nobody IS watching.
 *
 * So autonomy is bounded on two independent axes: chain depth (how far from a human's
 * instruction) and wall-clock rate (how fast, regardless of depth). Neither discards
 * work - the item goes back on the queue for a person to release.
 */
// Exported so the audit can exercise the real brake instead of grepping for its source.
// A guard that is only checked by a regex is a guard that quietly stops working.
export const __supervisorTest = {
  brake: (item) => supervisorBrake(item),
  record: () => autoStarts.push(Date.now()),
  reset: () => { autoStarts.length = 0; },
  caps: () => ({ generations: MAX_GENERATIONS, perHour: MAX_AUTO_STARTS_PER_HOUR }),
  // The whole failure path, callable without a model that fails on cue. With the
  // supervisor off (the default, and what tests run under) it stops before starting
  // anything, so what is left to observe is exactly what it did to the queue.
  failItem: (run, reason, detail) => failQueueItem(null, run, reason, detail),
};

function supervisorBrake(item) {
  const gen = Number(item.generation) || 0;
  if (gen >= MAX_GENERATIONS) {
    return `this goal is ${gen} hops from anything a human asked for (cap ${MAX_GENERATIONS}).`;
  }
  const cutoff = Date.now() - 3600_000;
  while (autoStarts.length && autoStarts[0] < cutoff) autoStarts.shift();
  if (autoStarts.length >= MAX_AUTO_STARTS_PER_HOUR) {
    return `${autoStarts.length} runs already started automatically in the last hour (cap ${MAX_AUTO_STARTS_PER_HOUR}).`;
  }
  return '';
}

/**
 * The run currently holding the workspace, or undefined.
 *
 * 'awaiting_approval' counts: a run parked on an approval prompt still owns every file
 * in the workspace and will keep writing the moment it is approved. Treating only
 * 'running' as busy let queued work start on top of a paused run.
 *
 * Sub-runs (depth > 0) are excluded - they execute inside a parent's turn, so the parent
 * is already the thing holding the lock.
 */
function activeTopLevelRun() {
  return [...runs.values()].find((r) => !r.depth && (r.busy || ['running', 'awaiting_approval'].includes(r.status)));
}

function completedQueueIds() {
  return workQueue.list().filter((i) => i.status === 'done').map((i) => i.id);
}

/**
 * The goal text for a second attempt at a failed chain step, or null when there must not
 * be one.
 *
 * Null when the failed item was ITSELF a repair. That single rule is what makes this
 * terminate: one original goal can produce at most one extra run, whatever it fails with.
 * Dedup cannot do that job - a second failure usually carries a different error string, so
 * the two repair goals are different text and dedup waves them both through.
 *
 * The goal says the workspace may be half-finished, because it usually is: a run that died
 * at step 7 of 10 leaves files on disk, and a retry that assumes an empty workspace either
 * duplicates that work or trips over it.
 */
export function repairGoalFor(item, { reason = 'error', detail = '' } = {}) {
  if (!item || item.repairOf) return null;
  const why = { budget: 'it ran out of budget', loop: 'it repeated itself and got stuck',
    parse: 'its reply could not be parsed', same_error: 'the same error kept coming back',
    tunnel: 'its connection dropped' }[reason] || 'it errored';
  const snippet = String(detail || '').trim().slice(0, 400);
  return [
    `A previous attempt at this goal stopped part-way (${why}), so workspace/ may be half-finished.`,
    'Read what is already there before changing anything, then finish the goal.',
    '',
    `Goal: ${item.goal}`,
    snippet ? `\nIt stopped with:\n${snippet}` : '',
  ].join('\n').trim();
}

/**
 * Record that a queued step failed, and splice in its one retry.
 *
 * The retry outranks the rest of the backlog (priority + 1) because the tail of this chain
 * is already queued behind it - letting unrelated work overtake would run the plan's later
 * steps' dependency last.
 */
function failQueueItem(loadDb, run, reason, detail) {
  const item = workQueue.list().find((i) => i.id === run.queueItemId);
  workQueue.complete(run.queueItemId, {
    status: run.status === 'done' ? 'done' : run.status || 'error',
    runId: run.id, summary: `${reason}: ${String(detail || '').slice(0, 200)}`,
  });

  // Only a genuine error earns an automatic retry.
  //
  // 'stopped' is a person pressing Stop. Re-queueing what someone just cancelled, at 4am,
  // is the single most obnoxious thing an unattended agent could do. 'interrupted' is a
  // dropped connection, and those runs are resumable with their history intact - retrying
  // from scratch throws that away and redoes work the run had already done. Both still get
  // recorded above, so the chain shows why it is not moving instead of looking idle.
  if (run.status && run.status !== 'error') {
    pushStep(run, { type: 'note', text: `Queue: ${run.queueItemId} marked '${run.status}'. No automatic retry — `
      + (run.status === 'stopped' ? 'you stopped this one.' : 'resume it rather than starting over.') });
    return;
  }

  const goal = repairGoalFor(item, { reason, detail });
  if (!goal) {
    pushStep(run, { type: 'note', text: item?.repairOf
      ? `Queue: this was already the retry of ${item.repairOf}, so the chain stops here and waits for you.`
      : `Queue: marked ${run.queueItemId} failed.` });
    return;
  }

  const r = workQueue.enqueue(goal, {
    source: 'repair', generation: (item.generation || 0) + 1,
    priority: (item.priority || 0) + 1, repairOf: item.id,
  });
  if (!r.ok) {
    pushStep(run, { type: 'note', text: `Queue: ${item.id} failed (${reason}); no retry queued — ${r.error}` });
    return;
  }
  const moved = workQueue.repoint(item.id, r.item.id);
  pushStep(run, { type: 'note', text: `Queue: ${item.id} failed (${reason}). Retrying once as ${r.item.id}`
    + (moved.length ? `, with ${moved.length} waiting goal(s) moved behind it.` : '.') });

  // Start it under exactly the brakes any other auto-start gets - generation cap and the
  // runs-per-hour ceiling. A retry storm is the failure mode those caps exist for.
  if (!supervisorEnabled) return;
  const stop = supervisorBrake(r.item);
  if (stop) {
    pushStep(run, { type: 'note', text: `Supervisor held the retry: ${stop} It stays queued.` });
    return;
  }
  autoStarts.push(Date.now());
  setTimeout(() => {
    try { startRun(loadDb, r.item.goal, { queueItemId: r.item.id, source: 'queue', generation: r.item.generation }); }
    catch { /* the retry is best-effort; the queue still records the failure */ }
  }, 250);
}

/**
 * Create and start a run. Shared by the HTTP route and the supervisor, so a
 * self-started run is identical to a human-started one in every respect.
 */
function startRun(loadDb, goal, { queueItemId = null, source = 'human', generation = 0 } = {}) {
  ensureWorkspace();
  const id = randomUUID();
  const now = Date.now();
  const run = {
    id, goal, status: 'running', busy: false, modelCalls: 0, tokens: 0,
    steps: [], pending: null, createdAt: now, budgetStart: now,
    queueItemId, source, generation: Math.max(0, Number(generation) || 0),
    history: [
      { role: 'system', content: SYSTEM_PROMPT },
      // Carry memory across runs: NOTES.md is the only thing that survives a run
      // ending, so it goes into the opening context rather than waiting for the agent
      // to think of calling recall.
      ...(existsSync(join(WORKSPACE, 'NOTES.md'))
        ? [{ role: 'user', content: `Your notes from earlier work (NOTES.md):\n${readFileSync(join(WORKSPACE, 'NOTES.md'), 'utf8').slice(-4000)}` }]
        : []),
      { role: 'user', content: `Files currently in the workspace (these are the ONLY files — use these EXACT names, never invent one):\n${tools.list_dir({ path: '.' })}\n\nGOAL: ${goal}\n\nBegin step by step. For any large file, outline_file it FIRST, then read_file the slice you need — never try to read a whole big file at once.` },
    ],
  };
  // Anything still open in TASKS.md belongs to an earlier run. Mark it inherited so it
  // stays visible without gating THIS run's finish. Only here, never on a follow-up: a
  // follow-up is the same commitment continuing.
  try {
    const c = ledger.adopt(WORKSPACE, id).carried;
    if (c) pushStep(run, { type: 'note', text: `${c} unfinished task(s) from earlier work in this workspace are carried over as context, not as commitments.` });
  } catch { /* the ledger is a helper, never a reason a run cannot start */ }

  runs.set(id, run);
  evictOldRuns();
  persist(run);       // on disk before step 1 so it survives a restart even mid-planning
  drive(loadDb, run); // fire and forget
  return run;
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function agentRouter({ loadDb, saveDb, withDb }) {
  const router = express.Router();
  loadRuns();   // restore checkpointed runs after a server restart (mid-flight ones become 'interrupted')
  // A crash mid-run leaves its queue item marked 'taken' and it would never be picked
  // up again. Put those back on the list.
  const orphans = workQueue.requeueOrphans();
  if (orphans) console.log(`[agent] re-queued ${orphans} orphaned work item(s) after restart`);
  workQueue.prune();
  console.log(`[agent] approval mode: ${describeMode()}`);

  // Hand the already-registered Google tools a real database. Until this runs they exist
  // but report "not connected", which is also what they should do.
  googleDb.loadDb = loadDb;
  googleDb.saveDb = saveDb;
  googleDb.withDb = withDb;
  if (googleReady()) console.log(`[agent] Google account connected — ${GOOGLE_READ_TOOLS.length} read tools auto-run, ${GOOGLE_WRITE_TOOLS.length} write tools need approval`);

  // Restore the persisted choice, unless the environment already forced it on at boot.
  if (!SUPERVISOR_FORCED) {
    try { supervisorEnabled = !!loadDb().settings?.agentSupervisor; } catch { supervisorEnabled = false; }
  }
  if (supervisorEnabled) console.log(`[agent] supervisor ON — finished runs will pull the next queued goal (${workQueue.depth()} waiting)`);

  /**
   * Turn unattended pickup on or off, and remember the choice.
   *
   * Reports the brakes back with it, because "the agent will now start work on its own
   * while you are asleep" is not a setting anyone should switch on without being told, in
   * the same breath, what stops it: the approval mode, the per-hour ceiling and the
   * generation cap.
   */
  router.post('/supervisor', (req, res) => withDb(async () => {
    const on = !!req.body?.on;
    if (SUPERVISOR_FORCED && !on) {
      return res.status(409).json({
        error: 'AGENT_SUPERVISOR=1 is set in the environment, so this cannot be switched off from the UI.',
        supervisor: true, forced: true,
      });
    }
    const db = loadDb();
    db.settings = { ...(db.settings || {}), agentSupervisor: on };
    saveDb(db);
    supervisorEnabled = on;
    console.log(`[agent] supervisor ${on ? 'ON' : 'OFF'} (set from Settings)`);
    res.json({ supervisor: supervisorEnabled, forced: SUPERVISOR_FORCED, ...supervisorLimits() });
  }));

  router.get('/supervisor', (_req, res) => res.json({
    supervisor: supervisorEnabled,
    forced: SUPERVISOR_FORCED,
    approvalMode: APPROVAL_MODE,
    approvalModeDescription: describeMode(),
    queued: workQueue.depth(),
    ...supervisorLimits(),
  }));

  // Start a new run; returns immediately, loop runs in the background.
  router.post('/start', (req, res) => {
    const { goal, queueIfBusy } = req.body || {};
    if (!goal || !goal.trim()) return res.status(400).json({ error: 'goal required' });

    // ONE TOP-LEVEL RUN AT A TIME. There is a single shared WORKSPACE, and sharing it is
    // deliberate - NOTES.md carries memory between runs and the git history accumulates -
    // but that design assumes runs are SEQUENTIAL. Nothing enforced it, so six concurrent
    // runs were possible, and on 2026-09-09 six of them produced this in one TASKS.md:
    //
    //     - [ ] 1. Implement parse.js to parse semicolon-delimited key/value input
    //     - [ ] 2. Create index.html with Phaser scene and a visible square
    //     - [ ] 6. Mark obsolete parse.js work as intentionally out of scope
    //
    // The Phaser run read ANOTHER run's tasks out of its own ledger, decided they were
    // its own stale work, and planned to dismiss them. Cross-run contamination does not
    // merely clobber files - it feeds a model false premises and it makes wrong
    // decisions confidently. Same hazard for the ledger, NOTES.md and git commits.
    //
    // Per-run workspaces would break the continuity that is the point of one workspace,
    // so the invariant is enforced instead of engineered around. Sub-tasks are exempt:
    // they run INSIDE a parent's turn, which is already serial.
    const active = activeTopLevelRun();
    if (active) {
      if (queueIfBusy) {
        const q = workQueue.enqueue(goal.trim(), { source: 'human' });
        if (q.duplicate) return res.status(409).json({ error: q.error, duplicate: true, activeRunId: active.id });
        return res.status(202).json({ queued: true, item: q.item, depth: q.depth, activeRunId: active.id });
      }
      return res.status(409).json({
        error: `a run is already working in this workspace (${active.status}: "${active.goal.slice(0, 60)}"). `
             + 'Two runs share the same files, task ledger and NOTES.md, so they corrupt each other. '
             + 'Stop it first, or send queueIfBusy to add this goal to the queue instead.',
        busy: true, activeRunId: active.id, activeStatus: active.status,
      });
    }

    const run = startRun(loadDb, goal.trim());
    res.json({ runId: run.id });
  });

  // ── Work queue ───────────────────────────────────────────────────────────────
  // The backlog the supervisor pulls from, and that the agent can add to itself.
  router.get('/queue', (req, res) => {
    const items = workQueue.list();
    // A chained item is only dequeued once its `after` reaches 'done'. If that
    // predecessor failed or was deleted, the item is not "queued" in any useful sense -
    // it will sit there forever and nothing says why. Say why.
    const byId = new Map(items.map((i) => [i.id, i]));
    res.json({
      supervisor: supervisorEnabled,
      approvalMode: APPROVAL_MODE,
      items: items.map((i) => {
        if (i.status !== 'queued' || !i.after) return i;
        const dep = byId.get(i.after);
        if (!dep) return { ...i, blocked: `waits on ${i.after}, which no longer exists` };
        if (dep.status === 'done') return i;
        if (dep.status === 'queued' || dep.status === 'taken') return { ...i, waitingOn: i.after };
        return { ...i, blocked: `waits on ${i.after}, which ended as '${dep.status}'` };
      }),
    });
  });

  router.post('/queue', (req, res) => {
    const { goal, priority, force, after } = req.body || {};
    // `after` must name an item that exists. An unknown id is not a no-op: dequeue only
    // releases a chained item once its predecessor is 'done', so a typo would park the
    // goal forever and look like the queue had simply stopped.
    if (after != null && !workQueue.list().some((i) => i.id === after)) {
      return res.status(400).json({ error: `no queued item with id ${after} to run after` });
    }
    // A person adding the same goal twice is a deliberate re-run, not a runaway chain,
    // so the dedup guard is overridable here - but only from this route, and only when
    // asked for explicitly.
    const r = workQueue.enqueue(goal, { priority, source: 'human', force: !!force, after: after || null });
    if (r.duplicate) return res.status(409).json({ error: r.error, duplicate: true, item: r.item });
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json(r);
  });

  /**
   * Queue an ordered chain: each goal runs only after the one before it finished.
   *
   * This is what a plan becomes when nobody is going to be sitting there clicking. The
   * pieces already existed - `after` in the queue, the supervisor pulling the next item
   * when a run ends - but nothing could set `after`, so every queued goal was independent
   * and a five-step plan raced itself in whatever order the priorities fell out.
   *
   * Partial success is reported, not rolled back. If step 3 of 5 is a duplicate of work
   * already done, steps 1, 2, 4 and 5 are still the work you asked for; throwing them
   * away because one link was redundant would be worse than a shorter chain. Each
   * accepted goal links to the last ACCEPTED one, so a skipped middle step closes the gap
   * rather than orphaning everything after it.
   */
  router.post('/queue/chain', (req, res) => {
    const { goals, priority, force } = req.body || {};
    if (!Array.isArray(goals) || goals.length === 0) {
      return res.status(400).json({ error: 'goals must be a non-empty array' });
    }
    if (goals.length > MAX_CHAIN) {
      return res.status(400).json({ error: `a chain is capped at ${MAX_CHAIN} goals (got ${goals.length})` });
    }

    const queued = [], skipped = [];
    let previousId = null;
    for (const goal of goals) {
      const r = workQueue.enqueue(goal, {
        priority, source: 'human', force: !!force, after: previousId,
      });
      if (r.ok) { queued.push(r.item); previousId = r.item.id; }
      else skipped.push({ goal: String(goal || '').slice(0, 120), reason: r.error, duplicate: !!r.duplicate });
    }
    res.json({ ok: queued.length > 0, queued, skipped, depth: workQueue.depth(), supervisor: supervisorEnabled });
  });

  router.delete('/queue/:id', (req, res) => res.json(workQueue.remove(req.params.id)));

  // Start the next queued item now, without waiting for a run to finish.
  router.post('/queue/run', (req, res) => {
    const active = activeTopLevelRun();
    if (active) {
      return res.status(409).json({
        error: `a run is already working in this workspace (${active.status}: "${active.goal.slice(0, 60)}").`,
        busy: true, activeRunId: active.id, activeStatus: active.status,
      });
    }
    const next = workQueue.dequeue({ completedIds: completedQueueIds() });
    if (!next) return res.status(404).json({ error: 'the queue is empty' });
    // Carry the hop count, or starting an item by hand would silently reset the chain
    // depth the supervisor's brake relies on.
    const run = startRun(loadDb, next.goal, { queueItemId: next.id, source: 'queue', generation: next.generation || 0 });
    res.json({ runId: run.id, item: next });
  });

  // List all known runs (lightweight — no history/steps payload) so the UI can
  // surface resumable 'interrupted' runs after a tunnel drop or server restart.
  router.get('/list', (req, res) => {
    const out = [...runs.values()]
      .map(r => ({ id: r.id, goal: r.goal, status: r.status, modelCalls: r.modelCalls, steps: r.steps.length, createdAt: r.createdAt }))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(out);
  });

  // List the files currently in the workspace. (Must be defined BEFORE '/:id'
  // or Express treats "files" as a run id.)
  router.get('/files', (req, res) => {
    ensureWorkspace();
    const out = [];
    const walk = (dir, rel = '') => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') continue;
        const fp = join(dir, name);
        const r = rel ? `${rel}/${name}` : name;
        if (statSync(fp).isDirectory()) walk(fp, r);
        else out.push({ path: r, size: statSync(fp).size });
      }
    };
    walk(WORKSPACE);
    res.json(out);
  });

  // Poll run state (client strips the heavy history field).
  router.get('/:id', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    const { history, busy, ...view } = run;
    res.json(view);
  });

  // Approve or reject a pending run_command, then resume.
  router.post('/:id/approve', async (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    if (run.status !== 'awaiting_approval' || !run.pending) {
      return res.status(409).json({ error: 'nothing awaiting approval' });
    }
    const approve = req.body?.approve !== false;
    const { tool, args } = run.pending;
    run.pending = null;

    if (!approve) {
      pushStep(run, { type: 'approval_denied', tool, args });
      run.history.push({ role: 'user', content: `The human DENIED running: ${args.cmd}. Do not run it. Continue another way or finish.` });
    } else {
      let result;
      try { result = await tools[tool](args); }
      catch (e) { result = `ERROR: ${e.message}`; }
      pushStep(run, { type: 'tool', tool, args, result, approved: true });
      run.history.push({ role: 'user', content: `TOOL RESULT (${tool}):\n${result}` });
    }
    run.status = 'running';
    drive(loadDb, run);
    res.json({ ok: true });
  });

  // Resume a run that paused because the tunnel dropped (or was caught mid-flight
  // by a server restart). drive() replays from run.history, so it picks up exactly
  // where it left off. Point the Ollama tunnel at the new URL in Settings first.
  router.post('/:id/resume', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    if (run.busy || run.status === 'running') return res.status(409).json({ error: 'run is already active' });
    if (run.status === 'awaiting_approval') return res.status(409).json({ error: 'run is awaiting command approval — use approve' });
    if (run.status === 'done') return res.status(409).json({ error: 'run already finished' });
    run.status = 'running';
    pushStep(run, { type: 'note', text: 'Resumed.' });
    drive(loadDb, run);
    res.json({ ok: true });
  });

  // Follow-up: continue a FINISHED run with a new instruction instead of starting
  // a cold new run that re-plans from scratch. The model keeps its whole prior
  // conversation (its last output is right there in run.history), so it builds on
  // what exists — patching with edit_file, or fully rewriting a file that's wrong.
  // The workspace listing is refreshed first so the model edits the REAL current
  // files (ground truth), never its memory of them.
  router.post('/:id/followup', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    const instruction = (req.body?.goal || req.body?.instruction || '').trim();
    if (!instruction) return res.status(400).json({ error: 'instruction required' });
    if (run.busy || run.status === 'running') return res.status(409).json({ error: 'run is still active — stop it first' });
    if (run.status === 'awaiting_approval') return res.status(409).json({ error: 'run is awaiting command approval — resolve it first' });
    if (run.status === 'interrupted') return res.status(409).json({ error: 'run is paused (tunnel dropped) — Resume it first, then send a follow-up' });

    ensureWorkspace();
    const listing = tools.list_dir({ path: '.' });
    run.history.push({ role: 'user', content:
      `FOLLOW-UP INSTRUCTION — the previous task is complete. Build on the EXISTING workspace below; do NOT start over and do NOT recreate files that already exist.\n\n` +
      `Workspace now contains (these are the real current files — read one before you edit it so your FIND matches):\n${listing}\n\n` +
      `INSTRUCTION: ${instruction}\n\n` +
      `Prefer edit_file for targeted changes. Only write_file (full rewrite) a file that is fundamentally wrong. One action per step; finish when this instruction is satisfied.` });

    // Fresh per-iteration budget + guards so the previous run's counters don't
    // strangle this one — but KEEP run.planned = true so we continue, not replan.
    run.followups = run.followups || [];
    run.followups.push({ ts: Date.now(), instruction });
    run.modelCalls = 0;
    run.budgetStart = Date.now();          // fresh wall-clock budget; createdAt stays the true start
    // Clear the ACTUAL guard state. These three used to reset run.repeat/lastNorm/errStreak,
    // which no longer exist - so a follow-up inherited the previous iteration's loop window
    // and parse-failure window and could be killed by them before its first step.
    run.recent = []; run.parseLog = [];
    run.sameErr = 0; run.lastErrSig = null;
    run.needsTest = false; run.finishBlocks = 0; run.cleanTests = 0;
    // The finish gate's one-shot checks must re-arm too, or a follow-up inherits
    // "already verified" from the previous iteration and skips its own proof.
    run.sawScreen = false; run.verified = false; run.touchedWeb = false;
    run.traced = false;                    // capture a fresh (goal+followup -> code) trace
    run.status = 'running';
    pushStep(run, { type: 'followup', text: instruction });
    persist(run);
    drive(loadDb, run);
    res.json({ ok: true, runId: run.id });
  });

  // Stop a run — flip status and abort any in-flight model call immediately.
  router.post('/:id/stop', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    run.status = 'stopped';
    run.pending = null;
    try { run.abort?.abort(); } catch {}
    pushStep(run, { type: 'error', text: 'Stopped by user.' });
    persist(run);
    res.json({ ok: true });
  });

  // Download the whole workspace as a zip (Windows built-in Compress-Archive).
  router.get('/export/zip', (req, res) => {
    ensureWorkspace();
    if (readdirSync(WORKSPACE).length === 0) {
      return res.status(400).json({ error: 'workspace is empty — nothing to export yet' });
    }
    const tmp = join(__dirname, 'workspace_export.zip');
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch {}
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${join(WORKSPACE, '*')}' -DestinationPath '${tmp}' -Force"`;
    exec(cmd, { windowsHide: true }, (err, _stdout, stderr) => {
      if (err) return res.status(500).json({ error: (stderr || err.message).slice(0, 300) });
      res.download(tmp, 'workspace.zip', () => { try { unlinkSync(tmp); } catch {} });
    });
  });

  // Drop a (text) file into the workspace so the agent can read/edit it.
  router.post('/upload', (req, res) => {
    const { path, content } = req.body || {};
    if (!path) return res.status(400).json({ error: 'path required' });
    try {
      const full = safePath(path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content ?? '', 'utf8');
      res.json({ ok: true, path });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Drop a .zip — decode and extract it into the workspace (Windows Expand-Archive).
  router.post('/upload-zip', (req, res) => {
    const { dataB64 } = req.body || {};
    if (!dataB64) return res.status(400).json({ error: 'dataB64 required' });
    ensureWorkspace();
    const tmp = join(__dirname, `_upload_${Date.now()}.zip`);
    try { writeFileSync(tmp, Buffer.from(dataB64, 'base64')); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    const cmd = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${tmp}' -DestinationPath '${WORKSPACE}' -Force"`;
    exec(cmd, { windowsHide: true }, (err, _o, stderr) => {
      try { unlinkSync(tmp); } catch {}
      if (err) return res.status(500).json({ error: (stderr || err.message).slice(0, 300) });
      res.json({ ok: true });
    });
  });

  // Remove a file from the workspace.
  router.delete('/files', (req, res) => {
    try {
      const full = safePath(req.query.path || '');
      if (existsSync(full)) unlinkSync(full);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Wipe the workspace for a fresh project (clears every file, base + uploaded).
  router.post('/reset', (req, res) => {
    ensureWorkspace();
    try {
      for (const name of readdirSync(WORKSPACE)) {
        rmSync(join(WORKSPACE, name), { recursive: true, force: true });
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
