# PREREGISTRATION — the redundant sentence

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What this is testing, and what it is not allowed to inherit

Visibility-ladder revisions 1 and 2 differ by exactly one sentence — a rendered parameter-name fact,
redundant at every arm whose window already shows the source. On the three shared arms, refusals for
**repeating a fixed line** went 6/60 to 23/60.

**That comparison crosses runs and stays purely hypothesis-generating.** It is not evidence and is not
cited as such anywhere in this result. This is the controlled version: one window, one prompt, one
sentence varied, everything else byte-identical.

## The primary endpoint is a failure mode, not a pass rate

> **Does redundant obligation wording increase reproduction of fixed surrounding code?**

Measured as the **repeated-a-fixed-line refusal rate**, pooled across cases, per window. Overall
verified rate is secondary — a wording change that leaves the pass rate alone while doubling one
failure mode is exactly the effect a pass rate cannot see, which is the same reason this project now
reports two quantities instead of one.

## Three arms, because two cannot separate redundancy from this particular sentence

| Arm | Sentence added | What it is |
|---|---|---|
| `OFF` | — | revision 1's condition |
| `FACT` | *The function takes one parameter, named n.* | revision 2's condition; redundant wherever the window shows the `def` line |
| `NEUTRAL` | *The function is defined at the top level of its module.* | an equally inert program fact with zero planning content |

Both sentences are **true statements about the program**, of comparable length and identical
grammatical shape. Only one names something the model's output must contain.

- If `FACT` and `NEUTRAL` move together against `OFF`, the effect is **sentence count**.
- If `FACT` moves and `NEUTRAL` does not, it is something about **obligation-shaped wording**.
- If neither moves, the cross-run 6/60 → 23/60 was run-to-run variation — which is itself important,
  because it would mean cross-run comparisons in this rig are not readable at all.

## Two windows

`W1` (one statement either side) and `FULL` (the whole function). Two independent replications of the
same contrast. **`W0` is excluded by design:** with no window there are no fixed lines to repeat, so
the primary endpoint is undefined there, and `OFF` would fail the sufficiency control besides.

3 arms x 2 windows x 2 cases x 20 samples = **240 generations.**

At 40 samples per arm per window, a rate moving from ~0.10 to ~0.40 is readable (Fisher p ≈ 0.003).
That is why the sample per cell is 20 rather than the 10 used by earlier ladders.

## Controls — four questions now

    can the apparatus express a pass?        perfect fragment verifies
    can the apparatus express a failure?     inversion and off-by-one accepted and still fail
    can the model obtain the facts?          sufficiency control
    is the ENDPOINT reachable?               the window must actually show a fixed line, or
                                             "repeated a fixed line" reports a clean zero for the
                                             wrong reason

Plus a control specific to this design: the arms are asserted to **differ by exactly one line**, and
that line must be exactly the arm's sentence. A contrast that claims to vary one sentence and varies
anything else is not the experiment it says it is. All controls pass.

## Prediction, written before running

> I do not predict a direction with confidence. The cross-run observation suggests `FACT` raises the
> repeated-fixed rate against `OFF`, and if the mechanism is obligation-shaped wording rather than
> sentence count then `NEUTRAL` sits with `OFF`.
>
> **The most likely outcome by prior is that nothing moves**, because the cross-run difference was
> measured across two runs whose cell noise is about ±2 at n = 10 and which were never designed to be
> compared. I am explicitly recording that as the expected result so that a null cannot be written up
> afterwards as though it were anticipated all along.

**No arm is predicted to win.** Commit integrity is expected to stay at 1.00; if it does not, that is
the most important line in the result regardless of the primary endpoint, because 87/87 across three
families is the claim most at risk of being a small-sample artifact.

## Scope of the visibility conclusion, restated here so it is not overreached

> Within this task family, reducing source visibility does **not** monotonically improve reliable
> generation. Instead, different visibility regimes induce **different unauthorized output modes** — no
> context invites inventing surrounding structure, more context invites reproducing it.

No "best window" is claimed, and none is implied by anything below.

## Cost and safety

Same T4 app under tatte's standing authorization recorded in `COORD.md`. `scaledown_window` 5 minutes,
`min_containers` 0, hard 30-minute cap, AC power confirmed, stop with `--yes` and verify.
**Rule 3** before any generation.

---

# RESULT — the redundant sentence

Rule 3 verified. All four controls passed, plus the arm-diff assertion that the arms differ by exactly
one line. GPU window 10:36:24Z to ~10:42Z, stopped and verified: eight `legasus-1p5b` rows, **zero**
not `stopped`.

    window  arm      PRIMARY repeated-fixed   verified   P(correct | authorized)
    W1      OFF            5/40                25/40           1.00
    W1      FACT           4/40                27/40           1.00
    W1      NEUTRAL        2/40                25/40           1.00
    FULL    OFF            5/40                34/40           1.00
    FULL    FACT          22/40                13/40           0.94
    FULL    NEUTRAL       10/40                25/40           0.95

## I preregistered the null. The null is dead.

    PRIMARY ENDPOINT, repeated-a-fixed-line, at FULL
      OFF   5/40  ->  FACT    22/40      p = 1.1e-4
      OFF   5/40  ->  NEUTRAL 10/40      p = 0.25
      FACT 22/40  vs  NEUTRAL 10/40      p = 0.012

**One redundant sentence quadrupled the rate at which the model reproduced code it was explicitly
forbidden to touch**, and took the verified rate from 34/40 to 13/40 (p = 3.1e-6). The sentence added
**zero semantic information**: at `FULL` the window already shows `def classify(n):`.

