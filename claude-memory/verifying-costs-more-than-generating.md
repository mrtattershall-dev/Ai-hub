---
name: verifying-costs-more-than-generating
description: MODEL-CMP-1 2026-09-26 - 16 s of generation against 139 s end-to-end per attempt; the gate dominates the clock, so escalation economics are about verification, not tokens
metadata:
  type: project
---

CORRECTED 2026-09-27 by arm C. The original claim - "generation 16.4 s against 139 s
end-to-end, verification is ~88% of the clock" - was driven by ONE OUTLIER. Arm A's five
verification times were 19, 15, 13, **554**, 13 s; without the 554 s row the mean is 15 s,
and arm C measured 21 s for the same local code. The outlier matches a 9.5-minute gap
before the next attempt, on a machine with a recorded history of sleeping mid-run.

The outlier stays IN the elapsed account: the five attempts took **696 s** and that is the
real cost in time. Typical timing is reported alongside, not instead. And the cause is NOT
established - a 9.5-minute timestamp gap does not distinguish sleep from contention or a
stalled browser, so it is recorded as one unexplained slow attempt.

What holds for planning: **verification takes roughly 13-24 s here, with occasional attempts
far slower.** So:

    on CPU   generation 16 s vs verification 15 s   - comparable, NOT 1:7
    on GPU   generation 1.4 s vs verification 21 s  - verification dominates, about 15:1

Arm A's row: 0/5 accepted, 0/5 passed the planting clause, 4/5 preserved movement, 2/5
inserted code, 865 output tokens, $0.00. It reproduced INC4-1's exploratory cell D seed
for seed, so the frozen pipeline is stable rather than drifting.

**Why:** the plan is to use the cheap model where it succeeds and escalate hard edits
within a budget. Once generation is on a fast backend, that budget is mainly VERIFICATION
cost, which is the same whichever model produced the candidate: a cheap model that needs
three attempts costs three verifications. On a slow CPU the two are comparable instead, so
the claim is backend-dependent and must not be stated flatly.

**How to apply:** when costing an escalation policy, price attempts by verification, not by
tokens; count how many gate runs a policy implies before counting dollars of inference. And
when a model comparison is run, report time and cost per arm next to success, so a
"cheaper" arm that needs more attempts cannot look cheaper than it is. Frozen config in
legasus/screen/MODEL-CMP-1_DEFINITION.md; arm B needs authorization from Micheal. See
[[one-handler-task-still-unbuilt]], [[instruction-shape-dominated-the-result]],
[[gpu-cost-per-token]].
