# 06 — Loop detection, repeat detection and the step budget

READ-ONLY audit of `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js` (serving tree, git `3d7a080`).
Evidence read, not modified: set H `coder14b-sethfix` (51 runs), set I `coder32b-seti` (20 runs), and the three
live trial35 arms (14B 16, MoE 18, dense 16 runs as of this pass). Two workspace *bundles* were cloned into the
session scratchpad for the blob analysis; no live workspace and no live git repo was touched.

---

## Headline

**The single largest killer of runs is not over-eager detection. It is a guard that structurally disarms itself
the moment the repeated call SUCCEEDS.**

`run.recentAt` pairs each remembered reply with `landed` — the count of write/edit/append steps that answered
`OK`. Two replies count as "the same" only if their `landed` values are equal. So a model that repeats one
identical reply whose write LANDS EVERY TIME increments `landed` on every step, the pair never matches,
`seenTimes` stays at 1, and the guard can never fire. Proven directly from the persisted arrays:

| run | arm | `recent` (8 slots) | `recentAt` | repeatCalls | died of |
|---|---|---|---|---|---|
| `17cc6854` | trial35-14B | 8 × `424:148w5zk` (1 distinct) | 19,20,21,22,23,24,25,26 | 23 | step budget |
| `a3a58e96` | setH-14B | 8 × `333:jai23o` (1 distinct) | 21,22,23,24,25,26,27,28 | 25 | step budget |
| `1f5b74f0` | setH-14B | 8 × `313:4ccg8s` (1 distinct) | 20,21,22,23,24,25,26,27 | 27 | step budget |

One reply, eight times, eight different `landed` values. `1f5b74f0` sent byte-identical
`edit_file LINES: 15-15` twelve-plus times, each answering `OK: edited s1_library.js lines 15-15 (1 line(s)
replaced by 3)`; `a3a58e96` and `17cc6854` appended the identical 173/284-byte block twelve-plus times
(`s8_grades.py` grew 4310 → 6213 and 5849 → 8973 bytes). The duplicate-call detector SAW all of it —
`repeatCalls` 23, 25, 27 — and **nothing in the file compares `repeatCalls` to a threshold.** The counter with the
right key has no action; the guard with the action has a key that this shape defeats.

The `landed` pairing was introduced for a real bug (read, write, read, write counted as three identical replies).
It is correct for *interleaved* work and exactly wrong for *a productive-looking write repeated forever*.

---

## A. Every distinct detector

