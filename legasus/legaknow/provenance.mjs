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

// TWO ATTRIBUTIONS FOR ONE DIGEST ARE A RELATION, NOT A WINNER AND NOT A CONTEST.
//
// The first ledger did `byDigest.set` in order, so the second binding for the same bytes silently
// replaced the first - the last-wins map of Entry 5, the exact defect behind 49 / 7 / 1, inside the
// module written to fix attribution (composition attack C8-a). Keeping both and attributing to
// neither was right and still stands.
//
// CALLING THEM CONTESTED WAS NOT. `ledger.mjs` LAW 3 defines CONTESTED as contradicting live claims
// that block reliance AND OWE AN EXPERIMENT. Provenance is a RELATION - a production event relates a
// producer to content - and identical bytes can legitimately arise through several histories, so
// "A produced these bytes" and "B produced these bytes" can BOTH BE TRUE. No experiment separates two
// tools that each emitted an empty file, and this project already contains the case: three pyparsing
// files in repoC/IDENTITY.json share the empty-file digest. Attaching an unsatisfiable obligation to
// that state manufactures work out of a name - and it is composition attack C4, a state acquiring a
// declared word's authority because the strings matched, committed inside the repair for C8.
//
// So the state says what is known - N production events bind this content, no single producer is
// established - and says why nothing stronger is available: the digest is the only identity here (path
// is DESCRIPTION, by the decision that makes the identity property work), so this ledger CANNOT tell
// two legitimate histories from one damaged record, and must not pretend otherwise.
//
// CONTESTED IS NOT RENAMED INTO THIS MODULE, it is removed from it. A conflict claim needs evidence
// that the content had ONE history; a check holding that coordinate is not started, and where it
// belongs is recorded as UNKNOWN rather than invented here.
export const MULTIPLY_BOUND = 'MULTIPLY_BOUND';

const sameAttribution = (x, y) => x.producedBy === y.producedBy
  && JSON.stringify(x.git ?? null) === JSON.stringify(y.git ?? null);
const attributionKey = (b) => b.producedBy + '@' + ((b.git && b.git.commit) || '-');

export function ledger(bindings) {
  const byDigest = new Map();
  for (const b of bindings) {
    if (b.rejected) continue;
    const held = byDigest.get(b.digest);
    if (!held) { byDigest.set(b.digest, b); continue; }
    if (held.provenance === MULTIPLY_BOUND) {
      if (!held.bindings.some((x) => sameAttribution(x, b))) held.bindings.push(b);
      continue;
    }
    if (sameAttribution(held, b)) continue;
    byDigest.set(b.digest, { digest: b.digest, provenance: MULTIPLY_BOUND, bindings: [held, b],
      why: 'these bytes carry more than one production event. No single producer is established and'
        + ' every binding is kept - picking one would be the last-wins map that destroyed the Repo C'
        + ' attribution. This is NOT a contradiction: identical content may have several histories,'
        + ' and a digest-keyed ledger cannot tell that from a damaged record, so it claims neither.' });
  }
  // THE SEAL COVERS THE ATTRIBUTIONS, NOT ONLY THE ARTIFACT SET. The first seal was a digest over the
  // sorted digests, so rewriting a binding's producedBy after sealing left the seal valid (C8-b): it
  // protected which artifacts were listed and not what was said about them.
  const sealLine = (b) => b.digest + '=' + (b.provenance === MULTIPLY_BOUND
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
