/**
 * snapshotPath.mjs - the ONE definition of "Git internals" for the candidate snapshot.
 *
 * Used by cid1.mjs (identity) and batch.js (workspace construction) so the two can never develop
 * two meanings of "exclude .git" - D-COPY-1 (legasus/screen/D-COPY-1_PREREG.md, 4bec21ce) exists
 * because batch.js had one meaning (a SUBSTRING test on the ABSOLUTE path) and the frozen snapshot
 * definition another (an exact COMPONENT, relative to the snapshot root).
 *
 * Pure: no filesystem access, no identity, no policy beyond the frozen rule:
 *
 *     Exclude an entry iff one of its path components, RELATIVE TO THE SNAPSHOT ROOT, is exactly `.git`.
 *
 * `.gitignore`, `.gitattributes`, `.github/`, `.gitconfig`, `foo.git` are all INCLUDED. And because the
 * path is relative, a directory ABOVE the root named `.gitlab-runner` (or `.git`) changes nothing.
 */

/** Is this single path component Git's own metadata directory? */
export const isGitComponent = (name) => name === '.git';

/**
 * Is this path, RELATIVE to the snapshot root, excluded from the snapshot?
 * Accepts '/' or '\' separators. '' (the root itself) is never excluded.
 * An absolute path is refused loudly: judging one is exactly the D-COPY defect.
 */
export function isExcludedRelPath(rel) {
  if (typeof rel !== 'string') throw new TypeError('isExcludedRelPath: path must be a string');
  if (/^([A-Za-z]:|[\\/])/.test(rel)) throw new Error(`isExcludedRelPath: "${rel}" is absolute - judge paths RELATIVE to the snapshot root`);
  return rel.split(/[\\/]/).some(isGitComponent);
}
