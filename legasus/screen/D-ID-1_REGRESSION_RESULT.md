# D-ID-1 — regression suite against the UNREPAIRED identity

Prereg: `D-ID-1_PREREG.md` @ 1c3a2b1c + Amendment 1 @ 3e14f827, both frozen before the suite existed.
Suite: `server/did1.regression.mjs`. Evidence: EH1 run `53222095`, SEALED.
cid1 NOT written. Nothing repaired. Identity under test: the shipped `evaluate(dir).candidateTree`
(`git rev-parse HEAD^{tree}`), measured through the shipped path.

The milestone was never 19/19 green. It is this: where, exactly, the old identity breaks the contract.

## Controls (all held)

    oracle: a copy compares SAME .......................... yes
    oracle: a one-byte change compares DIFFERENT ........... yes
    readiness: an identity is produced on an own repo ...... yes

Every row's precondition was established by the oracle first: "same snapshot" rows really were the
same snapshot, "mutation" rows really changed it. No row passed or failed vacuously - and two rows
that held ONLY because the identity named the parent repository are labelled HOLDS_VACUOUSLY.

## Results by the property violated, with the boundary responsible

This regroups the suite's own summary, which grouped by the row's DECLARED tag: M3/M4 were listed
under INVARIANCE but violate AVAILABILITY. The per-row outcomes in the sealed log are unchanged.

**AVAILABILITY - identity construction**
- M3: a readable candidate with no repository anywhere → no identity
- M4: the same with a commitless enclosing repository → no identity

**INVARIANCE (same snapshot, different identity) - identity construction**
- M1 BARE: identical candidate under P1 vs P2 → the identity is each PARENT's tree
- M5 BARE: the parent's HEAD moves, the candidate is untouched → identity changes
- M16: the same bytes with vs without their own `.git` → different identities
- held only vacuously (the identity named the parent): M2 BARE, M6 BARE
- held genuinely: M1/M2/M5/M6 OWN, M12 (`.git` internals), M14 (empty dir)

**FIDELITY (different snapshot, same identity) - identity construction**
- M7 content, M8 add/remove, M9 rename, M10 CRLF↔LF, M11 `.gitignore`/`.gitattributes`/`.github`:
  every one is violated when UNCOMMITTED (own repo) and in the BARE shape; every one holds once
  committed. This is D-PROP-1's defect, mapped across every kind of mutation.
- **M11, ignored file, COMMITTED: violated.** With `*.log` in the candidate's own `.gitignore`,
  `debug.log` is readable at `/candidate`, and `git add -A` + commit still leaves it out of HEAD.
  Committing everything does NOT make `HEAD^{tree}` the snapshot - a counterexample to "make the
  agent commit before evaluation" as a repair.

**REPRESENTABILITY - identity construction**
- M15: a file named `odd.` (unrepresentable on Windows) is present and an identity was RETURNED.
  The contract requires UNAVAILABLE.

**PRESERVATION - WORKSPACE construction (not an identity defect)**
- M17, through the real `runBatch`: t1 RETAINed; the accepted baseline AND t2's starting directory
  are missing `.gitattributes`, `.github/workflows/ci.yml` and `.gitignore`. Counterexample
  established for batch.js:189/:269's substring filter. Note what it did NOT drop: `debug.log`, a
  file git ignores, was carried forward - the defect is the filter, not git's ignore rules.

**CONSISTENCY - evaluation consistency**
- M18: the candidate was rewritten from the host 4.0 s into a 9.9 s evaluation. The check PRINTED
  THE MUTATED BYTES, the verdict was PASS, and no error was raised. The identity was taken once,
  before the checks.

**BINDING - receipt binding**
- M19: the check saw `"UNCOMMITTED WORK"`; the receipt's tree contains `"CANDIDATE"`. The receipt
  names a snapshot the check never observed.

**Not measured**
- M13 symlink: `EPERM` - this machine cannot create symlinks without Developer Mode/admin. The
  link-text-versus-destination decision (Amendment 1) is therefore UNTESTED here, not passed.
- M14 exec bit: Windows has no exec bit to flip; declared blind spot.

## Predictions frozen in the prereg, scored

    correct   M1, M5 violated in the BARE shape
    correct   M3, M4 violated as UNAVAILABLE
    correct   M7, M8, M9, M10 violated when uncommitted
    correct   M17 violated
    correct   M2, M6, M12 hold in the own-repo form
    UNSCORED  M13 - not measured (EPERM). The suite's scorer printed "WRONG"; that was my scorer
              treating "not measured" as "did not happen", the same error this project has paid for
              before. Corrected here.
    WRONG     M16 "expected to pass". M16 compares own-repo vs no-repo by definition; it has no
              own-repo-only form, and it is violated. My prediction error.
    NOT PREDICTED, observed: M11 (all three violated shapes, including committed+ignored), M15.
    (M18, M19 were added by Amendment 1 without a prediction.)

## What this establishes for the repair

The old identity fails the contract on four separate identity-construction properties
(availability, invariance, fidelity, representability) and the system fails three properties that
belong to OTHER boundaries (workspace preservation, evaluation consistency, receipt binding). They
are independent: a cid1 that passes every identity row still leaves M17 (the copy), M18 (no
before/after check) and M19 (the receipt field) to be repaired at their own boundaries.

Two results narrow the repair space:
- M11-ignored-committed rules out "commit before evaluating" - Git's view of the workspace omits
  what a check can read even when everything is committed.
- M18 shows the before/after comparison is needed, and also bounds it: the mutation here landed
  mid-check; a change-and-revert inside the interval would not be seen (Amendment 1's concurrency
  limit).

## Not established

One machine (Windows), one worker image, one instance per row. Symlinks untested. The identity was
measured only through `evaluate()`; `governance.js` and `d2.js` compute their own tree ids
(`rev-parse HEAD^{tree}`, `write-tree`) and were not run through this suite.