| # | Detector | Location | Keys on | Threshold | On firing | Structurally blind to |
|---|---|---|---|---|---|---|
| **D1** | Same-response window guard | `:3013-3072` | djb2 hash + length of the **whole model reply** (whitespace-collapsed), window of last 8, **paired with `landed`** (`run.recentAt`) | `seenTimes >= 3` (same hash AND same `landed`), one pardon if `justSubstituted` | **KILLS** (`status='stopped'`) | (a) any repeat whose write LANDS — `landed` moves, so the pair never matches (the 3 runs above); (b) replies differing by one byte (comment, number, whitespace inside a string); (c) it keys the REPLY, so two different replies emitting the same call are invisible; (d) resumed runs with `recent` but no `recentAt` fail open for one window |
| **D2** | Duplicate-call guard (`callLog`) | `:3466-3481` | `tool + JSON.stringify(args)` → **last answer only**. `MUTATING_REPEAT` (`write_file`,`edit_file`,`append_file`) matches on ARGS alone; every other tool needs ARGS **and** identical answer | **none — fires on the first repeat** | **WARNS ONLY** (appends "⚠️ You already ran this exact …"); bumps `repeatCalls`, and `repeatFailures` if the answer starts `ERROR` | Nothing acts on the counters. Stores only the LATEST answer per key, so an answer that alternates A→B→A never matches for answer-keyed tools. One byte of difference in args defeats it entirely |
| **D3** | `repeatCalls` / `repeatFailures` | set `:3474-3478`, read `:3067-3070` | — | `repeatFailures >= 1` | **Only chooses D1's wording** ("the tool refused every time" vs "the model produced the same response") | Not a detector. `repeatCalls: 27` has never ended a run |
| **D4** | Mechanical substitution (`resultSigs`) | `:3646-3692` | `tool|args|rawAnswer.slice(0,800)`, window 40 | 1 duplicate, tool in `ORIENT` = {`list_dir`,`outline_file`,`search_file`,`list_assets`,`task_list`}, `escalations < 2` | Replaces the feedback with the goal's file contents; sets `justSubstituted` (buys a D1 pardon) | `read_file`, `recall`, `git_*` deliberately excluded; all mutating tools excluded; answers that diverge only after 800 chars |
| **D5** | Parse-failure window | `:3086-3090`, `:3109` | parseability of the last 10 replies | 5 failures in 10 | **KILLS** (`status='error'`) | Well-formed but useless actions |
| **D6** | Recurring browser error (`sameErr`) | `:3718-3730` | `[JS ERROR]` line, digits stripped | `>=2` warn, **`>=4` KILLS** | stop + "likely structural" | Only `test_web`; a run that never browser-tests is exempt |
| **D7** | `cleanTests` auto-finish | `:3738-3751` | 3 consecutive clean `test_web` | 3 | **ENDS the run as `done`** (bypasses the finish gate) | Opposite failure: ends work early, marked `auto_clean_tests` |
| **D8** | `finishBlocks` | `:3195`, `:3365` | finish-gate refusals | 3 | Forced UNVERIFIED finish | — |
| **D9** | Budget | `:151-160`, `:2946`, `:3771-3775` | `run.modelCalls`, wall clock, optional tokens | `AGENT_MAX_STEPS` (default **250**; trials set **30**), `AGENT_MAX_MINUTES` (90 / trials 8) | **KILLS** (`status='stopped'`) | Cannot tell a loop from work in progress — see D |
| — | *Refusal families that GENERATE the loops* (not detectors): `NO CHANGE` / `noChangeAt` `:707,:714,:812`; ambiguous match `:845`; destructive-write `:3530-3545`; duplicate-def `:3556-3575`; marker `:352`; blocking-server `:1055+` | | | | refuse one call | each is a correct refusal that an unchanged retry reproduces forever |

Every termination site in the loop was enumerated (`:2983, :3001, :3058, :3088, :3372, :3427, :3723, :3750,
:3773, :4382, :4724`); the non-detector ones are model/API errors, `awaiting_approval`, and the user's `/stop`.

### The three known-blind shapes, re-tested in this tree

1. **Repeats of calls that SUCCEED — confirmed and extended.** Of 32 setH-14B deaths to D1's reply branch, the
   most-repeated call in **22** succeeded every time, 6 failed every time, 4 mixed. Across the whole setH-14B arm
   only 33 of 199 counted repeat events were errors; **166 were successful calls.**
2. **A→B→A oscillating edits — confirmed, and D2 is blind by construction.** 12 exact-inverse edit pairs in 8
   setH-14B runs, 11 in 4 setI runs, 7 in 2 trial35-dense runs. Cleanest specimen, trial35-dense `4adb170b`
   (`s5_expr.js`, died on the step budget): `try{…}` ⇄ `if (/\/\s*0\b/.test(expr))…` alternating four full cycles,
   file size cycling 28 → 25 → 28 → 25 → 28 lines, **every single call answering `OK: edited`**. Neither arm of
   the cycle is ever a duplicate by args, and each answer differs, so D2 counts nothing at all.
3. **Appends whose byte count changes — the blindness has MOVED, not closed.** In this tree `append_file` is in
   `MUTATING_REPEAT`, so it is keyed on ARGS and the changing byte count no longer hides it: `17cc6854` logged 22
   duplicate-arg writes, `a3a58e96` 25. **They were all detected and none of them did anything** — 128 of 173
   duplicate-arg writes in setH-14B landed `OK`. Detection is no longer the gap; the missing threshold is.

