# 14B vs 32B head-to-head — 2026-09-10

**The question (tatte):** *"Is it possible to make 14b as good as 32b with the route I'm on"*, then
*"Okay let's run both twice (use different prompts to correct hidden errors)"*.

**Setup.** Both models are Qwen2.5-Coder-Instruct, AWQ int4: the 14B on an A10G and the 32B on an H100,
served by vLLM. Identity was checked from `/api/health` (`lora: null`) at the start of every set.
Both ran on the same hub (main `725bf46`), on isolated hubs, with identical prompts and fresh
workspaces. There were two **new** prompt sets: Set A (20 `t` goals) and Set B (20 `u` goals). None
reuses the goals tonight's hub fixes came from. The goals, the scorer, the comparison and the
collection script were **pre-registered in `b504e8d`** before any result existed. The
export checker (`tools/exportcheck.cjs`) was written and fixed *after* seeing Set A, and is marked as
such.

## Result: the gap is not where the scorer puts it

Every goal was verified by hand: the requested functions were called directly, and pages and games
were read line by line.

| hand-verified, 40 goals | 14B | 32B |
|---|---|---|
| **done exactly as asked** | **22** | **27** |
| correct code, **model's own test wrong** | 7 | 2 |
| works, but a stated requirement missed (not exported) | 1 | 4 |
| correct, broken only by an earlier goal's file | 2 | 0 |
| failed | 8 | 7 |
| **implementation correct** (rows 1–4) | **32** | **33** |

- **The scorer saw a 10-goal gap:** 14B 25/40 work versus 32B 35/40.
- **Finished work shows a 5-goal gap.**
- **On whether the code is right, the models are one goal apart.**

## Where the 32B is genuinely better

- **Reasoning.** Two goals asked the model to reason about its own code, write the answer
  down and prove it. The 32B got both right *for the right reason*: "it sorts first, so unsorted
  input is fine", and `{ a: [1, 2] }` gives `{ 'a.0': 1, 'a.1': 2 }`, matching its code exactly. The
  14B got 0/2: in one it never wrote the file, and in the other its write-up (`{ a0, a1 }`)
  contradicted its own code. Tonight's earlier 14B run showed the same pattern: a right answer
  with a wrong reason. **This is the real capability gap.**
- **Its own tests.** The 14B wrote 7 tests that fail correct code. The kinds of mistake:
  - miscounted values;
  - overlaps that aren't overlaps;
  - `assert` used before it's declared;
  - calling a function it had only exported;
  - Python's quoted `KeyError`.

  The 32B made this mistake twice. The self-test weakness is shared, just much more frequent in the 14B.

## Where the 14B was better, or they were identical

- **"Exporting X".** The 14B complied more often. The 32B missed it four times (`cToF/fToC`,
  `match`, `compare`, `isValidCard`) because it tends to write self-contained scripts. The 14B's
  two misses were `compare`, and the empty file left by its interrupted run.
- **Imports in "test these files" goals.** The 14B used the correct import shapes both times. The
  32B imported `.Queue` from a module that exports the class directly.
- **Index completeness.** The 14B's Set B index was complete, while the 32B's listed only 6 of 14 files.
  Neither invented a file.
- **Identical failures.**
  - Both broke their canvas game the same way: repeated edits appended duplicate
    `update()` functions, the last declaration silently won, and goal 14's working game was
    undone by goal 15.
  - Both wrote the **character-for-character same wrong test**,
    `wrap("This is a test", 10) == "This is\na test"`. That's a memorised example, not reasoning.
  - Both fell into the same quoted-`KeyError` trap.

## Per-goal verdicts

`P` pass · `CT` correct code, own test wrong · `NX` not exported · `INH` inherited failure · `F` fail

| # | Set A | 14B | 32B | | # | Set B | 14B | 32B |
|---|---|---|---|---|---|---|---|---|
| 1 | temp convert | P | NX | | 1 | Queue | P | P |
| 2 | kToC | P | P | | 2 | peek() | P¹ | F (never added) |
| 3 | palindrome | P | P | | 3 | anagram | P | P |
| 4 | Inventory | P | P | | 4 | Cart | P | P |
| 5 | remove last unit | P | P | | 5 | round total | P | P |
| 6 | notes (comprehension) | P | P | | 6 | notes (comprehension) | P | P |
| 7 | mergeIntervals | CT | P | | 7 | flatten | P | P |
| 8 | **reasoning** | F | **P** | | 8 | **reasoning** | F | **P** |
| 9 | Enter adds item | P | P | | 9 | sum page | P | P |
| 10 | Clear button | F (null button) | P | | 10 | validation | P | P |
| 11 | stats | CT | P | | 11 | wrap | CT | CT (same test) |
| 12 | router | CT | NX | | 12 | semver | NX | NX |
| 13 | wildcard | F (never matches) | F (over-matches) | | 13 | pre-release | F (inverted²) | P |
| 14 | bouncing ball | P | P | | 14 | WASD + wrap | P¹ | P¹ |
| 15 | paddle | F (collision never called) | F (no collision) | | 15 | obstacles + Game Over | F (1 frame) | F (NaN radius) |
| 16 | CSV sum | CT | CT | | 16 | deep_get | CT | P |
| 17 | debounce | P | P | | 17 | retry | P | P |
| 18 | test other files | INH | F (read loop) | | 18 | test other files | INH | F (wrong imports) |
| 19 | bit functions | F (runaway reply) | P | | 19 | Luhn | CT | NX |
| 20 | index | P | P | | 20 | index | P | F (6/14) |

¹ Passed when written, then undone by a later goal.
² The 14B's own test caught it: right test, wrong code.

## Hub gaps this run exposed (candidates, not yet fixed)

- **Duplicate top-level function declarations.** These broke both models' games, and `node --check` can't see
  them. Flag them in the post-write verdict.
- **A repeated identical `read_file` window.** The 32B read lines 1–5 three times, the tool told it to
  use OFFSET, and the loop guard killed the run. Step it to the next window instead.
- **A truncated reply (unclosed fence) parsed as `write_file` with empty content,** after which `write_file`
  wrote a 0-byte file. That was the 14B's runaway goal 19, and the new corpus rows caught it (`parserCorpus`
  fails on them). The corpus append is held until this is fixed; the rows are kept in `data/`.

## Cost and speed

| | GPU | Time | Cost | Set A | Set B |
|---|---|---|---|---|---|
| 14B | A10G (~$1.10/hr) | ~29 min | ~$0.55 | 14.5 min | 11.9 min |
| 32B | H100 (~$4/hr) | ~22 min | ~$1.50 | 6.9 min | 10.8 min |

The 32B had **24 tool errors in Set B**, against the 14B's 5. It was faster, but it thrashed more. Both apps
were stopped by `stopApp.mjs` watchdogs (exit 0, first attempt) and independently confirmed as
stopped with 0 tasks.

## The answer to the question

**On implementation, the 14B is already about level with the 32B** on fresh goals (32 against 33). The
32B's real advantages are **reasoning about code** and **writing correct tests of its own code**.
The second is largely a hub-side fix: verify the model's tests independently rather than trusting
them. The first is the genuine size gap, and the most likely place targeted training data could help.

Files: `NOTES-live.md` (running log, with corrections), `snapshots/` (files saved before later goals
edited them), `data/` (every run, trace, final workspace and tagged corpus rows), `tools/`, and the
four set logs and both watchdog logs.
