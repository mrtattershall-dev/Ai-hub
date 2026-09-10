/**
 * workspaceGit.js - version control for the agent's workspace.
 *
 * WHY THIS IS THE AUTONOMY UNLOCK
 * -------------------------------
 * A human coder's advantage is not writing correct code first time - it is that mistakes
 * are REVERSIBLE. `git revert` is what makes it safe to try something bold. Without
 * history every agent edit is permanent, which is exactly why every dangerous tool needs
 * a human gate.
 *
 * With history the calculus inverts: an agent can run unsupervised for hours because any
 * damage is one command from undone. It also lets the agent SEE ITS OWN DIFF - "what have
 * I changed since the last working state" is information it currently cannot get at all.
 *
 * Scope is deliberately narrow:
 *   - operates ONLY inside WORKSPACE, never the hub's own tree or any other repo
 *   - commits are local; nothing is ever pushed anywhere
 *   - no remotes are configured, so a stray `git push` has nowhere to go
 *   - identity is set per-repo so it cannot inherit or alter global git config
 */
import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';

const GIT_TIMEOUT_MS = 20_000;
const AUTHOR = ['-c', 'user.name=hub-agent', '-c', 'user.email=agent@localhost'];

/**
 * `git -C <dir>` DOES NOT CONFINE GIT TO <dir>.
 *
 * Git discovers its repository by walking UP from the working directory until it finds a
 * .git. So when the workspace had no repo of its own, every command here silently
 * operated on the first repo above it - the hub's own source tree. Measured 2026-09-10:
 * 15 agent auto-checkpoints had been committed to the hub repository, each running
 * `add -A`, which from a subdirectory stages the WHOLE tree - sweeping in three parallel
 * sessions' uncommitted work under a message like "before write_file: ...".
 *
 * GIT_CEILING_DIRECTORIES stops that walk. Git will not ascend into or above a listed
 * directory while discovering, so pointing it at the workspace's PARENT means the search
 * can find workspace/.git and nothing beyond it. This is the mechanical guarantee;
 * ensureRepo() below is the one that makes sure workspace/.git actually exists.
 */
// `raw` keeps stdout byte-exact. Trimming is right for log/diff/rev-parse and WRONG for
// file contents: `git show HEAD:file` came back without its trailing newline, so restoring
// a file from HEAD silently rewrote it. Caught by syntaxRollback.test.mjs, which is the
// only reason it is not shipping.
function git(cwd, args, timeout = GIT_TIMEOUT_MS, { raw = false } = {}) {
  const ceiling = dirname(resolve(cwd));
  return new Promise((res) => {
    execFile('git', ['-C', cwd, ...AUTHOR, ...args], {
      timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_CEILING_DIRECTORIES: ceiling },
    },
      (err, stdout, stderr) => res({
        ok: !err,
        out: raw ? (stdout || '') : (stdout || '').trim(),
        err: (stderr || '').trim() || (err ? err.message : ''),
      }));
  });
}

