---
name: delta-phrasing-moves-the-verified-rate
description: "Three English phrasings of ONE obligation, asserted to plan identically, gave verified rates of 55/59/67 out of 80 — relational phrasing won; \"correct condition\" fell while verified rose"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T11:25:53.573Z
---

2026-09-18, Qwen2.5-Coder-1.5B. Three deltas encoding the **same** residual behaviour, with a control
asserting identical plans (same condition `n < 10`, same result, same precedence winner, same insertion
point). Only the English differs:

    delta        what the model wrote                            correct-cond   verified
    OTHER        "For other values below 10"                       67/80          55/80
    EXPLICIT     "For values below 10 except zero"                 55/80          59/80
    RELATIONAL   "For values less than 10 that are not zero"       23/80          67/80

    correct-cond  OTHER vs RELATIONAL   p = 1.8e-12
    verified      OTHER vs RELATIONAL   p = 0.040

`RELATIONAL` made the model spell the exclusion out in code — `n < 10 and n != 0`, 46/80 — a
**different and correct** realization, and it was refused less often for reproducing fixed lines, so
more reached the verifier and passed.

**correct-cond falling while verified rises is the measurement working, not a contradiction.** "Correct
condition" means exactly `n < 10`; the anti-oracle rule says a contract must admit more than one
implementation, and this is the second one. Never use exact-string match as the endpoint when the
contract admits several realizations.

**Why:** how Legasus words the requested behaviour is worth about as much as everything else it does to
the prompt. `renderDelta` is an architectural surface alongside `renderDomain`.

**How to apply:** spell the exclusion out relationally; do not rely on natural-language ellipsis
("other"). Pair with [[render-the-relation-not-the-bound]] and
[[redundant-wording-changes-completion-behaviour]] — the model-facing representation is minimal,
relational, sufficient, and adds nothing the window already answers.

**Two hypotheses died to produce this.** (1) "other" read as "the remaining positive ones" — `OTHER`
produced *zero* `n > 0` conditions in 80 samples; the two leaks that motivated it were coincidence.
(2) the window x wording **interaction is not established**: window 7 p=0.008, window 8 p=0.18, a
preregistered prospective test p=0.38. The *main* effect of added wording survives (p=0.018). Weak new
seed: all four `n > 0` conditions came from the arm that **names zero**.

Related: [[authorization-is-not-verification]], [[measure-the-thing-itself]],
[[significant-here-not-there-is-not-a-test]].
