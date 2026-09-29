---
name: perfect-protection-can-mean-no-work
description: 2026-09-26 - twice in one day a flawless protected-steps score meant the model did nothing; always report protection and building as two columns
metadata:
  type: feedback
---

2026-09-26, twice in one day on the same product goal:

- INC2-1: protected steps passed 5/5 because the model returned the seeded file unchanged.
- INC3-1 (5-line region): protected steps passed 5/5 because not one infill inserted a
  line of code - four looped a comment to the token ceiling.

Both look like the safety layer working perfectly. Neither is a safety result.

**Why:** "did not break what worked" and "added what was asked" are different claims, and
a do-nothing candidate maximises the first. A report that leads with the protected score
describes an inert system as a safe one.

**How to apply:** always show protection and building as two separate columns, and put a
"did the program change / did the edit insert code" boundary between them. When a
protected score is perfect, state in the same sentence whether any work was done. The
honest summary of both runs is "protection worked, building did nothing". Related:
[[silent-failures-are-the-class]], [[measure-the-thing-itself]],
[[capability-vs-proof-artifact]].
