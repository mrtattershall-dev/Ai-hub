---
name: long-run-accuracy-north-star
description: "tatte's north star (2026-09-11) - everything (retraining, teacher-student, manager/worker) is for making LONG multi-step runs more accurate; judge work by long-run reliability, not single-step quality"
metadata: 
  node_type: memory
  type: user
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T10:37:19.693Z
---

tatte, 2026-09-11, verbatim: "all of this is for the better because it makes longer runs more
accurate. That's the hard part."

The goal behind the retraining pipeline, the teacher-watches-student idea (a compressed 72B or 32B
correcting a 14B and building data from real runs) and the two-model manager/worker design (fresh
short contexts per task instead of one ever-growing conversation) is LONG-RUN ACCURACY: many steps in
a row without drifting, looping, or breaking what earlier steps built.

**Why:** per-step errors compound - 95% right per step is ~36% clean over 20 steps. Single-goal
pass rates (like the 5 game-edit goals) understate the problem; the 14B's recorded failures
(appending a second update(), repeating itself, misreading evidence) are the ones that compound.

**How to apply:** when proposing evals, include CHAINED goals on one workspace where every earlier
goal must still pass after each new one (regressions count as failures). When ranking data or hub
work, prefer what reduces per-step error and teaches recovery over what raises one-shot quality.
Related: [[hub-target-14b-coder]], [[local-server-december-2026]], [[run5-loops-single-turn-data]].
