// r4 — WHAT A GUARD HAS ACTUALLY EARNED. Naming a failure class is not mechanizing it.
//
// This project called C4 - *authority transferred because two strings matched* - mechanized at
// a31046c, and committed the same pattern four commits later through a different route. The guard
// was producer-keyed promotion INSIDE justification.mjs; the recurrence was a state word in
// provenance.mjs. Twenty commits and SEVEN PASSING FULL SUITES went by before it was recorded.
//
// The ledger's word was doing work the mechanism had not done, and at scale that is how a catalogue
// of named failures starts to read as a guarantee. Three claims, kept apart:
//
//     PATTERN_NAMED      incidents share a conceptual pattern. Real and useful - it is what makes a
//                        recurrence RECOGNIZABLE - and it detects nothing.
//     MECHANIZED_REGION  at least one detector has DEMONSTRATED reach over at least one incident.
//                        The region is what the witness shows, never what the name suggests.
//     COVERED_CLASS      every incident is covered AND coverage over the CLASS is established
//                        independently of the detectors' own say-so.
//
// COVERING EVERY OBSERVED INCIDENT IS NOT COVERING THE CLASS. Known incidents are a sample; a class
// generalizes over the ones nobody has met. So observed coverage is reported as a RATIO BESIDE the
// verdict and can never be the verdict - the same shape as instruments.mjs, where a claimed failure
// class without a witness is UNKNOWN rather than covered, and for the same reason.
//
// A DETECTOR'S REACH IS WITNESSED OR IT IS NOT REACH. `covers` is a claim; `witness` is what makes it
// one this module will read. An unwitnessed claim is recorded, named, and ignored - it does not raise
// the verdict and it does not silently lower it either.
import { SUBSUMPTION } from './instruments.mjs';

export const PROTECTION = {
  PATTERN_NAMED: 'PATTERN_NAMED',
  MECHANIZED_REGION: 'MECHANIZED_REGION',
  COVERED_CLASS: 'COVERED_CLASS',
};

// detector: { name, region, covers: [incidentId], witness: { demonstrated: true, ref } }
export function detector({ name, region, covers = [], witness }) {
  const demonstrated = !!(witness && witness.demonstrated === true && witness.ref);
  return { name, region, covers: [...covers], witness: witness || null, demonstrated };
}

// pattern: { name, incidents: [{ id, where }], detectors: [detector], classCoverage }
//   classCoverage is an OUTSIDE claim - a subsumption verdict, or null. UNKNOWN is never a quiet yes.
export function protection({ name, incidents = [], detectors = [], classCoverage = null }) {
  const witnessed = detectors.filter((d) => d.demonstrated);
  const unwitnessed = detectors.filter((d) => !d.demonstrated)
    .map((d) => ({ detector: d.name, claims: d.covers }));

  const coveredBy = new Map();
  for (const inc of incidents) {
    coveredBy.set(inc.id, witnessed.filter((d) => d.covers.includes(inc.id)).map((d) => d.name));
  }
  const uncovered = [...coveredBy.entries()].filter(([, v]) => v.length === 0).map(([k]) => k);
  const observed = incidents.length - uncovered.length;

  // Does any SINGLE detector reach every incident? The answer distinguishes "one guard covers this"
  // from "several disjoint guards happen to, between them" - and it is the fact that made the C4
  // overclaim invisible.
  const singleDetectorCovering = witnessed
    .filter((d) => incidents.every((i) => d.covers.includes(i.id))).map((d) => d.name);

  const classEstablished = classCoverage === SUBSUMPTION.SUBSUMES || classCoverage === true;
  const level = (classEstablished && uncovered.length === 0) ? PROTECTION.COVERED_CLASS
    : witnessed.length ? PROTECTION.MECHANIZED_REGION
      : PROTECTION.PATTERN_NAMED;

  return {
    name,
    level,
    // A RATIO, never the verdict.
    observedCoverage: observed + '/' + incidents.length,
    uncovered,
    regions: witnessed.map((d) => ({ detector: d.name, region: d.region, covers: d.covers })),
    singleDetectorCovering,
    disjoint: witnessed.length > 1 && singleDetectorCovering.length === 0,
    unwitnessed,
    classCoverage: classCoverage === null ? 'UNKNOWN' : classCoverage,
    why: level === PROTECTION.COVERED_CLASS
      ? 'every incident is covered by a witnessed detector AND coverage over the class was established'
        + ' independently'
      : level === PROTECTION.MECHANIZED_REGION
        ? 'detectors have demonstrated reach over ' + observed + ' of ' + incidents.length
          + ' known incident(s)'
          + (singleDetectorCovering.length === 0 && witnessed.length > 1
            ? ', but NO SINGLE detector reaches them all - the coverage is the union of disjoint'
              + ' regions, which is not a claim about the pattern' : '')
          + '. Coverage over the CLASS is ' + (classCoverage === null ? 'UNKNOWN' : String(classCoverage))
          + ': known incidents are a sample, and covering all of them is not a coverage argument.'
        : 'the incidents are linked by a named pattern and nothing detects it. Naming makes a'
          + ' recurrence recognizable; it does not make one detectable.',
  };
}
