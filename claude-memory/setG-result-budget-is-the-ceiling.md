---
name: setg-result-budget-is-the-ceiling
description: "Set G (2026-09-12) - twenty hub fixes stopped the destruction but did not raise the score; the binding constraint moved to the 30-call step budget, spent on identical repeated calls that succeed"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T05:10:34.667Z
---

Set G ran the same 100 goals as set F on the hardened hub (main `dae46b2`), both models, ~$8.2, predictions
committed beforehand at `9afb8d0`. **Both predictions failed.**

| | set F | set G | attempted |
|---|---|---|---|
| Qwen3-Coder-30B ("coder3") | 36/100 | **29/100** (predicted 42+) | 78 of 100 |
| base 14B | 2/100 | **4/100** (predicted 10+) | 58 of 100 |

**The denominator is the result.** Neither arm finished the set. Per goal *attempted*: the 30B is flat (36% → 37%),
the 14B about 3.5× better (2% → 6.9%). Goals now run far longer — 14B 14s → 41s per goal, 30B 21s → 25s at 23.7 calls
against a 30-call cap.

**What worked:** every destruction mechanism fired on live goals — 24 refusals, 54 substitutions, honest tool-loop
attribution, 24 gate blocks. The loop-break substitution had been *unreachable* since an earlier merge and did real
work here for the first time.

**What binds now:** the 30-call step budget, spent on identical repeated calls that SUCCEED. The 14B re-sends the same
`edit_file` (113 of 142 notices, 133 verbatim back-to-back, median edit 919 chars); the 30B re-reads files and re-runs
commands (read_file 70, run_command 68, run_python 28). Cause: the repeated-call notice is advisory, and the bound was
given only to repeats whose answer was an ERROR — so a *successful* identical repeat is unbounded and costs a call
every time.

**How to apply:** do not raise `AGENT_MAX_STEPS` first — it would buy more repeats and hide both bugs. Bound the
identical back-to-back call (notice → substitute → stop) regardless of success, keeping "the tool refused" wording for
the ERROR case only. And when a score fails to move, check the denominator before concluding the fixes failed: coverage
loss and quality loss look identical in an absolute score.

Related: [[hub-destroys-a-third-of-working-code]], [[silent-failures-are-the-class]],
[[fix-the-deciding-path-not-the-advisory-one]], [[long-run-accuracy-north-star]].
