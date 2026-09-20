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
//
// THE FIRST BRAND WAS A SYMBOL KEY ON THE TOKEN, and a symbol key is readable off any real token with
// Object.getOwnPropertySymbols. Composition attack C3 built a frozen object carrying the recovered
// symbol, a NORMATIVE kind, a grant it was never given and an ancestry entry naming OWNER - and
// isAuthority(), tracesToIndependentRoot() and commit() all accepted it. "Unforgeable" held only
// against code that never held a token. Membership in a module-private WeakSet carries nothing on the
// object at all: there is no property to copy, a clone or a JSON round-trip is not a member, and the
// only way in is token(), which only the constructors below call.
//
// STATED PLAINLY, because the alternative is theater: this closes a representational hole. The
// calculus has no production consumer today (measured), so nothing at runtime asks isAuthority()
// before acting; a consumer that never asks is not protected by an answer.
const MINTED = new WeakSet();

const token = ({ claim, kind, context, grant, ancestry, constructor: ctor, valid = true, why }) => {
  const t = Object.freeze({
    claim, kind, context: Object.freeze({ ...context }),
    grant: Object.freeze([...(grant || [])]), ancestry: Object.freeze([...ancestry]), constructor: ctor,
    valid, ...(why === undefined ? {} : { why }),
  });
  MINTED.add(t);
  return t;
};

