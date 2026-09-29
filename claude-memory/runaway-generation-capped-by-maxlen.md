---
name: runaway-generation-capped-by-maxlen
description: num_predict -1 means "generate to max_len", so raising context multiplies the cost of a repetition collapse; qwen2.5:1.5b collapses and eats whole goals
metadata:
  type: project
---

2026-09-13, set-H 1.5B run. The hub sends `num_predict: -1` (agent.js:175, "never truncate a long file
mid-write"). `modal_serve_vllm.py` `_opts()` line 227 turns that into `npred = MAX_LEN` — so **max-new-tokens
is the CONTEXT WINDOW, and `DEFAULT_MAX_NEW=3072` is dead code on this path.**

Qwen2.5-1.5B-Instruct collapses into degenerate repetition (71k chars of `assert(evaluate("10/2") === 5);`;
133k chars of `- Verify that the script is ...`) and generates until the window ends. At max_len 32768 that is
~478s of GPU execution in ONE call, which kills a goal under `AGENT_MAX_MINUTES=8`. At 8192 the same collapse
costs ~126s and the goal survives. **Raising context silently multiplies the cost of every collapse.**

Serve at max_len **16384** to match `agent.js:174` `NUM_CTX = 16_384` — the window the hub already assumes.
Lower truncates real prompts (largest MEASURED ~8,532 tokens across 62 recorded prompts), higher widens the runaway. Measure density from an oversize REJECTION (it reports the exact token count) - never by pairing a char count with a token count from a different request, which is how a bogus 2.47 chars/token figure sized three rounds of validation.

`_params()` sets only temperature and top_p — **no repetition_penalty**, though the Qwen2.5 card recommends
1.05 (with temp 0.7 / top_p 0.8 / top_k 20). Same omission as [[read-the-model-card-first]].

**Why:** a 478s SUCCESSFUL request looks exactly like a hang or a dead engine from the outside. I called it
infrastructure loss twice, and an alarm keyed on "high seconds + <=1 model call" reports it as engine death.

**How to apply:** when a goal burns its whole budget on one call, read the RECORDED REPLY LENGTH before
blaming the server — a collapse is a 200 OK. Check `num_predict`/`max_tokens` resolution before changing
max_len, and never add a sampling fix mid-experiment that the comparison arms did not get.
