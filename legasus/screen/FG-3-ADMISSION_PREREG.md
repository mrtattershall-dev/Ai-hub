# FG-3 ADMISSION — a `verified` finish is a receipt for work that happened

Frozen 2026-10-01, before agent.js or verifyProject.js change for this step. Repairs FG-1 row F1
(EH1 7114cb51: a goal file that loads but lacks the goal is Verified with ZERO landed writes, and branch
4 carries no landed-writes predicate). SUBJECT (F4) and RECEIPT (F5) stay red.

## The property

> For a goal that asks for a change to named files, the gate may stamp `Verified` only if at least one
> successful mutating write landed in the run. With zero landed writes the FIRST finish is refused once,
> with an instruction that says exactly that; a SECOND finish with still zero writes is allowed to END
> the run - but it is recorded UNVERIFIED ("no work landed"), never Verified.

fatal-09 #2: "a create/add goal cannot be met by a run that mutated nothing ... block it ONCE (the
plan-FILES gate's pattern) rather than three times". The once-only block is what keeps the one
principled exception alive - existing code already satisfying the goal - without letting it be
stamped as if the run had done the work.

## What "asks for a change" means (frozen, with its blind spot)

    mutating verb  /\b(add|create|implement|write|build|make|fix|change|update|refactor|rename|remove|
                   delete|extend|introduce|replace|move|convert|migrate)\b/i   AND   the goal names a file
    not covered    "Check that m.py returns 42 and report." - names a file, no mutating verb: the rule does
                   not apply and zero writes are fine (that is finishGateHost.test's goal; it must not change)
    blind spot     a goal that asks for work without one of these verbs ("s1_library.js needs checkout()")
                   is not admitted to the rule. Recorded; widening the list is a later, measured change.

## The mechanism (frozen)

    agent.js branch 4   landedWrites = the VERBATIM predicate already at ~5406:
                          steps where type==='tool', tool in write_file|edit_file|append_file, result starts "OK"
                        verify(WORKSPACE, { entry, goal, landedWrites })
                        if v.admission === 'NO_WORK':
                            first time  -> blocked(why, instruction); run.noWorkBlocked = true
                            second time -> run.finishKind = 'unverified-no-work'; a note "Finished UNVERIFIED:
                                           no write landed in this run, so nothing could have satisfied the
                                           goal"; status 'done'; the Verified note is NOT emitted
    verifyProject.verify  accepts landedWrites (undefined = unknown = rule not applied, so every existing
                        caller is unchanged); when the goal asks for a change AND landedWrites === 0:
                        ok=false, admission='NO_WORK', one problem naming it. All other evidence is still
                        collected and reported, so the model sees that the file runs AND that nothing landed.
    The rule lives in verify() so it is measurable without the hub; agent.js only supplies the count and
    owns the once-only policy (gate state).

## Rows (frozen) and predictions for the CURRENT tree

    row  level     construction                                            current        required
    A1   verify()  goal "Add checkout... s1_library.js"; file loads, lacks it;  ok (Verified)  NOT ok, admission NO_WORK
                   landedWrites=0
    A2   verify()  same, landedWrites=1                                       ok             ok (unchanged)
    A3   verify()  "Check that m.py returns 42 and report.", landedWrites=0   ok             ok - no mutating verb
    A4   verify()  landedWrites undefined (every existing caller)             ok             ok - rule not applied
    A5   hub       scripted model: `finish` at once, twice; goal as A1;       first finish:  1st finish BLOCKED (error step
                   file present without checkout                             Verified (node) names "no write"); 2nd: done,
                                                                                            finishKind unverified-no-work,
                                                                                            NO "Verified (" note
    A6   hub       scripted model writes checkout into the file, then finish  Verified       Verified (unchanged)
    A7   hub       finishGateHost's own goal, zero writes, unbounded           Verified       Verified (unchanged)
    F4   SUBJECT   entry fall-through                                         Verified       STILL Verified - red
    F2/F3/F6-/F7/F8  SCOPE rows and controls                                                  unchanged

Hub rows drive the REAL hub exactly as finishGateHost.test does (fakemodel.mjs replies, startHub,
AGENT_APPROVAL_MODE=build, unbounded so the host verifier runs). The forced-finish hatch (3 blocks) is
untouched: NO_WORK blocks once and then yields to UNVERIFIED on its own.

## Consumers

The eight from FG-2 (incl. goalScope.test) plus finishGateHost.test's "the gate verified the project"
assertion, which is exactly A7. Re-run after; counts identical.

## Not claimed

That the UNVERIFIED finish is kept out of the training corpus - fatal-09 notes both archive cases entered
it labelled verified; the corpus filter reads finishKind (agent.js ~3742) and is checked in RECEIPT, not
here. That an edit which landed on the WRONG file counts as work: it does (a write landed); whether it
was the goal's file is SUBJECT's question.
