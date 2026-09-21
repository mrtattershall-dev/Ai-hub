// THE AUTHORITY STORE — where an evidence_root resolves to real minted authority.
//
// A RELATION WITNESS IS NOT EVIDENCE. It is a REFERENCE to an independently established relation
// claim. The store holds tokens the calculus minted; it mints nothing and cannot, because the brand
// is a module-private WeakSet in calculus.mjs.
//
// THE CANONICAL RELATION CLAIM. A relation instance has one spelling, constructed by the consumer
// from the binding context and compared against the token's own claim:
//
//     COVERAGE(F4:derivation0:premise0, SAMPLE)
//
// The matcher COMPARES STRINGS IT BUILT against a claim the token carries. It never inspects an
// evidence payload and judges whether it looks convincing - that would make the registry a second
// epistemic oracle, which is the defect this line exists to remove.
import { isAuthority, KIND } from '../../legaknow/calculus.mjs';

export const relationClaim = (relation, subject, object) =>
  relation + '(' + subject + ', ' + object + ')';

export function store() {
  const byId = new Map();
  return {
    // Only a real token may be filed. An object that merely looks like one is refused here, so the
    // store cannot become a place where unbranded things acquire standing by being stored.
    put(id, token) {
      if (!isAuthority(token)) {
        return { ok: false, why: 'only a minted authority token may be filed under an evidence id;'
          + ' a raw object is an assertion, not an entitlement' };
      }
      byId.set(id, token);
      return { ok: true, id };
    },
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    size: () => byId.size,
  };
}

// RESOLVE a witness's evidence_root to authority that establishes the exact relation instance.
// Returns null when it does, or a string naming which check failed. Never a bare boolean.
export function resolveEvidenceRoot(witness, ctx) {
  const st = ctx.authorityStore;
  if (!st) return 'no authority store is available to resolve evidence roots against';
  const id = witness.evidence_root;
  if (id === null || id === undefined || id === '') {
    return 'witness has no evidence_root: it asserts a relation without rooting in anything';
  }
  const tok = st.get(id);
  if (!tok) {
    return 'evidence_root "' + id + '" resolves to nothing in the authority store. An address is not'
      + ' an establishment; naming evidence is not having it.';
  }
  if (!isAuthority(tok)) {
    return 'evidence_root "' + id + '" resolves to something that is not a minted token';
  }
  if (!tok.valid) {
    return 'evidence_root "' + id + '" resolves to an INVALIDATED token'
      + (tok.why ? ' (' + tok.why + ')' : '') + '. Stale authority establishes nothing.';
  }
  if (tok.kind !== KIND.EPISTEMIC) {
    return 'evidence_root "' + id + '" resolves to ' + tok.kind + ' authority. A relation is'
      + ' established by evidence, not by permission.';
  }
  // THE CLAIM MUST BE THE RELATION INSTANCE, not merely something filed under that id.
  const need = relationClaim(witness.relation, witness.subject, witness.object);
  if (tok.claim !== need) {
    return 'evidence_root "' + id + '" establishes "' + tok.claim + '" and this witness needs "'
      + need + '". A valid token for another proposition is not evidence for this one.';
  }
  // AND IT MUST BE ESTABLISHED IN THE WORLD THE CLAIM IS ABOUT.
  const held = tok.context && tok.context.repository;
  if (held !== undefined && held !== null && held !== witness.domain) {
    return 'evidence_root "' + id + '" was established at repository ' + String(held)
      + ' and the witness is about ' + String(witness.domain)
      + '. A relation proven in another world does not hold in this one.';
  }
  // CIRCULARITY. A root that rests on the very claim being derived would let a conclusion justify
  // its own premise. The justification graph already refuses circular justification; the same has to
  // hold across this reference.
  if (ctx.derivingClaim) {
    const ancestry = JSON.stringify(tok.ancestry || []);
    if (tok.claim === ctx.derivingClaim || ancestry.includes(ctx.derivingClaim)) {
      return 'evidence_root "' + id + '" depends on "' + ctx.derivingClaim + '", which is the claim'
        + ' it is being used to justify. CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION.';
    }
  }
  return null;
}
