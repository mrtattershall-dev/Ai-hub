---
name: authorization-is-not-verification
description: "The shape/scope gate ran 87/87 then leaked twice in the next 151 — P(correct|authorized)=0.992, and both leaks were caught by execution; never quote one metric meaning the other"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T10:44:34.421Z
---

2026-09-18. Across five preregistered Legasus families the authorization boundary (shape and scope gate,
before any execution) admitted **238 outputs and 236 were correct — 0.992**.

It ran at 1.00 for 87 consecutive outputs and then leaked twice in the next 151:

    if n > 0: return "small"          well-formed, and destroys a preserved behaviour
    if n > 10: return "very large"    invents a result outside the declared vocabulary

**Both were rejected downstream by behavioural execution verification**, so no incorrect program reached
a repository in any family.

**Why:** an earlier phrasing of this project's headline result ("87/87 committed outputs correct") read
as though authorization alone were sufficient. 151 more samples show it is not. Authorization is a
strong filter, not a sufficient one — which is exactly why LegaVerify exists as a separate layer, and
why the streak breaking was useful rather than bad news.

**How to apply:** keep two metrics and never quote one while meaning the other —

    P(correct | AUTHORIZED)   the shape and scope gate, alone
    P(correct | VERIFIED)     that gate plus behavioural execution

A long clean run on the first is not evidence about the second, and the reverse is worse: presenting
the pair as one number hides exactly the failure the layered design exists to catch. Also note the
leak arrived in a *well-formed* fragment — shape conformance carries no semantic guarantee at all.

Related: [[bounded-authority-trades-destruction-for-refusal]], [[silent-failures-are-the-class]],
[[redundant-wording-changes-completion-behaviour]], [[render-the-relation-not-the-bound]].
