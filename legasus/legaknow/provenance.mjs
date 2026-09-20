// r4 — PROVENANCE BINDING. Attaches to immutable artifact identity, never to storage location.
//
// The sidecar built during the replay retirement keyed provenance by PATHNAME, which is the same identity
// mistake as `module:line` and `module|source`, one layer further out:
//
//     RESULT.json @ bytes A  ->  provenance P
//     RESULT.json @ bytes B  ->  same pathname  ->  accidentally inherits P
//
// PROVENANCE.json now participates directly in the evidence chain, so its referential integrity can
// change entitlement today rather than hypothetically.
//
//     THE PROPERTY, FROZEN BEFORE THE IMPLEMENTATION: provenance attaches to immutable artifact
//     identity, not to where the artifact happens to be stored.
//
// A content digest is one implementation of that property. The property is what is being asserted; the
// digest is how it is currently met, and a digest identifies faithfully only the thing it is computed
// over - which here is the artifact's full bytes.
//
// THE DELIBERATE CONSEQUENCE, decided before testing rather than after: identical bytes at a DIFFERENT
// path RETAIN provenance. Moving or renaming an artifact does not change what produced it. That is the
// admit control, and without it "referential integrity" would just mean brittleness.
import { createHash } from 'node:crypto';

export const digestOf = (bytes) => createHash('sha256')
  .update(Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes))).digest('hex');

export const NOT_ESTABLISHED = 'NOT_ESTABLISHED';

// One binding: this content was produced by this implementation. `path` is carried as DESCRIPTION so a
// human can find the artifact, and is never consulted for identity.
export function bind({ bytes, producedBy, git = null, path = null }) {
  if (!producedBy) {
    return { rejected: true,
      why: 'a binding must declare what produced the artifact; an undeclared binding would let a lookup'
        + ' manufacture provenance out of nothing' };
  }
  return { digest: digestOf(bytes), producedBy, git, describedPath: path };
}

export function ledger(bindings) {
  const byDigest = new Map();
  for (const b of bindings) {
    if (b.rejected) continue;
    byDigest.set(b.digest, b);
  }
  return {
    byDigest,
    // The integrity of the sidecar ITSELF. A modified ledger must be detectable, or provenance is only
    // as trustworthy as the last person to edit the file.
    seal: () => digestOf([...byDigest.keys()].sort().join('|')),
    // LOOKUP IS BY CONTENT. A path is never enough to establish provenance.
    lookup: (bytes) => byDigest.get(digestOf(bytes))
      || { provenance: NOT_ESTABLISHED,
        why: 'no binding exists for these bytes. A missing binding is an absence of evidence about the'
          + ' artifact, and never a licence to attribute it to whatever last occupied its path.' },
  };
}

export const verifySeal = (led, expected) => ({
  ok: led.seal() === expected,
  why: led.seal() === expected ? 'the ledger is unmodified since sealing'
    : 'THE LEDGER HAS CHANGED since it was sealed; its attributions may not be relied upon',
});
