# PREREGISTRATION — the visibility ladder, repaired

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

Revision 1 (`measurements/2026-09-18-window-1p5b/`) stands exactly as published. Nothing here rescores
it.

## What revision 1 left open

Its `W0` rung is **void**. With zero source lines visible the prompt never said the parameter was
called `n`, so the model wrote `value < 10`, `size < 10`, and invented whole functions to hang a guard
on. That removed a **current program fact**, not a quantity of visible source, so it cannot be a point
on the visibility axis.

Two readings of `W0`'s collapse survive revision 1 and it cannot separate them:

1. the model needed the **missing fact**, and will be fine once it has it
2. the presence of **any real context** suppresses the urge to write a function, independent of facts

Revision 1 also found the opposite of its own prediction: refusals *rose* as the window narrowed, and
all 14 whole-function emissions sat at `W0`. Whether that survives a sufficient prompt is the question.

## The one change

Every arm now carries the parameter name as a **rendered program fact**:

    The function takes one parameter, named n.

Legasus reads it from the source. It is not a hint about the answer, and it is **identical in every
arm** — redundant at `FULL`, where the source shows it anyway — so the window remains the only
variable.

## Three controls now, not two

Revision 1 passed an assembler control on an arm the model could not possibly satisfy.

    can the apparatus express a pass?        assembler control
    can the apparatus express a failure?     inversion and off-by-one controls
    can the model obtain the facts?          SUFFICIENCY control      <- new, and revision 1 is why

All three pass for all four arms and both cases. The sufficiency control **earned its place before
this was committed**: the first draft of the fact line derived the parameter through a regex that a
shell-quoted `node -e` had silently corrupted, so the prompt read *"named undefined"* — and the
sufficiency control caught it, reporting that `n` was never supplied. It is now also asserted at
derivation, because a derived fact that comes out `undefined` and is rendered anyway is this project's
signature silent failure.

## Arms

    W0    the slot alone, facts supplied          0 units
    W1    one statement either side               2 units
    W2    two statements either side              4 units
    FULL  the entire function                     9 units

4 arms x 2 cases x 10 samples = **80 generations.** Same model, temperature, token budget, acceptance
policy, assembler, verifier and probe set as revision 1, so `W1`, `W2` and `FULL` double as a
cross-run replication of revision 1's 13/20, 13/20 and 17/20.

## Prediction, written before running

> `W0` rises sharply from its void 0/20 — it must, since its authorized outputs previously could not
> even load. Beyond that I predict **no monotone relationship** between window size and verified rate:
> revision 1 already falsified the visibility hypothesis in the direction I expected it to hold, and I
> am not predicting a reversal. Commit integrity stays at 1.00 everywhere the facts are present.
>
> **The discriminating measurement is whole-function emission at `W0`.** If it drops to near zero, the
> missing fact explains revision 1's collapse and reading 1 wins. If it stays high while the arm still
> loads, then context presence — not facts — suppresses the function affordance, and reading 2 wins.

**No arm is predicted to win on generation capability**, and `W0` reaching ceiling would be the
strongest result available here: it would mean the floor of this system is *no visible source at all*,
collapsing the visibility axis into a fact-sufficiency question.

If commit integrity falls below 1.00 at any rung, that is the most important line in the result
regardless of anything else, because 51 of 51 across two prior families is the claim most at risk of
being a small-sample artifact.

## Power

Cell noise is about ±2 at n = 10 from ladder 2 and revision 1. Differences of one or two samples
between adjacent rungs are not readable and will be reported as inconclusive. `W0` against `FULL`, and
`W0`'s whole-function count against revision 1's 14, are the contrasts this sample can carry.

## Cost and safety

Same T4 app under tatte's standing authorization ("Use the t4 as needed", recorded in `COORD.md`).
`scaledown_window` 5 minutes, `min_containers` 0, hard 30-minute cap, AC power confirmed, stop with
`--yes` and verify. **Rule 3** before any generation.
