---
name: constraint-arms-not-runnable
description: CONSTRAINTS-2 part 1 2026-09-27 - the extracted-constraints vs nearby-code comparison returned NOT RUNNABLE under its own pre-declared rule; the two strategies' viable prompt-size windows do not overlap at the FIM comment-block interface
metadata:
  type: project
---

2026-09-27, $0 local, 1.5b, 18 model calls. Pre-registered rule: a token budget qualifies when both
arms DELIVER and both REACH THE GATE in 2 of 3 seeds; pick the largest qualifying budget, else report
NOT RUNNABLE. **No budget in {40, 80, 120} qualified, and no evaluation was run.**

    40   constraint block too small to hold a CONSTRAINT fact (only a redraw fact). nearby 2/3 judged.
    80   constraint fact delivered, 2/3 judged. nearby 0/3 - all refused EMPTY or UNBALANCED.
    120  same as 80.

**THE VIABLE WINDOWS DO NOT OVERLAP.** Every size where the constraint arm can say its thing is a size
where the nearby arm yields nothing judgeable; the one size where both function is one where there is
no constraint to deliver. That is a property of the INTERFACE (a comment block above a FIM slot), not
of either strategy's merit.

0 accepted of 18 assigned. 0 protected failures, 0 restores, 0 interventions.

**Why:** the whole point of pre-declaring the rule was to make a negative answer publishable instead of
triggering an open-ended redesign. It did exactly that. Also: at budget 40 the cell that FAILED
delivery behaved best (one-line redraw fact, 3/3 judged at 5 steps, zero const errors, where nearby
raised them 2/2) - recorded and deliberately NOT acted on, because 3 seeds on the tuning page is not a
result and the rule was not reinterpreted to admit it.

**How to apply:** still no evidence either way on whether extracted constraints help - see
[[guidance-transferred-addition-did-not]]. 0/18 is consistent with a capability limit AND an interface
limit and cannot separate them. The next question is not "which context helps" but whether a comment
block above a FIM slot can deliver anything to this model at all, given a single line was the only
size at which both arms functioned. Pre-register that on unseen pages.

The instrument is sound and reusable: arms matched to within 2-12 tokens, readings reproduced on an
interleaved second pass, all counts taken on the INFILL template (see [[token-oracle-template-trap]]).
