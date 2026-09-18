# GATE 6 — construction procedure for prospective validation of revisions 4 and 5

**Frozen before any task exists.** Revisions 4 and 5 are currently DEVELOPMENT evidence only: both
were built against defects found on the provenance family, so their contribution to "100% of available
positional information" is measured on the data that diagnosed them.

## What needs prospective standing

| Rule | Added in | Current standing | Needs |
|---|---|---|---|
| `scope_availability` — enclosing-scope providers | rev 4 | development (provenance e01/e06/f01) + 7 synthetic witnesses | a blind family |
| `expression_continuation` — positions inside an open bracket | rev 5 | development (provenance e01/e06/f01) + 9 synthetic witnesses | a blind family |

The synthetic witnesses have better standing than the family score: both sets were written before their
implementations and are dominated by negatives. But a synthetic witness tests the predicate, not the
rule's behaviour inside a whole transaction.

## Case types, each with both halves

| # | Case | Must |
|---|---|---|
| 1 | insertion into a body, code using a **parameter** of that unit | resolve as enclosing scope, narrow nothing, `requirement_complete: true` |
| 2 | insertion into a body, code using a **local** of that unit | same |
| 3 | code using a name bound **nowhere** | stay UNRESOLVED, `requirement_complete: false` |
| 4 | **module-level** insertion whose code uses a name that is a parameter of some other function | stay UNRESOLVED — that parameter is not in scope |
| 5 | a hand-written **multi-line collection literal**, positions inside it | removed by `expression_continuation` |
| 6 | a **balanced** literal on one line, plus brackets inside a string and a comment | NOT removed — nothing may be taken for a phantom bracket |

## Path sensitivity, proven before running

Case 5 must be built so that `expression_continuation` is the **only** mechanism that can remove those
positions: the multi-line literal sits at module level with no enclosing body, so `ownership_boundary`
cannot reach it, and no terminator precedes it at module indent.

Case 4 must be built so that the name is genuinely absent from module scope, or the module search will
resolve it and the scope rule's restraint will never be tested.

**The multi-line literal must be written into the source by hand**, not produced by an intra-line
operation. The provenance instance arose partly because patch reconstruction terminates every block
with a newline; a family that reproduced only that shape would test the apparatus, not the program.

## Rules carried in

Authored blind from these situations, sealed before any deriver changes, narrowability established by
the executable prover and committed before scoring, reported per case before any aggregate, style
control narrowing zero, and no deriver edited after the family exists.

## Endpoint, fixed now

Prospective success is: every positive case resolves or narrows as stated, every negative case does
not, zero over-constraint, 100% witness replay, and every unsupported case declaring itself. A residual
that turns out to need semantic intent is classified at that boundary and does not count against the
structural rules — with a justified entry in `SEMANTIC_INTENT.json`, not an assertion.
