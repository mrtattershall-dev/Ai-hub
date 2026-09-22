/**
 * comparability.mjs - is a score column COMPARABLE across the runs being reported?
 *
 * A Phaser or Godot verdict depends on the asset library the verifier served: a game that
 * loads a sprite passes or fails on whether THAT library has it, and the library changes
 * as packs are imported. So two runs are only comparable on those axes if every verdict
 * in both was produced against the same asset version.
 *
 * Until 2026-09-22 the scorer detected a version change, printed a warning, and then
 * printed the table anyway under a heading that said COMPARABLE - and only when the prompt
 * sets differed; for same-set comparisons even the warning was unreachable. Worse, a row
 * whose verifier reported NO version contributed nothing to the check, so a run with no
 * version evidence at all looked like agreement.
 *
 * This module is pure so it can be tested without a verifier. Three states, and the third
 * is the one that used to be silently read as the first:
 *
 *   COMPARABLE      every verdict carries a version and all versions are identical
 *   MISMATCH        two or more distinct versions - the column mixes worlds; RESCORE
 *   UNESTABLISHED   at least one verdict carries no version - agreement cannot be claimed
 *
 * Missing evidence is never agreement. Rows scored '?' (harness failure, pass === null) are
 * not verdicts and are excluded: they say nothing about the model or the library.
 */

export const COMPARABILITY = Object.freeze({
  COMPARABLE: 'COMPARABLE',
  MISMATCH: 'MISMATCH',
  UNESTABLISHED: 'UNESTABLISHED',
});

/** The axes whose verdicts depend on the asset library. */
export const ASSET_AXES = Object.freeze(['phaser', 'godot']);

/**
 * @param {Record<string, Array<{pass: boolean|null, assetVersion?: string|null}>>} rows
 *        per run name, the scored rows of ONE axis
 * @returns {{status: string, why: string, versions: string[], missing: Record<string, number>,
 *            counted: Record<string, number>}}
 */
export function assetComparability(rows) {
  const versions = new Set();
  const missing = {};
  const counted = {};
  for (const [run, list] of Object.entries(rows)) {
    missing[run] = 0;
    counted[run] = 0;
    for (const r of list) {
      if (r.pass === null || r.pass === undefined) continue;   // a '?' is not a verdict
      counted[run]++;
      if (r.assetVersion === null || r.assetVersion === undefined || r.assetVersion === '') {
        missing[run]++;
      } else {
        versions.add(String(r.assetVersion));
      }
    }
  }
  const missingTotal = Object.values(missing).reduce((a, b) => a + b, 0);
  const countedTotal = Object.values(counted).reduce((a, b) => a + b, 0);
  const list = [...versions].sort();

  if (countedTotal === 0) {
    return { status: COMPARABILITY.UNESTABLISHED, versions: list, missing, counted,
      why: 'no verdicts on this axis' };
  }
  if (versions.size > 1) {
    return { status: COMPARABILITY.MISMATCH, versions: list, missing, counted,
      why: `verdicts came from ${versions.size} different asset libraries (${list.join(', ')}); `
        + 'the column mixes worlds - RESCORE against one library' };
  }
  if (missingTotal > 0) {
    const where = Object.entries(missing).filter(([, n]) => n).map(([run, n]) => `${run}: ${n}`).join(', ');
    return { status: COMPARABILITY.UNESTABLISHED, versions: list, missing, counted,
      why: `${missingTotal} of ${countedTotal} verdicts carry no asset version (${where}); `
        + 'comparability is UNESTABLISHED - missing evidence is not agreement' };
  }
  return { status: COMPARABILITY.COMPARABLE, versions: list, missing, counted,
    why: `all ${countedTotal} verdicts scored against asset library ${list[0]}` };
}
