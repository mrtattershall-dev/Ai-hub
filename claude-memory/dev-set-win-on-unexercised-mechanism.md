---
name: dev-set-win-on-unexercised-mechanism
description: A development task can score a clean win on a mechanism it never exercised, because its source lacked a competitor; only a holdout exposes it
metadata:
  type: feedback
---

2026-09-17, first prospective run of the frozen LegaParse selector on a sealed holdout.

Development task a03 RESOLVED its concern cleanly and was counted as evidence that disambiguation
works. It does not. a03's source defines a handler for `quoted` and none for `plain`, so the rival
concern `variant:plain` never entered the graph and there was no tie to break. The holdout's c03 has
the same shape with BOTH variants present, tied instantly, and abstained AMBIGUOUS.

**Why:** a passing task proves the mechanism ran only if the input could have made it fail. A03's
substrate could not produce a competitor, so its "win" measured nothing about the tie-break. This is
the substrate-level twin of [[lenient-proof-easy-input]] (which is about test INPUTS) and of
[[over-strict-checkers-invisible-to-known-bad]] (sensitivity vs specificity).

**Second instance, same day, and this one was in MY OWN write-up.** I reported the v4 holdout's
non-overreach as 3/3. All three no-analogue tasks had NO relation clause at all, so each abstained
before resolution was ever attempted - proving the selector does not INVENT a relation, not that it
declines a FALSE one. The first family containing a false relation showed it applies. Two instances
now: the control passed because it could not fire.

**How to apply:** for any selection/disambiguation/ranking step, ask what the RIVAL is in each
development case and confirm at least one case actually has one. If none does, the development number
is unearned regardless of how clean it looks. Related: [[measure-the-thing-itself]],
[[goal-coupling-wrong-denominator]].

Second finding from the same session, same class: a validator read its OWN file format as data. The
patch serializer writes `--- op op1 after: "<anchor>"`, and the leakage scanner counted the format
word `after` as an identifier the reference introduced, refusing a task whose goal legitimately said
"after normalization". A checker firing on good input looks exactly like bad input - the tempting fix
is to reword the input. Strip the apparatus's own emissions before scanning, and keep the positive
control that proves the strip did not loosen the guard.
