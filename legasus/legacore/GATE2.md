# GATE 2 — supported-core imperfections, classified before any fix

Two defect classes and two correctly-declared gaps. `A-*` count against supported capability; `U-*`
do not, because the architecture is saying what it cannot do.

    3  A-UNDER-NARROWED         supported failure, cause NOT YET DIAGNOSED
    3  B-SUPPORTED-INCOMPLETE   supported failure, cause understood
    1  U-INCOMPLETE-BY-DESIGN   correct behaviour
    1  U-DECLARED-UNSUPPORTED   correct behaviour

## DEFECT 1 — enclosing-scope bindings are reported UNRESOLVED (3 operations)

    provenance/e01:op4   `k` (local of the enclosing unit), `s` (parameter of the enclosing unit)
    provenance/e06:op4   `fmt`, `rows`   (parameters of the enclosing unit)
    provenance/f01:op3   `channel`, `msg` (parameters of the enclosing unit)

All three are branches inserted INTO a function body. Their code legitimately refers to that
function's parameters and locals. `symbol_availability` searches for a MODULE-LEVEL binding, finds
none, and declares the requirement unresolved.

**Scope is squarely inside the declared supported universe.** A name bound by the unit an operation is
inserted into is resolved — by scope — and reporting it as unresolved is a wrong account, not a
declared gap. The region derived is correct in all three cases, which is exactly why this class needs
a check that looks past the outcome.

Classification: **ARCHITECTURE**, supported. A missing resolution state, not a broken rule.

## DEFECT 2 — residual under-narrowing on three module-level definitions (3 operations)

    provenance/e01:op3   0.25 of 0.40 bits   survivors: `SHAPE_KINDS = [...]`, `SHAPE_LABELS = {...}`
    provenance/e06:op3   0.16 of 0.27 bits   survivors: `FORMATS = [...]`, `FORMAT_LABELS = {...}`
    provenance/f01:op2   0.26 of 0.36 bits   survivors: `CHANNELS = [...]`

Each is a handler definition placed at module level. Positions immediately after the registry
constants execute-fail, and no current rule removes them. The account claims completeness, so this is
not a declared gap.

**Cause not yet diagnosed, and deliberately not guessed at.** g03's residual looked structural and
turned out to be semantic intent; this one will be inspected before any rule is proposed.

Classification: **UNDIAGNOSED**. To be resolved in its own gate, with the surviving positions read
directly rather than reasoned about.

## Correct behaviour, recorded so it is not mistaken for failure

    requirements/h07:op2   correct region, incomplete because `math` is import-reachable
    unresolved/i01:op1     narrowable, nothing derived, declared incomplete for the same reason

Both are the architecture knowing what it does not know.
