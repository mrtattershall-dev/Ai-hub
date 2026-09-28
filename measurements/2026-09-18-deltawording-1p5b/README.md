# PREREGISTRATION — delta wording, and the interaction tested properly

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

Two preregistered endpoints, ten cells, 40 samples each = **400 generations**.

---

## E1 — does "other" get read as "the remaining positive ones"?

Two of the three authorization leaks observed so far are the **same fragment**:

    if n > 0: return "small"

both in case A, whose delta reads *"For **other** values below 10, return small."* The bound named in
the delta vanishes and a bound at the excluded special case takes its place.

Three deltas encoding the **same residual behaviour**, differing only in how the exclusion is phrased:

    OTHER        For other values below 10, return "small".
    EXPLICIT     For values below 10 except zero, return "small".
    RELATIONAL   For values less than 10 that are not zero, return "small".

**A control asserts all three produce an identical plan** — same requested condition (`n < 10`), same
result, same precedence winner (`existing`), same insertion point (after line 8). Confirmed before
commit. Without that, this would be comparing placements rather than wordings.

### Primary endpoint

The rate of **`ZERO_LOWER`** conditions — `n > 0`, `n >= 0`, `n > -1` — classified from the emitted
guard on **every sample, authorized or not**, so the denominator does not move with the refusal rate.

`n > 10` is deliberately a *different* family (`INVERTED_UPPER`): it still uses the delta's own number.
Conflating them is the defect the classifier control caught before this window opened — the first
draft tested "has a `>` and no `<`", which an inverted upper bound also satisfies.

Secondary: correct-condition rate, verified rate, commit integrity.

---

## E2 — the interaction, tested directly and prospectively

Windows 7 and 8 reported an interaction between window size and added wording on the strength of
*"significant at FULL, not significant at W1"*. **That is not a test that the two differ**, and it is
the same "read a null too hard" error window 8 had just corrected in window 7.

A direct test now exists — `legasus/legalabs/interaction.mjs`, a logistic likelihood-ratio test of the
window x arm term, whose **negative control is large main effects with equal odds ratios**, so it
cannot fire on a main effect alone. Applied retrospectively:

    window 8   OFF vs NEUTRAL       p = 0.16        window 8 does NOT establish it
    window 8   OFF vs FACT          p = 0.18
    window 7   OFF vs FACT          p = 0.008
    pooled 7+8 OFF vs FACT          p = 0.0051      pooled byte-identical replicates do
    pooled 7+8 OFF vs NEUTRAL       p = 0.075       not for inert wording alone

Here it is a **declared primary endpoint**: `NONE` vs `NEUTRAL` and `NONE` vs `FACT`, at `W1` and
`FULL`, on repeated-a-fixed-line, tested with that instrument.

---

## Cells

    W1    NONE     OTHER          FULL   NONE     OTHER         <- shared between E1 and E2
    W1    NEUTRAL  OTHER          FULL   NEUTRAL  OTHER
    W1    FACT     OTHER          FULL   FACT     OTHER
    W1    NONE     EXPLICIT       FULL   NONE     EXPLICIT
    W1    NONE     RELATIONAL     FULL   NONE     RELATIONAL

Case A throughout. Everything outside the varied element is byte-identical.

## Controls

Identical plans across the three deltas; sufficiency; endpoint reachability; assembler; and **three**
wrong fragments that must each be accepted and still fail — the inversion, the off-by-one, and
`if n > 0: return "small"` itself, because the primary endpoint's own failure mode must be one the
verifier can see. Plus classifier and extractor checks over eleven declared conditions. All pass.

## Prediction, written before running

> **E1.** I expect `OTHER` to produce more `ZERO_LOWER` conditions than `EXPLICIT` and `RELATIONAL`.
> The prior is weak: the hypothesis rests on n = 2 leaks, and `ZERO_LOWER` may simply be rare enough in
> all three arms that 80 samples per wording cannot separate them. **A flat result is the more likely
> outcome and would retire the hypothesis**, leaving the two leaks as coincidence.
>
> **E2.** I expect the interaction to reach significance for `FACT` and not for `NEUTRAL`, mirroring
> the pooled retrospective figures. If `FACT` does not reach it either, then the interaction is not
> established by any single window and must be reported as resting on pooled replicates only.

**No arm is predicted to win on verified rate.** Commit integrity is expected near 0.99.

## Cost and safety

Same T4 app under tatte's standing authorization in `COORD.md`. `scaledown_window` 5 minutes,
`min_containers` 0, hard 30-minute cap, AC power confirmed, stop with `--yes` and verify. **Rule 3**
before any generation.

---

# RESULT — delta wording, and the interaction tested properly

Rule 3 verified. All controls passed, including the assertion that the three deltas plan identically.
GPU window 11:15:44Z to ~11:24Z, stopped and verified: six `legasus-1p5b` rows, **zero** not `stopped`.

    window  sentence  delta        ZERO_LOWER  correct-cond  verified  repeated-fixed  P(c|auth)
    W1      NONE      OTHER            0/40        36           27           1           1.00
    W1      NEUTRAL   OTHER            1/40        33           20           3           1.00
    W1      FACT      OTHER            0/40        32           28           6           1.00
    W1      NONE      EXPLICIT         1/40        33           31           2           1.00
    W1      NONE      RELATIONAL       1/40        17           33           0           1.00
    FULL    NONE      OTHER            0/40        31           28           9           1.00
    FULL    NEUTRAL   OTHER            0/40        25           23          14           1.00
    FULL    FACT      OTHER            3/40        20           19          17           1.00
    FULL    NONE      EXPLICIT         3/40        22           28           6           0.93
    FULL    NONE      RELATIONAL       0/40         6           34           4           1.00

