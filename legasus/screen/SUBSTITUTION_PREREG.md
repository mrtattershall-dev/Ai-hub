# Shadow substitution — new obligation compiler in the shadow path only
Frozen 2026-09-21, before the substitution was run. **No merge. No production wiring.**

The old `entitlement.gate_obligation` stays untouched as the historical specimen. The new
`obligation.py` compiler replaces it **only** inside the shadow path, and the entire shadow suite is
re-run — not just the five Q cases.

## Acceptance bar, frozen before the run

    A1  candidate generation identical, count for count
    A2  every previously legitimate claim remains mintable
    A3  every previously demonstrated O failure remains refused or narrowed
    A4  Q-5 remains live - removing membership evidence still narrows the licensed claim
    A5  removing evidence never strengthens the licensed claim
    A6  the two multi-gate cases retain their COMPLETE vectors
    A7  the falsifier still surfaces a wrong all-pass conclusion as a missing-gate candidate
    A8  no upward reformulation

## A8 is the subtle one and the reason this could fail

A compiler that derives obligations from claim semantics can accidentally become a **claim
generator**. That would put semantic authority back inside O, which is the thing being removed.

    O answers        what must be true for THIS requested claim?
    O must not answer  what claim should we want?

Downward narrowing is **restriction** and is permitted, because it can only weaken. **Upward
reformulation is forbidden without new evidence**, even when the compiler can see a different
logical formulation that the same evidence would satisfy.

    FALSIFIER: the compiler emits any claim stronger than the one requested, on any input.

Strength is compared on the claim's own terms — a claim over a domain containing the requested
domain, or a quantifier strictly stronger than the requested one, is upward.

## Mapping from the old evidence record, fixed before running

    old form ABSENCE      -> NONE
    old form UNIVERSAL    -> FOR_ALL
    old form EXISTENTIAL  -> EXISTS
    old DISTINCTION/IDENTITY -> POINTWISE

    observations carry membership established in the EVIDENCE scope only
    coverage of a domain is EXHAUSTIVE only when the evidence scope IS that domain and
    examined >= domain_size; otherwise UNKNOWN

That mapping is what makes the previously inert `E1` step live: moving the evidence scope from
`SAMPLE` to `FUNCTION` leaves coverage of `SAMPLE` `UNKNOWN`, so the universal over `SAMPLE` can no
longer be discharged.

## Disposition

    all eight hold      the replacement may be proposed for an integration branch and ONE
                        authority-bearing consumer. Still not merged by me.
    A2 fails            the replacement is a refusal machine and is worse than the defect
    A8 fails            O has become a claim generator; the replacement is abandoned
    any other fails     reported, not patched around

## Rules

`entitlement.py`, `reach1.py`, `hadmission.py` unchanged. The `legaknow` worktree is not written to.
Nothing is merged. The certificate remains an **application for authority**, never authority: no
`authority: true`, no `root_cause`, and no field that lets the producer declare its own standing.
