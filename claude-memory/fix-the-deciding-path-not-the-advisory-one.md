---
name: fix-the-deciding-path-not-the-advisory-one
description: Twice in this hub a bug was fixed on the path that only advises the model and left on the path that actually decides - check which path binds before calling a fix done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T01:21:29.023Z
---

A recurring shape in the coding hub, found twice on 2026-09-11:

1. **Definition loss.** A write that deleted existing functions produced a *warning* in the tool result. Set F
   measured the worth of that: 7 of 8 warnings ended with the names still missing, and one such write erased the
   credit for eight earlier steps. The advisory fired perfectly and protected nothing. Fixed by making the write
   **refuse** and restoring the file.
2. **The finish gate.** `verify_project` (the tool the model may call for advice) was fixed in set E to resolve an
   entry from the goal, after it reported "`node q1_stock.js` ran and exited cleanly" for a goal about
   `q8_units.py`. The **gate** — the code that actually decides `done` — was left calling `verify()` with no entry,
   so it kept the bug the advisory path had fixed, for months.

**Why:** the advisory path is the one you see in transcripts, so that is where a fix gets aimed. The deciding path is
quieter and usually has no output of its own when it succeeds.

**How to apply:** when fixing anything in this hub, grep for *every* caller of the function involved and ask which
call gates an outcome (status, `ok`, a block, a refusal) versus which merely produces text for the model. Fix the
gating one first, and write the test against it — a unit test on the advisory helper can pass while the gate stays
broken, which is exactly what happened with `finishGateEntry` versus `finishGateGoalEntry`.

Related: [[advisory-vs-mechanical-recovery]], [[hub-destroys-a-third-of-working-code]],
[[mutant-escaped-means-check-the-expectation]].
