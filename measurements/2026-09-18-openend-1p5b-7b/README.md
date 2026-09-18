# PREREGISTRATION — the open end

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## The only failure mode left at 7B

Every one of the 7B's eighteen authorization leaks in the shapes window was an **invented bound**:

    1 < n < 10      10 > n >= 3      10 > n > 3        an invented LOWER bound
    100 < n <= 200  100 < n < 200                      an invented UPPER bound
    n >= 5 and n < 10   n >= 0   n >= 10

None malformed, none a misread threshold. Every one puts a bound on the end the contract left **open**.
At 1.5B there were no leaks at all — 98/98 — so this is a failure mode that *arrives with capacity*.

This asks whether `RENDER` can address it.

## Three renderings of the open end

    SILENT    "For values below 10 where n is not 3, ..."                        it is not mentioned
    NEGATED   "For values below 10, with no lower bound, where n is not 3, ..."   named as ABSENT METADATA
    EXTENT    "For every value below 10, however small, where n is not 3, ..."    stated as a RELATION

Per shape the open end is the correct one — `no upper bound` / `however large` for `S_LOWER`.
Everything outside these phrases is the shapes harness verbatim: same four shapes, same program
templates, same authority envelope, same verifier, same contract-derived probe generator.

## Primary endpoint is the failure class, not the pass rate

    TOO_NARROW   an authorized output fails a probe INSIDE the requested domain — it declined an input
                 the contract obliges it to claim, which is exactly what an invented bound leaves behind
    TOO_WIDE     it fails a probe OUTSIDE the requested domain — it took something it must not

Both are read off the contract probes, so the classification needs no judgement call. Verified rate,
proposal yield and authorization precision are secondary.

## Prediction, written before running

> **`NEGATED` will be the worst of the three**, and the prior is specific rather than a hunch. The
> `FMT` window found a domain rendered as bound metadata scored 6/20 against 17/20 for the same domain
> rendered as a relation, and the tell was the model implementing *"no lower bound"* as a positivity
> test — a field that exists to say a constraint is **absent**, read as a constraint. *"There is no
> lower bound"* is the same move.
>
> **`EXTENT` will beat `SILENT`** on `TOO_NARROW`, because it states the openness without naming a
> bound to implement.
>
> **The effect will be visible at 7B and absent at 1.5B**, because the 1.5B does not produce this
> failure mode at all — it has no room to improve and 98/98 cannot move.

**This predicts that the intuitive fix makes the problem worse.** If `NEGATED` instead *reduces*
`TOO_NARROW`, the `FMT` result does not generalize from stating a bound to stating its absence, and the
renderer rule needs splitting.

**Falsified if all three renderings are indistinguishable**: the open end would not be the lever, and
the invented-bound failure would not be addressable at `RENDER` at all — sending the next gate to
`CONSTRAIN` (an authority envelope that rejects guards mentioning values the contract never named)
instead.

## Cells and power

3 renderings x 4 shapes x 2 models x 20 samples = **480 generations.** At 7B the shapes window produced
18 leaks in 133 authorized outputs, so the base rate is around 0.14; with 80 samples per rendering per
model a doubling or halving is readable and a small shift is not.

## Controls

Identical plans across the three renderings within each shape; leakage; sufficiency; both legal
realizations pass; three mutants die; dense-equivalence adjudication for any surviving mutant. All
pass.

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, `min_containers` 0, AC confirmed, stop with
`--yes` and verify. **Rule 3** before any generation.
