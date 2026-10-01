# COMMIT-2 — RESULT: T2/T3/T4 measured, T5b measurable, the drift policy frozen

Prereg `COMMIT-2_PREREG.md`, claim ce583c21. Two files changed: `server/batch.js` (+58/-5) and
`server/governance.js` (+7/-1). `acceptance.js`, `evaluator.js`, `cid1.mjs`: no diff.

Three EH1 runs, all SEALED, all preserved:

    3ab3c218   UNREPAIRED      7 passed /  9 failed   the control
    88a29e7c   repaired       15 passed /  1 failed   one wrong ASSERTION - mine, see below
    21078840   repaired       17 passed /  0 failed   the result

## Before / after

    arm  claim                                   UNREPAIRED              REPAIRED
    C5   no seam: production unchanged           pass                    pass
    C1   T2 via the REAL runBatch, drift injected FAIL (RETAIN; drift     IDENTITY_DRIFT; baseline not
         after t1's verdict                       never injected)         advanced at t1; identity_drift
                                                                          journalled; batch NOT halted
    C1   T3: t2 starts from its seed              FAIL (from drifted      pass
                                                  baseline)
    C4   ABA through the chain                    pass (trivially)        pass (by the equality check)
    C2   T4 via the REAL concludeGoverned         FAIL (RETAIN)           IDENTITY_DRIFT; not restored,
                                                                          not a completion
    C3   T5b: RESTORE returns to cid1(start)      FAIL (no start          startIdentity journalled;
                                                  identity exists)        restoreIdentityHolds true;
                                                                          disk == start identity

    consumers  batch 24/0  batchAcceptance 27/0  batchReport 18/0  statusContract 29/0
               enduranceRecovery 28/0  governedRun 24/0  acceptance 27/0  - all unchanged
               d2Integration 46/2 -> 46/2, the same two pre-existing status-naming failures

So the composition rows of COMMIT-1 are now MEASUREMENTS. T2 and T4 were attacked through the real
`runBatch` and the real `concludeGoverned` with drift injected at the exact point COMMIT-1 could
not reach, and both refuse. T3 follows from T2 by the record: t2's `task_baseline.baselineSource`
is `task seed`, not `accepted baseline from t1`.

## (a) The seam, and the guard on it

`opts.afterVerdict?(ws, task, verdict)` on `runBatch`, awaited on BOTH the normal and the timeout
path after `evaluate()` and before `finalise()`; `{ afterVerdict }` on `concludeGoverned` between
`evaluate()` and `applyAcceptance()`. Default undefined = no-op, and C5 asserts production is
unchanged.

    GUARD, by grep over every non-test, non-probe .js/.mjs under server/ and legasus/:
      files that pass afterVerdict as an option:   0
      files that read it:                          batch.js, governance.js only

It is a seam for attacking the transition. A production caller passing it would be a defect of
the same class as K8, and the grep is the guard - not a proof.

## (b) T5b, from UNMEASURABLE to HOLDS

`startIdentity = cid1(ws)` is taken at task start on the state the start commit captured and
journalled in `task_baseline`. On RESTORED, `finalise` takes `cid1(ws)` again and records
`startIdentity`, `restoredIdentity`, `restoreIdentityHolds` on `task_end`. Known start and a
non-holding restore HALTS the batch: a restore that is not the start is RESTORE_FAILED in effect.
A null start identity records `restoreIdentityHolds: null` - unmeasurable stays loud; it never
reads as a pass.

C3 measured it through the real batch: t1's protected check fails after `keep.txt` is removed,
`applyAcceptance` restores, and the workspace's cid1 equals the journalled start identity exactly
(`cid1:901b10f81…`, the same identity COMMIT-1's T5g returned on the governed path).

## (c) The policy, as frozen

IDENTITY_DRIFT does not halt the chain. C1 asserts it: the batch continued, t2 ran from its seed.
It is journalled as its own `identity_drift` event carrying `subject`, `retainedIdentity` and the
acceptance note. The baseline does not move - C1 asserts `baselineTree` null at t1's `task_end`
and that no baseline ever carried the drifted bytes. This is a policy, not a theorem; it is
written in the prereg so it can be reversed on evidence.

## The one failure in 88a29e7c, which was mine

The first repaired run failed exactly one assertion: `!existsSync(baseline)` checked at the END
of the batch. But t2 is not drifted, passes, and legitimately advances the baseline itself - so
the directory exists at the end. Its sibling assertion, "t2 starts from its seed", PASSED in the
same run, which is the evidence that t1's drift did not advance it. The claim is about t1's
TRANSITION, and it now reads the record: `baselineTree` null at t1's `task_end`, and no baseline
ever carrying the drifted bytes. The repair was right; the assertion was measuring the wrong
moment. The run is preserved sealed rather than replaced.

## Not claimed

- closure of the window between `cid1(ws)` and RETAIN inside `applyAcceptance` (B's bound)
- that the seam is safe if a production caller ever passes it; the grep is the guard
- that no-halt is the right drift policy beyond the prereg's reasoning; it is reversible
- T5 on the governed path, which COMMIT-1 already measured HOLDS and this did not re-derive

## Standing after COMMIT-2

    T1  K8                HOLDS (COMMIT-1, 8bc75173)
    T2  RETAIN -> baseline HOLDS, measured
    T3  baseline -> next   HOLDS, measured
    T4  governed           HOLDS, measured
    T5g governed RESTORE   HOLDS (COMMIT-1)
    T5b batch RESTORE      HOLDS, measured - no longer unmeasurable
    T6  refusal/error      HOLDS
    ABA                    PERMITTED, direct and through the chain

Every transition the property names is now measured through the real path, with the one bound
that was never claimed closed: the interval between taking the identity and acting on it.
