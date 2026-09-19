// THE AUTHORITY CALCULUS — the conservation rule the seven laws may turn out to be consequences of.
//
//     AUTHORITY MAY BE OBSERVED, DERIVED, OR DELEGATED. IT MAY NEVER BE INFERRED FROM ITS OWN ABSENCE,
//     MANUFACTURED BY REPRESENTATION, OR AMPLIFIED BY CIRCULATION.
//
// Seven named laws, each mechanized after its own defect, is a cathedral. This project's own lesson - do
// not discipline repeated failure, remove the opportunity mechanically - applies to the architecture
// itself. 394 tests currently amount to "please do not accidentally manufacture authority". So authority
// becomes a VALUE THAT CANNOT BE MINTED WITHOUT PROVENANCE, and the illegal transitions stop being
// things we test for and become things that cannot be written.
//
//     AUTHORITY_OUT(T)  subset of  DERIVABLE( AUTHORITY_IN(T), NEW_EVIDENCE(T), DELEGATION(T) )
//
// THREE CONSTRUCTORS, each demanding its proof object:
//
//     OBSERVE    new evidence establishes epistemic entitlement. Requires an observation that actually
//                observed something, with complete provenance. UNKNOWN cannot observe its way to
//                ESTABLISHED by being asked twice.
//     DERIVE     existing entitlements produce an entailed one. Requires an admissible rule AND witnesses
//                for the RELATION between premises - because COEXISTENCE DOES NOT ESTABLISH RELATION.
//                Output context is the INTERSECTION of premise contexts; it cannot exceed any of them.
//     DELEGATE   an authority holder grants a SUBSET of what it holds and is permitted to pass on.
//                Delegation can never widen, so circulation cannot amplify.
//
// RESTRICTION IS FREE. narrow, invalidate and markStale need no constructor at all, because nothing they
// do can increase authority. That asymmetry is the calculus.
//
// COEXISTENCE DOES NOT ESTABLISH RELATION is the join insight generalized. Two individually proven nodes
// do not prove an edge between them:
//
//     A o          o B        does not become        A o------->o B
//
// merely because they occupy a compatible world. WRITE(I1, x, 5) and READ(I2, x, 5) at the same state do
// not entail that I1 caused what I2 read - something else may have written x between them. A join needs
// EVIDENCE OF THE EDGE, not evidence of both endpoints.
import { evidenceFrom } from './observation.mjs';

// The brand. Module-private, so a token cannot be constructed anywhere else - this is the difference
// between a rule and an impossibility.
const MINT = Symbol('authority-mint');

const token = ({ claim, kind, context, grant, ancestry, constructor: ctor }) => Object.freeze({
  [MINT]: true, claim, kind, context: Object.freeze({ ...context }),
  grant: Object.freeze([...(grant || [])]), ancestry: Object.freeze([...ancestry]), constructor: ctor,
  valid: true,
});

export const isAuthority = (t) => !!(t && t[MINT] === true);

export const KIND = { EPISTEMIC: 'EPISTEMIC', NORMATIVE: 'NORMATIVE' };

const refuse = (why, extra = {}) => ({ minted: false, why, ...extra });

// ---------------------------------------------------------------------------------------------------
// CONSTRUCTOR 1 — OBSERVE. The only route from nothing to something, and it demands that something was
// actually observed. This is where law 1 and law 4 come from: a producer failure carries no evidential
// force, so there is nothing for a token to be made of.
export function observe({ observation, procedure, context }) {
  const e = evidenceFrom(observation);
  if (!e.ok) {
    return refuse('OBSERVE requires an observation with evidential force and complete provenance; this'
      + ' one reports ' + e.reason + '. Authority cannot be inferred from its own absence.', { reason: e.reason });
  }
  if (!procedure) return refuse('OBSERVE requires the procedure that produced the observation');
  if (!context) return refuse('OBSERVE requires the context the observation was made in');
  return token({ claim: observation.subject, kind: KIND.EPISTEMIC, context,
    grant: [], ancestry: [{ via: 'OBSERVE', procedure, status: observation.status }],
    constructor: 'OBSERVE' });
}

