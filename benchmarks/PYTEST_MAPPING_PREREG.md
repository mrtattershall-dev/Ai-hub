# r4 — a declared mapping for producer #3 (pytest). Predictions frozen BEFORE the mapping exists.

## Why this is an objective and not a manufactured one

Wave 2 (`RESULT.composition-2.md`, W2-g) recorded a finding beside a defect: pytest has no declared
mapping, so every pytest verdict adapts to UNKNOWN_MAPPING, and no scoped Legasus claim has ever
derived from pytest evidence. Producer #3 established scope construction (Entry 11); it did not
establish derivation. That is the E6 half of producer #2's result, never run for producer #3.

Against law 7's four conditions: authorized (r4 development surface); executable (pytest 9.1.1 is
present, measured); targets a distinction (can pytest evidence derive a claim, or only be stored);
and some outcome changes what may be claimed - today nothing may be claimed from a pytest verdict.
So it is justified, and quiescing over it would be stalling. It is NOT producer #4: no new producer,
no new coordinate, no new dimension. It is the boundary finishing its job for the third producer.

## The mapping, argued from pytest's documented semantics (ARGUED_FROM.SPECIFICATION)

The producer records `report.outcome.upper()` for the call phase, and `SETUP_<outcome>` for a setup
phase that did not pass. pytest's outcomes are `passed`, `failed`, `skipped`.

    PASSED         -> OBSERVED,             assertion HELD      the body's assertions held
    FAILED         -> OBSERVED,             assertion REFUTED   an assertion failed OR the body raised;
                                                                pytest does not distinguish these in
                                                                `outcome`, so neither may the adapter
    SKIPPED        -> NOT_ATTEMPTED,        assertion null      the body never ran
    SETUP_FAILED   -> PREREQUISITE_MISSING, assertion null      the fixture failed; the body never ran
    SETUP_SKIPPED  -> NOT_ATTEMPTED,        assertion null
    anything else  -> UNKNOWN_MAPPING                           (xfail/xpass wrinkles, reruns, plugins)

The collapse of assertion-failed and body-raised into REFUTED is the same collapse the doctest mapping
makes for OUTPUT_MISMATCH / UNEXPECTED_EXCEPTION, and it is legal for the same reason: no consumer
distinguishes them - and it becomes illegal the moment one does. Here it is forced, not chosen: pytest
reports one word for both.

## Predictions

    PM-1  each native above adapts to the state beside it; an unlisted native is UNKNOWN_MAPPING
    PM-2  a scoped claim derives from a pytest PASSED record: criterion `pytest <version>`, invocation
          the nodeid, cohort and plugin set carried under UNADMITTED, assertion HELD (E6 for pytest)
    PM-3  NON-INVENTION, mechanically: two records pytest reports identically as FAILED - one an
          assertion failure, one a raised exception - grant identical permissions after adaptation
    PM-4  THE ENTRY 11 PAYOFF, now with assertions: the cohort experiment's two verdicts adapt to
          HELD and REFUTED on scopes identical over the six, so before admission they are COMPARABLE
          and CONTRADICTORY; after collectionCohort is admitted for pytest they are refused a
          comparison on that dimension. Both halves executed, in that order.
    PM-5  doctest and git adaptations are byte-unchanged (the P3-7 fixtures)
    PM-6  CONTROL: a doctest record cannot use the pytest mapping, and a pytest record cannot use the
          doctest one - the FOR_PRODUCER rule of W2-g holds across the new mapping

## What a NULL result looks like

If PM-4's first half fails - the two verdicts do not read as contradictory before admission - then
either the scopes are not identical over the six after the wave-2 repairs (a change to Entry 11's
finding, to be recorded), or the mapping is wrong. Either way the mapping is not registered.
