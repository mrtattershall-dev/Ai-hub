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

---

# RESULT — T3: three-operation transactions, and the ablation it forced

GPU window stopped and verified: every `legasus` row `stopped`, 0 containers.

    model   case         op-yield   assembled   verified   P(c|assembled)   dead-op   probe-fail
    1.5B    T3_NESTED     0.850      12/20        12           1.000           0          0
    1.5B    T3_MIXED      0.867      13/20        13           1.000           0          0
    7B      both          1.000      20/20        20           1.000           0          0
    14B     both          1.000      20/20        20           1.000           0          0

    transaction yield   1.5B 0.625   7B 1.000   14B 1.000
    105 assembled, 105 verified — P(correct | assembled) = 1.000 at every capacity
    sec/verified        1.5B 5.1     7B 2.4     14B 4.4

`orderTransaction` derived `micro, low, mid` for the fully nested case and
`high, micro, low` for the mixed one, labelling the latter
`DERIVED_WITH_ENGINEERING_CHOICE`. `T3_UNDETERMINED` returned `UNDETERMINED`, named the blocking pair
`low/plus` and its witness input `n = 1`, and generated nothing.

**Transaction yield is operation yield cubed**, as the two-operation family was squared: the 1.5B
averaged 0.858 per operation and 0.858³ = 0.632 against 0.625 observed.

## My prediction is falsified, and the falsification is the finding

> *"The transaction verifier will fire at least once at 1.5B... This is the prediction I most want to
> be right about for the apparatus, because a verifier with no live catch is a verifier with no live
> evidence."*

It did not fire. And the raw artifacts say why, unambiguously:

    343 authorized fragments.  ZERO with a domain other than the one requested.

    micro   requested n < 0     114x `n < 0`
    low     requested n < 10     85x `n < 10 and n != 3`,  29x `n < 10`
    mid     requested n < 100    36x `n < 100 and n != 3`, 21x `n < 100`
    high    requested n > 100    58x `n > 100`

Three nested "below X" deltas with different thresholds, three capacities, and not one threshold
confusion. The only refusals were `returned a function` (16) and `repeated a fixed line` (1).

**When `RENDER` states the domain and `CONSTRAIN` bounds the fragment, the model does not get the
domain wrong.** That is a result about the architecture, not about the models — and it is exactly why
the verifier has nothing to catch.

## The preregistered branch, followed

> *"Also notable if the verifier again never fires. That would mean the live-evidence gap must be
> closed by a family that is harder in a different way rather than merely longer."*

The different way is not a harder task. It is an **ablation**. A perfect score cannot distinguish two
very different claims:

    A   the ordering is doing real work, and the verifier is a safety net that correctly never fires
    B   the ordering is decoration; these transactions would have been fine in any order

So the same model outputs — already on disk, no GPU time — were re-assembled in **presentation order**
instead of the derived order and re-verified. Same fragments, same verifier, same probes, one stage
disabled.

    case        derived order              presented order            DERIVED   PRESENTED
    T3_NESTED   micro then low then mid    mid then micro then low     52/52       0/52
    T3_MIXED    high then micro then low   low then high then micro    53/53       0/53

    TOTAL                                                            105/105       0/105

    operations killed by the presentation order:  micro x52, low x52, micro x53

**Total separation.** Every transaction verified under the derived order; **not one** verified under
the presented order, and every failure is a *dead operation* — an operation that can never fire,
named. Reading B is dead: without `DECIDE`'s ordering these transactions are wrong 105 times out of
105, and they are wrong in the specific way `ordering.mjs` exists to prevent.

> The transaction verifier's silence in the main arms is now evidence **for** the architecture rather
> than an absence of evidence about it. It fires exactly where the ordering is removed and nowhere
> else.

## What this changes

1. **`DECIDE`'s ordering is load-bearing and now measured as such.** 105 against 0 is the largest
   separation this project has produced, and it required no additional generation.
2. **The verifier has its live catch**, and the shape of the catch is the one the unit tests predicted:
   dead operations, not probe failures. The fragments were always individually correct; the
   composition was not.
3. **An ablation is now a standard instrument here.** Every component claimed to be load-bearing can be
   disabled on recorded artifacts and re-verified at zero cost. `CONSTRAIN` and `RENDER` have both had
   their value shown by accident — an envelope defect suppressing yield, a rendering phrase moving
   precision — but never by deliberate ablation.

## Honest limits

- The ablation substitutes *presentation order* for the derivation. That is the most likely naive
  alternative, not the worst case; a system that ordered randomly would sometimes be right.
- Both generating cases had a fully or partly nested structure, which is where ordering matters most.
  A family of mostly-disjoint operations would show a much smaller ablation effect, correctly.
- 343 fragments with zero domain errors is a statement about *this* rendering and *this* envelope. It
  does not establish that models never make domain errors; it establishes that they did not make any
  here.
