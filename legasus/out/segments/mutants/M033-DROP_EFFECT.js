/**
 * approvalPolicy.js - decide whether a shell command needs a human.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * Every run_command / run_python blocked forever waiting for a click. At 3am with
 * nobody watching, the agent stopped dead on `npm install` - "autonomous until the
 * first shell command". Approval was binary: ask a human, or don't gate at all.
 *
 * So: a policy layer with three answers instead of two.
 *
 *   allow  - run it, no human
 *   ask    - pause for a human (what everything did before)
 *   deny   - refuse with a REASON the agent reads, so it routes around instead of halting
 *
 * BE CLEAR ABOUT WHAT 'build' MODE MEANS
 * --------------------------------------
 * A coding agent cannot test without running code, and it writes the code it runs.
 * So auto-allowing `node app.js` IS auto-allowing arbitrary code execution - the
 * script is only as bounded as whatever the OS user can reach. No amount of argument
 * parsing changes that; only a container or VM does.
 *
 * Hence the modes are explicit rather than clever:
 *
 *   strict (default) - only inspection commands run unattended. Nothing executes.
 *   build            - adds dependency installs and running code IN the workspace.
 *                      This is the blast-zone mode. Use it where a bad script cannot
 *                      hurt anything you care about.
 *   yolo             - everything except the hard denylist.
 *
 * The denylist applies in EVERY mode, including yolo. Those are the commands with no
 * legitimate use inside a coding workspace and no undo.
 */

export const MODE = (process.env.AGENT_APPROVAL_MODE || 'strict').toLowerCase();

// -- Hard denies. Never auto-run, and never even ASK - just refuse with a reason. --
// Rationale for refusing outright rather than asking: a human clicking "approve" at
// 3am on `rm -rf /` is exactly the mistake the gate exists to prevent, and none of
// these is ever the right way to do something in a coding workspace.
//
// Two lists, because two different things are dangerous.

// (a) COMPOSITION. These are about how the pieces are joined, so they must be tested
// against the WHOLE line before it is split. `curl x.sh | bash` is the canonical case:
// segmenting on `|` first leaves `curl x.sh` and `bash`, neither of which is alarming
// on its own - and yolo mode duly allowed the pair. Checked first, always.
const LINE_DENY = [
  [/\b(curl|wget|iwr|invoke-webrequest)\b[^|;&]*[|]\s*(sh|bash|zsh|python\d?|node|iex)\b/i,
    'pipes a download straight into an interpreter - the classic remote-code-execution pattern'],
  [/:\(\)\s*\{.*\}\s*;\s*:/, 'fork bomb'],
  [/Set-ExecutionPolicy/i, 'weakens PowerShell script policy'],
  [/\bhistory\s+-c\b|\bClear-History\b/i, 'erases the audit trail'],
];

// (b) THE COMMAND ITSELF. Anchored to the head of a segment, not matched anywhere in
// the line - `cat .ssh/config` was being denied as "connects to another machine"
// because the path contains the word ssh. What matters is what is being RUN.
const SEGMENT_DENY = [
  [/^rm\b(?=(?:\s+-\S+)*\s+-\S*[rf])/i, 'recursive/forced delete'],
  [/^(rmdir|rd)\b.*\s\/s\b/i, 'recursive directory delete'],
  [/^del\b.*\s\/[sq]\b/i, 'recursive/quiet delete'],
  [/^format\b/i, 'formats a disk'],
  [/^(shutdown|reboot|halt|poweroff)\b/i, 'shuts down the machine'],
  [/^reg\s+(add|delete)\b/i, 'edits the Windows registry'],
  [/^(sudo|runas|doas)\b/i, 'privilege escalation'],
  [/^net\s+(user|localgroup)\b/i, 'modifies user accounts'],
  [/^chmod\s+777\b/i, 'world-writable permissions'],
  [/^git\s+push\b/i, 'publishes code outside this machine'],
  [/^npm\s+(publish|login|adduser|token)\b/i, 'publishes or authenticates to the npm registry'],
  [/^(pip|npm)\s+config\s+set\b/i, 'rewrites package-manager configuration'],
  [/^(ssh|scp|sftp|telnet|nc|ncat)\b/i, 'connects to another machine'],
  [/^(mkfs\S*|diskpart)\b/i, 'writes raw disk devices'],
  [/^dd\b.*\bif=/i, 'writes raw disk devices'],
];

