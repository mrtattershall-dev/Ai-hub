---
name: run6-result-keep-run5
description: run6 (checkpoint-800) scored WORSE than run5 on code and was rejected — user decided 2026-09-09 to keep run5; Godot broke zero for the first time
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-22T06:23:41.999Z
---

**Decision 2026-09-09: keep run5. run6 was evaluated and rejected.**

Controlled comparison, 18 prompts every variant answered, scored by execution:

```
axis      base   run5   run6(ckpt-800)
code      7/9    5/9    3/9     <- got WORSE, not better
phaser    1/6    4/6    4/6     <- held
godot     0/3    0/3    1/3     <- broke zero for the first time
TOTAL     8/18   9/18   8/18
```

**⚠ COMPARABILITY UNESTABLISHED for the `phaser` and `godot` rows, including "Godot 3/15 on the full
set" (audit 2026-09-22).** The scorer recorded no asset-library version for any verdict, and the
library was changing in this window. **The decision itself stands**: *keep run5* was driven by the
`code` row (7/9 → 5/9 → 3/9), which does not depend on the library. See
`ai-coding-hub/training-data/factory/COMPARABILITY-AUDIT.md`.

**The prediction that failed:** cutting the 2,105-row "Build 3 small, separated game
systems — Farm, Crop, Market" block was supposed to recover code toward base's 7/9. It
went the other way, to 3/9. Every failure was the model's OWN assertion (`FAIL: aStar
finds a path`, `FAIL: crit multiplies damage`) — no syntax errors, no crashes. The code
runs and does not satisfy the spec it wrote for itself.

Two unseparated explanations: run6 is **checkpoint-800 = 72% of an epoch** (LR still
5.6e-5, not a finished run), and/or the 1,073-row games slice teaches plausible code
over provably-correct code.

**The one real win:** Godot 3/15 on the full set where base/run4/run5 were all 0/3.
`enum State:` is gone entirely — the divergence-targeting worked. The remaining failures
shifted to **invented identifiers** (`Dict`, `RandomStream`, `health` undeclared), which
is a knowledge gap, not a syntax habit. Only 3 of 12 were the for-loop divergence.

**Why:** stops another run6-shaped attempt. If Godot is the goal, target the API surface,
not more syntax families. If code correctness is the goal, the games slice is suspect.

**How to apply:** `dataset_run7.jsonl` (8,869 rows) and the whole pipeline are on disk and
still valid — re-run `assemble_run6.mjs` after changing budgets. Score with
`node factory/score_run.mjs basefull run5 <new>`; it compares only shared prompt ids.

**WARNING — the hub may not be serving run5 at all.** `hub.json` points at
`mycoder-serve` (created 2026-07-14, predates run5) and `modal_serve.py` defaults to
`/adapters/run3`. Verify with `/whoami` before trusting any output. To actually deploy
run5: `$env:MYCODER_ADAPTER='/adapters/run5'; python -m modal deploy factory/modal_serve.py`
from **PowerShell** (Git Bash mangles `/adapters/*`). See [[run5-findings-2026-09-09]].
