---
name: hub-fixes-fired-model-ignored-2026-09-10
description: 14B rerun after 3 hub fixes - hand-graded 22->21 done-as-asked (flat); fixes fired 5x with correct info and the 14B misused it every time (wrong side of a failed assert 3/3)
metadata:
  type: project
---

Rerun of the 40 head-to-head goals on the base 14B after the cut-off, duplicate-declaration and
assert-evidence fixes (measurements/2026-09-10-14b-rerun/README.md). Hand-graded: done as asked
22 -> 21, implementation correct 32 -> 31. The scorer claimed 25 -> 33 - it was wrong again, mainly
because console.assert failures exit 0 and "exporting X" is not checked.

Mechanism evidence: assert evidence showed exactly the right LEFT/RIGHT values in 3 goals and the
14B edited the wrong side 3/3 (it trusts its test over its code). Duplicate flag: acted on twice,
merge failed twice. Cut-off fix: never needed.

**Why:** the hub now detects and explains; the 14B does not reason from the explanation. More hub
advisories will not close the gap - it is in the model. Same lesson as
[[advisory-vs-mechanical-recovery]].

**How to apply:** stop adding advisory hub text for the 14B's reasoning failures; put that effort
into training data ([[run5-loops-single-turn-data]]). Grade by hand; never trust trial35's "work"
count alone. Open hub gap: treat "Assertion failed" in node output as a failed self-test.
