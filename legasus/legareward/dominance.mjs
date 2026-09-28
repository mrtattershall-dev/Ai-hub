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
import { DIMENSIONS, behavioralDimensions } from './metrics.mjs';

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
  // AN UNMEASURED BEHAVIORAL DIMENSION IS NOT A TIE. The first version skipped any dimension either
  // candidate lacked, so a candidate whose placementRobustness was never measured could not be
  // dominated on it and sat on the Pareto frontier beside a measured one (composition attack W2-d):
  // "missing -> compatible", in the mild direction, but in the one class of dimension allowed to
  // promote. A candidate lacking a declared BEHAVIORAL metric is INCOMPARABLE, with the dimension
  // named. DESCRIPTIVE dimensions may still be absent - they cannot promote, so their absence cannot
  // manufacture a preference.
  const unmeasured = dimensions.filter((dim) => DIMENSIONS[dim] && DIMENSIONS[dim].class === 'BEHAVIORAL'
    && (a.metrics[dim] === undefined || b.metrics[dim] === undefined));
  if (unmeasured.length) {
    return { verdict: VERDICT.INCOMPARABLE, unmeasured,
      why: 'a behavioral dimension was never measured on one side (' + unmeasured.join(', ')
        + '); an unmeasured candidate is not equal to a measured one, it is not comparable to it' };
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

// May `candidate` replace `champion`?
//
// THE PROMOTION RULE, and its whole point is to give NO PREFERENCE teeth instead of leaving it a
// ceremonial option:
//
//     passes PROVE                                          precondition, checked by `compare`
//     strictly improves a BEHAVIORAL dimension,
//         worsens no behavioral dimension                   -> may replace
//     only DESCRIPTIVE dimensions differ                    -> NO PREFERENCE
//     behavioral objectives trade off                       -> NO PREFERENCE, retain both
//
// The preference probe is what forced this. Four of its seven dominances vanished once the two
// spelling-sensitive dimensions were removed, which means most of the apparent quality signal was
// "I like this representation better" - not something that should be able to take repository authority.
// Descriptive dimensions stay measured and reported; they simply cannot promote on their own.
export function mayReplaceChampion(candidate, champion, opts = {}) {
  const protectedDims = opts.protectedDims || [];
  const behavioral = opts.behavioral || behavioralDimensions();
  const full = compare(candidate, champion, opts);
  if (full.verdict === VERDICT.INCOMPARABLE) {
    return { replace: false, verdict: full.verdict, why: full.why };
  }

  // Promotion is decided on BEHAVIORAL dimensions alone.
  const b = compare(candidate, champion, { ...opts, dimensions: behavioral });
  if (b.verdict !== VERDICT.DOMINATES) {
    const why = b.verdict === VERDICT.EQUIVALENT
      ? 'the behavioral dimensions are identical; only descriptive ones differ, and a preference for a'
        + ' representation is not grounds to take the champion'
      : b.verdict === VERDICT.NO_PREFERENCE
        ? 'the behavioral objectives trade off, so both are retained'
        : 'it does not improve any behavioral dimension';
    return { replace: false, verdict: VERDICT.NO_PREFERENCE, behavioralVerdict: b.verdict,
      descriptiveVerdict: full.verdict, why };
  }

  const harmed = protectedDims.filter((d) => {
    const x = candidate.metrics[d]; const y = champion.metrics[d];
    return x !== undefined && y !== undefined && x !== y && !better(d, x, y);
  });
  if (harmed.length) {
    return { replace: false, verdict: VERDICT.NO_PREFERENCE, harmed,
      why: 'it improves behavioral dimensions but worsens protected ' + harmed.join(', ') };
  }
  return { replace: true, verdict: VERDICT.DOMINATES, behavioralVerdict: b.verdict,
    improves: b.improves, why: b.why };
}

// The set of candidates nothing else dominates. Keeping a frontier rather than a winner is the whole
// point: two verified implementations that trade off are two answers, not one answer and one mistake.
//
// AN UNMEASURED CANDIDATE IS NOT ON THE FRONTIER. compare() now calls it INCOMPARABLE (W2-d), and
// INCOMPARABLE is not DOMINATED, so filtering on domination alone would keep it - the first flip of the
// W2-d regression caught exactly that. It is excluded up front, with a record naming the missing
// dimension, so its absence from the frontier can be told apart from its being beaten.
export function paretoFrontierReport(candidates, opts = {}) {
  const behavioral = opts.behavioral || behavioralDimensions();
  const excluded = [];
  const verified = candidates.filter((c) => {
    if (!c || c.verified !== true) return false;
    const missing = behavioral.filter((d) => c.metrics[d] === undefined);
    if (missing.length) {
      excluded.push({ name: c.name, unmeasured: missing,
        why: 'never measured on ' + missing.join(', ') + ', so not comparable to any measured candidate' });
      return false;
    }
    return true;
  });
  const frontier = verified.filter((c) => !verified.some((o) =>
    o !== c && compare(o, c, opts).verdict === VERDICT.DOMINATES));
  return { frontier, excluded };
}

export function paretoFrontier(candidates, opts = {}) {
  return paretoFrontierReport(candidates, opts).frontier;
}
