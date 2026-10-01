# FG-3 ADMISSION — RESULT: a `Verified` finish is a receipt for work that happened

Prereg `FG-3-ADMISSION_PREREG.md` @ e872f0ba + Amendment 1 @ f333b308 (frozen before the fix it names).
SUBJECT (F4) and RECEIPT (F5) untouched; F4 measured red in every run.

## The repair

    verifyProject.verify   accepts `landedWrites`. When the caller supplies it, the goal names files and
                           the goal asks for a change (frozen verb list, `asksForChange`), zero landed
                           writes is a problem with `admission: 'NO_WORK'` - and every other check still
                           runs, so the model sees that the file runs AND that nothing landed. Callers
                           that do not supply the count are unchanged.
    agent.js branch 4      supplies the count with the verbatim predicate the end-of-run repair already
                           uses, and owns the once-only policy: the first NO_WORK finish is refused with
                           the reason; the second ends the run recorded UNVERIFIED (finishKind
                           'unverified-no-work') - never Verified. Amendment 1: that yield applies ONLY
                           when NO_WORK is the sole problem; a project that does not run blocks as before.

## Staged evidence (EH1, all sealed and verified)

    row  level     construction                                  BEFORE 9ac01a2c          AFTER 4467df17 (A1)
    A1   verify()  add-goal, file loads but lacks it, 0 writes    Verified                 NOT ok, admission NO_WORK
    A2   verify()  same goal, 1 write                             ok                       ok
    A3   verify()  "Check that m.py returns 42 and report.", 0    ok                       ok - no mutating verb
    A4   verify()  landedWrites undefined (existing callers)      ok                       ok - rule not applied
    A5   hub       scripted finish at once, twice; 0 writes       Verified (node)          blocked once, then done
                                                                                           UNVERIFIED (no work)
    A6   hub       scripted model writes the goal, finishes       Verified                 Verified
    A7   hub       finishGateHost's own goal, 0 writes, unbounded Verified                 Verified
    A8   hub       own file CRASHES, 0 writes, finish x3          (added by A1)            stays BLOCKED: 2 blocks,
                                                                                           no Verified, no yield
    F4   SUBJECT   entry fall-through                             Verified on s1           STILL Verified - red

Hub rows ran the real hub as finishGateHost.test drives it (fakemodel.mjs replies, startHub, unbounded).
The pre-amendment after-run 91c51cfd is kept: A1-A7 held there too; the defect it did not see is A8's.

## Amendment 1, found by the consumer re-run and frozen BEFORE the fix

finishGateGoalEntry.test went 4/0 -> 2/2 under the first repair: its goal names a file seeded with a
failing assert and its scripted model lands no write, so the first finish was refused as NO_WORK
(correct) and the SECOND ended the run UNVERIFIED - although the project does not run. The prereg had
said "a second finish with still zero writes is allowed to END the run" without "and nothing else blocks
it". Fixed as frozen: the yield requires NO_WORK to be the sole problem (`v.problems.length === 1`), the
block names the runtime failure first, and A8 guards it. The test is back to 4/0.

## Consumers (repo root, baseline -> first repair -> Amendment 1)

    finishGateEntry 5/0 (+3 known-open) -> same -> same    finishGateGoalEntry 4/0 -> 2/2 -> 4/0
    finishGateHost 10/0 -> 10/0 -> 10/0    gateSoundness 8/0 -> 8/0 -> 8/0    loadSweep 12/0 -> 12/0 -> 12/0
    verifyExportsGoal 6/0 -> 6/0 -> 6/0    writeExportNote 6/0 -> 6/0 -> 6/0    goalScope 16/0 -> 16/0 -> 16/0

## Not claimed

The UNVERIFIED-no-work finish's exclusion from the training corpus (the corpus filter reads finishKind;
checked in RECEIPT). Goals that ask for work without a verb on the frozen list are not admitted to the
rule (blind spot, recorded). A write that landed on the WRONG file counts as work here; whether it was
the goal's file is SUBJECT's question (FG-4, frozen next).
