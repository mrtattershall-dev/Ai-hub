/**
 * d2.js - LEGASUS PHASE 2: finish-time load-preservation, as frozen in
 * legasus/screen/PHASE2-INTERVENTION_PREREG.md (Amendments 5-7).
 *
 * THE RULE
 *
 *     at run start   establish loadability of the affected target set
 *     during the run the model may break and repair FREELY
 *     at finish      recompute
 *
 *     START=LOADS  + FINISH=THROWS  -> newly introduced regression -> REFUSE PROMOTION
 *     START=THROWS + FINISH=THROWS  -> pre-existing; NOT blamed again
 *     START=LOADS  + MIDRUN=THROWS + FINISH=LOADS -> no violation; iteration preserved
 *
 * WHY NOT PER-WRITE. The obvious form - "refuse any write after which the module stops
 * loading" - was FALSIFIED against the reconstructed Set G workspace before a line of it was
 * written: 52% of intermediate states were unloadable, 5 of 8 breaking transitions were
 * repaired by the model itself within the run, and dependency cascade made `s10_desk.js`
 * 100% unloadable because of a fault in `s1_library.js`. Per-write refusal would have fought
 * the model's own repair loop and blamed files for other files' breakage. That negative
 * result stands; this module is not a tuned version of it but a different boundary.
 *
 * SCOPE vs COUNTING - deliberately different.
 *   DECISION scope is IMPACT: written modules PLUS their downstream consumers. A run that
 *   breaks `s1` and thereby breaks `s10` must not promote, even though it never wrote `s10`.
 *   The alternative says "I only care whether the file you touched survived", which is the
 *   wrong safety boundary.
 *   MEASUREMENT is ONE EVENT PER FAILED FINISH BOUNDARY, never one per affected module.
 *   Counting the cascade separately recreates the denominator inflation already recorded in
 *   goal-coupling-wrong-denominator.
 *
 * CAUSALITY IS NOT REQUIRED TO BLOCK.
 *   ENOUGH TO BLOCK:        "this run introduced a regression"
 *   NOT NECESSARILY ENOUGH: "this exact write caused it"
 * When attribution is not established, causal_root is UNRESOLVED and the gate still refuses.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);

const git = async (cwd, args) => {
  try {
    const { stdout } = await exec('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    return { ok: true, out: String(stdout).trim() };
  } catch (e) {
    return { ok: false, out: '', err: String(e.stderr || e.message || '').trim() };
  }
};

/** Modules d2 can reason about. A load check means nothing for .html/.css/.md. */
export const LOADABLE_EXT = /\.(c?js|mjs)$/i;

/**
 * Downstream consumers of `file`, from the require/import edges actually present in the tree.
 *
 * This is the ESTABLISHED-RELATION form the prereg calls for, not a universal dependency
 * analyser: it reads the edges the workspace itself declares. Dynamic requires, computed
 * paths and re-exports are NOT followed - so the closure is a LOWER BOUND on impact, and is
 * reported as such rather than claimed to be complete. Generalising closure construction is
 * a later experiment with its own preregistration.
 */
export async function consumersOf(workspace, file, ref = null) {
  const base = basename(file).replace(/\.(c?js|mjs)$/i, '');
  const listed = ref
    ? await git(workspace, ['ls-tree', '--name-only', '-r', ref])
    : await git(workspace, ['ls-files']);
  if (!listed.ok) return [];
  const files = listed.out.split('\n').filter((f) => LOADABLE_EXT.test(f) && f !== file);
  const out = [];
  for (const f of files) {
    const src = ref ? await git(workspace, ['show', `${ref}:${f}`]) : null;
    const text = src && src.ok ? src.out : '';
    if (!text) continue;
    // `require('./s1_library')` with or without extension, and the ESM form.
    const re = new RegExp(`(?:require\\s*\\(|from\\s+)['"]\\.[^'"]*\\b${base}(?:\\.(?:c?js|mjs))?['"]`);
    if (re.test(text)) out.push(f);
  }
  return out;
}

/**
 * Materialise the whole loadable tree at `ref` into a scratch directory.
 *
 * THE WHOLE TREE, NOT ONE FILE - and this was a real defect, caught only by running the
 * implementation against the Set G fixture. Writing the single target file and requiring it
 * cannot resolve `require('./s1_library')`, so EVERY module with a relative dependency reads
 * as unloadable at every ref, `before === false`, and d2 silently never fires for it. The
 * cascade case would have been reported as "no regression".
 *
 * Worse, the probe scripts that first validated the rule reused ONE temp directory across all
 * checks, so earlier files accumulated in it and dependencies happened to resolve. They got
 * the right answer by an order-dependent accident. Materialising the tree makes the
 * resolution faithful to the ref instead of to the order checks happen to run in.
 *
 * package.json travels because it decides CommonJS vs ESM - and an unstated module-system
 * fact has already been misread in this project as a model-quality difference.
 */
async function materialise(workspace, ref) {
  const listed = await git(workspace, ['ls-tree', '--name-only', '-r', ref]);
  if (!listed.ok) return null;
  const dir = mkdtempSync(join(tmpdir(), 'd2tree-'));
  for (const f of listed.out.split('\n')) {
    if (!LOADABLE_EXT.test(f) && basename(f) !== 'package.json') continue;
    if (f.includes('node_modules/')) continue;
    const src = await git(workspace, ['show', `${ref}:${f}`]);
    if (!src.ok) continue;
    const target = join(dir, f);
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, src.out, 'utf8');
    } catch { /* a name this filesystem cannot represent - skipped, not fatal */ }
  }
  return dir;
}

