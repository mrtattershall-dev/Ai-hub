# r4 — LegaScreen v3 slice 1 (semantic lineage). RESULT.

Predictions frozen in `3d51b6c`. Three probe defects were found by running it, and one structural
finding about the subject that no probe was looking for.

## L-1 HELD — the derived-by-another-name blind spot is closed for this case

v2 reported three dimensions UNSCREENED because it perturbs by NAME and the names differ. Lineage
discovers them from execution:

    input[0].identity.producer         -> scope.criterion    CHANGED
    input[0].identity.producerVersion  -> scope.criterion    CHANGED
    input[0].identity.document         -> scope.history      REMOVED
    input[0].identity.ordinal          -> scope.history      REMOVED

No name matching anywhere. The support structure fell out of perturb-and-diff.

## L-3 HELD — and this is the generalization the slice was for

    b11e51f   context.repository   declared ALL_OF   OBSERVED ANY_OF   MISMATCH
              context.criterion    declared ALL_OF   OBSERVED ANY_OF   MISMATCH

C2 is now a **mismatch between observed and declared aggregation**. Nothing told the probe that
`derive` is conjunctive; the declaration is simply the operation's own contract ("the output context
is the INTERSECTION"), and the OBSERVATION is mechanical. v2's I-WEAKENING needed a human to encode
the conjunction as a probe input. This does not.

## L-2 IS NOT MEASURABLE AT HEAD, and the reason is a finding

    HEAD   calculus.derive   observed 0   vacuous 0   unobservable 4   aggregation UNKNOWN

The perturbation builds a modified copy of a token. Since the C3 repair, a token is branded by
membership in a module-private WeakSet, so **a copy is not an authority token** and `derive`
correctly refuses it. Verified directly rather than inferred:

    HEAD     original isAuthority true | SPREAD COPY isAuthority false | own symbols 0 | derive REFUSED
    b11e51f  original isAuthority true | SPREAD COPY isAuthority true  | own symbols 1 | derive minted

**THE ARCHITECTURE'S OWN UNFORGEABILITY DEFEATS EXTERNAL PERTURBATION.** The C3 repair made tokens
harder to forge and, by the same property, harder to screen. That is a real tension between
defensibility and screenability, and it was found by the screen failing rather than by anyone
reasoning about it.

The fix is named and NOT built in this slice: perturbation must go through the CONSTRUCTORS - rebuild
the premise with `observe()` at a perturbed context - instead of copying. A screen that mutates
objects from outside can only screen objects that permit outside mutation.

## THREE DEFECTS IN THE PROBE, all found by running it

1. **A refused input was read as a dependency.** `derive` returning `{minted: false}` has no context,
   so every output coordinate "changed" - producing a confident `ALL_OF` at HEAD where NOTHING had
   been observed. L-5's non-vacuity requirement is what exposed it: a matrix where everything depends
   on everything has discovered nothing. Now a result with no authority map is NO_OBSERVATION.
2. **UNSUPPORTED and ANY_OF were conflated.** "No single input affects it" means either the
   coordinate came from outside the inputs, or it survived the loss of every one of them - opposite
   findings. Only the all-inputs-stripped run separates them, so it is now run rather than guessed.
   Before this fix the probe reported UNKNOWN at b11e51f where the answer was the defect.
3. **"Could not measure" and "was removed" shared one representation.** `strippedAll` returned a bare
   value, so both were `undefined`. **That is this project's oldest defect class - UNKNOWN collapsing
   into a value, the one Law 1 was written for - committed inside the layer built to detect it.**
   Now `{measured, value}`.

## L-4, L-5

L-4 held: the four states are centralized in `lineage.mjs`, and VACUOUS_PERTURBATION / NO_OBSERVATION
are counted per run rather than asserted inside one function - which is how v2 shipped the defect it
later caught. L-5 held and did real work; see defect 1.

## What this slice establishes, and what it does not

ESTABLISHED: support can be discovered counterfactually without names; aggregation is observable;
C2 generalizes to observed-vs-declared mismatch.

NOT ESTABLISHED: anything about HEAD's calculus, which is unscreenable by this method until
perturbation goes through constructors. Anything beyond two transforms. The support FORMULA
representation, the shared mutation engine, AST discovery, the 143-transform surface, path invariants
and the readiness gate A-J are not started.
