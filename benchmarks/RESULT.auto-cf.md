# r4 — AUTO-CF-1. RESULT: C-1 held, K = 140, and one preregistered control could not fire.

Predictions frozen in `45403a1`. Substrate: `legasus/legascreen/intervene.mjs` over the AUTO-WITNESS-1
recorder. Run: `node benchmarks/run-auto-cf.mjs`.

## The number this slice was for

    hand-authored counterfactual drivers  : 0
    authority transforms WITNESSED    (N) : 55
    authority transforms REPLAYED     (M) : 55
    authority transforms PERTURBED    (K) : 140   of 667 leaf facts tried

    op                     N    M    K   leaves
    calculus.observe      29   29   79      297
    calculus.derive       13   13   61      291
    calculus.delegate     13   13    0       79

    NO-DRIVER CHECK: none of 4 files supplies facts/construct/operate

**`calculus.delegate` is K = 0 over 79 leaf facts.** Every delegation counterfactual was refused or
unreadable; not one produced a scorable observation. That is reported, not smoothed.

## Outcomes over every counterfactual attempted

    RECONSTRUCTION_FAILED           199
    AUTHORITY_REFUSED               187
    OBSERVED                        140   <- the only scorable one
    OUTPUT_UNOBSERVABLE             114
    PERTURBATION_NOT_APPLICABLE      27

**79% of attempts produced no measurement**, and each says why in its own state. Under the old
representation most of those would have been an `undefined` somewhere.

## A real observation about the subject, found mechanically

    calculus.derive#7   #5 arg[0].context.criterion   ->   context.repository ADDED
                        #6 arg[0].context.criterion   ->   context.repository ADDED

Removing one fact from one premise turns a REFUSAL into a CONCLUSION. `derive` refuses when premises
conflict on a dimension and no bridge witness covers it, but DROPS a dimension that some premise
never established - so deleting the conflicting `criterion` removes the conflict and the derivation
proceeds at `repository: S1`. Deliberate behaviour, both halves documented in `calculus.mjs`, and
nobody had put the two halves next to each other. No probe was written for it.

Not a defect, and this slice issues no judgment about it. Recorded for the slice that has a contract
to judge against.

## C-2b DID NOT FIRE, AND THE PREDICTION WAS WRONG

The preregistration said a constructor re-supplying a default would make an intervention vacuous.
It does not: a default lands in the constructor's OUTPUT, while the proof is taken on the rebuilt
ARGUMENT - and once an object key is gone the argument always differs. So under removal-perturbation,
`PERTURBATION_NO_EFFECT` is **unreachable**, and the real run shows 0 of 667.

The correct classification for an absorbed change is PERTURBATION_APPLIED then OBSERVED with an empty
delta, which is C-3's distinction doing its job. The state is kept, because the proof is the right
one and a future value-substitution perturbation can reach it - and it is recorded as **never shown
to fire**, which is not the same as safe.

## THREE DEFECTS IN MY OWN LAYER, ALL FOUND BY RUNNING IT

**1. A refused baseline was scored as a measurement.** K was 254 on the first run. A witness whose
baseline was already a refusal compared two refusals, found them equal, and reported OBSERVED with no
delta - six times, on a call that never produced anything to read. False confidence manufactured out
of an absence: slice 1's defect wearing the new architecture. Repaired by requiring that at least one
side carry a readable authority output. K fell 254 -> 140.

The repair is deliberately NOT "the baseline must be observable", because the baseline-refusal case
above is the most informative result in the run.

**2. A world that could not be built was reported as a world in which nothing changed.** When
reconstruction threw, the first version returned `PERTURBATION_NO_EFFECT`. That is could-not-measure
collapsing into a measured absence - this project's oldest defect class - committed once more inside
the layer built to prevent it.

**3. A VALIDATING WRAPPER WAS SILENTLY SKIPPED ON REPLAY.** When a recorded function returned another
recorded call's value unchanged, the recorder kept the INNER producer, so replay rebuilt the value by
calling the inner function directly. A perturbation the wrapper would have rejected sailed through
and was scored. Calls complete inner-first, so the outermost producer - the one the consumer actually
got the value from - now wins. **This is the most dangerous of the three: it did not fail loudly, it
quietly removed a check from the replayed path.**

A fourth, smaller: the C-6 checker matched its own report text, because the line that PRINTS the
result mentions `.held()` inside a string. The smallest possible instance of reading your own output
back as evidence.

## C-6 held — no judgment was issued

    intervene/runner call .held() or .violated() : no
    result records carrying a verdict field      : 0

Asserted over the source and over all 667 records, not intended. A completed journey CAN judge - 140
of them correctly could - and the claim is that nothing here asks.

## Not tuned to the files it was built on

Two test files never used in development:

    N = 30   M = 30   K = 58   of 288 leaf facts
    AUTHORITY_REFUSED 99  RECONSTRUCTION_FAILED 79  OBSERVED 58  OUTPUT_UNOBSERVABLE 32  N/A 20

## NO COVERAGE FRACTION

Still undiscovered surface, still no denominator.

## NOT BUILT

No support formula - ALL_OF/ANY_OF need complete truth tables and come next. No contract source;
`declared` remains human testimony and is not consulted. No discovery. Nothing about transformations
that do not execute during an existing test. The five prototypes remain unmerged.

Focused 27/27. Suite 639/639.
