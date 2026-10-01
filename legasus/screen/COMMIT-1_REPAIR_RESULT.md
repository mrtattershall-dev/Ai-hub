# COMMIT-1 — REPAIR RESULT: the smallest repair the property dictates, and the frozen probe reversed

Follows `COMMIT-1_RESULT.md` (54c35ba7). Claim 1a55b7d9. One file changed: `server/acceptance.js`,
39 insertions, 0 deletions. No T5b instrumentation, no neighbouring cleanup, no generalized
identity system. `git diff --stat` across server/ and legasus/ names acceptance.js alone.

## The repair, in the terms the property dictated

Inside the PROTECTED-PASSED block, in the RETAIN branch only, immediately before authority
transfers:

    live = cid1(ws)                              the state ABOUT TO BECOME AUTHORITATIVE
    if (!live.ok || !candidateVerdict.subject || live.id !== candidateVerdict.subject)
        -> IDENTITY_DRIFT: promotable false, not a completion, note says WHY, return
    else -> RETAIN as before

Three properties of the placement, each one a line the prereg drew:

    the anchor is cid1(ws) at the transition, NEVER after.subject (a re-verdict of C1, which
    answers "does C1 pass on its own", not "may C0's authority transfer to C1")
    EQUALITY, not immutability: a workspace that wandered and came back is retained (ABA)
    FAIL CLOSED: no identity, or no subject on the verdict, means equality cannot be established
    and the transition does not happen. Authority stays with the previously authoritative state.

IDENTITY_DRIFT is a new disposition, distinct on purpose: RESTORE_FAILED means damage not undone,
HELD means the instrument failed. Here the instrument worked and the BINDING was missing. The
journal can now tell those apart. batch.js needs no change: it advances the baseline on RETAIN
only and halts on RESTORE_FAILED/HELD only, so IDENTITY_DRIFT neither advances nor halts - the
task is simply not accepted and the next task starts from the unchanged baseline.

## Before / after, every row measured

    row   BEFORE (d8b33205)              AFTER                                   measured by
    T1    FIRES  RETAIN of C1 under C0   HOLDS  IDENTITY_DRIFT, same C0, same C1  frozen probe UNCHANGED (83bc44db)
    T2    FIRES_BY_COMPOSITION           no longer reachable via T1              composition premise removed (see below)
    T3    FIRES_BY_INHERITANCE           no longer reachable via T1              composition premise removed
    T4    FIRES_BY_COMPOSITION           no longer reachable via T1              composition premise removed
    T5g   HOLDS                          HOLDS  restored == start, exactly       separate EH1 run (17c01f2d)
    T5b   UNMEASURABLE                   UNMEASURABLE                            unchanged; recorded, not fixed
    T6a   HOLDS                          HOLDS                                   regression
    T6b   HOLDS                          HOLDS                                   regression
    ABA   PERMITTED (trivially)          PERMITTED (by the equality check)       regression
    UNAVAILABLE  (not in the prereg)     fails closed, IDENTITY_DRIFT            regression - see finding below

    regression  server/commitBoundary.test.mjs   unrepaired 5 passed / 5 FAILED  ->  10 / 0
    consumers   acceptance 27/0 -> 27/0   governedRun 24/0 -> 24/0
                batchAcceptance 27/0 -> 27/0   batch 24/0 -> 24/0

## What the unchanged probe did, stated exactly

commit1.probe.mjs has a must-fire gate: if K8 does not fire, it records NOT_EVALUATED and halts,
sealing the run with exit 2. That gate was frozen for the UNREPAIRED run, where a non-firing K8
means a broken probe. Run UNCHANGED against the repaired code, K8 correctly does not fire, so the
probe records the T1 reversal - identical C0 and C1 to the before-run, disposition RETAIN ->
IDENTITY_DRIFT, promotable true -> false - and then halts by its own rule.

So the unchanged probe delivers the reversal of the counterexample under unchanged measurement,
which was the point, and does NOT deliver the rest of the after-table. The probe was NOT edited
to make it continue: that would have changed the instrument between before and after. The other
rows were re-measured by the regression, and T5g - which the regression does not cover and which
the probe halted before reaching - by a separate EH1 run using the probe's exact T5g construction,
labelled as such. EH1 preserved the exit-2 run as SEALED evidence of a halted instrument, which
is what H10 of its own suite established it would do.

"No longer reachable via T1" is the honest form for T2/T3/T4. They were never injected; they were
shown to persist whatever T1 retains. With T1 refusing drifted state, that premise is gone. It is
not a measurement of T2/T3/T4 themselves, and a future regression that drives runBatch and
concludeGoverned end to end with an injected drift should assert each one directly.

## A finding the prereg did not have: UNAVAILABLE

The regression's UNAVAILABLE arm removes the workspace entirely between verdict and commit.
UNREPAIRED, applyAcceptance returned RETAIN, promotable true, for a directory that no longer
existed. The `after` re-evaluation produced EVALUATION_ERROR, and the RETAIN decision ignored it
because it keyed on the ORIGINAL verdict's `req === PASS`. After the repair: cid1 refuses, the
transition fails closed as IDENTITY_DRIFT with "identity unavailable" in the note. Not a K8
variant - an absent object, not a different one - and the same binding closes it.

## Explicitly NOT claimed

- T5b. Still unmeasurable. The batch path takes no cid1 of START; its restore anchor is a git
  commit of whatever T3 copied. Recorded, untouched.
- that T2/T3/T4 were measured after the repair. They were not reachable from this instrument.
- anything about the check-then-change window inside applyAcceptance itself: cid1(ws) is taken
  immediately before RETAIN, which narrows the window and does not close it - the same bound B's
  repair carried.
- that IDENTITY_DRIFT is the right disposition for the batch halting policy. It does not halt the
  batch; whether a drifted task should halt a chain is a policy question this repair did not
  decide.

## The law this is an instance of

    capture authority at its source, bind it to the exact thing it authorizes, and refuse to
    reconstruct that relationship downstream.

D-ID gave the thing an identity; D-COPY preserved it through construction; D-CONS held it still
during judgment; D-BIND carried it in the receipt without recomputation; COMMIT refuses to let
authority land on anything but it. Authorization attaches to an identity - not to a workspace
variable, a path, an object, or a historical verdict.
