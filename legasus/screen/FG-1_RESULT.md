# FG-1 — RESULT: four finish-gate defects are LIVE on candidate-0

Prereg `FG-1_PREREG.md` @ 96111eec. Probe `server/fg1.probe.mjs`, EH1 run `7114cb51` (SEALED).
Nothing repaired. verifyProject.verify() called as shipped; the gate's entry selection reproduced
verbatim from agent.js branch 4; the presence of a landed-writes predicate READ from agent.js source.

## Controls (both hold, so the rows mean something)

    F6+  a complete goal (file holds checkout/available, loads, runs)   -> Verified
    F6-  the goal's OWN file throws on load                              -> blocked (load sweep + node crash)

## Rows, by the boundary responsible

    row  boundary   construction                                     candidate-0, unrepaired
    F1   ADMISSION  zero landed writes; file exists, loads, lacks     VERIFIED. "all 1 source file(s) pass a syntax
                    the goal (the 8e7cf9aa shape)                     check; all 1 module(s) load; node s1_library.js
                                                                      ran and exited cleanly". Branch 4 carries NO
                                                                      landed-writes predicate (read from source).
    F2   SCOPE      the goal's file is clean; an unparseable          BLOCKED, grounded in junk.js - a file the goal
                    leftover junk.js elsewhere                        never named.
    F3   SCOPE      python goal; its file and its test pass; an       BLOCKED by whole-workspace pytest, failing on
                    unrelated test_other.py fails                     test_other.py.
    F4   SUBJECT    goal names s10_desk.js (never written), then      VERIFIED on s1_library.js - the entry fell
                    s1_library.js (exists, runs)                      through to a file the goal did not ask to create.
    F5   RECEIPT    what the Verified note names                      the entry: yes. The set swept: a COUNT only
                                                                      ("all 2 source file(s)"). An identity: no.

All four of fatal-09's gate defects reproduce here. The load sweep (c8c3ff2f) and the export probe
changed none of them: they add evidence about files, not discipline about WHICH files or WHETHER anything
was done. F5 is the same shape as M19 was for the evaluator: a receipt that cannot tell a reader what
object it is about.

## Consumer baseline, recorded BEFORE any repair (repo root)

    finishGateEntry 5/0 (3 known-open)   finishGateGoalEntry 4/0   finishGateHost 10/0
    loadSweep 12/0   verifyExportsGoal 6/0   writeExportNote 6/0
    gateSoundness: its own format - see the line appended below after it was run in full

## What the probe did NOT measure

The 3-block / forced-finish route and the blocked() wording live inside drive() and need the hub to
run; they are characterized by source reading only (prereg) and will be measured when their repair
steps come (WORDING, ESCAPE). F1's refusal will be built in agent.js (verify() cannot see writes); its
after-measurement therefore needs either a drive()-level harness or a verify() input that carries the
landed-write count - decided in the ADMISSION prereg, not here.

## Next (one claim, one prereg each, in fatal-09's order)

    SCOPE (F2, F3) -> ADMISSION (F1) -> SUBJECT (F4) -> WORDING -> RECEIPT (F5) -> ESCAPE -> symbol check (advisory first)

    gateSoundness (run in full, own format): 8 passed, 0 failed, 0 known-open
