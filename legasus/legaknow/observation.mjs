// OBSERVATION — evidence that carries the epistemic status of its own production.
//
// THE FAILURE RUN 0 DEMONSTRATED, which no amount of correctness in the entitlement algebra could have
// prevented:
//
//     measurement failed -> no representation produced -> the representation layer converted that to the
//     empty set -> the algebra reasoned CORRECTLY over the empty set -> false clean result.
//
// The algebra was not wrong. The evidence object LIED ABOUT ITS OWN PROVENANCE. So the thing called
// "evidence" is already the output of another judgment system, and that system had silently decided what
// counts as an observable event, whether absence means silence or failure, which event belongs to which
// subject, and how missing evidence is represented.
//
//     EVIDENCE ITSELF REQUIRES ENTITLEMENT.
//
// THE GENERAL LAW, of which UNOBSERVABLE IS NEVER AN ADMISSION is one special case:
//
//     LOSS OF PROVENANCE MUST NEVER INCREASE ENTITLEMENT.
//
// If information about HOW something is known disappears, nothing downstream may become more confident or
// gain permission it did not have. That applies far beyond test harnesses.
//
// WHY THE REGRESS TERMINATES. "Who verifies the evidence producer?" does not run forever, because
// admissibility into the trust base is a TESTABLE PROPERTY rather than an assumption:
//
//     A PROCEDURE MAY BE TRUSTED AS A PRIMITIVE ONLY IF ITS FAILURE IS REPRESENTABLE.
//
// `failSet(null) -> {}` was never eligible: no failure of it could be told apart from a clean result. A
// procedure whose only possible report is success cannot be a primitive, however reliable it looks.
import { DIMENSIONS } from './justification.mjs';

// EIGHT DISTINCT SITUATIONS AN ORDINARY HARNESS COLLAPSES INTO ONE EMPTY VALUE. They are kept disjoint
// here because their downstream permissions differ, and because the collapse is the defect.
export const OBSERVABILITY = {
  OBSERVED: 'OBSERVED',                             // ran, produced a result
  EMPTY_OBSERVED: 'EMPTY_OBSERVED',                 // ran, produced nothing, and the nothing IS the result
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',                   // never run
  SUBJECT_FAILED: 'SUBJECT_FAILED',                 // the thing under test failed before observation
  PRODUCER_FAILED: 'PRODUCER_FAILED',               // the OBSERVER failed - this was run 0
  UNATTRIBUTABLE: 'UNATTRIBUTABLE',                 // observed, but cannot be bound to a subject
  PREREQUISITE_MISSING: 'PREREQUISITE_MISSING',     // depended on state that was not available
  DISCARDED: 'DISCARDED',                           // produced, then lost by the harness
};

// ONLY these two carry evidential force. Every other status is a report ABOUT THE OBSERVER, and an
// observer's failure is not a fact about the subject.
const EVIDENTIAL = new Set([OBSERVABILITY.OBSERVED, OBSERVABILITY.EMPTY_OBSERVED]);

// The provenance a claim of observation must carry. Anything missing here is something that could differ
// between two "identical" observations without either of them noticing.
export const PROVENANCE_FIELDS = ['subject', 'producer', 'procedure', 'attribution', 'context'];

export function observation({ status, value = null, subject = null, producer = null,
  procedure = null, attribution = null, context = null, dependsOn = [], why = null }) {
  if (!Object.values(OBSERVABILITY).includes(status)) {
    return { malformed: true,
      why: 'an observation must declare its observability status; there is no default, because the'
        + ' default is exactly what collapses eight different situations into one empty value' };
  }
  return { status, value, subject, producer, procedure, attribution, context,
    dependsOn: [...dependsOn], why };
}

// THE GATE between an observation and evidence. Returns evidence or a refusal, never a bare value.
export function evidenceFrom(obs) {
  if (!obs || obs.malformed) {
    return { ok: false, reason: 'MALFORMED', why: 'not a well-formed observation' };
  }
  if (!EVIDENTIAL.has(obs.status)) {
    return { ok: false, reason: obs.status,
      why: 'the observation reports ' + obs.status + ', which is a fact about the OBSERVER or the'
        + ' attempt, not about the subject. It carries no evidential force.' };
  }
  // ATTRIBUTION IS PART OF TRUTH. An accurate observation bound to the wrong subject is not weak
  // evidence - it is a false proposition. "Did event X occur" is not the claim; "did X occur TO SUBJECT S
  // UNDER PROCEDURE P" is, and changing the binding changes the proposition.
  const missing = PROVENANCE_FIELDS.filter((f) => obs[f] === null || obs[f] === undefined);
  if (missing.length) {
    return { ok: false, reason: 'PROVENANCE_INCOMPLETE', missing,
      why: 'the observation cannot say ' + missing.join(', ') + '. Evidence is only meaningful under a'
        + ' preserved identity mapping; lose the mapping and an accurate observation becomes invalid'
        + ' evidence.' };
  }
  return { ok: true, status: obs.status, value: obs.value, empty: obs.status === OBSERVABILITY.EMPTY_OBSERVED };
}

