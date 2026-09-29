---
name: render-the-relation-not-the-bound
description: "Handing a model normalized bound metadata makes it worse than handing it the same bound as a relation — 6/20 vs 17/20, p=0.001, layout held fixed"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T09:38:58.466Z
---

2026-09-18, ladder 2 on Modal T4, Qwen2.5-Coder-1.5B. Two prompts with **identical layout** — same
field sheet, same field names, same line count — differing only in one field's wording:

    FMT_BOUND   applies to: upper bound 10 (exclusive), no lower bound      6/20 verified
    FMT_ENG     applies to: values below 10, with no lower limit           17/20 verified   p = 0.0011

Among outputs that were *authorized at all* (so acceptance strictness cannot explain it), wrong
conditions were **7 of 13** vs **0 of 17**: `n > 10` four times, `n > 0` twice, `n <= 10` once.

`n > 0` is the tell: the model implemented "no lower bound" — a field that exists to say a constraint
is **absent** — as a constraint.

**Why:** the intuition that a normalized specification is easier for a small model than prose is
backwards here. Ladder 1 saw this as a confounded observation (its data-sheet rung also varied prompt
format); ladder 2 removed the confound and it reproduced larger.

**How to apply:** wherever Legasus renders a domain for a model, render the **relation**, never the
bound metadata. `legasus/legacore/assemble.mjs`'s `renderDomain` already emits `n < 10` for intervals —
this finding says that choice is load-bearing, not cosmetic, and must not be "simplified" into fields.
Same caution for any other machine-readable structure handed to a model as its instruction.

Related: [[generation-interface-masks-capability]], [[protocol-not-capability-ceiling]],
[[contracts-not-the-1p5b-bottleneck]], [[bounded-authority-trades-destruction-for-refusal]].
