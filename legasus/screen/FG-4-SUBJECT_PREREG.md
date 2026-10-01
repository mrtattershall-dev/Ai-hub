# FG-4 SUBJECT — the gate judges the file the goal names, or refuses

Frozen 2026-10-01, before agent.js changes for this step. Repairs FG-1 row F4 (EH1 7114cb51: the goal
names s10_desk.js, never written, then s1_library.js; the entry FALLS THROUGH to s1_library.js and the
run is Verified on a file the goal did not ask to create). RECEIPT (F5) stays red. Commit order: after
FG-3 ADMISSION's result lands.

## The property

> The entry the gate judges is the FIRST code file the goal names. If that file does not exist, the gate
> refuses - "the goal names X, which does not exist" - and never substitutes another named file. The
> one exception is a goal whose verb is remove/delete: a named file that is absent is then satisfied, not
> missing, and the entry is the next named file (or none).

fatal-09 path 3, recorded as latent then: "If s10_desk.js was never written, the entry silently becomes
s1_library.js and the goal can pass on a file it never touched." FG-1 showed it is live on candidate-0.
D-BIND's lesson one level up: a receipt that names a different object than the one asked about is worse
than no receipt.

## Where it lives

    agent.js branch 4   goalEntry = ledger.namedFiles(goal).find((f) => CODE_EXT.test(f) && existsSync(f))
                        -> the `.find(exists)` IS the fall-through.
    The replacement is a small pure function, server/goalEntry.mjs: goalEntry(goal, exists) ->
        { entry, missing }  where missing = the first named code file that does not exist and the goal's
        verb is not remove/delete. agent.js blocks on `missing` BEFORE calling verify(): a block, counted
        toward the 3-strike cap like any other (a missing target is not a once-only condition - every
        finish until it exists is premature). verify() is unchanged in this step.

## Rows (frozen) and predictions for the CURRENT tree

    row  construction                                                      current               required
    S1   goal names s10_desk.js (missing), s1_library.js (exists, runs)     entry=s1, Verified    BLOCKED: "s10_desk.js does
         (the F4 shape; writes landed on s1 so ADMISSION does not fire)                           not exist"; no Verified note
    S2   goal names s1_library.js only; exists                              entry=s1              entry=s1 (unchanged)
    S3   goal "Remove old.js and update index.js"; old.js absent, index.js  entry=index.js        entry=index.js (exception)
         exists
    S4   goal names NO code file                                            entry undefined       entry undefined (unchanged)
    S5   hub: scripted model writes s1_library.js, finishes; goal as S1     Verified on s1        blocked each finish; never
                                                                                                  Verified; forced after 3
    S6   hub: scripted model writes s10_desk.js (the named target), finish  Verified (entry s10)  Verified (unchanged)
    F6+/F6-, A5, A7   earlier controls                                                            unchanged

## Consumers

The eight gate consumers (FG-2/FG-3 baselines), plus goalEntry.test (new). finishGateEntry.test and
finishGateGoalEntry.test are the ones that encode entry selection; any assertion that depends on the
fall-through is a changed-contract assertion and is named in the result if found (none known).

## Not claimed

That namedFiles() extracts every file a goal means (its regex is the existing one; prose like "the
library module" names nothing and is S4). That the model is told WHICH file to create before it
finishes - the block's instruction says it; whether the model acts on it is a campaign question.
