/**
 * ============================================================================================
 * SUPERSEDED 2026-10-01 by server/cid1.mjs - see legasus/screen/D-ID-1_RECONCILE.md.
 * Kept, not deleted, with its tests and records. Do NOT import it for new work.
 * Decided by the reconcile's frozen rule (0d4ec46f): on R4 this implementation returned an
 * identity for {lone-surrogate name, its U+FFFD lookalike}, and post-hoc R5 (d4b733e5) showed two
 * on-disk-distinguishable directories sharing ONE identity here - Node decodes the lone surrogate
 * to the lookalike's name, both entries read the lookalike's bytes, and nothing rejects the
 * duplicate path. cid1.mjs refuses both. Its other measurements are recorded in the reconcile.
 * ============================================================================================
 *
 * candidateIdentity.mjs - cid1. Candidate identity defined independently of Git.
 *
 * Implements the contract frozen in legasus/screen/D-ID-1_PREREG.md (1c3a2b1c) + Amendment 1
 * (3e14f827). The definition was frozen BEFORE this file existed; nothing here chooses policy.
 *
 *     candidateIdentity(C) is a deterministic, content-addressed identifier of the candidate
 *     state supplied to evaluation. It depends only on that defined state and is invariant to
 *     the enclosing repository, absolute location, invocation context, and unrelated filesystem
 *     state.
 *
 * WHY NOT GIT. D-PROP-1 showed `HEAD^{tree}` names the COMMITTED tree while the working bytes are
 * what runs. D'-1 showed something worse: with no `.git` of its own - the shape batch.js:189
 * creates by copying with `cpSync` EXCLUDING `.git` - git discovers the ENCLOSING repository and
 * returns a tree belonging to an unrelated project. Its A5 arm held the candidate constant and the
 * reported identity still changed with the containing directory. So no revision-parse can satisfy
 * this contract: any git-derived identity inherits ambient context.
 *
 * SCOPE. This is the definition only. Wiring it into evaluator.js, acceptance.js and the journal,
 * and repairing the batch.js copy filter, are separate steps with their own controls, per the
 * prereg. D stays unrepaired until D-ID-1's suite passes.
 */
import { readdirSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, sep, basename } from 'node:path';

export const CID_VERSION = 'cid1';

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Is any path component EXACTLY `.git`?
 *
 * Exact component match, never a substring. `.gitignore`, `.gitattributes` and `.github/` are
 * INCLUDED - a check mounted at /candidate can read them, so the identity must name them.
 * batch.js's `includes(sep + '.git')` is the counterexample the prereg cites: it also matches
 * `.gitignore`, so the copy silently drops files the identity counts.
 */
const isGitComponent = (relParts) => relParts.some((p) => p === '.git');

/**
 * Can this name be ADDRESSED through the ordinary filesystem API on this platform?
 *
 * Found by M15. On Windows a component with a trailing `.` or space cannot be opened by that
 * name: the Win32 layer strips it, so `readFileSync(join(dir, 'weird.'))` SUCCEEDS while reading
 * a different object - or the same object under a name that is not the one enumerated. cid1
 * returned an identity for such a directory, which is precisely the "skipped entry names a
 * different object" failure the contract forbids, arriving by a route the contract did not
 * anticipate: the entry was not skipped, it was MISREAD.
 *
 * Reserved device names are included for the same reason: `CON`, `NUL` and friends resolve to
 * devices rather than to the enumerated entry.
 *
 * POSIX addresses all of these literally, so the rule is win32-only. Returning a reason rather
 * than a boolean keeps the UNAVAILABLE message specific about WHICH name defeated it.
 */
