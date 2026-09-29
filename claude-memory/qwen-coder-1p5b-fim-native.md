---
name: qwen-coder-1p5b-fim-native
description: "qwen2.5-coder:1.5b exposes FIM natively through ollama (Capabilities: insert, /api/generate prompt+suffix) - a localized repair returned 78 chars of correct method body where the whole-file repair gate echoed its input byte-identically 8 times in 10"
metadata: 
  node_type: memory
  type: reference
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-14T08:49:09.766Z
---

2026-09-14. Verified on the local build, not read off a spec sheet.

    ollama show qwen2.5-coder:1.5b
      architecture qwen2   parameters 1.5B   context length 32768   quantization Q4_K_M
      Capabilities: completion, tools, INSERT        <-- FIM
      qwen2.block_count 28   embedding_length 1536   feed_forward_length 8960
      attention.head_count 12   head_count_kv 2   rope.freq_base 1000000

**FIM is reached through `/api/generate` with `prompt` (prefix) + `suffix`** - not the chat endpoint.
A live probe asking for one missing method body returned **78 characters**, correct, clean stop:

    if (!this.has(key)) return false;
    this.m.delete(key);
    return true;

Assembled and executed: contract passes, `delete('a')` true, `delete('zz')` false, size 1, `clear()`
leaves 0, no execution contamination. N=1 - a feasibility proof, not a result.

**Why this matters:** Qwen2.5-Coder was trained with explicit FIM and repository-level objectives
(fim_prefix 151659, fim_middle 151660, fim_suffix 151661, repo_name 151663, file_sep 151664). So
"here is the surrounding code, return the missing piece" IS its training objective, while "here is
the whole file and the error, return the corrected whole file" is not. That is the most plausible
explanation yet for the whole-file repair gate returning **byte-identical** replies on 8 of 10
goals - at temperature 0.7, copying a file handed straight back is the dominant continuation.
See [[orchestration-discards-good-work]].

**How to apply:** the localized-repair gate should use FIM, never whole-file regeneration. Never ask
this model to reproduce a file it was just shown.

**Facts to state correctly about this model (all previously got garbled somewhere):**
  * Q4_K_M is MIXED quantization, roughly 5.1 effective bits/param over the file (Q4_K for most
    matrices, Q6_K for embeddings and some V/down projections, F32 norms). Never write "4-bit".
  * 32,768 is the NATIVE released context. 131,072 requires YaRN and is a DIFFERENT experimental
    condition, not a free assumption.
  * Qwen3-Coder-30B-A3B is MoE: ~30.5B stored but only ~3.3B ACTIVE per token, so versus this 1.5B
    it is ~2.14x active parameters, not ~20x. Qwen2.5-Coder-14B is ~9.5x total, ~10x non-embedding.
  * 1.5437B total / 1.3103B non-embedding; the tied embedding is 233M = 15.1% of the model, and FFN
    is ~74.9% of all parameters (8960/1536 = 5.83x expansion, versus 2.70x on the 14B).
  * Published 1.5B-Instruct scores move a lot with the harness (HumanEval 70.7 in the Qwen report
    versus 64.6 in a later standardized re-evaluation; MBPP 69.2 versus 51.0) - independent outside
    corroboration of [[measure-the-thing-itself]] and of this project's central finding.

**Attribution warning:** every early 1.5B result in this project (12/12 delete, 8/8 has, the
suppressor A/Bs) was `qwen2.5:1.5b`, the GENERAL instruct model - NOT Coder. Do not attribute them.
