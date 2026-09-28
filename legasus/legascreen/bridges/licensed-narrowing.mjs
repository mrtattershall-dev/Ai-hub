// A SEMANTIC BRIDGE between the Python downward compiler and the calculus's free restriction.
//
// PRODUCTION      EntitlementCertificate.licensed_claim + licensed_relation   (contract v1.0.0)
//                 "what is the strongest RESTRICTION of the request the evidence discharges?"
// SPECIFICATION   justification.mjs derivationProblems(): "conclusion null - fine; restriction is free"
//                 and calculus.derive(): a dimension not established by every premise is DROPPED,
//                 recorded in ancestry, and the conclusion is weaker for the same claim
//
// AND THEY ARE NOT THE SAME OPERATION. The calculus narrows CONTEXT for the SAME claim: same
// proposition, fewer dimensions. The Python compiler, after REPAIR-LATERAL, narrows the claim's DOMAIN:
// same quantifier and predicate, a contained domain. Those coincide only when the domain IS a context
// coordinate - when shrinking the domain is exactly dropping or tightening one dimension and nothing
// about the proposition moves.
//
//   WIDE        relation PARTIAL
//   RESTRICTED  relation EQUIVALENT   ONLY where licensed_relation is LICENSES, the quantifier and
//                                     predicate are unchanged, and the licensed domain is contained
//                                     in the requested one - a restricting coordinate, nothing else
//
// If the form, predicate or referent changes, or the domains are incomparable, the transformation is
// UNMAPPABLE until some other relation establishes it. That is the A8 defect stated as a bridge rule.
//
// THE DEMOTION, found by the first run of this bridge and recorded rather than hidden. The RESTRICTED
// domain was first declared as "LICENSES, same quantifier and predicate, licensed domain CONTAINED in the
// requested one". A synthetic certificate inside that domain produced RESULT_DISAGREEMENT: production
// PERMITTED and the calculus REFUSED, "stated for THIS_RUN from a premise established at SAMPLE". The
// calculus compares the repository dimension for EQUALITY, null or ANY. It has no domain containment.
// So "FOR_ALL over a contained domain" is a concept the specification cannot express, and by the
// exemplar's own rule that is UNMAPPABLE - a gap in the SPECIFICATION's vocabulary - never a finding
// against production and never coerced to the nearest relation. With containment unrepresentable, the
// only LICENSES certificate that remains representable would have identical domains, which is not
// LICENSES but EQUIVALENT. The RESTRICTED domain is therefore EMPTY on the current calculus, exactly as
// measurement-observe's is empty on the current contract.
//
// A ROW NOT EXERCISED, stated up front: after REPAIR-LATERAL every certificate in the fixture set has
// licensed_relation NONE or EQUIVALENT. There is no real LICENSES instance; the demotion above was
// established on a synthetic one, labelled as such in the test.
import { RELATION } from '../bridge.mjs';

const PROV = 'REPAIR-LATERAL_PREREG.md: "strongest_licensed(requested) may return c only if'
  + ' compare(requested, c) == LICENSES." contracts rule 3: the licensed slot requires a relation proof.'
  + '  ||  justification.mjs derivationProblems(): "conclusion null - fine - the conclusion is weaker'
  + ' than its premise; restriction is free." calculus.mjs DERIVE: "a dimension a premise never'
  + ' established is not in [the output]... DROPPED - a free narrowing, not a refusal."';

export const ENDPOINTS = { production: 'legasus/contracts/entitlement-certificate.schema.json',
  specification: 'legasus/legaknow/justification.mjs' };

export const WIDE = {
  production_subject: 'EntitlementCertificate::licensed_claim',
  production_observation: 'licensed_relation: NONE|LICENSES|EQUIVALENT; licensed_claim: claim|null',
  specification_subject: 'justification.mjs::derivationProblems (restriction is free)',
  specification_proposition: 'a conclusion may be stated for fewer context dimensions than its premise',
  relation: RELATION.PARTIAL,
  provenance: PROV + '  ||  RELATION PARTIAL because production narrows a claim DOMAIN and the'
    + ' calculus narrows a claim CONTEXT; those are the same only when the domain is a coordinate.',
  evidence: 'read from both sources; no LICENSES certificate exists in the fixture set to exercise'
    + ' the restricted domain',
};

export const RESTRICTED = {
  ...WIDE,
  relation: RELATION.EQUIVALENT,
  domain: 'licensed_relation is LICENSES, quantifier and predicate unchanged, licensed domain'
    + ' representable to the calculus - which, with containment unrepresentable, is EMPTY',
  provenance: PROV + '  ||  RELATION EQUIVALENT declared, and DEMOTED to an empty domain by the first'
    + ' run: the calculus has no domain containment, so every genuine LICENSES narrowing is UNMAPPABLE.',
  reason_correspondence: {
    RESTRICTED_TO_CONTAINED_DOMAIN: 'RESTRICTION_FREE',
    NO_NARROWING: 'RESTRICTION_FREE',
  },
};