// LOSS OF PROVENANCE MUST NEVER INCREASE ENTITLEMENT. Modelled explicitly so the property can be TESTED
// rather than asserted: degrading an observation may only ever move entitlement from true to false.
export function degrade(obs, field) {
  return { ...obs, [field]: null, degraded: [...(obs.degraded || []), field] };
}

// THE TRUST-BASE CRITERION. A procedure is admissible as a primitive only if its failure is
// representable - if there exists an input for which it reports something other than success. A
// procedure that can only ever report success has a silent failure mode and is disqualified, however
// reliable it appears.
export function admissibleAsPrimitive({ name, run, probes = [] }) {
  if (!probes.length) {
    return { ok: false, why: 'no probes were offered, so the failure mode of ' + name
      + ' has not been shown to be representable. An untested failure mode is a silent one.' };
  }
  const statuses = new Set();
  for (const p of probes) {
    let r;
    try { r = run(p); } catch (e) { r = { status: OBSERVABILITY.PRODUCER_FAILED }; }
    statuses.add(r && r.status ? r.status : 'NO_STATUS');
  }
  if (statuses.has('NO_STATUS')) {
    return { ok: false, statuses: [...statuses],
      why: name + ' returned a result with no observability status. A value that cannot say how it was'
        + ' produced cannot be told apart from one that was never produced.' };
  }
  const nonSuccess = [...statuses].filter((s) => !EVIDENTIAL.has(s));
  if (!nonSuccess.length) {
    return { ok: false, statuses: [...statuses],
      why: name + ' reported success on every probe, so no failure of it is representable. That is the'
        + ' disqualifying property, not a good sign.' };
  }
  return { ok: true, statuses: [...statuses], representableFailures: nonSuccess };
}

// The scope dimensions an observation is quantified over. HISTORY is the one the doctest experiment
// forced: an example that runs after two others is not an assertion about the source alone, it is an
// assertion about SOURCE x EXECUTION HISTORY. Two systems evaluating "the same example" under different
// histories are evaluating DIFFERENT SUBJECTS, and should be refused a comparison rather than scored as
// disagreeing.
export const OBSERVATION_DIMENSIONS = [...DIMENSIONS, 'history'];

// TYPED NON-KNOWLEDGE. This is not three-valued logic with one UNKNOWN: the six non-evidential statuses
// all block entitlement, but for DIFFERENT CAUSAL REASONS, and the work that would make knowing possible
// differs for each. That is what makes them authoritative rather than merely descriptive - and it is the
// test of the vocabulary, because two statuses that permit exactly the same downstream actions could be
// safely merged.
//
// It also hands PURPOSE something it could not otherwise derive: an objective frontier does not have to
// consist only of feature opportunities. It can contain EPISTEMIC opportunities - "this purpose-connected
// claim is blocked specifically because its prerequisite is missing" is a justified next objective that
// no model invented.
export const REMEDIATION = {
  [OBSERVABILITY.OBSERVED]: null,
  [OBSERVABILITY.EMPTY_OBSERVED]: null,
  [OBSERVABILITY.NOT_ATTEMPTED]: { kind: 'ATTEMPT_OBSERVATION',
    why: 'nothing is wrong; the observation has simply never been made' },
  [OBSERVABILITY.PRODUCER_FAILED]: { kind: 'REPAIR_OBSERVER',
    why: 'the apparatus failed, which says nothing whatever about the subject' },
  [OBSERVABILITY.SUBJECT_FAILED]: { kind: 'INSPECT_SUBJECT',
    why: 'the subject failed before it could be observed, which IS information about the subject' },
  [OBSERVABILITY.UNATTRIBUTABLE]: { kind: 'REPAIR_IDENTITY',
    why: 'something was observed and cannot be bound to a subject; the identity mapping is the defect' },
  [OBSERVABILITY.PREREQUISITE_MISSING]: { kind: 'ESTABLISH_PREREQUISITE',
    why: 'the observation depends on state that does not currently exist' },
  [OBSERVABILITY.DISCARDED]: { kind: 'REACQUIRE_EVIDENCE',
    why: 'the evidence existed and the harness lost it; re-running is sufficient' },
};

// The consumer that makes the vocabulary load-bearing. A status with no remediation is either already
// evidence, or a state whose distinctness this project has not yet justified.
export const remediationFor = (status) => REMEDIATION[status] ?? undefined;