And the advisory's own effectiveness, re-measured: **219 repeat warnings in setH-14B, and the very next call was
itself a repeat 164 times (75%)**. setI-32B 54 → 21. This matches the recorded finding (198 / 152) and the
substitution comment's own measurement that advisory text scores no better than doing nothing.

---

## B. `MUTATING_REPEAT` — which tools use which key, and the gaps

**Keyed on ARGUMENTS alone** (a repeat is a repeat whatever comes back): `write_file`, `edit_file`, `append_file`.

**Keyed on ARGUMENTS + identical ANSWER** (everything else in `tools`): `list_dir`, `read_file`, `search_file`,
`outline_file`, `remember`, `recall`, `git_diff`, `git_log`, `git_commit`, `git_undo`, `download_file`,
`run_command`, `run_python`, `web_search`, `web_fetch`, `test_web`, `task_list`, `task_add`, `task_done`,
`list_assets`, `see_screen`, `verify_godot`, `verify_project`, `spawn_subtask`, `queue_task`.

Gaps found:

- **The strong key has the weak action.** Args-keying makes writes undeniable, then the only consequence is a
  sentence. Runs `1f5b74f0`/`91231920`/`aa2d8cd2`/`da7271a7`/`a3a58e96` (setH) and `17cc6854` (trial35) each
  reached `repeatCalls` 22-27 and ran the full 30 calls.
- **`callLog` keeps only the last answer per key**, so for answer-keyed tools an alternating answer (a test that
  fails, is "fixed", fails again identically) is only caught on immediately-consecutive equality.
- **Three different keys for the same concept:** D1 hashes the reply, D2 hashes args (+answer), D4 hashes
  `args + first 800 chars of answer`. A shape can slip between any two of them.
- **`run_command`/`run_python`/`verify_project` are answer-keyed**, which is right in principle, but any output
  carrying a duration, a temp path or a timestamp makes an identical re-run look novel forever.
- **Sub-runs** (`spawn_subtask`, `:2724`) run their own loop with no `callLog` and no `recent` window at all.

---

## C. False positives — real, but small, and the opposite of what was feared

Measured by replaying each run's tool sequence and asking whether a *legitimate* re-do was flagged:

| arm | repeats flagged | legit re-test after an edit landed | legit re-read after an edit landed |
|---|---|---|---|
| setH-14B | 219 | 4 | 0 |
| setI-32B | 54 | 4 | 1 |
| trial35-14B | 38 | 2 | 0 |
| trial35-MoE | 14 | 7 | 0 |
| trial35-dense | 19 | 1 | 0 |

- **"Reading the same file twice for good reason" is essentially never punished** (0-1 occurrences per arm), and a
  flag is only a sentence anyway.
- **"Running a test repeatedly while fixing it" cannot kill a run**: D1's `landed` pairing means a run that lands
  fixes between test runs can never accumulate `seenTimes`. In the MoE arm — the healthiest — 7 of 14 flags are
  exactly this legitimate shape, and that arm had **zero** loop-guard deaths.
- **"Appending different content to the same path" is not flagged at all** (args differ), so that FP does not
  exist in this tree.

The genuine false positive is the inverse of the one anticipated: **the model is killed for repeating a CORRECT,
already-applied edit.** Of 39 setH-14B loop deaths the last tool call was a `NO CHANGE` refusal in 8 and an
`ERROR` refusal in 15 — **23 of 39 (59%) died retrying a refusal, not spinning on their own output.** setI-32B:
3 of 5 ended on `NO CHANGE`. Run `04188d70` is the archetype — one `OK` edit, then the same correct edit twice
more, both answered `NO CHANGE`, dead at 6 model calls (`recentAt` `[0,0,0,1,1,1]`). That the hub was *right*
every time is what makes it a product defect rather than a model defect: the identical sequence in setI run
`33adc835` survived only because a later edit happened to land.

Loop deaths are also early: **28 of 39 setH-14B loop deaths happened within 10 model calls** (median 8).

---

## D. The step budget: two populations wearing one label

13 budget deaths across the five arms (setH-14B 5, setI-32B 2, trial35 14B 1 / MoE 2 / dense 3). They split
cleanly on *unique* calls made:

