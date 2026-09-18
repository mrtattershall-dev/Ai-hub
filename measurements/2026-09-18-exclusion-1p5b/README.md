# PREREGISTRATION — does naming the excluded value control how the model realizes the contract?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What this is a test of, in the pipeline's terms

    OBSERVE -> DECIDE -> RENDER -> PROPOSE -> CONSTRAIN -> PROVE -> COMMIT

This is a **RENDER-stage** experiment. `OBSERVE` and `DECIDE` are held completely fixed — a control
asserts every rendering within a task produces the identical plan — and the only thing that varies is
how the same truth is worded to the model.

If the effect generalizes across four different excluded values, `RENDER` stops looking like prompt
engineering and starts looking like a **compiler boundary**: a rich internal representation
deterministically compiled into the smallest representation appropriate for this model.

## The seed, and why it is not yet a finding

Window 9 killed the "other"-ellipsis hypothesis and left one weak observation: all four `n > 0`
conditions came from the arm whose delta said *"except zero"*, and `RELATIONAL` made the model write
`n < 10 and n != 0` in 46 of 80 samples.

**Both observations involve zero**, which is the value a language model has the most special-cased
associations with. A zero-specific quirk would look exactly like a general effect at n = 1 value.

## So the excluded value is varied

    T10_0   below 10, preserve  0        T10_3   below 10, preserve  3
    T20_5   below 20, preserve  5        T0_N2   below  0, preserve -2

One template, four instantiations; the preserved guard is the only thing that differs, so a difference
between tasks is a difference in the **value**, not in the program's shape.

Within each task, three renderings of the same residual behaviour:

    IMPLICIT          For the remaining values below T, return "small".
    NAMED_EXCLUSION   For values below T except P, return "small".
    RELATIONAL        For values below T where n is not P, return "small".

4 tasks x 3 renderings x 40 samples = **480 generations**, at `FULL` window throughout.

## Primary endpoint — a mechanism, not a pass rate

> **Does the generated guard contain an exclusion predicate naming the preserved value?**

Three families, classified from the emitted guard on every sample, authorized or not:

    NO_EXCLUSION            `n < 10`
    EXCLUDES_PRESERVED      `n < 10 and n != 0`      when 0 is the preserved value
    EXCLUDES_OTHER_VALUE    `n < 10 and n != 3`      when 0 is the preserved value

"Wrote an exclusion" and "wrote the **right** exclusion" are different claims and are counted
separately. Verified rate is secondary.

## The anti-oracle control, and why it is the load-bearing one

`n < T` and `n < T and n != P`, placed after the preserved guard, **both satisfy the contract**. A
control asserts both verify, for all four tasks, before the window opens.

An endpoint that rewarded one of them would be scoring **reference-form similarity instead of semantic
correctness** — precisely the failure window 9 exposed, where `RELATIONAL`'s exact-match "correct
condition" rate collapsed to 23/80 while its verified rate was the best of the three at 67/80.

## A probe hole the controls caught before the window opened

The first draft verified `n < T and n != P+1` — an exclusion of the **wrong** value, a real semantic
error that no probe touched. Neighbour probes at `P+1` and `P-1` are now part of the contract: both are
below the threshold and neither is the preserved value, so both must return `"small"`.

Same shape as the missing `n == 10` probe that let `n <= 10` pass in window 7. **A probe set is only as
good as the errors it can distinguish**, and a wrong-value exclusion is exactly the error this
experiment is most likely to produce.

## Controls

Identical plans per task; no leakage; sufficiency; **both** correct realizations verify; three wrong
fragments accepted-but-still-failing (inversion, off-by-one, wrong-value exclusion); and a classifier
check over seven declared conditions spanning all four preserved values including the negative one.
All pass.

## Prediction, written before running

> `NAMED_EXCLUSION` and `RELATIONAL` produce `EXCLUDES_PRESERVED` at a materially higher rate than
> `IMPLICIT`, **and they do so for all four values**, not only for zero. I hold this moderately: window
> 9's 46/80 for the relational phrasing was a large effect, but it was one value and one sentence.
>
> **The discriminating comparison is `T0_N2` and `T10_3` against `T10_0`.** If the effect appears only
> where the preserved value is zero, this is a narrow association with a special-cased literal and not
> a rendering principle — a much weaker and more interesting-in-a-different-way result.

**Verified rate is not predicted to differ**, because both realizations are correct. If it does differ,
the reason has to be found in the refusal columns, not asserted.

If the effect fails to appear at all, window 9's `RELATIONAL` result was specific to that exact
sentence, and `renderDelta` is a narrower surface than the last two windows suggested.

## Cost and safety

Same T4 app under tatte's standing authorization in `COORD.md`. `scaledown_window` 5 minutes,
`min_containers` 0, hard 30-minute cap, AC power confirmed, stop with `--yes` and verify. **Rule 3**
before any generation.
