---
name: token-oracle-template-trap
description: 2026-09-27 - a token oracle that sends `prompt` alone measures a DIFFERENT template from generation, which sends prompt+suffix; they disagreed by 24 tokens. Count the actual generation request and verify against its own prompt_eval_count
metadata:
  type: feedback
---

Matching two prompts by size needs a token count, and ollama will give you one via
`prompt_eval_count`. Two traps, both measured on unique never-seen prefixes:

    the template   generation sends `prompt` AND `suffix`, which selects the INFILL template. Sending
                   `prompt` alone selects another one. They disagreed by 24 tokens for identical
                   content, so every match made the first way was made on a template the run never
                   uses. countTokens now REFUSES when the suffix is withheld.
    num_predict    0 took 40.7 s on a 509-token prompt; 1 returned the IDENTICAL count in 0.4 s. The
                   obvious choice makes the instrument unusable and looks like a model hang.

Cache: repeating an identical request does NOT move the count (60/60, 36/36, 37/37), so counts are
cache-safe - but it moves TIME by 10x (2243ms -> 191ms), so oracle time must be reported separately and
the first generation after it is not a clean latency sample.

**Why:** STABLE IS NOT CORRECT. Two agreeing readings show reproducibility, not validity. Both numbers
above were perfectly stable and one of them was the wrong number.

**How to apply:** these are findings about the requests TESTED (short prefixes, one suffix, one build) -
do not generalise them, and never apply the 24-token gap as a correction. Count the request the run will
actually send, and have the generation call report its own `prompt_eval_count` so the match is verified
against the real call per task rather than trusted from a probe. Characters are the wrong unit anyway:
a 65-char comment line is 25 tokens where 90 chars of indented code is 35. See
[[constraint-arms-not-runnable]] and [[instruction-shape-dominated-the-result]].
