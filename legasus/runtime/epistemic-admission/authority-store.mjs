// THE AUTHORITY STORE — where an evidence_root resolves to real minted authority.
//
// AN AUTHORITY STORE, NOT AN EVIDENCE STORE. Evidence can exist without authority. What matters
// behind one of these references is that the object already survived the constructors and the
// admission boundary.
//
// A RELATION WITNESS IS NOT EVIDENCE. It is a REFERENCE to an independently established relation
// claim. The store holds tokens the calculus minted; it mints nothing and cannot, because the brand
// is a module-private WeakSet in calculus.mjs.
//
// HANDLES, NEVER TOKENS. A certificate carries a ref. The producer names the handle it wants to
// use; it does not get to say what that handle proves. And because the persistent artefact is an
// ADMISSION RECORD rather than a serialized token, a saved record is deliberately NOT live
// authority after a restart - regaining it costs re-execution, which is the asymmetry the
// justification graph already enforces.
import { isAuthority, KIND } from '../../legaknow/calculus.mjs';

export const relationClaim = (relation, subject, object) =>
  relation + '(' + subject + ', ' + object + ')';

export const VALIDITY = { LIVE: 'LIVE', REVOKED: 'REVOKED', UNESTABLISHED: 'UNESTABLISHED' };

let counter = 0;
const nextRef = () => 'auth:' + (++counter).toString(36) + ':' + Math.random().toString(36).slice(2, 8);

export function store() {
  const entries = new Map();       // ref -> { token, validity, why, record }
  const dependents = new Map();    // ref -> Set<ref>

  const mark = (ref, validity, why, touched) => {
    const e = entries.get(ref);
    if (!e || e.validity === validity) return;
    e.validity = validity;
    e.why = why;
    touched.push(ref);
    // INVALIDATION PROPAGATES. Anything that consumed this loses its standing too.
    for (const d of dependents.get(ref) || []) {
      mark(d, VALIDITY.UNESTABLISHED, 'an authority it consumed became ' + validity + ': ' + why,
        touched);
    }
  };

  return {
    // Only a real token may be filed. An object that merely looks like one is refused here, so the
    // store cannot become a place where unbranded things acquire standing by being stored.
    admitToken(token, record = {}) {
      if (!isAuthority(token)) {
        return { ok: false, why: 'only a minted authority token may be filed; a raw object - '
          + 'including a JSON clone of a real token - is an assertion, not an entitlement' };
      }
      const ref = nextRef();
      entries.set(ref, { token, validity: VALIDITY.LIVE, why: null,
        // THE PERSISTENT ARTEFACT. Note it does NOT contain the token.
        record: { ...record, claim: token.claim, constructor: token.constructor,
          context: { ...token.context }, ancestry: token.ancestry } });
      return { ok: true, ref };
    },

    // Returns the LIVE token or a refusal naming why it is unavailable. Never the raw entry.
    resolve(ref) {
      const e = entries.get(ref);
      if (!e) {
        return { ok: false, why: 'reference "' + ref + '" resolves to nothing in the authority store.'
          + ' An address is not an establishment; naming evidence is not having it.' };
      }
      if (e.validity !== VALIDITY.LIVE) {
        return { ok: false, why: 'reference "' + ref + '" is ' + e.validity
          + (e.why ? ' (' + e.why + ')' : '') + '. Stale authority establishes nothing.' };
      }
      return { ok: true, token: e.token, record: e.record };
    },

    // Revocation is a RESTRICTION and needs no proof; it cannot increase anything.
    revoke(ref, why) {
      const touched = [];
      mark(ref, VALIDITY.REVOKED, why || 'revoked', touched);
      return { touched };
    },

    // REVALIDATION DOES NOT PROPAGATE. Restoring one entry restores exactly that entry; everything
    // that rested on it stays UNESTABLISHED until it is itself re-run.
    reestablish(ref) {
      const e = entries.get(ref);
      if (!e) return { ok: false, why: 'no such reference' };
      e.validity = VALIDITY.LIVE;
      e.why = 'directly re-established; DEPENDENTS ARE NOT RESTORED and must each be re-run';
      return { ok: true, dependentsRestored: 0 };
    },

    // DEPENDENCY TOPOLOGY, not decorative provenance.
    dependsOn(consumerRef, consumedRef) {
      if (!dependents.has(consumedRef)) dependents.set(consumedRef, new Set());
      dependents.get(consumedRef).add(consumerRef);
    },
    validityOf: (ref) => (entries.get(ref) || {}).validity || null,
    recordOf: (ref) => (entries.get(ref) || {}).record || null,
    size: () => entries.size,
  };
}

// RESOLVE a witness's evidence_root to authority establishing the exact relation instance.
// Returns null when it binds, or a string naming which check failed. Never a bare boolean.
export function resolveEvidenceRoot(witness, ctx) {
  const st = ctx.authorityStore;
  if (!st) return 'no authority store is available to resolve evidence roots against';
  const ref = witness.evidence_root;
  if (ref === null || ref === undefined || ref === '') {
    return 'witness has no evidence_root: it asserts a relation without rooting in anything';
  }
  const got = st.resolve(ref);
  if (!got.ok) return got.why;
  const tok = got.token;
  if (!isAuthority(tok)) return 'reference "' + ref + '" resolves to something that is not a token';
  if (!tok.valid) {
    return 'reference "' + ref + '" resolves to an INVALIDATED token'
      + (tok.why ? ' (' + tok.why + ')' : '') + '. Stale authority establishes nothing.';
  }
  if (tok.kind !== KIND.EPISTEMIC) {
    return 'reference "' + ref + '" resolves to ' + tok.kind + ' authority. A relation is established'
      + ' by evidence, not by permission.';
  }
  const need = relationClaim(witness.relation, witness.subject, witness.object);
  if (tok.claim !== need) {
    return 'reference "' + ref + '" establishes "' + tok.claim + '" and this witness needs "' + need
      + '". A valid token for another proposition is not evidence for this one.';
  }
  // WORLD IDENTITY is {repository, claim_domain}, determined by the search in
  // WORLD-IDENTITY_PREREG. Both are compared for EQUALITY; extent is compared by ORDER, because
  // requiring extent equality would refuse a legitimate narrowing (arm D3a).
  const c = tok.context || {};
  if (ctx.requiredRepository !== undefined && c.repository !== undefined
      && c.repository !== ctx.requiredRepository) {
    return 'reference "' + ref + '" was established in repository ' + String(c.repository)
      + ' and this derivation is in ' + String(ctx.requiredRepository)
      + '. A relation proven in another world does not hold in this one.';
  }
  if (c.claim_domain !== undefined && c.claim_domain !== witness.domain) {
    return 'reference "' + ref + '" was established over claim domain ' + String(c.claim_domain)
      + ' and the witness is about ' + String(witness.domain)
      + '. Same repository, different population: the authority does not transfer.';
  }
  if (ctx.requiredExtent !== undefined && ctx.requiredExtent !== null
      && c.examined !== undefined && c.examined !== null && c.examined < ctx.requiredExtent) {
    return 'reference "' + ref + '" examined ' + c.examined + ' of the domain and this derivation'
      + ' needs ' + ctx.requiredExtent + '. Narrowing is free; widening needs its own authority.';
  }
  if (ctx.derivingClaim) {
    const ancestry = JSON.stringify(tok.ancestry || []);
    if (tok.claim === ctx.derivingClaim || ancestry.includes(ctx.derivingClaim)) {
      return 'reference "' + ref + '" depends on "' + ctx.derivingClaim + '", which is the claim it'
        + ' is being used to justify. CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION.';
    }
  }
  return null;
}
