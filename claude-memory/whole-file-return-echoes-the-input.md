---
name: whole-file-return-echoes-the-input
description: INC2-1 2026-09-26 - handed its own accepted page and asked to extend it, qwen2.5-coder:1.5b returned the same file 5/5; whole-file-return is the wrong interface for editing an existing file
metadata:
  type: project
---

2026-09-26, INC2-1 ($0, local qwen2.5-coder:1.5b): asked to add increment 2 to the
increment-1 page an independent gate had ACCEPTED, the model returned the seeded file
itself on all five seeds - three byte-identical, two differing only by a trailing
newline, 901 output tokens every time. Play verdict was exactly the seeded page's own
([1,2,3] pass, [4,5] fail). Accepted 0/5.

A $0 probe with the same instruction and seam but the file NOT in the prompt wrote new
code 3/3 and reached planting (steps 1-4) once, so inability to write the feature does
not explain the echo. The probe does not isolate the handed-in file either: prompt
length (1,399 vs 481 tokens) and the preservation obligation differ too, and it violates
the increment chain's own precondition.

This REPLICATES [[qwen-coder-1p5b-fim-native]] (whole-file rewriting echoed the input
8/10 where localized repair worked), now 5/5 on a real accepted artifact.

**Why:** "keeps building and gets better" is blocked at the generation INTERFACE for
later increments, not at the safety layer - protection worked perfectly here (nothing
accepted, no regression, increment 1 intact 5/5) while building produced nothing.

**How to apply:** for any increment past the first, do not ask this size of model to
return the whole file. Use a localized edit (FIM, or insert/replace a named region) and
measure it against this same accepted page at $0. Report protection and building as two
separate columns - five honest PRESERVE_INCOMPLETE labels are still zero progress. See
[[protocol-not-capability-ceiling]], [[generation-interface-masks-capability]].
