# PREREGISTRATION — which part of the sibling information causes DOMAIN COLLAPSE?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Where this comes from

Naming a sibling operation's domain made the wider operation **replace its own domain with the
sibling's**: 0/232 to 127/239, `p = 4.0e-48`, confined to operations that actually contain a sibling
(0/479 elsewhere). `P(correct | assembled)` fell from 1.000 to as low as 0.050.

That result says a rendering can be actively harmful. It does not say **what about it** is harmful, and
the two candidate answers imply opposite design rules:

    the AMBIGUITY is harmful    -> RENDER must never state a fact without stating its resolution
    the INFORMATION is harmful  -> RENDER must state each operation in isolation, full stop

## The ladder

One axis, four levels, increasing in what is said about the siblings:

    ISOLATED           nothing about siblings                    replication control
    SIBLING_EXISTS     they exist; NO domains named              separates existence from domain
    SIBLING_NAMED      their domains named; no resolution        replication of the collapse
    SIBLING_RESOLVED   their domains named AND resolved          the repair test

`SIBLING_EXISTS` is the control that makes the diagnosis possible. If the collapse needs a specific
domain to copy, this level cannot produce it. If it collapses anyway, then merely mentioning that other
work exists destabilizes an operation's contract, which would be a larger and more uncomfortable finding
than the original.

`SIBLING_RESOLVED` deliberately hands over `DECIDE`'s **conclusion**, which the previous family withheld.
That is not a repeat of the substitutability question — that question was asked and answered badly. It
asks a different one: **is the damage repairable by rendering at all?**

## Hypothesis

> `DOMAIN COLLAPSE` is caused by an unresolved ambiguity, not by the presence of sibling information. An
> operation told that a narrower behaviour overlaps its own domain, and not told how that is resolved,
> has no way to choose between narrowing itself, excluding the other, and doing nothing — and resolves it
> by copying its neighbour.

## Predictions

    level               collapse rate        P(correct | assembled)
    ISOLATED                 ~0                    ~1.000
    SIBLING_EXISTS           ~0                    ~1.000
    SIBLING_NAMED         ~50% (replicates)     degraded, as low as ~0.05
    SIBLING_RESOLVED      substantially below SIBLING_NAMED, correctness restored toward 1.000

**Primary endpoint.** Collapse rate — `ADOPTED / guards whose own domain contains a sibling` — across the
four levels, with `ISOLATED` and `SIBLING_NAMED` replicating the previous family within this run.

**Secondary.** `P(correct | assembled)` under `DECIDE ON` across the four levels.

**Guardrail, and it is a hard one.** `LEAKED` must remain **0** in every condition. The previous family
found 110 wrong contracts and leaked none; if a rendering ever produces a wrong contract that passes
verification, that is the most important line in the table regardless of what the collapse rates do.

## Falsification

- **If `SIBLING_RESOLVED` collapses at a rate similar to `SIBLING_NAMED`**, the ambiguity hypothesis is
  false: sibling information is harmful in itself and cannot be repaired by resolving it. The rendering
  rule becomes the stricter one.
- **If `SIBLING_EXISTS` collapses**, the effect does not require a domain to copy, and the mechanism I
  named is wrong.
- **If `SIBLING_NAMED` does not replicate**, the effect is not stable and nothing here can be concluded.
- **If any condition leaks**, the architecture's central separation has a hole and that supersedes this
  family's question entirely.

## What each outcome licenses

This family exists to produce a **measured rendering rule**, in the same form as `EXTENT` vs `SILENT`.
Both outcomes give one, and they are incompatible, which is what makes it worth running.

## Controls, witnessed before any tokens were spent

    E0   prompts differing between conditions 3/3   derived order unchanged [fifty high micro]
    E1   prompts differing between conditions 3/3   derived order unchanged [high micro low]
    E2   prompts differing between conditions 3/3   derived order unchanged [five micro low]
    E3   prompts differing between conditions 3/3   derived order unchanged [micro low mid]

All **four** levels are asserted pairwise distinct for every operation — checking only two would let a
level that silently renders the same text as its neighbour be counted as a separate condition. Both
naming levels are asserted to name every sibling, and `SIBLING_EXISTS` is asserted to name **none** of
them, or it cannot separate existence from domain. The plan is asserted unchanged across levels, so the
family varies one thing.

The ablation instrument still registers PASS at 0 violated edges and FAIL at 1, 2 and 3 on perfect
fragments, and the rescue path is still proven to exist at all three doses.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    conditions   ISOLATED, SIBLING_EXISTS, SIBLING_NAMED, SIBLING_RESOLVED
    samples      20 transactions per case per condition per model
    temperature  0.6
    cases        E0, E1, E2, E3 generate; UND refuses