const RESERVED_WIN32 = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/**
 * THE INVARIANT, generalized from M15's counterexample:
 *
 *     ENUMERATED IDENTITY == OPENED IDENTITY. An entry's bytes may contribute to cid1 only when
 *     the entry opened by its enumerated name is demonstrably the same entry that was enumerated.
 *
 * A trailing dot is ONE counterexample, not the rule. A blacklist of odd Windows names would rot
 * and would miss the next route; what matters is that the name round-trips.
 *
 * MECHANISM, chosen by measurement rather than reasoning:
 *   - `basename(realpathSync(abs)) === name` is the round-trip. For a name Windows strips when
 *     opening, realpath reports the stripped name and the comparison fails.
 *   - the extended-length prefix was MEASURED and REJECTED: `lstatSync('\\\\?\\' + p)` throws
 *     ENOENT through node even for an ordinary file on this platform, so it would mark every
 *     entry unavailable. That avenue is closed, and the measurement is recorded so nobody
 *     re-reaches for it.
 *
 * SYMLINKS ARE A NARROWER ARM, stated rather than glossed. `realpathSync` FOLLOWS a link, so the
 * round-trip would compare against the TARGET's name and is not applicable. For links the shape
 * rule below is used instead - a heuristic, not a round-trip. A link whose name is stripped by
 * the platform in some other way is therefore NOT detected, and that is a known gap.
 */
function unaddressable(abs, name, isLink) {
  if (process.platform !== 'win32') return null;
  if (isLink) {
    if (/[. ]$/.test(name)) return 'a trailing dot or space in a SYMLINK name (shape rule - the round-trip cannot be applied to links)';
    if (RESERVED_WIN32.test(name)) return 'a reserved Windows device name in a symlink';
    return null;
  }
  if (RESERVED_WIN32.test(name)) return 'a reserved Windows device name';
  let real;
  try { real = realpathSync(abs); } catch (e) {
    return `the name could not be resolved (${e.code || e.message}), so it cannot be shown to address the enumerated entry`;
  }
  if (basename(real) !== name) {
    return `the enumerated name ${JSON.stringify(name)} opens ${JSON.stringify(basename(real))}`
      + ' - the opened entry is not demonstrably the enumerated one';
  }
  return null;
}

/**
 * Compute cid1 for a directory.
 *
 * @returns {{available: true, identity: string, entries: number}
 *         | {available: false, reason: string, at: string|null}}
 *
 * FAILS CLOSED. An unreadable or unrepresentable entry yields UNAVAILABLE, never a skip: skipping
 * an entry would name a DIFFERENT object while claiming to name this one. Availability is the
 * property D-CONSUME-1 arm E flagged - for any readable directory an identity must EXIST, with
 * enclosing repository, commit state and location playing no part.
 */
