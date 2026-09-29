---
name: goal-coupling-wrong-denominator
description: "Goals 11-20 are step 2 of goals 1-10's projects, so P(second pass | first failed) = 0.083 vs 0.563 - 20 goals are ~10 independent tasks and every percentage published from this rig has been against the wrong denominator"
metadata:
  type: project
---

The 100-goal and 20-goal sets are **not** independent tasks. Goal `N+10` extends the project goal `N` created, and
re-exercises its API. Measured over 8 arms x 10 projects (80 pairs) in the 2026-09-12 audit:

    P(second pass | first PASSED) = 0.563
    P(second pass | first FAILED) = 0.083     <- a 6.8x penalty, 4 recoveries in 48

So **20 goals are ~10 independent tasks**, a single defect is double-counted, and a model right on 7 of 10 projects
tops out near 11/20. Worse: a file that does not PARSE fails all ten of its goals at once (set H's 14B control lost
48 of 100 that way), and `s10_desk.js` needs `s1` and `s7`, so one broken `s1_library.js` costs goals 1, 10, 11 and 20.

**Every percentage published from this rig has been against the wrong denominator** - including "30B 39/100" and
"dense 6/20". The scores are not wrong, the *denominators* are.

This is why twenty-plus hub fixes across sets D-J barely moved the number. The fixes worked and were nearly
exhausted - destruction of working code fell 33% (F) -> 18% (G) -> 0 of 50 (H), duplicate-definition files 10 -> 2 -
while roughly half of each denominator is goals never attempted or goals conditioned on an earlier failure.

**How to apply:** before running another set, decide whether the question is "can it do ten projects" or "can it do
twenty steps". If the former, score per PROJECT and report the conditional rates. If the latter, decouple the second
pass so it can be attempted from a clean fixture. And compute the detectable effect first: on 20 goals the observed
+/-1-2 noise means detection needs about +6, so a pre-registered +3 is unfalsifiable before the window opens.

Related: [[setG-result-budget-is-the-ceiling]], [[setI-agentic-moe-beats-dense-32b]],
[[hub-destroys-a-third-of-working-code]], [[long-run-accuracy-north-star]].
