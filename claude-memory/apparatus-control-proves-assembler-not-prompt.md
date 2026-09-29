---
name: apparatus-control-proves-assembler-not-prompt
description: "A perfect-output control proves the assembler works, never that the prompt is sufficient — one arm passed its control and scored 0/20 because the prompt never named the parameter"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T10:27:27.854Z
---

2026-09-18. Every arm of a visibility ladder passed its apparatus control — feed a perfect fragment, it
assembles, it verifies, so the arm can reach 10/10 if the model cooperates. The `W0` arm passed that
and scored **0/20**.

With zero source lines visible, `W0`'s prompt never said the parameter was called `n` (the task text
says "values below 10"), so the model wrote `value < 10`, `size < 10`, and invented whole functions to
hang a guard on. It could not have produced the fragment the control fed it.

    an apparatus control proves the ASSEMBLER works
    it says nothing about whether the PROMPT is sufficient

**Why:** two different questions, and only one had a mechanism. A void rung cost a whole GPU window.

**How to apply:** every generation family runs **three** controls, not two —

    can the apparatus express a pass?        assembler control
    can the apparatus express a failure?     inversion / off-by-one control
    can the model obtain the facts?          sufficiency control

`legasus/legalabs/sufficiency.mjs` mechanizes the third: every identifier the expected output depends
on must appear in the prompt as a whole word (string contents are values; keywords and builtins need no
source). A substring test is wrong — "function" contains an `n`.

**It caught a bug it wasn't written for.** Fifteen minutes after being built it flagged a prompt reading
"named undefined", because a shell-quoted `node -e` had eaten the backslashes in the regex deriving the
parameter name. Corollary rule: **every derived fact rendered into a prompt asserts itself before
rendering** — a derivation yielding `undefined` and interpolated anyway becomes the literal string
"undefined", with no error.

Related: [[bounded-authority-trades-destruction-for-refusal]], [[silent-failures-are-the-class]],
[[gate-harness-build-traps]], [[verify-the-path-the-change-is-on]],
[[never-pass-prose-through-a-shell-argument]].
