# REL-1 Amendment 1 — the model is qwen3.5:4b, not qwen2.5-coder:7b

Recorded 2026-10-21, BEFORE any REL-1 session has run. REL-1_REPEAT-WARN_PREREG.md (frozen at be11fb53, sha256
744105c5bf49bb07920915d15d54db7df5b5b0e4c3189661a2fd4c560c8f9804) is unchanged; this amends one line of it.

## The change

    Design, "Model":  qwen2.5-coder:7b via Ollama  ->  qwen3.5:4b via Ollama

Everything else stands: arms, paired seeds 101-110, arm order, endpoints R1-R5, falsifiers, the fixed plan.

## Why, from records

- The laptop has 7.0 GiB of RAM. The 7b took ~6 GB (num_ctx 16384); swap reached 3.7 of 4 GB, swap-in ran at
  ~34 MB/s, and generation fell to ~1 token/s.
- Ollama was oom-killed TWICE on 2026-10-21 (systemd: "Failed with result 'oom-kill'", restart counter 2). The
  first kill is the likely cause of the "model unreachable" pause in session 1; the second ended session 2 goal 5.
  A model the machine keeps killing would make R4 (harm) and every budget endpoint measure the host, not the arm.
- qwen3.5:4b on the same prompt, the 7b unloaded: 3.7 GB resident, 6.4 tokens/s generation, 32.4 tokens/s prompt,
  and it answered in the hub's THOUGHT/ACTION/PATH + fenced-block format on the first try. Its reasoning comes
  back in Ollama's separate `thinking` field, not in the reply the parser reads.

## Consequences, stated so they are not forgotten

- REL-1 is now a result about qwen3.5:4b. It says nothing about the 7b, and no 7b number may be pooled with it.
- The live 7b sessions 1-2 (data/gather/s1, s2) are not a baseline for REL-1. REL-1's own CONTROL arm is.
- The model is set per experiment in gather.mjs (EXPERIMENTS['REL-1'].model), so the owner hub's saved model is
  not what decides it.