**(i) Undetected loops billed to the budget — 6 runs, all 14B:**

| run | unique calls / total | landed writes | last 6 calls | repeatCalls |
|---|---|---|---|---|
| `1f5b74f0` | 3 / 30 | 28 | 6 × identical `edit_file` | 27 |
| `91231920` | 5 / 30 | 27 | 6 × `edit_file` | 24 |
| `a3a58e96` | 5 / 30 | 29 | 6 × identical `append_file` | 25 |
| `aa2d8cd2` | 4 / 30 | 28 | 6 × `edit_file` | 26 |
| `da7271a7` | 4 / 30 | 28 | 6 × `edit_file` | 26 |
| `17cc6854` (trial35-14B) | 6 / 30 | 27 | 6 × identical `append_file` | 23 |

Three to six distinct actions in thirty calls. These are not budget results and not capability results — they are
**loop-guard failures that the budget cleaned up after**, and the workspace was actively being corrupted while it
happened (`s8_grades.py` +3.1KB of duplicated block).

**(ii) Genuinely cut off mid-work — 7 runs, the stronger arms:**

| run | arm | unique / total | landed | last 6 calls | errors in last 6 |
|---|---|---|---|---|---|
| `d841ad44` | setI-32B | 18 / 28 | 10 | read→edit→edit→edit→read→edit | 0 |
| `de950b2d` | setI-32B | 22 / 29 | 16 | 6 × edit (varied) | 1 |
| `66fb8638` | MoE | 24 / 30 | 7 | edit→write→run_command→read→run_command→run_python | 0 |
| `c75eab5e` | MoE | 26 / 30 | 9 | run_command→read→read→write→run_command→edit | 0 |
| `153f5c99` | dense | 20 / 30 | 8 | read→edit→read→edit→run_command→read | 0 |
| `4adb170b` | dense | 17 / 30 | 18 | run_command→4×edit→run_command | 2 |
| `ee180f39` | dense | 19 / 29 | 14 | edit→run_python→edit→run_python→2×edit | 2 |

Varied, mostly-unique calls, an edit/test rhythm, and the last call succeeding in 3 of 7. **Every MoE and dense
budget death is in this population; every 14B budget death is in the first.** `4adb170b` is a hybrid — varied
calls, but the A⇄B oscillation above, i.e. a loop the guards cannot see.

Consequence for set J: raising `AGENT_MAX_STEPS` buys the MoE and dense arms real steps and buys the 14B arm more
identical appends. The README's decision to hold 30 is right for the 14B and is quietly *suppressing* the stronger
arms' scores. Report the two populations separately or the number means nothing.

---

## E. Content-addressed (blob) check — feasible and cheap, but low-yield as specified

**The data is there.** Mutating tools checkpoint before writing (`:3158-3180`, `MUTATING` = write/append/edit/
run_command/run_python/download_file/spawn_subtask, gated on `isDirty`), each recorded as a `checkpoint <sha7>`
step. setH-14B: 255 checkpoint steps across 51 runs (median 2, max 29), and the arm's `workspace.bundle` holds
271 commits of which **260 fall inside a known run window**, so timestamp attribution works. Per-file blob ids
need one `git ls-tree -r` per commit — no extra hashing, no new storage.

**Measured yield, run against the real bundles:**

| arm | commits | files | blob-returns | attributable | when it would have fired |
|---|---|---|---|---|---|
| setH-14B | 271 | 16 | 5 | 1 (`1380b856`, which D1 killed anyway) | — |
| setI-32B | 107 | 20 | 3 | 2 | `33adc835` tool step 22 of 24 (~2 steps saved); `d841ad44` step 28 of 28 (0 saved) |

Three reasons the yield is low, all worth knowing before building it:

1. **The dominant 14B loop is GROWTH, not oscillation.** An append that adds the same 284 bytes, or an
   `edit_file LINES: 15-15` that replaces 1 line with 3 each time, never returns to a blob it already had. No
   content-addressed check can ever see these — only a threshold on `repeatCalls` can.
