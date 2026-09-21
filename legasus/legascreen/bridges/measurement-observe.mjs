// A SEMANTIC BRIDGE between the Python measurement gate and the calculus's OBSERVE constructor.
//
// PRODUCTION      EntitlementCertificate.measurement   (legasus/contracts, v1.0.0-frozen-2026-09-21)
//                 "has the instrument demonstrated capability, and did THIS observation carry force?"
// SPECIFICATION   calculus.observe({observation, procedure, context})
//                 "does this observation, with complete provenance, mint epistemic authority?"
//
// Production is Python and is read ONLY through the certificate. This file does not import the
// calculus; `toSpecification` receives it as a parameter, exactly as covers-delegate.mjs does, so the
// two sides cannot share an implementation defect.
//
// AND THEY ARE NOT THE SAME QUESTION.
//
//     M gate      capability_demonstrated  =  a positive control fired for this CLASS of observation
//     observe     evidential force + five provenance fields for THIS PARTICULAR observation
//
// A fired positive control does not mint. So this file declares TWO bridges over the pair:
//
//   WIDE        relation PARTIAL      licenses NO verdict
//   RESTRICTED  relation EQUIVALENT   ONLY where the certificate carries the actual observation with
//                                     evidential force, a procedure and a context, AND where every
//                                     provenance field observe() demands is representable
//
// THE VOCABULARY GAP, found while writing this and NOT patched around: observe() requires an
// `attribution` provenance field - how the observation was bound to its subject. Contract v1.0.0
// carries {ref, evidential_force, procedure, context} and no attribution. A bridge that invents one is
// the bridge fabricating provenance, which is the exact failure BRIDGE-1 exists to see. So on the
// frozen contract the RESTRICTED domain is EMPTY, and that is reported as a capability gap in the
// CONTRACT, never as evidence against production.
import { RELATION } from '../bridge.mjs';

const PROV = 'contracts/ENTITLEMENT-CERTIFICATE.md rule 6: "Capability is NOT the observation.'
  + ' legaknow.observe() needs the actual observation, its evidential force, procedure and context; a'
  + ' fired positive control alone does not mint."  ||  calculus.mjs OBSERVE: "requires an observation'
  + ' with evidential force and complete provenance" - observation.mjs PROVENANCE_FIELDS = subject,'
  + ' producer, procedure, attribution, context.';

export const ENDPOINTS = { production: 'legasus/contracts/entitlement-certificate.schema.json',
  specification: 'legasus/legaknow/calculus.mjs' };

export const WIDE = {
  production_subject: 'EntitlementCertificate::measurement',
  production_observation: 'capability_demonstrated: boolean, observation.evidential_force: boolean',
  specification_subject: 'calculus.mjs::observe',
  specification_proposition: 'new evidence establishes epistemic entitlement only with force and provenance',
  relation: RELATION.PARTIAL,
  provenance: PROV + '  ||  RELATION PARTIAL because M answers about a CLASS (capability) and observe'
    + ' answers about an INSTANCE (this observation).',
  evidence: 'read from the contract and the calculus; confirmed by a certificate with'
    + ' capability_demonstrated=true whose observation lacks attribution and therefore cannot mint',
};

export const RESTRICTED = {
  ...WIDE,
  relation: RELATION.EQUIVALENT,
  domain: 'the certificate carries an observation with evidential_force, a non-empty procedure, a'
    + ' context, and every observe() provenance field is representable from certificate data',
  provenance: PROV + '  ||  RELATION EQUIVALENT only on the stated domain, where both ask whether'
    + ' THIS observation mints.',
  reason_correspondence: {
    CAPABLE_AND_OBSERVED: 'OBSERVED_WITH_PROVENANCE',
    NO_EVIDENTIAL_FORCE: 'NO_EVIDENTIAL_FORCE',
    INSTRUMENT_INCAPABLE: 'NO_EVIDENTIAL_FORCE',
  },
};

// THE DOMAIN PREDICATE, decided on the certificate before any comparison.
export const inDomain = (m) => !!(m && m.observation && typeof m.observation.evidential_force === 'boolean'
  && typeof m.observation.procedure === 'string' && m.observation.procedure.length > 0
  && m.observation.context && typeof m.observation.context === 'object'
  && unrepresentable(m) === null);

// THE INPUT VOCABULARY CHECK. Representability is a property of the inputs and is decided before
// answers are compared. A field observe() demands that the certificate cannot supply is UNMAPPABLE.
export const unrepresentable = (m) => {
  if (!m || !m.observation) return 'measurement carries no observation object';
  if (m.observation.attribution === undefined) {
    return 'observe() requires `attribution` (how the observation was bound to its subject) and'
      + ' contract v1.0.0 carries no such field. Supplying one here would be the bridge fabricating'
      + ' provenance; this is a gap in the CONTRACT, not evidence against production.';
  }
  return null;
};

// Readers: one side's raw output -> { result, reasonClass }. Unclassifiable -> result null -> UNMAPPABLE.
export const readProduction = (m) => {
  if (!m || typeof m.capability_demonstrated !== 'boolean') return { result: null };
  if (!m.capability_demonstrated) return { result: 'REFUSED', reasonClass: 'INSTRUMENT_INCAPABLE' };
  if (!m.observation || typeof m.observation.evidential_force !== 'boolean') return { result: null };
  if (!m.observation.evidential_force) return { result: 'REFUSED', reasonClass: 'NO_EVIDENTIAL_FORCE' };
  return { result: 'PERMITTED', reasonClass: 'CAPABLE_AND_OBSERVED' };
};

export const readSpecification = (tok) => {
  if (!tok || typeof tok !== 'object') return { result: null };
  if (tok.minted === false) {
    if (tok.reason === 'PROVENANCE_INCOMPLETE') return { result: 'REFUSED', reasonClass: 'PROVENANCE_INCOMPLETE' };
    if (tok.reason) return { result: 'REFUSED', reasonClass: 'NO_EVIDENTIAL_FORCE' };
    return { result: 'REFUSED' };
  }
  return { result: 'PERMITTED', reasonClass: 'OBSERVED_WITH_PROVENANCE' };
};

// THE TRANSLATION. Certificate facts -> the calculus's own constructor. Builds no authority itself.
// `Obs` is observation.mjs; `C` is calculus.mjs. Only fields the certificate actually carries are
// passed; a missing provenance field is passed as null so observe() refuses on ITS terms.
export const toSpecification = (C, Obs, cert) => {
  const m = cert.measurement;
  const obs = Obs.observation({
    status: m.observation.evidential_force ? Obs.OBSERVABILITY.OBSERVED : Obs.OBSERVABILITY.PRODUCER_FAILED,
    value: m.observation.ref,
    subject: cert.requested_claim.predicate,
    producer: cert.provenance.producer,
    procedure: m.observation.procedure,
    attribution: m.observation.attribution === undefined ? null : m.observation.attribution,
    context: m.observation.context,
  });
  return C.observe({ observation: obs, procedure: m.observation.procedure, context: m.observation.context });
};
