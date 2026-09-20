// r4 — A VERDICT ABOUT AN ARTIFACT IS PINNED TO THE ARTIFACT'S BYTES, NOT TO ITS PATH.
//
// The quiesce check measured whether benchmarks/repoC/external.json carries a coordinate that could
// disambiguate the three colliding keys, and classified REPOC_UNRESOLVED_ATTRIBUTION as TERMINAL on
// the answer. It read the file BY PATH. Regenerate that file with richer records and the same check
// would flip the entry to JUSTIFIED and the fresh observations would silently REPLACE the old evidence
// rather than resolve it - the exact thing Entry 10 says cannot happen, made to happen by a path that
// kept its name (composition attack C9-b). Same path is not same referent; provenance.mjs already says
// so for attribution, and this says it for measurement.
//
// A pinned read succeeds only on the bytes the verdict was about. Anything else is reported as what it
// is - REPLACED or ABSENT - and re-measures nothing.
import { readFileSync } from 'node:fs';
import { digestOf } from './provenance.mjs';

export const PIN = { PINNED: 'PINNED', REPLACED: 'REPLACED', ABSENT: 'ABSENT', UNPINNED: 'UNPINNED' };

export function pinnedArtifact({ path, expectedDigest }) {
  if (!expectedDigest) {
    return { ok: false, state: PIN.UNPINNED, path,
      why: 'no recorded digest to pin to; a verdict about unpinned bytes can be re-measured against'
        + ' whatever occupies the path, which is the defect this exists to refuse' };
  }
  let bytes;
  try { bytes = readFileSync(path); } catch (e) {
    return { ok: false, state: PIN.ABSENT, path, expectedDigest,
      why: 'the artifact is absent. A verdict pinned to its bytes cannot be re-measured, and absence'
        + ' is not evidence of anything about it' };
  }
  const actual = digestOf(bytes);
  if (actual !== expectedDigest) {
    return { ok: false, state: PIN.REPLACED, path, expectedDigest, actualDigest: actual,
      why: 'the bytes at this path are not the bytes the verdict was about. They are a different'
        + ' artifact that kept the name; nothing is re-measured and nothing is re-classified' };
  }
  return { ok: true, state: PIN.PINNED, path, digest: actual, bytes };
}
