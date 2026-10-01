# FG-2 SCOPE — a finish block is grounded only in the goal's files and what they depend on

Frozen 2026-10-01, before verifyProject.js changes and before the probe exists. Repairs FG-1 rows F2
and F3 (EH1 7114cb51). ADMISSION (F1), SUBJECT (F4), RECEIPT (F5) stay unrepaired and are measured red
in the same run. Claim: the FG-1 claim block (verifyProject.js); adds server/goalScope.mjs (new).

## The property

> `verify()` may BLOCK a finish only on evidence about the goal's named files and their dependency
> closure. Breakage anywhere else in the workspace is reported LOUDLY as a note on the finish and
> never as a block. When the goal names no file, the scope is the whole workspace (today's behaviour).

The cost fatal-09 names is kept visible: a broken unrelated leftover is how a workspace poisons its
successors, so it is a NOTE a human and the model both see, and the end-of-run repair keeps running.

## The mechanism (frozen)

    server/goalScope.mjs   PURE: no git, no shell. scope(workspace, goal, entry) ->
        named    = ledger.namedFiles(goal) that exist, plus the entry
        closure  = named + every file reached by FORWARD static dependencies:
                   JS: require('./x'|'../x'), import ... from './x', dynamic import('./x') - resolved
                       with .js/.mjs/.cjs and /index.* ; python: `import m` / `from m import` where
                       m.py (or m/__init__.py) exists in the workspace
                   transitive, cycle-safe, bounded at 80 files like the sweeps
        tests    = test files that import a module in the closure, or named test_<m>.py / <m>_test.py
                   for a module m in the closure, or named by the goal
        {inScope, outOfScope, tests, named: boolean}   named=false -> inScope = all files
    NOT d2.consumersOf: that is the REVERSE graph (who depends on X) and reads `git ls-files`. The
    served hub's gate must not depend on git (the D-chain's lesson), and it needs the forward graph.

    verifyProject.verify():
        syntaxSweep / loadSweep run over ALL files as today, but a broken file OUTSIDE the scope lands in
        a new `notes` array ("OUTSIDE THIS GOAL: junk.js does not compile - leftover from earlier work")
        instead of `problems`. Inside the scope: a problem, as today.
        python: pytest runs on `tests` when any exist; `python <entry>` otherwise (today's fallback).
        An unrelated failing test is a note. The entry run itself is unchanged.
        `format()` renders notes after evidence so the model and the run record see them.

## Rows (frozen) and predictions

    row  construction                                                 BEFORE (7114cb51)   AFTER
    F2   clean goal file; unparseable junk.js elsewhere                blocked on junk     Verified; NOTE names junk.js
    F3   python goal; own test passes; unrelated test_other.py fails   blocked by pytest   Verified; NOTE names test_other
    F6-  the goal's OWN file throws on load                            blocked             blocked (unchanged)
    F7   NEW the goal's file requires ./util.js and util.js THROWS     blocked             STILL blocked - the closure
                                                                                          reaches util.js
    F7p  NEW python: s3_calc.py imports helper.py; test_helper.py      blocked             STILL blocked - helper's
         fails                                                                             test is in scope
    F8   NEW goal names NO file; a broken file anywhere                blocked             blocked (unchanged: whole
                                                                                          workspace is the scope)
    F9   NEW out-of-scope breakage is VISIBLE: the notes array and      n/a                 note present in verify()
         format() output carry it                                                          result AND in format()
    F1   ADMISSION (zero writes)                                        Verified            STILL Verified - red
    F4   SUBJECT (entry fall-through)                                   Verified on s1      STILL Verified - red
    F6+  complete goal                                                  Verified            Verified

If F7 or F7p turns green the closure is wrong and the repair is NOT accepted: scoping must never let a
dependency's breakage through. If F1 or F4 turns green, SCOPE leaked into a boundary it does not own.

## Consumers

The seven baselined in FG-1_RESULT.md, re-run after; counts identical, except that any assertion
asserting a block on an UNRELATED file is a changed-contract assertion and is named here if found
(none known before writing). finishGateEntry's 3 known-open stay known-open.

## Not claimed

The 80-file sweep cap, host execution of model code, and the pytest timeout are unchanged. The
dependency resolver is static: a `require(variable)` is not followed (recorded as a blind spot in
goalScope.mjs). Import-by-package-name (node_modules) is out of scope by construction.