The three-arm design earns its keep. `NEUTRAL` — an equally true, equally long, equally inert program
fact — moved the endpoint only a little and not significantly (p = 0.25), while `FACT` moved it far
beyond `NEUTRAL` (p = 0.012). So this is **not** simply "one more sentence". Sentence count may
contribute; obligation-shaped wording contributes much more.

> More explicit instruction is not more usable instruction. A redundant constraint changed completion
> behaviour while adding nothing a reader would call information.

## The effect is an interaction, not a property of the sentence

    W1 (one statement either side)     OFF 5/40   FACT 4/40    p = 1.00
    FULL (the whole function)          OFF 5/40   FACT 22/40   p = 1.1e-4

**The same sentence is harmless in a small window and destructive in a large one.** Whatever is
happening is not "the sentence is bad"; it is the sentence interacting with how much fixed code is in
front of it. That is consistent with the visibility family's finding that context affords *reproduction*
— the redundant sentence appears to amplify an affordance the large window already carries, rather than
creating one.

This also retires the cross-run 6/60 → 23/60 observation properly: the controlled version confirms an
effect of the same size and direction, and localizes it to the window where it exists.

## THE 87/87 STREAK IS BROKEN, AND THIS IS THE MOST IMPORTANT LINE IN THE RESULT

Preregistered: *"if commit integrity does not stay at 1.00, that is the most important line in the
result regardless of the primary endpoint."* It did not.

    authorized outputs, this family    151
    of those, verified                 149        P(correct | authorized) = 0.987

Two authorized outputs were wrong, both at `FULL`, and both are worth reading:

    if n > 0: return "small"          FULL/FACT/A       classify(50) -> "small", classify(10) -> "small"
    if n > 10: return "very large"    FULL/NEUTRAL/A    classify(50) -> "very large", delta never made

The first is the **bound inversion** the `FMT_BOUND` arm found, appearing here for the first time
inside a well-formed fragment. The second invents a result outside the declared vocabulary.

### What this does and does not overturn

**It does not mean a wrong program reached the repository.** Both were caught by the behavioural
verifier — that is what `verified: false` means — so the layered gate held. What leaked is the
**authorization boundary on its own**.

That distinction was blurred in how I have been reporting this, and it needs to be sharp:

    P(correct | AUTHORIZED)   the shape gate alone       236/238 across all families = 0.992
    P(correct | VERIFIED)     shape gate + execution     no failure observed in any family

The claim worth protecting is therefore narrower and better founded than "87/87":

> Across five families the authorization boundary admitted 238 outputs and 236 were correct; the two
> that were not were rejected downstream by execution verification. Authorization is a strong filter
> and **not** a sufficient one, which is exactly why LegaVerify exists as a separate layer.

An earlier version of this claim would have read as though authorization alone were sufficient. 151
more samples show it is not. That is the streak breaking usefully.

## Secondary observations

- `W1` is flat on everything: 25, 27, 25 verified; 5, 4, 2 repeated-fixed. Nothing the sentence does
  survives a small window.
- `FULL/OFF` at 34/40 is the best generation rate any arm has produced in this task family.
- Whole-function emissions: 2 across 240 generations, both at `FULL`. The visibility family's finding
  that context suppresses invention holds at four times the sample.

## Honest limits

- One task family, one function, one model, one temperature.
- `NEUTRAL` is one sentence, not a class. "Obligation-shaped wording" is a hypothesis about *why* it
  differs from `FACT`, not something this design measures; a proper test varies wording along a
  declared dimension with several exemplars per level.
- The two commit failures are n = 2. The *rate* is not well estimated; that authorization alone can
  leak is now established, its frequency is not.
- Case asymmetries remain larger than some arm differences and remain unexplained.

## What this changes

1. **Model-facing rendering is now a measured design surface, not a style question.** Two independent
   results point the same way: render the relation rather than bound metadata (6/20 → 17/20), and do
   not add obligations the window already carries (34/40 → 13/40). Both are decisions Legasus makes
   deterministically, which means both are fixable in the architecture rather than in the model.
2. **`P(correct | authorized)` and `P(correct | verified)` are separate metrics from here on**, and no
   result may quote one while meaning the other.
3. The next question is whether the `FACT`/`NEUTRAL` gap is really about obligation shape or about the
   sentence naming an identifier that appears in the answer. That is a single-variable test: a sentence
   naming an identifier that does *not* appear in the answer.

---

## ANNOTATION, added after a better-powered follow-up — the numbers above stand, one inference does not

`measurements/2026-09-18-idnaming-1p5b/` ran the same `OFF`, `FACT` and `NEUTRAL` conditions at `FULL`,
byte-identical, with three further arms. Two things changed.

**Corrected.** This document concluded *"this is NOT simply one more sentence"* from `NEUTRAL` sitting
at 10/40 against `OFF` 5/40, p = 0.25. **That read a null as evidence of no effect at a sample that
could not have shown one.** The follow-up put `NEUTRAL` at 14/40 against `OFF` 5/40, p = 0.034, and
pooling the byte-identical replicates gives 24/80 against 10/80, p = 0.011.

    ANY extra sentence raises reproduction of forbidden code      NEUTRAL pooled, p = 0.011
    AN OBLIGATION-SHAPED one raises it further                    FACT over NEUTRAL pooled, p = 0.0098

Both are real. This document had the second and missed the first, so its design rule was too narrow:
the rule is *do not add sentences a model-facing prompt's window already answers*, whatever they say —
not merely *avoid obligation-shaped ones*.

**Replicated and strengthened.** The headline effect and the interaction both held. `FACT` at `FULL`
19/40 against this document's 22/40; `OFF` 5/40 against 5/40; and `W1` stayed flat across **five**
sentences, not two. The claim that the effect of wording is a property of the wording *together with*
the code surface beside it is now the best-supported structural result in this line.

Nothing above is rescored. The tables, the p-values and the preregistration stand as recorded.
