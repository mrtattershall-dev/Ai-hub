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

---

# RESULT — four contract shapes

All controls passed, including the dense-equivalence control. GPU window stopped and verified: every
`legasus` app row `stopped`, containers 0.

                        1.5B                          7B
    shape/render    auth  ver  P(c|auth)       auth  ver  P(c|auth)
    S_UPPER/IMP      13   13     1.00           19   17     0.89
    S_UPPER/REL      17   17     1.00           19   17     0.89
    S_LOWER/IMP      10   10     1.00           17   16     0.94
    S_LOWER/REL      17   17     1.00           20   11     0.55
    S_IVAL/IMP       14   14     1.00           19   19     1.00
    S_IVAL/REL       11   11     1.00           20   20     1.00
    S_STRADDLE/IMP    8    8     1.00            7    3     0.43
    S_STRADDLE/REL    8    8     1.00           12   12     1.00

    proposal yield            1.5B 0.613   7B 0.831    p = 1.9e-5
    authorization precision   1.5B 98/98 = 1.000 [0.962, 1.000]
                              7B 115/133 = 0.865 [0.796, 0.913]    p = 3.1e-5
    verification rate         1.5B 0.613   7B 0.719    p = 0.058, not significant

## The pipeline holds perfectly at 1.5B on shapes it was never developed against

**98 authorized outputs, 98 verified**, across all four shapes and both renderings. Three of those
shapes — an unbounded-above requested domain, a preserved interval strictly inside, and partial
overlap on both sides — did not exist when any of this machinery was built, and their probes were
generated from their own contracts rather than written by hand.

## Every 7B leak is an invented bound, and the contract probes caught all 18

    S_UPPER/IMP     1 < n < 10  and  10 > n >= 3          caught at n = -999990
    S_UPPER/REL     10 > n > 3   x2                       caught at n = -999990
    S_LOWER/IMP     100 < n <= 200                        caught at n = 201
    S_LOWER/REL     100 < n < 200   x9                    caught at n = 201
    S_STRADDLE/IMP  n >= 5 and n < 10  x2, n >= 0, n >= 10    caught at n = -999990

**Eighteen of eighteen.** Not one is a malformed guard or a misread threshold: every one invents a
bound the contract never stated — a lower bound on an unbounded-below domain, or an upper bound on an
unbounded-above one — and the deep-interior probes exist precisely because the contract left that end
open.

> This is the first time the contract-derived probes have faced a model's error class on shapes the
> generator had never been run against. They caught all of it, at inputs no hand-built probe set would
> plausibly have contained.

`S_LOWER/RELATIONAL` at 7B is the sharpest single cell: **20/20 authorized, 11 verified**. Maximum
proposal yield, and all nine failures are the same invented upper bound — the model reading
*"except 200"* as *"up to 200"*.

## Predictions, scored

**CONFIRMED — `S_STRADDLE` is the hardest shape.** 31/80 against 190/240 for the other three,
p = 6.7e-11, and lowest for *both* models independently. Partial overlap on both sides is genuinely
harder than containment in either direction.

**FALSIFIED — `RELATIONAL` does not beat `IMPLICIT` here.** 113/160 against 100/160, p = 0.155. Not
significant, reversed on `S_LOWER` at 7B (11 against 16), and the worst cell in the family is a
`RELATIONAL` one.

What this does **not** settle: window 10 measured **exclusion-predicate emission** and this measures
**verified rate** — different endpoints. And the interval-exclusion phrasings, *"n is not below 0"* and
*"n is not above 5"*, are clumsier than the value-naming sentences they were derived from. Whether the
rule fails on these shapes or these particular sentences are poor is **not separable in this design**,
and is recorded as open rather than resolved in either direction.

**HALF FALSIFIED — authorization precision above 0.9 on all four shapes.** Perfect at 1.5B; 0.865 at
7B with two cells at 0.55 and 0.43. The scale window's finding reproducing on shapes it never saw:
capacity buys proposal yield and spends authorization precision.

## What this changes

1. **The architecture generalizes across contract shape at 1.5B.** 98/98 on unfamiliar shapes with
   machine-generated probes is the strongest single result in the project.
2. **Contract-derived verification is validated against a real, unanticipated error class.** The
   invented-bound family is exactly what a regression-derived probe set would have missed here, because
   no model had produced it on these shapes before.
3. **The rendering rules are scoped, not universal** — established on value-exclusion contracts, they
   do not carry to interval-exclusion contracts as a verified-rate effect. That is a limit on the
   claim, and belongs in `LEGASUS.md` as one.
4. The 7B's single failure mode being *invented bounds* suggests a `RENDER` experiment this design
   cannot run: does stating the open end explicitly — "there is no lower bound" — reduce it, or, as the
   `FMT_BOUND` result warns, make it worse?