## E1 — the "other" hypothesis is retired, and it was the outcome I said was more likely

    ZERO_LOWER per 80      OTHER 0      EXPLICIT 4      RELATIONAL 1

`OTHER` produced **zero** `n > 0`-family conditions in 80 samples. The two earlier leaks that motivated
this experiment were coincidence. Preregistered: *"a flat result is the more likely outcome and would
retire the hypothesis"* — recorded before running precisely so this could not be narrated afterwards
as anticipated.

**A new observation, weak and stated as one.** All four `ZERO_LOWER` conditions came from `EXPLICIT`
— *"For values below 10 **except zero**"* — and so did one of this run's two authorization leaks,
`if n > 0: return "small"`. If anything pulls `n > 0` out of the model it appears to be **naming
zero**, not the ellipsis in "other". That is n = 4 and belongs in a preregistration, not a conclusion.

## E1 secondary — the wording changes what the model writes, enormously

This is where the effect actually lives:

    delta        what the model wrote                              correct-cond   verified
    OTHER        67x `n < 10`                                        67/80          55/80
    EXPLICIT     55x `n < 10`,  8x `n < 10 and n != 0`               55/80          59/80
    RELATIONAL   46x `n < 10 and n != 0`,  23x `n < 10`              23/80          67/80

    correct-cond   OTHER 67 vs RELATIONAL 23      p = 1.8e-12
    verified       OTHER 55 vs RELATIONAL 67      p = 0.040

`RELATIONAL` — *"values less than 10 that are not zero"* — made the model spell the exclusion out in
code, `n < 10 and n != 0`, in 46 of 80 samples. That is **a different realization of the same
behaviour, and it is correct**: placed after the preserved guard it passes every probe.

And it was the **best arm on the endpoint that matters**. Fewer of its outputs were refused for
reproducing fixed lines (0 and 4, against `OTHER`'s 1 and 9), so more reached the verifier and passed.

> Three phrasings of one obligation, identical in plan, produced verified rates of 55, 59 and 67 out of
> 80. How Legasus words the requested behaviour is worth about the same as everything else it does to
> the prompt.

The `correct-cond` column falling while `verified` rises is not a contradiction — it is the measurement
working. "Correct condition" means *exactly* `n < 10`; the anti-oracle rule this project adopted long
ago says a contract must admit more than one implementation, and `n < 10 and n != 0` is the second one.

## E2 — the interaction does NOT survive a prospective test

    preregistered primary            DiD      chi2(1)    p
    NONE vs NEUTRAL, W1 vs FULL      0.075     0.18     0.67
    NONE vs FACT,    W1 vs FULL      0.075     0.77     0.38

**Not significant.** The full history of this claim:

    window 7   OFF vs FACT          p = 0.008      significant
    window 8   OFF vs FACT          p = 0.18       not
    window 9   NONE vs FACT         p = 0.38       not, and this one was preregistered
    pooled 7+8 OFF vs FACT          p = 0.005      driven by window 7

> **The window x wording interaction is not established.** One window showed it, two did not, and the
> only prospective test of it failed. The pooled retrospective significance rests on the single window
> that showed it.

What *does* survive is the **main effect**, on this run's own data:

    repeated-a-fixed-line, both windows pooled, per 80
      NONE 10  ->  FACT    23        p = 0.018
      NONE 10  ->  NEUTRAL 17        p = 0.21

Added wording raises reproduction of forbidden code. **Whether that depends on how much source is
visible is now an open question, not a finding**, and the earlier annotation on window 8 is superseded
by this one: pooling could not rescue it either.

The reason is visible in the cells: at `W1` the sentence effect appeared this time too (1 -> 6 for
`FACT`), where in windows 7 and 8 it did not. The `W1` cells were not stable across runs; the effect
that looked like an interaction was partly `W1` happening to be flat twice.

## Commit integrity

    authorized 273   verified 271   P(correct | authorized) = 0.993
    cumulative across seven families:  736 authorized, 731 verified = 0.993

Both leaks are in `FULL/NONE/EXPLICIT`: `if n > 10: return "small"` and `if n > 0: return "small"`.
Both well-formed, both caught by execution.

## Honest limits

- `EXPLICIT`'s four `ZERO_LOWER` conditions are the seed of the next hypothesis, not evidence for it.
- The three deltas are one exemplar each of three phrasing styles. "Relational phrasing is better" is
  supported by one sentence per style.
- `W1` instability across runs is itself unexplained and is the reason E2 cannot be settled here.
- One task family, one function, one model, one temperature, case A only.

## What this changes

1. **Two hypotheses died this window and one large effect replaced them.** The "other"-ellipsis story
   is gone; the interaction is unresolved; and delta phrasing turns out to move the verified rate by
   12 points out of 80 between two equally valid English sentences.
2. **`renderDelta` joins `renderDomain` as an architectural surface.** Legasus already chooses how to
   phrase the requested behaviour. That choice is now measured, and the relational phrasing — spell the
   exclusion out, do not rely on ellipsis — is the one that verified best.
3. The next experiment is the one `EXPLICIT` suggested and this design cannot answer: does **naming the
   excluded value** pull a guard about that value out of the model? Several exemplars per phrasing
   style, `ZERO_LOWER` as the declared primary, and no reliance on a single sentence per level.
