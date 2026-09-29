---
name: setI-agentic-moe-beats-dense-32b
description: "Set I 2026-09-12: a DENSE 32B scored 6/20 where the ~3B-active agentic MoE scored 15/20 on an identical hub, goals and checker - agentic training beats active-parameter count, and I predicted the opposite in writing"
metadata:
  type: project
---

Set I ran `Qwen/Qwen2.5-Coder-32B-Instruct` (dense, 32B active per token, H100 bf16) against set H's MoE arm
`Qwen3-Coder-30B-A3B-Instruct` (~3B active per token) on the **same hub commit, same goals 1-20, same checker**.

    MoE 30B   @ its own goal-20 checkpoint (064e062)   15/20   75%
    dense 32B @ its 20 goals                            6/20   30%

**Pre-registered prediction was 16+/20 for the dense model. It scored 6.** Roughly 10x the active compute per token
produced less than half the score. This overturns the working assumption in [[coder32b-control-2026-09-09]] that a
bigger untuned model is the direction - on *agentic multi-step editing*, it is not.

**The mechanism is agentic behaviour, not knowledge.** Attribution counts say it plainly:

    dense (20 runs)   2 hit the step budget,  5 loop-guard deaths, 11 clean
    MoE   (53 runs)  21 hit the step budget,  1 loop-guard death,  23 clean

The dense model was not cut off mid-work. It got stuck repeating itself - including re-sending an edit it had
**already landed**, four times.

**Methodology that mattered:** the MoE's goals 1-20 had originally been scored against a workspace carrying 80 *later*
goals, because the checker scores the final workspace. Rebuilding its workspace from `workspace.bundle` at its own
goal-20 checkpoint and re-scoring moved it 14 -> 15, so the confound worked *against* the expected direction. Always
re-score both arms at the same point in the run before comparing.

**How to apply:** when a score gap appears between two models, check the step-budget-vs-loop-guard split before
attributing it to capability. Being cut off at the call budget is a budget result; dying on the loop guard is an
agentic one. And do not buy active parameters to fix an agentic failure.

Related: [[model-self-verification-gap]], [[setG-result-budget-is-the-ceiling]], [[h2h-14b-vs-32b-2026-09-10]],
[[tolerant-matcher-deindents-and-destroys]], [[long-run-accuracy-north-star]].
