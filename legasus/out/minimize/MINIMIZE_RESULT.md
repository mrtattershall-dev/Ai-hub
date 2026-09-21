# BIND-CJS step 13 result — the boundary moved when the observation configuration changed
2026-09-21 07:20. Preregistration `legasus/BIND-CJS_MINIMIZE.md` (23c23b4), frozen before the
minimised worlds existed. Deciders, mechanism and interpretation untouched. Hygiene: 13 pids
recorded, 0 alive at sweep.

## Results

| case | field set | outcome | expected |
|---|---|---|---|
| S1′ request seeded mid-run | original | **IDENTICAL** | IDENTICAL ✓ |
| S3′ counts equalised | original | **DIFFER** | IDENTICAL ✗ |
| S4′ operation-start in both worlds | original | **IDENTICAL** | IDENTICAL ✓ |
| S4′ same worlds, operation-start recorded | extended | **DIFFER** | DIFFER ✓ |

## N1 CONFIRMED — P1 converts to an evidence limit

With the foreign writer seeding the request channel mid-run, the hostile and genuine bundles are
identical. **Nothing in the recorded evidence identifies the issuer of a request.** P1 joins P5:
not identifiable from these fields, not merely badly decided.

## N3a and N3b CONFIRMED — and this is the finding

The same two worlds, scored under two field sets:

    original fields (executions + requests)          IDENTICAL   -> not identifiable
    extended fields (+ operation-start records)      DIFFER      -> identifiable

    hostile:  operation-start > execution:witness > request > execution:worker
    genuine:  execution:witness > request > operation-start > execution:worker

**The boundary moved when the observation configuration changed.** The worlds did not change;
what was recorded did. This is direct evidence that `NOT_IDENTIFIABLE_STRONG` is a property of
the evidence configuration rather than a fact about the world — which is what the step-11
caveat asserted and could not then demonstrate.

Per the preregistration this is **not** read as "therefore Legasus should record operation
starts". That would be a design decision earned by a different experiment. What is established
is narrower and more useful: *a limit of this kind can be moved by changing what is observed, and
therefore naming one is always relative to a configuration.*

## N2 FALSIFIED — and the survivor is almost certainly a third scar

S3′'s bundles still differ, and the event sequences are identical as `kind:role` pairs:

    hostile:  execution:witness > execution:worker
    genuine:  execution:witness > execution:worker

The difference is in **identity**: hostile `[MUTANT, MUTANT]`, genuine `[MUTANT, SUBJECT]`. My
"genuine" external worker received no mechanism, so it loaded the original — while the hostile
witness's second load was served the mutant. That is a property of **how I built the genuine
world**, not information about whether an execution occurred outside the witness. Step 8's P-C
already showed an external process *with* the mechanism loads the mutant.

Per the preregistration, a surviving difference is **the next target, not an answer**, and it is
not attacked inside this expedition. Recorded as: *P3 remains unconverted; the outstanding
distinction is identity, and the minimisation that would test it is a genuine world whose
external worker receives the mechanism.*

## The map now

    P5   evidence limit        (step 12)
    P1   evidence limit        (step 13, N1)
    P7   evidence limit        (steps 10 and 11, twice, independently)
    P6   evidence limit        (step 11)
    P4   evidence limit under the ORIGINAL configuration; identifiable under the extended one
    P3   unconverted - one distinction survives, probably a scar; next target
    P2   untouched here, by design - it gets its own expedition

## What was not done

Nothing rescued, proposed or named. No decider written, no field added to Legasus, no concept
created. The charter's correction is applied throughout: nothing here says what architecture may
exist, only what these constructions are entitled to claim.

## Next falsification, not started

1. **S3″** — rebuild S3′'s genuine world with an external worker that receives the mechanism, so
   both worlds show `[MUTANT, MUTANT]`. If the bundles then coincide, P3 converts.
2. **P2's own expedition** — the one death that plausibly admits a stronger decider over
   existing fields, and therefore the best candidate to survive repeated hostile worlds. A
   proposition that survives attacks designed for other propositions has survived nothing.
