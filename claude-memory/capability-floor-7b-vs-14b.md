---
name: capability-floor-7b-vs-14b
description: "With identical hub fixes the 14B reaches 17/18 and 10 completions; the 7B stays at 12/18 with ZERO — run one 14B locally, not several 7Bs"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-22T10:15:52.855Z
---

Measured 2026-09-10 in ai-coding-hub, six goal shapes x 3 passes, same harness, same card
(A10G), same int4 AWQ quantisation, every hub fix applied to both:

    7B int4  + all fixes   4/6, 4/6, 4/6  = 12/18 work done, 0/18 reached `done`
    14B int4 + all fixes   5/6, 6/6, 6/6  = 17/18 work done, 10/18 reached `done`

**The 7B's tool errors went 6 -> 0 -> 0.** So the fixes worked for it too: the environmental
failures are gone and the hub is no longer its bottleneck. It simply cannot convert a clean
environment into finished work — zero completions in eighteen attempts.

**The two causes are separable, which is the useful part.** Hub bugs were costing the 14B its
completions (12/18 -> 17/18 once removed). Removing the same bugs for the 7B produced cleaner
failures at an unchanged score. So "is it the model or the hub" had a real answer: both, and
they came apart cleanly under measurement.

**Decision for [[local-server-december-2026]]:** the 48GB box should run ONE 14B, not several
7Bs. 14B int4 is ~9GB of weights, leaving room for a 32B int4 (~18GB) to test further up.
Do not plan around parallel 7B workers for agent-loop work.

**Still unresolved and blocking unattended runs:** `done` is erratic even on the 14B (3, 5, 2
across passes) and one `stopped` goal strands an entire chained queue, so "queue 20 goals
overnight" still completes one or two and idles. Both are agent.js issues reported to
session 00 with patches. See [[advisory-vs-mechanical-recovery]] for why every fix that
worked was mechanical and every advisory one failed.

Raw logs preserved in the repo at `measurements/2026-09-10-small-model-loop/` (they had been
living in Windows temp while the conclusions were being committed).

**Identity clarification (2026-09-22, after tatte recalled "that was DeepSeek"):** the logs name
the 7B as **`Qwen2.5-Coder-7B-Instruct-AWQ`** and the 14B as `Qwen2.5-Coder-14B-Instruct-AWQ`;
`f7b.log` and `after-fix.log` say A10G. The `prove7b-20min` run hit a separate **L4 bf16**
endpoint (README: 11.5 tok/s, "a false economy") - a different measurement, not the 12/18 one.
No DeepSeek 7B was ever run here. The DeepSeek that WAS tried is `deepseek-r1:1.5b`, local
Ollama, through the real hub (COORD.md Addendum 4, ~line 1314) - see [[no-local-models-hard-rule]].
