# r4 — LegaScreen v0. RESULT.

Predictions frozen in `8a4c1df` (`LEGASCREEN_V0_PREREG.md`). The screen was run unchanged against
two trees: HEAD, and `77fd921` extracted to a scratch directory (`stopping.mjs` has no imports, so the
single file is the whole target; a `git worktree` at that commit failed on a Windows path-length
limit in an unrelated measurement file, which is recorded because it is why the method changed).

## LS-1 — THE DECISIVE PREDICTION HELD

    at 77fd921   stopping.objectivesFromContest   lost: establishes, doesNotEstablish, state
    at HEAD      stopping.objectivesFromContest   lost: state

The screen was told nothing about SC-1, nothing about the preregistration that found it, and nothing
about which function to look at. Its driver composes the module the way `quiesce-check` does. It
flagged the exact erasure, at the exact commit where it was live, and does not flag it after the
repair. **A mechanical screen with a declared invariant rediscovered a defect that had previously
taken twenty commits, seven green suites and an owner's review to find.**

The comparison is the sharpest form: **the DELTA between two commits' positives is the regression.**
That is more useful than either list alone and was not in the preregistration - it came out of running
the thing.

## LS-4 — false positives, reported as predicted and NOT tuned away

    at HEAD       4 positives over 6 exported functions
    at 77fd921    6 positives over 6

Most are one artifact, and it is worth naming precisely: **JavaScript lets a function be called with
the wrong shape without throwing.** Feeding a contest object to `evidenceFrontier` or
`investigationJustified` produces a plausible object that "lost" fields the input happened to carry.
Those are not projections at all; they are wrong-shape calls that did not fail loudly.

So the honest tally of the 77fd921 run is ONE principled true positive - `objectivesFromContest`,
reached with its natural input - and five artifacts, of which two happen to point at
`nextAction` and `evidenceFrontier`, which really did have SC-3 and SC-4 defects. **Those two are
coincidences, not detections**, and counting them as hits would be the metric-as-property error this
project has already paid for twice. The screen's demonstrated sensitivity is ONE defect.

## LS-5 — the unscreened region, which is the point

    exported functions      6
    reached by the corpus   5
    NEVER CALLED            1     stopping.attainment
    (function, seed) calls  25

`attainment` was never called, so the run says nothing whatever about it. A screen that reported
"no positives" without that line would be the 452/452 defect wearing a lab coat.

## The region this earns, per protection.mjs

    detector   LegaScreen v0 erasure screen
    region     object -> object transformations, over exports of legaknow/stopping.mjs reachable by a
               normal-composition corpus, for FIELD-LEVEL erasure of a declared vocabulary
    witness    this run: flags objectivesFromContest at 77fd921, silent at HEAD
    covers     SC-1 only

NOT covered, stated so a green screen is never read as a clean repository: value-level loss inside a
retained field (C6), losses through array- or Map-shaped transformations (C8-a), every module outside
the scanned one, every pathology other than erasure, and any function the corpus cannot reach. The
five other pathologies the owner listed are untouched.

## What the run changed about the design

1. **Cross-commit diffing is the primary mode**, not single-run positives. A standing false-positive
   set is tolerable; a NEW lost field is a signal.
2. **Specificity is limited by the language, not by the invariant.** A dynamically typed surface
   cannot distinguish "this projects away authority" from "I called it wrong". A static shape or a
   declared signature per export would fix it, and neither exists here.
3. The sensitivity claim rests on ONE defect. v0 does not license a second slice on enthusiasm; it
   licenses one on evidence, and the evidence is one hit and five artifacts.
