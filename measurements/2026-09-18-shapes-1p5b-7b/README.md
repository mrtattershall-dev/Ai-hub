# PREREGISTRATION — four contract shapes, contract-derived verification

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why broaden instead of tune

Every measurement so far used **one** contract shape: an upper-bounded requested interval overlapping
a preserved **point**. Pushing that family further would be overfitting it. This widens the `DECIDE`
surface and verifies the whole pipeline on shapes it was not developed against.

    S_UPPER      requested n < 10    preserved point 3        the anchor, known shape
    S_LOWER      requested n > 100   preserved point 200      unbounded-ABOVE requested domain
    S_IVAL       requested n < 10    preserved interval n<0   preserved INTERVAL, strictly inside
    S_STRADDLE   requested n < 10    preserved interval n>5   partial overlap on BOTH sides

**Two candidate shapes were discarded offline before anything was built on them** — requested `n > 100`
against preserved point 3, and requested `n == 7` against preserved point 3 — because their domains are
`DISJOINT` and pose no precedence question at all. Recorded rather than quietly dropped.

`S_STRADDLE` is the hardest: neither domain contains the other, so the correct program has three
regions — below 6 is the new behaviour, 6–9 is the preserved behaviour winning the overlap, 10 upward
is untouched.

## Verification is contract-derived throughout

`legaverify/probes.mjs` builds every probe from the obligation: boundary triples around each bound the
contract names, triples around each existing behaviour's bound, and deep interior points into any end
the contract left open. **No probe here was chosen by looking at what a model got wrong** — which is
the reason the scale window's model ranking was nearly inverted.

## Controls, and one that changed my mind before the window opened

- every shape must pose a real precedence question (`overlap SATISFIABLE`)
- both renderings of a shape must plan **identically**
- **two legal realizations** must pass the contract probes, per shape — the anti-oracle property
- mutants must die: inverted, invented lower bound, off-by-one

**A surviving mutant is only a failure if it is actually wrong.** `if n <= 10` survives on `S_STRADDLE`
and the probe set is not at fault: the preserved guard `n > 5` already absorbs 6 through 10, so the
off-by-one is **unreachable** and the realization is genuinely correct. A dense semantic sweep — 605
inputs against the contract's own expectation — decides equivalence, so a legal realization is never
counted as a probe-set gap. Without that control I would have hunted a defect that does not exist, and
might have "fixed" the verifier into rejecting a correct answer.

## Models and cells

`qwen2.5-coder:1.5b` and `qwen2.5-coder:7b` — the two the mandate names as primary.
4 shapes x 2 renderings x 2 models x 20 samples = **320 generations.**

## Endpoints, kept separate

    proposal yield            authorized / samples
    authorization precision   verified / authorized      (verified = passes the CONTRACT probes)
    verification rate         verified / samples
    refusal topology, realization diversity, seconds per verified change

## Prediction, written before running

> **`S_STRADDLE` is the hardest shape** and will have the lowest verified rate of the four, because the
> overlap region is the one place a well-formed guard can silently take inputs the preserved behaviour
> must keep.
>
> **`RELATIONAL` beats `IMPLICIT`** on verified rate, replicating windows 9 and 10 on shapes those
> windows never saw. If it does not, the rendering rule is shape-specific and must be re-scoped.
>
> **Authorization precision stays high — above 0.9 — on all four shapes**, because the probes are
> derived from each shape's own contract rather than from failures observed on one of them. This is the
> claim most at risk: if precision collapses on the new shapes, contract-derived probes are catching
> more because there is more to catch, and the pipeline does not generalize as cleanly as windows 10
> and 11 suggested.
>
> **The 7B will not dominate.** Its compound-condition tendency is exactly what the new shapes punish.

**Falsified if** verified rates collapse on the three new shapes: that would make every earlier result
a property of one contract shape rather than of the architecture.

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, `min_containers` 0, AC confirmed, stop with
`--yes` and verify. **Rule 3** checks every model before any generation.
