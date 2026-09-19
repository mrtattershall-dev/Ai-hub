// LEGAREWARD — DESCRIPTIVE METRICS. A vector, never a score.
//
// This module does NOT decide which candidate is better. It measures a handful of domain-neutral
// properties and hands them to `dominance.mjs`, which is allowed to say NO PREFERENCE and frequently
// should. Collapsing these into one number is how a correctness system quietly becomes a taste system:
//
//     correctness system -> optimization system -> optimization quietly becomes taste
//                        -> taste quietly becomes authority
//
// EVERY DIMENSION DECLARES ITS POLARITY, because a metric whose direction is assumed is a preference
// smuggled in as a measurement. `lower` means smaller is better; `higher` means larger is better.
//
// AND ONE DIMENSION IS NOT A PROXY AT ALL. `placementRobustness` counts how many of the LEGAL placements
// a candidate remains correct under. That is measured by execution, it is not a matter of taste, and it
// is the one dimension here with independent evidence behind it: the OBSERVE middle family found a
// self-defending guard surviving a structure-blind placement 145 times where a plain guard survived 0.
// A candidate that stays correct across more of the permitted environment genuinely dominates one whose
// correctness depends on a specific surrounding arrangement.
const NL = String.fromCharCode(10);

export const DIMENSIONS = {
  changedChars: { polarity: 'lower', why: 'smaller changed surface is easier to review and revert' },
  branchPoints: { polarity: 'lower', why: 'each added connective is another path to be wrong on' },
  distinctLiterals: { polarity: 'lower', why: 'more literals is more specification restated in code' },
  duplicatedTerms: { polarity: 'lower', why: 'a repeated subexpression is a second place to fix' },
  worstCaseTests: { polarity: 'lower', why: 'comparisons evaluated on the worst input, a runtime proxy' },
  placementRobustness: { polarity: 'higher',
    why: 'legal placements the candidate stays CORRECT under, measured by execution rather than taste' },
};

// Everything below is computed from the candidate text and from execution. Nothing consults a canonical
// spelling, because a metric that rewards resembling the canonical form is an oracle for syntax.
const CONNECTIVE = /\b(and|or)\b/g;
const COMPARISON = /(<=|>=|==|!=|<|>|\bstartswith\b|\bendswith\b)/g;
const LITERAL = /(-?\b\d+\b|(["'])(?:(?!\2).)*\2)/g;
// Membership over a literal collection is not one test. `n in (2, 4, 6, 8)` performs up to four
// comparisons, exactly like the or-chain it is equivalent to.
const MEMBERSHIP = /\bin\s*[([{]([^)\]}]*)[)\]}]/g;

// THE FIRST VERSION OF THIS FUNCTION COUNTED `in` AS A SINGLE COMPARISON, which made the membership
// spelling look cheaper at runtime than the or-chain that does the identical work. That is an
// ACCIDENTAL ORACLE: a measurement error pointing at the canonical form, which would have let this stage
// demote a legitimate alternative on the strength of a bug. Caught by the test that asserts the two
// equivalent spellings must not differ on runtime cost.
function worstCaseTests(text) {
  const s = String(text || '');
  let n = count(s, COMPARISON);
  MEMBERSHIP.lastIndex = 0;
  let m = MEMBERSHIP.exec(s);
  while (m !== null) {
    n += m[1].split(',').map((x) => x.trim()).filter(Boolean).length;
    m = MEMBERSHIP.exec(s);
  }
  return n;
}

function count(text, re) {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(String(text || '')) !== null) n++;
  return n;
}

// Subexpressions that appear more than once - a crude but honest duplication signal, and deliberately
// crude: an elaborate one would start encoding a style.
function duplicatedTerms(text) {
  const terms = String(text || '').split(/\b(?:and|or)\b/).map((t) => t.trim()).filter(Boolean);
  const seen = new Map();
  for (const t of terms) seen.set(t, (seen.get(t) || 0) + 1);
  return [...seen.values()].filter((n) => n > 1).reduce((a, n) => a + (n - 1), 0);
}

export function measure({ code, placementsLegal = 0, placementsCorrect = 0 }) {
  const text = String(code || '');
  return {
    changedChars: text.replace(/\s+/g, ' ').trim().length,
    branchPoints: count(text, CONNECTIVE),
    distinctLiterals: new Set((text.match(LITERAL) || [])).size,
    duplicatedTerms: duplicatedTerms(text),
    worstCaseTests: worstCaseTests(text),
    placementRobustness: placementsLegal ? placementsCorrect / placementsLegal : 0,
  };
}

export { NL };
