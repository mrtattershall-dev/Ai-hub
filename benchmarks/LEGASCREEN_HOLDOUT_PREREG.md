# r4 — LegaScreen HOLDOUT. Selection rule and outcome vocabulary frozen BEFORE any candidate is named.

The owner, 2026-09-20, after v1 met the three-case bar:

> Can the existing screening machinery say something useful about a historical authority defect that
> played no role in designing these three probes? Freeze the selection before looking. **Do not add a
> probe after selecting it.**

This file is committed alone. The candidate enumeration, the selection, and the run land afterwards.

## Why v1 is not enough on its own, stated plainly

v1's three cases each motivated a probe. Rediscovering them shows the probes were faithfully built;
it does not show they TRANSFER. A fourth defect, chosen mechanically from a pool none of the probes
were designed around, is the first thing in this line of work that could fail honestly.

And the ANY discovery needs its own correction, recorded before it gets quoted as more: because the
C1 repair ALREADY closed the ANY route, that result does NOT show the screen would have prevented a
new defect prospectively. It shows the repair's real protected region was LARGER than the manually
demonstrated one, and that the screen could expose that fact afterwards. Real, and narrower than it
sounds.

## Eligibility — a defect qualifies iff ALL hold

    E1  recorded in OVERNIGHT_LEDGER entries 15-18, i.e. before LegaScreen existed (8a4c1df)
    E2  it changed an authority-relevant decision
    E3  a commit where it was demonstrably LIVE and a repair commit are both identifiable from the
        record
    E4  its pathology is NONE of the three the probes were built around:
          - field-level erasure on an object -> object transformation
          - a state word owned by two modules
          - entitlement gained by inserting an intermediate into a justification chain
    E5  it is cited in NEITHER LEGASCREEN_V0_PREREG.md NOR LEGASCREEN_V1_PREREG.md

## Selection, mechanical

Among eligible defects, take the one whose recorded identifier sorts FIRST in the ledger's own
canonical order: C-cases by number, then W2-, then W3-, then SC-, then PR-. Identifiers are unique so
there is no tie. No property of any candidate is inspected before this rule picks.

## What is run — THE PROBES ARE NOT TOUCHED

Two readings, both reported, because they answer different questions and reporting only one would be
choosing the flattering half after the fact:

    STRICT    the three probes with their committed drivers and targets, exactly as they stand at
              705ce25, run against the commit where the holdout was live. Answers: does the screen AS
              SHIPPED reach this defect?
    POINTED   the same probe code, with the harness aimed at the module the defect lives in and a
              driver that composes that module the way an ordinary caller would. Answers: does the
              INVARIANT reach it when the harness is aimed there?

The driver for POINTED may not be shaped by knowledge of the defect - it exercises the module's
exports in the obvious way - and it is reproduced verbatim in the result so the claim can be judged
rather than taken. NO PROBE IS ADDED, EDITED OR RETUNED after selection. If a probe would need to
change, the outcome is SILENT and that is the finding.

## Outcome vocabulary, fixed now

    DETECTED      a probe emits a positive whose subject identifies the defective transformation -
                  a reader of that positive alone would investigate the right function
    PARTIAL       a positive touches the structure involved but would not lead a reader to the defect
    SILENT        no positive relates to it. THIS IS A GOOD RESULT: it measures how narrow the
                  microscope is, and narrowness stated is worth more than breadth assumed.
    UNMEASURABLE  the harness cannot validly examine the relevant structure at that commit

## What follows each outcome, decided now so the result cannot choose its own consequence

    DETECTED   the screen has transferred once. It licenses the holdout being repeated, not the
               remaining design.
    SILENT     inspect WHY, and let the missing observable property define the fourth probe - from
               evidence rather than imagination. That probe must then rescan ALL prior history, not
               only the defect that motivated it. NOT done in this slice.
    PARTIAL    recorded as PARTIAL. It is not rounded up.

No probe is written in this slice under any outcome.
