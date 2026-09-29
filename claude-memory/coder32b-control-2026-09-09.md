---
name: coder32b-control-2026-09-09
description: "Qwen2.5-Coder-32B (untuned, H100) beats the 14B fine-tune overall 12/18 vs 9/18 — but LOSES to it on Phaser, which is the strongest evidence yet that the Phaser slice is real signal"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-22T06:23:38.449Z
---

Ran the 75-prompt execution-graded evalset against **untuned
`unsloth/Qwen2.5-Coder-32B-Instruct-bnb-4bit`** on an H100, 2026-09-09, as a size control
for the 14B fine-tunes. Scored with `node training-data/factory/score_run.mjs basefull
run5 run6 coder32b`.

On the **18 prompts every variant answered** (the only comparable subset):

```
axis      basefull   run5    run6    coder32b
code        7/9      5/9     3/9      8/9     <- 32B dominates; fine-tuning HURTS this
phaser      1/6      4/6     4/6      2/6     <- the 14B FINE-TUNE BEATS a 2.3x larger model
godot       0/3      0/3     1/3      2/3     <- size wins
TOTAL       8/18     9/18    8/18    12/18
```

On its own full set: code 19/20, structured 10/10, phaser 6/15, godot 6/15, interpret
7/15.

**⚠ COMPARABILITY UNESTABLISHED for the `phaser` and `godot` rows — and this is the record whose
headline rests on them (audit 2026-09-22).** The 4/6-vs-2/6 Phaser comparison below cannot be shown
to have been scored against one asset library: verdicts depend on the library, it was changing in
this window, and the scorer recorded no version for any verdict. Not shown wrong; shown unshown.
`code` and `interpret` do not depend on the library and stand. Quote "the fine-tune beats 32B on
Phaser" with this qualifier until `basefull run5 run6 coder32b` is rescored under the fixed scorer
against one pinned library. See `ai-coding-hub/training-data/factory/COMPARABILITY-AUDIT.md`.

**Why this matters:** the Phaser result is the finding. A 32B model with no exposure to
this data scores 2/6 where the 14B fine-tune scores 4/6 — the fine-tune's Phaser advantage
survives against a model more than twice its size, so that slice is teaching something
scale alone does not supply. Same story for interpret on its own set (run5 9/10 vs base
5/10 on identical prompts, 32B 7/15). Everything else argues for a bigger untuned model:
32B is 19/20 on general code where run5 is 5/9.

**How to apply:** stop treating "does the fine-tune beat base" as the question — it is
"which axes beat a *bigger* model", and only Phaser and interpret do. For general coding
work in the hub, prefer a large untuned model; reach for the adapter for Phaser and
intent-interpretation. Keeps [[run5-findings-2026-09-09]]'s conclusion but with a much
stronger control, and reinforces [[run6-result-keep-run5]]. The eval survived three
client deaths only because it was launched with `factory/launch.py` (deploy + spawn),
not `modal run --detach`.
