
# r4 — LegaScreen v3, slice 1: SEMANTIC LINEAGE. Frozen before any code.

v2's baseline is frozen at `ab47226`. Its two structural failures - the same-name perturbation
assumption and the derived-by-another-name blind spot - have one cause: **v2 compares field names.
It has no idea what supports what.** This slice builds the missing layer and nothing else.

The owner's v3 design has twelve parts and a readiness gate A-J. This preregisters ONE part, because
the whole point of the holdout was that breadth asserted is worthless. Parts 4-12 are not started.

## The idea, in the owner's terms

Instead of matching names, DISCOVER THE SUPPORT STRUCTURE COUNTERFACTUALLY from witnessed calls:

    F(I) = O                       the witness
    perturb ONE input coordinate   I[k] removed
    re-run, diff the output        which output coordinates moved?
    -> an empirical dependency matrix, built from execution rather than from names

And the same machinery answers the question that defeated I-ANCESTRY, because AGGREGATION IS ALSO
OBSERVABLE: if removing input A alone leaves output D intact, the operation behaves DISJUNCTIVELY
for D; if D disappears, it behaves CONJUNCTIVELY. **Observed aggregation, discovered rather than
declared** - which is the v2 blind spot that needed a human to write "this is an intersection".

## Predictions

    L-1  DEPENDENCY DISCOVERY. For `adapt.adaptRecord`, the matrix shows `scope.criterion` depends on
         `identity.producer` (and/or producerVersion), and `scope.history` on `identity.document` /
         `identity.ordinal`. These are the THREE dimensions v2 reports as UNSCREENED. If the matrix
         resolves them, the derived-by-another-name blind spot is closed for this case.
    L-2  OBSERVED AGGREGATION. For a SOUND `derive` (HEAD), removing `repository` from ONE premise
         removes it from the output: observed aggregation = ALL_OF.
    L-3  THE GENERALIZATION, and the decisive one. For the DEFECTIVE `derive` (b11e51f), the same
         procedure observes ANY_OF. **C2 becomes a mismatch between OBSERVED aggregation and the
         semantics the operation declares, discovered without any probe being told that derive is
         conjunctive.** If this holds, I-WEAKENING's hand-authored declaration is no longer the thing
         that finds C2.
    L-4  FOUR-STATE OUTCOMES, CENTRALIZED. Every attempted case reports OPPORTUNITY / PERTURBATION /
         OBSERVATION / INVARIANT. A perturbation that changed nothing yields VACUOUS_PERTURBATION as
         a FIRST-CLASS STATE carrying zero evidence - not an assertion buried in one function, which
         is how v2 shipped the bug it later caught.
    L-5  NON-VACUITY. The matrix must contain both dependence and independence: at least one
         (input, output) pair with an observed effect AND at least one without. A matrix that says
         everything depends on everything has discovered nothing.

## Falsification

If the matrix cannot separate "derived from a differently-named input" from "minted from nothing" -
that is, if L-1 fails - then counterfactual lineage does not close the blind spot and the approach
needs static support rather than execution. That would be recorded, and parts 4-12 would not
proceed on the strength of a hope.

If L-3 fails, aggregation remains a declared fact, I-WEAKENING stays hand-authored, and the claim
that lineage generalizes C2 is withdrawn.

## Explicitly NOT in this slice

The mutation engine as a shared component, the support FORMULA representation (A AND B as a stored
expression), AST discovery of candidate transforms, the 143-transform surface, path/graph invariants
over the support graph, the coverage report, and the readiness gate A-J. This slice earns the right
to attempt the next one, or it does not.
