# 14B data run — 2026-09-10 (30-minute window)

**Model:** Qwen/Qwen2.5-Coder-14B-Instruct-AWQ on an A10G, served by vLLM, **no adapter** —
identity checked from `/api/health` on both passes (`"lora":null`).
**Hub under test:** main `f46e38b`, on an isolated hub (never the live :3001).
**Why:** tatte — *"It seems like it might be ready for a 30 minute 14b run. Kill it after thirty
minutes and collect the data to test on."* The run was for data, with measurement as a bonus.

Running notes, including one mid-run correction, are in `NOTES-live.md`. This page is the clean summary.

## Headline

The 14B's **code is mostly right. Its dominant failure is its own tests**, and the automatic
scorer is wrong in both directions. Hand-verified pass 1, 25 fresh goals:

| verdict (hand-checked) | goals | count |
|---|---|---|
| done as asked, own checks pass | 3, 4, 5, 8, 10–18, 21 | **14** |
| **code correct, model's own test wrong** | 1, 6, 20, 24 | **4** |
| partial | 9 (answer right, planned file never written), 23 (no `quickSort`) | 2 |
| failed | 2, 19, 22 (file broken → hub rolled back), 25 (tested an invented API) | 4 |
| not verifiable | 7 (masked by goal 6's failing assert) | 1 |

The harness scorer said **16/25 work done, 9/25 `done`**. It passed three goals that were
incomplete (19, 22, 23) because the named file ran, and it failed four whose code was correct
(1, 6, 20, 24) because the model's own assert was wrong.

## Per-goal (pass 1)

| # | goal | run status | hand verdict |
|---|---|---|---|
| 1 | Stack class | stopped | class correct; own try/`assert.fail` test wrong → loop guard |
| 2 | add `clear()`/`isEmpty()` | stopped | appended methods **outside the class** → SyntaxError; hub gave no verdict on the append; rolled back |
| 3 | `daysBetween`/`isLeapYear` | stopped | works |
| 4 | surgical: throw on malformed date | stopped | works |
| 5 | **comprehension:** document real functions | stopped | **exact**; did not invent the rolled-back `clear()` |
| 6 | `word_count` (py) | stopped | code correct; assert expects "test"×2, the sentence has 3 |
| 7 | `top_n` | stopped | not verifiable (file dies on goal 6's assert first) |
| 8 | PriorityQueue | stopped | works (30 steps, recovered from an error) |
| 9 | **reasoning:** is `pop()` stable? | **done** | answer right, assert proves it — but `S_QUEUE.md` from its own plan never written; closed a goal-1 task and was told "ALL 3 TASKS FOR THIS GOAL ARE COMPLETE" → **false done** |
| 10 | page + counter | done | works; browser-tested (0 → 1) |
| 11 | reset button | done | works |
| 12 | matrix multiply/transpose | done | works |
| 13 | `identity(n)` | done | works |
| 14 | Roman numerals (py) | done | works; own asserts also right |
| 15 | LRU cache | stopped | works (messy run) |
| 16 | email/password validators | done | works |
| 17 | JSON config + loader | done | works |
| 18 | bank Account | done | works (left identical duplicate methods — harmless) |
| 19 | all-or-nothing `transfer` | stopped | **failed**: never added; 3 identical broken edits → loop guard → rolled back. Scorer said "runs" |
| 20 | grid `neighbors` (py) | stopped | code correct; assert expects a specific order the goal never asked for |
| 21 | canvas game | stopped | correct (all four edges clamped properly; read by hand) |
| 22 | coin + score | stopped | **failed**: 4 appends broke the file with no verdict → loop guard → rolled back to a score label that never increments; no coin |
| 23 | merge + quick sort | stopped | **partial**: `quickSort` missing. Scorer said "runs" |
| 24 | EventEmitter | stopped | code correct (its own debug print proves `off()`); test reuses an emitter with a leftover listener |
| 25 | tests for s4/s9 | stopped | **failed comprehension**: tested `enqueue`/`validate.email` (not real) with mocha `describe` under plain node |

**Pass 2** (the first 10 goals again, fresh workspace, warm endpoint): scorer 8/10 work, 6/10
`done` (pass 1 had 5/10 and 2/10 on the same ten). Goal 9 wrote `S_QUEUE.md` this time, with the right
verdict but the **wrong reason** (credits `shift()`, not sort stability). Run-to-run variance on
identical prompts is large: one pass is not a stable measurement of the 14B.

## Comprehension / reasoning / correct code

- **Comprehension:** exact when asked to *describe* files (5); invented the API when asked to *test* them (25).
- **Reasoning:** right answer on both passes; a correct explanation on neither (pass 1 wrote none, pass 2 a wrong one).
- **Correct code:** usually right. Failures concentrate in the model's self-verification and in multi-step edits to existing files.

## What the hub did, and what it changed

- **Rollback worked on real 14B output three times** (goals 2, 19, 22). Later goals never inherited a broken file.
- Gaps this run exposed, each now fixed with a test proven able to fail:
  - `append_file` got no post-write syntax check. Goals 2 and 22 broke files with no verdict → **c2218f9** (on main).
  - The finish gate never checked files the plan listed under FILES (goal 9) → branch `finish-gate`: ask once, then accept with a note.
  - The ledger counted tasks earlier goals had completed as "this goal's" (goal 9's false "ALL 3 TASKS … COMPLETE") → same branch.
- Harness lesson: the scorer must check that each requested **function** exists and works, not only that the named file runs.

## GPU window

20:33 deploy (`min=0 max=1`), 20:35:15 harness start, pass 1 finished 20:57:25, pass 2 finished 21:03:23.
**The stop overran by about 5 minutes.** `modal app stop` prompts `[y/N]` and aborts in a
non-interactive shell. The manual stop, the watchdog and an `echo y |` retry all failed. The
app was stopped with `--yes` at 21:10:10 and confirmed `stopped, 0 tasks` at 21:10:43. All stops now go
through `training-data/factory/stopApp.mjs` (COORD Rule 7a).

## Data (for the replay corpus and future training)

`data/pass1` (25 runs) and `data/pass2` (10 runs): `runs/` (full histories), `traces/`,
`index.jsonl`, the final `workspace/`, and `corpus-rows.jsonl`. **190 new unique replies**,
tagged `model=coder14b` plus a pass-specific `source`, were appended to
`server/testdata/model-corpus.jsonl` (1,759 → 1,949). The parser threw on 0 of them. `goals.json` holds the prompts.

## Reproduce

The tools that produced this data are kept in `tools/`:

- `trial35.mjs` is the harness. It spawns an isolated hub, runs goals sequentially, waits for
  `busy:false`, and scores what is on disk. **One change since this run:** the function-existence
  check (`FN-MISSING`) was added afterwards, so the numbers in `run.log`/`run2.log` were scored
  without it.
- `buildcorpus14b.mjs` turns one run folder into tagged corpus rows, deduped against an
  existing corpus.
- `collect14b.sh` is what ran after the window: copy both passes, build and append the rows
  (guarding the corpus's missing trailing newline), then rerun the corpus tests.

```bash
TRIAL_STOP_AT=<epoch ms> GOALS_FILE=measurements/2026-09-10-14b-30min/goals.json \
MODEL_BASE=<endpoint> MODEL_NAME=coder14b LABEL=coder14b-base \
node measurements/2026-09-10-14b-30min/tools/trial35.mjs
```

Stop the endpoint afterwards **only** with `node training-data/factory/stopApp.mjs <app>` (COORD Rule 7a).
