/**
 * evidenceRun.mjs - EH1. Evidence runs that cannot be silently overwritten.
 *
 * WHY THIS EXISTS, and it is not housekeeping. During B-REPAIR-1's acceptance step the B-COMP-1
 * probe was re-run with its output directory unchanged, and it OVERWROTE the preserved ESCAPED
 * counterexample with the post-repair CONTAINED result. The pre-repair machine-readable artifact
 * is gone; it survives only in prose. That is a demonstrated failure in the measuring apparatus,
 * and D' is specifically an experiment whose pre-repair artifact may be uniquely valuable.
 *
 *     openRun()  -> a NEVER-BEFORE-USED directory, state OPEN
 *     artifact()  -> write while OPEN
 *     seal()      -> hash everything, finalize the manifest, state SEALED, refuse further writes
 *     abandon()   -> state INCOMPLETE: preserved, but WITHOUT the standing of a completed run
 *
 * IMMUTABILITY AND COMPLETENESS ARE DIFFERENT PROPERTIES. A crashed experiment must be
 * preservable without acquiring the epistemic status of a finished one, so INCOMPLETE is a first
 * class state rather than an absent SEALED marker.
 *
 * A REPLAY NEVER UPDATES THE ORIGINAL. It gets its own run id and a `replayOf` pointer.
 *
 * HONEST BOUND ON THE ENFORCEMENT. Sealing sets the read-only attribute on each artifact AND
 * refuses writes through this module. It binds callers who use this harness and the ordinary
 * filesystem path; it is not a security boundary against a determined writer who clears the
 * attribute or bypasses the module. Recorded here so the guarantee is not overread later.
 *
 * WORKTREE PROVENANCE. A commit SHA alone is insufficient when an experiment can execute against
 * uncommitted modifications - which is exactly the state this repo is usually in. The manifest
 * therefore carries `commit`, `worktreeClean` and `worktreeDiffHash` separately. Dirty execution
 * is permitted; it just has to be provenance rather than invisible state.
 */
import {
  mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, chmodSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

export const STATE = Object.freeze({ OPEN: 'OPEN', SEALED: 'SEALED', INCOMPLETE: 'INCOMPLETE' });
export const EVIDENCE_CLASS = Object.freeze({
  ORIGINAL: 'ORIGINAL',           // produced by running the experiment
  REPLAY: 'REPLAY',               // a re-run; points at the original, never replaces it
  RECONSTRUCTED: 'RECONSTRUCTED', // transcribed from another record. NOT machine-generated evidence.
});

const MANIFEST = 'MANIFEST.json';
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** Commit, cleanliness and a digest of the uncommitted diff. Absent git is recorded, not fatal. */
function worktreeProvenance(repo) {
  const g = (args) => {
    try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true }); }
    catch { return null; }
  };
  const commit = (g(['rev-parse', 'HEAD']) || '').trim() || null;
  const status = g(['status', '--porcelain']);
  if (status === null) return { commit, worktreeClean: null, worktreeDiffHash: null, gitAvailable: false };
  const dirtyLines = status.split('\n').filter((l) => l.trim());
  const clean = dirtyLines.length === 0;
  // The diff of TRACKED changes, plus the porcelain list so untracked files are covered too -
  // `git diff` alone would call an experiment clean that ran against a new uncommitted file.
  const diff = clean ? '' : `${(g(['diff', 'HEAD']) || '')}\n--porcelain--\n${status}`;
  return {
    commit,
    worktreeClean: clean,
    worktreeDiffHash: clean ? null : sha256(diff),
    dirtyEntryCount: dirtyLines.length,
    gitAvailable: true,
  };
}

/**
 * Open a new evidence run.
 *
 * @param {object} o
 * @param {string} o.root       parent directory for runs
 * @param {string} o.label      short slug, e.g. 'D-PROP-1'
 * @param {string} [o.command]  the exact command being recorded
 * @param {string} [o.repo]     repository whose provenance to capture
 * @param {string} [o.evidenceClass]
 * @param {string} [o.replayOf] run id this replays
 */