// ---------------------------------------------------------------------------------------------------
// CONSTRUCTOR 2 — DERIVE. Laws 2 and 5 come from here. The relation between premises must be WITNESSED,
// and the resulting context can only shrink.
export function derive({ premises = [], rule, relationWitnesses = [], claim, contextDimensions = [] }) {
  if (!premises.length) return refuse('DERIVE requires premises');
  if (!premises.every(isAuthority)) {
    return refuse('DERIVE requires every premise to be an authority token. A raw object is an assertion,'
      + ' not an entitlement.');
  }
  if (premises.some((p) => !p.valid)) {
    return refuse('DERIVE requires every premise to be currently valid');
  }
  if (!rule) return refuse('DERIVE requires an admissible inference rule');

  // COEXISTENCE DOES NOT ESTABLISH RELATION. Every relation the rule depends on needs its own witness.
  const needed = rule.requires || [];
  const have = new Set(relationWitnesses.map((w) => w.relation));
  const missing = needed.filter((r) => !have.has(r));
  if (missing.length) {
    return refuse('DERIVE refused: the rule "' + (rule.name || '?') + '" requires witnesses for '
      + missing.join(', ') + '. Two individually proven endpoints do not prove an edge between them.',
    { missing });
  }

  // The output context is the INTERSECTION. A dimension on which premises disagree is not in it, so no
  // conclusion can be stated for a world none of the premises covered.
  const dims = contextDimensions.length ? contextDimensions
    : [...new Set(premises.flatMap((p) => Object.keys(p.context)))];
  const context = {};
  const conflicts = [];
  for (const d of dims) {
    const vals = [...new Set(premises.map((p) => p.context[d]).filter((v) => v !== undefined
      && v !== null))];
    if (vals.length > 1) { conflicts.push({ dimension: d, values: vals.map(String) }); continue; }
    if (vals.length === 1) context[d] = vals[0];
  }
  if (conflicts.length) {
    const bridged = conflicts.filter((c) => !relationWitnesses
      .some((w) => w.relation === 'BRIDGE:' + c.dimension));
    if (bridged.length) {
      return refuse('DERIVE refused: premises were established in different worlds ('
        + bridged.map((c) => c.dimension + ': ' + c.values.join(' vs ')).join('; ')
        + ') and no bridge witness covers the difference. The authority would appear BETWEEN the edges.',
      { conflicts: bridged });
    }
  }
  return token({ claim, kind: premises[0].kind, context, grant: premises[0].grant,
    ancestry: [{ via: 'DERIVE', rule: rule.name, premises: premises.length,
      witnesses: relationWitnesses.map((w) => w.relation) }],
    constructor: 'DERIVE' });
}

// ---------------------------------------------------------------------------------------------------
// CONSTRUCTOR 3 — DELEGATE. Laws 3 and 6 come from here. A holder may pass on a SUBSET of what it holds.
// Because delegation can only shrink, a cycle can circulate authority and can never amplify it.
export function delegate({ from, grant = [], to, context }) {
  if (from !== 'OWNER' && !isAuthority(from)) {
    return refuse('DELEGATE requires the grantor to be an authority token, or the independent root OWNER.'
      + ' A component cannot delegate authority it was never given.');
  }
  if (!grant.length) return refuse('DELEGATE requires a non-empty grant');
  if (!to) return refuse('DELEGATE requires a grantee');

  if (from === 'OWNER') {
    return token({ claim: to, kind: KIND.NORMATIVE, context: context || {}, grant,
      ancestry: [{ via: 'DELEGATE', from: 'OWNER', to }], constructor: 'DELEGATE' });
  }
  if (from.kind !== KIND.NORMATIVE) {
    return refuse('DELEGATE requires NORMATIVE authority. Evidence establishes what may be BELIEVED; it'
      + ' does not originate permission. Perfect evidence that deleting the project would make every'
      + ' test pass does not entail permission to delete it.');
  }
  const widening = grant.filter((g) => !from.grant.includes(g));
  if (widening.length) {
    return refuse('DELEGATE refused: the grant includes ' + widening.join(', ')
      + ' which the grantor does not hold. Delegation may narrow and may never widen, which is why'
      + ' circulating permission around a cycle cannot amplify it.', { widening });
  }
  return token({ claim: to, kind: KIND.NORMATIVE, context: context || from.context, grant,
    ancestry: [...from.ancestry, { via: 'DELEGATE', to }], constructor: 'DELEGATE' });
}

// ---------------------------------------------------------------------------------------------------
// RESTRICTIONS. Free, unbounded, and requiring no proof, because none of them can increase authority.
export const narrow = (t, dimension, value) => (isAuthority(t)
  ? token({ ...t, context: { ...t.context, [dimension]: value },
    ancestry: [...t.ancestry, { via: 'NARROW', dimension }], constructor: t.constructor })
  : t);

export const restrictGrant = (t, grant) => (isAuthority(t)
  ? token({ ...t, grant: grant.filter((g) => t.grant.includes(g)),
    ancestry: [...t.ancestry, { via: 'RESTRICT' }], constructor: t.constructor })
  : t);

export const invalidate = (t, why) => (isAuthority(t)
  ? Object.freeze({ ...t, valid: false, why }) : t);

// ---------------------------------------------------------------------------------------------------
// PROPOSE creates NO authority. It produces an untrusted possibility, and the calculus has no constructor
// for it - which is the formal statement of ATTEMPT AUTHORITY != COMMIT AUTHORITY.
export const propose = (candidate) => ({ candidate, authority: null,
  why: 'a proposal is an untrusted possibility. There is no constructor that turns one into authority.' });

// COMMIT CONSUMES authority rather than producing it.
export function commit({ authority, action }) {
  if (!isAuthority(authority) || !authority.valid) {
    return { committed: false, why: 'COMMIT consumes an authority token and none was presented' };
  }
  return { committed: true, action, consumed: authority.ancestry,
    why: 'authority was consumed, not produced' };
}
