---
name: hub-target-14b-coder
description: 2026-09-10 user reminder - all AI-coding-hub loop/parser/fuzz work is FOR the 14B coder (Qwen2.5-Coder-14B, run5 or base); prioritise its failure modes
metadata:
  type: project
---
tatte, 2026-09-10 heading to work: "We're doing all of this for 14b coder. Just a reminder."

The hub hardening (parser, mechanical loop-breaks, syntax rollback, lifecycle, batch actions,
mock-model fuzzing) exists to make the 14B coder a reliable agent - not the 7B, not the 30B.
7B and 30B runs are comparisons/controls.

**Why:** the 14B is the model the user intends to run (A10G int4 ~61.7 tok/s, ~$4.95/1M;
local 48GB server Dec 2026 per [[local-server-december-2026]]). See [[run5-findings-2026-09-09]]
for run5-vs-base.

**How to apply:** when choosing what to fix next, rank by what the 14B actually does in its
recorded replies (e.g. multi-action replies -> batch actions, fragment appends, line-number
leaks). When measuring, report 14B numbers first; never generalise a 7B/30B result to it.
See [[hub-location-and-coord]].