export function openRun({ root, label, command = null, repo = process.cwd(),
  evidenceClass = EVIDENCE_CLASS.ORIGINAL, replayOf = null, note = null } = {}) {
  if (!root || !label) throw new Error('openRun needs { root, label }');
  if (!Object.values(EVIDENCE_CLASS).includes(evidenceClass)) {
    throw new Error(`unknown evidenceClass ${evidenceClass}`);
  }
  if (evidenceClass === EVIDENCE_CLASS.REPLAY && !replayOf) {
    throw new Error('a REPLAY must name the run it replays, or it is an ORIGINAL pretending');
  }

  const slug = String(label).replace(/[^A-Za-z0-9._-]+/g, '-');
  // NEVER-BEFORE-USED. The uuid makes collision a non-question, and the existsSync check means a
  // pre-existing directory is refused rather than merged into.
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}__${slug}__${randomUUID().slice(0, 8)}`;
  const dir = resolve(join(root, id));
  if (existsSync(dir)) throw new Error(`run directory already exists, refusing to reuse: ${dir}`);
  mkdirSync(dir, { recursive: true });

  const started = new Date().toISOString();
  const prov = worktreeProvenance(repo);
  let state = STATE.OPEN;

  const manifest = {
    id, label, state, evidenceClass, replayOf, note,
    command, repo: resolve(repo),
    startedAt: started, endedAt: null, exitStatus: null,
    ...prov,
    artifacts: null,
    harness: 'evidenceRun.mjs EH1',
  };
  const writeManifest = () => writeFileSync(join(dir, MANIFEST), JSON.stringify(manifest, null, 2), 'utf8');
  writeManifest();

  const assertOpen = (what) => {
    if (state !== STATE.OPEN) {
      throw new Error(`run ${id} is ${state}; ${what} is refused. `
        + (state === STATE.SEALED
          ? 'Sealed evidence is immutable - a re-run needs its OWN run (evidenceClass REPLAY, replayOf this id).'
          : 'An INCOMPLETE run is preserved as-is and never resumed.'));
    }
  };

  return {
    id, dir,
    get state() { return state; },

    /** Write one artifact. Refused once sealed, and refused if the name already exists. */
    artifact(name, contents) {
      assertOpen(`writing artifact "${name}"`);
      if (name === MANIFEST) throw new Error('the manifest is written by the harness, not by the experiment');
      const p = join(dir, name);
      if (existsSync(p)) {
        throw new Error(`artifact "${name}" already exists in run ${id}; evidence is append-only within a run`);
      }
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2), 'utf8');
      return p;
    },

    /** Finalize: hash every artifact, record the outcome, make the run immutable. */
    seal({ exitStatus = 0, endedAt = new Date().toISOString() } = {}) {
      assertOpen('sealing');
      const names = readdirSync(dir).filter((f) => f !== MANIFEST);
      manifest.artifacts = names.map((n) => {
        const p = join(dir, n);
        const s = statSync(p);
        return s.isDirectory()
          ? { name: n, kind: 'directory' }
          : { name: n, bytes: s.size, sha256: sha256(readFileSync(p)) };
      });
      manifest.endedAt = endedAt;
      manifest.exitStatus = exitStatus;
      state = STATE.SEALED;
      manifest.state = state;
      writeManifest();
      // Best-effort OS-level immutability, in addition to the module-level refusal above.
      for (const n of names) { try { chmodSync(join(dir, n), 0o444); } catch { /* attribute only */ } }
      try { chmodSync(join(dir, MANIFEST), 0o444); } catch { /* attribute only */ }
      return { ...manifest };
    },

    /**
     * Preserve a run that did not finish. INCOMPLETE, never SEALED: the artifacts are kept and
     * explicitly denied the standing of a completed experiment.
     */
    abandon({ reason, exitStatus = null } = {}) {
      assertOpen('abandoning');
      manifest.artifacts = readdirSync(dir).filter((f) => f !== MANIFEST).map((n) => {
        const p = join(dir, n);
        try {
          const s = statSync(p);
          return s.isDirectory() ? { name: n, kind: 'directory' } : { name: n, bytes: s.size, sha256: sha256(readFileSync(p)) };
        } catch { return { name: n, unreadable: true }; }
      });
      manifest.endedAt = new Date().toISOString();
      manifest.exitStatus = exitStatus;
      manifest.incompleteReason = reason || 'not stated';
      state = STATE.INCOMPLETE;
      manifest.state = state;
      writeManifest();
      return { ...manifest };
    },
  };
}

/** Read a manifest back. */
export function readRun(dir) {
  return JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'));
}

/**
 * Verify a sealed run against its own hashes. Returns every mismatch rather than a boolean,
 * because "which artifact changed" is the useful answer.
 */
export function verifyRun(dir) {
  const m = readRun(dir);
  if (m.state !== STATE.SEALED) return { ok: false, why: `run is ${m.state}, not SEALED`, mismatches: [] };
  const mismatches = [];
  for (const a of m.artifacts || []) {
    if (a.kind === 'directory') continue;
    const p = join(dir, a.name);
    if (!existsSync(p)) { mismatches.push({ name: a.name, why: 'missing' }); continue; }
    const now = sha256(readFileSync(p));
    if (now !== a.sha256) mismatches.push({ name: a.name, why: 'hash differs', expected: a.sha256, actual: now });
  }
  return { ok: mismatches.length === 0, mismatches, manifest: m };
}
