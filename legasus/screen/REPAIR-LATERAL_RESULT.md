# Lateral-reformulation repair — R-1..R-5 hold; two measurement defects found on the way
2026-09-21. Preregistration `REPAIR-LATERAL_PREREG.md` plus its frozen addendum. Sequence step 1
of 8. Raw: `legasus/out/hadmission/substitution2.json`. **Not bridged. Not merged. No adapter.**

## The rule now in force

    strongest_licensed(requested) returns c  =>  compare(requested, c) == LICENSES

enforced by an assertion inside the function, so a violation cannot serialize. One condition,
both quantifier families, and it uses the model's own comparison rather than a hand-rolled
direction check.

## Scoring

    Q-1..Q-5   hold          R-1 licensed-by-request: every emitted claim checked, none violates
    A1..A8     PASS          substitution bar, full suite, second run
    specimens  intact        3 expected defects, 0 violations

## What changed in the outputs, and why each change is correct

    F1  Stage B case 3     EXISTS over FUNCTION  ->  NOTHING
    Q-5 stripped witness   EXISTS over function_F  ->  None
    E1  coverage removed   FOR_ALL over FUNCTION  ->  NOTHING

All three previous outputs were reformulations the request did **not** license. For existentials
the smaller-domain claim is the *stronger* one, so "narrowing" a repository existential to a function
existential was an upward move; for the universal it was lateral. The evidence still supports those
facts — they belong on the **frontier as established observations**, not as "the licensed version
of the request". Two questions were conflated and are now separate:

    strongest RESTRICTION of the request      what the downward compiler emits
    strongest claim the evidence SUPPORTS     a different question, recorded elsewhere

## Correction to `H-EXTENT_RESULT.md`

Q-5's celebrated output was itself defective under the model's own `compare()`. Its **liveness** was
real and survives — the step still moves, now from a repository existential to nothing, for the
frozen reason "membership in repository not established". Its **output** is superseded.

## Two defects in my own measurement, on consecutive runs

**Fourth instance.** After deleting the scope rank from the model, I reintroduced one in the test
harness, which scored `SAMPLE` and `FUNCTION` identically and reported a live step as inert.
Deleted; monotonicity is now measured by `compare()` and nothing else.

**Fifth instance.** The M-fail path emitted an observational "instrument output" claim and the
D/O path emitted `None`; my comparator ordered those two zeros, so a claim about a *different
subject* looked like regained authority. Resolved by representation, frozen as an addendum before
the second run:

    subject_claim   strongest restriction of the request, or None
    run_floor       "instrument I emitted this result" - always licensed, about the run,
                    never compared against subject-level claims

The floor is present at every step and satisfies no-silent-drop; monotonicity is measured on the
subject claim alone, where `None == None`.

## The degradation chain, final

    E0  PPP   FOR_ALL over SAMPLE     floor present
    E1  FPP   NOTHING                 floor present     <- live, for the frozen reason
    E2  FPF   NOTHING                 floor present
    E3  FFF   NOTHING                 floor present

## What this licenses

The replacement obligation semantics are stable enough to **freeze a certificate contract against**.
That is step 2. It does not license a bridge, an adapter, a consumer, or a merge, and each of those
remains a separate claim with its own evidence burden per the eight-step sequence.

`entitlement.py`'s old gate, `reach1.py` and `hadmission.py` are unchanged. The `legaknow` worktree
was not touched. The comparison bridges under `legascreen/bridges/` are not the transport and will
not be.
