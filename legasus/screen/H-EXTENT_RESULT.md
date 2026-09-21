# H-EXTENT result — Q-1..Q-5 hold; the inert degradation step is now live
2026-09-21. Preregistration `H-EXTENT_PREREG.md`, frozen before the replacement was built.
`obligation.py`, tested by `obligation_test.py`. Nothing installed.

## Results

    Q-1  INCOMPARABILITY   a repository-wide sample and an exhaustively analysed function return
                           INCOMPARABLE in both directions. No order is manufactured.
    Q-2  ANTI-REFUSAL      one function-located witness DOES license `EXISTS` over the repository,
                           given established membership. passed=True, unmet=[]
    Q-3                    the same witness licenses neither `FOR_ALL` nor `NONE` over the
                           repository - "coverage of repository is PARTIAL, not EXHAUSTIVE"
    Q-4                    exhaustive coverage of the frozen 60-case sample licenses `FOR_ALL`
                           over that sample and NOT over the repository
    Q-5  THE SPECIMEN      removal is no longer inert

## Q-5 is the result; the others mostly restate the model

Under the scalar lattice, removing the extent evidence changed nothing: `E1` produced the same
licensed claim at the same rank. Under the replacement:

    before   EXISTS over repository
    after    EXISTS over function_F
    reason   "no observation with established membership in repository"

The reason is the one frozen in the preregistration — *`EXISTS` over a domain requires established
membership in that domain* — and it is **derived by the compiled obligation**, not tabulated for
this specimen. The step that was semantically inert is now the step that narrows the claim.

## Honest discounting, as with H-INVERSE and H-COMPLETION

    Q-2        a real guard. A naive "never widen structural scope" fix passes every other
               prediction here and FAILS this one, destroying legitimate existential reasoning.
               It was frozen as the most important row for exactly that reason.
    Q-5        informative. It compares the new model against a recorded prior failure rather
               than against itself.
    Q-1        confirms I implemented a design choice. Weak.
    Q-3, Q-4   close to analytic. Predicting that a witness satisfies EXISTS and fails FOR_ALL
               is nearly a restatement of the compiled obligations.

**Real content: one comparison against a prior failure, one genuine guard, three near-restatements.**

## What the replacement changes

The scalar rank is gone. The obligation is compiled from

    claim domain  x  claim quantifier  x  observed extent  x  coverage evidence

and comparison is three-valued: `LICENSES`, `DOES_NOT_LICENSE`, `INCOMPARABLE`, with no total order
to fall back on. This matters because the rank was itself an illegal compression under the law
`legaknow/monotonicity.mjs` already states: `(repository, sampled)` and `(function, exhaustive)` had
to collapse onto one number, and the number manufactured an ordering that does not exist.

## Status

`entitlement.gate_obligation` is **unchanged and still defective**, preserved as a specimen
alongside census sites #7 and #10. `obligation.py` is a separate module that nothing consults.
Replacing the gate's obligation check with it is a further step with its own evidence burden, and
the shadow suite would have to be re-run against it.

The certificate remains the seam between the Python and JavaScript sides, its shape is recorded in
the preregistration, and the branches are not merged.

## Not claimed

That this model is correct, only that it expresses distinctions the rank could not and makes one
recorded failure detectable. One author, one lineage, five predictions of which three are near
restatements of the model's own definitions.
