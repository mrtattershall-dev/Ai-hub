---
name: seth-result-fixes-move-the-work
description: "Set H (2026-09-12): the hub fixes moved the score on both models beyond the measured noise - 14B 2->7, 30B 30->39 - and the rig's first run-to-run spread shows score is reproducible while goals-attempted is not"
metadata:
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T08:41:12.489Z
---

Four arms, one variable (the hub). Same 100 goals and checker as sets F/G, verified **by hash** because the arm logs
name the wrong commit (`trialH.mjs` logs the main checkout's HEAD, not the hub `HUB_ENTRY` spawned).

| arm | hub | attempted | score | duplicated-def files |
|---|---|---|---|---|
| coder14b-sethctl | control | 50 | **2/100** | 10 |
| coder14b-sethfix | treatment `eaa70c1` | 52 | **7/100** | 2 |
| coder30b-sethctl | control | 59 | **30/100** | 0 |
| coder30b-sethfix | treatment `eaa70c1` | 54 | **39/100** | 0 |

**THE NOISE FIGURE, and it is the durable part.** Each control replicates set G on a byte-identical hub:
14B `4→2` score / `58→50` attempted; 30B `29→30` / `78→59`. So **score is reproducible (30B moved ONE point) while
goals-attempted swings by 19.** Score comparisons carry weight; throughput comparisons mostly cannot.

Against that: 14B **+5** (spread 2), 30B **+9** (spread 1). Both outside the noise — first evidence the fixes change
work-on-disk rather than how runs report themselves. The 30B gain spans four projects; the 14B gain is real on totals
but fragile in composition (at that floor, *which* project scores is close to arbitrary).

**This retro-corrected two of my own claims**: set F→G for the 14B (`2→4`) was inside the spread and was never an
improvement; the 30B's `36→29` (7 points against a 1-point spread) probably was real. "It was all noise" would have
been as wrong as the original claim.

**How to apply:** never quote a score difference without the spread beside it. Judge a treatment against *its own
control*, not a threshold guessed before the noise was known — I rewrote prediction 3's verdict at 03:04 while both
treatment arms were still scoreless, and recorded the original threshold alongside so the change was visible. Status
counts (done/stopped) still mean nothing; the checker scoring the workspace is the only result.

Related: [[seth-four-arm-ab-design]], [[setg-result-budget-is-the-ceiling]], [[long-run-accuracy-north-star]],
[[append-file-escapes-the-duplicate-guard]].
