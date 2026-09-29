---
name: local-server-december-2026
description: "December 2026 local build - two RTX 5090s (2x32GB) OR one RTX PRO 6000 Blackwell (96GB ECC, being considered 2026-09-11); either makes training and trace generation free; spend Modal now only to validate"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T10:48:37.681Z
---

User's build **around December 2026**. Two candidates as of 2026-09-11:
- **Two RTX 5090s**: 32 GB each, 64 GB total but in TWO pools (no NVLink - splitting one model
  across both goes over PCIe). Most aggregate throughput for serving a small model (two cards, two
  independent servers).
- **One RTX PRO 6000 Blackwell** (user: "almost the same price"): 96 GB in ONE pool, ECC memory, one
  ~600 W card instead of ~1150 W for two. Everything fits on one card with no splitting.

What each unlocks (the plan: a big teacher watching the 14B student, retraining 14B/32B on real
hub runs - see [[long-run-accuracy-north-star]]):
- 14B bf16 (~29 GB): both.  32B AWQ (~18-20 GB): both.
- 32B **bf16** (~65 GB) with a KV cache: PRO 6000 only.
- Qwen3-Coder-30B-A3B bf16 (~61 GB): PRO 6000 only (4-bit/FP8 fits either).
- 72B 4-bit (~40 GB) teacher + 14B student at the SAME time: PRO 6000 comfortably; on 2x5090 the
  72B needs both cards and the student must take turns.
- QLoRA 14B / 32B: both; 72B QLoRA (~45-50 GB): PRO 6000.
- Either: training and trace generation stop costing money; the hub stops needing a tunnel.
- Blackwell needs recent CUDA / PyTorch / vLLM builds (sm_120); vLLM is Linux-first (Linux or WSL2).

Does NOT override [[no-local-models-hard-rule]] - that rule is about the LAPTOP.

**Why:** it sets what to spend on now. 2026-09-11: trace-generation GPU on Modal capped at $30
(pilot used ~$2.5: 24/100 passed, 16 clean conversations). Use Modal to VALIDATE (does training on
real hub runs help the 14B at all?), and do the big data runs and the train/eval loop locally.

**How to apply:** when weighing a Modal run, ask whether it answers a question that cannot wait
until December. Default to data work and small validation runs until then. See
[[run5-findings-2026-09-09]], [[run5-loops-single-turn-data]], [[h2h-14b-vs-32b-2026-09-10]].
