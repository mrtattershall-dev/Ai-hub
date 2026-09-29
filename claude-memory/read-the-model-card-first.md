---
name: read-the-model-card-first
description: "Weeks of hub work fought problems the model card answers — Qwen3-Coder-30B-A3B is 262K context with documented sampling params and a native tool-call format, while the hub served 16K, no repetition_penalty, and 348 lines of prose regex"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-13T01:38:26.238Z
---

2026-09-12, tatte asked "did you ever think to go to the qwen website to see how qwen works?" Nobody had. The
model card for Qwen3-Coder-30B-A3B-Instruct against what the hub actually sent:

| | documented | hub sent |
|---|---|---|
| context | 262,144 native (1M via YaRN) | `max_model_len=16384` |
| temperature | 0.7 | 0.2 |
| top_p | 0.8 | unset (shim injected 0.95) |
| top_k | 20 | unset |
| repetition_penalty | 1.05 | **unset** |
| output length | 65,536 recommended | `MYCODER_MAX_NEW=3072` |
| tool calling | "specially designed function call format", Qwen-Agent has the parsers | none — prose regex |

**Why it matters:** the loop guard ended **365 of 1,041 recorded runs (35%)**, the largest single cause of death,
and `repetition_penalty` was never set. The hub answered a sampling problem with a sliding-window reply-hash
guard, a pardon mechanism and a mechanical tool-substitution hatch. The entire context-starvation investigation
(12-message cap, NUM_CTX, pruner budgets) argued over 6% of the model's real window. "Could not parse an action"
killed 9 runs because the hub invented a text protocol instead of using the trained one.

**How to apply:** before building machinery around a model's behaviour, read its card — context length, sampling
defaults, output-length guidance, and whether it has a native tool/function-call format. Check what the *serving*
layer sets too: in this project `modal_serve_vllm.py` injected `top_p=0.95` on its own, so the effective sampling
was decided by the shim and the hub had no idea. Two caveats learned at the same time: 262K KV cache for a 30B MoE
on one H100 is likely unaffordable (the card itself says drop to 32,768 on OOM), and the offline replay rig
**cannot** validate sampling or context changes because the mock serves recorded replies — the model never
generates. Those need a GPU window.

Related: [[wall-clock-is-not-model-latency]], [[measure-the-thing-itself]], [[offline-replay-rig]].