export const isAuthority = (t) => !!(t && typeof t === 'object' && MINTED.has(t));

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
  // DERIVATION IS EPISTEMIC. The first version took kind and grant from premises[0], so the same two
  // premises in opposite order minted a NORMATIVE token carrying a grant, or an EPISTEMIC one carrying
  // nothing (composition attack W3-f): authority that depends on argument order can be steered by
  // argument order. Permission is DELEGATED, never derived; a normative premise is refused here.
  if (premises.some((p) => p.kind !== KIND.EPISTEMIC)) {
    return refuse('DERIVE is an epistemic constructor: it entails what may be BELIEVED from what is'
      + ' believed. A NORMATIVE premise has no place in it - permission is delegated, not derived.');
  }

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
  //
  // AND A DIMENSION A PREMISE NEVER ESTABLISHED IS NOT IN IT EITHER. The first version filtered absent
  // values out before intersecting, so {} joined with {repository: S1} produced a conclusion AT S1 - a
  // premise that licensed nothing over repository lent the conclusion the other premise's world
  // (composition attack C2). That read absence as "for all"; justification.mjs reads the same absence
  // as "never established, licenses nothing", and two readings of one thing is the domain-algebra
  // defect again. The calculus now agrees with the graph: a dimension goes into the output only when
  // EVERY premise establishes it and they agree. Anything else is DROPPED - a free narrowing, not a
  // refusal, because a conclusion may be weaker than its premises - and the drop is recorded in the
  // ancestry so an audit can see what the conclusion is no longer about.
  const dims = contextDimensions.length ? contextDimensions
    : [...new Set(premises.flatMap((p) => Object.keys(p.context)))];
  const context = {};
  const conflicts = [];
  const dropped = [];
  for (const d of dims) {
    const each = premises.map((p) => p.context[d]);
    if (each.some((v) => v === undefined || v === null)) {
      dropped.push({ dimension: d, why: 'not established by every premise' });
      continue;
    }
    const vals = [...new Set(each)];
    if (vals.length > 1) { conflicts.push({ dimension: d, values: vals.map(String) }); continue; }
    context[d] = vals[0];
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
    for (const c of conflicts) dropped.push({ dimension: c.dimension, why: 'bridged, not carried' });
  }
  return token({ claim, kind: KIND.EPISTEMIC, context, grant: [],
    ancestry: [{ via: 'DERIVE', rule: rule.name, premises: premises.length,
      witnesses: relationWitnesses.map((w) => w.relation), dropped }],
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
  // THE WORLD A GRANT APPLIES IN MAY NARROW AND MAY NEVER WIDEN, exactly like the grant. The first
  // version took `context || from.context` on trust, so a holder of [x] over {repository: S1} could hand
  // [x] over {} - every world - to a grantee (composition attack W3-c): non-widening was enforced for
  // the grant and not for where it applies. Every dimension the grantor's context establishes must be
  // present and equal in the grantee's; the grantee may add dimensions.
  const ctx = context || from.context;
  const widened = Object.entries(from.context).filter(([d, v]) => ctx[d] !== v).map(([d]) => d);
  if (widened.length) {
    return refuse('DELEGATE refused: the grantee\'s context drops or changes ' + widened.join(', ')
      + ', which the grantor\'s context pins. A grant over one world is not a grant over every world.',
    { widened });
  }
  return token({ claim: to, kind: KIND.NORMATIVE, context: ctx, grant,
    ancestry: [...from.ancestry, { via: 'DELEGATE', to }], constructor: 'DELEGATE' });
}

// ---------------------------------------------------------------------------------------------------
// RESTRICTIONS. Free, unbounded, and requiring no proof, because none of them can increase authority.
//
// NARROW ADDS A CONSTRAINT; IT DOES NOT MOVE ONE. The first version set context[dimension] = value
// unconditionally, so narrowing repository from S1 to S2 was "free" - a referent move under
// restriction's free pass (composition attack W3-d). A dimension already established at a different
// value is refused; an absent one, or the same value, is a restriction.
export const narrow = (t, dimension, value) => {
  if (!isAuthority(t)) return t;
  const held = t.context[dimension];
  if (held !== undefined && held !== null && held !== value) {
    return refuse('NARROW refused: ' + dimension + ' is established at ' + String(held)
      + ' and cannot be moved to ' + String(value) + '. That is a change of referent, not a'
      + ' restriction, and restriction is the only thing this operation is free to do.',
    { dimension, held, value });
  }
  return token({ ...t, context: { ...t.context, [dimension]: value },
    ancestry: [...t.ancestry, { via: 'NARROW', dimension }], constructor: t.constructor });
};

export const restrictGrant = (t, grant) => (isAuthority(t)
  ? token({ ...t, grant: grant.filter((g) => t.grant.includes(g)),
    ancestry: [...t.ancestry, { via: 'RESTRICT' }], constructor: t.constructor })
  : t);

// An invalidated token is still a TOKEN - recognisable, refusable by name - so it goes through token()
// rather than a spread, which under the WeakSet brand would make it an anonymous object instead.
export const invalidate = (t, why) => (isAuthority(t)
  ? token({ ...t, valid: false, why }) : t);

// ---------------------------------------------------------------------------------------------------
// PROPOSE creates NO authority. It produces an untrusted possibility, and the calculus has no constructor
// for it - which is the formal statement of ATTEMPT AUTHORITY != COMMIT AUTHORITY.
export const propose = (candidate) => ({ candidate, authority: null,
  why: 'a proposal is an untrusted possibility. There is no constructor that turns one into authority.' });

// COMMIT CONSUMES authority rather than producing it.
//
// AND THE AUTHORITY IT CONSUMES IS PERMISSION. The first version accepted any valid token, so an
// OBSERVE token - evidence - committed an action: OBSERVE plus COMMIT was an action nobody permitted
// (composition attack W3-e), while delegate() one function up refused to mint permission from the same
// evidence. commit now asks tracesToIndependentRoot, which already existed and which nothing called:
// the token must be NORMATIVE, reach OWNER through a continuous delegation path, and hold every grant
// the action requires. Evidence still establishes what may be believed and still cannot act.
export function commit({ authority, action, requires = [] }) {
  if (!isAuthority(authority) || !authority.valid) {
    return { committed: false, why: 'COMMIT consumes an authority token and none was presented' };
  }
  const rooted = tracesToIndependentRoot(authority, requires);
  if (!rooted.ok) {
    return { committed: false, why: 'COMMIT refused: ' + rooted.why
      + '. Evidence establishes what may be believed; acting needs permission that reaches an'
      + ' independent root.' };
  }
  return { committed: true, action, consumed: authority.ancestry,
    why: 'authority was consumed, not produced' };
}

// L6, THE OTHER HALF. Per-step non-widening stops amplification; it does not by itself establish that an
// exercised authority traces to an independent root whose grant COVERS it. A chain can be locally valid
// at every step and still be rooted in nothing.
//
//     Every exercised authority must have a continuous delegation path to an independent root whose grant
//     covers that exact authority.
//
// Cycles may appear freely in this walk: they add no grant, so they cannot help. What is checked is
// whether the path reaches OWNER at all, and whether the grant survives the whole way.
export function tracesToIndependentRoot(t, need) {
  if (!isAuthority(t)) {
    return { ok: false, why: 'not an authority token' };
  }
  if (t.kind !== KIND.NORMATIVE) {
    return { ok: false, why: 'epistemic authority is not permission and has no delegation root' };
  }
  const uncovered = (need || []).filter((g) => !t.grant.includes(g));
  if (uncovered.length) {
    return { ok: false, uncovered,
      why: 'the exercised authority includes ' + uncovered.join(', ') + ' which this token does not hold' };
  }
  const rooted = t.ancestry.some((a) => a.via === 'DELEGATE' && a.from === 'OWNER');
  if (!rooted) {
    return { ok: false,
      why: 'no step in the delegation ancestry originates at an independent root. Locally valid at every'
        + ' step and rooted in nothing is exactly what a collusion cycle looks like from the inside.' };
  }
  return { ok: true, root: 'OWNER', path: t.ancestry.filter((a) => a.via === 'DELEGATE').length,
    why: 'a continuous delegation path reaches an independent root whose grant covers this authority' };
}
