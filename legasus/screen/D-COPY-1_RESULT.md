# D-COPY-1 — RESULT: construction now preserves the snapshot

Prereg `D-COPY-1_PREREG.md` @ 4bec21ce (frozen before batch.js changed). Oracle: cid1.mjs (accepted,
reconciled at bbdc50cc), unwired from the evaluator throughout. D-CONS and D-BIND untouched.

## Staged evidence, in the frozen order

    BEFORE  EH1 3675fddd   unrepaired batch.js
            ordinary layout   cid1 candidate 631d5c06...  baseline 86587d38...  t2-start 86587d38...  -> DIFFER
                              dropped exactly as predicted: .gitignore .gitattributes .github/workflows/ci.yml
                              .gitconfig nested/.github/x.yml; kept foo.git, README.md, src/...; excluded
                              .git/ and nested/.git/                                    MUST-FIRE: FIRED
            ancestor layout   workspaces under ".gitlab-runner": the baseline was NEVER CREATED (0 files),
                              t2 started from an EMPTY directory, its start commit failed, t2 = EVAL_ERROR
    REPAIR  batch.js :189 and :269 judge each path RELATIVE TO THE COPY ROOT with the shared predicate
            server/snapshotPath.mjs (isExcludedRelPath); cid1.mjs uses the same isGitComponent.
    AFTER   EH1 a261a051
            both layouts      cid1 candidate == baseline == t2-start == 631d5c06...      matrix EXACT
    SUITE   EH1 14779b72 (cid1 mode)
            M17 PRESERVATION  HOLDS (both rows)          <- repaired by D-COPY
            M18 CONSISTENCY   VIOLATED                   <- still red, D-CONS
            M19 BINDING       VIOLATED                   <- still red, D-BIND
            every identity row still holds
    CONSUMERS  (repo root, before -> after)
            batch 24->24, batchAcceptance 27->27, batchReport 18->18, enduranceRecovery 28->28,
            statusContract 29->29 - all 0 failed both times

## A prediction that was partly wrong

The prereg predicted the ancestor case would "silently restart from the seed". Observed: the baseline
was never created and t2 became EVAL_ERROR - LOUD, but MISATTRIBUTED: losing the whole snapshot
surfaced as an evaluation error, not as "the baseline was lost". A task WITH a seed would have
continued silently from it. Either way the old code could not tell construction failure from
evaluation failure; the repair removes the cause, not that ambiguity.

## Reading the suite's own output correctly

- It prints `WRONG  M17 STAYS RED`. That is Amendment 2's prediction for the cid1-only stage; D-COPY
  exists to falsify it. The staged evidence working, not a prediction failure.
- Run 14779b72's M17 note says "SAME (identity would hide the copy defect!)" - a label that assumed
  the defect. The snapshots really were equal. The label is fixed (it now warns only when the oracle
  and cid1 disagree); the sealed run keeps the old wording.

## The shared predicate, and its proof

`snapshotPath.mjs` is pure (no fs, no identity). 23 cases pass (snapshotPath.test.mjs), including
`a\.git\b` excluded, `.git-blame-ignore-revs`/`.GIT`/`foo.git` included, and ABSOLUTE paths REFUSED
(judging one is the defect). cid1's 24 unit tests are unchanged and green; the mutant harness now
copies every module the tests load and counts only a NAMED failing test as a kill (a crash is
APPARATUS) - the prefix-.git mutant, now aimed at the shared predicate, is still CAUGHT.

## Not established

Copy atomicity (a write during cpSync) - D-CONS territory. Symlinks in the candidate not exercised
(EPERM here). Empty directories and modes not judged, by design. The audit copies (batch.js :348,
acceptance.js capture) keep everything on purpose and were not changed.
