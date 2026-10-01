# COMMIT-2 — the three COMMIT-1 follow-ons, frozen before any edit

Frozen 2026-10-01 after the K8 repair (8bc75173). Claim ce583c21: batch.js, governance.js, new
files only. acceptance.js, evaluator.js and cid1.mjs are NOT touched. Consumers baselined before
any edit: batch 24/0, batchAcceptance 27/0, batchReport 18/0, statusContract 29/0,
enduranceRecovery 28/0, governedRun 24/0, acceptance 27/0, d2Integration 46/2 (the same two
pre-existing status-naming failures D-BIND recorded).

One claim for three items because they share two modules and one property. The property is
COMMIT-1's, unchanged: every state that becomes authoritative must carry an authorization for
that exact identity.

## (a) T2 / T3 / T4 become MEASURED, not inferred — a falsifiability seam

COMMIT-1 could only show T2/T3/T4 firing BY COMPOSITION: `runBatch`'s task loop and
`concludeGoverned` each call `evaluate()` then `applyAcceptance()` back-to-back with no point at
which a probe can inject drift. The real path was UNFALSIFIABLE at those transitions, and this
repository's own rule is that a verification nobody can make fail is decoration.

The repair is a seam, after the pattern already in the codebase (evaluator's injectable `image`
"so the EVALUATION_ERROR path can actually be exercised"; governed-edit's `deps.readBack` "so the
read-back check is FALSIFIABLE"):

    runBatch(tasks, opts)              opts.afterVerdict?(ws, task, verdict)   awaited after
                                       evaluate() returns and before finalise(), on BOTH the
                                       normal path and the timeout path
    concludeGoverned(ws, run, opts)    opts.afterVerdict?(ws, task, verdict)   between evaluate()
                                       and applyAcceptance()

Default undefined = no-op. Production never passes it: the result greps every non-test caller
and asserts zero. The seam is NOT a hook for product behaviour; it exists so the transition can
be attacked. If a production caller ever passes it, that is a defect of the same class as K8.

## (b) T5b becomes MEASURABLE — a cid1 of START in the batch path

The batch path's restore anchor is a git commit of whatever T3 copied in; no cid1 of START is
ever taken, so "restored == previously authoritative identity" could not be checked there
(COMMIT-1 T5b UNMEASURABLE). Now:

    at task start, after the start commit:   startIdentity = cid1(ws)
    journalled in task_baseline:             startIdentity (or null, loudly)
    on RESTORED, in finalise:                restoredIdentity = cid1(ws)
                                             restoreIdentityHolds = restored === start
    journalled in task_end:                  startIdentity, restoredIdentity, restoreIdentityHolds
    startIdentity known and NOT holding      -> HALT. A restore that is not the start is
                                                RESTORE_FAILED in effect; fail closed.
    startIdentity null                       -> restoreIdentityHolds null. UNMEASURABLE stays
                                                loud in the record; it never silently passes.

## (c) The IDENTITY_DRIFT chain policy — DECIDED, and frozen so it can be argued with

    IDENTITY_DRIFT does NOT halt the chain.
    It is journalled as its own event: identity_drift { task, subject, retainedIdentity, note }.
    The baseline does not move (already true: only RETAIN advances it).

Reasoning: the property HELD - nothing wrong became authoritative - so the task is simply not
accepted and the next task starts from the unchanged baseline, exactly as for
PRESERVE_INCOMPLETE. But drift means SOMETHING mutated the workspace between verdict and
commit, which is a hub anomaly, so it must be loud rather than silent. Halting would be stronger
than the property requires and would turn a contained refusal into a lost batch. This is a
policy, not a theorem; it is written down so a later owner can reverse it on evidence.

## The regression, written and run UNREPAIRED first — server/commitChain.test.mjs

Drives the REAL runBatch (chain on) and the REAL concludeGoverned. Self-sealing through EH1 so the
before/after is evidence, not console output.

    C5  no seam passed: t1 RETAIN, baseline advances, t2 starts "accepted baseline from t1"
        -> the production no-op CONTROL. Must pass before AND after.
    C1  T2 via runBatch: afterVerdict mutates t1 after its verdict
        -> t1 IDENTITY_DRIFT; no .accepted-baseline; identity_drift journalled; batch NOT
           halted; t2 starts from "task seed"
    C4  ABA via runBatch: afterVerdict mutates then restores the judged bytes
        -> t1 RETAIN, baseline advances. The anti-over-refusal control for the chain.
    C2  T4 via concludeGoverned: afterVerdict mutates between evaluate and applyAcceptance
        -> IDENTITY_DRIFT, workspaceRestored false
    C3  T5b via runBatch: t1's runTask deletes a protected file -> protected FAILS -> RESTORED
        -> task_baseline.startIdentity is a cid1; task_end.restoreIdentityHolds === true;
           cid1(workspace) === startIdentity

## Predictions

    UNREPAIRED   C1 FAILS  (afterVerdict ignored: drift never injected, t1 RETAINs, baseline
                            advances - the real path is unfalsifiable, which IS the finding)
                 C2 FAILS  (option ignored: RETAIN)
                 C3 FAILS  (no startIdentity field exists)
                 C4 passes trivially   C5 passes
    REPAIRED     all five pass; every baselined consumer unchanged; grep finds no production
                 caller of afterVerdict

A regression that the unrepaired code passes at C1/C2/C3 would prove nothing about this change.

## Not claimed

    - closure of the window between cid1(ws) and RETAIN inside applyAcceptance (B's bound)
    - T5 on the governed path, already HOLDS (COMMIT-1 T5g); not re-derived here
    - that the seam is safe if a production caller passes it - the grep is the guard, not a proof
    - that no-halt is the RIGHT drift policy beyond the reasoning above; it is reversible
