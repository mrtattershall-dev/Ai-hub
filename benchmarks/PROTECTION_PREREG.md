# r4 — a taxonomy must not impersonate a verification system. Predictions frozen before the code.

The owner, 2026-09-20, reviewing Entry 18. Three things this project has been conflating:

    FAILURE PATTERN     conceptual similarity across incidents
    MECHANIZED REGION   the exact area in which a detector has DEMONSTRATED reach
    COVERED CLASS       a generalized class with INDEPENDENTLY JUSTIFIED coverage

The ledger has been writing "mechanized" for the second and reading it as the third. That is how C4
got four commits of cover, and at scale it is how a catalogue of named failures starts to look like a
guarantee. The owner's sentence is the requirement: *you can say two incidents instantiate the same
pattern without saying your guard covers the pattern.*

## The case, with its evidence already on disk

    INCIDENT 1  C4        an UNADMITTED coordinate named `collectionCohort` acquired an admitted
                          dimension's authority because the strings matched   (justification.mjs)
                          detector: producer-keyed promotion    witness: unadmitted-attack C4-a/C4-b
    INCIDENT 2  C8-word   `CONTESTED` exported by provenance.mjs acquired ledger.mjs's LAW 3
                          obligation because the strings matched              (provenance.mjs)
                          detector: frozen collision inventory   witness: vocabulary-collision AT-7

## Measured before predicting

    commits from introducing incident 2 (58b62aa) to it being recorded as a defect (554440f)   20
    of those commits, ones reporting a PASSING full suite                                       7
    `collectionCohort` exported as a state word anywhere in legaknow                        false

So the suite was green seven times with the defect live, and the detector built for incident 2 could
not have seen incident 1 - the original C4 was a RUNTIME DATA KEY colliding with a dimension name,
not a cross-module export collision.

## Predictions

    PT-1  The two detectors are DISJOINT over the two incidents: each covers exactly one, and neither
          covers both. This is the fact that makes "C4 is mechanized" an overclaim.
    PT-2  The pattern's verdict is MECHANIZED_REGION, not COVERED_CLASS - even though the UNION of the
          detectors covers 2 of 2 known incidents, because covering every OBSERVED member is not a
          coverage argument over the class. Observed coverage is reported as a ratio beside the
          verdict, never as the verdict.
    PT-3  COVERED_CLASS requires coverage established OUTSIDE the detectors' own say-so, exactly as
          instruments.mjs requires a witness per class. Absent that, the answer is the weaker level -
          UNKNOWN is never a quiet yes.
    PT-4  CONTROL. A detector claiming an incident WITHOUT a witness does not raise the verdict, and
          the unwitnessed claim is named.
    PT-5  CONTROL, so this is not a machine that always says MECHANIZED_REGION: a pattern whose
          incidents are all covered AND whose coverage is independently established does reach
          COVERED_CLASS; a pattern with no demonstrated detector at all is PATTERN_NAMED.
    PT-6  The detection-distance measurement is reported as n=1 and nothing more: for incident 2 it
          was 20 commits and 7 green suites, and the inventory guard would make it 0. That is ONE
          before/after on ONE incident, not a trend, and it says nothing about incident 1, which the
          guard cannot see.

## What is NOT done

History is not rewritten. Entries 15-18 keep the word "mechanized" where they used it; the project's
own rule is that a record is not edited to match a later understanding. The distinction applies to
what is claimed from here, and Entry 19 records the correction.

No long-run metric framework is built. The owner named several (time-to-detection, compute, human
analysis, distance-from-introduction, verified coverage, repeat escapes). There is one data point.
Building a framework over n=1 would be the budget-becomes-entitlement error in a new costume.
