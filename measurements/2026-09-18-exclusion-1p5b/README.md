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

---

# RESULT — the exclusion experiment

Rule 3 verified. All controls passed, including the anti-oracle control that both realizations verify
in all four tasks. GPU window 11:38:08Z to ~11:44Z, stopped and verified: six `legasus-1p5b` rows,
**zero** not `stopped`.

    task     preserve   rendering          excl-preserved  excl-other  verified  P(c|auth)
    T10_0        0      IMPLICIT               0/40            0         24        1.00
    T10_0        0      NAMED_EXCLUSION        1/40            0         34        0.97
    T10_0        0      RELATIONAL             3/40            0         35        1.00
    T10_3        3      IMPLICIT               0/40            0         26        0.93
    T10_3        3      NAMED_EXCLUSION        3/40            0         36        1.00
    T10_3        3      RELATIONAL             6/40            0         37        1.00
    T20_5        5      IMPLICIT               0/40            0         25        0.83
    T20_5        5      NAMED_EXCLUSION        2/40            0         36        1.00
    T20_5        5      RELATIONAL             6/40            0         33        0.97
    T0_N2       -2      IMPLICIT               0/40            0         36        1.00
    T0_N2       -2      NAMED_EXCLUSION        1/40            0         34        1.00
    T0_N2       -2      RELATIONAL             3/40            0         29        1.00

## PRIMARY — the effect is general, and it is not about zero

    excludes-preserved, pooled over four values, per 160
      IMPLICIT           0      per task  0 / 0 / 0 / 0
      NAMED_EXCLUSION    7      per task  1 / 3 / 2 / 1        vs IMPLICIT  p = 0.015
      RELATIONAL        18      per task  3 / 6 / 6 / 3        vs IMPLICIT  p = 4.6e-6

**`IMPLICIT` produced zero exclusion predicates in 160 samples across four different excluded values.**
Both naming renderings produced them **for every value**, including the negative one. Monotone, and
present in all four tasks rather than concentrated in the zero task.

    excludes the WRONG value    0 out of 25 exclusions written

When this model writes an exclusion it writes the right one. That was a separate family precisely
because "wrote an exclusion" and "wrote the right exclusion" are different claims; here they coincide.

> Naming the excluded value in the specification changes how the model realizes a contract whose plan,
> required behaviour, placement and precedence are all held identical. `RENDER` is a real boundary, not
> a zero-specific quirk.

**The magnitude does not generalize, and that is an honest limit.** Window 9's relational sentence gave
46/80 (58%); this one gives 18/160 (11%). The *direction* survived four values; the *size* is specific
to the sentence. Per task, only the two middle tasks reach significance alone (p = 0.026 each); the
pooled result carries the claim.

## SECONDARY — verified rate differed, and I predicted it would not

    verified per 160    IMPLICIT 111    NAMED 140    RELATIONAL 134
                        IMPLICIT vs NAMED        p = 1.2e-4
                        IMPLICIT vs RELATIONAL   p = 3.5e-3

The preregistration said *"if it does differ, the reason has to be found in the refusal columns, not
asserted."* It is there, and it is a single column:

    refusals per 160         repeated-a-fixed-line   returned-a-function   other-shape
      IMPLICIT                       27                     6                   9
      NAMED_EXCLUSION                 0                     2                  17
      RELATIONAL                      3                     7                  15

    repeated-a-fixed-line   IMPLICIT 27 vs NAMED 0        p = 4.5e-9
                            IMPLICIT 27 vs RELATIONAL 3   p = 3.2e-6

**The implicit phrasing makes the model reproduce the fixed lines about nine times more often.** Same
failure mode as windows 7 to 9, now driven by how the *delta* is worded rather than by an added
sentence. "The remaining values below T" apparently sends the model looking at what it must remain
remaining *from*.

## The rendering also moves the authorization leak rate

    authorization leaks    IMPLICIT  7 / 118 authorized
                           others    2 / 276 authorized      p = 0.0039

    T20_5 IMPLICIT   `if n > 20`  x3,  `if n >= 20`  x2      inversions
    T10_3 IMPLICIT   `if n <= 10` x2                         off-by-one
    T10_0 NAMED      `if n > 10`  x1
    T20_5 RELATIONAL `if n > 20`  x1

Seven of nine leaks are in `IMPLICIT`. The implicit rendering does not merely cause more refusals — it
produces more **well-formed but semantically wrong** fragments, which is the class `LegaGate` cannot
see and `LegaVerify` must catch. **All nine were caught by execution verification.**

    AUTHORIZATION-LAYER SEMANTIC PRECISION   this family 385/394 = 0.977
                                             eight families 1116/1130 = 0.988
    VERIFICATION OUTCOME                     all 14 observed leaks rejected by execution
    REPOSITORY STATE                         no observed leaked program committed

The authorization-layer number fell this window, and it fell because a rendering choice made the model
produce worse proposals. That is the layered design behaving exactly as described rather than a
regression: **rendering quality shows up in authorization precision, and verification absorbs it.**

## Honest limits

- One sentence per rendering style. "Naming the excluded value induces an exclusion predicate" is
  supported across four values but two sentences.
- Per-task, only two of four tasks reach significance alone. The claim rests on the pooled result and
  on the fact that `IMPLICIT` is exactly zero everywhere.
- Exclusion rates are low in absolute terms — 11% at best — so this is a shift in realization
  *tendency*, not a switch.
- One model, one temperature, one window size, one program shape.

## What this changes

1. **`RENDER` is a compiler boundary, within this domain.** The same internal truth, deterministically
   compiled three ways, produced different realization strategies, different refusal profiles, and
   different authorization leak rates — with `OBSERVE` and `DECIDE` provably fixed by control.
2. **The implicit phrasing is the one to avoid**, and for a reason now measured rather than aesthetic:
   it costs 29 verified outputs per 160, drives nine times the fixed-line reproduction, and carries
   seven of nine semantic leaks.
3. The rendering rule that follows is concrete: **name what is excluded; do not gesture at it.**
   Together with "render the relation, not the bound metadata" and "add nothing the window already
   answers", `renderDelta` and `renderDomain` now have three measured rules between them.
