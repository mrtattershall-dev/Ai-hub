---
name: 7b-one-clause-from-passing
description: MODEL-CMP-1 arm B 2026-09-27 - qwen2.5-coder:7b bound the feature to DOM buttons the page lacks, so a top-level throw erased the seam and every step failed; with wiring neutralised 3/4 seeds were ONE guard placement from passing
metadata:
  type: project
---

2026-09-27, MODEL-CMP-1 arm B ($0.085; under $0.30 for all three hosted cells against a $2
cap): `qwen2.5-coder:7b` in the SAME image on the same pinned ollama 0.33.3, same site,
instruction, tail trim, decoding, seeds and gate. **0/5 accepted, same as both 1.5B cells.**

**The surface numbers mislead.** Every code-bearing attempt wrote
`document.getElementById('plant').addEventListener('click', ...)` - a button this page does
not have - so the listener threw at top level and `window.game`, which sits DOWNSTREAM in
the suffix, never ran. Verdict: "no state exposed", all six steps failing, 4/5 RESTORED. The
scripts all PARSE; it is a runtime grounding failure.

Two $0 diagnostics over the same candidates (`server/armBDiagnostic1.mjs`, `...2.mjs`):

- neutralising only the null dereference -> [1,2,3,5] on all four seeds. **Movement was
  never broken**; the "regressions" were collapsed OBSERVABILITY. Restoring was right, but
  the diagnosis a recovery controller would read off it is wrong.
- also routing each invented button's click to the key its id meant -> **[1,2,3,4,6] on 3 of
  4 seeds: one clause short.** The guard is `inventory.seeds > 0` but the decrement sits
  outside `plantSeed`'s internal `if (!tiles[k])` no-op, so a second press on an occupied
  tile spends a seed and plants nothing.

**Why:** a bigger model failed differently, not better overall - the 1.5B stays inside the
file's vocabulary and under-produces, the 7B writes confident code and invents a UI. It broke
the page 4/5 vs 1/5, used 3x the tokens, and drifted into forbidden features 5/5 like the
1.5B. But on substance it is one line from correct, which is invisible in the raw verdict.

**How to apply:** when every step fails including "loads and exposes state", suspect the
INSTRUMENT before the behaviour - neutralise one suspected cause and re-run before reporting
a regression. Put the observability seam UPSTREAM of any edit region, or a throw inside the
region erases all evidence. And the negative clause ("in every other case change nothing")
is what caught the real defect: a positive-only spec would have accepted code that drains
the inventory. See [[anchor-protocol-edit-site-failure]],
[[instruction-shape-dominated-the-result]], [[gpu-same-failures-11x-faster]],
[[advisory-vs-mechanical-recovery]].
