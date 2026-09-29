---
name: bench3-variance-covers-bench-deltas
description: 2026-09-25 BENCH-3 (3 replicates x 15 QuixBugs, 7B): accepted 1/3/1 per replicate - BENCH-1's 2 and BENCH-2's 0 both sit inside one-config run-to-run variance; never read single-run deltas on this benchmark
metadata:
  type: project
---

BENCH-3 (2026-09-24/25, hub 96c6adb, $15 cap, ~$1.65 spent, 89m of 5h): same seeds/model/config three times. Accepted per replicate 1/15, 3/15, 1/15; per task: 0 of 15 tasks accepted 3/3 (gcd 2/3; flatten/lcs_length/lis 1/3; 11 at 0/3, incl. CHECK-1's is_valid RETAIN at 0/3). So BENCH-1 (2/15) vs BENCH-2 (0/15) was inside noise. 7 regressions produced, 0 survived. Repairs at scale: 11 per-call deadline aborts, 0 task-level timeouts, no run lost to an unreturned call; 45/46 run files finalized (the 46th: runner's bounded 60s wait expired mid-teardown - truthfully unfinalized, recovery reconciles explicitly).

**Why:** tatte's repeatability requirement; a single-run delta on 15 tasks reads nothing.

**How to apply:** any future claim on this benchmark needs replicate spread, not a single count. Monitor/notification streams drop events - read the durable summary ([[replay-steps-channel-is-authoritative]]). Obstacle remains verification narrowness (CHECK-1_OBSTACLE.md); lcs_length 1/3 is consistent with unstable case-sampling.
