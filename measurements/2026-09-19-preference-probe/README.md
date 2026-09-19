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

---

# RESULT — stability holds, but the vector is NOT fit to build on, and its own evidence says so

**No GPU. Every number generated from artifacts already on disk.**

    COVERAGE (preference probe): attempted 15   observed 15   unobservable 0
    15 verified realizations, 10 within-contract pairs

## The three endpoints

    DOMINATED        7    70.0%
    EQUIVALENT       2    20.0%
    NO_PREFERENCE    1    10.0%

    STABILITY    distinct dominating pairs 7   REVERSALS 0
    ANTI-ORACLE  dominances on the full vector 7   of those SURFACE-ONLY 4  (57%)

**Stability passes.** No dominance direction reverses across models or cases. Where the vector prefers
something, it prefers it consistently.

**`NO_PREFERENCE` is rarer than predicted.** I predicted a substantial minority; it is **10%**. On this
family the vector behaves much more like a ranking than like a frontier, which is a point against the
Pareto framing rather than for it.

**The anti-oracle endpoint fires hard.** **Four of seven dominances vanish** when `changedChars` and
`branchPoints` are removed — a clear majority of the apparent signal is *spelling*. Every one of those four
is an or-chain being demoted against a membership form that does identical work at identical runtime with
identical robustness.

The three dominances that survive on substance are all the same shape and are legitimate:
`n % 2 == 0 and n in {2, 4, 6, 8}` demoted for carrying duplicated semantic content and more runtime tests
than the set membership it is wrapped around.

## The decisive finding: the one non-proxy dimension is MIS-SPECIFIED

`placementRobustness` was the dimension I called the interesting one — the only measurement rather than
proxy. It contributed almost nothing here (nearly every candidate scored `2/2`), and worse than nothing on
the one pair where independent evidence exists:

    n < 10 and n != 3   vs   n < 10        probe says: DOMINATED, robustness EQUAL at 1/2 each

That verdict **contradicts the middle family**, which varied the *insertion placement* and measured:

    self-defending  n < 10 and n != 3    84 guards   derived 82   blind-TOP 82   blind-BOTTOM 0   0.651
    plain           n < 10              149 guards   derived 147  blind-TOP 63   blind-BOTTOM 0   0.470

**The self-defending guard is measurably more placement-robust, and my probe marked it dominated.**

The cause is a specification error in the dimension, not noise: the probe permutes the **order of the new
operations**, while the robustness that matters is over the **insertion point relative to existing code**.
Those are different environmental variations, and the asymmetry that motivated the dimension lives entirely
in the second one.

## Answer to the frozen question

> Given two implementations of the same verified semantic contract, can domain-neutral metrics identify
> consistent quality dominance without preferring a candidate merely because its syntax resembles a
> canonical realization?

**Consistently: yes. Without preferring syntax: no — not as these metrics stand.** 57% of dominances are
surface-only, and the single dimension intended to carry real signal measures the wrong variation and
therefore reverses a known-correct judgement.

## Decision

**`LegaReward` is NOT built on this vector.** The preregistration named this outcome, and the honest
consequence is to fix the instrument before promoting anything:

1. `placementRobustness` must vary the **insertion placement** against the existing program, not the
   ordering of new operations. The middle family's three placements are the right variation and its data
   already validates the measure.
2. Surface dimensions must be reported as **weak** and never sufficient on their own for champion
   replacement. A dominance that survives only on `changedChars` and `branchPoints` should return
   `NO_PREFERENCE` for promotion purposes.
3. Only then is a re-run worth doing.

**Nothing was promoted, demoted, or rejected.** Every realization named above remains verified and
admissible; the or-chains demoted on surface grounds are still correct, and 45 measured transactions in an
earlier family realized their contract that way. Domination affects the champion, never admissibility —
which is the property that made it safe to run this probe at all.
