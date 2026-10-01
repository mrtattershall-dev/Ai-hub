# D-BIND-1 — RESULT: the evidence names the exact object that was judged

Prereg `D-BIND-1_PREREG.md` @ c24cde0d, frozen before evaluator.js changed. The COMMIT boundary (K8)
is untouched and still red, as frozen.

## The repair

    evaluator.js    candidateTree() - the git call, and the only site that ever COMPUTED a receipt
                    identity - is deleted, with the "no git tree" refusal. The receipt is the subject
                    D-CONS established: receipt.subject = C0, receipt.candidateTree = C0 (deprecated
                    alias, equal by construction, so every transport site carries the subject
                    unchanged). cid1 refused -> both null, EVALUATION_ERROR, no fallback.
    acceptance.js   its three receipt objects transport `subject` from the verdict they summarise.
    evaluator.test  the two assertions that encoded the old contract (40-hex receipt; a repo-less
                    candidate is refused) rewritten to the new one. Nothing else.
Git is no longer consulted by evaluate() at all. The remaining HEAD^{tree} readers in server/ are the
two START anchors (batch.js:281, governance.js:105 - the `git reset --hard startRef` restore, which is
the commit boundary's business) and experiment scripts recording their own start trees.

## Staged evidence (EH1, every run SEALED and verifyRun-clean)

    row  construction                             BEFORE 8725480d                      AFTER 6d04ec16
    B0   ordinary PASS                            candidateTree ≠ subject (git tree)   HOLDS
    B1   D-PROP-1 reversed, inputs unchanged      receipt = the tree never judged      HOLDS: receipt = identity of the
                                                                                        bytes the check printed (K), ≠ C
    B1i  ignored file, all committed              receipt excludes it (git view)       HOLDS
    B2   D'-1 A5 reversed, 4 parents              3 receipts; P0/Pc refused            ONE receipt, all four PASS
    B3   HEAD moved, snapshot unchanged           receipt follows HEAD                 HOLDS
    B4   live mutated after the verdict           alias ≠ subject                      HOLDS: receipt is the JUDGED object
    B5   subject unavailable, git HEAD present    FELL BACK TO GIT (candidateTree =    HOLDS: closed, both fields null
                                                  HEAD^{tree})
    B6   consumers, through runBatch              acceptance carries no subject;       HOLDS: verdict.subject ==
                                                  baselineTree = git tree ≠            acceptance.subject == surviving
                                                  cid1(baseline)                       == baselineTree == cid1(.accepted-
                                                                                        baseline)
    B7   D-CONSUME-1 finding 1 reversed           1 label disagreement                 0
    K8   mutation between verdict and commit      RETAINED C1, receipt = C0            STILL RED - by design

B6 is the chain the whole series was for: the identity the evaluator named at admission is the identity
acceptance records, the identity the surviving re-check records, the identity batch stores as the
baseline, AND the identity of the baseline directory itself (D-COPY makes that last equality possible).

    SUITE  f5c5bc13 (cid1 mode)   M17, M18, M19 all HOLD; every identity row holds; nothing violated
           in any of the six properties. M13 symlinks and M14 exec bit remain NOT_RUNNABLE here.

    CONSUMERS (repo root, baseline -> after)
           evaluator 17/0 -> 17/0 (the two rewritten assertions pass; the other 15 unchanged)
           acceptance 27/0 -> 27/0     batch 24/0 -> 24/0     batchAcceptance 27/0 -> 27/0
           batchReport 18/0 -> 18/0    statusContract 29/0 -> 29/0    enduranceRecovery 28/0 -> 28/0
           governedRun 24/0 -> 24/0 (line 104 "both verdicts name different trees" passes with cid1 values)
           d2Integration 46/2 -> 46/2 - the SAME two pre-existing status-naming failures, no others

## Three oracles that assumed the receipt was a Git tree - recorded, not hidden

1. **dprop1.probe.mjs**, re-run UNMODIFIED after the repair: prints `candidateTree=cid1:9d1c...`,
   `=== C_tree ? false === K_tree ? false`, then declares itself NOT_EVALUATED because its "control
   fired" criterion is `recorded === C_tree` - a git tree, which a cid1 receipt can never equal. Its
   control's `verdict=FAIL` is its own check's design (exit 0 only when the subject says CANDIDATE;
   the control's subject says COMMITTED). The probe can no longer evaluate its own question; its
   construction is row B1, which HOLDS. Output preserved in the commit message's referenced run.
2. **The suite's M19 row** looked the receipt up with `git show <receipt>:subject.js`. Run 8fdad31c
   (sealed, kept) shows it reading `ERR:` and staying red for that apparatus reason. The row now
   implements Amendment 1's oracle directly - rebuild a snapshot holding the bytes the check printed
   and compare identities - and carries a NEGATIVE control (a twin holding the COMMITTED bytes must
   not match; the row is APPARATUS_FAULT if the oracle cannot discriminate). Run f5c5bc13 is the
   result under that oracle.
3. **dprime1.probe.mjs** reproduces the git line verbatim and never calls evaluate(); it cannot
   reverse by construction and was not re-run as evidence (frozen in the prereg).

The suite also prints "WRONG M17/M18/M19 STAYS RED": those are Amendment 2's cid1-only-stage
predictions, falsified on purpose by D-COPY, D-CONS and D-BIND in turn. Not prediction failures.

## Historical receipts

Journals and audits already on disk name git trees and are not rewritten. The two eras are
distinguishable by shape: a cid1 subject carries the `cid1:` prefix; a 40-hex value is a git tree
from before D-BIND-1.

## Explicitly NOT claimed

- K8: a correct receipt does not make the retained state the judged state. The commit boundary
  (verdict -> identity -> commit) is frozen next, independently.
- startTree / startRef stay git-derived: they anchor the restore, which belongs to that boundary.
- d2's own tree ids are untouched.
- Cross-platform: M13 (symlinks) is still unmeasured on Windows.
