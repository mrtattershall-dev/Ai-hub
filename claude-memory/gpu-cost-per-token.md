---
name: gpu-cost-per-token
description: Price GPUs per TOKEN not per hour; A10G+int4 AWQ is the measured sweet spot and L4 bf16 was a false economy
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T17:28:26.202Z
---

Measured 2026-09-10 on Modal, same prompt and same agent harness against
Qwen2.5-Coder-7B-Instruct:

    7B bf16  / L4     11.5 tok/s   ~$0.80/hr   ~$19  per 1M output tokens
    30B      / H100    133 tok/s   ~$4/hr      ~$8   per 1M output tokens
    7B int4  / A10G   81.5 tok/s   ~$1.10/hr   ~$3.75 per 1M output tokens  <- best

**Why:** decode is memory-bandwidth-bound. L4 ~300 GB/s vs A10G ~600 GB/s, and int4 moves
~3.4x fewer weight bytes than bf16. Predicted ~6.8x, measured 7.1x — the physics holds, so
this generalises rather than being a one-off.

**The trap:** "cheapest GPU" priced per HOUR picks the L4, which is 5x cheaper per hour and
~2x MORE expensive per token, because you rent wall-clock while a starved card trickles.
Always price per token for generation workloads.

**Hardware bearing on [[local-server-december-2026]]:** an RTX 4070 is ~504 GB/s but only
12 GB, so a bf16 7B (~15 GB of weights) does NOT fit — consumer cards force quantization,
which is fine because int4 is both faster and no worse once the workspace facts are stated
(see [[unstated-env-fact-looks-like-model-quality]]).

Endpoints deployed via env vars against `modal_serve_vllm.py` (no new script), distinct
MYCODER_APP names so they cannot clobber each other: `coder7b-l4`, `coder7b-a10g-awq`.
Deploy trap: `modal` is NOT on PATH here — use `python -m modal deploy`, and never pipe it
(a piped deploy reports tail's exit status, so a failure looks like success).
