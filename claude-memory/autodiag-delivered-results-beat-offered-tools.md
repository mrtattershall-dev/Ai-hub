---
name: autodiag-delivered-results-beat-offered-tools
description: 2026-09-25 AUTODIAG-1: automatically RUNNING the graded cases and delivering the result gave 8 accepted repairs vs 0 control (replicate 1 only, half the run lost to a hung unit) - where merely SUPPLYING a runner + instruction gave nothing
metadata:
  type: project
---

AUTODIAG-1 (2026-09-25, 7B on Modal A10G, ~$2.75 est of $5 authorized): CONTROL 0 verified repairs in 15 runs; AUTODIAG_ARM 8 in 14. Of 14 complete pairs, 8 repaired only in treatment, 0 only in control, 6 neither. Treatment also produced 3 regressions (all RESTORED, none surviving) and edited the target 12/14 vs 3/15 — feedback moved the model from inaction into action, some of it wrong. Both reported separately, never netted.

The contrast that matters: TESTCMD-1 SUPPLIED the runner source + an instruction naming it and got execution in 5/27 runs and no benefit. AUTODIAG RUNS it and hands over the RESULT. Receiving the source is not receiving the results.

**Why:** tatte's framing; success = accepted repairs, with case gains/regressions/costs/delivered diagnostics reported apart.

**How to apply:** NOT a repeat rate — one replicate; 31 of 60 units never ran because one unit burned 99 of 150 minutes (planner call whose 295s deadline fired but whose await took 5,964s to unwind). Fixed after: 30s timeout on every runner HTTP request, host-side docker timeout in runDiagnostic, unit-overrun recorded. Label is REPAIR WITH SUPPLIED TEST RESULTS (the diagnostic runs the graded cases) — never generalization. Next step is a repeat to see whether 8-vs-0 recurs. See [[test-feedback-was-unreachable]], [[bench3-variance-covers-bench-deltas]].

**AUTODIAG-2 (2026-09-25, all 60 units, 93m, ~$1.95 est of $5):** direction held, magnitude did not. CONTROL 0 repairs in 30 runs (0 in 45 across both experiments); AUTODIAG 10/30. Across 44 complete pairs in both experiments: 18 treatment-only repairs, 0 control-only. BUT per replicate WITHIN the one campaign: 8/15 then 2/15 — same tasks, seeds, config, same run. That is how much the treatment's output varies when nothing varies, so no rate can be quoted from 8, 8, 2; "10/30" is not "about a third of tasks". Treatment used LESS wall clock than control (1,970s vs 3,164s) and fewer model calls, produced 9 regressions to control's 3, all restored. Operational fixes held: 60/60 executionConfirmedStopped, 0 overruns, integrity true, UNACCOUNTED 0.

**Shutdown latency, and a correction:** I first reported the scripted `modal app stop --yes` had never executed. WRONG - I read the log before its last lines were written. It ran ~5m10s after the campaign completed (12:22:03 complete, scripted stop 12:27:13). The real defect is LATENCY not failure: a multi-minute window after completion where the GPU is live and billing. I stopped manually at 12:23:12, so actual exposure was ~69s. ALWAYS verify app state directly rather than trusting either the launch chain or a log tail read too early.
