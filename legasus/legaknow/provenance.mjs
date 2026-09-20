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

// TWO ATTRIBUTIONS FOR ONE DIGEST ARE A CONTEST, NOT A WINNER. The first ledger did `byDigest.set` in
// order, so the second binding for the same bytes silently replaced the first - the last-wins map of
// Entry 5, the exact defect behind 49 / 7 / 1, inside the module written to fix attribution
// (composition attack C8-a). Conflicting bindings are now kept together under CONTESTED and a lookup
// returns neither as THE attribution. An identical attribution bound twice is one attribution.
export const CONTESTED = 'CONTESTED';

const sameAttribution = (x, y) => x.producedBy === y.producedBy
  && JSON.stringify(x.git ?? null) === JSON.stringify(y.git ?? null);
const attributionKey = (b) => b.producedBy + '@' + ((b.git && b.git.commit) || '-');

export function ledger(bindings) {
  const byDigest = new Map();
  for (const b of bindings) {
    if (b.rejected) continue;
    const held = byDigest.get(b.digest);
    if (!held) { byDigest.set(b.digest, b); continue; }
    if (held.provenance === CONTESTED) {
      if (!held.bindings.some((x) => sameAttribution(x, b))) held.bindings.push(b);
      continue;
    }
    if (sameAttribution(held, b)) continue;
    byDigest.set(b.digest, { digest: b.digest, provenance: CONTESTED, bindings: [held, b],
      why: 'these bytes carry two different attributions. Neither is returned as the provenance; both'
        + ' are kept, because picking one would be the last-wins map that destroyed the Repo C'
        + ' attribution in the first place.' });
  }
  // THE SEAL COVERS THE ATTRIBUTIONS, NOT ONLY THE ARTIFACT SET. The first seal was a digest over the
  // sorted digests, so rewriting a binding's producedBy after sealing left the seal valid (C8-b): it
  // protected which artifacts were listed and not what was said about them.
  const sealLine = (b) => b.digest + '=' + (b.provenance === CONTESTED
    ? b.bindings.map(attributionKey).sort().join('||') : attributionKey(b));
  return {
    byDigest,
    // The integrity of the sidecar ITSELF. A modified ledger must be detectable, or provenance is only
    // as trustworthy as the last person to edit the file.
    seal: () => digestOf([...byDigest.values()].map(sealLine).sort().join('|')),
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
