# The evidence relation — the object A3 would have to consume (2026-09-21)

**This is not A3, and not a design for A3.** It is the relation structure the experiments have
forced into view. Every element below is earned by a named experiment in this branch; nothing is
included because it completes a diagram. A3 is deliberately not written: building it before
these relations are explicit is how the next hidden assumption gets encoded, and the external
world has found the last two.

## The claim form

    adequate(W)                                   NOT well-formed
    discriminates(W, P, C, I)  and  realizes(I, C) well-formed

A witness discriminates a **proposition** from a **contrast** under an **intervention**, and the
intervention must be shown to realize that contrast. Both relations are required; either alone
licenses nothing.

## The seven elements, each with the experiment that forced it

| element | what it is | forced by |
|---|---|---|
| **PROPOSITION** `P` | the claim being made, stated so a contrast is possible | SCREEN-2: "M was served" is not "M was supplied to an evaluation" — the second admits contrasts the first hides |
| **CONTRAST CLASS** `C` | the ways `P` can be false **or unestablished** — not just false | D1–D4: the state space is SUPPORTED / UNSUPPORTED / **UNVERIFIABLE**, and the third is neither true nor false |
| **WITNESS** `W` | the observation offered as support for `P` | W-experiment: T1 and T2 are both real project tests; one supports `P`, the other does not |
| **INTERVENTION** `I` | what is done to produce a member of `C` | W1 (force `truetype` to raise), W2 (force every glyph absent) |
| **INTERVENTION WITNESS** | evidence that `I` **actually produced** the contrast it claims | the U+E000 failure: the intervention was believed to produce UNSUPPORTED and produced an *empty sample* instead. D4's positive control caught it |
| **OBSERVATION BOUNDARY** | what the channel carrying `W` can distinguish at all | T1 inherits the API's collapse — the producer maps UNVERIFIABLE onto the same `True` as SUPPORTED, so no assertion over that return value can separate them |
| **TRUSTED PRIMITIVES** | where the regress is declared to stop | every experiment here already declares it: PIL and `unicodedata` **real**, 12 modules **stubbed**, `loguru` a **recorder**, the target pinned to a sealed SHA, the detector pinned to four SHA-256 digests |

## The recursion, and why it terminates by declaration rather than by proof

Each layer needs the layer below:

    P needs W
    W's adequacy needs C and I
    I's validity needs an intervention witness
    the intervention witness needs its own provenance and discrimination

This does **not** regress infinitely in practice — it terminates wherever trust is **declared**.
Every experiment in this branch already did that, implicitly. The finding is that the
declaration should be **explicit and carried with the claim**, because an undeclared trust
boundary is indistinguishable from an unnoticed assumption. That is the same failure this whole
sequence keeps finding, one level up.

## What the U+E000 episode actually demonstrated

It is the sharpest specimen in the branch for the intervention-witness element, because the
failure was symmetric with the phenomenon under study:

    intervention intended to produce  UNSUPPORTED
    intervention actually produced    empty sample -> early True
    witness observed                  no warning
    naive reading                     "suppression demonstrated"

Without a positive control, *"the witness survived the intervention"* is ambiguous between **the
witness cannot discriminate** and **the intervention never produced the contrast**. Those are
different findings with different consequences, and only the positive control separates them.

> **A negative observation has evidentiary value only if the apparatus demonstrates that the
> contrasting positive observation was reachable.**

## The three sentences this branch has earned

> Non-exceptional execution is not evidence of successful execution. *(SCREEN-2)*
>
> Passing evidence is not necessarily discriminating evidence. *(W-experiment)*
>
> A witness cannot recover distinctions already erased by its observation boundary. *(T1)*

## What is NOT established here

- **That these seven elements are complete.** They are what four experiments forced into view.
- **That this decomposition is correct.** It has not been attacked. Under this branch's own
  standard it is a retrospective organisation of findings, and it earns standing only by
  predicting a failure it was not built to explain.
- **That any of it should be implemented.** No type, state, field or interface follows from this
  document.

## The next experiment this suggests, and it is an attack on the decomposition itself

Construct a case where all seven elements are present and explicitly satisfied, and the
resulting entitlement is *still* wrong. If that case exists, the decomposition is incomplete and
the missing element is the finding. If repeated attempts fail to construct one, the decomposition
starts to earn its place — but not before.
