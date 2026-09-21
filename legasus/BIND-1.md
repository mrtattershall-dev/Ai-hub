# BIND-1 — preregistration (frozen 2026-09-20, before any matrix was produced)

Legasus is the architecture; the hub is a legacy SUBJECT it must earn knowledge about
without the subject being reshaped for it. This is the first experiment. It grants NO
supersession authority. It measures the substrate from which such authority might later
be derived.

## Question

Without being given the semantics of `segments()`, can Legasus mechanically discover which
existing witnesses execute it, and experimentally establish which of those witnesses
discriminate a frozen family of generic perturbations?

## Subject

`server/approvalPolicy.js :: function segments(cmd)` — located by name, by parser, not by
line number. The file has no imports; nothing outside it is perturbed.

## Frozen witness catalog

Every file matching `server/*.test.mjs`, `server/policy_test.mjs`, `server/selftest.mjs`,
`client/src/lib/*.test.mjs`, `training-data/factory/*.test.mjs`, as of the commit this file
is written against. Witness files are NOT modified. A witness "case" is one printed outcome
line of the form `PASS|FAIL <identity>`; a file that does not print per-case lines is one
witness at file granularity.

## DISCOVER

Run every catalogued file once, unmodified, under V8 coverage. For each, record whether the
subject function had execution count > 0.

    EXECUTED       count > 0 for the function
    NOT_EXECUTED   file ran to completion, count == 0
    WITNESS_ERROR  file did not run to completion (baseline invalid)
    UNOBSERVABLE   exceeded the 180s per-file budget, or coverage could not be read

Selftest requires a live hub on :3001 and is run as catalogued; if the hub is down it is
WITNESS_ERROR, not excluded by hand.

## Frozen mutation family — generic, applied by AST inside `segments` only

Selected WITHOUT reference to what `segments` does. One mutant per applicable site.

    RETURN_EMPTY        body := `return [];`
    RETURN_UNDEFINED    body := `return undefined;`
    INVERT_COND         each if/ternary test T := `!(T)`
    DROP_BRANCH         each if consequent := `{}`; each else alternate := removed
    BOUNDARY            each numeric literal n := n+1 and n-1;
                        each `<`|`<=`|`>`|`>=` := its boundary neighbour (< <-> <=, > <-> >=)
    DROP_EFFECT         each ExpressionStatement that is an assignment, update, or call := removed
    EXCEPTION           each catch body := `{}` (swallow) and := `{ throw <param>; }` (propagate)

A mutant that fails `node --check` is INVALID_MUTANT and stays invalid. Nothing is repaired
after results are seen. No mutant is added after results are seen. `return []` gets no
special treatment.

## OBSERVE — one record per (mutant × witness)

    EXECUTED            the witness executed the AFFECTED block (innermost coverage range
                        containing the mutation site had count > 0); function-level
                        execution is also recorded
    outcome             PASS | FAIL | WITNESS_ERROR (process died before this case printed)
    INVALID_MUTANT      mutant did not parse
    UNOBSERVABLE        budget exceeded / coverage unreadable

Two negatives are different TYPES and are never merged:

    NOT_EXECUTED                 says nothing about sensitivity
    EXECUTED_NOT_DISCRIMINATED   informative about THIS perturbation only

## BIND — a witness W binds a perturbation M iff ALL of

    1. W's baseline outcome is PASS (baseline valid)
    2. M is a valid, executable mutant
    3. W executed the affected block under M
    4. W's outcome under M differs from its baseline outcome

A change to WITNESS_ERROR counts as a change and is reported as its own class
(DISCRIMINATED_BY_ERROR), separately from DISCRIMINATED_BY_FAIL.

No semantic obligation names are inferred. Each discrimination is an anonymous candidate:

    D_k = { region, perturbation, discriminators: [...], observed_delta, provenance }

A witness that executes the region and survives every mutation in the family is labelled
NO_DISCRIMINATION_OBSERVED, valid_against: this family — NOT "vacuous". It may
discriminate a perturbation not generated here.

## COVER — reported per perturbation and per witness

    executed + discriminated
    executed + not discriminated
    not executed
    invalid / unobservable

"Every witness must fail for every mutation" is NOT required and NOT expected. Different
witnesses may cover different behaviour.

## Granularity and budget (frozen)

    case-level   witness files that print one outcome line per case, AND whose DISCOVER
                 run completed in < 60s
    file-level   every other file that DISCOVER found EXECUTED, if its DISCOVER run
                 completed in < 60s
    UNOBSERVABLE (budget) files over 60s. Named as such, not silently dropped.

## What this does NOT establish

- that `segments` is characterized
- that any undiscriminated perturbation has no obligation behind it
- any replacement or supersession authority

If DISCOVER or BIND itself breaks on ordinary legacy structure, that failure is preserved
in the report exactly as found.
