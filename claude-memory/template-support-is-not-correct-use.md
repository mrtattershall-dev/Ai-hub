---
name: template-support-is-not-correct-use
description: 2026-09-26 - I argued a suffix reached the model because the template supports infilling; support is interface capability, not correct use in a given run. Verify by token accounting.
metadata:
  type: feedback
---

2026-09-26: I claimed a FIM suffix reached the model *because* the ollama template renders
`{{ if .Suffix }}<|fim_prefix|>{{ .Prompt }}<|fim_suffix|>{{ .Suffix }}<|fim_middle|>`. That
does not follow. A template's support establishes what the interface CAN do; it says nothing
about whether this run used it correctly.

How to actually check it without a server patch (`server/fimWireCheck.mjs`):

    B  prompt + suffix, as the harness sends it      prompt_eval_count 26
    C  raw:true, the FIM tokens written by hand      prompt_eval_count 26
    D  raw:true, same but an EMPTY suffix            prompt_eval_count 14
    the suffix alone                                              12 tokens
    greedy first token of B and C                    identical

B == C plus a gap equal to the suffix's own length establishes the same rendering. Its LIMIT:
token counts and one token, not a dump of the request. A first attempt compared against a
request with NO suffix field - **not comparable**, because that takes the chat-template
branch and counts 40 tokens for unrelated reasons, which looked like proof the suffix had
been dropped.

**Why:** "the library supports X" is a capability claim; experiments need a use claim about
the specific run.

**How to apply:** for any wire-level assumption (a suffix, a seed, a stop token, a system
prompt), measure something that differs when it is absent - token counts, a greedy first
token, a canary string. Compare like with like: two requests that take different template
branches are not a control for each other. Related: [[measure-the-thing-itself]],
[[verify-the-path-the-change-is-on]], [[unstated-env-fact-looks-like-model-quality]].
