# PREREGISTRATION — TRANSFER-1. The one-shot hub run, against a frozen mechanism, in a clean room.

Frozen before the run. Nothing else is in this commit. Mechanism frozen at
`BACKWARD_1_FROZEN.txt`, COMBINED `76f35914abd5b737`.

## A precondition discovered while planning this run

BK-5 says **no file is written into the hub repository.** Witnessing requires executing the hub's
own tests, and those tests perform filesystem mutations - which is precisely why the hub is an
interesting subject. Running in place would therefore violate BK-5 on the first effect.

    THE RUN HAPPENS IN A CLEAN ROOM: a copy of the hub, outside its repository, discarded after.

The real repository is never executed, never written to, and never has a process started inside it.
This was not in BACKWARD-1's preregistration; it is recorded here as a precondition rather than
discovered mid-run and rationalised.

## INTERSECTION IS NOT THE SUCCESS METRIC

Recorded before the result because it would otherwise be tempting afterwards. Zero function-level
overlap between the forward and backward surfaces is **legitimate** for an architecture that cleanly
separates permission calculation from effect execution. The eventual target is not `F ∩ B ≠ ∅`; it is

    for every witnessed effect e, a chain
        Evidence -> Entitlement -> Decision -> e
    with every arrow independently justified at the strength claimed

TRANSFER-1 tests the FIRST STEP of that only: can an effect and its ancestry be observed at all, in
software that was never written to be understood by this instrument.

## SIX INDEPENDENT COORDINATES, NOT ONE COVERAGE NUMBER

Each is reported separately and none is averaged into the others:

    T-1  can frozen sink discovery witness real effects there?
    T-2  can ancestry cross PRIVATE production code?
    T-3  does the structural detector identify NATURALLY OCCURRING test-only access?
    T-4  does backward recover production territory forward discovery cannot?
    T-5  does it work despite mixed module architecture?
    T-6  does it FAIL LOUDLY where CommonJS prevents observation?

## PREDICTIONS

**T-1. Effects are witnessed.** > 0 EFFECT_WITNESSED from the hub's own tests, with no hub-specific
configuration beyond pointing the runner at the tree.

**T-2. Ancestry crosses private code.** > 0 private functions on PRODUCTION_REACHED effect paths.
*This is participation, not relevance,* exactly as on Legasus, and will be reported as participation.

**T-3 (THE FIRST NATURAL SPECIMEN). The structural detector fires on the hub without being told.**
The hub contains aggregate exports of module-private bindings. The detector has only ever fired on a
constructed fixture; this is the first naturally occurring instance.
*Falsified if* it finds none, or if it flags things that are not such aggregates.

**T-4. Backward recovers territory forward cannot.** Forward discovery is predicted to find ~nothing
on the hub - it has no identity brand - so backward-only is predicted to be almost the whole surface
and the intersection ~0. **Neither number is a success or a failure; both are the measurement.**

**T-5. Mixed module systems do not break the run.** The ESM region is observed; the run completes.

**T-6 (THE ONE THAT MATTERS MOST FOR HONESTY). The CommonJS region appears in the denominator.**
Coverage is reported as

    ESM region        measured
    CJS region        UNOBSERVABLE_BY_THIS_INSTRUMENT
    whole repository  INCOMPLETELY OBSERVED

*Falsified if* any percentage is reported whose denominator silently excludes the unobservable
region. That would be the unparsed-frame error at repository scale, which this slice exists to avoid
repeating.

**T-7 (THE DANGEROUS NULL, PREREGISTERED AS FAILURE).** If witnessing requires entering through the
hub's test-only exports, naming any hub function, or configuring the run with knowledge of the hub's
intended architecture, **THE TRANSFER FAILS** and is reported as failed rather than as partial
success.

**T-8 (PREDICTION OF NO DETECTION).** No hub defect is found or reported. Any behavioural finding is
an artifact requiring its own preregistration.

## WHAT WOULD MAKE THIS A SECOND RUN RATHER THAN THE TRANSFER TEST

Any edit to a file listed in `BACKWARD_1_FROZEN.txt` before or during the run. If the mechanism has
to be repaired to get a result, **that repair and a re-run are a second run**, the first result stands
as recorded, and the hub stops being an unspoiled subject. Said now so it cannot be renegotiated
after a disappointing first attempt.

## WHAT THIS SLICE DOES NOT ESTABLISH

- Not SUPPORT_CHARACTERIZED, not JUSTIFICATION_ESTABLISHED, not SCREENED. BK-3 stays untested.
- Nothing about the hub's correctness, quality, or defects.
- The bridge-mutation gap from Entry 30 remains open.
- No hub code is modified, read into this repository, or committed anywhere.
