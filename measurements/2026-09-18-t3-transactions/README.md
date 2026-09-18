# PREREGISTRATION — T3: three-operation transactions

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why three, and why now

R4 passed at two operations with **zero probe failures and zero dead operations** — and its honest
limit was that the transaction verifier therefore had **no live catch**. Within a two-operation family
the composition can only go wrong if the ordering goes wrong, and Legasus owns ordering, so it cannot.

An individually authorized fragment can break a transaction by exactly one route: **having a different
domain than the one requested.** If `tiny` had come back as `n < 100` instead of `n < 0`, it would
contain `small`, and the derived order would make `small` dead. No model produced such a fragment —
`tiny` was `n < 0` in 175 of 180 requests.

**Three nested "below X" deltas with different thresholds raise that chance on purpose**, and not
merely by being harder: a model confusing two thresholds produces a fragment that is well-formed,
authorized, and *changes the containment relation*. If the transaction verifier is ever going to fire
in anger, it is here.

    T3_NESTED        micro (n<0), low (n<10), mid (n<100)    fully nested -> one derivable order
    T3_MIXED         micro (n<0), low (n<10), high (n>100)   partly ordered, one ENGINEERING CHOICE
    T3_UNDETERMINED  micro (n<0), low (n<10), plus (n>0)     one intersecting pair -> NO GENERATION

## What is new in DECIDE, and what it refuses

`orderTransaction` builds the containment partial order and topologically sorts it. Where operations
tie — incomparable and disjoint — the tie is recorded as `DERIVED_WITH_ENGINEERING_CHOICE` rather than
silently resolved. **One undetermined pair poisons the whole transaction**, deliberately: shipping the
determinable part would be a different change from the one requested, chosen by the apparatus.

Nineteen witnesses on `ordering.mjs`, including negative controls that a sorter returning presentation
order fails the nested case and a sorter that never declines fails the undetermined case.

## Controls, all passing before this was committed

- `T3_NESTED` derives `micro, low, mid` and is independent of presentation order
- `T3_MIXED` satisfies every **derived** constraint; the full total order is **not** asserted, because
  demanding one would be asserting an engineering choice as a derivation
- `T3_UNDETERMINED` returns `UNDETERMINED` and names the blocking pair and its witness input
- each prompt is isolated from the other two operations
- both realizations of every operation verify as a transaction
- the reversed composition fails where the order is fully `DERIVED`

## Prediction, written before running

> **`T3_NESTED` will have the lowest transaction yield of the three**, because it needs three
> authorized fragments rather than two, and yield is roughly per-operation yield cubed.
>
> **`P(correct | assembled)` stays at 1.000 for 7B and 14B.** This is R4's architectural claim at a
> harder setting.
>
> **The transaction verifier will fire at least once at 1.5B** — a wrong threshold on `mid` or `low`
> is the most likely fragment error in this family, and it produces a containment change rather than a
> local mistake. This is the prediction I most want to be right about for the *apparatus*, because a
> verifier with no live catch is a verifier with no live evidence.
>
> **Dead operations will be non-zero if and only if a fragment's domain differs from the requested
> one.** Legasus's own ordering cannot produce one.

**Falsified if `P(correct | assembled)` drops at 7B or 14B** — transaction correctness would not be
purely architectural at three operations.

**Also notable if the verifier again never fires.** That would mean the models simply do not make
domain errors at this scale of task, and the live-evidence gap must be closed by a family that is
harder in a different way rather than merely longer.

## Models and power

1.5B, 7B, 14B, identical contract. 2 generating cases x (3 + 3) operations x 20 samples x 3 models =
**360 generations.**

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, AC confirmed, stop with `--yes` and verify.
**Rule 3** checks every model before any generation.
