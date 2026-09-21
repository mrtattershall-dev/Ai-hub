# Stage B protocol — H-INFO against a naturally occurring case (frozen 2026-09-21)

Stage A falsified H-RICH on an author-built construction and established nothing against
tautology. Stage B exists to give H-INFO a chance to be **wrong about a case nobody built for
it**.

## The independent entitlement criterion — the crux, frozen first

If entitlement is defined as recoverability, H-INFO is true by construction. So entitlement is
defined through a **different channel** from `R`:

> **Entitlement to `P` is WRONG** when the downstream decision takes the `P`-branch while a
> **direct measurement of the underlying state**, obtained without passing through `R`, says
> `¬P`.

The direct measurement is the independent channel. It is not derived from `R`, it is not the
witness, and it is not H-INFO's recoverability test. This is what makes the prediction
falsifiable: H-INFO could be right about the partition and still fail to predict where the
independent criterion says entitlement went wrong.

## What is frozen before any diagnosis

For each case, and committed before its source is read for semantics:

    P   the proposition the downstream decision depends on
    R   the representation ACTUALLY available to that decision (not the richest available
        anywhere in the program - what the decision consumes)
    E   the independent entitlement criterion above, instantiated for this case
    D   the direct measurement channel, named, and shown not to pass through R

## Mechanical case selection — no browsing

Cases are selected by an AST rule frozen here, applied to a **freshly selected** external Python
repository chosen by the same digest rule used at 65da312 (and excluding both prior targets):

    CANDIDATE DECISION  an `if` whose test contains a call to a project-local function whose
                        return value is not stored, and whose body performs a user-visible or
                        control-flow action (raise, return, log at warning/error, or a call whose
                        name contains warn/error/abort/skip/fallback)
    RANKING             file-path order, never interestingness
    CASE                the first N=3 candidates, plus for each, the called function's own
                        return-state space obtained by reading ONLY that function

The three cases are then diagnosed. **The selection rule may not be amended after seeing what it
selects.**

## Predictions

**B1.** For each selected case, H-INFO predicts *wrong entitlement is possible* **iff** the
called function's state space contains two states `s1, s2` with `R(s1) = R(s2)` and
`P(s1) ≠ P(s2)`. Where no such pair exists, H-INFO predicts no information-loss failure.

**B2 (the paired case, and the strongest available outcome).** At least one selected case has a
collision and at least one does not. If the independent criterion finds wrong entitlement in the
colliding case(s) and not in the non-colliding one(s), H-INFO predicted a difference it was not
built around.

**B3 (competing accounts must be named and must fail).** For any case where H-INFO predicts
failure, these shallower accounts are evaluated on the same case and must NOT predict it:

    output cardinality   the representation has few distinct values
    exception handling   the failure involves an except branch
    boolean polarity     the representation is a bool whose truthy sense is inverted
    test structure       the project's tests assert in only one direction

If any of them predicts the same failures as H-INFO on these cases, **H-INFO is not
discriminated** and the result says so.

## Dispositions

    collision present AND independent criterion finds wrong entitlement, shallower
    accounts silent                                  H-INFO discriminated on a natural case
    collision present AND no wrong entitlement       H-INFO over-predicts; necessary-condition
                                                     form survives, predictive form does not
    wrong entitlement WITHOUT a collision            H-INFO's necessary condition is FALSIFIED
    a shallower account predicts the same            not discriminated; report as such

## Rules

No case is added, dropped or re-ranked after diagnosis begins. The direct measurement channel
must be shown not to pass through `R` — if it does, that case is UNOBSERVABLE, not evidence.
H-APPLIC is **not** tested here and is not merged. Any apparatus that evaluates a weaker
proposition than the one frozen is an apparatus failure, scored as such — this has now happened
four times and the check is explicit for that reason.
