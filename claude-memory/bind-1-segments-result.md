---
name: bind-1-segments-result
description: 2026-09-20 BIND-1 on approvalPolicy.js::segments ran OBSERVED under A2 load rules; 4/5 preregistered predictions confirmed, P4 malformed; only policy_test.mjs executes segments; 4 dark mutants incl. `2:=3` at 7238
metadata:
  type: project
---

BIND-1 (legasus/ in ai-coding-hub, main worktree) ran once on segments() on 2026-09-20 after
0d's explicit go: DISCOVER 97 files (~70 min because runLifecycle.test.mjs held stdio 53 min
past the 180s kill — killTree/`close` defect, unfixed), BIND 3162 records, both OBSERVED by
the A2 load rules (count ≤40, calibration ≤3×35ms frozen reference). Only policy_test.mjs
(93 cases) executes segments(); selftest.mjs never does. 30/34 mutants discriminated; dark:
M022/M023 (`2 := 3`/`2 := 1` @7238, executed by 87 incl. output-asserting direct cases),
M025, M028. P1/P2/P3/P5 confirmed; P4's "same condition" pairing barely existed — prereg
defect, scored degenerately.

**Why:** first real matrix from the apparatus; the record (legasus/out/segments/BIND-1_RESULT.md)
is the baseline any BIND-2 compares against, and the P4 lesson is that a prediction must be
scorable from the matrix alone before it is frozen.

**How to apply:** BIND-2's first step is deciding M022/M023 by hand (equivalent mutant vs
apparatus miss). Never name obligations from BIND-1 output. See [[legasus-location-and-discipline]],
[[falsification-sequence-beats-final-count]].
