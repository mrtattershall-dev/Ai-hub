# r4 — LegaScreen v1: three historical defects, ONE machinery. Frozen before any probe is written.

The owner's success criterion, 2026-09-20, quoted because it is the bar and not my paraphrase:

> Given a historical commit before the defect was known, LegaScreen independently surfaces the
> transition that later became a recorded defect, while preserving explicit UNSCREENED/UNKNOWN for
> areas it cannot evaluate. If it can do that for the objectivesFromContest case, the provenance
> reason case, and one composition case using the same scanner machinery - not three special cases -
> you've got the beginning of something serious.

v0 did the first. This does all three or fails.

## What "same machinery" is taken to mean, stated before it can be argued afterwards

ONE harness - enumeration, exercise, positive collection, de-duplication, coverage accounting and the
UNSCREENED report - with PLUGGABLE INVARIANT PROBES. Not one detector that finds everything; the
owner's own plan is "expand one invariant at a time, and every new invariant rescans".

    FAILS THE BAR   a probe that needs the defect's file, function, field or commit named in it
    FAILS THE BAR   a probe whose thresholds were adjusted after seeing its target
    PASSES          a probe stating a general invariant, run over a generated or enumerated space,
                    which happens to contain the historical defect

Each probe below is written to a general property. If a probe cannot find its case without being
told where to look, that is recorded as a failure of this slice, not repaired by pointing it.

## The three cases and their commits

    CASE 1  ERASURE       objectivesFromContest drops an epistemic bound      live at 77fd921
    CASE 2  ALIAS         provenance.mjs exports CONTESTED, colliding with
                          ledger.mjs's obligation-carrying state word         live at 58b62aa
    CASE 3  COMPOSITION   a null intermediate launders a context dimension
                          through entitled()                                  live at b11e51f

## The three probes, as general properties

    P-ERASURE       an object -> object transformation must not drop a field the laws turn on
                    (v0, unchanged)
    P-ALIAS         a state word owned by more than one module is a potential semantic alias.
                    Enumerated over the module surface; owners reported; NOTHING classified.
    P-COMPOSITION   METAMORPHIC, and the one that is genuinely new:
                        LENGTHENING A JUSTIFICATION PATH MUST NOT GRANT WHAT THE DIRECT PATH REFUSES
                    Over generated three-node graphs with scopes drawn from {null, ANY, S1, S2},
                    compare entitled(conclusion) with and without an intermediate. A refusal that
                    becomes an admission when a node is INSERTED is authority appearing between the
                    edges. The probe knows nothing about null, about C1, or about which dimension.

## Predictions

    V1-1  At 77fd921, P-ERASURE surfaces objectivesFromContest losing establishes/doesNotEstablish.
    V1-2  At 58b62aa, P-ALIAS surfaces CONTESTED owned by ledger.mjs and provenance.mjs.
    V1-3  At b11e51f, P-COMPOSITION surfaces at least one (direct REFUSED, chained ADMITTED) pair.
          THIS IS THE DECISIVE ONE: the other two probes restate work already done, and this is the
          first probe written as a metamorphic property over a generated space rather than a scan.
    V1-4  At HEAD all three are silent on those findings - the probes track the code, not the names.
    V1-5  Every run reports coverage and an UNSCREENED list. A probe that evaluated nothing must not
          be reported as finding nothing.
    V1-6  FALSE POSITIVES ARE REPORTED, not tuned. P-ALIAS is expected to carry the seven standing
          collisions at every commit; P-ERASURE carried five artifacts at 77fd921 from wrong-shape
          calls. Neither number is reduced by narrowing a probe after seeing it.

## What is NOT built, so this slice is not confused with the design

No authority-flow graph over the whole repository, no runtime instrumentation of the authority APIs,
no static parser, no mutation battery, no shrinking, no finding IDs with repair packets, no severity
dimensions, no historical bisection beyond the three named commits, no per-model rendering. The owner
described a cathedral and asked for a vertical slice first; this is the slice, and everything else is
named here as absent rather than implied as coming.

## Falsification

If P-COMPOSITION cannot surface case 3 as a general property, the honest reading is that the
erasure result was a scan finding a scan-shaped defect, and that composition defects need something
this approach does not have. That would be recorded as the bar not being met.
