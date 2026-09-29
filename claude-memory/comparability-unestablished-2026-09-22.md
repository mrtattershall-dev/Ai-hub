---
name: comparability-unestablished-2026-09-22
description: "Every historical Phaser/Godot score comparison (run5, run6, 32B control) is COMPARABILITY UNESTABLISHED — the scorer never recorded the asset-library version per verdict and printed COMPARABLE anyway; fixed 2026-09-22 as an enforced precondition; a rescore settles it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 84a10d37-807c-4f1e-91a9-791e4112e34d
  modified: 2026-09-22T06:32:34.223Z
---

`training-data/factory/score_run.mjs` detected an asset-library change, printed a warning, then
printed the comparison table anyway under a heading that said COMPARABLE — and only inside the
`if (differs)` branch, so for same-prompt-set comparisons (the normal case) even the warning was
unreachable. A verdict with no `assetVersion` contributed nothing to the check, so absent evidence
read as agreement. `scoreGodot` discarded the version entirely though Godot verdicts depend on the
library too (a missing asset fails verification).

**Fixed 2026-09-22** (hub commit; audit at `training-data/factory/COMPARABILITY-AUDIT.md`):
`comparability.mjs` decides COMPARABLE / MISMATCH (blocked, RESCORE) / UNESTABLISHED (withheld)
per asset axis from per-verdict versions; applied to both tables; TOTAL excludes gated axes; raw
verdicts with versions now persisted to `eval/scores-*.json`. Unit 8/8, smoke 3/3 through the real
scorer against a stub verifier; code/structured/interpret axes are never gated.

**Why:** the 32B-control headline — "the 14B fine-tune beats 32B on Phaser, 4/6 vs 2/6" — rests on
a comparison that cannot be shown to have used one library, in the very window the 13k-file library
was being imported. Not shown wrong; shown unshown. The `code`-axis conclusions (fine-tuning hurts
code; keep run5) are on independent axes and stand.

**The original generations SURVIVE** (checked 2026-09-22): `factory/eval/eval_{basefull,run5,run6,
coder32b}.jsonl`, each row `{id, axis, prompt, text}`, 18 shared ids = code 9 / godot 3 / phaser 6.
So reverification costs **verifier time only — no GPU, no regeneration**. But it would establish
performance under the *newly pinned* library; **which asset bytes the historical verifiers loaded
was never recorded and is unrecoverable**, so the 2026-09-09/10 numbers stay unestablished
permanently and a reverified table sits *beside* them, never confirms them.

**How to apply:** quote any Phaser/Godot comparison from 2026-09-09/10 with "comparability
unestablished" attached. Reverify `basefull run5 run6 coder32b` under the fixed scorer against one
pinned library **only if those asset-axis rankings would change the next model decision** —
otherwise leave it. Never mark a historical run "requires rescore"
on this defect alone — that needs a *confirmed* mismatch, and none exists. Related:
[[run5-findings-2026-09-09]], [[coder32b-control-2026-09-09]], [[run6-result-keep-run5]],
[[hub-detects-but-does-not-act]] (this was another instance), [[asset-library-contract-2026-09-09]].
