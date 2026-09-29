---
name: hub-destroys-a-third-of-working-code
description: "Set F regression analysis - Qwen3-Coder had 48 goals working when written but only 36 at the end, 16 regressed; the hub took back a third of the model's successes"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T00:29:08.565Z
---

Set F (2026-09-11), measured per-goal against git history rather than the final workspace only:

- **Qwen3-Coder (30B): 48 worked when written, 36 work at the end, 16 REGRESSED.** A third of everything it got
  working was destroyed by a later step.
- **Base 14B: 4 worked when written, 2 at the end, 3 regressed.** Its problem is different - it almost never got far
  enough to write anything, because 77 of 100 goals were killed by the repeat guard after about six tool calls.

The regression failure texts are the destruction signatures themselves: `l.titles is not a function`,
`library.getLoans is not a function`, `library.overdue is not a function`, `module 's2_logs_mod' has no attribute
'between'` - names that existed, then stopped existing.

**Why it matters:** this is the answer to "we should be scoring at least 70 and we're not". The model earned 48 and
the hub handed back 36. Scoring the FINAL workspace (which the hidden checks do, correctly - it is what a user would
have) means one destructive step erases the credit for every earlier step of that chain.

**How to apply:** when a run scores badly, always separate *never written* from *written then destroyed* before
blaming the model - the two have opposite fixes. `regress-F.mjs <label>` in measurements/2026-09-11-setF does this
by replaying each goal's checks against the commit where the work landed. See
[[tool-bugs-not-nudges-2026-09-11]] and [[long-run-accuracy-north-star]].
