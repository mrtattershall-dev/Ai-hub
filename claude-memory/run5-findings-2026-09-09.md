---
name: run5-findings-2026-09-09
description: run5 eval vs base control — the correctness slice (30% of data) makes code WORSE than the base model; only Phaser and interpret justify the fine-tune
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-22T06:23:33.013Z
---

Execution-scored eval, 2026-09-09, 32 held-out prompts, identical for every variant
(`training-data/factory/modal_evalset.py` + `score_run.mjs`):

```
axis         base    run4    run5
code         7/9     3/9     5/9     <- fine-tuning made this WORSE than no training
phaser       1/6     0/6     4/6     <- genuine win (+3)
godot        0/3     0/3     0/3     <- absent from the base; not damaged by training
structured   4/4     2/4     4/4     <- base was ALREADY perfect
interpret    5/10   10/10    9/10    <- genuine win (+4)
total       17/32   15/32   22/32
```

**⚠ COMPARABILITY UNESTABLISHED for the `phaser` and `godot` rows (audit 2026-09-22).** Those
verdicts depend on the asset library the verifier served, the library was being imported during
this window, and `score_run.mjs` never recorded which version any verdict was scored against — so
whether all three columns were scored against the same library cannot be shown. Not shown wrong;
shown unshown. The `code`, `structured` and `interpret` rows do not depend on the library and stand.
See `ai-coding-hub/training-data/factory/COMPARABILITY-AUDIT.md`; the scorer now enforces this as a
precondition. A rescore under the fixed scorer would settle it.

**Why this matters:** only **two** axes justify the fine-tune. The correctness slice
(4,117 rows, 30% of the dataset) is net harmful, and the structured slice (1,500 rows)
bought nothing — it existed only to repair damage the interpret slice caused in run4.
run6 should be ~5,000 rows, not 13,762: drop correctness, drop/shrink structured, keep
Phaser (execution-gating is why it won), subsample interpret further.

Other measured facts:
- Godot 0/3 for **every** variant. run5's failures are Python syntax bleeding into
  GDScript (`enum State:` instead of `enum State { }`, `for _, w in items:` — GDScript
  has no tuple unpacking). Structure was learned (`extends SceneTree`, `_init()`,
  `quit()`, `assert()`); syntax divergences were not.
- **One repair round recovered only 1 of 9 failures** ($0.08 test). Feedback fixes what
  the model knows and slipped on; it cannot supply missing knowledge. Same plateau
  signature as the earlier Phaser prompting experiment.
- Average generation length: base 2,335 chars, run4 1,661, run5 1,180. The fine-tune
  roughly halved output. Untested hypothesis: terseness may be *why* run5 fails its own
  assertions.

**How to apply:** never report a fine-tune result without a base-model control on the
same prompts — I called code "3/9 → 5/9, an improvement" when against the right baseline
it is a regression. Scoring harness is reusable and free: `node factory/score_run.mjs
<name> [name2]`. See [[local-server-december-2026]].
