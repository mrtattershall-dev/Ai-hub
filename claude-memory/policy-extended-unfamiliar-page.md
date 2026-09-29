---
name: policy-extended-unfamiliar-page
description: TRANSFER-3 2026-09-27 - the frozen guidance policy chose site, scaffold, instruction and context by itself and reached an accepted addition on an unfamiliar page; 3 calls, 0 interventions, $0. Eligibility rate 3 of 8
metadata:
  type: project
---

2026-09-27, $0 local, 1.5b. Policy hashes frozen BEFORE the pages were generated and verified identical
after the run. **The milestone: one useful addition caused by automatically selected guidance, on a page
nobody tuned against.**

**Two outcomes, always reported separately:**

    BASELINE ELIGIBILITY   3 of 8 generated pages qualified (37.5%). Every page and rejection preserved.
                           4 of 5 rejections were the same rule - the page draws but NO KEY CHANGES ITS
                           STATE; the fifth changed state on every key so no trigger was free.
    ADDITION SUCCESS       accepted round 1 seed 3: 7/7 requested, every carried-forward check, 0 errors,
                           RETAIN, 3 of 12 calls, 0 interventions. Rebuilt to a MATCHING sha and re-run
                           fresh: 7/7.

**TWO THINGS CONTRADICTED MY OWN PRIOR EXPLANATION.** (a) The R1 `if (e.key === x) { }` slot PRODUCED
WORKING CODE here, where ASSISTED-1 had it yield nothing in four attempts and I had called the shape
switch the cause; the escalation rule never fired. 2 of 3 seeds refused is a DIFFICULTY, not a wall -
see [[slot-shape-beat-information]], which is now known to be overstated. (b) Only ONE extracted fact was
delivered (the ctx constraint was dropped at the 240-char budget) and it sufficed; nothing shows the
facts were NECESSARY, because no arm ran without them.

**Why:** this is the first time the system supplied the assistance rather than me. ASSISTED-1 needed 8
human interventions on a development page; here the count is 0 on a page I had not read.

**How to apply:** the per-seed success rate is 1 in 3, so treat a single success as ATTAINABILITY, never
reproducibility - and reproducible EXECUTION (shown) is not reproducible GENERATION (untested). The
checks read STATE, not pixels, and establish preservation of observed behaviour only - they never
establish the page fulfilled its original ask. Machinery that made it work and is reusable:
server/observeState.mjs (structured state, not parsed error messages), server/sealedPage.mjs
(7 mechanical eligibility rules, controlled in BOTH directions), server/emitTask.mjs (task emitted from
observation, refuses to emit unless existing behaviour passes AND the addition fails),
server/managerRun.mjs (no way to accept a human rescue). See [[constraint-arms-not-runnable]].
