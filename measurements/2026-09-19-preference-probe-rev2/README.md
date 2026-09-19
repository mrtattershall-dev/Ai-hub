# PREREGISTRATION — the preference probe, re-run with rev 2 and NOTHING ELSE CHANGED

**Committed before the re-run. No GPU: same artifacts as rev 1.**

## What changed, and only this

1. `placementRobustness` measures the **insertion position** against the existing program, not the
   ordering of new operations. Calibrated against the middle family before use, required to reproduce
   `self-defending > plain` **for the stated reason**, and controlled so a clause excluding a value no
   behaviour claims buys nothing.
2. Promotion is decided on **behavioral dimensions only**. Descriptive dimensions are measured and
   reported; they cannot replace a champion.
3. The robustness denominator is positions where the unit **still compiles**. A position that does not
   compile is not a placement the candidate failed at; it is not a placement.

The artifacts, the contracts, the pairs and the comparison logic are otherwise identical to rev 1.

## THE INTERPRETATION IS FROZEN BEFORE THE RESULT

This matrix is written down now precisely so that whatever comes back cannot be talked into being good
news afterwards:

    If NO_PREFERENCE rises substantially
        -> previous ranking pressure was mostly descriptive/style-derived, and rev 2 successfully removed
           unsupported promotion authority.

    If behavioral promotion remains common
        -> inspect whether placementRobustness genuinely separates those cases.
           DO NOT assume frequent promotion is desirable.

    If almost nothing promotes
        -> this is NOT a failure. It means the current dataset contains little evidence of objective
           superiority, and saying so is the correct output.

    If an intuitively worse candidate promotes
        -> treat as a FALSIFICATION OF THE REWARD APPARATUS, not as evidence that intuition must be wrong.

**`LegaReward` does not need to manufacture winners.** A mature optimizer must be comfortable saying: A is
correct, B is correct, I have no defensible evidence that either is better, keep both.

## The governance model this established

    FACT                  hard authority             PROVE may reject
    MEASURED OBJECTIVE    bounded optimization       may influence champion replacement
    DESCRIPTION           informational only         explains a difference, cannot authorize promotion
    POLICY / PREFERENCE   requires an explicit owner

> **Authority should decrease as epistemic certainty decreases.**

Correctness has strong behavioral evidence, so `PROVE` gets hard rejection authority. Robustness now has
calibrated behavioral evidence, so it may influence replacement. Surface complexity can be measured
accurately, but that lower is universally better has **not** been established, so it gets descriptive
authority only.

## What LegaReward is turning into

Not a score. An **evidence-backed partial order**:

    A and B both verified
    A behaviorally dominates B      -> A may replace B
    A and B trade off               -> retain both
    only descriptive differences    -> NO_PREFERENCE

There is no need for one immortal champion. A frontier of verified non-dominated solutions can be kept,
and future experiments resolve trade-offs when better evidence arrives. That is much harder to Goodhart
than a scalar leaderboard.

## Non-vacuity

Unchanged: `attempted / observed / unobservable / findings`, and the probe refuses to report if any
candidate could not be evaluated.

---

# RESULT — case 3 of the frozen matrix, with the control that makes it interpretable

**No GPU. Same artifacts as rev 1.**

    COVERAGE: attempted 15   observed 15   unobservable 0

## Promotion collapsed to zero

    PROMOTION — behavioral dimensions only
      promotions allowed (behavioral dominance)   0
      BLOCKED: descriptive-only gains             7

    STABILITY   distinct dominating pairs 7   reversals 0

Rev 1 would have promoted on all seven of those. Rev 2 promotes on **none**, and the seven it refuses are
exactly the descriptive-only dominances the previous probe exposed — four spelling-driven, three resting on
`duplicatedTerms` and `worstCaseTests`, all of which are now classified descriptive.

**Placement robustness now varies** (`3/4` for the set operations, `1/4` for `low`, against a uniform `2/2`
in rev 1), so the repaired dimension is measuring something. But **within every compared pair it is equal**,
which is why nothing promotes.

## Read against the frozen matrix

> **If almost nothing promotes** → this is NOT a failure. It means the current dataset contains little
> evidence of objective superiority.

That is this result. The set family contains no pair where one realization is **behaviorally** superior to
another realization of the same contract. Every difference between them is descriptive. Saying so is the
correct output, and the previous 7 dominances are now correctly reported as insufficient grounds.

> **If `NO_PREFERENCE` rises substantially** → previous ranking pressure was mostly descriptive, and rev 2
> removed unsupported promotion authority.

Also true, in the promotion view: every one of the 10 pairs now yields no promotion, against 7 that would
have promoted under rev 1.

## THE CONTROL — "nothing promotes" must not mean "the rule can never fire"

A promotion rule that never fires is indistinguishable from one that is broken, so the claim needed a
dataset where behavioral separation genuinely exists. The middle family has one, already recorded: it
measured three **placements** per realization, which is exactly the variation rev 2 measures.

    n < 10 and n != 3    robustness 0.667        n < 10     robustness 0.333
    n < 20 and n != 12   robustness 0.667        n < 20     robustness 0.333
    0 <= n < 50          robustness 0.667        n < 50     robustness 0.333

    PROMOTES   n < 10 and n != 3    over   n < 10
    PROMOTES   n < 20 and n != 12   over   n < 20
    PROMOTES   0 <= n < 50          over   n < 50

**Three same-contract pairs, three promotions, all in the known-correct direction**, each for the stated
reason — better on `placementRobustness`, worse on nothing. So the rule fires when the evidence is there
and stays silent when it is not, which is the behaviour that makes a zero meaningful.

## What this establishes

`LegaReward` is not a scoring function. It is an **evidence-backed partial order** that declines by
default:

    A and B both verified
    A behaviorally dominates B    -> A may replace B          (demonstrated: 3 cases, middle family)
    A and B trade off             -> retain both
    only descriptive differences  -> NO_PREFERENCE            (demonstrated: 7 cases, set family)

And the governance ladder it now implements:

    FACT                  hard authority              PROVE may reject
    MEASURED OBJECTIVE    bounded optimization        may influence champion replacement
    DESCRIPTION           informational only          explains a difference, cannot authorize promotion
    POLICY / PREFERENCE   requires an explicit owner  none exist yet

> **Authority decreases as epistemic certainty decreases.**

Nothing was promoted, demoted, rejected or archived by this run. Every realization named remains verified
and admissible.
