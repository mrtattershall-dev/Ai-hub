# D-CONS-1 — RESULT: one immutable object per judgment

Prereg `D-CONS-1_PREREG.md` @ 9165f9e4 (claim chosen BEFORE M18 was seen under a repair: IMMUTABLE
JUDGMENT, not endpoint stability). D-BIND and the commit boundary untouched and still red.

## The mechanism (evaluator.js)

    C0 = cid1(workspace)                       -> verdict.subject
    private snapshot = copySnapshot(workspace)  (D-COPY's rule)   require cid1(snapshot) === C0
    checks run against the SNAPSHOT, mounted read-only - never the live workspace
    S1 = cid1(snapshot), C1 = cid1(workspace)
    authorizes only if S1 === C0 AND C1 === C0; otherwise overall EVALUATION_ERROR, every verdict
    field a consumer might act on neutered, and the checks' results kept under auditOfSubject

The endpoint comparison survives only as the HAND-OFF guard: the caller acts on the live workspace,
so a judgment of C0 must not reach C1.

## Staged evidence (EH1, all sealed)

    row  mutation                               BEFORE d8318c57                    AFTER 23d798c0
    K0   none                                   PASS, no subject                   ADMISSIBLE, subject = C0
    K1   bytes change mid-check                 AUTHORIZED - check printed MUTATED NOT AUTHORIZING
    K2   file added                             AUTHORIZED                         NOT AUTHORIZING
    K3   file removed                           AUTHORIZED                         NOT AUTHORIZING
    K4   rename, bytes equivalent               AUTHORIZED                         NOT AUTHORIZING
    K5   mutate -> restore                      PASS, endpoints EQUAL, the check   ADMISSIBLE; endpoints EQUAL;
                                                read ORIGINAL then MUTATED         the check read ORIGINAL twice
    K6   check writes /candidate                refused (read-only)                refused
    K7   mutation, then timeout                 EVALUATION_ERROR                   EVALUATION_ERROR
    K8   mutation after the verdict, before     RETAINED, re-check FAIL            RETAINED, re-check FAIL
         acceptance commits                     (red)                              STILL RED - next boundary

K5 is the row that justifies the choice of claim: the same endpoints, before and after, and the
difference is entirely whether the judged object COULD change. Endpoint stability would have scored
the BEFORE run clean.

    SUITE  0e2b19d7 (cid1 mode)   M17 HOLDS, M18 HOLDS, M19 VIOLATED (D-BIND); identity rows hold.
           It prints "WRONG M17/M18 STAYS RED": Amendment 2's cid1-only predictions, falsified on
           purpose by D-COPY and D-CONS. Not prediction failures.
    CONSUMERS (repo root, before -> after)
           evaluator 17->17, acceptance 27->27, batch 24->24, batchAcceptance 27->27,
           batchReport 18->18, statusContract 29->29, enduranceRecovery 28->28, governedRun 24->24,
           d2Integration 46/2 -> 46/2 - the SAME two pre-existing status-naming failures, no others.

## What changed for consumers, stated

- The judged object no longer contains `.git`: D-ID-1's blind spot "a check can read /candidate/.git"
  is closed - the judged object and the identity's object are now the same thing. No consumer test
  depended on /candidate/.git.
- A non-authorizing verdict carries `auditOfSubject` with the checks' original results, so the
  evidence of what C0 did is kept without being actionable.
- Every evaluation now copies the workspace once. Fine for workspaces; not measured on large trees.

## Explicitly NOT claimed

- K8: C0 === C1 at the end of evaluation does not prove the thing later COMMITTED is C0. That is the
  verdict -> identity -> commit binding, the next boundary after D-BIND.
- M19: the receipt (candidateTree) still names HEAD^{tree}, not the subject. D-BIND.
- The copy window: a write that lands AND reverts entirely inside copySnapshot is not seen - the
  D-ID-1 A1 traversal limit, now confined to the copy instead of spanning the whole judgment.
