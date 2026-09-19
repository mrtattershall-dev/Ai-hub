// LEGAREWARD — DOMINANCE, and NO PREFERENCE is a first-class answer.
//
// PROVE answers "is this correct". This answers "among the correct, is this better" - and its most
// important capability is DECLINING TO ANSWER. `UNKNOWN` and `UNDETERMINED` became first-class elsewhere
// in this architecture for the same reason: a stage that always produces a verdict has stopped
// measuring and started asserting.
//
//     WRONG  -> PROVE ->  CORRECT  -> LegaReward ->  BETTER  -> repeated verified search -> BEST KNOWN
//
// THE LAW, unchanged from every other stage that can reject:
//
//     ANYTHING THAT CAN DEMOTE A LEGITIMATE CANDIDATE MUST PROVE IT CAN RECOGNIZE LEGITIMATE
//     ALTERNATIVES.
//
// So dominance here is PARETO dominance over a declared vector, not a weighted sum. Two candidates that
// trade off are not ranked; they are both kept. A weighted sum would always produce a winner, which
// sounds like progress and is actually the failure mode: it would declare `n in (2, 4, 6, 8)` better
// than `n == 2 or n == 4 or n == 6 or n == 8` on length alone, and 45 measured transactions say both are
// correct realizations of the same contract.
//
// CORRECTNESS IS A PRECONDITION, NOT A DIMENSION. An incorrect candidate is not a worse point on the
// frontier; it is not on the frontier at all. This module refuses to compare anything PROVE has not
// already admitted.
import { DIMENSIONS } from './metrics.mjs';

export const VERDICT = {
  DOMINATES: 'DOMINATES',
  DOMINATED: 'DOMINATED',
  EQUIVALENT: 'EQUIVALENT',
  NO_PREFERENCE: 'NO_PREFERENCE',
  INCOMPARABLE: 'INCOMPARABLE',
};

const better = (dim, x, y) => (DIMENSIONS[dim].polarity === 'lower' ? x < y : x > y);

// Compare two VERIFIED candidates. `protectedDims`, when given, may not be worsened even by a candidate
// that improves everything else - the conservative champion rule.
export function compare(a, b, { dimensions = Object.keys(DIMENSIONS), protectedDims = [] } = {}) {
  if (!a || !b || a.verified !== true || b.verified !== true) {
    return { verdict: VERDICT.INCOMPARABLE,
      why: 'both candidates must have passed PROVE before preference is meaningful; an incorrect'
        + ' candidate is not a worse point on the frontier, it is not on the frontier' };
  }
  const aBetter = []; const bBetter = []; const same = [];
  for (const dim of dimensions) {
    if (!DIMENSIONS[dim]) continue;
    const x = a.metrics[dim]; const y = b.metrics[dim];
    if (x === undefined || y === undefined) continue;
    if (x === y) same.push(dim);
    else if (better(dim, x, y)) aBetter.push(dim);
    else bBetter.push(dim);
  }

  if (!aBetter.length && !bBetter.length) {
    return { verdict: VERDICT.EQUIVALENT, same,
      why: 'identical on every declared dimension, so there is nothing to prefer' };
  }
  if (aBetter.length && !bBetter.length) {
    return { verdict: VERDICT.DOMINATES, improves: aBetter, same,
      why: 'better on ' + aBetter.join(', ') + ' and worse on nothing' };
  }
  if (bBetter.length && !aBetter.length) {
    return { verdict: VERDICT.DOMINATED, improves: bBetter, same,
      why: 'worse on ' + bBetter.join(', ') + ' and better on nothing' };
  }
  return { verdict: VERDICT.NO_PREFERENCE, aBetter, bBetter,
    why: 'they trade off - a is better on ' + aBetter.join(', ') + ' and b on ' + bBetter.join(', ')
      + '. Ranking these would be taste presented as measurement' };
}

// May `candidate` replace `champion`? Deliberately conservative, and NO PREFERENCE means NO REPLACEMENT.
export function mayReplaceChampion(candidate, champion, opts = {}) {
  const protectedDims = opts.protectedDims || [];
  const r = compare(candidate, champion, opts);
  if (r.verdict === VERDICT.DOMINATES) {
    const harmed = protectedDims.filter((d) => {
      const x = candidate.metrics[d]; const y = champion.metrics[d];
      return x !== undefined && y !== undefined && x !== y && !better(d, x, y);
    });
    if (harmed.length) {
      return { replace: false, verdict: r.verdict, harmed,
        why: 'it improves other dimensions but worsens protected ' + harmed.join(', ') };
    }
    return { replace: true, verdict: r.verdict, why: r.why };
  }
  return { replace: false, verdict: r.verdict,
    why: r.verdict === VERDICT.NO_PREFERENCE
      ? 'no preference is establishable, so the champion stands and BOTH are retained'
      : r.why };
}

// The set of candidates nothing else dominates. Keeping a frontier rather than a winner is the whole
// point: two verified implementations that trade off are two answers, not one answer and one mistake.
export function paretoFrontier(candidates, opts = {}) {
  const verified = candidates.filter((c) => c && c.verified === true);
  return verified.filter((c) => !verified.some((o) =>
    o !== c && compare(o, c, opts).verdict === VERDICT.DOMINATES));
}
