# Repair of the lateral-reformulation defect — frozen 2026-09-21 before any code change
Sequence step 1 of 8. Nothing is bridged until this passes.

## The rule, stated once, for both quantifier families

> `strongest_licensed(requested)` may return `c` only if `compare(requested, c) == LICENSES`.
> Otherwise it returns `None` and the frontier is preserved.

Not "never stronger". Not "never lateral". **Licensed by the requested claim, under the model's own
comparison.** That single condition excludes upward and lateral moves together, and it uses the
comparison the model already has instead of a hand-rolled direction check.

## A correction to my own earlier result, recorded before the repair

`H-EXTENT_RESULT.md` celebrated Q-5's output:

    requested   EXISTS over repository
    emitted     EXISTS over function_F

Under the model's own `compare()`, the repository existential **does not license** the function
existential — `∃x∈function_F` implies `∃x∈repository`, so the emitted claim is the *stronger* one.
The output was an **upward/lateral reformulation of exactly the kind the FOR_ALL failure exposed**,
and my `is_upward` check missed it because it tested containment in the wrong direction for
existentials. Q-5's *liveness* was real; its *output* was defective. That result is superseded here.

Two mechanisms were conflated:

    strongest RESTRICTION of the requested claim     what the downward compiler may emit
    strongest claim the evidence SUPPORTS            a different question; may be recorded as an
                                                     established fact on the frontier, never
                                                     emitted as "the licensed version" of the request

## What the repaired behaviour must be

    requested EXISTS over D, membership in D not established
        -> no restriction of the request is available (superdomains lack membership too)
        -> None, frontier: "membership in D not established"
    requested FOR_ALL over D, coverage of D not exhaustive
        -> a FOR_ALL over D' with D' within D and D' exhaustively covered IS a restriction
        -> that, if it exists; else None

Membership evidence stays **direct** per observation. Domain containment is used for **comparison
only**, never to manufacture membership an observation did not carry. Those are different
relations and are kept so.

## Predictions

    R-1  for every input in the suite, emitted != None  =>  compare(requested, emitted) == LICENSES
         Enforced by an assertion INSIDE strongest_licensed, so a violation cannot serialize.
    R-2  the substitution harness measures monotonicity with compare(), and the scalar rank is
         DELETED from the harness. No rank anywhere.
    R-3  both degradation steps remain LIVE: Q-5 now moves EXISTS-over-repository -> None, and the
         FOR_ALL chain's E1 moves FOR_ALL-over-SAMPLE -> None, each for its frozen reason.
    R-4  Q-2 anti-refusal still holds: one witness with established repository membership still
         licenses the repository existential.
    R-5  the full substitution bar A1..A8 passes, with A8 re-stated as R-1.

FALSIFIERS: any emitted claim not licensed by its request; any inert step; Q-2 refused.

## Rules

Frozen specimens untouched, and `specimens_test.py` must still pass. `entitlement.py`'s old gate
untouched. No bridge, no adapter, no merge.

## Addendum, frozen before the second run — the observational floor is not in the subject order

The first repair run failed A5 at `E1 -> E2`: subject-level authority was `None` at both steps, but
the M-fail path emits *"instrument I emitted this result"* while the D/O path emits `None`, and my
comparator ordered those two zeros. **Fifth instance of a measure carrying an ordering the model
does not have.**

Clarified output, applied from here on:

    subject_claim   the strongest RESTRICTION of the request the evidence discharges, or None
    run_floor       "instrument I emitted this result in run R" - a direct observation of the
                    run, ALWAYS licensed, about a different subject, never a version of the request

Monotonicity (A5) is measured on `subject_claim` alone with `compare()`, and `None == None`.
`run_floor` satisfies W-4 (no silent drop) by always being present; it is never compared against
subject-level claims because they are not about the same thing.
