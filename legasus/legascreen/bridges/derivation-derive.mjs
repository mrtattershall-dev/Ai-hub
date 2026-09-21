// A SEMANTIC BRIDGE between the Python derivation gate and the calculus's derivation structure.
//
// PRODUCTION      EntitlementCertificate.derivation   (contract v1.0.0-frozen-2026-09-21)
//                 alternatives[]  ANY-of;  premises[] within one alternative  ALL-of
// SPECIFICATION   justification.mjs::entitled over a graph with ANY_OF and REQUIRES edges
//                 "does at least one alternative survive, with every premise established?"
//
// TWO GRANULARITIES, and the bridge must not flatten them. calculus.derive() is ONE derivation - every
// premise passed to it must be a valid token. Alternatives are claim-level ANY_OF, which lives in
// justification.mjs and was added there precisely because conjunctive supports under-admitted subjects
// with several independent justifications. So:
//
//     one certificate alternative          <->   one derivation (ALL premises)
//     several alternatives                 <->   ANY_OF at the claim node
//
// WHY THE SPECIFICATION ENDPOINT IS entitled() AND NOT derive(): derive() requires premise TOKENS, and
// minting those is the measurement bridge's business, which is blocked on the contract's attribution
// gap. entitled() evaluates the AND/OR structure over node validity without needing minted tokens, so it
// exercises exactly the half this bridge is about. derive() per alternative belongs to the runtime
// adapter (step 5), not to a comparison instrument.
//
//   WIDE        relation PARTIAL
//   RESTRICTED  relation EQUIVALENT   ONLY where every premise is decidable at its site
//
// THE VOCABULARY GAP: the justification graph has validity ESTABLISHED / UNESTABLISHED / INVALID. It has
// no way to say "undecidable at this site" - the distinction H-DEFINED spent an experiment establishing.
// Mapping undecidable -> UNESTABLISHED would erase it. So an undecidable premise is UNMAPPABLE: a gap in
// the SPECIFICATION's vocabulary, not evidence against production.
import { RELATION } from '../bridge.mjs';

const PROV = 'contracts/ENTITLEMENT-CERTIFICATE.md rule 5: "alternatives[] is ANY-of; premises[] within'
  + ' one is ALL-of. Flattening this to one DERIVE call would erase the structure justification.mjs'
  + ' already found necessary."  ||  justification.mjs EDGE.ANY_OF: "AT LEAST ONE alternative must be'
  + ' entitled at this scope. Zero surviving alternatives is a refusal, not a pass."';

export const ENDPOINTS = { production: 'legasus/contracts/entitlement-certificate.schema.json',
  specification: 'legasus/legaknow/justification.mjs' };

export const WIDE = {
  production_subject: 'EntitlementCertificate::derivation',
  production_observation: 'passed: boolean; alternatives[{premises[{decidable_at_site, settled}], closed}]',
  specification_subject: 'justification.mjs::entitled (ANY_OF over REQUIRES)',
  specification_proposition: 'a claim is entitled iff some alternative survives with every premise established',
  relation: RELATION.PARTIAL,
  provenance: PROV + '  ||  RELATION PARTIAL because production distinguishes undecidable from'
    + ' unsettled premises and the graph vocabulary does not.',
  evidence: 'read from the contract and justification.mjs; the F2 certificate carries an undecidable'
    + ' premise the graph cannot express',
};

export const RESTRICTED = {
  ...WIDE,
  relation: RELATION.EQUIVALENT,
  domain: 'every premise in every alternative is decidable at its site',
  provenance: PROV + '  ||  RELATION EQUIVALENT only where decidability is not in question, so'
    + ' settled/unsettled maps onto ESTABLISHED/UNESTABLISHED without loss.',
  reason_correspondence: {
    ONE_ALTERNATIVE_CLOSED: 'ALTERNATIVE_SURVIVED',
    NO_CLOSED_ALTERNATIVE: 'NO_SURVIVING_ALTERNATIVE',
  },
};

export const inDomain = (d) => !!(d && Array.isArray(d.alternatives) && d.alternatives.length > 0
  && d.alternatives.every((a) => a.premises.every((p) => p.decidable_at_site === true)));

export const unrepresentable = (d) => {
  if (!d || !Array.isArray(d.alternatives)) return 'derivation carries no alternatives array';
  if (d.alternatives.length === 0) return 'zero alternatives: the graph needs at least one support to walk';
  for (const [i, a] of d.alternatives.entries()) {
    for (const [j, p] of a.premises.entries()) {
      if (p.decidable_at_site === false) {
        return 'alternative ' + i + ' premise ' + j + ' (' + p.ref + ') is UNDECIDABLE at its site.'
          + ' The justification graph has ESTABLISHED/UNESTABLISHED/INVALID and no way to say'
          + ' "undecidable"; mapping it to UNESTABLISHED would erase the distinction H-DEFINED'
          + ' established. Gap in the SPECIFICATION vocabulary, not evidence against production.';
      }
    }
  }
  return null;
};

export const readProduction = (d) => {
  if (!d || typeof d.passed !== 'boolean') return { result: null };
  if (d.passed) return { result: 'PERMITTED', reasonClass: 'ONE_ALTERNATIVE_CLOSED' };
  if (d.alternatives.some((a) => a.premises.some((p) => p.decidable_at_site === false))) {
    return { result: 'REFUSED', reasonClass: 'UNDECIDABLE_PREMISE' };   // outside the bridge's domain
  }
  return { result: 'REFUSED', reasonClass: 'NO_CLOSED_ALTERNATIVE' };
};

export const readSpecification = (ent) => {
  if (!ent || typeof ent.ok !== 'boolean') return { result: null };
  if (ent.ok) return { result: 'PERMITTED', reasonClass: 'ALTERNATIVE_SURVIVED' };
  const why = (ent.problems || []).map((p) => p.why).join(' | ');
  if (/no surviving alternative/.test(why)) return { result: 'REFUSED', reasonClass: 'NO_SURVIVING_ALTERNATIVE' };
  return { result: 'REFUSED' };
};

// THE TRANSLATION. Certificate structure -> a justification graph, evaluated by the graph's own
// entitled(). `J` is justification.mjs. Premise nodes are ESTABLISHED iff settled; alternative nodes
// REQUIRE their premises; the claim node has ANY_OF over the alternatives. No token is built here.
export const toSpecification = (J, cert) => {
  const g = J.graph();
  const sc = J.scope({ repository: 'R' });
  const altIds = [];
  for (const [i, a] of cert.derivation.alternatives.entries()) {
    const premIds = [];
    for (const [j, p] of a.premises.entries()) {
      const n = J.node({ kind: J.NODE.OBSERVATION, proposition: 'premise ' + i + '.' + j + ' ' + p.ref,
        scope: sc, basis: 'certificate' });
      if (!p.settled) { n.validity = J.VALIDITY.UNESTABLISHED; n.why = 'not settled'; }
      J.add(g, n);
      premIds.push({ id: n.id, edge: J.EDGE.REQUIRES });
    }
    const alt = J.node({ kind: J.NODE.INTERPRETATION, proposition: 'alternative ' + i, scope: sc,
      basis: 'certificate', supports: premIds });
    J.add(g, alt);
    altIds.push({ id: alt.id, edge: J.EDGE.ANY_OF });
  }
  const claim = J.node({ kind: J.NODE.CLAIM, proposition: cert.requested_claim.predicate, scope: sc,
    basis: 'certificate', supports: altIds });
  J.add(g, claim);
  return J.entitled(g, claim.id, sc);
};
