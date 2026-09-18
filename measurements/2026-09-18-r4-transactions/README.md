# PREREGISTRATION — R4: multi-operation transactions

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## The question

> **Can Legasus preserve correctness when two individually valid operations interact, and their
> relationship decides whether the combined program is right?**

Every family so far has had one operation. `R4` has been deferred four times — for want of a family,
not machinery. `legacore/ordering.mjs` and `legaverify/transaction.mjs` are that machinery, each with
its own controls, both landed before this preregistration.

## The design that makes this a test of the architecture, not of the model

**Each operation is proposed in isolation.** The model is asked for one bounded fragment, is never
shown the other operation, and cannot know what order they will appear in. A control asserts each
prompt never contains the other operation's result literal.

Every bit of the composition is Legasus's contribution. A correct combined program is attributable to
`DECIDE`; so is a wrong one.

## The four transaction shapes

    T_CONTAIN       small (n < 10) and tiny (n < 0)       tiny strictly inside -> ORDERED, tiny first
    T_REVERSE       the same pair, PRESENTED reversed     the order must not change
    T_DISJOINT      tiny (n < 0) and big (n > 100)        both orders legal -> ENGINEERING_CHOICE
    T_UNDETERMINED  small (n < 10) and positive (n > 0)   intersecting without containment -> NO
                                                          GENERATION; Legasus declares instead

`T_UNDETERMINED` is in the family precisely because **the right behaviour there is to refuse.** It is
asserted in the controls and never sent to a model, recorded rather than quietly skipped.

## The defect this family exists to catch

Two guards, each a perfect realization of its own obligation, composing into a program that loads,
reads plausibly, contains every requested predicate and result, and **silently never produces one of
the two behaviours**:

    if n < 10:  return "low"       each fragment is correct
    if n < 0:   return "micro"     the second is now DEAD CODE

`transaction.test.mjs` proves a fragment-level checker passes that program and the transaction probes
do not.

## Controls, all passing before this was committed

- every case's order status matches what `ordering.mjs` must derive — `ORDERED`, `DISJOINT`,
  `UNDETERMINED` — and `T_CONTAIN`/`T_REVERSE` derive the **same** order from opposite presentations
- each prompt is **isolated** from the other operation
- leakage and sufficiency per prompt
- **both** realizations of each operation verify as a transaction — the anti-oracle property
- **the reversed composition FAILS where ordering is derived and PASSES where both orders are legal**

Two control failures were caught before any GPU spend and both were real. The result words collided
with an extent phrase (`"small"` inside *"however small"*), which was a false positive in the isolation
control and a genuine design smell; results are now `low`, `micro`, `high`, `plus`, none a substring of
another. And `T_UNDETERMINED` was built from `n < 10` against `n > 100`, which is **disjoint** — the
case was not testing what it claimed. It now uses `n > 0`.

## Endpoints, kept separate

    operation yield              authorized fragments / fragments requested
    transaction yield            transactions where BOTH operations were authorized
    P(correct | assembled)       transaction probes pass AND every operation is reachable
    dead-operation count         an operation that can never fire, named
    probe-failure count          the program answers wrongly somewhere
    seconds per verified transaction

## Prediction, written before running

> **`T_CONTAIN` and `T_REVERSE` will be indistinguishable.** The order is derived from the domains, so
> presentation order must not matter. If they differ, `DECIDE` is reading something it should not.
>
> **`P(correct | assembled)` will be high and roughly flat across models**, because the composition is
> entirely Legasus's and the model's residual job is the same bounded fragment it already does well.
> This is the architectural claim; a drop with capacity would mean transaction correctness leaks back
> into the model.
>
> **Transaction yield will be lower than single-operation yield**, mechanically: a transaction needs
> both fragments authorized, so at a per-operation yield of *y* it is roughly *y²*.
>
> **Dead operations will be zero.** The order is derived to prevent exactly that, and a non-zero count
> would mean `ordering.mjs` is deriving an order its own reachability check disagrees with.

**Falsified if `T_CONTAIN` and `T_REVERSE` differ**, or if dead operations appear at all.

**The most consequential failure available:** `P(correct | assembled)` falling with capacity. That
would mean multi-operation correctness is not purely architectural, and the single-operation result
does not extend.

## Models and power

1.5B, 7B, 14B — the contract is identical across sizes. 3 cases x 2 operations x 20 samples x 3 models
= **360 generations.**

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, AC confirmed, stop with `--yes` and verify.
**Rule 3** checks every model before any generation.
