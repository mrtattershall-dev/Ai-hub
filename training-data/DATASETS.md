# Which dataset trained which adapter

The old names were **offset by one** — `dataset_run6.jsonl` trained the adapter called
`run5`, `dataset_run7.jsonl` trained `run6`. The code carried a comment admitting it
(*"run4's training set (misleadingly named)"*), which is a sign a name has stopped doing
its job. That off-by-one is the same shape as the `/adapters/run3` default that produced
three stacked bugs on run4's deploy.

Files are now named for **what they trained**.

## Current

| file | rows | trained | evidence |
|---|---|---|---|
| `factory/trained_run4.jsonl` | 16,460 | adapter `run4` | `assemble_run5.mjs` reads it as run4's set |
| `factory/trained_run5.jsonl` | 13,762 | adapter `run5` | training log: `training on 13762 rows` |
| `factory/trained_run6.jsonl` | 8,869 | adapter `run6` | training log: `training on 8869 rows` |

Row counts match the Modal training logs exactly, so these three are certain.

## Not renamed, because the mapping is unproven

| file | rows | note |
|---|---|---|
| `factory/dataset_run3.jsonl` | 4,361 | June 17. Probably trained an earlier adapter; no log survives to confirm which. |
| `factory/dataset_run4.jsonl` | 10,361 | June 17. Same. `FINDINGS_2026-09-08.md` cites its Phaser slice at 4,242 rows. |

If the offset held back then, these trained `run2` and `run3` respectively — but that is
inference, not evidence, and renaming on a guess just replaces one lie with another.

## Which assembler writes what

```
assemble_run5.mjs   trained_run4.jsonl  ->  trained_run5.jsonl
assemble_run6.mjs   trained_run5.jsonl  ->  trained_run6.jsonl   (+ games, godot, edits)
```

Each assembler reads the PREVIOUS adapter's training set and re-composes it. That is why
the offset crept in: the file was named for the assembler that produced it rather than
the adapter it fed.

## Naming rule going forward

**`trained_runN.jsonl` is the dataset that produced adapter `runN`.** One file, one
adapter, same number. If you add `assemble_run7.mjs`, it writes `trained_run7.jsonl` and
trains `--run-name run7`.

Adapters live on the Modal volume `qwen-adapters` as `/adapters/runN`, and mid-training
checkpoints as `/adapters/runN_ckpt/checkpoint-<step>`. Those were already consistent —
only the datasets were offset.