export function candidateIdentity(root) {
  const entries = [];
  const unavailable = (reason, at = null) => ({ available: false, reason, at });

  /** @returns {null | {reason: string, at: string}} an error, or null on success */
  function walk(absDir, relParts) {
    let names;
    try {
      names = readdirSync(absDir);
    } catch (e) {
      return { reason: `directory unreadable: ${e.code || e.message}`, at: relParts.join('/') || '.' };
    }
    for (const name of names) {
      const nextRel = [...relParts, name];
      if (isGitComponent(nextRel)) continue;             // declared exclusion
      const abs = join(absDir, name);
      let st;
      try {
        // lstat, NOT stat: a symlink must be identified as the LINK, never followed.
        st = lstatSync(abs);
      } catch (e) {
        // A name the platform cannot represent or stat (e.g. trailing "." on Windows) is
        // UNREPRESENTABLE. Fail closed rather than pretend the object is the one without it.
        return { reason: `entry unrepresentable or unstattable: ${e.code || e.message}`, at: nextRel.join('/') };
      }
      // FAIL CLOSED BEFORE ANY BYTES CONTRIBUTE. An entry whose enumerated name does not
      // demonstrably address the enumerated entry would otherwise be read under a different name
      // and silently counted as this object - M15's defect.
      const bad = unaddressable(abs, name, st.isSymbolicLink());
      if (bad) {
        return { reason: `entry is not demonstrably addressable - ${bad}`, at: nextRel.join('/') };
      }

      if (st.isSymbolicLink()) {
        let target;
        try { target = readlinkSync(abs); } catch (e) {
          return { reason: `symlink target unreadable: ${e.code || e.message}`, at: nextRel.join('/') };
        }
        // The LINK ITSELF: its stored target text. Following it would identify whatever it points
        // at - possibly outside the candidate entirely. A dangling link still has an identity.
        entries.push({ type: 'L', path: nextRel.join('/'), digest: sha256hex(Buffer.from(target, 'utf8')) });
      } else if (st.isDirectory()) {
        const err = walk(abs, nextRel);
        if (err) return err;
        // Empty directories are a DECLARED BLIND SPOT: they contribute no entry.
      } else if (st.isFile()) {
        let bytes;
        try { bytes = readFileSync(abs); } catch (e) {
          return { reason: `file unreadable: ${e.code || e.message}`, at: nextRel.join('/') };
        }
        // Exact bytes. No line-ending translation: CRLF and LF are DIFFERENT content.
        entries.push({ type: 'F', path: nextRel.join('/'), digest: sha256hex(bytes) });
      } else {
        // A socket, fifo or device is neither a regular file nor a symlink. The frozen definition
        // covers only those two, so this is UNAVAILABLE rather than silently absent.
        return { reason: 'entry is neither a regular file nor a symlink', at: nextRel.join('/') };
      }
    }
    return null;
  }

  let rootStat;
  try { rootStat = lstatSync(root); } catch (e) {
    return unavailable(`root unreadable: ${e.code || e.message}`);
  }
  if (!rootStat.isDirectory()) return unavailable('root is not a directory');

  const err = walk(root, []);
  if (err) return unavailable(err.reason, err.at);

  // Ordering: by the UTF-8 BYTE order of the path, not a locale collation - a locale-dependent
  // sort would make the identity depend on invocation context, which the contract forbids.
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')));

  // Per-entry form is frozen: <type> \0 <path> \0 <sha256>. The JOINING is not specified by the
  // prereg, so it is fixed HERE and recorded as an implementation decision an independent
  // implementation must match: every entry is terminated by a further \0. Unambiguous because the
  // digest is fixed-width hex, and no byte sequence can straddle a record boundary.
  const manifest = Buffer.concat(entries.map((e) => Buffer.concat([
    Buffer.from(e.type, 'utf8'), Buffer.from([0]),
    Buffer.from(e.path, 'utf8'), Buffer.from([0]),
    Buffer.from(e.digest, 'utf8'), Buffer.from([0]),
  ])));

  return { available: true, identity: `${CID_VERSION}:${sha256hex(manifest)}`, entries: entries.length };
}

/**
 * A direct snapshot comparison oracle, for tests that must compare two directories WITHOUT using
 * any identity under test (Amendment 1: M17 compares snapshots, not recorded trees).
 *
 * Returns the differing paths, so "which file" is the answer rather than a boolean.
 */
export function snapshotDiff(a, b) {
  const list = (root) => {
    const acc = new Map();
    const walk = (absDir, relParts) => {
      let names;
      try { names = readdirSync(absDir); } catch { return; }
      for (const name of names) {
        const nextRel = [...relParts, name];
        if (isGitComponent(nextRel)) continue;
        const abs = join(absDir, name);
        let st; try { st = lstatSync(abs); } catch { acc.set(nextRel.join('/'), 'UNSTATTABLE'); continue; }
        if (st.isSymbolicLink()) { try { acc.set(nextRel.join('/'), `L:${readlinkSync(abs)}`); } catch { acc.set(nextRel.join('/'), 'L:UNREADABLE'); } }
        else if (st.isDirectory()) walk(abs, nextRel);
        else if (st.isFile()) { try { acc.set(nextRel.join('/'), `F:${sha256hex(readFileSync(abs))}`); } catch { acc.set(nextRel.join('/'), 'F:UNREADABLE'); } }
        else acc.set(nextRel.join('/'), 'OTHER');
      }
    };
    walk(root, []);
    return acc;
  };
  const A = list(a); const B = list(b);
  const onlyInA = []; const onlyInB = []; const differing = [];
  for (const [p, v] of A) { if (!B.has(p)) onlyInA.push(p); else if (B.get(p) !== v) differing.push(p); }
  for (const p of B.keys()) if (!A.has(p)) onlyInB.push(p);
  return { identical: !onlyInA.length && !onlyInB.length && !differing.length, onlyInA, onlyInB, differing };
}
