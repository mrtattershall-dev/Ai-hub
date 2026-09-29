---
name: accumulated-checks-and-structural-containment
description: ASSIST-3/4/5 2026-09-27 - an accepted addition surviving the FULL accumulated checks; the protected set must be a computed union and the edit boundary must cut on STRUCTURE (truncate at the escape point) - refusing over-long output outright is safe and useless
metadata:
  type: project
---

2026-09-27, $0 local, same frozen policy, zero interventions during execution. The farm page now
**moves, plants AND grows**, with every previously accepted behaviour intact: grow spec 6/6,
diagnostic 6/6, evaluator requested PASS, accumulated protected set PASS, the planting spec all
7/7 with zero errors. Artifact: 2 -> 3 keydown listeners, no stray bindings, +521 characters.

**The sequence matters more than the win:**

    ASSIST-3  accumulated protected set alone -> the candidate class ASSIST-2 ACCEPTED was now
              RESTORED. The regression caught live. 0 of 5 accepted.
    ASSIST-4  containment refusing anything over budget -> 8 of 8 REFUSED as TOO_LARGE (32-94
              lines for a 20-line slot). SAFE AND USELESS: this model always writes past a small
              slot even when its first lines are right.
    ASSIST-5  containment with STRUCTURAL TRUNCATION - cut at the first point the completion would
              close a block it did not open, then refuse what still cannot fit -> accepted on the
              second attempt, 109 junk lines dropped, the correct 7 kept.

**Two rules that are now infrastructure:**
1. the protected set is the **computed UNION** of every previously accepted requirement, each run
   as its OWN sequence from a fresh load (they are stateful - concatenating them fails a good
   page). Intentional changes are explicit: `accumulates` plus `supersedes` with a reason.
2. the edit boundary cuts on **structure, never on a line the model must reproduce**. That
   dependence is exactly what let ASSIST-2's 4,000 characters of invented handlers through.

`regressionCase.test` 10/10 keeps the bad artifact as a case: refused structurally AND by the
accumulated set at planting step 6, while a bounded implementation still passes everything - a
fix that only refuses things would fail that half.

**Qualifications to repeat whenever this is cited:** 2 attempts vs ASSIST-1's 15 is NOT an
efficiency result (different tasks, inherited preparation); the output limit and protected-check
selection ARE parts of the system, so "not the policy's fault" was too narrow - the SYSTEM failed
in ASSIST-2; the task was fresh but the page informed the rules, so this is automatic application
on THAT page, not generalisation; zero interventions applies to EXECUTION, since the fixes were
built between runs. See [[system-chose-guidance-then-gate-accepted-junk]],
[[assist-1-ceiling-exists]].

**Next honest test:** a page whose shape I have never read.