const contained = (inner, outer) => inner.name === outer.name || (inner.contained_in || []).includes(outer.name);

// The domain predicate requires representability, as every bridge here does. Since containment is
// unrepresentable, this is satisfiable only by identical domains under LICENSES, which cannot occur.
export const inDomain = (cert) => {
  const r = cert && cert.requested_claim; const l = cert && cert.licensed_claim;
  if (!r || !l || cert.licensed_relation !== 'LICENSES') return false;
  return r.quantifier === l.quantifier && r.predicate === l.predicate
    && contained(l.domain, r.domain) && unrepresentable(cert) === null;
};

export const unrepresentable = (cert) => {
  const r = cert && cert.requested_claim; const l = cert && cert.licensed_claim;
  if (!r) return 'no requested_claim';
  if (l === null) return null;                       // nothing licensed: representable as "no conclusion"
  if (cert.licensed_relation === 'EQUIVALENT') return null;
  if (r.quantifier !== l.quantifier) {
    return 'licensed quantifier ' + l.quantifier + ' differs from requested ' + r.quantifier
      + '. The calculus narrows context for the SAME claim; a changed quantifier is a different'
      + ' proposition, which no restriction expresses. UNMAPPABLE, not coerced.';
  }
  if (r.predicate !== l.predicate) return 'licensed predicate differs from requested: a different proposition, UNMAPPABLE.';
  if (!contained(l.domain, r.domain)) {
    return 'licensed domain ' + l.domain.name + ' is not contained in requested ' + r.domain.name
      + ': a lateral move, which is the A8 defect and is UNMAPPABLE by construction.';
  }
  if (l.domain.name !== r.domain.name) {
    return 'licensed domain ' + l.domain.name + ' is CONTAINED in requested ' + r.domain.name
      + ' but differs from it. The calculus compares the repository dimension for equality, null or'
      + ' ANY and has no domain containment, so this restriction has no counterpart there. Gap in the'
      + ' SPECIFICATION vocabulary, not evidence against production. (Found by the first run:'
      + ' RESULT_DISAGREEMENT, production PERMITTED, calculus REFUSED.)';
  }
  return null;
};

export const readProduction = (cert) => {
  if (!cert || !['NONE', 'LICENSES', 'EQUIVALENT'].includes(cert.licensed_relation)) return { result: null };
  if (cert.licensed_relation === 'NONE') return { result: 'REFUSED', reasonClass: 'NOTHING_LICENSED' };
  if (cert.licensed_relation === 'EQUIVALENT') return { result: 'PERMITTED', reasonClass: 'NO_NARROWING' };
  return { result: 'PERMITTED', reasonClass: 'RESTRICTED_TO_CONTAINED_DOMAIN' };
};

export const readSpecification = (probs) => {
  if (!Array.isArray(probs)) return { result: null };
  if (probs.length === 0) return { result: 'PERMITTED', reasonClass: 'RESTRICTION_FREE' };
  const why = probs.map((p) => p.why).join(' | ');
  if (/widening a quantifier/.test(why)) return { result: 'REFUSED', reasonClass: 'WIDENING' };
  if (/never established/.test(why)) return { result: 'REFUSED', reasonClass: 'PREMISE_NULL' };
  return { result: 'REFUSED' };
};

// THE TRANSLATION. The requested claim becomes the PREMISE node at the requested domain; the licensed
// claim becomes the CONCLUSION node at the licensed domain (or null repository when nothing is
// licensed). derivationProblems() then says whether stating the conclusion from that premise is a free
// restriction or an illegal move. `J` is justification.mjs; it exposes this check through entitled(),
// which is what is called here on a two-node graph.
export const toSpecification = (J, cert) => {
  const g = J.graph();
  const reqScope = J.scope({ repository: cert.requested_claim.domain.name });
  const premise = J.node({ kind: J.NODE.OBSERVATION, proposition: cert.requested_claim.predicate,
    scope: reqScope, basis: 'certificate' });
  J.add(g, premise);
  const l = cert.licensed_claim;
  const concScope = J.scope({ repository: l ? l.domain.name : null });
  const conclusion = J.node({ kind: J.NODE.CLAIM, proposition: (l || cert.requested_claim).predicate,
    scope: concScope, basis: 'certificate', supports: [{ id: premise.id, edge: J.EDGE.DERIVED_FROM }] });
  J.add(g, conclusion);
  return J.entitled(g, conclusion.id, concScope).problems;
};
