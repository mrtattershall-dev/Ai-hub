# EVAL-1 — paired evaluation of controller-v1 with complete pairs and measured cost. Frozen.

2026-09-26. **AUTHORIZED by tatte: the 2.5 h-wall option, conservative maximum ~$5.4** ("I'd favor complete pairs over squeezing the evaluation into a shorter deadline. The $5.4 option is given authorization"). Recorded here before deploy. Per task 240 s, campaign wall 9000 s, watchdog 9900 s, seeds 808 and 909, keep-awake armed, supervised relaunch on the same root.

## Purpose

OVERNIGHT-1 supported the claim "roughly half the task time per retained repair, similar
observed repair counts, reliable rollback and stopping" with three qualifications: five
pairs were incomplete (wall clock after a 19-minute sleep), one unit's bound was defeated
by the sleeping machine, and the campaign process had died once without a message. EVAL-1
re-runs the same comparison with those operational holes closed, on the FROZEN controller
(tag `controller-v1`), so the number can be quoted with complete pairs and a measured cost.

## What changed operationally, and how each is validated (no spend)

    crash diagnosable        <root>/crash.log written on uncaughtException, unhandledRejection,
                             signals and any non-zero exit         resumeCampaign.test 14/14
    campaign resumable       AUTODIAG_ROOT resumes a root: recorded units skipped, plan kept,
                             summary appended, indices continue, report reconciles
                                                                    resumeCampaign.test
    supervised relaunch      mech1Launch.sh stage2 relaunches the runner on the same root up to
                             CAMPAIGN_MAX_RELAUNCH (2) times if it exits without COMPLETE;
                             the campaign deadline is shared across relaunches
    sleep prevented          an application-level keep-awake for the job's whole horizon
                             (no power setting changed), armed in stage1, released after stage2
    sleep DETECTED           per-unit clock-jump detection: a >60 s jump between two polls is
                             recorded on the row (clockJumps, clockJumpSec) so the unit's
                             elapsed time is never mistaken for model work
    cost measured            costAccount.mjs: phases (startup, probe, units, overrun, overhead,
                             idle, shutdown) and per-arm seconds and dollars per accepted repair,
                             own-time and including shared time

What is NOT closed: the cause of the exit-127 death. It is now diagnosable and survivable,
not explained.

## Design (identical to OVERNIGHT-1 except the seeds)

    controller     tag controller-v1 (policy maxAttempts 2, maxRepeats 2, maxProvisional 3;
                   DISCARD restores the VERIFIED checkpoint). Any change to the provisional
                   policy is a SEPARATE experiment; this one preserves what v1 demonstrated.
    arms           RECOVERY_ARM (controller on) vs AUTODIAG_ARM (same diagnostic, off)
    tasks          22 (15 original + 7 held-out), reported separately and pooled
    seeds          2 new: 808 and 909 (sent per replicate; probe before)
    units          88; complete pairs REQUIRED for the headline - the wall is set so the queue
                   finishes: per task 240 s, campaign wall 9000 s (2.5 h), relaunch-resume on
                   a crash, keep-awake on
    order          rotation by task index and replicate; position recorded
    primary        accepted repairs, paired by (task, seed): discordant counts, sign test
                   (descriptive), task-level view
    beside it      regressions produced/surviving; controller decisions and byte-exact
                   restores; stops; integrity flags (must be 0); clock jumps (must be 0);
                   seconds and dollars per accepted repair, own and incl. shared (costAccount)
    readings       pre-registered as in PILOT-1/OVERNIGHT-1: no rate claim; "similar counts"
                   is not "equivalent capability"; time per repair is an aggregate of this
                   campaign, not billed cost or a future speedup

## Budget (to be authorized; figures for the gate)

At the conservative rate: planned 88 × ~72 s + startup + shutdown ≈ 2.0 h → ~$2.2–3.1;
maximum exposure with a 9900 s watchdog + retries + scaledown ≈ 3.5 h → **~$5.4
conservative / ~$3.9 GPU-only**. A $5 cap would require the OVERNIGHT-1 bounds (7800 s wall,
8400 s watchdog; maximum ~$4.8 conservative) and accepts the risk of incomplete pairs if a
crash-and-resume eats time. State the choice at authorization; both are pre-computed here.