/** Same path, allowing for Windows case and trailing separators. */
function samePath(a, b) {
  const norm = (x) => {
    const r = resolve(String(x || '')).replace(new RegExp(`\${sep}+$`), '');
    return process.platform === 'win32' ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
}

/**
 * Refuse to touch any repository that is not the workspace's own.
 *
 * Belt to GIT_CEILING_DIRECTORIES' braces: if discovery ever finds a repo whose root is
 * not exactly the workspace, every operation here must fail loudly rather than commit,
 * reset or revert somebody else's tree.
 */
async function ownRepoOrNull(workspace) {
  const top = await git(workspace, ['rev-parse', '--show-toplevel']);
  if (!top.ok || !top.out) return null;
  return samePath(top.out, workspace) ? top.out : null;
}

/** Make the workspace a repo if it isn't one. Safe to call repeatedly. */
export async function ensureRepo(workspace) {
  if (!existsSync(workspace)) mkdirSync(workspace, { recursive: true });

  // The old test was `rev-parse --is-inside-work-tree`, which answers TRUE for a
  // directory sitting inside ANY enclosing repository. The workspace lives inside the
  // hub's own checkout, so this always said "already a repo", `git init` never ran, and
  // every later commit landed on the hub's source tree. What matters is not "am I inside
  // a work tree" but "is the work tree I found MINE".
  if (await ownRepoOrNull(workspace)) return { ok: true, created: false };

  const init = await git(workspace, ['init', '-q']);
  if (!init.ok) return { ok: false, error: init.err };
  // No remote is ever configured: an autonomous agent must not be able to publish.
  await git(workspace, ['add', '-A']);
  await git(workspace, ['commit', '-q', '-m', 'baseline: workspace before the agent touched it', '--allow-empty']);
  return { ok: true, created: true };
}

/** Commit whatever changed. Returns the short sha, or null when nothing changed. */
export async function commitAll(workspace, message) {
  await ensureRepo(workspace);
  // If the workspace still is not its own repo after ensureRepo, something is wrong with
  // the checkout and the next `add -A` would stage an unrelated tree. Stop.
  if (!(await ownRepoOrNull(workspace))) {
    return { ok: false, error: `refusing to commit: ${workspace} is not the root of its own git repository, so this would commit an enclosing repo` };
  }
  const status = await git(workspace, ['status', '--porcelain']);
  if (!status.out) return { ok: true, sha: null, note: 'nothing to commit' };
  const add = await git(workspace, ['add', '-A']);
  if (!add.ok) return { ok: false, error: add.err };
  const msg = String(message || 'agent step').slice(0, 200);
  const c = await git(workspace, ['commit', '-q', '-m', msg]);
  if (!c.ok) return { ok: false, error: c.err };
  const sha = await git(workspace, ['rev-parse', '--short', 'HEAD']);
  return { ok: true, sha: sha.out, note: msg };
}

/** What has changed, and since when. `ref` defaults to the previous commit. */
export async function diff(workspace, ref = 'HEAD~1', maxChars = 12_000) {
  await ensureRepo(workspace);
  const stat = await git(workspace, ['diff', '--stat', ref]);
  const patch = await git(workspace, ['diff', ref]);
  if (!stat.ok && !patch.ok) return { ok: false, error: stat.err || patch.err };
  const body = (patch.out || '').slice(0, maxChars);
  return {
    ok: true,
    summary: stat.out || '(no changes)',
    patch: body + (patch.out.length > maxChars ? '\n… (diff truncated)' : ''),
  };
}

/**
 * One file's contents at a ref, or null if it is not there.
 *
 * Added for the syntax rollback. The agent checkpoints BEFORE every mutating write, so when
 * a write leaves a file that will not parse, the last version that DID parse is already
 * committed - it was simply never read back. Audited 67 run workspaces: 10 ended holding
 * .js that does not parse, every one flagged by our own syntax check at the time and left
 * there anyway.
 */
export async function showFile(workspace, ref, relPath) {
  await ensureRepo(workspace);
  const clean = String(relPath || '').split('\\').join('/').replace(/^\.\//, '');
  if (!clean || clean.startsWith('..')) return null;
  const r = await git(workspace, ['show', `${ref}:${clean}`], undefined, { raw: true });
  return r.ok ? r.out : null;
}

/** Recent history, newest first. */
export async function log(workspace, n = 15) {
  await ensureRepo(workspace);
  const r = await git(workspace, ['log', `-${n}`, '--pretty=format:%h  %ad  %s', '--date=format:%H:%M:%S']);
  return r.ok ? { ok: true, out: r.out || '(no commits yet)' } : { ok: false, error: r.err };
}

/**
 * Undo. Two modes, because they answer different questions:
 *   revert <sha>  - a NEW commit undoing that one. History is preserved. Default.
 *   reset  <sha>  - move the working tree back and DISCARD everything after it.
 * reset is destructive, so it is opt-in rather than the default.
 */
export async function undo(workspace, { sha = 'HEAD', hard = false } = {}) {
  await ensureRepo(workspace);
  if (hard) {
    const r = await git(workspace, ['reset', '--hard', sha]);
    return r.ok ? { ok: true, out: `working tree reset to ${sha} (later changes discarded)` } : { ok: false, error: r.err };
  }
  const r = await git(workspace, ['revert', '--no-edit', sha]);
  return r.ok ? { ok: true, out: `reverted ${sha} with a new commit` } : { ok: false, error: r.err };
}

/** Uncommitted changes, if any - used to decide whether a step is worth committing. */
export async function isDirty(workspace) {
  const s = await git(workspace, ['status', '--porcelain']);
  return !!s.out;
}
