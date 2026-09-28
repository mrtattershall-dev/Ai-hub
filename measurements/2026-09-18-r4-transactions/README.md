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

---

# RESULT — R4: multi-operation transactions

GPU window stopped and verified: one `legasus` row, `stopped`, 0 containers.

    model   case          op-yield   assembled   verified   P(correct|assembled)   dead-op   probe-fail
    1.5B    T_CONTAIN      0.775      13/20        13             1.000              0          0
    1.5B    T_REVERSE      0.825      13/20        13             1.000              0          0
    1.5B    T_DISJOINT     0.900      16/20        16             1.000              0          0
    7B      all three      1.000      20/20        20             1.000              0          0
    14B     all three      1.000      20/20        20             1.000              0          0

    transaction yield    1.5B 0.700    7B 1.000    14B 1.000
    P(correct|assembled) 162 assembled, 162 verified — 1.0000 at every capacity
    sec/verified         1.5B 6.5      7B 2.5      14B 3.7

## Every prediction confirmed, including the one that could have broken the architecture

**`T_CONTAIN` and `T_REVERSE` are indistinguishable** — 13/13, 20/20, 20/20 at each capacity. The order
is derived from the domains; presentation order does not reach `DECIDE`.

**`P(correct | assembled)` is 1.000 and flat across capacity.** This was the architectural claim and
the most consequential thing that could have failed: a drop with capacity would have meant transaction
correctness leaks back into the model. It does not. **Every transaction Legasus assembled was correct,
at every model size, with the model never having seen the other operation.**

**Dead operations: zero, everywhere.** `ordering.mjs` and its reachability check agree.

**Transaction yield is the square of operation yield**, as predicted mechanically: the 1.5B averaged
0.833 per operation, and 0.833² = 0.694 against 0.700 observed. Capacity buys transaction yield exactly
by buying operation yield, and nothing else.

## What the raw artifacts show that the summary does not

**The anti-oracle property held live, not only in controls.** The `small` operation was realized two
different ways — `n < 10` 34 times and `n < 10 and n != 3` 75 times — and **both were assembled and
both verified**. A verifier scoring reference-form similarity would have rejected 34 correct
transactions or 75 of them, depending which form it had been taught.

**`CONSTRAIN` refused the model's actual failure mode.** Sixteen outputs echoed the preserved guard —
`if n == 3:` — and every one was refused as *repeated a fixed line*. That is the whole shortfall in the
1.5B's operation yield, and it is the envelope doing its job rather than a semantic failure reaching
the verifier.

## The honest limit, and it is the important one

**The transaction probes never fired in anger.** 162 assembled, 162 verified, zero probe failures and
zero dead operations. They are proven by their own unit tests — which demonstrate a fragment-level
checker passes the broken composition and they do not — but in this family they have **no live catch**.

The reason is structural rather than lucky: the composition can only go wrong if the *ordering* goes
wrong, and Legasus owns ordering, so within this family it cannot. A fragment that is individually
authorized can still break a transaction only by having a **different domain than the one requested** —
if `tiny` came back as `n < 100` instead of `n < 0`, it would contain `small`, and the derived order
would make `small` dead. No model produced such a fragment here: `tiny` was `n < 0` 175 times out of
180, `big` was `n > 100` 57 out of 60.

> A perfect score on this family is a statement about *this* family. The verifier that would catch the
> interesting failure has not yet had to.

## Other limits

- Two operations. Both insert at the same point.
- Only the easy ordering relations were generated. `T_UNDETERMINED` is correctly refused and therefore
  contributes no generation data — by design, and it means the refusal path has no live exercise either.
- `tiny` and `big` were essentially monolithic realizations; diversity lived entirely in `small`.

## What this changes

1. **Multi-operation correctness is architectural, in this family.** Every assembled transaction was
   correct at every capacity, and the model could not have known the composition.
2. **The next gate is operation count**, and the reason is the limit above rather than a wish for
   difficulty: three operations give more ordering relations, more chances for a model-produced domain
   to differ from the requested one, and the first realistic opportunity for the transaction verifier
   to catch something live.
3. `sec/verified` is now a usable number: 2.5 at 7B against 6.5 at 1.5B. The 7B is **cheaper per
   verified transaction** than the 1.5B despite being larger, because the 1.5B's refusals are wasted
   generations.
