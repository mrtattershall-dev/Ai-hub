---
name: modal-spend-policy
description: 2026-09-22 tatte decision — ~$30 Modal balance; spend ONLY when a question cannot be answered without the larger model; never on replay/checker work
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-22T10:30:51.856Z
---

2026-09-22, tatte, deciding against a proposal to move the Set G recovery to a Modal T4:

> "Compute should answer an experiment, not substitute for one."

The split, as stated:

    historical recovery / checker  -> the current box, CPU / Node / Python / Chrome
                                      (preserves comparability)
    new model campaign             -> Modal, A10G-class, 14B int4
                                      measure COST PER USEFUL VERIFIED RESULT

Balance is ~$30. That is plenty for targeted experiments if instances are started and stopped
rather than left sitting. Nothing needs training right now. The valuable use is running a
frozen campaign where GPU time buys the answer to a specific question.

**Why:** this generalises a lesson already paid ~$150 for. Reaching for compute is a way of
looking busy without having designed an experiment.

**How to apply:**
- Never propose GPU for replay, checker, regress, or fuzz work — it is CPU/IO-bound and a GPU
  changes nothing. Verify what a job actually spawns before suggesting hardware for it.
- Re-measuring a FROZEN historical state must run in the environment it was measured in, or
  the result is comparability-unestablished (see [[comparability-unestablished-2026-09-22]]).
- Before any spend, state the question that cannot be answered without the larger model. If
  there isn't one, don't spend.
- T4 is the wrong card anyway: 16GB, Turing, no bf16. 30B-int4 (~17GB) does not fit; A10G is
  better on fit AND price-per-token (see [[gpu-cost-per-token]]).
- Keep squeezing the 1.5B / local / replay work first (see [[offline-replay-rig]]).

**2026-09-22 amendment (tatte):** the primary PAID Legasus A/B campaign is **7B, not 14B** -
more repetitions for the same balance. 14B becomes the replication rung on the local server
when the 5090 arrives (see [[local-server-december-2026]]). Condition: the 7B must pass a
tool-protocol qualification gate first, because [[capability-floor-7b-vs-14b]] measured a 7B at
ZERO completions under the hub's protocol; a 7B that fails the gate is a result about the 7B,
never scored as an arm. Prereg amendments live in legasus/screen/PHASE2-INTERVENTION_PREREG.md.

**Frozen 7B served config (Amendment 3, same file):** `Qwen/Qwen2.5-Coder-7B-Instruct-AWQ`,
A10G, deployed from `training-data/factory/modal_serve_vllm.py` blob `ec636a0d59b9` (vllm
0.11.0, max_model_len 16384, gpu_frac 0.90, top_p 0.95 server-side, chat template = checkpoint's
own, one generation per container). Hub sends temperature 0.2 hard-coded, num_predict -1, no
stop sequences, kind 'ollama'. **Set NUM_CTX=16384 on the hub for both arms** - default 24576
mis-budgets history against the 16384 window. Tool interface = agentPrompt.js `ede9be67974e` +
agentParse.js `fd39e56162e4` @ 3f5a8ff. UNESTABLISHED and to be recorded at deploy: checkpoint
revision hash, MYCODER_QUANT value. Modal client is `python -m modal` (1.5.0); zero apps on 09-22.
