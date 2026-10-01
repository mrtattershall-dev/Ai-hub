/**
 * snapshotCopy.mjs - construct a copy of a candidate snapshot (D-COPY's rule, as a function).
 *
 * The SAME construction rule batch.js applies at its two copy sites (D-COPY-1, ad850a15): every
 * entry is kept except paths with a component exactly `.git`, judged RELATIVE to the source root
 * via the shared predicate. Used by evaluator.js (D-CONS-1) to build the private, immutable object
 * a judgment is made about. It verifies nothing itself - the caller compares cid1 before trusting it.
 */
import { cpSync, mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import { isExcludedRelPath } from './snapshotPath.mjs';

export function copySnapshot(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, filter: (p) => !isExcludedRelPath(relative(src, p)) });
}
