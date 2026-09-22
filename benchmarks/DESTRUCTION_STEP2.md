# STEP 2 — the mutation topology, and the answer to the convergence question

Owner's question, kept in front the whole way:

> Where, if anywhere, does every repository-mutating route converge after preservation evidence
> could be required but before the mutation becomes real?

**Answer: nowhere.** Every route reaches the same primitives (`writeFileSync`, `exec`, git), and by
the time it gets there no preservation evidence has been assembled on any route. The only thing that
resembles a shared boundary is the main loop's pre-tool checkpoint, which is a ROLLBACK substrate,
not a decision, and which three routes never pass through.

Measured read-only on `ai-coding-hub` at trunk. Nothing changed.

## CORRECTION TO STEP 1 FIRST

Step 1 said the hub "warns and writes anyway". **That was true at set F and is false at HEAD.**
Commit `4764bde` (2026-09-11, "Stop the hub silently destroying and misreporting the model's work")
added a refusal at `agent.js:3475-3491`: after a `write_file`/`edit_file`, re-read the file, diff
`lostDefs`/`lostExports` against the before-image, and if anything is missing that the model did not
declare with `REMOVE: <names>`, **write the before-image back** and return an ERROR. Its own comment
dates it: "SET F: WARNING WAS NOT ENOUGH ... 7 of 8 warnings ended with the names still missing."

So the baseline I proposed already exists, built by the hub in response to the exact incident.

    set F   pre-refusal    16 regressed of 48 worked-when-written   33%
    set G   post-refusal    6 regressed of 33                       18%
    set H   no regression run exists

Set G's provenance carries a caveat: its first `regress.txt` was committed EMPTY (`0130652`, regress.mjs
did not check spawn status); the 6 is from the hardened re-run. Two datapoints, not three.

## THE ROUTES

    route            requester   authorizer            before-image   preservation   decides?   checkpoint   primitive
    ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    write_file       model       AUTO_TOOLS            yes*           lostDefs+Exp   REFUSE**   yes          writeFileSync 551
    edit_file        model       AUTO_TOOLS            yes*           lostDefs+Exp   REFUSE**   yes          writeFileSync 664-773
    append_file      model       AUTO_TOOLS            NO             fragment only  unlink     yes          writeFileSync 611
    download_file    model       AUTO_TOOLS            NO             none           no         yes          writeFileSync 991
    run_command      model       classifyCommand       NO             none           permission yes          exec (shell)
    run_python       model       classifyPython        NO             none           permission yes          writeFileSync 1087 + exec
    spawn_subtask    model       SUBTASK_MAX_DEPTH=2   NO             none           no         NO           re-enters every tool above
    git_undo         model       gated (human)         commits dirty  n/a            approval   yes (907)    git reset --hard
    git_commit       model       gated (human)         n/a            n/a            approval   is one       git commit
    end-of-run repair hub        none                  git history    parse only     no         after (3858) writeFileSync 3812/3814
    POST /upload     human/UI    none                  NO             none           no         NO           writeFileSync 4702
    POST /upload-zip human/UI    none                  NO             none           no         NO           extract
    DELETE /files    human/UI    none                  NO             none           no         NO           unlinkSync 4727
    line 912         ?           ?                     NO             none           no         ?            writeFileSync (unattributed)

    *  only when path matches /\.(py|c?js|mjs)$/i - every other file type has no before-image
    ** write-then-rollback: the bytes land, are re-read, and are restored. The mutation is real
       for a window. Overridable by the model declaring REMOVE: <names>.

Bookkeeping routes (`remember` -> notes, `task_*` -> ledger, run records, traces) mutate files but not
the project; listed as out of scope, not as safe.

## THREE STRUCTURAL BYPASS CLASSES, NOT ONE

**1. The refusal is route-local.** It lives at one place in the MAIN tool loop and fires only for two
tools and four file extensions. Routes that reach the same primitive without it:

    append_file       no before-image, so the DUPLICATE guard at ~3500 is skipped too - which is
                      exactly the recorded escape: guard refused 27 times, 20 appended copies survived
    download_file     can overwrite a source file with fetched bytes; checkpointed, never checked
    spawn_subtask     agent.js:2690 calls tools[tool](args) DIRECTLY. Zero preservation guards in
                      2600-2720, AND no checkpoint. A subtask's write_file is unguarded and
                      unrecoverable by the main loop's mechanisms.
    shell             classifyCommand denies only recursive/forced rm; mv, cp, plain rm, git and
                      redirects sit in BUILD/GIT_OK. A permission check, never a preservation one.
    HTTP routes       the editor pane writes and deletes with nothing between it and the disk
    repair            restores the FIRST checkpoint version that PARSES (py_compile / node --check),
                      with no preservation check - so it can restore a version lacking what later
                      goals added, which set D recorded

**2. Declaration override.** `REMOVE: a, b` in the tool args exempts those names. A model that has
learned the incantation can wave a loss through. Whether it does is an empirical question for step 4.

**3. Timing.** The refusal is write-then-restore. Between the write and the re-read the destroyed
state is on disk, where a subtask, a concurrent tool, or the end-of-run repair could observe it.

## THE UI'S AUTHORITY CLAIMS, AS CONFORMANCE TARGETS

The settings page states guarantees. Each was checked against its deciding path:

    "strict: only read-only runs unattended;      classifyCommand/classifyPython called on BOTH
     anything that executes waits for you"        agent shell routes (main 3342, subtask 2681, which
                                                  STOPS the subtask on anything not allow).  HOLDS.
    "at most 12 runs may start automatically      enforced at ONE site, supervisorBrake, line 3930,
     per hour"                                    the supervisor's auto-start tick.  HOLDS there.
    "stops after 5 hops from something you        MAX_GENERATIONS=5 on supervisor lineage - but
     asked for"                                   spawn_subtask has ITS OWN counter, SUBTASK_MAX_DEPTH=2.
                                                  ONE UI SENTENCE, TWO LINEAGE COUNTERS. True for
                                                  the route it describes; subtask chains are not
                                                  "hops" in that sentence's sense and are capped
                                                  separately. Not a violation; an under-specification.

These are the same shape as the preservation question - a claim enforced by a route rather than by
the property - and they will need the same treatment. Not this experiment.

## WHAT THIS MEANS FOR THE COMPARISON

The problem has moved. It is not "the detector is too weak"; it is that **correctness is enforced by
routes while the property belongs to effects.** The hub has no place where

    what is changing  +  what must survive  +  what evidence exists  +  who may act

are all available before state becomes real.

So the baseline (step 3) is now precisely defined: **take the existing refusal and make it
route-complete** - apply it on append, download, subtask, and repair; extend it to all source
extensions; decide-before-write rather than write-then-restore. That is the strongest credible small
baseline and it is what Legasus has to beat.

Legasus's candidate contribution is now equally precise: an evidence-bearing mutation boundary that
every route must pass, where the preservation obligation is part of what is required to act - the
"governed workspace transaction". The removal control (step 5) then asks the only question that
matters: with the route-complete baseline in place, does removing the shared boundary reopen a
historical bypass?

## NOT ESTABLISHED

- Which routes the **six set G survivors** took. That needs `measurements/replay/regress.mjs` re-run
  on set G with per-route attribution, and it is the step-4 specimen work.
- Whether any of the 7 BEHAVIOUR_CHANGED cases are reachable by ANY symbol-level check. Probably not,
  and that is where a richer preservation obligation would have to earn its place.
- Line 912's route.

Nothing built. Trunk untouched. Specimen frozen. Steps 3-5 get their preregistration from this map.
