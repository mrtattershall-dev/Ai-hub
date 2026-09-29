// THE ATTENUATION RELATION, as a pure function, so it can be attacked without a controller.
//
// The hypothesis under test (STEP5_AUTHORITY_CONTINUITY_PREREG.md §2) is that ATTENUATION IS NOT
// AMPLIFICATION: a requester that can only SHRINK what it passes on cannot gain anything by lying.
// Concretely, if a descendant nominates a desired scope R and the parent holds A:
//
//     A_child = A_parent ∩ R
//
// so a request for {a,b,c,d,everything} against a parent holding {a} yields {a}. The request cannot
// manufacture b..e. That is the whole reason the hypothesis is interesting, and it is the reason this
// is ONE function with no branch that can return a path the parent did not already hold.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO. It is not an event ontology, a policy engine, or a
// delegation graph. It computes one relation and describes one crossing, because the experiment needs
// the authority DECISION observable and nothing more.
//
// A NOTE ON THE ABSENT-REQUEST CASE, which is a result rather than a default. When a descendant
// nominates NO scope there is nothing to intersect, so the honest options are to pass the parent's set
// unchanged (preserving P4 non-loss, violating P3 least-authority) or to pass nothing (the reverse).
// This implements the first, and SAYS SO in the record via `leastAuthority: false`. Least authority
// turns out to require the requester to ask for less; it cannot be conjured at the boundary. That is
// reported, not hidden behind a default.

/** A path is comparable only in one spelling: workspace-relative, forward slashes, no leading ./ */
export function normalizeScope(paths) {
  return [...new Set((paths || [])
    .map((p) => String(p == null ? '' : p).split('\\').join('/').replace(/^\.\//, '').trim())
    .filter(Boolean))];
}

/**
 * Compute what may cross a boundary, and describe the crossing.
 *
 * @param available  the paths the parent is ACTUALLY authorized for, right now
 * @param requested  the paths the descendant nominates, or null/undefined for "did not ask"
 * @returns a crossing record. `delegated` is always a subset of `available` - there is no input for
 *          which it is not, which is the property W6a exists to attack.
 */
export function attenuate(available, requested) {
  const have = normalizeScope(available);
  const asked = requested == null ? null : normalizeScope(requested);

  // THE ONE LINE THAT MATTERS. An intersection cannot produce a member `have` did not contain, so no
  // request - honest, mistaken or adversarial - can widen the result.
  const delegated = asked === null ? have : have.filter((p) => asked.includes(p));

  return {
    available: have,
    requested: asked,
    delegated,
    // What the request asked for and did NOT get. Non-empty means the requester overreached, and it
    // is recorded rather than treated as an error: overreaching is harmless here BY CONSTRUCTION, and
    // the evidence that it was harmless is this field next to `delegated`.
    refusedFromRequest: asked === null ? [] : asked.filter((p) => !have.includes(p)),
    // Which frozen properties this particular crossing satisfies, stated per crossing instead of
    // claimed once for the mechanism.
    attenuated: asked !== null && delegated.length < have.length,
    leastAuthority: asked !== null,
    nonAmplification: delegated.every((p) => have.includes(p)),
  };
}

/**
 * A REPAIR/RETRY crossing, recorded at enqueue time as a REFERENCE and nothing more.
 *
 * It deliberately carries NO paths. Authority is not copied here, because a repair that copied the
 * failed work's scope at enqueue time would resurrect it later even if it had died in between. What
 * is stored is which work item this repair continues; the paths are derived when the repair STARTS.
 */
export function continuationRef({ sourceItemId, parentRunId, boundary = 'repair' }) {
  return {
    boundary,
    continuationOf: sourceItemId || null,
    parentRunId: parentRunId || null,
    // Deliberately null until resolved. A reader seeing these has a reference, not a permission.
    root: null, availableBefore: null, requested: null, delegated: null,
    refusedFromRequest: [], attenuated: false, leastAuthority: false, nonAmplification: true,
  };
}

/**
 * Resolve a continuation reference against the work item it names, at install time.
 *
 * THE CEILING IS THE SOURCE ITEM'S OWN DELEGATED SET. Nothing here can produce a path the source did
 * not hold: `attenuate` is reused precisely so there is one implementation of that property rather
 * than two that happen to agree.
 *
 * `sourceItem` absent, or holding no authority, yields NOTHING - a retry does not resurrect authority
 * whose source is gone. That is the validity condition, and it uses only the existing queue as the
 * source of truth.
 */
export function resolveContinuation(ref, sourceItem) {
  const base = { ...ref };
  const src = sourceItem && sourceItem.authority;
  if (!sourceItem) {
    return { ...base, delegated: [], availableBefore: [], unresolved: 'SOURCE_ITEM_GONE',
      why: 'the work item this repair continues (' + (ref.continuationOf || '?') + ') is no longer present,'
        + ' so there is nothing to continue and no authority is installed' };
  }
  if (!src || !Array.isArray(src.delegated) || !src.delegated.length) {
    return { ...base, delegated: [], availableBefore: [], unresolved: 'SOURCE_HELD_NONE',
      why: 'the work item this repair continues held no authority, so the continuation holds none either' };
  }
  const crossing = attenuate(src.delegated, null);
  return {
    ...base,
    root: src.root || null,
    availableBefore: crossing.available,
    requested: null,
    delegated: crossing.delegated,
    refusedFromRequest: [],
    attenuated: false,
    leastAuthority: false,
    nonAmplification: crossing.nonAmplification,
    unresolved: null,
    why: 'continuation of work item ' + sourceItem.id + ', under the same ceiling it held',
  };
}

/**
 * The crossing as it goes into the record. `root` is where the chain terminates - taken from the
 * grants themselves, never asserted by the caller, so a record cannot claim an owner root it does not
 * have.
 */
export function crossingRecord({ crossing, grants, parentRunId, boundary }) {
  // THE ROOT COMES FROM THE TOKEN'S OWN ANCESTRY, not from a field the caller supplies. `delegate()`
  // records `ancestry: [{ via: 'DELEGATE', from: 'OWNER', to }]`, so the origin is the `from` of the
  // FIRST ancestry entry. Reading a top-level `g.from` returned null for every grant, which is how
  // this was found: the record printed `root: null` while the delegation was perfectly well formed.
  // A record that cannot name its root is not evidence of an owner-rooted chain.
  const roots = [...new Set((grants || [])
    .map((g) => (g && Array.isArray(g.ancestry) && g.ancestry.length ? g.ancestry[0].from : null))
    .filter(Boolean))];
  return {
    boundary,
    parentRunId: parentRunId || null,
    root: roots.length === 1 ? roots[0] : (roots.length ? roots : null),
    availableBefore: crossing.available,
    requested: crossing.requested,
    delegated: crossing.delegated,
    refusedFromRequest: crossing.refusedFromRequest,
    attenuated: crossing.attenuated,
    leastAuthority: crossing.leastAuthority,
    nonAmplification: crossing.nonAmplification,
  };
}
