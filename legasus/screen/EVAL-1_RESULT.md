# EVAL-1 RESULT — INCOMPLETE: the campaign hung after 21 of 88 units; the GPU stop held

Ran 2026-09-26 03:28Z (attempt 1; hub f7df108, controller-v1, seeds 808/909). **Halted in
effect at 04:08:56Z; discovered 06:22Z; the watchdog stopped the GPU at its own deadline
06:11:08Z.** This is an operational failure record, not an evidence record. Nothing here
changes the OVERNIGHT-1 claim; nothing here supports or weakens it either.

    planned 88   recorded 21   never started 66   (the runner never wrote its report or DONE)
    integrity flags 0 of 21   restores byte-exact 4 of 4   controller stops 1   clock jumps 0

**Spend: ESTIMATE ~$3.03 GPU-only** (app live 03:26:08Z → 06:11:14Z = 9,906 s), **≤ ~$4.27
conservative**, of the authorized ~$5.4. Of that, ~7,320 s (~$2.24 / $3.15) was the GPU idle
while the runner hung. Estimates until invoiced.

## What happened, from the records

    03:28:20Z  runner attempt 1 starts (keep-awake armed, watchdog 9900 s)
    04:00:49Z  unit 21 recorded (RECOVERY longest_common_subsequence, RETAIN)
    04:01:36Z  a diagnostic container starts and never returns (docker-side)
    04:03:18Z  a second diagnostic container, same
    04:08:56Z  unit 22 (AUTODIAG longest_common_subsequence) ends EVAL_ERROR - the evaluator's
               docker run failed; batch halts that unit ("nothing may be promoted")
    04:08:57Z  the runner's post-processing starts CASE MEASUREMENT for unit 22 (caseSet.js);
               its docker run never returns and had NO host-side timeout -> the runner waits
    04:09Z-06:11Z  nothing: no unit, no crash line, no relaunch (the supervisor waited for the
               runner to EXIT; it never did); keep-awake held (no sleep event); the machine
               was awake and idle
    06:11:08Z  watchdog deadline -> stop issued 06:11:15Z -> Modal stopped_at 06:11:14Z ->
               observed 06:11:18Z
    06:22Z     I read the stall; 06:25:09Z I killed the runner by pid (the supervisor then
               reported "attempt 1 exited 127"); removed the three stuck containers

**Root cause, two layers.** (1) Docker on this machine stopped returning from containers at
~04:01Z (three containers "Up" for two hours with an internal `timeout 60/90` that never
fired; docker itself was responsive to `ps`/`rm -f` afterwards). Not diagnosed further.
(2) The runner had no bound on that wait: `caseSet.js` called docker without a host-side
timeout, that call sits in post-processing OUTSIDE the per-unit wall, the campaign deadline
was only checked between units, and the supervisor only reacted to an exit. Four gaps, one
hang.

**A side finding.** Killing the runner by pid made the supervisor report exit 127 - the same
code OVERNIGHT-1's first attempt died with. In this shell, 127 is what an EXTERNALLY
terminated node process reports. So that earlier "silent death" was an external kill, source
still unidentified, not a crash.

## Fixed after this run, each proven without spend

    host-side timeout on case measurement; named container force-removed on timeout
                                                  caseSetTimeout.test 5/5 (a docker double that
                                                  never returns: back in 31 s, container removed)
    campaign-level wall INSIDE the runner, armed before the loop: fires on a hung unit or
    hung post-processing, writes the in-flight unit INTERRUPTED with the reason and every
    unstarted unit UNATTEMPTED, reports, DONE, exits 3
                                                  campaignWall.test 12/12 (injected never-
                                                  returning post-processing)
    supervisor stall detection: no summary progress for one unit bound + slack -> kill by pid
    -> relaunch on the same root (resume); the un-recorded unit is re-run
                                                  supervisor.test 10/10 (through mech1Launch.sh
                                                  stage2 against the scripted backend)
    crash log, resume, keep-awake, clock jumps    from the previous commit; unchanged

Regression: resumeCampaign, unattemptedRows, recoveryArm, threeArm, outerDeadline,
deadlineRecovery re-run after the changes (counts in the commit message).

## The 21 units, for the record only (10 complete pairs; not evidence of anything)

    controller on   11 units   6 repairs   0 regressions   826 s   restores 4/4 exact, 1 stop
    controller off  10 units   5 repairs   1 regression    948 s   2 units with no completed
                                                                   model call (kth, lcs_length)
    pairs 10: both 3, controller-only 2, off-only 2, neither 3

These are half of replicate 1 with no replicate 2. They are filed (`EVAL-1_summary.jsonl`,
`EVAL-1_console.log`, `EVAL-1_watchdog.log`, `EVAL-1_stage1.log`, `EVAL-1_gate.log`,
`EVAL-1_keepawake.log`, `EVAL-1_journal-AUTODIAG_ARM-r1.jsonl`; root `autodiag1-cABL5r`) and
are NOT pooled with anything.

## Status

EVAL-1's question - does the OVERNIGHT-1 result repeat across sampling variation, with
complete pairs and a measured cost - is UNANSWERED. Re-running it needs new authorization;
the remaining margin under the ~$5.4 cap (~$1.1 conservative) does not cover the 67
remaining units. The frozen definition stands; the bounds it names are now enforced at four
layers (unit wall, campaign wall, supervisor stall kill, GPU watchdog).
