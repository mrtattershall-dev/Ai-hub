# Shadow wiring result — W-1..W-6 pass, and the run exposed a defect in the scope lattice
2026-09-21. Preregistration `SHADOW-WIRING_PREREG.md`, frozen before the run.
Raw: `legasus/out/hadmission/shadow_wiring.json`. Nothing downstream consumes the certificate; no
detector modified; the `legaknow` worktree was not written to.

## Outcomes

    W-1  DETECTOR INVARIANCE   PASS   60 candidates before, 60 after, identical
    W-2  ANTI-REFUSAL          PASS   the fully supported claim is mintable
    W-3  MONOTONIC NARROWING   PASS, but see below - one step was inert
    W-4  NO SILENT DROP        PASS   every refusal yielded a narrower claim or a frontier
    W-5  NO CAUSAL LABELLING   PASS   no cause field reaches the certificate
    W-6  FALSIFIER LIVE        PASS   a wrong conclusion passing all gates surfaces as
                                      CANDIDATE MISSING GATE

## The degradation chain

    E0  full record                     PPP   UNIVERSAL @ SAMPLE        rank (3,1)
    E1  reachability evidence removed   PPP   UNIVERSAL @ SAMPLE        rank (3,1)   <- INERT
    E2  positive control removed        PPF   OBSERVATIONAL @ THIS_RUN  rank (0,0)
    E3  a required premise opened       PFF   OBSERVATIONAL @ THIS_RUN  rank (0,0)

Authority never increased. But **E1 moved nothing**, so W-3 was exercised by two steps, not three.
By this branch's own rule an unexercised step is not a confirmation.

## The defect the shadow run exposed, which is the point of shadow mode

    frozen lattice: THIS_RUN, SAMPLE, FUNCTION_PARAMETER, FUNCTION, MODULE, PROGRAM, REPOSITORY, WORLD
    rank(SAMPLE) = 1        rank(FUNCTION) = 3

So a `SAMPLE` claim backed by `FUNCTION` evidence **passes** the obligation gate, because SAMPLE is
ranked narrower than FUNCTION. That is wrong. A 60-case sample drawn across a repository is broader
than a single function, not narrower.

> **The lattice conflates two independent dimensions.**
>
>     structural scope   function -> module -> program -> repository
>     sampling breadth   this run -> sample -> exhaustive
>
> A single linear order over both cannot express "broad structurally, narrow in coverage", which is
> exactly what a sampled result is.

This is the same error class the branch has been cataloguing all day: two distinct dimensions
projected onto one axis, producing a comparison that silently succeeds. It is now **inside the
entitlement gates themselves**.

**Not repaired here.** Fixing it means making scope two-dimensional, which changes the obligation
gate's semantics and needs its own evidence. Repairing it after seeing the result would also be the
retroactive repair this branch forbids. It is recorded as a defect with a reproduction.

## What the run does and does not license

**Licensed:** the boundary can sit between the screener and authority without touching detection,
it preserves a fully supported claim, it never strengthens a claim as evidence is removed on the
two steps that moved, it never drops a refusal silently, and it never emits a cause.

**Not licensed:** that the gates are ready for production wiring. The obligation gate has a
demonstrated defect in its scope comparison, and the monotonicity chain exercised only two of three
degradation steps.

## The connection to `legaknow`, and why it is not made here

`legaknow/monotonicity.mjs` already states the law this bridge would serve:

> *"AUTHORITY CANNOT BE CREATED BY DESTROYING INFORMATION."*
> *"A transformation may discard information only if the discarded distinction cannot change
> downstream entitlement."*

Its header records four defects of the same false-merge family this session rediscovered from the
other direction, including that *"the downstream reasoning was CORRECT and the conclusion was
unjustified"* — the site #7 shape.

`legaknow` is JavaScript on branch `fix-tolerant-indent`; `legasus/screen` is Python on
`fix/unverified-finish-recorded`. **They do not coexist on any branch, and merging them is tatte's
decision.** The certificate is the interface that would connect them, and it is emitted but consumed
by nothing.

## Status

Shadow only. `reach1.py` and `hadmission.py` unchanged. Census sites #7 and #10 still unrepaired.
The scope-lattice defect is now a third recorded specimen, found by running the architecture rather
than by reasoning about it.