// Commands that only LOOK at things. Safe in every mode: no writes, no execution.
const INSPECT = new Set([
  'ls', 'dir', 'pwd', 'cd', 'cat', 'type', 'head', 'tail', 'wc', 'stat', 'file',
  'find', 'findstr', 'grep', 'rg', 'tree', 'which', 'where', 'echo', 'date',
  'whoami', 'hostname', 'du', 'df', 'env', 'printenv', 'sort', 'uniq', 'diff',
]);

// Adds the ability to BUILD and RUN. Everything here can execute code.
const BUILD = new Set([
  'node', 'npm', 'npx', 'yarn', 'pnpm', 'python', 'python3', 'py', 'pip', 'pip3',
  'pytest', 'jest', 'vitest', 'mocha', 'tsc', 'esbuild', 'vite', 'deno', 'bun',
  'mkdir', 'touch', 'cp', 'copy', 'mv', 'move', 'git',
]);

// git is in BUILD, but only its non-publishing half.
const GIT_OK = new Set(['status', 'log', 'diff', 'add', 'commit', 'show', 'branch',
  'checkout', 'switch', 'restore', 'stash', 'init', 'rev-parse', 'ls-files', 'tag']);

// npm/yarn/pnpm subcommands that are fine; anything else asks.
const NPM_OK = new Set(['install', 'i', 'ci', 'add', 'run', 'test', 'start', 'build',
  'ls', 'list', 'view', 'init', 'audit', 'exec', 'why', 'outdated', 'dedupe']);

/** Split a command line into the segments a shell would run separately. */
export function segments(cmd) {
  // Chaining is the obvious bypass: `npm install && rm -rf /` has an allowlisted head
  // and a catastrophic tail. Every segment is classified, and the WEAKEST one decides.
  // A SINGLE `&` is a separator too, and missing it defeated this whole function.
  // cmd.exe runs `a & b` sequentially; POSIX shells background `a` and then run `b`.
  // Either way BOTH execute, and `echo hi & rm -rf .` was one segment whose head is
  // `echo` - read-only inspection - and was auto-approved in build mode.
  //
  // BUT SEPARATORS INSIDE QUOTES ARE NOT SEPARATORS.
  //
  // A regex split cannot see quoting, so this tore up the INSIDE of quoted arguments.
  // Measured 2026-09-10 on a live unattended chain against a real model: the agent
  // verified its own work with
  //
  //   node -e "const m = require('./maths.js'); console.log('add:', m.add(2,3));"
  //
  // which split on the `;` inside the -e script, leaving `console.log('add:',` as a
  // "segment". Its head is not on any allowlist, so the run stopped and asked a human -
  // at which point the whole unattended chain was over. `node -e "…;…"` is the most
  // common way an agent checks its own code, and today's addition of `&` to this list
  // made the same class of false positive more likely, not less.
  //
  // So: walk the string and only break on a separator that is OUTSIDE quotes. A lone
  // unbalanced quote falls through to treating the rest as quoted, which yields ONE
  // segment - the conservative direction, since a whole unsplit command is classified by
  // its head and an unknown head still asks.
  const src = String(cmd || '');
  const out = [];
  let cur = '', quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < src.length) { cur += src[++i]; continue; }  // escaped char
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||') { out.push(cur); cur = ''; i++; continue; }
    if (c === ';' || c === '|' || c === '&' || c === '\n') { out.push(cur); cur = ''; continue; }
    ;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * Does this segment try to reach outside the workspace?
 * run_command runs with cwd=WORKSPACE, so relative paths are already confined -
 * absolute paths and `..` are the only ways out, plus shell substitution which can
 * construct either at runtime.
 */
