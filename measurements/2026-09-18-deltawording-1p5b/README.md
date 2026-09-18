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
