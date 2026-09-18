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

---

# RESULT — the open end

All controls passed. GPU window stopped and verified: every `legasus` app row `stopped`.

    model   rendering   too-narrow   authorized   verified   P(correct | authorized)
    1.5B    SILENT         1/80          53          52            0.981
    1.5B    NEGATED        0/80          58          58            1.000
    1.5B    EXTENT         0/80          58          58            1.000
    7B      SILENT        16/80          71          55            0.775
    7B      NEGATED       15/80          75          60            0.800
    7B      EXTENT         1/80          72          71            0.986

    7B  too-narrow   SILENT vs EXTENT    p = 1.3e-4      SILENT vs NEGATED   p = 1.000
                     NEGATED vs EXTENT   p = 2.8e-4
    7B  verified     SILENT vs EXTENT    p = 3.3e-3

## Five words removed the only failure mode the 7B had left

`EXTENT` — *"For every value above 100, **however large**, where n is not 200..."* — took the
invented-bound rate from **16/80 to 1/80** and authorization precision from **0.775 to 0.986**.

`S_LOWER` is the decisive cell, and it is not subtle:

    SILENT    5/20 verified     13 leaks, every one `100 < n < 200`
    NEGATED   7/20 verified      9 leaks, every one `100 < n < 200`
    EXTENT   17/20 verified      none

The model was reading *"above 100, except 200"* as *"between 100 and 200"*. Saying **however large**
stopped it doing that, thirteen times out of thirteen.

## My prediction was wrong about which fix backfires

> *"`NEGATED` will be the worst of the three... 'There is no lower bound' is the same move."*

**Falsified.** `NEGATED` is indistinguishable from `SILENT` — 15/80 against 16/80, p = 1.000. Naming the
absent bound is **inert**, not harmful.

So the `FMT` finding does **not** generalize the way I extended it. Rendering a domain *as* bound
metadata hurt (6/20 against 17/20). Stating that a bound is *absent* neither helps nor hurts. The two
are different moves and the rule needed splitting — which the preregistration named as the outcome that
would require it.

> **`EXTENT` beats `SILENT`** — confirmed, and far more strongly than predicted.
> **Visible at 7B, absent at 1.5B** — confirmed. The 1.5B has no room to move and did not move.

## The best configuration measured so far is 7B with `EXTENT`

    configuration        proposal yield   authorization precision   verification rate
    1.5B + EXTENT            0.725                1.000                  0.725
    7B   + SILENT            0.888                0.775                  0.688
    7B   + EXTENT            0.900                0.986                  0.888

The 7B's advantage was always proposal yield and its cost was always semantic precision. **A rendering
change bought back the precision without giving up the yield**, and the end-to-end verified rate is now
0.888 against the 1.5B's 0.725 — the first configuration where capacity is straightforwardly worth
having under this architecture.

This is the mandate's target, not a benchmark score: the system around the model got better, the model
did not change, and the improvement is attributable to one deterministic rendering decision.

## What this changes

1. **A fourth renderer rule, and the strongest one yet measured:** *state the extent of an open end
   relationally; naming its absence does nothing.* It survives four contract shapes and moves the
   metric that matters most, authorization precision.
2. **The renderer can repair a capacity-induced failure mode.** The invented-bound class arrives with
   capacity — zero at 1.5B, 18/133 at 7B — and `RENDER` removed it without touching `CONSTRAIN` or
   `PROVE`. The preregistration's fallback, moving the next gate to an authority envelope that rejects
   unnamed values, is **not needed**.
3. **The `FMT` rule is now split**: bound metadata as a *substitute* for a relation is harmful; bound
   metadata as an *addition* stating absence is inert. Only the relational form helps.

## Honest limits

- One sentence per rendering. *"However large"* is one exemplar of relational-extent phrasing.
- The effect is concentrated in `S_LOWER` — 13 of the 16 `SILENT` failures. `S_UPPER` moved 3 → 1 and
  `S_STRADDLE` 0 → 0. Whether `EXTENT` helps on shapes that were not already failing is untested here.
- 1.5B shows no effect because it has no headroom, not because the rendering is inert for it.
- Still one task family, one operation, one parameter.
