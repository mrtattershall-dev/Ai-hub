---
name: no-local-models-hard-rule
description: "Local inference on the laptop: 7B+ WILL crash it (hard limit). 3B works but is slow. Corrected 2026-09-09 — the original note over-generalised to 'any size'."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
  modified: 2026-09-22T10:16:34.288Z
---

**The limit is SIZE, not local inference itself.**

User instruction, 2026-07-16, verbatim: *"do NOT use local models. im on a laptop and it can not use 7b... itll crash my laptop."*

**Corrected 2026-09-09** by the user: *"That rule was specifically about 7b but 3b worked, slow, but worked."*

So:

- **7B and above — never.** It crashes the machine. This part is unchanged and firm.
- **~3B and below — allowed.** Works, just slow. Ollama has `deepseek-r1:1.5b` and `phi3` pulled.

**Why the correction matters:** the original note said "never, at any size, even just to test", which is stricter than what the user actually said and would rule out a legitimate option. A local 3B has one real advantage over the free hosted tiers — **no rate limits, no shared pools, no 429s** — which makes it good for end-to-end integration testing where external flakiness would otherwise be the thing that fails. See [[free-model-providers]].

**Which 1.5B (2026-09-22, tatte: "1.5B coder is the bare minimum"):** for any local pilot use a
1.5B **coder** - `Qwen2.5-Coder-1.5B` ([[qwen-coder-1p5b-fim-native]], [[protocol-not-capability-ceiling]]) -
not `deepseek-r1:1.5b`. The R1 distill was driven through the real hub (COORD.md Addendum 4) and
came out "structurally reliable, semantically weak": obeys every contract, writes goals that
repeat, mis-order and ignore constraints. Fine for proving the machinery, not for judging work.
tatte's own summary: DeepSeek "sucks". The 7B that was measured against the 14B was Qwen, not
DeepSeek ([[capability-floor-7b-vs-14b]]).

**How to apply:** for anything 7B+, remote only (Modal Qwen2.5-Coder / Qwen3-Coder class). For a 3B smoke test on `localhost:11434`, fine — expect it to be slow. For pure LOOP marathons prefer `server/fakemodel.mjs`: 4,149 calls in 25 minutes, free, no crash risk, and it measures the loop rather than the model. Related: [[behavior-spine-direction]], [[human-language-gap-finding]].
