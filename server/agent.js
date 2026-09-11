// ── Autonomous coding agent ───────────────────────────────────────────────────
// A simple, transparent ReAct-style loop: the model emits ONE JSON action per
// step, the server executes it against a sandboxed workspace, feeds the result
// back, and repeats until the goal is met or a step limit is hit.
//
// Safety model (v1): file/list operations run automatically; run_command pauses
// and waits for explicit human approval. Everything is confined to WORKSPACE.

import express from 'express';
import { launchOptions } from './browser.js';
import { serveScriptsFromCache } from './engineCache.js';
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
import { ensureRepo, commitAll, diff as gitDiff, log as gitLog, undo as gitUndo, isDirty, showFile, fileHistory } from './workspaceGit.js';
import { classifyCommand, classifyPython, describeMode, MODE as APPROVAL_MODE } from './approvalPolicy.js';
import * as ledger from './taskLedger.js';
import * as visual from './visualCheck.js';
import * as verifier from './verifyProject.js';
import { verifyGodotFiles } from './godotVerify.js';
import { escalate, estimateTokens, tokenBudgetExceeded } from './escalate.js';
import * as workQueue from './queue.js';
import * as assetLib from './assets.js';
import { canonicalSummary } from './canonicalAssets.mjs';
import { SYSTEM_PROMPT } from './agentPrompt.js';
import { parseAction, parseActions } from './agentParse.js';
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
  // The real parser. Exported so a test can assert on BEHAVIOUR - what the model's text
  // turns into - rather than on the source of the regex, which is how agent_audit ended
  // up asserting a bug twice today.
  parseAction: (text, lastPath) => parseAction(text, lastPath),
  writeReason: (tool, args) => googleWriteReason(tool, args),
  // The lookup the run loop actually does (`tools[tool]`), so a test can ask whether a tool
  // the model might emit is callable - without constructing a router, which would run
  // requeueOrphans() against the live work queue.
  hasTool: (name) => typeof tools[name] === 'function',
  // Call a real tool by name, so a test can pin its behaviour against a real workspace.
  callTool: (name, args) => tools[name](args),
  // The boundary-marker guard. A PURE function, so a test can pin it without constructing
  // a router or touching a workspace. Exported because the failure it prevents was silent:
  // the marker became a 22-byte stub and every later run measured a workspace whose module
  // system did not match what the system prompt told the model it was.
  markerRefusal: (path, tool) => markerRefusal(path, tool),
  // The single-run-at-a-time lock, exercisable without a model. `autoStart` is the only
  // path the agent may start work on its own, and it had no test at all until it was
  // pointed out that a guard nobody has watched fail is not a guard.
  autoStart: (loadDb, item) => autoStart(loadDb, item),
  fakeActiveRun: (status = 'running') => {
    const run = { id: `fake-${randomUUID().slice(0, 8)}`, goal: 'holding the workspace', status, steps: [], depth: 0 };
    runs.set(run.id, run);
    return run;
  },
  forgetRun: (id) => runs.delete(id),
  autoStartsInLastHour: () => autoStarts.filter((t) => t > Date.now() - 3600_000).length,
  // A counter that leaked would jam /reset shut for ever, so the test must be able to see it.
  pendingAutoStarts: () => pendingAutoStarts,
  // The real append_file, so a test can pin what it does to the workspace.
  appendFile: (args) => tools.append_file(args),
};

/** What an approval prompt for a Google write should say, in terms of the real effect. */
function googleWriteReason(tool, args = {}) {
  if (tool === 'gmail_send') return `sends mail AS YOU to ${args.to || '(no recipient given)'} — subject "${(args.subject || '').slice(0, 60)}"`;
  if (tool === 'drive_upload') return `uploads ${args.path || '(no file)'} from the workspace to your Google Drive`;
  if (tool === 'calendar_add') return `creates "${(args.title || '(untitled)').slice(0, 60)}" in your calendar at ${args.start || '(no time)'}`;
  return `${tool} changes your Google account`;
}

// Overridable so a loop test can drive the REAL agent against a scratch directory.
// Without this, every end-to-end test writes into the developer's live workspace - the
// same hazard that had two tests mutating the live queue and hub.json. Unset in normal
// use, so the hub's own workspace is unchanged.
export const WORKSPACE = process.env.AGENT_WORKSPACE
  ? resolve(process.env.AGENT_WORKSPACE)
  : join(__dirname, '..', 'workspace');
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
// Batch actions: OPT-IN, OFF BY DEFAULT. Off, the loop runs the FIRST action of a reply and
// discards the rest, exactly as it always has. On, up to BATCH_MAX of them run in order under
// the rules documented at planBatch(). Read once at load, like every other AGENT_* knob.
const BATCH_ACTIONS = process.env.AGENT_BATCH_ACTIONS === '1';
const BATCH_MAX = 4;

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

/**
 * THE WORKSPACE MUST LOOK LIKE A PROJECT ROOT TO THE TOOLS THAT RUN INSIDE IT.
 *
 * `safePath` confines the FILE tools and `cwd` confines the COMMAND tools, but neither
 * confines a PROGRAM the agent runs - and the programs it runs most (npm, node, tsc,
 * vite) all locate their project by walking UP the directory tree until they find a
 * marker file. The workspace lives inside the hub's own checkout, so with no marker of
 * its own the nearest one is the hub's.
 *
 * That is not theoretical. Measured 2026-09-10: an agent asked to write a CommonJS module
 * caused npm to walk up and rewrite the HUB'S OWN root package.json - adding
 * `"type": "commonjs"` and ~250 hoisted dependencies, which broke the server's ESM
 * loading. The same shape as the git escape (see workspaceGit.js), through a different
 * program: `git -C workspace` had resolved to the hub repo for exactly the same reason.
 *
 * A package.json here is the marker that stops the walk. `type: commonjs` preserves what
 * node already did for a .js file with no package.json in scope, so nothing the agent
 * writes changes meaning. `private` makes an accidental publish impossible.
 *
 * This does NOT confine a program that ignores markers and takes an absolute path. The
 * approval policy is what covers that; this closes the accidental route, which is the one
 * that actually fired.
 */
const WORKSPACE_MANIFEST = {
  name: 'agent-workspace',
  version: '0.0.0',
  private: true,
  type: 'commonjs',
  description: 'Boundary marker. Stops npm/node/tsc walking up into the hub\u0027s own project. Do not delete.',
};

