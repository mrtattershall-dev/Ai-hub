---
name: bigger-models-make-different-errors
description: "Frozen contract across 1.5B/7B/14B — proposal yield rose to 1.000 but authorization precision FELL (0.976/0.802/0.925); 17 of the 14B's 18 leaks were caught by two probes added weeks' worth of controls earlier"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T12:48:28.416Z
---

2026-09-18, one frozen contract (checked region-by-region by `contract-identity.test.mjs`), one card,
one daemon, 720 generations, only model capacity varied.

    model   proposal yield   authorization precision [95% CI]   verification rate   sec/verified
    1.5b       0.875          0.976  [0.945, 0.990]                  0.854             1.0
    7b         0.946          0.802  [0.745, 0.848]                  0.758             1.2
    14b        1.000          0.925  [0.885, 0.952]                  0.925             1.6

**Proposal yield rose monotonically** (14B refused zero times in 240) and refusal topology thinned
shape-failures-first. **Authorization precision did NOT hold constant** — it moved 17 points
non-monotonically and the 14B is significantly *worse* than the 1.5B (p = 0.017).

**The mechanism is realization strategy, not competence.** Capacity shifts the model toward *compound*
conditions, and that is where the semantic errors live: the 1.5B writes `n < 10`; the 14B writes
`0 < n < 10` — idiomatic, and wrong, inventing a lower bound the spec never stated and silently
dropping every negative input. 17 of its 18 leaks are that one shape. Realization diversity *falls*
with capacity (2–5 distinct guards per cell at 1.5B, 1–3 at 14B).

**THE INSTRUMENT FINDING, which matters more than the ranking.** Attributing each leak to the probe
that caught it: the two neighbour probes (`P+1`, `P-1`) alone caught 0/5 leaks at 1.5B, 14/45 at 7B,
and **17/18 at 14B**. They exist only because a control caught a probe hole before an earlier window
opened.

> Without them the 14B scores 239/240 and looks like the best model in every column.

**Why:** a probe set built against a small model's failure modes silently ratifies a larger model's
more sophisticated mistakes. The apparent capability ranking depends on whether the verifier can see
the errors the larger models actually make — and larger models make *different* errors, not fewer of
the same ones.

**How to apply:** build probes for the failure modes of the **largest** model a family will face, not
the smallest. Prefer probes derived from the contract's boundary structure (every bound, every
excluded value, both neighbours of each) over probes derived from observed failures. Verification must
be independent of and stronger than the model, or it is a mirror.

Rendering rules generalize across capacity and get *stronger*: `IMPLICIT` produced zero exclusion
predicates at every size across 720 generations; `RELATIONAL` gave 13/63/56 per 80 (p = 8.9e-16 at 7B).

Caveats: 240 samples per model; the 7B is anomalously bad on both precision and end-to-end rate
(27 outright inversions) and is unexplained; one task family; 32B did not fit the 16GB T4.

Related: [[authorization-is-not-verification]], [[delta-phrasing-moves-the-verified-rate]],
[[over-strict-checkers-invisible-to-known-bad]], [[lenient-proof-easy-input]],
[[capability-floor-7b-vs-14b]].
