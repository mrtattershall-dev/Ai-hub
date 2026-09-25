# BENCH-3 RESULT — three replicates: the variance is measured, and it covers BENCH-1 vs BENCH-2

Ran 2026-09-24 23:03:00Z → 25 00:32:19Z. **89m 18s of a 5-hour budget**; queue exhausted
early; duration reported as measured. Unattended, interventions none; 50/50 planned units
accounted, integrity and reconciliation true; 0 evaluation errors. GPU stopped by the scripted
`modal app stop --yes` at 00:32:24Z, confirmed `stopped`. ≈ 1.5h A10G ≈ **$1.65 of the $15
cap**.

## The headline: per-replicate accepted, same code, same seeds, same model

    replicate 1    1 / 15
    replicate 2    3 / 15
    replicate 3    1 / 15

**BENCH-1 (2/15) and BENCH-2 (0/15) both sit inside this one-configuration spread.** The
BENCH-1→BENCH-2 drop that looked like it might mean something is smaller than the run-to-run
variance of the pipeline measured on itself. No cross-version conclusion survives this.

## Per task across 3 replicates

    3/3 accepted    none
    2/3             gcd
    1/3             flatten, lcs_length, lis
    0/3             the other 11 (incl. is_valid_parenthesization, CHECK-1's one RETAIN - 0/3 here)

    accepted total            5 / 45
    regressions produced      7 / 45   (bucketsort, find_in_sorted, max_sublist_sum x2,
                                        mergesort, next_palindrome, pascal)
    regressions surviving     0        (all RESTORED)
    task-level timeouts       0 / 45
    model-call deadline aborts 11 (in 11 runs), 16 unconfirmed remote calls - every one
                              recorded, every affected run continued or ended classifiably
    chain                     0/5, stopped at step 1, steps 2-5 BLOCKED (third identical result)

    416 model calls · 2.43M tokens · 83m task time

**A correction to my own live commentary:** mid-run I reported "suspicious uniformity - all
PRESERVE_INCOMPLETE, zero regressions". That was the MONITOR dropping events, not the run: the
record has 5 RETAIN and 7 RESTORED. The durable summary, not the notification stream, is the
instrument - the same lesson as replay-steps-channel, relearned on a tail pipe.

## The repairs at scale

- **Per-call deadline:** fired 11 times live; 0 task-level timeouts; no run lost to an
  unreturned call (BENCH-2 lost 4). Unconfirmed-remote accounting carried per run.
- **Persistence fix:** 45 of 46 run files finalized before release. **The 46th** (a pascal
  replicate) is persisted `running` with no finalizedAt: the runner's bounded 60s wait after a
  forced stop expired while the hub was still tearing down (last step a tool call). That is
  the designed fallback - the record is truthfully unfinalized, and recovery reconciles it
  EXPLICITLY to interrupted (persistTerminal.test case 3) - but the bounded wait means
  "durable before release" holds only when teardown beats 60s. Recorded as a limit, not
  hidden. (The console's "accepted 5/15" denominator was a display slip in the replicate
  patch - the report and summary are per-unit correct; fixed for the next run.)

## Reading

- Verified-repair rate for this configuration: about **11% (5/45)** with per-replicate spread
  1-3 of 15. Descriptive of this model+workflow on these tasks; no comparison arm.
- The obstacle analysis (CHECK-1_OBSTACLE.md) predicted near-miss recurrence: lcs_length
  accepted in exactly 1 of 3 - consistent with case-sampling sometimes landing on enough
  cases, not with a stable capability either way.
- Acceptance did its job at scale: 7 regressions produced, 0 survived, across 45 runs.
