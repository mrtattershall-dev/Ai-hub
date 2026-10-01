# FG-1 — the finish gate as the hub's own authority receipt

Frozen 2026-10-01, before any probe exists and before agent.js or verifyProject.js change. Owner: this
session (see COORD). The acceptance/batch/governance spine is another session's (COMMIT-2); nothing here
touches it.

## Why this seam, and how it fits the pieces already on the table

The D-chain (D-ID → D-COPY → D-CONS → D-BIND, closed today) established what a receipt must do for the
CAMPAIGN evaluator: name the exact object judged, be issued only for an object that was actually judged,
and never be grounded in something else. The SERVED HUB has its own receipt - the finish gate's
`Verified (kind): ...` note, which decides whether a run ends `done` - and fatal-09 (setH audit, 1,004
runs, 583 joined to a checker verdict) measured it failing every one of those properties:

    41% of verified finishes scored FAIL; 146 of 187 rested on "ran and exited cleanly" alone
    2 verified finishes had ZERO landed writes on the goal's file - both FAIL, both entered the corpus
    23 blocks were grounded in a file OTHER than the goal's (the whole-workspace syntax sweep)
    17 blocks from whole-workspace pytest; a latent entry fall-through can judge another goal's file

fatal-09 audited the `ai-coding-hub-indent` tree. candidate-0 has since gained the load sweep
(c8c3ff2f) and the export probe (`exportedName`, verifyExportsGoal.test). So the first step is to
re-establish which defects are LIVE here, on this tree - never to repair from the audit's numbers.

## Where the gate lives (read, not assumed)

    agent.js ~4596-4668   branch 4 of the finish gate: goalEntry = ledger.namedFiles(goal).find(exists)
                          -> verifier.verify(WORKSPACE, { entry, goal }) -> blocked() or the Verified note
    agent.js ~4479-4484   blocked(): finishBlocks++, an error step, a user-role instruction
    agent.js ~4675-4680   finishBlocks >= 3 -> forcedFinish, finishKind 'forced', "Finished UNVERIFIED"
    verifyProject.js      verify(): syntaxSweep(ALL files) -> loadSweep(ALL files, node) -> per-kind
                          branch; python: pytest over the WHOLE workspace when any test_*.py exists;
                          node: `node <entry>` then the export probe for "export X" goals only

## Rows (frozen), each with the boundary it belongs to and the CURRENT tree's predicted behaviour

    row  construction                                        boundary        current predicts      required
    F1   goal "add checkout() to EXISTING s1_library.js";     ADMISSION       Verified (node)       NOT verified: a
         file exists, loads, lacks checkout; run landed       (a receipt for                        create/add goal with
         ZERO successful writes (8e7cf9aa shape)              nothing judged)                       zero landed writes
                                                                                                    is refused ONCE, reason
                                                                                                    says so
    F2   goal's file s2.js clean; an unparseable leftover     SCOPE           blocked, grounded     finish proceeds; the
         junk.js elsewhere in the workspace                   (evidence about  in junk.js           leftover is a LOUD note
                                                              another object)
    F3   python goal; its own file passes; an unrelated       SCOPE           blocked by pytest     scoped: the goal's file
         broken test_other.py exists                                          of the whole tree     and its tests decide
    F4   goal names s10_desk.js, s1_library.js (that order);  SUBJECT         entry falls through   refused: the named target
         s10 was never written; s1 exists and runs            (judged a       to s1 -> Verified     s10_desk.js does not exist
                                                              different file)
    F5   any verified finish: does the note NAME what was     RECEIPT         names the entry and   names the entry, the
         judged - entry, the set swept, and an identity?                      a count ("13 files")  scoped set, and a cid1 of
                                                                                                    the judged files
    F6+  POSITIVE: a complete goal with landed writes         control         Verified              Verified (must not regress)
    F6-  NEGATIVE: the goal's OWN file crashes on load        control         blocked               blocked (scoping must not
                                                                                                    let this through)

Must-fire: F1, F2, F3, F4 must all reproduce on candidate-0 (or be recorded as NOT LIVE here, with the
commit that closed them). F6+ and F6- must hold before AND after every repair.

## Order of repair (fatal-09's ranking, one claim and one prereg each - never one patch)

    1  SCOPE      F2, F3   sweep and pytest scoped to the goal's named files + their dependency closure
                           (consumersOf/ requires graph exists in d2.js; reuse, don't reimplement);
                           unrelated breakage becomes a note, and the end-of-run repair keeps running
    2  ADMISSION  F1       refuse `verified` when zero successful mutating writes landed - block ONCE,
                           the plan-FILES gate's pattern, not three times
    3  SUBJECT    F4       a named target that does not exist is a refusal, not a fall-through
    4  WORDING    -        a block the goal's own file has already passed is reworded (fatal-09 #3)
    5  RECEIPT    F5       the Verified note carries entry + scoped set + cid1 - the D-BIND discipline
                           applied to the hub's own receipt
    6  ESCAPE     -        the 3-strike hatch opens without a 4th finish (fatal-09 #4)
    LAST  symbol check for "add X to EXISTING f" (fatal-09 #5): ADVISORY first, false-positive rate
          proven on the replay corpus (measurements/replay, 164+ scenarios) BEFORE it may gate

## Consumers, baselined BEFORE any change (repo root)

    finishGateEntry, finishGateGoalEntry, finishGateHost, gateSoundness, loadSweep, verifyExportsGoal,
    writeExportNote  - counts recorded in the FG-1 result before the first repair commit.

## Explicitly out of scope, and the next seam after this one

- The loop guard. fatal-09's own closing line: 350 of 583 runs never reached the finish gate at all;
  163 died to the two loop-guard routes at 6% and 0% scoring. Bigger than the gate; a separate seam.
- The ledger gate (3 blocks in 1,004 runs) and the entry FILE fix (228 -> 0, done): not re-fixed.
- A stricter exit-code gate: 7 of 9 non-zero-exit verified finishes scored correct. Not added.
- The finish gate executes model code on the HOST (finishGateHost.test records the bounding). Not
  changed here; the evaluator's container is the campaign path, not the served hub's.
