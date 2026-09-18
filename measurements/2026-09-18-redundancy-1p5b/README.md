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
