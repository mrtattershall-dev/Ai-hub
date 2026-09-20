// r4 — INSTRUMENT SUBSUMPTION. When may one experiment stand in for another? (Entry 14, wave 3 W3-h)
//
// THE ASYMMETRY THIS EXISTS TO PRESERVE:
//
//     cheap instrument FINDS a defect      -> conclusive; the expensive experiment was unnecessary
//     cheap instrument finds NOTHING       -> NOT conclusive; it may simply be the weaker instrument
//
// A cost-minimising rule that treats a cheap null as a substitute for an expensive null manufactures
// entitlement out of a BUDGET. So the substitution is allowed only under an independently established
// relation: the cheaper instrument DETECTS EVERY FAILURE CLASS the stronger one detects, and each
// detection is WITNESSED - a record that the class was injected and the instrument fired. The freeze
// gate's ten refusals are of exactly that shape; a class an instrument merely claims to detect is not
// a class it detects.
//
// WHAT IS MECHANICAL HERE, AND WHAT IS NOT, stated in advance rather than discovered: the requirement of
// an executed witness per class, and the refusal to say SUBSUMES without one, are mechanical. The
// failure classes themselves are HAND-AUTHORED - naming what an instrument could fail to see is the
// oracle information, and nothing here generates it. No Legasus instrument is described with this yet;
// describing one honestly means arguing each of its classes independently, which is not started.
//
// MISSING EVIDENCE IS UNKNOWN, NEVER SUBSUMES. An undeclared class set, or a class without a witness,
// cannot support the relation in either direction.

export const SUBSUMPTION = {
  SUBSUMES: 'SUBSUMES',                   // every class B detects, A detects with a witness
  DOES_NOT_SUBSUME: 'DOES_NOT_SUBSUME',   // B detects a class A has no witness for
  UNKNOWN: 'UNKNOWN',                     // classes undeclared, or a witness missing
};

// An instrument: a name and the failure classes it detects, each with the witness that showed it.
//   detects: [{ failureClass, witness: { injected, fired, ref } }]
export function instrument({ name, detects }) {
  if (!name) return { malformed: true, why: 'an instrument must be named' };
  if (!Array.isArray(detects)) {
    return { malformed: true, name, why: 'an instrument must DECLARE the failure classes it detects;'
      + ' an undeclared set is UNKNOWN, not empty' };
  }
  const unwitnessed = detects.filter((d) => !d.witness || d.witness.injected !== true
    || d.witness.fired !== true).map((d) => d.failureClass);
  return { name, detects: detects.map((d) => ({ ...d })), unwitnessed };
}

const witnessed = (inst) => new Set(inst.detects
  .filter((d) => d.witness && d.witness.injected === true && d.witness.fired === true)
  .map((d) => d.failureClass));

// Does A subsume B? A may stand in for B only if every class B detects is a class A detects with a
// witness. Anything less is not "probably fine" - it is UNKNOWN or a refusal, with the classes named.
export function subsumes(a, b) {
  for (const [side, inst] of [['A', a], ['B', b]]) {
    if (!inst || inst.malformed) {
      return { verdict: SUBSUMPTION.UNKNOWN, why: 'instrument ' + side + ' is undeclared or malformed;'
        + ' nothing can be said about what it detects' };
    }
  }
  const aHas = witnessed(a);
  const bClasses = b.detects.map((d) => d.failureClass);
  const missingWitness = b.detects.filter((d) => !witnessed(b).has(d.failureClass))
    .map((d) => d.failureClass);
  if (missingWitness.length) {
    return { verdict: SUBSUMPTION.UNKNOWN, missingWitness,
      why: 'B claims to detect ' + missingWitness.join(', ') + ' without a witness; a claimed class'
        + ' is not a detected class, so what B actually detects is not established' };
  }
  const uncovered = bClasses.filter((c) => !aHas.has(c));
  const claimedNotWitnessed = bClasses.filter((c) => !aHas.has(c)
    && a.detects.some((d) => d.failureClass === c));
  if (uncovered.length) {
    return { verdict: claimedNotWitnessed.length === uncovered.length
      ? SUBSUMPTION.UNKNOWN : SUBSUMPTION.DOES_NOT_SUBSUME,
    uncovered, claimedNotWitnessed,
    why: claimedNotWitnessed.length === uncovered.length
      ? 'A claims ' + uncovered.join(', ') + ' without a witness; UNKNOWN, not SUBSUMES'
      : 'B detects ' + uncovered.filter((c) => !claimedNotWitnessed.includes(c)).join(', ')
        + ', which A has never been shown to detect' };
  }
  return { verdict: SUBSUMPTION.SUBSUMES, covered: bClasses,
    why: 'every class B detects, A detects with a witness; A\'s null result stands in for B\'s' };
}

// THE ENTRY 14 QUESTION, answered in both directions.
//   a FINDING by any instrument stands on its own
//   a NULL from `cheap` substitutes for a null from `strong` only if cheap SUBSUMES strong
export function nullTransfers({ cheap, strong, cheapFound }) {
  if (cheapFound === true) {
    return { transfers: true, direction: 'positive',
      why: 'the cheap instrument found a defect; that is conclusive and the stronger run is unnecessary' };
  }
  const s = subsumes(cheap, strong);
  if (s.verdict === SUBSUMPTION.SUBSUMES) {
    return { transfers: true, direction: 'null', via: s,
      why: 'the cheap instrument detects everything the strong one detects, so its null is the strong null' };
  }
  return { transfers: false, direction: 'null', via: s,
    why: 'a cheap null is not a strong null: ' + s.why };
}
