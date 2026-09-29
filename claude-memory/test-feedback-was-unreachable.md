---
name: test-feedback-was-unreachable
description: 2026-09-25: QuixBugs task workspaces never contained the test cases (worker mounts only the workspace), and doctest.testmod returns attempted=0/failed=0/exit 0 on the broken seeds - the model had no usable failing-test signal
metadata:
  type: project
---

Verified across all 45 BENCH-3 workspaces: a task workspace held ONLY the buggy .py (plus hub artifacts). The vendored cases are host-side; acceptance cases are materialised into /check at evaluation time. worker.js bind-mounts the workspace and nothing else. So the model could not run the task's tests - my earlier "json_testcases sits in the workspace" claim was an inference from the vendored tree and is retracted.

Worse: every QuixBugs seed puts its examples in a string literal AFTER the function at module level - neither module nor function docstring - so `doctest.testmod(m)` reports attempted 0, failed 0, exit 0 on definitively broken code. Proved in the worker. Two BENCH-3 runs took that route and learned nothing.

The one BENCH-3 lcs_length success used the expected values written in the file (saw 1,1 vs the 2,4 printed there, made the right single-token edit). A sibling replicate had the identical observation and looped on search_file without editing - so an oracle is necessary but not sufficient.

**Why:** tatte: "Host-side availability is not workspace availability" and "make the available feedback actionable". Also the standing lens - a silent pass on broken code is the costly failure class.

**How to apply:** server/taskTests.js supplies run_tests.py + cases (failures reported first, expected vs actual, first failing case named, import failure distinguished; 17/17 in taskTests.test.mjs incl. all 15 references as positive control and a proof the candidate cannot move a verdict). TESTCMD-1 (frozen, uncapped) compares it against current guidance; its headline measure is graded caseDelta on the CANDIDATE, not command invocation. Any such result is REPAIR WITH SUPPLIED TESTS - the exposed cases are the graded cases. See [[bench3-variance-covers-bench-deltas]].

**TESTCMD-1 result (2026-09-25, ~$2.75 est of $5 authorized by Micheal):** supplying the graded cases + a runner + an instruction did NOT raise verified repairs — CONTROL 8/28 vs TEST_PACKAGE 4/27 (per-replicate 3,5 vs 2,2), inside BENCH-3's 1–3/15 spread, so *no demonstrated benefit*, not a demonstrated cost. The substantive finding: **the model executed the supplied runner in only 6 of 27 treatment runs** — the never-invoked branch, not insufficient-feedback. Where output was produced and delivered, a repair followed in 2 of 6; one run saw four correct failure reports and made zero edits.
