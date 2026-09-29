---
name: significant-here-not-there-is-not-a-test
description: "I claimed an interaction from \"significant at FULL, not at W1\" — a direct logistic LRT gave p=0.18, and a preregistered prospective test p=0.38; the claim was wrong"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T11:26:05.672Z
---

2026-09-18. I reported a window x wording interaction as "the strongest structural claim in this line
of work" because five arms were flat in one condition while four moved in another. **That is not a test
that the two differ.** Two results on opposite sides of a threshold can be statistically
indistinguishable from each other.

    window 7   p = 0.008    significant
    window 8   p = 0.18     not - the window I called it "reconfirmed" in
    window 9   p = 0.38     not, and this one was PREREGISTERED
    pooled 7+8 p = 0.005    driven entirely by window 7

The interaction is **not established**. The *main* effect survives (added wording raises reproduction
of forbidden code, p = 0.018). This was the second form of the same error in two days — the first was
reading a p = 0.25 null as evidence of no effect, which a better-powered run then overturned.

**Why:** subgroup comparisons and null-readings are where this project's inferences break, not the
arithmetic. Both errors *feel* like reading the table honestly.

**How to apply:**
- To claim an effect differs between conditions, test the **interaction term** directly.
  `legasus/legalabs/interaction.mjs` is the instrument: a logistic likelihood-ratio test whose
  **negative control is large main effects with equal odds ratios**, so it cannot fire on a main effect
  alone, plus an underpowered-pattern witness that must *not* reach significance.
- A null at a sample that could not have shown the effect is not evidence of absence.
- Prefer a preregistered prospective test over pooling; when pooling, check whether one stratum is
  carrying the whole result.

Related: [[measure-the-thing-itself]], [[goal-coupling-wrong-denominator]],
[[delta-phrasing-moves-the-verified-rate]], [[over-strict-checkers-invisible-to-known-bad]].