2. **The tolerant matcher re-indents `REPLACE` to the region** (`:770-800`), so the return leg of an A→B→A edit
   frequently lands as A′ (whitespace-different) and hashes differently.
3. **Checkpoints commit the state BEFORE a write and only when dirty**, so the final state of a cycle may never be
   committed at all.

**Recommended variant, same idea, better placement:** the file is already read back after every write for the
def-loss / export-loss / duplicate guards (`:3520-3590`). Hash *that* buffer and keep a per-run `Set` of
`path → seen content hashes`. That catches A→B→A exactly, at the moment it happens, with no dependence on
checkpoint timing or `isDirty`, and costs one hash of a string already in memory. It still will not catch growth
loops — pair it with an actual threshold on `repeatCalls`.

---

## F. Firing that later analysis misreads — yes, and the bias runs the wrong way

`trialJ.mjs:159` counts a tool error as `type === 'tool' && /^ERROR:/.test(result)`.

| what happens | starts with `ERROR:`? | counted as a tool error? | setH-14B | setI-32B | t35-14B |
|---|---|---|---|---|---|
| D1 / D9 killing the run | recorded as `type:'error'`, not `'tool'` | **no** | 44 deaths | 7 | 8 |
| duplicate-call warning appended to an `OK` answer | no (answer begins `OK`) | **no** | **174** | 25 | 31 |
| `edit_file` `NO CHANGE` refusal | no | **no** | 22 | 24 | 4 |
| destructive-write / duplicate-def refusal | **yes** | **YES** | 35 | 17 | 4 |
| harness-visible tool errors, all causes | — | — | 67 of 469 tool steps | 29 of 243 | 15 of 123 |

Three distinct misreadings:

1. **The repetition machinery is nearly invisible in the progress table.** 174 duplicate-call events in setH-14B
   against 67 counted errors — the single most common event in that arm contributes zero to the column used to
   judge it, because it is appended after `OK`.
2. **`NO CHANGE` — the refusal that ends 8 of 39 loop deaths — is invisible**, because it is a refusal that does
   not use the `ERROR:` convention. A run can die of a refusal-retry loop with `err: 0` in `rows.json`.
3. **The inversion: the guards that WORK are the ones that get counted.** Destructive-write and duplicate-def
   refusals do begin `ERROR:` and are scored against the arm; `trialJ`'s carve-out (`grd`) exempts only
   `/boundary marker and/`. So set H's 35 correct refusals and set I's 17 penalised those arms, while the loop
   guard killing the run cost nothing in the same column. This is the "fix the deciding path, not the advisory
   one" pattern in the measurement layer: the number that gets read is not the number that reflects the event.

Also: the D4 substitution replaces the model's FEEDBACK but `pushStep` records the original `result`
(`:3694`, `:3754`), so post-hoc analysis sees an ordinary `list_dir` answer and can only tell the hub intervened
from the separate `note` step.

---

## Recommendations, in yield order

1. **Give `repeatCalls` a threshold.** It already counts the shape that kills 14B runs (22-27 per run) and nothing
   reads it. Even "refuse the 4th byte-identical mutating call and say the earlier ones already landed" would have
   ended six 30-call runs at step ~8 and prevented ~3KB of duplicated code per run.
2. **Break the `landed` immunity**: require `landed` to have increased *by a write with a different content hash*,
   or exempt reply-repeats whose action is a duplicate mutating call from the `recentAt` pairing.
3. **Treat a `NO CHANGE` retry as its own state**, not as a loop to kill: 23 of 39 setH-14B loop deaths were
   refusal-retry loops, and the `noChangeAt` text (already in this tree) is the right fix aimed at the right place —
   it needs the guard to stop killing before the model can act on it.
4. **Split budget deaths into "stuck" and "cut off" in every report table** — 6 vs 7 here, and they point opposite
   ways on whether to raise `AGENT_MAX_STEPS`.
5. **Make refusals visible to the harness on their own axis** (`refusals` alongside `err`), and stop scoring
   working guards as model errors.