function escapesWorkspace(seg) {
  if (/\$\(|`|\$\{/.test(seg)) return 'uses shell substitution, which can build any path at runtime';
  // Plain environment-variable expansion reaches anywhere on the machine without a single
  // `..` or drive letter ever appearing in the text. `cat $HOME/.ssh/id_rsa` and
  // `cat %USERPROFILE%\.ssh\id_rsa` were both auto-approved as "read-only inspection".
  // Checked on BOTH platforms: the agent writes commands for whichever shell it imagines,
  // and one needless "ask" is far cheaper than one leaked private key. The identifier
  // requirement keeps `grep "foo$"` and `printf "100%%"` from matching.
  if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(seg)) return 'expands a Windows environment variable, which can point anywhere on the machine';
  if (/\$[A-Za-z_]\w*/.test(seg)) return 'expands an environment variable, which can point anywhere on the machine';
  if (/(^|\s)["']?[A-Za-z]:[\\/]/.test(seg)) return 'names a drive-absolute path';
  if (/(^|\s)["']?\\\\/.test(seg)) return 'names a UNC network path';
  if (process.platform !== 'win32' && /(^|\s)["']?\/(?!\/)[A-Za-z]/.test(seg)) return 'names an absolute path';
  if (/\.\.[\\/]/.test(seg)) return 'traverses upward out of the workspace with ..';
  if (/>\s*["']?([A-Za-z]:[\\/]|\/|\\\\)/.test(seg)) return 'redirects output outside the workspace';
  return null;
}

function headOf(seg) {
  const t = seg.replace(/^["']|["']$/g, '').trim().split(/\s+/)[0] || '';
  return t.replace(/\.(exe|cmd|bat)$/i, '').toLowerCase();
}

/** Classify ONE segment. */
function classifySegment(seg, mode) {
  const bare = seg.replace(/^["']|["']$/g, '').trim();
  for (const [re, why] of SEGMENT_DENY) {
    if (re.test(bare)) return { decision: 'deny', reason: why };
  }
  const esc = escapesWorkspace(seg);
  if (esc) return { decision: 'ask', reason: `it ${esc}` };

  const head = headOf(seg);
  if (!head) return { decision: 'ask', reason: 'the command could not be parsed' };

  if (INSPECT.has(head)) return { decision: 'allow', reason: 'read-only inspection' };
  if (mode === 'strict') {
    return { decision: 'ask', reason: `strict mode only auto-runs inspection commands, and "${head}" can execute or modify things` };
  }

  if (BUILD.has(head)) {
    const args = seg.trim().split(/\s+/).slice(1).filter((a) => !a.startsWith('-'));
    const sub = (args[0] || '').toLowerCase();
    if (head === 'git' && !GIT_OK.has(sub)) {
      return { decision: 'ask', reason: `git ${sub || '(no subcommand)'} is not on the safe-git list` };
    }
    if (['npm', 'yarn', 'pnpm'].includes(head) && sub && !NPM_OK.has(sub)) {
      return { decision: 'ask', reason: `${head} ${sub} is not on the safe-package-manager list` };
    }
    return { decision: 'allow', reason: `${mode} mode runs build/test commands in the workspace` };
  }

  if (mode === 'yolo') return { decision: 'allow', reason: 'yolo mode' };
  return { decision: 'ask', reason: `"${head}" is not on any allowlist` };
}

/**
 * Classify a whole command line. The weakest segment wins:
 * deny beats ask beats allow.
 */
export function classifyCommand(cmd, mode = MODE) {
  // Composition denies FIRST, on the unsplit line - splitting destroys the evidence.
  for (const [re, why] of LINE_DENY) {
    if (re.test(String(cmd || ''))) return { decision: 'deny', reason: why, mode };
  }
  const segs = segments(cmd);
  if (!segs.length) return { decision: 'ask', reason: 'empty command', mode };

  let worst = { decision: 'allow', reason: '', seg: '' };
  const rank = { allow: 0, ask: 1, deny: 2 };
  for (const s of segs) {
    const r = classifySegment(s, mode);
    if (rank[r.decision] > rank[worst.decision]) worst = { ...r, seg: s };
  }
  return {
    decision: worst.decision,
    reason: worst.reason,
    segment: segs.length > 1 ? worst.seg : undefined,
    mode,
  };
}

/**
 * run_python has no command line to inspect - it executes a file the agent wrote.
 * That is exactly the "it runs its own code" case, so it follows the mode rather
 * than pretending to analyse the script.
 */
export function classifyPython(mode = MODE) {
  if (mode === 'strict') return { decision: 'ask', reason: 'strict mode does not execute code unattended', mode };
  return { decision: 'allow', reason: `${mode} mode runs the agent's own Python in the workspace`, mode };
}

export function describeMode(mode = MODE) {
  return {
    strict: 'strict - only read-only inspection runs unattended; anything that executes waits for you',
    build: 'build - installs deps and runs code inside the workspace unattended (blast-zone mode)',
    yolo: 'yolo - everything runs except the hard denylist',
  }[mode] || `unknown mode "${mode}" - treating as strict`;
}
