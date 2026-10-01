# D-COPY-1 — workspace construction preserves the snapshot

Frozen 2026-10-01, before batch.js is changed and before the probe exists. Owner: D-COPY (snapshot
preservation). cid1 (server/cid1.mjs, accepted D-ID-1 + RECONCILE bbdc50cc) is the oracle and stays
UNWIRED from the evaluator. D-CONS and D-BIND stay unrepaired.

## The property (tatte)

> Workspace construction must preserve every candidate entry included in the authoritative snapshot
> definition, such that immediately after construction cid1(source) === cid1(copy), independent of
> Git metadata, Git ignore rules, or names merely containing `.git`.

Acceptance is CONTENT equality through cid1, not file existence:

    C = cid1(candidate);  construct;  B = cid1(copy);  require C === B

## The construction sites (batch.js)

    :189  accepted workspace -> .accepted-baseline        (on RETAIN)
    :269  .accepted-baseline -> next task's workspace      (chain)
Both use `filter: (src) => !src.includes(sep + '.git')` - a SUBSTRING test on the ABSOLUTE path.
Not in scope: :348 (the timed-out partial's AUDIT copy, which deliberately keeps everything) and
acceptance.js capture() (audit copies of rejected candidates).

## Counterexample matrix (the positive control), and what the CURRENT filter predicts

    entry                        rule        current filter predicts
    .git/ (own repo)             excluded    excluded
    .git/objects/...             excluded    excluded
    .gitignore                   preserved   DROPPED
    .gitattributes               preserved   DROPPED
    .github/workflows/ci.yml     preserved   DROPPED
    foo.git                      preserved   preserved  (no separator before ".git")
    .gitconfig                   preserved   DROPPED
    nested/.git/HEAD             excluded    excluded
    nested/.github/x.yml         preserved   DROPPED
    ordinary files, deep paths   preserved   preserved  (negative controls)
    an empty directory           -           NOT JUDGED: cid1 does not identify empty dirs, and
                                             D-COPY must not broaden the identity definition

## A second counterexample, found while re-reading the copy sites (frozen now)

The filter tests the ABSOLUTE path. If ANY ancestor directory of the workspace has a name beginning
`.git` (e.g. workspaces under `...\.gitlab-runner\...`), every path matches - including the copy root
itself. Prediction for the CURRENT code: the baseline copy copies NOTHING; the next task finds no
baseline, silently starts from its seed (none), and the chain reports continuity it does not have.
This is ambient context again - in construction this time. The rule must be judged on the path
RELATIVE TO THE COPY ROOT.

## The rule (structural, never a string heuristic)

    Exclude an entry iff one of its path components, RELATIVE TO THE COPY ROOT, is exactly `.git`.

Centralized as a tiny pure path predicate (server/snapshotPath.mjs) used by BOTH cid1.mjs and
batch.js, so "exclude Git internals" cannot develop two meanings. The predicate is pure (no fs, no
identity); batch.js does not import cid1. cid1.mjs's behaviour must be unchanged by the refactor -
its unit tests, mutants and suite identity rows re-run as proof.

## Staged evidence required, in this order

    BEFORE (unrepaired)  probe: cid1(candidate) != cid1(baseline); matrix drops as predicted;
                         ancestor case copies nothing        ... M17 RED     MUST FIRE
    repair batch.js :189 and :269 with the predicate
    AFTER                probe: cid1(candidate) == cid1(baseline) == cid1(next task start), both
                         layouts; matrix exact                ... M17 GREEN
                         suite (cid1 mode): identity rows still hold; M18 RED; M19 RED
    CONSUMERS            batch tests baselined BEFORE the change, re-run AFTER, counts compared
If the unrepaired probe does NOT fire, the repair is not made.

## Out of scope, stated

Atomicity of the copy (a write during cpSync) - D-CONS's territory. Symlinks inside the candidate
are not exercised on this machine (EPERM, as M13). File modes and empty directories are not judged.

## Consumer baseline, recorded BEFORE batch.js changes (run from the repo root)

    batch.test.mjs              24 passed, 0 failed
    batchAcceptance.test.mjs    27 passed, 0 failed
    batchReport.test.mjs        18 passed, 0 failed
    enduranceRecovery.test.mjs  28 passed, 0 failed
    statusContract.test.mjs     29 passed, 0 failed

Note: run from server/, enduranceRecovery reports 21/1 - it reads legasus/screen/ENDURANCE-2_summary.jsonl
relative to the working directory. That is a cwd dependency of the TEST, not a defect in batch.js;
every before/after comparison here is run from the repo root.
