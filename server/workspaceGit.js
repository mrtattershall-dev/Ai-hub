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
import { join } from 'path';

const GIT_TIMEOUT_MS = 20_000;
const AUTHOR = ['-c', 'user.name=hub-agent', '-c', 'user.email=agent@localhost'];

function git(cwd, args, timeout = GIT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile('git', ['-C', cwd, ...AUTHOR, ...args], { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({
        ok: !err,
        out: (stdout || '').trim(),
        err: (stderr || '').trim() || (err ? err.message : ''),
      }));
  });
}

/** Make the workspace a repo if it isn't one. Safe to call repeatedly. */
export async function ensureRepo(workspace) {
  if (!existsSync(workspace)) mkdirSync(workspace, { recursive: true });
  const inside = await git(workspace, ['rev-parse', '--is-inside-work-tree']);
  if (inside.ok && inside.out === 'true') return { ok: true, created: false };

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
