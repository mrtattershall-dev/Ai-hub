---
name: instruction-shape-dominated-the-result
description: INC4-1 2026-09-26 - same model, site and seeds: a 9-line instruction comment in the hole gave an EMPTY completion 5/5, a 1-line version gave code 3/3; INC3-1's "0/5 inserted code" was my prompt
metadata:
  type: feedback
---

2026-09-26, INC4-1 ($0, qwen2.5-coder:1.5b, one 5-line hole, same seeds, same site):

    instruction inside the hole            outcome
    4 lines (increment-2 text)             comment loops to the token ceiling, 0/5 code
    9 lines (the task goal, wrapped)       EMPTY completion 5/5, ONE output token
    1 line  (the same rule, compressed)    CODE in 3/3, 13-15 s

So [[anchor-protocol-edit-site-failure]]'s companion figure - "0 of 5 inserted any code"
in the five-line fim cell - was a property of the comment block I placed in the hole, not
of the model. Two more apparatus faults in the same run: the infill instruction was
HARDCODED to the previous increment (so a narrowed task silently asked for the old
feature), and the model closed the document inside the hole 3/3 despite a suffix that
already contained `</script></body></html>`, orphaning the seam - fixed with a
deterministic tail trim, after which the page survived 4/5.

**Why:** a positive control proving a region PERMITS a solution does not isolate model
capability from prompt format, decoding or interface fit. I reported a prompt artefact as
a model limit, and only found it by shortening my own text.

**How to apply:** before concluding anything from a null, vary the harness's own text and
re-run - instruction length is a first-class variable, not framing. Keep the exact prompt
in the record. When a run's instruction is built by the harness, derive it from the task
and never hardcode it. Related: [[gate-prompt-suppressor]],
[[redundant-wording-changes-completion-behaviour]],
[[generation-interface-masks-capability]], [[apparatus-control-proves-assembler-not-prompt]].
