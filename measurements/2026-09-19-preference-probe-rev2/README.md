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

---

## ADDENDUM — the denominator trap, found after the result and fixed before it was trusted

`ILLEGAL` was decided **per candidate**: each realization was assembled at each position, and the ones it
failed to parse at were dropped from *its own* denominator. That lets a candidate raise its score by being
compatible with fewer environments:

    A   compiles at 2 of 4, correct at 2   ->  2/2 = 1.00
    B   compiles at 4 of 4, correct at 3   ->  3/4 = 0.75

`A` wins for fitting in fewer places, which is the opposite of robustness and the same shape as every
accidental oracle this project has found.

**Legality is now decided by the HOST**, using a neutral representative of the operation kind — a guarded
return with an inert condition. If a guarded return cannot go at a position at all, that position is in
nobody's denominator; if it can, every candidate is answerable for it:

    HOST_ILLEGAL
        host cannot accept this operation kind
        -> excluded from denominator
    LEGAL + candidate syntax failure
        -> candidate robustness failure
    LEGAL + candidate executes + contract fails
        -> candidate robustness failure
    LEGAL + candidate executes + contract holds
        -> candidate robustness success
    apparatus/evaluation failure
        -> UNOBSERVABLE
        -> no score emitted

Two controls pin it: every candidate against a host must report the **same** `legal` count, reproducible
from `hostLegalPositions` without reference to any candidate; and a guard whose own text parses nowhere is
**charged at every legal position** rather than excused into `0/0`.

## The two facts, kept separate

- **Apparatus defect:** legality was candidate-conditioned, creating a possible incentive for
  incompatibility.
- **Observed impact on this experiment:** none, because every compared candidate had the same
  syntactically legal placement set.

> After replacing candidate-conditioned legality with candidate-independent host legality, all previously
> reported rev-2 promotion conclusions remained unchanged. In this family, candidate legal-placement sets
> happened to coincide, so the defect was real but non-operative in the observed results.

The rev-2 conclusion therefore survives unchanged, but now for a stronger reason: **the denominator is
defined independently of the thing being scored.** "The fix changed no numbers" is evidence about *this
dataset*, never evidence that the bug was harmless.

## The validation chain this dimension has accumulated

    correct perturbation axis          insertion placement, not operation order
    positive calibration               reproduces the middle family's 0.667 against 0.333
    calibration FOR THE STATED REASON  the gained position is the one ahead of the preserved behaviour
    anti-bloat negative control        n != 999 buys nothing, piled up or not
    wrong-domain control               a wrong realization scores 0 at every position
    impossible-expectation control     a self-confirming measurement scores 0 for everything
    non-vacuity behaviour              evaluation failure propagates, never quietly scored
    candidate-independent denominator  the host decides legality, not the candidate

That is the chain that has to hold before this dimension is given limited promotion authority over a
repository.
