// LEGASCREEN — BRIDGE-1. Production behaviour against the calculus as a SPECIFICATION.
//
//     WHAT SOFTWARE DOES          production behaviour, observed
//     WHAT IT SHOULD BE ALLOWED   the calculus, as an executable specification
//     WHY THOSE ARE THE SAME      bridge evidence
//
// Three objects, and they must never collapse into one. If any edge is missing the answer is UNKNOWN
// or UNMAPPABLE - never a verdict.
//
// THE CALCULUS IS NOT IMPORTED INTO PRODUCTION AND PRODUCTION NEED NOT KNOW IT EXISTS. A scanner that
// requires its subject to adopt its ontology is a scanner for cooperative software only. Keeping the
// two independent is also what makes agreement informative: wire production through the calculus and
// both sides can share one implementation defect, so agreement stops being evidence.
//
// THE DANGEROUS FAILURE IS FALSE AGREEMENT, NOT FALSE DISCREPANCY:
//
//     production meaning A          specification meaning B
//                  \                      /
//                   bridge maps A -> B  (wrongly)
//                            |
//                          AGREE          <- everything looks verified; the bridge fabricated it
//
// So the RELATION a bridge declares governs what a verdict is licensed at all. A bridge that says
// only PARTIAL cannot convict anything, however tempting the numbers look.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const RELATION = { EQUIVALENT: 'EQUIVALENT', NARROWER: 'NARROWER', BROADER: 'BROADER',
  PARTIAL: 'PARTIAL', UNKNOWN: 'UNKNOWN' };

export const COMPARISON = {
  AGREE: 'AGREE',                                 // same answer, same justification class
  RESULT_DISAGREEMENT: 'RESULT_DISAGREEMENT',     // the answers differ
  REASON_DISAGREEMENT: 'REASON_DISAGREEMENT',     // same answer, different justification
  UNMAPPABLE: 'UNMAPPABLE',                       // not faithfully expressible across the bridge
  UNKNOWN: 'UNKNOWN',                             // an endpoint moved, or nothing was observed
};

export const digestOf = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);

// A bridge without provenance IS the new oracle, so it is refused at construction exactly as a
// contract is - and `valid_against` pins BOTH endpoints, because either one moving invalidates the
// correspondence.
export function bridge(b) {
  for (const k of ['production_subject', 'specification_subject', 'relation', 'provenance',
    'valid_against']) {
    if (!b || !b[k]) {
      throw new Error('a bridge without ' + k + ' is an assertion of equivalence with nothing behind'
        + ' it; the mapping would become the new oracle');
    }
  }
  if (!Object.values(RELATION).includes(b.relation)) throw new Error('unknown relation ' + b.relation);
  for (const side of ['production', 'specification']) {
    if (!b.valid_against[side]) throw new Error('valid_against must pin BOTH endpoints; ' + side
      + ' is missing, and either endpoint moving invalidates the correspondence');
  }
  return Object.freeze({ ...b });
}

const licensesVerdict = (r) => r === RELATION.EQUIVALENT || r === RELATION.NARROWER
  || r === RELATION.BROADER;

// One comparison. `production` and `specification` are each { result, reason } already read through
// the bridge's own readers; `digests` is the CURRENT digest of each endpoint.
export function compare({ production, specification, bridge: b, digests = {} }) {
  const out = (comparison, why, extra = {}) => ({ comparison, why, bridge: b.production_subject
    + ' <-> ' + b.specification_subject, relation: b.relation, production, specification, ...extra });

  for (const side of ['production', 'specification']) {
    const now = digests[side];
    if (now !== undefined && now !== b.valid_against[side]) {
      return out(COMPARISON.UNKNOWN, 'the ' + side + ' endpoint has moved (' + b.valid_against[side]
        + ' -> ' + now + '), so the correspondence is not established against what is there now. It'
        + ' can neither convict nor absolve.', { stale: side });
    }
  }
  if (!production || !specification || production.result === undefined
      || specification.result === undefined) {
    return out(COMPARISON.UNKNOWN, 'one side produced nothing readable, so there is no comparison');
  }
  if (production.result === null || specification.result === null) {
    return out(COMPARISON.UNMAPPABLE, 'a behaviour on one side has no counterpart in the other\'s'
      + ' vocabulary. That is a capability gap in the BRIDGE or the SPECIFICATION and is NOT evidence'
      + ' against production. It is not coerced to the nearest available answer.');
  }

  // THE RELATION GOVERNS WHAT MAY BE CONCLUDED. PARTIAL and UNKNOWN license nothing.
  if (!licensesVerdict(b.relation)) {
    return out(COMPARISON.UNMAPPABLE, 'the declared relation is ' + b.relation + ', which does not'
      + ' license a verdict: the two subjects answer related but not corresponding questions, and'
      + ' calling a difference a disagreement would be the BRIDGE fabricating a finding');
  }

  if (production.result !== specification.result) {
    const prodPermits = production.result === 'PERMITTED';
    // A directional bridge is only violated in its own direction.
    if (b.relation === RELATION.NARROWER && !prodPermits) {
      return out(COMPARISON.AGREE, 'production refused where the specification permits, which a'
        + ' NARROWER relation allows');
    }
    if (b.relation === RELATION.BROADER && prodPermits) {
      return out(COMPARISON.AGREE, 'production permitted where the specification refuses, which a'
        + ' BROADER relation allows');
    }
    return out(COMPARISON.RESULT_DISAGREEMENT, 'production says ' + production.result
      + ' and the specification says ' + specification.result);
  }

  // SAME ANSWER IS NOT THE END OF THE QUESTION. A path can refuse safely today for a reason that
  // becomes dangerous downstream, and `prod === spec` cannot see that.
  const pc = production.reasonClass;
  const sc = specification.reasonClass;
  if (pc === undefined || sc === undefined) {
    return out(COMPARISON.UNMAPPABLE, 'the two agree on the answer, but at least one justification'
      + ' has no class under this bridge, so whether they agree FOR THE SAME REASON is unestablished');
  }
  const expected = (b.reason_correspondence || {})[pc];
  if (expected === undefined) {
    return out(COMPARISON.UNMAPPABLE, 'the bridge declares no counterpart for production reason "'
      + pc + '", so reason agreement cannot be established');
  }
  if (expected !== sc) {
    return out(COMPARISON.REASON_DISAGREEMENT, 'both answered ' + production.result + ', but'
      + ' production justified it as "' + pc + '" while the specification justified it as "' + sc
      + '" where the bridge expects "' + expected + '"');
  }
  return out(COMPARISON.AGREE, 'same answer, and the justifications correspond under a bridge that'
    + ' carries its own provenance');
}
