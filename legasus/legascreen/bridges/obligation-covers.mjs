// A SEMANTIC BRIDGE between the Python obligation gate and justification.covers().
//
// PRODUCTION      EntitlementCertificate.obligation + requested_claim   (contract v1.0.0)
//                 "does the evidence topology license this QUANTIFIER over this DOMAIN?"
// SPECIFICATION   justification.mjs::covers(granted, required)
//                 "is the granted scope broad enough to license what is asked for?"
//
// AND THEY ARE NOT THE SAME QUESTION. covers() has no quantifier. It is all-or-nothing scope: a
// dimension is established over a value, or null, or ANY. The obligation compiler distinguishes
//
//     EXISTS     one witness with established membership suffices - no exhaustive coverage needed
//     FOR_ALL    exhaustive coverage of the domain, or a general argument
//     NONE       exhaustive coverage AND no satisfying instance
//
// A repository existential licensed by one function witness is PASSED by the obligation gate and would be
// REFUSED by covers() (repository: never established). That is the anti-refusal result of H-EXTENT
// showing up as a vocabulary gap in covers(). Declaring these EQUIVALENT would make the bridge
// manufacture a disagreement on every legitimate existential.
//
//   WIDE        relation PARTIAL
//   RESTRICTED  relation EQUIVALENT   ONLY for FOR_ALL / NONE claims, where "coverage of the domain is
//                                     EXHAUSTIVE" and "granted covers required" ask the same thing
//
// EXISTS and POINTWISE are UNMAPPABLE under this bridge - a gap in the SPECIFICATION's vocabulary.
import { RELATION } from '../bridge.mjs';

const PROV = 'contracts/ENTITLEMENT-CERTIFICATE.md: obligation { passed, unmet[], coverage{domain ->'
  + ' PARTIAL|EXHAUSTIVE|UNKNOWN} } compiled from claim domain x quantifier x extent x coverage.'
  + '  ||  justification.mjs covers(): "null means not established over this dimension at all, which'
  + ' licenses nothing. ANY licenses anything. Otherwise the values must match exactly."';

export const ENDPOINTS = { production: 'legasus/contracts/entitlement-certificate.schema.json',
  specification: 'legasus/legaknow/justification.mjs' };

export const WIDE = {
  production_subject: 'EntitlementCertificate::obligation',
  production_observation: 'passed: boolean; coverage: {domain: PARTIAL|EXHAUSTIVE|UNKNOWN}',
  specification_subject: 'justification.mjs::covers',
  specification_proposition: 'a granted scope licenses a required scope only where established and equal',
  relation: RELATION.PARTIAL,
  provenance: PROV + '  ||  RELATION PARTIAL because covers() has no quantifier and cannot express'
    + ' an existential licensed by one member.',
  evidence: 'read from both sources; the F1 certificate requests EXISTS over PROGRAM, which covers()'
    + ' has no vocabulary for',
};

export const RESTRICTED = {
  ...WIDE,
  relation: RELATION.EQUIVALENT,
  domain: 'requested_claim.quantifier is FOR_ALL or NONE',
  provenance: PROV + '  ||  RELATION EQUIVALENT only for universal and absence claims, where both'
    + ' questions reduce to "is the domain exhaustively established?"',
  reason_correspondence: {
    COVERAGE_EXHAUSTIVE: 'ALL_DIMENSIONS_SATISFIED',
    COVERAGE_NOT_EXHAUSTIVE: 'NOT_ESTABLISHED',
  },
};

const UNIVERSAL = new Set(['FOR_ALL', 'NONE']);

export const inDomain = (cert) => !!(cert && cert.requested_claim
  && UNIVERSAL.has(cert.requested_claim.quantifier) && unrepresentable(cert) === null);

export const unrepresentable = (cert) => {
  const q = cert && cert.requested_claim && cert.requested_claim.quantifier;
  if (!q) return 'no requested_claim.quantifier';
  if (!UNIVERSAL.has(q)) {
    return 'quantifier ' + q + ' has no counterpart in covers(), which is all-or-nothing over a scope'
      + ' dimension and cannot express "one established member suffices". Gap in the SPECIFICATION'
      + ' vocabulary, not evidence against production.';
  }
  return null;
};

export const readProduction = (cert) => {
  const o = cert && cert.obligation;
  if (!o || typeof o.passed !== 'boolean') return { result: null };
  if (o.passed) return { result: 'PERMITTED', reasonClass: 'COVERAGE_EXHAUSTIVE' };
  const unmet = (o.unmet || []).join(' | ');
  if (/coverage of .* is (PARTIAL|UNKNOWN)/.test(unmet)) return { result: 'REFUSED', reasonClass: 'COVERAGE_NOT_EXHAUSTIVE' };
  if (/membership/.test(unmet)) return { result: 'REFUSED', reasonClass: 'MEMBERSHIP_MISSING' };
  return { result: 'REFUSED' };
};

export const readSpecification = (out) => {
  if (!out || typeof out.ok !== 'boolean') return { result: null };
  if (out.ok) return { result: 'PERMITTED', reasonClass: 'ALL_DIMENSIONS_SATISFIED' };
  const m = String((out.missing || [])[0] || '');
  if (/never established/.test(m)) return { result: 'REFUSED', reasonClass: 'NOT_ESTABLISHED' };
  if (/asked for/.test(m)) return { result: 'REFUSED', reasonClass: 'DIMENSION_MISMATCH' };
  return { result: 'REFUSED' };
};

// THE TRANSLATION. The claimed domain becomes the required `repository` value; the granted value is
// that same name iff the certificate records EXHAUSTIVE coverage of it, else null (never established).
// Only the repository dimension is used - the certificate's domain is one axis, not five.
export const toSpecification = (J, cert) => {
  const domain = cert.requested_claim.domain.name;
  const cov = (cert.obligation.coverage || {})[domain];
  const granted = J.scope({ repository: cov === 'EXHAUSTIVE' ? domain : null });
  const required = J.scope({ repository: domain });
  return J.covers(granted, required);
};
