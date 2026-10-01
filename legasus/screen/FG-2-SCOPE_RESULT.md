# FG-2 SCOPE — RESULT: a block is grounded only in the goal's files and their dependencies

Prereg `FG-2-SCOPE_PREREG.md` @ 73e2c2ff, frozen before verifyProject.js changed. ADMISSION (F1),
SUBJECT (F4), RECEIPT (F5) untouched and measured red in the same run.

## The repair

    server/goalScope.mjs    NEW, pure (no git, no shell): scope(workspace, { goal, entry, files }) ->
                            the goal's named files + their FORWARD static dependency closure (JS
                            require/import/dynamic import, Python import/from-import, directory index,
                            .mjs/.cjs, dotted packages), the python tests that belong to them, and
                            named=false (whole workspace) when the goal names nothing. 16 unit tests.
    verifyProject.verify()  syntax and load sweeps run over the scope for `problems`, and over the rest
                            for a new `notes` array; pytest runs the scoped tests for `problems` and the
                            other tests for `notes`; every return carries `notes`; format() renders them
                            as ⚠️ with a closing line that tells the model to say so in its summary.

## Amendment 1, found by the consumer re-run and frozen BEFORE the fix (acb1c8aa)

The first repair narrowed the scope for an ENTRY alone. loadSweep.test (12/0 -> 3/9) calls verify() with
an entry and no goal, and its L1/L3/L4/L5/L7 assert c8c3ff2f's whole-workspace contract for that case -
two sessions' contracts colliding on a case neither had named. Resolution: only a GOAL that names files
narrows the scope; on the served path the entry is derived from the goal, so nothing is lost there, and
every entry-only caller keeps today's semantics. L2 was my own wording regression (an evidence phrase a
consumer matches on); the qualifier moved to the end. The pre-amendment after-run (6988a544) is kept; the
result below is the post-amendment run.

## Staged evidence (EH1, sealed)

    row  construction                                   BEFORE 95818b9b                 AFTER 8de5bafa (A1)
    F2   clean goal file; unparseable junk.js elsewhere  BLOCKED on junk.js              Verified; NOTE names junk.js
    F3   python; own test passes; test_other.py fails    BLOCKED by whole-tree pytest    Verified; NOTE names test_other.py
    F6-  the goal's OWN file throws                      blocked                         blocked
    F7   goal file requires util.js, which throws        blocked                         blocked - the closure reaches it
    F7p  a dependency's test fails                       blocked                         blocked - helper's test is in scope
    F8   goal names no file; broken file anywhere        blocked                         blocked - whole workspace is the scope
    F1   ADMISSION (zero writes)                         Verified                        STILL Verified - red, as frozen
    F4   SUBJECT (entry fall-through)                    Verified on s1_library.js       STILL Verified - red, as frozen
    F6+  complete goal                                   Verified                        Verified

F7 and F7p are the rows that make the scoping safe: a dependency's breakage still blocks. F8 is the
row that makes it a no-op for every goal that names nothing - today's behaviour, unchanged.

## What the notes look like (F2, verbatim from the run)

    ⚠️ OUTSIDE THIS GOAL (not blocking): 1 of 1 file(s) the goal does not name do not compile - leftover
       from earlier work; the end-of-run repair still applies:
         junk.js: ...junk.js:1 function (

## Not claimed

Static resolution only: `require(variable)` is not followed (unit-tested as a declared blind spot); a
goal's file that breaks through such a dependency still blocks via its own load failure. The 80-file
cap, host execution and timeouts are unchanged. Whether the MODEL reads the ⚠️ and repairs the
leftover is a behaviour question for a campaign, not claimed here.

## Consumers (repo root, baseline -> after Amendment 1)

    finishGateEntry 5/0 (+3 known-open) -> same    finishGateGoalEntry 4/0 -> 4/0    finishGateHost 10/0 -> 10/0
    gateSoundness 8/0 -> 8/0    loadSweep 12/0 -> 3/9 (first repair) -> 12/0 (Amendment 1)
    verifyExportsGoal 6/0 -> 6/0    writeExportNote 6/0 -> 6/0    goalScope (new) 16/0
