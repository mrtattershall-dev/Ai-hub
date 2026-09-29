---
name: bounded-authority-trades-destruction-for-refusal
description: "Bounding the model did NOT raise capability (8/20 both arms, p=1.0) — it converted destructive commits into refusals; commit integrity now 87/87 across three families"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T10:27:16.192Z
---

2026-09-18, Qwen2.5-Coder-1.5B on T4, three preregistered families. Preregistered prediction: removing
the model's authority to delete existing code would restore near-ceiling reliability. **Falsified.**

    R3   region CONTAINS the guard to preserve    8/20 verified
    R3P  slot between lines declared FIXED        8/20 verified     p = 1.000

Identical. What inverted was the failure character:

    R3    committed 20 outputs,  8 correct  ->  12 WRONG PROGRAMS COMMITTED
    R3P   committed  8 outputs,  8 correct  ->   0 wrong, 12 REFUSALS
    semantic errors    9/20 -> 0/20   p = 0.0012

**Commit integrity across all three families: 87 committed, 87 correct** (R3P 8/8, visibility ladder
rev1 43/43, rev2 36/36). One-sided 95% lower bound 0.966. Generation capability swung 0.20–0.90 across
cells; P(correct|committed) never moved off 1.00. Refusals absorb all the variance.

**Why:** *attempt authority is not commit authority*, as a measurement. Bounding did not make the model
capable; it made incapability safe. For an autonomous system allowed to retry, 8 correct + 12 refusals
is not the same outcome as 8 correct + 12 corruptions, and a pass rate calls them identical.

**How to apply:** always report **two** quantities — P(correct attempt) and P(correct | committed) —
and split failures into *committed-and-wrong* vs *refused*. Never report a bounded arm as a capability
win.

**The two failure modes sit on opposite sides of context, not on one axis.** With no source visible the
model invents a whole function (14/20); with any source visible it echoes a line it was told not to
touch (23/60) and never invents a function (1/60, p=3.5e-10). Supplying the missing parameter name did
**not** reduce whole-function emission (14/20 → 14/20, p=1.0) even though the model then used the name
correctly — *context presence, not information, suppresses the affordance*. So there is no
dose-response curve in "amount of visible source"; the live variable is whether there is any.

Ladder cell noise is about **±2 at n=10**.

Related: [[render-the-relation-not-the-bound]], [[generation-interface-masks-capability]],
[[hub-destroys-a-third-of-working-code]], [[long-run-accuracy-north-star]],
[[apparatus-control-proves-assembler-not-prompt]].
