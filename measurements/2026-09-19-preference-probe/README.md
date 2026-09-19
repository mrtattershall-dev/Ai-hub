# PREREGISTRATION — is there a stable quality signal among code already proven correct?

**Committed before the analysis runs. No GPU: every artifact this reads is already on disk.**

## The frozen question

> Given two implementations of the same verified semantic contract, can domain-neutral metrics identify
> consistent quality dominance **without** preferring a candidate merely because its syntax resembles a
> canonical realization?

This is asked **before** building a `LegaReward` layer, deliberately. If the ranking is not stable on data
already collected, a domain-aware reward built on top would inherit the instability invisibly.

## Why it is askable now and was not before

"Among the correct possibilities, is this better?" is meaningless while "correct" is an assumption. It is
no longer one: `P(correct | verified)` is `1.000` across four domain kinds, 619+ transactions carrying a
wrong contract were rejected, and the most recent family caught 141/141 including two error geometries
nobody anticipated. Correctness and preference can now be separated because one of them is measured.

## What is measured

A vector, never a score. Six dimensions, each declaring its polarity:

    changedChars          lower    smaller changed surface
    branchPoints          lower    boolean connectives in the source
    distinctLiterals      lower    specification restated in code
    duplicatedTerms       lower    a repeated subexpression is a second place to fix
    worstCaseTests        lower    comparisons evaluated on the worst input
    placementRobustness   higher   LEGAL ARRANGEMENTS THE CANDIDATE STAYS CORRECT UNDER

The last is the only one that is not a proxy, and it is the interesting one: **robustness under allowed
environmental variation**, measured by execution. For a transaction of `k` operations it is the fraction of
all `k!` orderings under which the assembled program still satisfies the contract, with expectations held
at the derived order. A realization that stays correct across more legal arrangements plausibly dominates
one whose correctness depends on a specific surrounding arrangement — and `OBSERVE`'s middle family already
measured exactly this asymmetry, with a self-defending guard surviving a structure-blind placement 145
times where a plain guard survived 0.

## Endpoints

**Primary — stability.** For each contract realized in more than one verified way, the pairwise verdict
(`DOMINATES` / `DOMINATED` / `EQUIVALENT` / `NO_PREFERENCE`). A dominance is **stable** only if its
direction never reverses across models or across families for the same pair.

**Secondary — non-vacuity of `NO_PREFERENCE`.** What fraction of comparable pairs return no preference. A
frontier that collapses to a single winner everywhere would mean the vector had become a ranking.

**The anti-oracle endpoint.** Of the `DOMINATES` verdicts, how many would *reverse* if the syntax-adjacent
dimensions (`changedChars`, `branchPoints`) were removed and only `worstCaseTests`, `duplicatedTerms` and
`placementRobustness` were kept? A dominance that survives only on surface dimensions is a preference for
a spelling wearing a measurement's clothes, and it must be reported separately rather than counted as
signal.

## Predictions

- `NO_PREFERENCE` occurs on a **substantial minority** of pairs. If it never occurs, the vector is a
  ranking; if it occurs almost always, the vector has no discriminating power.
- Dominance direction is **stable** where it occurs.
- A material share of dominances rest **only** on the surface dimensions, and those are reported as weak.

## Falsification

- **If a dominance direction reverses** between models for the same contract pair, there is no stable
  quality signal in these metrics and `LegaReward` must not be built on them as they stand.
- **If `NO_PREFERENCE` never occurs**, the vector has collapsed into a taste and the Pareto framing is
  decoration.
- **If every dominance disappears** once surface dimensions are dropped, the whole signal was syntax
  resemblance.

## What this explicitly does NOT do

It does not promote anything, reject anything, or change any artifact. **Domination affects the champion,
never admissibility** — a proven-correct realization stays admissible whatever this reports, and the
preference module has no vocabulary for rejection by construction, asserted by a test.

## Non-vacuity

The probe keeps an `attempted / observed / unobservable / findings` tally and **refuses to report** if any
candidate could not be evaluated, per the law mechanized in `bf39ad7`. "No instability found" must not be
reachable by failing to look.

## Sources

    measurements/2026-09-19-set-domains/RESULT.json          five algebras, richest realization diversity
    measurements/2026-09-18-rendering-ladder/RESULT.json     ISOLATED arm, self-defending vs plain guards