function ensureWorkspace() {
  if (!existsSync(WORKSPACE)) mkdirSync(WORKSPACE, { recursive: true });
  const manifest = join(WORKSPACE, 'package.json');
  if (!existsSync(manifest)) {
    try { writeFileSync(manifest, JSON.stringify(WORKSPACE_MANIFEST, null, 2) + '\n', 'utf8'); }
    catch (e) { console.error('[agent] could not write the workspace boundary marker:', e.message); }
  }
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
// THE WORKSPACE BOUNDARY MARKER IS NOT THE AGENT'S TO REWRITE.
//
// Traced end to end 2026-09-10, and the hub caused it. The model wants "type": "module"
// for the ESM it just wrote. It tries edit_file, the FIND misses, and our OWN error message
// says "or use write_file to replace the whole file" - so it does, and the 8-line marker
// becomes a 22-byte {"type":"module"} stub. Measured across four consecutive run
// workspaces: `type` was module in TWO of them, each internally consistent, which is
// exactly why it stayed invisible.
//
// Two things break silently when that happens. The marker exists to stop npm/node/tsc
// walking up into the hub's own project, and that protection is simply gone. And the
// system prompt states "the workspace is a CommonJS Node project" as a fact, which is now
// false - so every later instruction built on it misleads the model.
//
// The prompt already asks the model not to do this and the model does it anyway; that is
// the advisory-vs-mechanical lesson one level down. Only a guard can hold it.
const MARKER = 'package.json';
function markerRefusal(path, tool) {
  // No regex here on purpose: an escaped backslash class kept getting mangled in transit,
  // and a guard that silently stops matching is worse than no guard. Split on both
  // separators, drop '.' segments, so './package.json' and '.\package.json' both
  // normalise to 'package.json'. The test caught './' slipping through.
  const rel = String(path || '').split(String.fromCharCode(92)).join('/').split('/').filter((x) => x && x !== '.').join('/');
  if (rel !== MARKER) return null;
  return `ERROR: ${MARKER} is the workspace boundary marker and ${tool} may not change it.
`
    + `It is NOT a normal file: it stops npm and node from treating the hub's own project as this workspace.
`
    + `If you wanted "type": "module" so you can use import/export — do not. This workspace is CommonJS: `
    + `use require(...) and module.exports in .js files, or name the file .mjs if you genuinely need ESM.
`
    + `Nothing about your goal requires editing ${MARKER}. Carry on with the actual work.`;
}


const tools = {
  list_dir({ path = '.' }) {
    const full = safePath(path);
    if (!existsSync(full)) return `(empty — ${path} does not exist yet)`;
    const walk = (dir, prefix = '') => {
      let out = '';
      for (const name of readdirSync(dir).sort()) {
        if (name === 'node_modules' || name === '.git') continue;
        const fp = join(dir, name);
        // A file can vanish between readdirSync and statSync - python's py_compile writes
        // __pycache__ through a temp file and renames it away. That ENOENT used to escape
        // from here, and startRun builds its opening message with list_dir, so a fuzz run's
        // /agent/start answered 500. Something that is no longer there is simply not listed.
        let isDir;
        try { isDir = statSync(fp).isDirectory(); } catch { continue; }
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
          // Skip an entry that vanished mid-walk (see list_dir) rather than abandoning the
          // whole search: the outer catch used to turn one __pycache__ temp into "no matches".
          let st; try { st = statSync(fp); } catch { continue; }
          st.isDirectory() ? walk(fp, r) : targets.push(r);
        }
      };
      try { walk(WORKSPACE); } catch {}
    }
    const out = [];
    for (const t of targets) {
      let full;
      try { full = safePath(t); } catch { continue; }
      let lines;
      try {
        if (statSync(full).isDirectory()) continue;
        lines = readFileSync(full, 'utf8').split('\n');
      } catch { continue; }   // missing, or gone since the walk listed it
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
    { const r = markerRefusal(path, 'write_file'); if (r) return r; }
    const full = safePath(path);
    mkdirSync(dirname(full), { recursive: true });
    // DO NOT LET A FRAGMENT DESTROY WORKING CODE.
    //
    // Measured 2026-09-10: mid-build, the 32B wrote 158 bytes of English prose about a
    // "User class" over a working 1,040-byte Phaser page - hallucinated content, unrelated
    // to the goal, and the game was gone. The run then lost the thread entirely. An
    // unattended agent that can silently delete its own work is not safe to leave running.
    //
    // The test is deliberately narrow, because a legitimate rewrite may well shrink a file:
    // it only fires when the replacement is BOTH much smaller AND does not look like code
    // for that extension. Prose replacing a program is the case being caught, not editing.
    if (existsSync(full)) {
      const before = readFileSync(full, 'utf8');
      const shrank = content.length < before.length * 0.4 && before.length > 400;
      const ext = (path.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
      const CODEISH = {
        html: /<\/?[a-z!][\s\S]*>/i,
        js: /[;{}]|=>|\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bclass\b/,
        mjs: /[;{}]|=>|\bfunction\b|\bconst\b/,
        css: /[{}:;]/,
        json: /^[\s]*[[{]/,
      }[ext];
      const looksLikeCode = !CODEISH || CODEISH.test(content);
      if (shrank && !looksLikeCode) {
        return `ERROR: refusing to overwrite ${path} - this would replace ${before.length} bytes of `
          + `working code with ${content.length} bytes that do not look like ${ext || 'code'} at all.\n`
          + `What you sent starts: ${JSON.stringify(content.slice(0, 90))}\n`
          + `If you meant to change part of the file, use edit_file. If you really do want to replace `
          + `the whole file, send the COMPLETE new ${ext || 'source'} - not a description of it.`;
      }
    }
    writeFileSync(full, content, 'utf8');
    return `OK: wrote ${Buffer.byteLength(content)} bytes to ${path}`;
  },

  /**
   * Add to the END of a file. The missing primitive.
   *
   * Measured across 32 real runs on 2026-09-10: 11.3% of ALL model calls returned an
   * error, and 81% of those were one message - `edit_file` refusing for want of a FIND
   * snippet. Every one of the worst runs was an EDIT goal ("add lerp to the EXISTING
   * utils.js", "add a score counter to the EXISTING index.html"), and write_file was
   * REWRITING an existing path twice as often as it created a new one.
   *
   * The cause is a gap in the vocabulary, not a weak model. The commonest edit anyone
   * makes is "add this to that file", and the tools offered exactly two ways to say it:
   * rewrite the whole file, or find an anchor and replace it with ITSELF PLUS the new
   * code. The first is expensive and can silently destroy working code; the second is a
   * strange way to express appending and needs an exact quotation of text you did not
   * write. So the agent burned its step budget failing at both.
   *
   * Appending cannot lose anything, which is why this is safe to auto-approve alongside
   * write_file: the failure mode of a bad append is a file with junk at the bottom, not a
   * file with the work missing.
   */
  async append_file({ path, content = '' }) {
    const full = safePath(path);
    if (!content) return `ERROR: append_file needs CONTENT — put the lines to add in a fenced code block.`;
    if (!existsSync(full)) {
      writeFileSync(full, content.endsWith('\n') ? content : content + '\n', 'utf8');
      // ── A FRAGMENT IS NOT A FILE ────────────────────────────────────────────────
      //
      // "Add five helpers to the EXISTING q3_list.js" - but an earlier goal never created
      // it. The model appends anyway, sending what it believes is the tail of the file
      // (`  function zip(a, b) {...}` then `};`), and this used to CREATE q3_list.js from
      // that fragment. Offline fuzzing against 1,759 recorded replies: every BROKEN file left
      // behind in batches 9-13 was this - q3_list.js, one version ever, a fragment. The
      // end-of-run syntax rollback can only restore a version that parsed, and a file born
      // as a fragment never had one, so it outlived every run after it.
      //
      // So a NEW file created by append must parse on its own. If it does not, nothing is
      // written (the checkpoint taken before this tool already holds the workspace as it
      // was), and the model is told the thing it did not know: the file does not exist.
      // Only a real syntax error refuses - a missing interpreter (no python on PATH) must
      // not turn every new .py into a refusal. Appending to an EXISTING file is unchanged.
      const err = await quickCheck(path);
      if (err && /SyntaxError|IndentationError|TabError/.test(err)) {
        try { unlinkSync(full); } catch { /* already gone */ }
        const why = String(err).split('\n').filter((l) => l.trim()).slice(0, 6).join('\n');
        return `ERROR: ${path} does not exist, so there was nothing to append to - and what you sent does not parse on its own, so NOTHING was written:\n${why}\n`
          + `If you thought ${path} already existed, it does not: no earlier step created it. `
          + `Create it with write_file containing the COMPLETE file (every function it needs, and its exports), then run it.`;
      }
      return `OK: ${path} did not exist, so it was created with ${Buffer.byteLength(content)} bytes.`;
    }
    const before = readFileSync(full, 'utf8');
    const joiner = before.endsWith('\n') ? '' : '\n';
    const body = content.endsWith('\n') ? content : content + '\n';
    writeFileSync(full, before + joiner + body, 'utf8');
    return `OK: appended ${Buffer.byteLength(body)} bytes to ${path} (now ${Buffer.byteLength(before + joiner + body)} bytes). The existing content was not touched.`;
  },

  // Surgical edit: replace a snippet in an existing file. Tries an exact match
  // first; if that fails, falls back to whitespace-tolerant line matching (small
  // models rarely reproduce exact indentation). Refuses if not found or ambiguous.
  edit_file({ path, find, replace = '' }) {
    { const r = markerRefusal(path, 'edit_file'); if (r) return r; }
    const full = safePath(path);
    if (!existsSync(full)) return `ERROR: file not found: ${path} (use write_file to create it)`;
    if (find == null || find === '') {
      // SAY WHAT TO SEND, AND SHOW IT.
      //
      // This was four words: "ERROR: missing FIND snippet." Measured 2026-09-10 on a live
      // unattended run, the model called edit_file SEVEN times in a row without FIND, got
      // the same four words each time, and burned its whole 25-call step budget on the
      // goal "add lerp() to utils.js" - a one-function edit. It had already read the file
      // twelve times; it knew the content, it just could not work out the request shape.
      //
      // Fourth instance of the same bug class in this file (edit_file ambiguity,
      // run_command's bare EXIT 1, list_assets' failed multi-word filter): a tool that
      // refuses correctly while withholding the one fact needed to act. Refusing is
      // cheap; refusing usefully is what keeps an unattended run moving.
      const head = existsSync(full)
        ? readFileSync(full, 'utf8').split('\n').slice(0, 6).map((l, i) => `${i + 1}: ${l}`).join('\n')
        : '';
      return 'ERROR: edit_file needs a FIND snippet — the exact text to replace. You sent PATH'
        + (replace ? ' and REPLACE' : '') + ' but no FIND.\n'
        + 'The shape is:\n'
        + '  ACTION: edit_file\n'
        + `  PATH: ${path}\n`
        + '  FIND:\n  ```\n  <the exact lines to replace>\n  ```\n'
        + '  REPLACE:\n  ```\n  <the new lines>\n  ```\n'
        + (head ? `First lines of ${path}, so you can copy a snippet verbatim:\n${head}\n` : '')
        + `To ADD something to the end of the file, use append_file instead — it is far simpler and cannot lose what is already there. To rewrite the file completely, use write_file.`;
    }
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
      + `Copy the target lines EXACTLY as read_file shows them.
`
      // Do NOT lead with write_file here. This line is what destroyed the workspace
      // boundary marker: the model missed a FIND on package.json, read this, and
      // overwrote the whole file. append_file is the right answer when the intent was
      // to ADD - it needs no FIND and cannot lose what is already there, which is why
      // it exists (FIND misses were 81% of all wasted model calls).
      + `If you were trying to ADD something rather than change existing text, use append_file instead - it needs no FIND snippet and cannot lose what is there.`;
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
      // Not a server, same intent and the same dead end: open/start/xdg-open hand the file
      // to a desktop browser the agent cannot see, and `open` does not exist on Windows at
      // all. Measured 2026-09-10: right after the http.server refusal the 32B tried
      // `open index.html` with the thought "verify the game loads" - the goal test_web
      // already serves. The policy correctly asked a human, which stalls an unattended run.
      [/^\s*(open|start|xdg-open|explorer)\s+\S+\.html?/i, 'open/start (a desktop browser the agent cannot read)'],
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

      // Serve every CDN script from the shared cache before navigating.
      //
      // test_web had NO interception, so each `<script src="https://cdn...">` in a page the
      // agent wrote hit the live network on every run. Measured 2026-09-10: jsdelivr
      // answered with something HTML-ish, Chromium reported `Unexpected token '<'`, and it
      // arrived here as a [JS ERROR] - the model told its correct code was broken, by the
      // tool it uses to check its work. gameVerify already cached the engine, but only for
      // the exact URL IT injected; the agent writes its own script tag and pins its own
      // version, so it was never covered.
      const cdnFailures = await serveScriptsFromCache(page);

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
      // Anything the failed CDN fetch knocked over is infrastructure noise, not evidence
      // about the page. Kept out of ERRORS entirely, and named separately - a model that
      // reads "your code threw" starts rewriting code that was never wrong.
      const fromCdn = (l) => cdnFailures.some((u) => l.includes(u));
      const codeLogs = logs.filter((l) => !fromCdn(l));
      const errs = codeLogs.length ? codeLogs.slice(0, 25).join('\n') : '(none)';
      return [
        `Loaded ${url} (HTTP ${status}). Clicked ${clicked} control(s).`,
        cdnFailures.length
          ? `NOTE: ${cdnFailures.length} library script(s) could not be fetched (${cdnFailures[0]}${cdnFailures.length > 1 ? ', …' : ''}). `
            + `That is a network problem on this machine, NOT a fault in your code. Anything the page did afterwards may be missing a library — do not rewrite working code because of it.`
          : null,
        `ERRORS:\n${errs}`,
        `VISIBLE TEXT (on load): ${before.replace(/\n+/g, ' | ')}`,
        `VISIBLE TEXT (after clicking): ${after.replace(/\n+/g, ' | ')}`,
        `(Review the visible text for wrong values, e.g. "$0" where money was expected, or features that did nothing.)`,
      ].filter(Boolean).join('\n\n');
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
      if (!filter) return assetLib.contextBlock() || 'The asset library is empty.';

      // SAY WHICH WORD FAILED, not just that the whole query did.
      //
      // Search requires EVERY word to match, so "orc_sheet background" finds nothing - no
      // file is both. Measured 2026-09-10: told only "No assets match, try fewer words",
      // the 32B re-sent the identical filter and the run died on the repeat guard. Third
      // bug of the same shape in one session (edit_file's "matches 2 places", run_command's
      // bare EXIT 1): an error that names the problem while withholding the fact needed to
      // act on it. Breaking the query down turns a dead end into a next move.
      const words = String(filter).toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (words.length > 1) {
        const lines = words.map((w) => {
          const hit = assetLib.search(w, { limit: 3 });
          return hit.total
            ? `  "${w}" alone -> ${hit.total} asset(s), e.g. ${hit.items.map((i) => i.path).join(', ')}`
            : `  "${w}" alone -> nothing`;
        });
        return `No asset matches ALL of "${filter}" - every word has to appear in the name.\n`
          + `${lines.join('\n')}\n`
          + `Search for ONE thing at a time, then load each by its exact path.`;
      }
      const near = assetLib.search(words[0].slice(0, 4), { limit: 4 });
      return `No assets match "${filter}".`
        + (near.total ? ` Closest on "${words[0].slice(0, 4)}": ${near.items.map((i) => i.path).join(', ')}` : '')
        + `\nUse a shorter word, or list_assets with no FILTER for a summary of what exists.`;
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

  // ---- does the Godot project actually RUN? -----------------------------------
  //
  // verify_project already understands Godot, but only as far as `--check-only`: it
  // proves every .gd file PARSES. Parsing is nearly free for any competent model, so a
  // Godot run could finish - gate satisfied, chain step green - on a scene that creates
  // nothing and prints nothing. That is the same shape as every other bug worth fixing
  // here: a gate that passes because it never asked the question that mattered.
  //
  // This calls the SAME core the Godot tab's Run button calls, deliberately. A verifier
  // that grades the agent differently from the human pressing Run is worse than none,
  // and `verifyGodotFiles` exists precisely so both callers share one answer.
  async verify_godot({ main, frames, mode } = {}) {
    ensureWorkspace();
    const files = collectGodotFiles(WORKSPACE);

    if (!files.length) {
      return 'ERROR: no Godot files in workspace/ (nothing matching *.gd, *.tscn, *.tres or project.godot). '
        + 'This tool is for Godot projects; use verify_project for anything else.';
    }
    if (!files.some((x) => /.gd$/i.test(x.path))) {
      return 'ERROR: found Godot resources but no .gd script, so there is nothing to run. Write the script first.';
    }

    const r = await verifyGodotFiles({
      files,
      main: main || undefined,
      frames: frames || undefined,
      mode: mode || 'auto',
      run: true,          // the whole point of this tool - never the parse-only path
    });
    return formatGodotVerdict(r);
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

// ---- Godot file collection + verdict rendering, for verify_godot ---------------------
//
// Kept beside the tool rather than inside godotVerify.js: that file owns the CONTRACT and
// belongs to the Godot lane, and a caller reaching in to reshape its output is how two
// implementations of one idea start.

/** What a Godot project is made of, as far as the verifier is concerned. */
const GODOT_EXT = /\.(gd|tscn|tres|godot)$/i;

// Names the verifier GENERATES into its own temp dir. Sending a previous run's leftovers
// back in would make the agent verify the harness instead of the game.
const GODOT_GENERATED = new Set(['__hub_probe.gd', '__hub_main.tscn']);

// The verifier refuses 40 files / 600k chars. Cutting at the same numbers here means the
// agent gets a sentence it can act on instead of a 413 from a layer it cannot see.
const GODOT_MAX_FILES = 40;
const GODOT_MAX_TOTAL = 600_000;

function collectGodotFiles(root) {
  const out = [];
  let total = 0;
  const walk = (dir, rel = '') => {
    if (out.length >= GODOT_MAX_FILES || total >= GODOT_MAX_TOTAL) return;
    let names = [];
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name === 'node_modules' || name === '.git' || name === '.godot' || name === '.screenshots') continue;
      const fp = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      let st;
      try { st = statSync(fp); } catch { continue; }
      if (st.isDirectory()) { walk(fp, r); continue; }
      if (!GODOT_EXT.test(name) || GODOT_GENERATED.has(name)) continue;
      if (out.length >= GODOT_MAX_FILES || total + st.size > GODOT_MAX_TOTAL) return;
      try {
        const content = readFileSync(fp, 'utf8');
        total += content.length;
        out.push({ path: r, content });
      } catch { /* unreadable file: report the rest rather than nothing */ }
    }
  };
  walk(root);
  return out;
}

/**
 * The verdict, as something a model can act on.
 *
 * Errors carry file and line because the next thing the agent does is open that file, and
 * "SCRIPT ERROR somewhere" costs it a search. `assetsMissing` is stated as a hard failure
 * for the same reason it is in the Chromium verifier: a texture that 404s leaves a scene
 * that "runs" and shows nothing.
 */
function formatGodotVerdict(r) {
  if (!r || r.error) {
    return `ERROR: ${(r && r.error) || 'the Godot verifier returned nothing'}`;
  }

  const L = [];
  L.push(`GODOT VERIFICATION — ${r.ok ? 'PASS' : 'FAIL'}${r.mode ? ` (mode: ${r.mode})` : ''}`);
  if (r.verdict) L.push(r.verdict);
  if (r.main) L.push(`entry: ${r.main}`);

  for (const s of r.stages || []) {
    L.push(`  stage ${s.stage}: ${s.ok ? 'ok' : 'FAILED'}`);
  }

  const errs = r.errors || [];
  if (errs.length) {
    L.push('errors:');
    for (const e of errs.slice(0, 12)) {
      const where = [e.file, e.line ? `line ${e.line}` : ''].filter(Boolean).join(' ');
      L.push(`  - ${where ? `${where}: ` : ''}${String(e.message || '').slice(0, 300)}`);
    }
    if (errs.length > 12) L.push(`  - (${errs.length - 12} more)`);
  }

  if (r.treeStats) {
    L.push(`scene: ${r.treeStats.built || 0} node(s) built${
      r.treeStats.classes && r.treeStats.classes.length ? ` (${r.treeStats.classes.slice(0, 6).join(', ')})` : ''}`);
  }
  if (r.prints && r.prints.length) {
    L.push(`printed: ${r.prints.slice(0, 8).map((p) => String(p).slice(0, 120)).join(' | ')}`);
  }
  if (r.assetsMissing && r.assetsMissing.length) {
    L.push(`MISSING ASSETS (these do not exist — use list_assets for exact names):`);
    for (const a of r.assetsMissing.slice(0, 8)) {
      L.push(`  - ${a.path || a}${a.from && a.from.length ? ` (referenced by ${a.from.slice(0, 3).join(', ')})` : ''}`);
    }
  }
  for (const n of (r.notes || []).slice(0, 6)) L.push(`note: ${n}`);

  return L.join('\n');
}

// The two halves of verify_godot that are mine rather than the verifier's: which files
// get sent, and how the answer is worded. Exported for the same reason parseAction is -
// a collector that quietly skips the entry script, or a verdict that drops the missing
// asset names, fails in a way no syntax check can see.
export const __godotToolTest = {
  collect: (root) => collectGodotFiles(root),
  format: (r) => formatGodotVerdict(r),
};

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
const AUTO_TOOLS = new Set(['list_dir', 'read_file', 'search_file', 'outline_file', 'write_file', 'append_file', 'edit_file', 'test_web', 'web_search', 'web_fetch',
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
  'see_screen', 'verify_project', 'verify_godot',
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

// ── Model call (streamed; Ollama /api/chat or an OpenAI-shaped /v1/chat/completions) ──
//
// THE BUDGET IS A STALL TIMER, NOT A WALL CLOCK.
//
// It used to be one 600s wall clock over the whole call, sized - the old comment said so
// outright - for "a T4 at ~15-25 tok/s". Measured 2026-09-10 against a remote 30B, the
// backend delivered 3.3 tok/s and ONE legitimate game-sized reply took 496s: 83% of the
// budget, on a reply that was arriving correctly the whole time. Nobody had edited a line;
// the same constant silently went from ~12,000 tokens of headroom to ~2,000 when the
// backend changed. That is the failure mode of measuring an LLM in seconds.
//
// A wall clock cannot tell a slow-but-working stream from a dead one, so given enough time
// it kills the working one. What separates them is SILENCE: a stream still delivering bytes
// is alive however slow, and a stream that has sent nothing for MODEL_STALL_MS is gone.
// So the stall timer resets on every chunk and does the real work; MODEL_TIMEOUT_MS stays
// only as a far-away ceiling so a backend dribbling one token a minute cannot run forever.
// WAITING FOR A COLD START IS NOT A STALL.
//
// One stall window for both events was wrong: the gap before the FIRST byte and the gaps
// BETWEEN tokens are different things. A serverless GPU endpoint has to boot a container
// and load the weights before it can emit anything - measured 2026-09-10, a Modal cold
// start of Qwen3-Coder-30B took 4 MINUTES, and modal_serve.py streams token-by-token so
// nothing arrives until that finishes. A 90s stall timer would have declared a perfectly
// healthy backend dead, every time, on the first call of the day.
//
// So the first byte gets a generous budget, and once tokens are flowing the tight
// inter-token window takes over - by then the model IS loaded, and silence really is a
// fault. Both are far below the absolute ceiling.
const MODEL_FIRST_BYTE_MS = (parseInt(process.env.MODEL_FIRST_BYTE_S, 10) || 420) * 1000;
const MODEL_STALL_MS = (parseInt(process.env.MODEL_STALL_S, 10) || 90) * 1000;
const MODEL_TIMEOUT_MS = (parseInt(process.env.MODEL_TIMEOUT_S, 10) || 1800) * 1000;
// How long a liveness probe may take. Short: it exists to answer "is anything there at
// all", and a backend that cannot list its models in 8s is not going to serve a token.
const PROBE_MS = (parseInt(process.env.MODEL_PROBE_S, 10) || 8) * 1000;
// Below this, say so. 3.3 tok/s was the single most important operational fact about this
// system and it took a throwaway benchmark script to find, because nothing measured it.
const SLOW_TOK_S = parseFloat(process.env.MODEL_SLOW_TOK_S || '8');
// Context the OpenAI-shaped path should assume when a provider row does not declare one.
// NUM_CTX is an OLLAMA option - it is sent in `options` and means nothing to an OpenAI
// endpoint - so before this the hub had NO context bound on that path at all.
const OPENAI_CTX_DEFAULT = parseInt(process.env.OPENAI_CTX, 10) || 16_384;
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

/**
 * Telemetry for the most recent model call. Read by the step loop and surfaced on the run.
 *
 * The hub counted modelCalls and nothing else, so "the backend is 30x too slow" was
 * invisible from inside the product. The bytes already flow through the stream loop; the
 * measurement is free there.
 */
let lastModelCall = null;
export function getLastModelCall() { return lastModelCall; }

/** How many tokens of history this provider can actually take. */
export function contextTokensFor(db) {
  const prov = agentProvider(db);
  const declared = parseInt((prov.row || {}).context_tokens, 10);
  if (Number.isFinite(declared) && declared > 0) return declared;
  return prov.kind === 'ollama' ? NUM_CTX : OPENAI_CTX_DEFAULT;
}

/**
 * Is the backend there at all?
 *
 * Called only on the failure path, so a healthy run pays nothing. It exists because the
 * hub could not distinguish DEAD from COLD from SLOW: when a vLLM container was
 * crash-looping on an AttributeError, /api/health returned empty, the call hung to the
 * timeout, and the hub blamed the tunnel URL - which was correct. Diagnosing it took
 * reading container logs by hand. One 8s probe answers it.
 */
async function probeBackend(base, isOllama, headers) {
  const u = isOllama ? `${base}/api/tags` : `${base}/v1/models`;
  try {
    const r = await fetch(u, { headers, signal: AbortSignal.timeout(PROBE_MS) });
    // A 404 means something IS listening and speaking HTTP - it just has no model-list
    // route (Google's versioned base does not). That is reachable, not dead.
    if (r.ok || r.status === 404) return { state: 'reachable', code: r.status };
    return { state: 'http-error', code: r.status };
  } catch (e) {
    return { state: 'unreachable', why: (e && (e.cause?.code || e.name)) || 'no response' };
  }
}

function describeProbe(pr, base, provName) {
  if (pr.state === 'reachable') {
    return `The backend at ${base} IS reachable (${provName}), so the URL and key are fine - it accepted a connection but did not produce tokens. That points at the model server itself: still loading, crash-looping, or out of memory. Check its logs.`;
  }
  if (pr.state === 'http-error') {
    return `The backend at ${base} answered HTTP ${pr.code} on its model-list route, so it is running but rejecting requests - usually auth, or a model name it does not serve.`;
  }
  return `Nothing is listening at ${base} (${pr.why}). The ${provName} endpoint is down or the base URL is wrong - check it in Settings, or redeploy the server.`;
}

/** A context-overflow is recoverable by pruning, so it gets its own type. */
function overflowError(detail) {
  const e = new Error('Model rejected the request as too long for its context: ' + detail);
  e.code = 'CONTEXT_OVERFLOW';
  return e;
}

async function callModel(loadDb, messages, signal, override) {
  const db = loadDb();
  const prov = agentProvider(db);
  const o = prov.row || {};
  const base = ((override && override.base_url) || o.base_url || 'http://localhost:11434').replace(/\/+$/, '');
  const model = (override && override.model) || o.model || 'qwen2.5-coder:7b';
  const isOllama = prov.kind === 'ollama';
  const url = isOllama ? `${base}/api/chat`
    : `${base}${prov.versioned ? '' : '/v1'}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (!isOllama && o.key_value) headers.Authorization = `Bearer ${o.key_value}`;

  // STREAM the reply. A non-streaming reply sends no bytes until generation is done - on a
  // Cloudflare quick tunnel (~100s idle cap) that returns a 524 HTML error page mid-think.
  // Streaming keeps bytes flowing per token, and it is what makes a stall timer possible
  // at all: silence becomes observable.
  const payload = isOllama
    ? { model, messages, stream: true, keep_alive: KEEP_ALIVE,
        options: { temperature: TEMPERATURE, num_ctx: NUM_CTX, num_predict: NUM_PREDICT } }
    // OpenAI-compatible. num_ctx/num_predict are Ollama options and are ignored here, so
    // an explicit max_tokens is the ONLY generation bound this path has.
    : { model, messages, stream: true, temperature: TEMPERATURE,
        ...(NUM_PREDICT > 0 ? { max_tokens: NUM_PREDICT } : {}) };

  const t0 = Date.now();
  const promptTok = estimateTokens(messages);
  let full = '', buf = '', attempts = 0, firstByteMs = null;
  let ac = null, stallTimer = null, stalled = false;

  const disarm = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
  // Generous until the first byte (cold start), tight afterwards (a live stream).
  const armStall = (ms = firstByteMs === null ? MODEL_FIRST_BYTE_MS : MODEL_STALL_MS) => {
    disarm();
    stalled = false;
    stallTimer = setTimeout(() => { stalled = true; try { ac && ac.abort(); } catch {} }, ms);
  };

  try {
    // Transient upstream failures are retried HERE rather than surfacing as a paused run.
    // A free-tier endpoint 503s and 429s routinely; "resumable" means a human clicks
    // Resume, which is exactly what an unattended agent cannot rely on.
    let r = null, lastErr = null;
    for (let attempt = 0; attempt < MODEL_RETRIES; attempt++) {
      attempts = attempt + 1;
      // EACH ATTEMPT GETS ITS OWN BUDGET. Previously one AbortSignal.timeout covered the
      // whole retry sequence including the backoff sleeps, so on a slow backend attempt 3
      // could begin with no time left and was dead before it was sent.
      ac = new AbortController();
      stalled = false;
      const sigs = [ac.signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)];
      if (signal) sigs.push(signal);
      const merged = AbortSignal.any(sigs);
      armStall();
      try {
        r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: merged });
      } catch (fetchErr) {
        disarm();
        if (signal && signal.aborted) throw new Error('stopped');
        if (stalled) throw new Error(`No response from the model for ${MODEL_FIRST_BYTE_MS / 1000}s (nothing arrived at all)`);
        throw fetchErr;
      }
      if (r.ok) break;

      const bodyText = (await r.text().catch(() => '')).slice(0, 400);
      disarm();

      // Context overflow is a 400, which the old classifier called permanent and threw -
      // stopping the run for a human. It is the ONE error with an obvious automatic
      // recovery: prune the history and try again. Typed so the step loop can do that.
      if (r.status === 400 && /context|too long|max_model_len|maximum.{0,20}token|reduce.{0,20}length/i.test(bodyText)) {
        throw overflowError(bodyText || 'no detail returned');
      }

      lastErr = `Model error ${r.status}: ${bodyText.slice(0, 200)}`;
      const transient = r.status === 429 || r.status >= 500;
      if (!transient || attempt === MODEL_RETRIES - 1) throw new Error(lastErr);
      const hinted = parseInt(r.headers.get('retry-after') || '', 10);
      const waitMs = Number.isFinite(hinted) ? hinted * 1000 : Math.min(30_000, 2000 * 2 ** attempt);
      await new Promise((res) => setTimeout(res, waitMs));
      if (signal && signal.aborted) throw new Error('stopped');
    }
    if (!r || !r.ok) throw new Error(lastErr || 'Model call failed');

    // Ollama /api/chat streams NDJSON: { message: { content }, done }. OpenAI-compatible
    // servers stream SSE: "data: {...}" lines ending with "data: [DONE]". Buffer across
    // chunk boundaries so a split JSON line is not dropped.
    const take = (line) => {
      let t = line.trim();
      if (!t) return;
      if (!isOllama) {
        if (!t.startsWith('data:')) return;
        t = t.slice(5).trim();
        if (t === '[DONE]') return;
      }
      try {
        const j = JSON.parse(t);
        if (isOllama) { if (j.message?.content) full += j.message.content; }
        else { const d = j.choices?.[0]?.delta?.content; if (d) full += d; }
      } catch {}
    };

    // A streaming provider can drop the connection mid-body ("Premature close",
    // "terminated"). If bytes already arrived, KEEP them: a truncated reply is not
    // automatically useless - the parser decides. Only a drop with NOTHING is a real error.
    try {
      for await (const chunk of r.body) {
        if (firstByteMs === null) firstByteMs = Date.now() - t0;
        armStall();                     // <- the whole point: silence, not elapsed time
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const l of lines) take(l);
      }
      if (buf) take(buf);
      disarm();
    } catch (streamErr) {
      disarm();
      if (buf) take(buf);
      // A STALL IS NOT A CLOSED CONNECTION, and must not inherit the keep-the-partial rule.
      //
      // When the connection ENDS mid-body the server is done sending, so keeping what
      // arrived and letting the parser judge it is right. A stall is the opposite: the
      // socket is still open and there is no way to know whether 5% or 95% of the reply
      // is in hand. Returning it means the agent executes a HALF-WRITTEN action - a
      // truncated write_file commits half a file over working code, which is the exact
      // class of silent damage the write_file guard exists to prevent. So a stall always
      // fails the call; isConnError classes it resumable and the run retries with its
      // history intact. Caught by modelBudget.test.mjs 'a SILENT stream fails fast'.
      if (stalled) throw new Error(`Model stream went silent for ${(full.length ? MODEL_STALL_MS : MODEL_FIRST_BYTE_MS) / 1000}s after ${full.length} chars`);
      if (!full) throw new Error('Model stream failed before any content: ' + streamErr.message);
      console.warn(`[agent] stream ended early (${stalled ? 'went silent' : streamErr.message}) - keeping ${full.length} chars already received`);
    }

    const ms = Date.now() - t0;
    const outTok = Math.ceil(full.length / 4);
    const tokPerSec = ms > 0 ? +(outTok / (ms / 1000)).toFixed(1) : 0;
    lastModelCall = { provider: prov.name, model, ms, chars: full.length, outTok, promptTok,
                      tokPerSec, firstByteMs, attempts, at: Date.now() };
    if (tokPerSec && tokPerSec < SLOW_TOK_S) {
      console.warn(`[agent] SLOW BACKEND: ${prov.name}/${model} produced ${outTok} tok in ${(ms / 1000).toFixed(1)}s = ${tokPerSec} tok/s (first byte ${firstByteMs}ms). Under ${SLOW_TOK_S} tok/s usually means the server is not using its GPU.`);
    } else {
      console.log(`[agent] model ${prov.name}/${model}: ${outTok} tok in ${(ms / 1000).toFixed(1)}s = ${tokPerSec} tok/s (prompt ~${promptTok} tok)`);
    }
    return full;
  } catch (e) {
    disarm();
    if (e.code === 'CONTEXT_OVERFLOW') throw e;
    if (e.message === 'stopped' || (signal && signal.aborted)) throw e;

    const timedOut = e.name === 'TimeoutError' || stalled || /No response from the model|sent nothing/.test(e.message);
    if (!timedOut) throw e;

    // Say WHICH failure this is and what is actually on the other end, instead of the old
    // hard-coded "the Ollama tunnel may be down. Re-check the tunnel URL in Settings" -
    // which was simply the wrong advice for google/openrouter/vLLM, and wrong even for
    // Ollama when the container was crash-looping rather than unreachable.
    const pr = await probeBackend(base, isOllama, headers);
    const waited = (full.length ? MODEL_STALL_MS : MODEL_FIRST_BYTE_MS) / 1000;
    const what = stalled
      ? (full.length
          ? `Model stream went silent for ${waited}s mid-reply`
          : `Model sent nothing at all for ${waited}s - long enough for a cold start to have finished`)
      : `Model call hit the ${MODEL_TIMEOUT_MS / 1000}s ceiling`;
    const got = full.length ? ` ${full.length} chars had already arrived.` : ' Nothing arrived.';
    throw new Error(`${what}.${got} ${describeProbe(pr, base, prov.name)}`);
  }
}

/** Test hook: model-call budget internals (see modelBudget.test.mjs). */
export const __modelCallTest = {
  callModel, pruneHistory, capMessage, probeBackend, historyBudget, contextTokensFor,
  MODEL_STALL_MS, MODEL_TIMEOUT_MS, MODEL_FIRST_BYTE_MS,
  slimForDisk, isGameGoal,
  // Getters: these are const arrows declared further down, so a direct reference
  // here would hit the temporal dead zone when this object is built.
  get planTaskFor() { return planTaskFor; },
  get plannerSystemFor() { return plannerSystemFor; },
  // A getter: this object is built before the const below it is initialised (TDZ).
  get RUN_ARG_MAX() { return RUN_ARG_MAX; },
};



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
// Overridable for the same reason AGENT_WORKSPACE and AGENT_QUEUE_FILE are: without it
// every isolated harness still wrote its runs into the developer's live agent-runs/, so
// /agent/list returned other tests' history and the 40-run cap kept evicting real runs to
// make room for throwaway ones. That confused two of my own tests today before I noticed
// the directory was the one piece of state I had not isolated.
const RUNS_DIR = process.env.AGENT_RUNS_DIR
  ? resolve(process.env.AGENT_RUNS_DIR)
  : join(__dirname, 'agent-runs');

function pushStep(run, step) {
  run.steps.push({ n: run.steps.length + 1, ts: Date.now(), ...step });
}

// ── Retention. The three things that decide whether this survives being left alone. ──
//
// Measured 2026-09-10 on real run files: a FIVE-step run produced a 1.05 MB JSON, of
// which 400,068 bytes was `args` - the file bodies handed to write_file, stored verbatim
// in the step log. persist() rewrites the WHOLE file after every step, so a long run
// re-serialises everything it has ever written, on every step: quadratic disk I/O whose
// constant is the size of the generated code. Nothing capped the directory, and
// loadRuns() read every file it found straight into memory at boot.
//
// None of that shows up in a test that finishes in ninety seconds. All of it shows up on
// day three of an unattended loop.
const RUN_ARG_MAX = 30_000;      // matches what the trace harvester keeps, so training data is intact
const MAX_RUN_FILES = 300;       // on disk
const TRACE_MAX_BYTES = 64 * 1024 * 1024;

/**
 * Shrink a run for DISK only.
 *
 * Deliberately not done in pushStep: the trace writer harvests `args.content` (to 30,000
 * chars) at the end of a run, and that harvest is the point of this project. Truncating
 * at the source would have silently degraded the training corpus - a much worse bug than
 * the one being fixed. Capping at the same 30,000 means the persisted copy carries
 * everything the harvester would ever read, and nothing more.
 */
function slimForDisk(run) {
  const { abort, busy, ...save } = run;
  if (!Array.isArray(save.steps)) return save;
  save.steps = save.steps.map((st) => {
    if (!st.args) return st;
    let touched = false;
    const args = {};
    for (const [k, v] of Object.entries(st.args)) {
      if (typeof v === 'string' && v.length > RUN_ARG_MAX) {
        args[k] = v.slice(0, RUN_ARG_MAX) + `\n… [${v.length - RUN_ARG_MAX} more characters not kept on disk]`;
        touched = true;
      } else args[k] = v;
    }
    return touched ? { ...st, args } : st;
  });
  return save;
}

/** Keep the newest run files; delete the rest. Cheap, and bounds unattended growth. */
function reapRuns() {
  try {
    const files = readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'))
      .map((f) => { try { return { f, m: statSync(join(RUNS_DIR, f)).mtimeMs }; } catch { return null; } })
      .filter(Boolean)            // a file removed mid-scan must not abort the whole reap
      .sort((a, b) => b.m - a.m);
    for (const { f } of files.slice(MAX_RUN_FILES)) {
      try { unlinkSync(join(RUNS_DIR, f)); } catch {}
    }
  } catch {}
  // NO in-memory eviction here on purpose: evictOldRuns() (AGENT_MAX_RUNS, default 40)
  // already does exactly that, and does it more strictly. A second cap would never be the
  // binding one - dead code that reads like a safety net, which is worse than no net at
  // all because the next person raises one limit and believes they are covered.
  //
  // This function earns its place on ONE case evictOldRuns cannot cover: files left by a
  // PREVIOUS process. loadRuns() reads every file it finds straight into memory before
  // any eviction runs, so a directory that grew while the hub was down becomes a boot-time
  // memory spike. Trimming the directory first bounds that.
}

// Write the full run (incl. history) to disk. abort is an AbortController (not
// serializable) and busy is transient — both are rebuilt on resume, so drop them.
function persist(run) {
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(join(RUNS_DIR, `${run.id}.json`), JSON.stringify(slimForDisk(run)));
  } catch {}
}

// Restore checkpointed runs on boot. Anything caught mid-flight (the process died
// while it was running/awaiting) becomes 'interrupted' so the UI can offer Resume.
function loadRuns() {
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    reapRuns();                       // bound the directory BEFORE reading it all into memory
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
  return /TimeoutError|AbortError|fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|network|socket hang up|timed out|tunnel may be down|Model error 5\d\d|Model error 429|Premature close|terminated|stream failed|went silent|sent nothing|nothing is listening|cloudflare|<!doctype|<html|gateway/i.test(s);
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
/**
 * Fold the last call's rate into the run so throughput is visible in the product, not
 * only in a benchmark script someone remembered to write.
 */
function noteModelCall(run) {
  const st = getLastModelCall();
  if (!st) return;
  run.lastTokPerSec = st.tokPerSec;
  run.slowestTokPerSec = Math.min(run.slowestTokPerSec ?? Infinity, st.tokPerSec || Infinity);
  (run.callStats ||= []).push({ ms: st.ms, tokPerSec: st.tokPerSec, outTok: st.outTok, promptTok: st.promptTok, attempts: st.attempts });
  if (run.callStats.length > 60) run.callStats.shift();
}

const HISTORY_SHARE = 0.55;   // the rest of the window is for the ledger + the reply
function historyBudget(db) { return Math.max(1500, Math.floor(contextTokensFor(db) * HISTORY_SHARE)); }

/**
 * A single message may not eat the whole window.
 *
 * One read_file window or test_web dump can be tens of thousands of characters, and the
 * old prune measured MESSAGES, so sixteen of those sailed through untouched. Truncating
 * the middle keeps both ends, which is where a stack trace and a file's shape live.
 */
function capMessage(m, maxTok) {
  const text = String(m.content || '');
  const maxChars = maxTok * 4;
  if (text.length <= maxChars) return m;
  const keep = Math.floor(maxChars / 2) - 60;
  return { ...m, content: text.slice(0, keep)
    + `\n\n… [${text.length - keep * 2} characters trimmed to fit the context window] …\n\n`
    + text.slice(-keep) };
}

function pruneHistory(run, budgetTokens, opts = {}) {
  const h = run.history;
  const budget = Number.isFinite(budgetTokens) && budgetTokens > 0
    ? budgetTokens : Math.floor(NUM_CTX * HISTORY_SHARE);
  if (!opts.force && h.length <= MAX_HISTORY_MSGS && estimateTokens(h) <= budget) return;
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

  // CAP THE ANCHORS TOO.
  //
  // The anchors are preserved BY DESIGN - drop the goal and the agent works with no
  // objective - so they were exempt from trimming entirely. That exemption is unbounded:
  // whatever lands in one of these slots is carried, at full size, into every subsequent
  // call for the rest of the run.
  //
  // Found 2026-09-10 by hostileModel.test.mjs: a model that answers every request with a
  // 200KB reply answers the PLANNER that way too, so "BUILD PLAN:" became a 50,000-token
  // anchor. Prompts sat at ~57,000 tokens against a 13,516 budget for the whole run and
  // never came down, because pruning dutifully trimmed everything EXCEPT the thing that
  // was actually large. A small model with a runaway repetition loop produces exactly
  // this shape by accident.
  //
  // Anchors get a bigger allowance than ordinary messages - they are the most valuable
  // context in the window - but not an infinite one.
  const anchorCap = Math.max(800, Math.floor(budget / 3));
  for (let i = 0; i < head.length; i++) head[i] = capMessage(head[i], anchorCap);

  // Admit recent messages newest-first until the TOKEN budget is spent.
  //
  // The old line was `h.slice(-(MAX_HISTORY_MSGS - head.length - 1))` - keep the last N
  // MESSAGES, whatever they weigh. Sixteen messages can be 200 tokens or 200,000, so this
  // was not a defence against overflow at all; it defended against message-count growth,
  // which was never a failure mode. Tokens are the only unit the backend charges in.
  const perMsgCap = Math.max(400, Math.floor(budget / 4));
  const headTok = estimateTokens(head);
  const MIN_TAIL = 2;                       // the model must always see the latest result
  const tail = [];
  let spent = headTok;
  for (let i = h.length - 1; i >= 0; i--) {
    const m = h[i];
    if (head.includes(m)) continue;
    if (tail.length >= MAX_HISTORY_MSGS - head.length - 1) break;
    const capped = capMessage(m, perMsgCap);
    const cost = estimateTokens([capped]);
    if (spent + cost > budget && tail.length >= MIN_TAIL) break;
    tail.unshift(capped);
    spent += cost;
  }
  const dropped = h.length - head.length - tail.length;
  if (dropped <= 0) {
    // Nothing to DROP, but an anchor or a survivor may still have been truncated to fit,
    // and that rewrite has to be committed or the capping is silently thrown away.
    const tailChanged = tail.some((m, i) => m !== h[h.length - tail.length + i]);
    const headChanged = head.some((m) => !h.includes(m));
    if (tailChanged || headChanged) run.history = [...head, ...tail];
    return;
  }
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
/**
 * THE PLAN MUST FIT THE GOAL.
 *
 * There was one planner prompt and it assumed a game: "senior game/software architect",
 * SYSTEMS NEEDED (input, player, physics, inventory), GAMEPLAY LOOP with a win/lose
 * condition, a crop state machine as the worked example, and a "first-PLAYABLE slice".
 * Every goal got that frame, including "write a function add(a, b)".
 *
 * A capable model quietly routes around a bad frame. A small one obeys it. Measured by a
 * parallel session: given `add(a, b)`, phi3 (3.8B) produced a game design document with an
 * Input System, spent 4.5 MINUTES on that single call, and never wrote a file; qwen14b
 * answered "SYSTEMS NEEDED — None (this is a simple JavaScript function)" and got on with
 * it. The whole point of this repo is training SMALL models, so a prompt only a big model
 * survives is backwards - and it is the first thing a 1.5B will hit.
 *
 * So the frame branches on the goal. Games still get the game plan, because for a game it
 * is a good plan. Everything else gets four lines.
 */
const GAMEY = /\b(game|gameplay|phaser|godot|unity|sprite|sprites?heet|tilemap|player|enemy|enemies|platformer|rpg|shooter|puzzle|roguelike|level design|score|power-?up|collision|win\/lose|playable)\b/i;

function isGameGoal(goal) { return GAMEY.test(String(goal || '')); }

const PLANNER_SYSTEM_GAME = 'You are a senior game architect. You produce a short, concrete BUILD PLAN. You do NOT write code.';
const PLANNER_SYSTEM_CODE = 'You are a senior software engineer. You produce a SHORT, concrete BUILD PLAN for exactly what was asked - no more. You do NOT write code.';
const plannerSystemFor = (goal) => (isGameGoal(goal) ? PLANNER_SYSTEM_GAME : PLANNER_SYSTEM_CODE);
const PLAN_TASK = `Before any code is written, produce a BUILD PLAN for the goal above. Do NOT write code. Be concise — a numbered list.

1. SYSTEMS NEEDED — the distinct systems required (e.g. input, player, physics, inventory, save, UI).
2. GAMEPLAY LOOP — what the user/player does moment to moment, and the win/lose/end condition.
3. STATE / DATA — the key state each system owns; note any state machine (e.g. crop: untilled -> tilled -> growing -> harvestable -> dead).
4. MISSING / REQUIRED — anything the goal implies but does not spell out (data, UI, save data, balancing values).
5. BUILD ORDER — the smallest first-PLAYABLE slice, then what to add after.

Output ONLY the plan.`;

// The non-game frame. Deliberately four lines: a plan longer than the thing it plans is
// how a small model talks itself out of ever writing the file.
const PLAN_TASK_CODE = `Before any code is written, produce a SHORT BUILD PLAN for the goal above. Do NOT write code.

1. WHAT IT DOES — one sentence.
2. FILES — the file(s) to create or change, and what each is for.
3. BUILD ORDER — the steps, smallest working thing first.
4. HOW TO VERIFY — the command or check that proves it works.

Keep it under 12 lines. If the goal is a single small function or file, say so and keep the plan to two or three lines. Output ONLY the plan.`;

const planTaskFor = (goal) => (isGameGoal(goal) ? PLAN_TASK : PLAN_TASK_CODE);

// Append a (goal -> plan -> code) trace for later v0.3 training. Lives OUTSIDE the
// workspace so a "New project" reset never wipes it.
/**
 * THE RUN INDEX — one line per finished run, kept forever.
 *
 * Three things were being written about a run and none of them answered "is this getting
 * better?":
 *   agent-runs/*.json   the full record, but CAPPED AT 40 and evicted - operational
 *                       history is actively thrown away
 *   traces.jsonl        built for TRAINING (goal -> plan -> code). Its step entries are
 *                       {type, tool, path}: no errors, no timings, no tok/s
 *   ESCALATIONS.md      only the runs that stopped
 *
 * So the questions that actually matter run-over-run - what fraction of calls fail, which
 * tool refuses most often, are prompts growing, did a change help - could only be answered
 * by hand-mining whatever run files had not been evicted yet. That is how the four biggest
 * findings of 2026-09-10 were made (25 wasted calls on one error message, a 26:13
 * rewrite-to-create ratio, 29 ledger tasks, an 11.3% error rate), and none of them were
 * visible from inside the product.
 *
 * This is deliberately TINY - a few hundred bytes per run, never truncated - because the
 * value is entirely in having a long series. Read it with `node server/runIndex.mjs`.
 */
function recordRunIndex(run) {
  try {
    const steps = run.steps || [];
    const errors = {};
    const samples = {};   // one example of what was sent, per distinct failure
    const tools = {};
    const files = new Set();
    for (const st of steps) {
      if (st.tool) tools[st.tool] = (tools[st.tool] || 0) + 1;
      if (st.args && st.args.path) files.add(String(st.args.path).slice(0, 80));
      const res = String(st.result || '');
      if (/^ERROR/.test(res)) {
        // Normalised so the same failure counts as the same failure across runs.
        const key = res.replace(/^ERROR:?\s*/, '').replace(/[0-9]+/g, 'N')
          .replace(/["'`][^"'`]{1,40}["'`]/g, 'X').slice(0, 60).trim();
        errors[key] = (errors[key] || 0) + 1;

        // KEEP ONE SAMPLE OF WHAT THE MODEL ACTUALLY SENT.
        //
        // Counting failures says a tool refused; it never says whether the refusal was
        // right. The edit_file parser demanded code fences and answered "needs a FIND
        // snippet" to correct, unfenced edits - 20 wasted calls and two dead runs - and
        // finding that took an hour of digging through run files the 40-run cap was busy
        // deleting, because the index recorded THAT it failed and not WHAT was sent.
        // One short sample per distinct failure is a few hundred bytes and turns "this
        // keeps breaking" into "look, the tool is wrong".
        if (!samples[key]) {
          const a = st.args || {};
          const shown = {};
          for (const [k, v] of Object.entries(a)) {
            shown[k] = typeof v === 'string'
              ? (v.length > 220 ? v.slice(0, 220) + `…(+${v.length - 220})` : v)
              : v;
          }
          samples[key] = { tool: st.tool || null, args: shown };
        }
      }
    }
    const rates = (run.callStats || []).map((c) => c.tokPerSec).filter((n) => n > 0);
    const prompts = (run.callStats || []).map((c) => c.promptTok).filter(Boolean);
    const rec = {
      ts: Date.now(),
      id: run.id,
      goal: String(run.goal || '').slice(0, 160),
      status: run.status,
      ms: Date.now() - (run.createdAt || Date.now()),
      calls: run.modelCalls || 0,
      steps: steps.length,
      errorCount: Object.values(errors).reduce((a, b) => a + b, 0),
      errors,
      errorSamples: samples,
      // What the run was working from, so a bad plan or a bloated ledger is visible
      // without needing the (evicted) full record.
      planLines: String(run.plan || '').split('\n').filter((l) => l.trim()).length,
      firstBytesMs: (run.callStats || [])[0]?.ms ?? null,
      tools,
      files: [...files].slice(0, 12),
      tokens: run.tokens || 0,
      tokPerSec: rates.length ? { min: Math.min(...rates), max: Math.max(...rates) } : null,
      promptMax: prompts.length ? Math.max(...prompts) : null,
      source: run.source || 'human',
      generation: run.generation || 0,
    };
    // Overridable for the same reason AGENT_RUNS_DIR is: without it every isolated test
    // hub writes into the developer's real index, and the operational history fills up
    // with "hostile probe: drip". I fixed this for the runs directory an hour ago and
    // then shipped the identical leak in the feature that replaced it.
    const f = process.env.RUN_INDEX || join(__dirname, 'run-index.jsonl');
    appendFileSync(f, JSON.stringify(rec) + '\n', 'utf8');
  } catch { /* a record of the work must never break the work */ }
}

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
    // Append-only with no rotation is a slow disk leak: written once per finished run,
    // never truncated. One rollover keeps the recent corpus and bounds the file.
    const tf = join(dir, 'traces.jsonl');
    try {
      if (existsSync(tf) && statSync(tf).size > TRACE_MAX_BYTES) renameSync(tf, tf + '.1');
    } catch {}
    appendFileSync(tf, JSON.stringify(rec) + '\n');
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

// ── BATCH ACTIONS (opt-in: AGENT_BATCH_ACTIONS=1, off by default) ────────────────────────
//
// A reply can hold several actions. The loop has always run the FIRST and discarded the rest:
// of 1,759 recorded real replies, 102 carry more than one action and 53 hold a `finish` that
// is not first. With the flag on, the actions run IN ORDER through the very same single-action
// path in drive(). Every rule below exists because the actions after the first were written
// WITHOUT SEEING ANY RESULT:
//
//   1. At most BATCH_MAX per reply. The rest are reported, never run.
//   2. The batch stops at the first action that fails (batchStepFailed): every later action
//      assumed it had worked.
//   3. `finish` is NEVER executed from inside a batch. Models write a file, run it and finish
//      in one reply, having seen none of the results; finishing blind would let a run declare
//      success after a failing test. The actions before it run, the finish is HELD, and the
//      model is told to send it alone once it has read the results.
//   4. Approval is untouched: each action goes through the same policy path a lone action
//      does. One that needs a human parks the run in awaiting_approval (`break turn`), and
//      the batch ends there - the actions after it are not run, even once it is approved.
//   5. The model gets ONE message back: each executed action's result, then which actions did
//      not run and why (closeBatch).
//
// Returns null whenever the reply should take the ordinary single-action path.
function planBatch(raw, lastPath, first, anchor) {
  const all = parseActions(raw, lastPath, 1000);
  if (all.length < 2) return null;
  // The loop has already validated `first` (parseAction over the whole reply). If the split
  // parse disagrees about it - 1 of 98 real multi-action replies, where the first action's
  // fenced block only appears after a later ACTION: line - trust the path that always ran.
  if (JSON.stringify(all[0]) !== JSON.stringify(first)) return null;
  // A LEADING finish is not blind: nothing else would run this turn, so it has seen every
  // result there is. It takes the ordinary path (finish gate; the extras are reported as
  // dropped). 0 of 1,759 real replies have this shape.
  if (all[0].tool === 'finish') return null;

  // lastPath, SEQUENTIALLY. parseActions resolves a missing PATH against this turn's
  // lastPath, but run one at a time, action 2 would see the lastPath action 1 just set. A
  // sentinel probe finds the actions that inherited it and gives them what the sequential
  // loop would have - otherwise a PATH-less write_file after a write to b.js would land on
  // the PREVIOUS turn's file and overwrite it.
  const SENT = '\u0000lastPath\u0000';
  const probe = parseActions(raw, SENT, 1000);
  if (probe.length === all.length) {
    let lp = lastPath;
    all.forEach((a, i) => {
      if (i > 0 && lp && a.args && probe[i].args?.path === SENT) a.args.path = lp;
      if ((a.tool === 'write_file' || a.tool === 'edit_file') && a.args?.path) lp = a.args.path;
    });
  }

  const fin = all.findIndex((a) => a.tool === 'finish');
  const before = fin === -1 ? all : all.slice(0, fin);
  return {
    all,
    run: before.slice(0, BATCH_MAX),                     // rule 1
    overCap: before.slice(BATCH_MAX),
    held: fin === -1 ? null : all[fin],                  // rule 3
    afterFinish: fin === -1 ? [] : all.slice(fin + 1),
    started: 0, completed: 0, stop: null,
    anchor,                                              // the assistant reply this batch answers
  };
}

// RULE 2's test: did this action fail? The tools' own convention is a result starting with
// ERROR (the marker guard, a FIND that missed, a missing file). Three more signals mean the
// same to an action written on the assumption this one worked: a command that exited
// non-zero (a failing test), a write that does not parse, a browser test that reported errors.
// Returns a short reason, or '' for success.
function batchStepFailed(tool, result, syntaxNote) {
  const r = String(result ?? '');
  if (/^\s*ERROR\b/.test(r)) return 'returned an error';
  if ((tool === 'run_command' || tool === 'run_python') && /(^|\n)EXIT: (?!0\s*$)\S+\s*$/.test(r)) return 'exited non-zero';
  if (/SYNTAX CHECK FAILED/.test(syntaxNote || '')) return 'left a file that does not parse';
  if (tool === 'test_web' && /\[JS ERROR\]|\[console\.error\]|\[HTTP \d/.test(r)) return 'reported errors in the browser';
  return '';
}

// RULE 5: one message back, however the batch ended. Each executed action pushed its own
// feedback through the unchanged single-action path; those are folded into ONE user message
// after the reply they answer, followed by what did not run and why. One message rather than
// four keeps a single turn from eating pruneHistory's recent-message window. Called from a
// `finally`, so it also covers a turn that ended on a refusal, an approval park or a stop.
function closeBatch(run, batch) {
  const desc = (a) => {
    const x = a.args || {};
    const what = x.path || x.cmd || x.which || x.query || x.url || '';
    return `#${batch.all.indexOf(a) + 1} ${a.tool}${what ? ' ' + String(what).slice(0, 60) : ''}`;
  };
  let why = batch.stop?.why || '';
  // An action that began but never reached the end of the path ended the TURN: refused by
  // policy, an unknown tool, parked for approval, or it finished/stopped the run itself.
  if (batch.started > batch.completed) {
    const a = batch.run[batch.completed];
    why = run.status === 'awaiting_approval' ? `${desc(a)} needs human approval - the run is paused on it`
      : run.status === 'running' ? `${desc(a)} did not run (see the message above)`
      : `${desc(a)} ended the run (${run.status})`;
  }
  const lines = [];
  for (const a of batch.run.slice(batch.started)) lines.push(`- ${desc(a)}: NOT run - the batch stopped because ${why}. It was written without seeing that.`);
  for (const a of batch.overCap) lines.push(`- ${desc(a)}: NOT run - over the limit of ${BATCH_MAX} actions per response.`);
  if (batch.held) {
    lines.push(`- ${desc(batch.held)}: HELD, not executed - you wrote it before seeing any of the results above. `
      + `Read them; if the goal really is met, send finish ON ITS OWN as your next response.`);
  }
  for (const a of batch.afterFinish) lines.push(`- ${desc(a)}: NOT run - it came after finish.`);

  const n = batch.all.length;
  const head = `You sent ${n} actions in one response. They were run IN ORDER, one at a time, stopping at the first failure. `
    + `${batch.completed} ran; each result follows.${why ? ` The batch stopped early: ${why}.` : ''}`;
  const tail = lines.length ? `NOT EXECUTED - these did NOT happen:\n${lines.join('\n')}` : `All ${n} actions ran.`;

  const at = batch.anchor ? run.history.lastIndexOf(batch.anchor) : -1;
  const after = at === -1 ? [] : run.history.slice(at + 1);
  if (after.length && after.every((m) => m.role === 'user')) {
    run.history.splice(at + 1, after.length, { role: 'user', content: [head, ...after.map((m) => m.content), tail].join('\n\n────────\n\n') });
  } else {
    run.history.push({ role: 'user', content: `${head}\n\n${tail}` });
  }
  pushStep(run, {
    type: 'note',
    batch: { total: n, ran: batch.completed, held: !!batch.held, notRun: lines.length, stop: why || null },
    text: `Batch: ${batch.completed} of ${n} action(s) ran${why ? ` - stopped: ${why}` : ''}${batch.held ? '; finish held' : ''}.`,
  });
  persist(run);
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
          { role: 'system', content: plannerSystemFor(run.goal) },
          { role: 'user', content: `${run.history[1]?.content || ('GOAL: ' + run.goal)}\n\n${planTaskFor(run.goal)}` },
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

    // Labelled for the per-action loop further down: every exit that used to end this model
    // turn is now `continue turn` / `break turn`, so it still means exactly what it meant.
    turn: while (run.status === 'running' && !budgetExhausted(run)) {
      run.modelCalls++;
      pruneHistory(run, historyBudget(loadDb()));   // fit the PROVIDER's window, in tokens
      let raw;
      run.abort = new AbortController();
      // The ledger is appended to the messages for THIS call only — never pushed into
      // run.history. Two consequences, both wanted: pruneHistory cannot drop it (it was
      // never in the history), and it is always the CURRENT state rather than a stale
      // copy taken at step 1.
      const msgs = withLedger(run.history);
      try {
        raw = await callModel(loadDb, msgs, run.abort.signal);
        noteModelCall(run);
      } catch (e) {
        if (run.status === 'stopped') break;        // Stop aborted the call — exit quietly

        // The BACKEND is the authority on its own context window, not our estimate. When
        // it says the request was too long, squash and retry instead of stopping for a
        // human: this is the one error with an obvious automatic recovery, and an
        // unattended run cannot wait for someone to click Resume.
        if (e.code === 'CONTEXT_OVERFLOW') {
          run.ctxSquashes = (run.ctxSquashes || 0) + 1;
          if (run.ctxSquashes <= 3) {
            const before = run.history.length;
            // Halve again on each successive rejection - our estimate is clearly wrong,
            // so stop trusting it and converge on something the server will take.
            const tighter = Math.floor(historyBudget(loadDb()) / (2 ** run.ctxSquashes));
            pruneHistory(run, tighter, { force: true });
            pushStep(run, { type: 'note', text: `Context overflow — history squashed ${before} → ${run.history.length} messages (~${tighter} tok) and retrying.` });
            run.abort = null;
            continue;
          }
          run.status = 'error';
          pushStep(run, { type: 'error', text: `Context overflow persisted after 3 squashes: ${e.message}. The provider's context_tokens in Settings is probably larger than what the server actually allows.` });
          break;
        }

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
      run.ctxSquashes = 0;                  // a call went through - reset the squash ladder
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
      // FORGIVE ONE REPEAT AFTER A SUBSTITUTION.
      //
      // The guard was firing at the exact moment the loop-break took effect. Substitution
      // triggers on the SECOND duplicate; the guard trips on the THIRD identical response -
      // which is the first response the model gives AFTER receiving the new information.
      // Traced live: the model was handed the full contents of p1_calc.js and killed on the
      // very next turn, so the fix never got a turn to work. One pardon per substitution,
      // and only for a repeat that came after one, so a genuine dead loop still dies at 4.
      if (seenTimes >= 3 && run.justSubstituted) {
        run.justSubstituted = false;
        run.recent = run.recent.filter((r) => r !== norm).concat([norm]);
        pushStep(run, { type: 'note', text: 'Repeat pardoned once: the model had just been handed new information and had not had a turn to use it.' });
      } else if (seenTimes >= 3) {
        run.status = 'stopped';
        pushStep(run, { type: 'error', text: `Stopped: the model produced the same response ${seenTimes} times in the last ${run.recent.length} steps without making progress.` });
        break;
      }

      // How many actions did the model send? parseAction matches ACTION: WITHOUT /g, so it
      // returns the FIRST one and everything after it is discarded in silence. Measured
      // across 855 real responses: 9.7% carried more than one action, and 49 `finish` calls
      // were thrown away because they were not first. The model then re-sends the identical
      // response - nothing it asked for happened - until the repetition guard kills the run.
      // That single silence explains the finish failures AND the "same response 3 times"
      // stops. Counting here rather than in agentParse.js deliberately: the parser has ~15
      // return sites and threading a field through all of them is a merge conflict waiting
      // to happen. The raw text is right here and it is the same information.
      const extraActions = Math.max(0, (raw.match(/ACTION:\s*[a-z_]+/gi) || []).length - 1);
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

      // ── BATCH ACTIONS (opt-in, AGENT_BATCH_ACTIONS=1) - rules at planBatch() ──────────
      // null = the ordinary single-action path, which is ALL there is with the flag off.
      const batch = BATCH_ACTIONS ? planBatch(raw, run.lastPath, action, run.history[run.history.length - 1]) : null;
      // What the dropped-action nudge below may claim (rule 7). Flag off: the raw ACTION:
      // count, unchanged. Flag on: only actions that genuinely did not run - a batch reports
      // its own leftovers in closeBatch(), and a stray `ACTION:` line in the middle of one
      // edit_file (5 of the 102 real multi-action replies) is not a second action at all.
      const dropped = !BATCH_ACTIONS ? extraActions
        : batch ? 0 : Math.max(0, parseActions(raw, run.lastPath, 1000).length - 1);

      // THE PER-ACTION LOOP. With the flag off it runs exactly once, over `action`.
      //
      // Its body is the unchanged single-action path, so every action in a batch gets the
      // same checkpoint, approval policy, marker guard, syntax check, repetition bookkeeping,
      // pushStep and persist a lone action gets - reused, not duplicated. It is deliberately
      // NOT re-indented: that would bury the few lines that changed under 400 that did not.
      //
      // Exits: every pre-existing continue/break is now `continue turn` / `break turn` and
      // ends the model turn exactly as before; the `finally` closes the batch whichever way
      // the turn ends (a refusal, an approval park, a stop). The only exits that end the
      // batch WITHOUT leaving the turn are the two plain `break`s inside `if (batch)`.
      try {
      for (const act of (batch ? batch.run : [action])) {
      if (batch) {
        // Stop pressed (or anything else took the run out of 'running') between actions: do
        // not start another one on a run nobody wants continued.
        if (run.status !== 'running') { batch.stop = { why: `the run is no longer running (${run.status})` }; break; }
        batch.started++;
      }
      const { tool, args = {}, thought = '' } = act;

      // AUTO-CHECKPOINT before anything destructive.
      //
      // The agent cannot be relied on to commit at the right moment, and the whole point
      // of history is that it exists when you did NOT plan to need it. Committing the
      // state BEFORE each mutating step means every bad edit has a restore point, so a
      // run can be let loose and still be recoverable.
      //
      // Read-only tools are skipped: committing before list_dir would bury the log in
      // noise and make the history useless for finding the change that mattered.
      //
      // spawn_subtask is here even though it writes nothing ITSELF. The sub-agent it
      // starts runs its own loop with its own tools and takes NO checkpoints, so an
      // entire delegated build used to land with zero undo points - the one case where
      // you would most want them, because nobody watched it happen. Checkpointing before
      // the hand-off makes the whole delegated chunk revertible as a unit, which is the
      // natural granularity anyway: you undo "the sub-task", not step 6 of it.
      const MUTATING = new Set(['write_file', 'append_file', 'edit_file', 'run_command', 'run_python', 'download_file', 'spawn_subtask']);
      if (MUTATING.has(tool)) {
        try {
          // Create the repo BEFORE asking whether anything changed.
          //
          // isDirty() ran first, and on a workspace with no repo of its own it reported
          // the state of the nearest ENCLOSING repo - the hub's - which was almost always
          // dirty, so the checkpoint fired and committed the hub's tree. Now that git
          // cannot escape the workspace (GIT_CEILING_DIRECTORIES), a fresh workspace has
          // no repo, isDirty() answers "nothing changed", and auto-checkpointing would
          // silently never happen at all - losing the undo history that makes an
          // unattended run safe to leave alone. Caught by loopSmoke.test.mjs.
          await ensureRepo(WORKSPACE);
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
            continue turn;
          }

          // 2. web apps: a browser test since the last edit.
          //    Gated on touchedWeb, not merely "index.html exists" — otherwise a Node or
          //    Python build in a workspace that once held a web app is blocked forever.
          if (hasWeb && run.touchedWeb && run.needsTest) {
            blocked('Verifying in a browser before finishing…',
              'Do NOT finish yet — you changed files since the last clean browser test. Run test_web, read the report, fix any [JS ERROR]/console errors or wrong on-screen values, and only finish once test_web is clean.');
            continue turn;
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
                continue turn;
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
              // A Godot project is graded by RUNNING it, not by parsing it.
              //
              // verifier.verify() reaches Godot through --check-only, so a scene that
              // compiles and does nothing passes the gate: no nodes, no output, nothing on
              // screen, "verified". That is the same shape as every gate bug this file has
              // already been bitten by — it passes because it never asks the question that
              // matters. godotVerify can actually run N frames and tell "ran but nothing
              // observable happened" apart from "60 frames, 4 nodes live", and the agent now
              // has a tool for exactly that, so the GATE should hold work to the same
              // standard instead of leaving the model to volunteer for it.
              const kind = verifier.detectKind(WORKSPACE).kind;
              if (kind === 'godot' || kind === 'gdscript') {
                const files = collectGodotFiles(WORKSPACE);
                if (files.some((x) => /\.gd$/i.test(x.path))) {
                  const gv = await verifyGodotFiles({ files, mode: 'auto', run: true });
                  if (!gv.ok) {
                    blocked('Godot project does not RUN — not finished.',
                      `Do NOT finish yet — it may parse, but it does not run:\n\n${formatGodotVerdict(gv)}\n\nFix that, then finish.`);
                    continue turn;
                  }
                  run.verified = true;
                  pushStep(run, { type: 'note', text: `Verified (godot, ran): ${formatGodotVerdict(gv).split('\n')[0]}` });
                }
              }

              if (!run.verified) {
                const v = await verifier.verify(WORKSPACE);
                if (!v.ok) {
                  blocked(`Project does not run (${v.kind}) — not finished.`,
                    `Do NOT finish yet — the project does not run:\n\n${verifier.format(v)}\n\nFix these, then finish.`);
                  continue turn;
                }
                run.verified = true;    // passed — do not pay for it again
                pushStep(run, { type: 'note', text: `Verified (${v.kind}): ${v.evidence.join('; ')}` });
              }
            } catch { /* verification is evidence, not a gate that can hang a run */ }
          }
        }

        run.status = 'done';
        pushStep(run, { type: 'finish', thought, summary: args.summary || '' });
        break turn;
      }

      if (!tools[tool]) {
        pushStep(run, { type: 'error', thought, text: `Unknown tool: ${tool}` });
        run.history.push({ role: 'user', content: `TOOL ERROR: unknown tool "${tool}". Use only the listed tools.` });
        continue turn;
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
          continue turn;                                   // keep working — do NOT halt
        }
        if (verdict.decision === 'ask') {
          run.pending = { tool, args, thought, why: verdict.reason };
          run.pendingSince = Date.now();   // the approval timeout measures from HERE
          run.status = 'awaiting_approval';
          pushStep(run, { type: 'approval_request', tool, args, thought, why: verdict.reason });
          await escalate(WORKSPACE, {
            runId: run.id, goal: run.goal, status: run.status, reason: 'approval',
            detail: `${tool}: ${args.cmd || args.path || ''} — ${verdict.reason}`,
          });
          break turn;
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

      // ── MECHANICAL LOOP BREAK ───────────────────────────────────────────────
      //
      // The run-killer is an orientation tool that returns what the model already has: the
      // opening message lists the workspace files, `list_dir .` echoes that list back
      // byte-for-byte, the context is unchanged, so the model emits the identical action
      // again and dies to the repetition guard - reported as "not making progress" when the
      // truth is we handed it nothing to progress WITH.
      //
      // EVERY advisory fix for this failed, and why is worth recording. Repetition is
      // self-reinforcing: once two identical assistant turns are in history the model copies
      // that precedent, and a sentence cannot outweigh it. Measured on the real stuck
      // context, 5 samples each:
      //
      //   control (return the same result)         list_dir x5     productive 0/5
      //   advisory ("you already ran this")        read_file x4    productive 0/5
      //   MECHANICAL (substitute what it needed)   edit_file x5    productive 5/5
      //
      // A live advisory attempt scored WORSE than doing nothing (tool errors 0 -> 8) and was
      // reverted. So this does not ask; it REFUSES the duplicate and hands back the file the
      // goal names, as the NEWEST thing in context - position matters, because the same
      // contents injected at the TOP of the prompt scored 0/5. Capped at 2 per run so a
      // genuine re-list cannot turn into the hub driving the run.
      // Every READ-ONLY tool that can return the same answer twice, not just the three I
      // guessed first. Measured on live runs: the deterministic failures were looping on
      // `list_assets` and `task_list`, both of which I had missed, so no substitution fired
      // and those two shapes failed 3/3. A tool belongs here if repeating it cannot change
      // the world - mutating tools are deliberately absent, since a second write_file is a
      // real action and must never be swapped out from under the model.
      // The read-only tools OBSERVED looping, and only those. Widening this to every
      // read-only tool cost 20 tool errors across 3 passes against 0, because for some of
      // them the substitution is meaningless: a duplicate `read_file` swapped for the same
      // file's contents returns exactly what it already returned, and `recall`/`git_log`/
      // `git_diff` answer questions that file contents do not. Those runs then flailed for
      // 12-26 steps instead of 4-8. `list_assets` and `task_list` ARE here because live
      // traces caught both looping. Mutating tools stay out on principle - a second
      // write_file is a real action and must never be swapped out from under the model.
      const ORIENT = new Set(['list_dir', 'outline_file', 'search_file', 'list_assets', 'task_list']);
      const sig = `${tool}|${JSON.stringify(args || {})}|${String(result).slice(0, 800)}`;
      run.resultSigs = run.resultSigs || [];
      const duplicate = run.resultSigs.includes(sig);
      run.resultSigs.push(sig);
      if (run.resultSigs.length > 40) run.resultSigs = run.resultSigs.slice(-40);

      let substituted = null;
      if (duplicate && ORIENT.has(tool) && (run.escalations || 0) < 2) {
        // The file the GOAL names, if it exists - that is what an edit goal is starving for.
        const named = String(run.goal || '').match(/[\w.\-/]+\.(?:m?js|py|html?|css|json|md|txt)/gi) || [];
        let target = named.find((f) => { try { return statSync(join(WORKSPACE, f)).isFile(); } catch { return false; } });
        if (!target) {
          const skip = new Set(['package.json', 'TASKS.md', 'ESCALATIONS.md', 'NOTES.md']);
          try {
            target = readdirSync(WORKSPACE)
              .filter((f) => !skip.has(f) && !f.startsWith('.') && statSync(join(WORKSPACE, f)).isFile())
              .sort((a, b) => statSync(join(WORKSPACE, b)).mtimeMs - statSync(join(WORKSPACE, a)).mtimeMs)[0];
          } catch { /* unreadable workspace - leave it to the normal result */ }
        }
        if (target) {
          try {
            const src = readFileSync(join(WORKSPACE, target), 'utf8').slice(0, 6000);
            run.escalations = (run.escalations || 0) + 1;
            substituted = `TOOL RESULT (read_file ${target}):\n\`\`\`\n${src}\n\`\`\`\n\n`
              + `(You called ${tool} twice with the same arguments and got the same answer, so it was replaced with the contents of ${target}. You now have what you need — do the work.)`;
            run.justSubstituted = true;   // buys the model one pardon from the repetition guard
            pushStep(run, { type: 'note', text: `Repeated ${tool} returned nothing new — substituted the contents of ${target}.` });
          } catch { /* unreadable file - leave it to the normal result */ }
        }
      }

      let feedback = substituted || `TOOL RESULT (${tool}):\n${result}${syntaxNote}`;

      // Say so when we dropped the rest of a batch. Silence here is what created the loop:
      // the model got no signal that its 2nd..Nth actions never happened, so it re-sent the
      // same block verbatim and died to the repetition guard. Naming the dropped count also
      // makes the feedback DIFFERENT from last step's, which is what actually breaks the
      // cycle - the model has something new to react to instead of the identical result.
      if (dropped > 0) {
        feedback += `\n\n⚠️ You sent ${dropped + 1} actions in one response. ONLY THE FIRST (${tool}) was executed — the other ${dropped} were DISCARDED and did NOT happen.`
          + ` Send exactly ONE action per response and wait for its result. If you meant to finish, send finish on its own as your NEXT response.`;
      }
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
            break turn;
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
            break turn;
          }
        }
      }
      pushStep(run, { type: 'tool', tool, args, thought, result });
      run.history.push({ role: 'user', content: feedback });
      persist(run);   // checkpoint after each completed step — a drop loses at most one step
      if (batch) {
        batch.completed++;
        // RULE 2: stop at the first failure. Every later action in this reply was written on
        // the assumption that this one worked, without seeing its result.
        const failed = batchStepFailed(tool, result, syntaxNote);
        if (failed) { batch.stop = { why: `#${batch.all.indexOf(act) + 1} ${tool} ${failed}` }; break; }
      }
      }   // ── end of the per-action loop
      } finally {
        if (batch) closeBatch(run, batch);
      }
    }

    const spent = budgetExhausted(run);
    if (run.status === 'running' && spent) {
      run.status = 'stopped';
      pushStep(run, { type: 'error', text: `Stopped: ran out of ${spent}. Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.` });
    }
  } finally {
    // `run.busy = false` USED TO BE HERE, and that was the bug. The status is already
    // terminal by now, so releasing busy at the top told every client the run was over and
    // freed the workspace lock (activeTopLevelRun) while the rollback below was still walking
    // git history and rewriting files. `fuzzLoop.mjs 1 4 14` reported p1_calc.js BROKEN
    // although its history held a version that parsed: the fuzzer saw 'stopped', checked the
    // workspace and killed the hub mid-rollback. The same gap lets /agent/start accept the
    // next goal while this run is still restoring files underneath it. busy is now released
    // only once the repair is done - see below.

    // ── DO NOT LEAVE CODE THAT WILL NOT PARSE ──────────────────────────────────
    //
    // quickCheck already runs after every write and tells the model "❌ SYNTAX CHECK
    // FAILED". That is advisory, and advisory does not work: audited 67 run workspaces and
    // 10 ended holding .js that does not parse - every one flagged at the time. A run that
    // ends leaving a broken file is worse than one that ends having changed nothing, because
    // the next run inherits the wreckage and the goals after it all fail on the same file.
    //
    // The repair is already on disk. Mutating tools checkpoint BEFORE they write, so HEAD
    // holds the last version that existed before the damaging write. Restore it - but only
    // when the OLD version actually parses, so this can never make things worse, and only
    // for languages quickCheck understands.
    if (['done', 'error', 'stopped'].includes(run.status)) {
      try {
        const files = readdirSync(WORKSPACE).filter((f) => /\.(c|m)?js$|\.py$/i.test(f));
        for (const f of files.slice(0, 40)) {
          if (!(await quickCheck(f))) continue;                 // parses fine - leave it alone
          const full = join(WORKSPACE, f);
          const broken = readFileSync(full, 'utf8');

          // Search BACK through this file's history; do NOT just look at HEAD.
          //
          // Every mutating tool checkpoints BEFORE it runs, so the checkpoint taken after a
          // bad write CONTAINS the bad write. By the end of a run HEAD holds the broken file
          // and the last good version is several commits back. Verified offline against real
          // replayed output: the HEAD-only version found a broken file at HEAD, restored
          // nothing, and reported success - it would have repaired almost nothing in a real
          // run while looking like it worked.
          let restored = false;
          for (const sha of await fileHistory(WORKSPACE, f, 25).catch(() => [])) {
            const prev = await showFile(WORKSPACE, sha, f).catch(() => null);
            if (prev == null || prev === broken) continue;
            writeFileSync(full, prev, 'utf8');
            if (!(await quickCheck(f))) { restored = true; break; }   // this one parses - keep it
            writeFileSync(full, broken, 'utf8');                      // no better; restore and keep looking
          }
          if (restored) pushStep(run, { type: 'note', text: `${f} did not parse at the end of the run — restored the last committed version that did.` });
        }
      } catch { /* never let the repair take the run down */ }
    }
    // The workspace is settled - release it. Before the queue hand-off below, which calls
    // autoStart and needs the workspace free. No await between the parked-run break and
    // here, so awaiting_approval/interrupted release exactly as promptly as before.
    run.busy = false;

    if (['done', 'error', 'stopped'].includes(run.status)) { saveTrace(run); recordRunIndex(run); }
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

    // ── Mark the work done ──────────────────────────────────────────────────────
    // FINISHING IS NOT SUPERVISION, and this used to be inside the gate below.
    //
    // With the supervisor off - the posture all three sessions have been recommending -
    // a clean run wrote its file, verified it, passed the finish gate, and then left its
    // queue item on 'taken' for ever. Reproduced on an isolated hub: item 1 taken, item 2
    // queued behind an `after` that could never reach 'done', unchanged at t+60s. So the
    // unattended path worked and the human-paced one did not, which is exactly backwards,
    // and `requeueOrphans()` then re-ran the already-succeeded goal on the next boot -
    // silent duplicate work, and for a write_file goal that overwrites whatever came after.
    //
    // The failure path was fixed hours ago and this comment was already sitting above it:
    // an item stuck on 'taken' is "invisible to dequeue, and re-queued on the next restart
    // as if nothing had happened". That was a word-for-word description of what the
    // SUCCESS path was still doing. Reported by the Strategy session with a reproduction.
    if (run.status === 'done' && !run.depth && run.queueItemId) {
      try { workQueue.complete(run.queueItemId, { status: 'done', runId: run.id }); }
      catch { /* the queue must never take a finished run down with it */ }
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
        const next = workQueue.dequeue({ completedIds: completedQueueIds() });
        if (next) {
          const stop = supervisorBrake(next);
          if (stop) {
            // Put it back: this is "a human should look at this", not "throw the work away".
            workQueue.release(next.id);
            pushStep(run, { type: 'note', text: `Supervisor stopped: ${stop} The queue keeps "${next.goal.slice(0, 60)}" — start it from the queue panel to continue.` });
          } else {
            pushStep(run, { type: 'note', text: `Supervisor: picking up the next queued goal (gen ${next.generation || 0}) — ${next.goal.slice(0, 100)}` });
            autoStart(loadDb, next);   // checks the workspace is free at the moment of starting
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
// (an `export const supervisorOn = () => supervisorEnabled` lived here. Nothing ever
//  imported it - it was added reflexively while making the supervisor a setting. An export
//  with no importer is a promise to a caller that does not exist; wiring.test.mjs catches
//  this class now instead of leaving it to be noticed by eye.)

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

  // Only a genuine failure earns an automatic retry - and `status` alone cannot tell you
  // whether this was one.
  //
  // A person pressing Stop and the stuck-loop guard tripping BOTH land in status
  // 'stopped'. Re-queueing what someone just cancelled, at 4am, is the single most
  // obnoxious thing an unattended agent could do - but refusing to retry a model that got
  // stuck is how a chain dies at the first stumble. Measured 2026-09-10 on a real
  // unattended run: the loop guard fired, the item was marked 'stopped', no repair was
  // spliced in, the four goals behind it were stranded on an id that could never reach
  // 'done', and the note told the operator "you stopped this one" - which nobody had.
  //
  // `reason` is what separates them, it is computed correctly one frame up (from the
  // error text, for the escalation), and it was already being passed in here and thrown
  // away. A human Stop leaves no matching error text and falls through to 'error', so it
  // stays non-retryable; a guard names itself. 'interrupted'/'tunnel' is deliberately NOT
  // retryable: those runs are resumable with their history intact, and retrying from
  // scratch throws that away and redoes work the run had already done.
  const machineFailure = ['budget', 'loop', 'parse', 'same_error'].includes(reason);
  if (run.status && run.status !== 'error' && !machineFailure) {
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
  autoStart(loadDb, r.item);
}

/**
 * Start a queued item on the agent's own initiative - the ONE place that may.
 *
 * Every human entry point (/start, /queue/run) refuses to start a second top-level run,
 * because there is a single shared WORKSPACE and two runs writing into it corrupt each
 * other. Both automatic paths - the supervisor pulling the next goal, and the retry of a
 * failed one - called startRun directly and never checked. The invariant held only for
 * people. A Build pressed in the 250ms window, or a resumed interrupted run, would have
 * shared the workspace with an auto-started one.
 *
 * The check is inside the timeout, at the moment of starting, not when scheduling: that
 * is the window the race lives in. Losing the race releases the item back to 'queued'
 * rather than dropping it - the work is still wanted, it just needs the workspace free.
 */
/**
 * THE UNATTENDED LOOP. Three ways a chain dies, three different answers.
 *
 * The supervisor advances only when a run finishes with status 'done' (see "Take the next
 * ticket"). That is correct for a supervised session and fatal for an unattended one,
 * because every other terminal state is NORMAL, not exceptional - measured on real runs
 * today: a refused command -> awaiting_approval, a dropped socket -> interrupted, a
 * loop-guard trip or an exhausted budget -> stopped. Each one left the queue full and the
 * hub idle forever, because nothing polls: an idle hub with queued work stays idle.
 *
 * So this tick handles exactly the three, in priority order, and does at most ONE thing
 * per pass so a bad state cannot cascade:
 *
 *   1. A STALE APPROVAL IS DENIED - never approved. This is the important one to get
 *      right. Auto-approving a command a human was asked about would turn the whole
 *      approval gate into theatre; the gate exists precisely because nobody is watching.
 *      Denying is safe, is already a supported path, and tells the agent "continue another
 *      way or finish" - which is what an unattended agent should do with a command it is
 *      not allowed to run. It also releases the workspace, which is what unblocks the
 *      chain.
 *   2. AN INTERRUPTED RUN IS RESUMED. Those are resumable BY DESIGN with their history
 *      intact - a tunnel blip should not need a human.
 *   3. QUEUED WORK IS PICKED UP when nothing holds the workspace, behind the same brakes
 *      every other auto-start uses (generation cap, hourly ceiling).
 *
 * OFF unless the supervisor is on. Turning the supervisor on is already the deliberate
 * "run without me" act; this makes that mean what it says.
 */
const TICK_MS = Math.max(15, Number(process.env.AGENT_TICK_S || 60)) * 1000;
const APPROVAL_TIMEOUT_MS = Math.max(1, Number(process.env.AGENT_APPROVAL_TIMEOUT_MIN || 15)) * 60_000;
let tickTimer = null;

function supervisorTick(loadDb) {
  if (!supervisorEnabled) return;
  try {
    const all = [...runs.values()];

    // 1. Stale approval -> DENY (never approve).
    const waiting = all.find((r) => r.status === 'awaiting_approval' && r.pending && !r.depth);
    if (waiting) {
      const age = Date.now() - (waiting.pendingSince || waiting.updatedAt || waiting.createdAt || 0);
      if (age >= APPROVAL_TIMEOUT_MS) {
        const { tool, args } = waiting.pending;
        waiting.pending = null;
        pushStep(waiting, { type: 'approval_denied', tool, args,
          text: `No answer for ${Math.round(age / 60000)} min while running unattended — treated as DENIED. Never auto-approved.` });
        waiting.history.push({ role: 'user', content: `The command "${String(args?.cmd || tool).slice(0, 160)}" was NOT approved (nobody answered while running unattended). Do not run it. Continue another way, or finish.` });
        waiting.status = 'running';
        persist(waiting);
        driveDetached(loadDb, waiting);
      }
      return;                       // it holds the workspace either way
    }

    if (activeTopLevelRun()) return; // something is working; leave it alone

    // 2. Resume an interrupted run before starting anything new.
    const stalled = all
      .filter((r) => r.status === 'interrupted' && !r.depth && !r.busy)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (stalled) {
      stalled.status = 'running';
      pushStep(stalled, { type: 'note', text: 'Resumed automatically (supervisor).' });
      persist(stalled);
      driveDetached(loadDb, stalled);
      return;
    }

    // 3. Nothing running, nothing to resume - take the next ticket.
    const next = workQueue.dequeue({ completedIds: completedQueueIds() });
    if (!next) return;
    const stop = supervisorBrake(next);
    if (stop) { workQueue.release(next.id); return; }
    console.log(`[agent] supervisor picked up a queued goal: ${String(next.goal).slice(0, 70)}`);
    autoStart(loadDb, next);
  } catch (e) {
    console.error('[agent] supervisor tick failed:', e.message);
  }
}

/** Start/stop the tick with the supervisor. Exported for tests. */
export function startSupervisorTick(loadDb) {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => supervisorTick(loadDb), TICK_MS);
  tickTimer.unref?.();              // never hold the process open just for this
  return tickTimer;
}

/**
 * Automatic starts that have been scheduled but have not fired yet.
 *
 * activeTopLevelRun() answers "is a run holding the workspace", and in the 250ms between
 * one chained step finishing and the next starting, the honest answer is no: the old run
 * is done and the new one does not exist yet. So anything that only asks that question -
 * POST /reset did - sees an idle workspace, deletes it, and the next step then starts on an
 * empty directory it expected to find its predecessor's output in. The gap is short; it is
 * also exactly where an unattended chain spends its time between every pair of steps.
 *
 * Decremented at the TOP of the callback, deliberately: every path after it either declines
 * (the run holding the workspace is visible to activeTopLevelRun) or calls startRun, which
 * registers the new run as 'running' synchronously. There is no instant where neither
 * guard can see the work.
 */
let pendingAutoStarts = 0;

function autoStart(loadDb, item) {
  pendingAutoStarts++;
  setTimeout(() => {
    pendingAutoStarts--;
    const active = activeTopLevelRun();
    if (active) {
      workQueue.release(item.id);
      pushStep(active, { type: 'note', text: `Queue: "${item.goal.slice(0, 60)}" was due to start automatically, but this run holds the workspace. It stays queued.` });
      return;
    }
    // Counted here, not when scheduling. The hourly ceiling exists to bound runs that
    // actually START; charging it for an attempt that was declined would let a busy
    // workspace silently eat the budget and throttle work nobody ever ran.
    autoStarts.push(Date.now());
    try { startRun(loadDb, item.goal, { queueItemId: item.id, source: 'queue', generation: item.generation || 0 }); }
    catch { workQueue.release(item.id); }
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
  driveDetached(loadDb, run);
  return run;
}

/**
 * Start the run loop in the background, and make sure a rejection stays inside the run.
 *
 * `drive` is async and was called fire-and-forget from five places with nothing attached.
 * Anything that throws before its own try/catch - a bad db handle, a failure while building
 * the opening context - becomes an unhandled promise rejection, and Node terminates the
 * process on those. So one unexpected throw in ONE run took down the entire hub: the API,
 * every terminal session, any other run in flight. Found by a test whose fake db threw on
 * purpose; the test died with the server rather than failing.
 *
 * A run that cannot start is a failed run. It is not a reason for the server to exit.
 */
function driveDetached(loadDb, run) {
  Promise.resolve()
    .then(() => drive(loadDb, run))
    .catch((e) => {
      run.status = 'error';
      run.busy = false;
      pushStep(run, { type: 'error', text: `The run loop stopped unexpectedly: ${e?.message || e}` });
      try { persist(run); } catch { /* the disk is not worth a second failure here */ }
      // A queue-started run that dies this way must not leave its item stuck in 'taken'.
      if (run.queueItemId) { try { workQueue.release(run.queueItemId); } catch {} }
    });
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

  // The unattended tick. Defined but never called is not a feature - it is dead code that
  // reads like one, which is exactly what wiring.test.mjs exists to catch. Started here
  // because this is where loadDb becomes available; it no-ops unless the supervisor is on.
  startSupervisorTick(loadDb);
  if (supervisorEnabled) console.log(`[agent] unattended tick every ${TICK_MS / 1000}s (stale approvals DENIED after ${APPROVAL_TIMEOUT_MS / 60000} min, interrupted runs resumed, queued work picked up)`);

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
        let st; try { st = statSync(fp); } catch { continue; }   // vanished mid-walk (see list_dir)
        if (st.isDirectory()) walk(fp, r);
        else out.push({ path: r, size: st.size });
      }
    };
    walk(WORKSPACE);
    res.json(out);
  });

  // Poll run state (client strips the heavy history field).
  router.get('/:id', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    // busy IS reported: a terminal status with busy still set means teardown (the syntax
    // rollback) is in progress, and the workspace is not yet in its final state.
    const { history, busy, ...view } = run;
    res.json({ ...view, busy: !!busy });
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
    driveDetached(loadDb, run);
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
    driveDetached(loadDb, run);
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
    driveDetached(loadDb, run);
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
    // DELETES THE ENTIRE WORKSPACE, and used to check nothing first. Its neighbours
    // (/:id/resume, /:id/followup) all 409 while a run is active; this one, the only route
    // that destroys files outright, did not. The client greying out "New project" was the
    // only protection, and it had three holes: a run in teardown already reads 'done' while
    // the syntax rollback is still rewriting files; a second tab or any API client has no
    // client gate at all; and a supervisor chain sits in the 250ms gap between steps, where
    // nothing is "running". Reported by the Strategy session.
    // activeTopLevelRun() covers the first two (it counts `busy` through teardown since
    // 98c02c6, and 'awaiting_approval'); pendingAutoStarts covers the third.
    const active = activeTopLevelRun();
    if (active) {
      return res.status(409).json({
        error: `a run is active in this workspace (${active.status}${active.busy ? ', finishing up' : ''}) — stop it first`,
        busy: true,
      });
    }
    if (pendingAutoStarts > 0) {
      return res.status(409).json({
        error: 'a queued goal is about to start in this workspace — stop the queue first',
        busy: true,
      });
    }
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
