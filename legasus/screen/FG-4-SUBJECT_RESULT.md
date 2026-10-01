# FG-4 SUBJECT — RESULT: the gate judges the file the goal names, or refuses

Prereg `FG-4-SUBJECT_PREREG.md` @ 80174bbe, frozen before agent.js changed. RECEIPT (F5) untouched.

## The repair

    server/goalEntry.mjs   NEW, pure: goalEntry(goal, exists) -> { entry, missing }. The entry is the FIRST
                           code file the goal names; a named file that does not exist is `missing` - a
                           refusal, never a fall-through to the next named file. Remove/delete/drop goals
                           treat an absent named file as satisfied. 9 unit tests.
    agent.js branch 4      the `.find(exists)` line is replaced by goalEntry(); a missing target blocks
                           BEFORE verify() runs, in every configuration (a filesystem fact, not host
                           execution), and counts toward the 3-strike cap like any other block.

## Staged evidence (EH1, sealed and verified)

    row  level   construction                                     BEFORE 87a6ac5d             AFTER 2abe9ff4
    S0   verbatim the shipped .find(exists) on the F4 workspace   falls through to s1          (reference, unchanged line)
    S1   pure    named target missing                             REFUSES (unwired)            REFUSES
    S2   pure    one named file, exists                           entry                        entry
    S3   pure    remove-goal, absent file                         exception holds              holds
    S4   pure    no named code file                               no entry, no refusal         holds
    S5   hub     s10_desk.js never written; the model writes      Verified (node) on            blocked, naming s10_desk.js as
                 s1_library.js and finishes (ADMISSION satisfied) s1_library.js - the defect    missing; 2 blocks; never Verified
    S6   hub     the model writes s10_desk.js, then finishes      Verified on s10_desk.js      Verified on s10_desk.js

S5 is the fatal-09 path-3 case with ADMISSION already satisfied (a write landed - on the wrong file), so
it isolates SUBJECT: before, a Verified receipt about a file the goal never asked for; after, a refusal
that names the file the goal did ask for.

## Apparatus note

The first FG-3 edit to agent.js converted the whole working copy to CR LF (6,672 CRs; git normalised the
commit, so the repository was never wrong). Recorded as HAZARDS hazard 17 (90ff01d6). This step's edits
were CR-checked before and after and the diff was confirmed to be exactly two hunks (the import and
branch 4) before anything loaded the file.

## Not claimed

That namedFiles() finds every file a goal means (prose naming nothing is S4). That the model, told which
file to create, creates it - a campaign question. The 3-strike forced finish after repeated refusals is
unchanged (ESCAPE is a later step).

## Consumers (repo root, baseline -> after)

    finishGateEntry 5/0 (+3 known-open) -> same    finishGateGoalEntry 4/0 -> 4/0    finishGateHost 10/0 -> 10/0
    gateSoundness 8/0 -> 8/0    loadSweep 12/0 -> 12/0    verifyExportsGoal 6/0 -> 6/0    writeExportNote 6/0 -> 6/0
    goalScope 16/0 -> 16/0    goalEntry (new) 9/0
