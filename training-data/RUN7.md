# run7 — the 32B Phaser run

The one hypothesis the evidence supports, and how to run it without wasting money.

## Why 32B, why Phaser only

Measured 2026-09-09 against an **untuned** Qwen2.5-Coder-32B control, on the 18 prompts
every variant answered:

```
axis      base14B  run5   run6   coder32b
code        7/9    5/9    3/9     8/9      <- fine-tuning HURT this, twice
phaser      1/6    4/6    4/6     2/6      <- the 14B fine-tune beat a 2.3x larger model
godot       0/3    0/3    1/3     2/3
TOTAL       8/18   9/18   8/18   12/18
```

Phaser is the **only** axis where fine-tuning beats scale. Everything else in run5/run6
either did nothing (structured: the 32B is already 10/10) or did harm (correctness, 30% of
run5, took code below the untouched base). So: a bigger base, and only the slice that earns
its place.

## The dataset

`factory/trained_run7.jsonl` — built by `node factory/assemble_run7.mjs`.

```
1,106 rows   685 distinct prompts   100% portable   0 eval contamination (max overlap 0.17)
~322k tokens total, ~645k for 2 epochs
p50 218 tok · p90 464 · p99 1,043 · max 1,569
```

Fixes two defects in run5's Phaser slice: 461 duplicate answers, and one prompt appearing
49 times. `--cap N` trades samples-per-prompt against size (861 rows at cap 2, 3,338 at cap
0); **685 distinct prompts is the ceiling at every cap** — that is the real constraint.

## Ready

- `modal_train.py` — `TRAIN_BASE` env var; refuses to start if a 32B is paired with a 40GB
  card (that OOMs partway in and costs the whole run); prints the base it loaded.
- `modal_evalset.py` — `EVAL_BASE` env var, prints the base. **This must match `TRAIN_BASE`.**
  An adapter trained on 32B and evaluated against a 14B base measures nothing, and the
  failure is silent: the load succeeds and the generations are simply wrong.
- `score_run.mjs` — records the asset-library version the verifier reported, and shouts if
  it changed mid-run.
- `coder32b` eval already exists as the untuned control on the same 75 prompts.

## Not decided

**1. Assets.** The library landed after this dataset was built, so all 1,106 rows are
graphics-only. Asset-loading rows are now legal (the verifier serves the manifest), but
there are none, and generating them costs GPU.

Recommendation: **train run7 graphics-only first.** It is a clean one-variable comparison
against a control we already have. run6 changed several things at once and came out worse;
do not repeat that. If run7 wins, an asset-aware run8 is the next experiment.

**2. maxlen.** The default is 8192; the data needs 2048 to cover 100% of rows. Padding to
8192 wastes VRAM and time for nothing. Use `TRAIN_MAXLEN=2048`.

## Run it

```bash
# 0. smoke test FIRST - proves the 32B loads and a step runs, for a few minutes of GPU
TRAIN_BASE=unsloth/Qwen2.5-Coder-32B-Instruct-bnb-4bit \
TRAIN_GPU=H100 TRAIN_MAXLEN=2048 TRAIN_DATA=factory/trained_run7.jsonl \
python factory/launch.py train --run-name run7_smoke --epochs 1

# 1. the real run
TRAIN_BASE=unsloth/Qwen2.5-Coder-32B-Instruct-bnb-4bit \
TRAIN_GPU=H100 TRAIN_MAXLEN=2048 TRAIN_DATA=factory/trained_run7.jsonl \
python factory/launch.py train --run-name run7 --epochs 2

# 2. generate against the SAME base
EVAL_BASE=unsloth/Qwen2.5-Coder-32B-Instruct-bnb-4bit EVAL_GPU=H100 \
python factory/launch.py evalset --ref /adapters/run7 --out eval_run7.jsonl

# 3. pull + score against the untuned 32B control
python -m modal volume get gen-output eval_run7.jsonl ./factory/eval/eval_run7.jsonl
node factory/score_run.mjs coder32b run7 run5 basefull
```

Use `launch.py` (deploy + spawn), never `modal run --detach`. Three runs were lost to a
dying local client on 2026-09-09 — a watcher script, a shell command, and a DNS blip.

## What success looks like

`run7` beats `coder32b` on the phaser axis of the shared subset (32B untuned scores 2/6
there). If it does not, the Phaser advantage does not survive scale and the fine-tune is
only worth keeping at 14B.

**Watch the code axis.** The 32B's best number is 19/20. A single-domain LoRA can damage
it — run4's interpret slice at 49% forced a structured slice to be added to repair it. The
eval's 20 code prompts exist to detect exactly that, so read them before celebrating phaser.