/**
 * Does `file` load at `ref`?
 *
 * Returns true / false / null, and null is NOT false: null means the file did not exist at
 * that ref, so there was no established loadable property to preserve. Collapsing those would
 * make d2 blame a run for a file it created.
 *
 * Out-of-process, one child per check: a module that throws on load can leave the requiring
 * process in any state, and a shared process would carry that into the next.
 *
 * `trees` is a caller-supplied cache of ref -> materialised dir, so a finish evaluation
 * materialises each ref once rather than once per file.
 */
export async function loadableAt(workspace, ref, file, { timeout = 20_000, trees = null } = {}) {
  const exists = await git(workspace, ['cat-file', '-e', `${ref}:${file}`]);
  if (!exists.ok) return null;                      // absent at this ref
  const own = !trees;
  const cache = trees || new Map();
  if (!cache.has(ref)) cache.set(ref, await materialise(workspace, ref));
  const dir = cache.get(ref);
  if (!dir) return null;
  try {
    await exec(process.execPath, ['-e', 'require(process.argv[1])', join(dir, file)], { timeout, encoding: 'utf8', windowsHide: true });
    return true;
  } catch { return false; }
  finally {
    if (own) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

/**
 * Evaluate d2 at a finish boundary.
 *
 * `startRef` MUST be the state the hub already regarded as this run's starting authoritative
 * state. A state is not safe merely because it is earlier: if the run began from unverified
 * ground, restoring to it does not make it established. The caller records the starting
 * observations at run start for that reason - so this comparison CONSUMES the starting
 * property rather than reconstructing it afterwards.
 */
export async function evaluateD2(workspace, { startRef, candidateRef, written = [], targets = [] }) {
  const changed = [...new Set(written.filter((f) => LOADABLE_EXT.test(f)))];
  // The protected universe is CAMPAIGN-OWNED, not model-owned: a file the model created
  // during the run is not protected merely because it exists. Passed in, frozen before the
  // campaign, never derived from what the run happened to touch.
  const protectedTargets = new Set(targets.filter((f) => LOADABLE_EXT.test(f)));

  // AFFECTED = protected targets that are directly changed, OR downstream consumers of
  // anything changed. The second clause is why a non-target helper can cause a violation
  // without being one: alter helper.js, break s3_matrix.js, and the violation is ON s3.
  // Consumers are read at the START ref - who depended on the changed component when the run
  // began, not who happens to afterwards.
  const reached = new Set(changed);
  const queue = [...changed];
  while (queue.length) {
    for (const c of await consumersOf(workspace, queue.shift(), startRef)) {
      if (!reached.has(c)) { reached.add(c); queue.push(c); }   // transitive: helper -> lib -> deliverable
    }
  }
  const closure = new Set([...reached].filter((f) => protectedTargets.has(f)));

  // One materialised tree per ref, not per file: the refs are the same for every member of
  // the closure, and re-extracting per file would be both slow and pointlessly repetitive.
  const trees = new Map();
  const newly = [];
  const observations = [];
  try {
    for (const f of closure) {
      const before = await loadableAt(workspace, startRef, f, { trees });
      const after = await loadableAt(workspace, candidateRef, f, { trees });
      // before === null: the target did not exist at the recorded run start, so there is no
      // preservation property to lose. UNESTABLISHED, never manufactured into START=THROWS -
      // that would let a run be blamed for a deliverable it created, or credited for one it
      // never had.
      const established = before === true ? 'LOADS' : before === false ? 'THROWS' : 'UNESTABLISHED';
      observations.push({ file: f, start: established, before, after });
      if (before === true && after === false) newly.push(f);
    }
  } finally {
    for (const dir of trees.values()) { if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }

  // causal_root ONLY when established: exactly one CHANGED module is itself newly unloadable.
  // A scratch/non-target file may be the root - causality is about what broke, not about what
  // is protected. Two plausible candidates is UNRESOLVED, not a guess: the gate refuses either
  // way, because "this run introduced a regression" is enough to block while "this exact write
  // caused it" is a stronger claim needing its own evidence.
  const rootCandidates = [];
  for (const f of changed) {
    const before = await loadableAt(workspace, startRef, f);
    const after = await loadableAt(workspace, candidateRef, f);
    if (before === true && after === false) rootCandidates.push(f);
  }
  const causal_root = rootCandidates.length === 1 ? rootCandidates[0] : 'UNRESOLVED';

  return {
    violated: newly.length > 0,
    newly_unloadable: newly,                                     // protected targets ONLY
    changed,
    targets_protected: [...protectedTargets],
    causal_root,                                                 // may be a non-target
    cascade_impact: newly.filter((f) => f !== causal_root),
    closure: [...closure],
    closure_is_lower_bound: true,   // dynamic/computed requires are not followed
    observations,
    startRef,
    candidateRef,
  };
}

/**
 * Preserve the candidate under an immutable quarantine ref.
 *
 * MUST be called BEFORE any restore. `undo({hard:true})` is `git reset --hard`, which discards
 * by design - so quarantining afterwards would quarantine nothing. Good work is not destroyed
 * because one obligation failed: the candidate stays inspectable, repairable and
 * cherry-pickable, and the campaign's GOOD_TRAPPED metric is scored against it.
 */
export async function quarantine(workspace, runId, candidateRef) {
  const ref = `refs/legasus/quarantine/${runId}`;
  const r = await git(workspace, ['update-ref', ref, candidateRef]);
  return r.ok ? { ok: true, ref } : { ok: false, error: r.err };
}

/** Restore the authoritative workspace to the run's established starting state. */
export async function restoreTo(workspace, startRef) {
  const r = await git(workspace, ['reset', '--hard', startRef]);
  return r.ok ? { ok: true } : { ok: false, error: r.err };
}
