# run6 — build and run

Everything here is **built and dry-run**. Nothing has been trained. Target ~10,000 rows.

## Why run6 looks like this

32 held-out prompts, identical for every variant, scored by execution (node ran it /
Chromium rendered it / Godot parsed it), 2026-09-09:

| axis | base | run4 | run5 | |
|---|---|---|---|---|
| code | **7/9** | 3/9 | 5/9 | fine-tuning made this **worse than not training** |
| phaser | 1/6 | 0/6 | **4/6** | the one clear win, +3 |
| godot | 0/3 | 0/3 | 0/3 | never worked, for anyone |
| structured | **4/4** | 2/4 | 4/4 | the base was already perfect |
| interpret | 5/10 | **10/10** | 9/10 | real win, +4 |
| **total** | 17/32 | 15/32 | **22/32** | |

Only **two** axes justify the fine-tune. The rest is neutral or negative.

The single biggest defect found: **2,105 rows — 51% of the correctness slice, 15% of the
entire dataset — were one prompt.** *"Build 3 small, separated game systems in one file —
Farm, Crop, Market"*, wrapped in casual rephrasings (`gimme a`, `lil`, `i need a`).
1,804 distinct answers to one task. That's task collapse, and it's the most likely cause
of both the code regression and the halved output length (base 2,335 chars → run5 1,180).

## Run order

```bash
cd training-data

# 1. Your own games -> self-contained systems.        (~15 min)
#    Transitive closure per function; drops anything that can't stand alone.
node factory/harvest_games.mjs --dir "$USERPROFILE/Downloads" --pattern dust-harvest-v38
node factory/harvest_games.mjs --dir "$USERPROFILE/Downloads" --pattern cursebound
node factory/harvest_games.mjs --dir "$USERPROFILE/Downloads" --pattern aethelgard
#    plus the distinct one-offs: turbo_drift, rouge-engine, ex-nihilo, grip-tape,
#    A_Story_of_Thou, GameDev Life, micheal-fathers-day
#    NOTE: each invocation OVERWRITES dataset_games.jsonl — concatenate the runs, or
#    pass all files to one invocation.

# 2. GDScript targeting the Python-divergence points.  (~20 min, needs vendor/godot)
node factory/gen_godot_syntax.mjs 1500 factory/dataset_godot_syntax.jsonl

# 3. Edit-in-place rows from the version history.      (~20 min)
node factory/harvest_diffs.mjs --dir "$USERPROFILE/Downloads" --pattern dust-harvest
node factory/harvest_diffs.mjs --dir "$USERPROFILE/Downloads" --pattern cursebound

# 4. Compose. Deterministic, gated, deduped.
node factory/assemble_run6.mjs        # -> factory/trained_run6.jsonl

# 5. Train (PowerShell — Git Bash mangles /adapters/*)
$env:PYTHONIOENCODING='utf-8'
python -m modal run --detach factory/modal_train.py --dataset factory/trained_run6.jsonl --run-name run6 --epochs 1

# 6. Evaluate against the locked baselines
python -m modal run --detach factory/modal_evalset.py --ref /adapters/run6 --out eval_run6.jsonl
python -m modal volume get gen-output eval_run6.jsonl ./factory/eval/eval_run6.jsonl
node factory/score_run.mjs basefull run5 run6
```

## Budget and rationale

| slice | budget | why this number |
|---|---|---|
| phaser | 3,000 | the only large win. Every row already rendered in real Chromium. |
| games | 2,500 | your own proven code, portable by construction. Was 6–45% used. |
| godot | 1,500 | targets divergence points, not the shape it already knows. |
| interpret | 1,200 | +4 over base but over-generalises. 49% of run4 → 25% of run5 → ~12%. |
| correctness | 800 | base *beats* the fine-tune. Diverse rows only; template block excluded. |
| edits | 600 | a capability with zero prior coverage. |
| structured | 300 | base already 4/4; just enough to stop interpret regressing it. |

## Current dry-run state

```
phaser       2966 / 3000    ready
interpret    1200 / 1200    ready
correctness   800 /  800    ready  (2,105-row template block excluded — verified 0 leaked)
structured    300 /  300    ready
games         443 / 2500    SHORT — step 1 above
godot           0 / 1500    SHORT — step 2 above
edits          25 /  600    SHORT — step 3 above
TOTAL        5734
```

Portability gate: **0 rows** reference an external resource. That's the defect that made
run3 score 0/12 on Phaser, and it's now checked on every slice rather than one.

## Honest limits

- **`games` may not reach 2,500.** 443 came from four games; the rest of Downloads is
  mostly *versions* of the same games, which dedupe. Realistic ceiling is likely
  1,200–1,800. If it lands short, take the remainder from `phaser` — it has 3,799
  available against a 3,000 budget.
- **`edits` will not reach 600 as written.** Yield was 25 from CURSEBOUND's 16 pairs.
  The blocker is deriving a truthful instruction from a diff: 68 of 121 changed functions
  carried no new comment. Two fixes, in order of value:
  1. **Instruction backtranslation** — show a model the before/after and ask what one-line
     request would produce it. Standard technique, costs GPU time, would unlock all ~130
     pairs plus every micro-version.
  2. Widen `featureOf()` to mine more version-name deltas.
  Until then, treat `edits` as a bonus slice, not a budgeted one.
- **`godot` is unvalidated as a *fix*.** All six families parse in real Godot, which means
  the rows are correct. Whether they move the eval from 0/3 is unknown until run6 is
  scored — it's a hypothesis with a clear test.

## What did NOT go in, and why

**Sprite packs and audio.** 1,070 PNGs, 440 `.aseprite`, 108 `.psd`, 10.8 MB of MP3.
Two reasons:

1. The model is text-only. There is no mechanism by which it learns from a PNG.
2. More importantly — **training on asset-referencing code is the exact defect that made
   Phaser score 0/12.** 71% of that slice loaded files like `assets/sky.png` that didn't
   exist. Your games' great strength is that they reference **zero** external assets;
   everything is drawn procedurally. That's why they pass the portability gate by
   construction.

Assets belong in the **runtime**, not the training set: ship them in the workspace so the
agent can reference files that actually resolve. That's a packaging decision, and it's a
good one — it just doesn't touch the dataset.

The audio is the same shape: the MP3 isn't trainable, but the *technique* is. Your games
already synthesise sound with WebAudio, and those functions are picked up by
`harvest_games.mjs` like any other system.
