---
name: run5-loops-single-turn-data
description: run5 on the hub 2026-09-10 loops (repeats byte-identical replies) because all 13,762 of its training rows are single-turn; user then chose to retrain the BASE 14B
metadata:
  type: project
---

run5 (14B QLoRA) served on the hub (AWQ base + /adapters/run5, identity-verified) stopped on the
repeat detector in 9 of 12 goals after only 3-5 model calls; replies 3-5 of goal 1 were
byte-identical. Cause, measured: training-data/factory/trained_run5.jsonl has 1 assistant turn in
all 13,762 rows, 0 rows with a hub tool result, 0 in the hub's THOUGHT/ACTION format. It learned
one-shot code writing, not acting on a tool result.

**Decision 2026-09-10 (tatte, verbatim): "Run five doesn't matter. We're retraining base 14b
coder".** run5 was stopped early.

**Why:** any fine-tune aimed at the hub must train on MULTI-TURN hub traces (reply -> tool result
-> next reply), or it trades away the base model's ability to work a loop.

**How to apply:** start from unsloth/Qwen2.5-Coder-14B-Instruct, not run5. Mask to responses only
(run5's trainer had no train_on_responses_only). Target the measured gaps: deciding WHICH side of
a failed assert is wrong, exporting what the goal names, merging instead of appending. See
[[hub-fixes-fired-model-ignored-2026-09-10]], [[run5-findings-2026-09-09]], [[h2h-14b-vs-32b-2026-09-10]].
