# verify-06 — loop / repeat detection and the step budget (SECOND AUDITOR, independent)

Scope: `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js` @ `3d7a080` (serving tree).
Data (read-only): setJ `coder14b-setj` (16 complete), setH `coder14b-sethfix` (51), trial35-cWxzHB (30B, 18),
trial35-8XrYOc (32B, 18).

Protocol note: `audit/06-loop-detection.md` did **not exist** when this analysis was performed (the audit dir held
only `02-harness.md`, `03-parser.md`, `04-edit-tools.md`, `05-guards.md`). Everything below is re-derived from
source and run records. Comparison section appended at the end.

---

## 0. Headline

Three findings, in order of how much they should change what anyone does next.

1. **The detector that SEES repeats cannot stop a run; the detector that STOPS a run is blinded exactly when work
   is landing.** Every budget death in the 14B data is a loop that the args-keyed detector had already flagged
   3–27 times and was structurally unable to act on.
2. **The loop guard is killing runs that were already unsalvageable.** Direct counterfactual: the runs where
   nothing stopped the loop (budget bucket) scored **0/6** across both 14B arms while spending their extra ~20
   calls on literal repetition. Fixing loop *detection* is not worth further effort **for score**.
3. **A recording bug misclassifies 75% of setH-fix run endings** in the path that picks the retry's repair goal —
   though not in the path that produced the measurement.

And a correction to the premise: the score split quoted in the task does not reproduce (§1).

---

## 1. THE CRITICAL DATUM — tested hard

### 1a. The numerator reproduces; the score split does not

Death class re-derived by scanning **all** error steps for a guard signature (not just the last — see §5).

setJ `coder14b-setj`, 16 goals:

| ending | n | `good` (from `coder14b-setj-rows.json`) |
|---|---|---|
| CLEAN (`done`) | 7 | **2** |
| LOOPGUARD (`loop` 5 + `tool_loop` 2) | 7 | **2** |
| BUDGET | 1 | 0 |
| INTERRUPTED | 1 | 0 |
| **total** | 16 | **4** |

- **Loop-guard deaths 7/16 — CONFIRMED.** Baseline also confirmed independently: setH-fix, first 20 runs by
  `createdAt`, loop+tool_loop = **13/20**. So "13/20 → 7/16" is correct.
- **Score 4/16 — CONFIRMED.**
- **"loop 1 of 7, clean 3 of 7" — DOES NOT REPRODUCE. I get 2 and 2.** The two loop-guard deaths that scored are
  `47f510ad` (tool_loop, disk `s3_matrix.js:runs`, `good=true`) and `7931f7a0` (loop, disk `s5_expr.js:runs`,
  `good=true`). Both are loop deaths by any-guard classification and both are `good` in rows.json. The asserted
  gap between loop-ending and clean-ending goals is an artifact; **on this arm the two buckets score identically.**

At larger n (setH-fix, 51 runs joined to `coder14b-sethfix-rows.json`):

| ending | n | good | rate |
|---|---|---|---|
| CLEAN | 6 | 2 | 33% |
| LOOPGUARD | 39 | 7 | 18% |
| BUDGET | 5 | 0 | 0% |
| INTERRUPTED | 1 | 0 | 0% |

2/6 vs 7/39 is not a real difference at n=6. **There is no measured score penalty for ending in a loop rather
than ending clean.**

### 1b. Was the goal still salvageable when the guard fired?

**Evidence that it was not:**

- **The model had stopped changing files.** setJ: **0 of 7** loop deaths had a successful write in their final two
  tool calls. setH-fix: **27 of 32** `loop` deaths had no successful write in the last 3 calls, and **8 of 32**
  never landed a single successful write in the entire run. The terminal pattern is uniformly refusals —
  `edit_file` FIND-not-found, `NO CHANGE`, `would have DUPLICATED`, ambiguous-FIND — or re-reads/re-runs.
- **Most of the goal remained undone.** setH-fix loop deaths: **32 of 39** left the target file `THROWS` or
  `FN-MISSING` on disk. setJ: 5 of 7 (`s6_graph.py:THROWS`, `s4_markdown.py:THROWS`, `s10_desk.js:THROWS`,
  `s2_logs.py FN-MISSING(time,status,bytes,seconds)`, `s6_graph.py:THROWS`).
- **The direct counterfactual — runs where nothing stopped the loop — scored 0.** The budget bucket is exactly
  "what happens if you let the loop run": **0/6 scored** across setJ + setH-fix. And the extra ~20 calls were
  spent on literal repetition, not work: `17cc6854` sent the **same 284-byte `append_file` 23 times** (file
  541 → 8973 bytes of duplicated methods); `a3a58e96` sent the same append 20 times; `4adb170b` (32B) oscillated
  `edit_file` +3/−3 lines six times. Letting the loop run produced **file growth and file destruction, not score.**

**Evidence on the other side, stated honestly:**

- **The guard fires early, not as a last resort.** setH-fix loop deaths: modelCalls at death min 5, **median 8**,
  max 13, against a 30-call budget — **~22 calls of headroom** typically unspent.
- **7 of 39 loop-death goals scored anyway**, i.e. the guard fires on runs that are in perfectly good shape; in
  those the work had already landed and the guard only denied the `finish`. It costs nothing there, but it shows
  the trigger is not specific to doomed runs.
- **13 of 39 setH-fix kills landed while the last 3 tool calls all SUCCEEDED** (setJ: 2 of 7). Examples:
  `8eeeee98` repeating `verify_project` which was returning `✅ python s2_logs.py`; `900e4fe2` repeating
  `run_command` at `EXIT: 0`; `4cf59e58` / `8bc322d9` repeating `outline_file`; `6e187cd9` repeating `recall`
  ("No notes yet"). Nothing was refusing these models — they were idling on verification, plausibly trying and
  failing to finish. A finish-nudge rather than a kill is the obvious save. **But only 1 of those 13 scored**, so
  the recoverable upside is ~1 goal in 39.

### 1c. Verdict

**The loop guard is overwhelmingly killing runs that were already unsalvageable.** The deciding evidence is not
the score split (which does not reproduce) but the counterfactual: when the loop is *not* killed it runs to the
budget, scores **0/6**, and actively destroys the file. Combined with 32/39 loop deaths leaving a broken file
while the model emitted only refusals, **further effort on loop DETECTION — firing better, sooner, or more
precisely — is not justified by score.**

The effort is justified on the **inverse** defect, which is a different bug and is costing real money and real
files: the guard's blind spot on succeeding writes (§3), which converts what should be an 8-call loop-stop into a
30-call budget burn that corrupts the workspace. That is damage prevention and GPU cost, not score.

---

## 2. (A) Every distinct detector

| # | detector | keys on | window / threshold | action |
|---|---|---|---|---|
| 1 | **same-response guard** (3024–3073) | normalized whole assistant REPLY (whitespace-collapsed, `length:djb2`) **paired with `landed`** = count of `OK`-prefixed write/edit/append steps so far | last **8** replies; **≥3** occurrences of the *(reply, landed)* pair | **STOPS the run**. Wording forks on `repeatFailures>=1`: "the tool refused every time" vs "the model produced the same response". One pardon if `run.justSubstituted`. |
| 2 | **same-tool-call guard / `callLog`** (3462–3481) | `tool + JSON.stringify(args)` → stored answer. For `MUTATING_REPEAT` (`write_file`,`edit_file`,`append_file`) triggers on **ARGS alone**; every other tool additionally requires an identical answer | **whole run, never pruned**; threshold **1** (fires on the 2nd occurrence) | **ADVISORY ONLY.** Appends "⚠️ You already ran this exact …"; increments `repeatCalls`, and `repeatFailures` iff the answer matches `/^ERROR/`. Never stops anything. |
| 3 | **mechanical loop break / substitution** (3643–3680) | `tool\|args\|rawAnswer.slice(0,800)` | last **40** sigs; threshold **1**; only `ORIENT` = {`list_dir`,`outline_file`,`search_file`,`list_assets`,`task_list`}; capped at **2** per run | **REPLACES** the tool result with a goal-named file's numbered contents; sets `justSubstituted` (buys a pardon from #1). |
| 4 | **budget** (151–160; checked at loop head 2946 and after 3771) | `modelCalls >= run.maxSteps` (**30** in these runs; `AGENT_MAX_STEPS` default 250), wall clock `MAX_MINUTES`, optional token budget | — | STOPS the run. |
| 5 | **parseLog** (3084–3090) | parse success/failure of the reply | last 10; **≥5** failures | STOPS ("Gave up"). |
| 6 | **`sameErr`** (3716–3722) | digit-stripped `[JS ERROR]` signature from `test_web` | **≥4** consecutive | STOPS ("Same error persisted"). |
| 7 | edit_file-internal refusals (≈620–830) | `find===replace`, `out===content`, dropped/duplicated definitions, ambiguous FIND | per call | Refuse/advise. Not run-level, but these **produce the refusals** detectors 1–2 then count. |

**Only #1, #4, #5, #6 can end a run.** #2, the one detector that actually keys on arguments and therefore sees
mutating loops, is advisory.

### Structural blindness, per detector

- **#1** is blind to any repetition with a successful write between the repeats (see §3 — this is the big one);
  and it keys on the reply *before* that turn's tool call, so it judges intent, not effect.
- **#2** is exact-match on serialized args: one changed character makes a new key. Never pruned, so it also
  flags legitimate revisits arbitrarily far apart (§4).
- **#3** excludes `read_file` deliberately and everything outside `ORIENT`; capped at 2.
- **#6** is `test_web`-only — no equivalent exists for a repeating `run_python` / `run_command` failure.

---

## 3. (B) Known blind shapes — confirmed, corrected, extended

### Repeats of calls that SUCCEED — CONFIRMED, and it is the dominant defect

`landed` increments on every successful write, so the pair `(reply, landed)` can never repeat while writes are
landing. `seenTimes` is therefore pinned at 1 and **the only detector that can stop a run is switched off for the
whole class of loops made of succeeding writes.** Mechanism verified directly in the persisted run state:

```
17cc6854  recent   = 8 × "424:148w5zk"       (eight byte-identical replies in an 8-slot window)
          recentAt = [19,20,21,22,23,24,25,26]
          max identical REPLY = 8   max identical (REPLY,landed) PAIR = 1   (guard needs ≥3 on the PAIR)
          most-repeated CALL: ×23  append_file s8_grades.py (same 284-byte body)
a3a58e96  recent   = 8 × "333:jai23o" ; recentAt = [21..28] ; pair max = 1 ; ×20 identical append_file
```

Both ran to the 30-call budget. `repeatCalls` reached **23** and **25** — detector #2 saw all of it and could
only append a sentence. This is the "fix the deciding path, not the advisory one" pattern in its purest form:
**the evidence was in `run.repeatCalls` and the deciding guard never consulted it.**

### A-B-A oscillating edits — CONFIRMED

`4adb170b` (32B, trial35-8XrYOc), `s5_expr.js`, calls 8–21: `edit_file` → 28 lines (+3) → 25 lines (−3) → 28 (+3)
→ 25 (−3) → 28 (+3) → 25 (−3) → 28 (+3). Six full oscillations. Detector #2 fired (`repeatCalls=5`, notices
visible at calls 18/19/21); detector #1 never could — every edit succeeded, so `landed` moved every step
(`recentAt = [14,15,16,16,16,17,17,18]`, pair max = 1). Died at budget having thrashed the file.
`distinctCalls/tools` for the 32B budget deaths: **17/30, 19/29, 20/30, 22/30** — a third to nearly half of every
call was an exact repeat.

### Appends whose byte count changes so answers never match — PREMISE IS HALF-WRONG, correct it

`append_file` is in `MUTATING_REPEAT`, so detector #2 keys on **arguments, not the answer**. The changing
"…(now N bytes)" answer does **not** defeat it — `17cc6854` proves the opposite, catching all 23. The blindness
is not in detection, it is in **action**: caught 23 times, stopped never. (The genuine append blind spot recorded
in memory — `append-file-escapes-the-duplicate-guard` — is about `beforeSrc`/destructive-write, a different
guard, and is not what this shape reduces to here.)

### New shape, not on the list

**Verification idling.** A run repeating a *succeeding* read-only or verification call — `verify_project` at ✅,
`run_command` at `EXIT: 0`, `outline_file`, `recall` — is killed by detector #1 with the "same response" wording
even though no tool refused and `repeatFailures` is 0. 13/39 setH-fix and 2/7 setJ loop deaths are this shape.
`verify_project` and `recall` are also outside `ORIENT`, so the mechanical substitution (#3) that exists precisely
to break this cycle never fires for them.

---

## 4. (C) False positives — quantified

**Advisory notices fire overwhelmingly on calls that SUCCEEDED:**

| arm | repeat notices | on `ERROR` | on success | share on success |
|---|---|---|---|---|
| setJ 14B | 36 | 3 | 33 | **92%** |
| setH-fix 14B | 198 | 12 | 186 | **94%** |
| trial35 30B | 15 | 0 | 15 | 100% |
| trial35 32B | 22 | 7 | 15 | 68% |

By tool, setH-fix: `edit_file/OK` 121, `append_file/OK` 19, `outline_file/OK` 16, `run_command/OK` 11,
`search_file/OK` 8, `run_python/OK` 6, `read_file/OK` 4, `recall/OK` 1.

So yes — **re-reading a file, re-running a test while fixing it, and appending different content to one path all
get flagged**, and because `callLog` is never pruned the flag persists for the entire run (a legitimate re-read 25
steps later is still "you already ran this"). Note `edit_file/OK` 121 is mostly `NO CHANGE:` responses, which are
refusals wearing a non-`ERROR` prefix.

**Can a legitimate workflow be killed?** Only via detector #1, and the measured rate is:

- setJ: **2 of 7** loop-guard deaths fired while the last 3 tool calls all succeeded.
- setH-fix: **13 of 39** (33%).
- trial35 30B: 0; 32B: 0 of 1.

Of the 13 setH-fix cases, **1 scored `good=true`**. So the quantified cost of this false-positive class is on the
order of **~1 goal in 39** — real, but an order of magnitude smaller than the blind-spot cost in §3.

---

## 5. (E) Misrecording — a real bug, in the product path

**The end-of-run repair masks the guard's verdict.** `escalate()`'s classifier (3928–3935) takes the **last**
error step: `[...run.steps].reverse().find(s => s.type === 'error')`. But the end-of-run repair runs earlier in
the same `finally` block and pushes its own error steps ("*X does not parse and no version this run produced
parses either…*"). Those land **after** the guard's message, so they become the classification source.

Measured:

| arm | runs | misclassified by last-error |
|---|---|---|
| setH-fix | 51 | **38 (75%)** |
| setJ 14B | 16 | 4 |

setH-fix, true tally by any-guard: `loop` 32, `tool_loop` 7, `budget` 5, clean 6, interrupted 1.
Collapsed by last-error: `REPAIRMSG` 36, `loop` 5, `tool_loop` 1, `other` 4, clean 5. Concretely
`04188d70 loop→REPAIRMSG`, `1f5b74f0 budget→REPAIRMSG`, `24f72c20 tool_loop→REPAIRMSG`, and 35 more.

**This is not cosmetic.** `reason` feeds `repairGoalFor()` (4106–4110), so a looping run is handed
*"it errored"* instead of *"it repeated itself and got stuck"* or *"the tool kept returning the identical answer,
so nothing it tried had any effect — the tool was the problem, not the plan"*. Every masked run also enters
ESCALATIONS.md and `failQueueItem` under the wrong cause.

**The analysis path is NOT affected** — `tools/compare-setJ.mjs::endings()` joins **all** error texts before
matching, so its published loop counts are right. Worth stating plainly because it inverts the usual pattern in
the notes: here the *measurement* is correct and the *deciding* path is wrong. (Two lesser quirks in the same
function: `/step budget/` is tested before the loop patterns on the joined text, so a run that looped and then
hit budget counts as budget; and `clean` requires zero error steps, so a `done` run containing any transient
error step is bucketed `other`.)

**Second misrecording — `NO CHANGE` is not counted as a failure.** `repeatFailures` increments only on
`/^ERROR/` (3478), but the single most common refusal in this data is `NO CHANGE: your REPLACE is identical…`,
which does not match. Result: the honest "the tool refused every time" wording is unreachable exactly when it is
true. Measured loop-guard deaths whose repeats were `NO CHANGE` refusals with `repeatFailures == 0`, reported as
the generic "the model produced the same response": **setJ 2/7, setH-fix 10/39.** Those 12 runs then get the
wrong repair goal on top of the masking above.

---

## 6. (D) The step budget

| arm | budget deaths | scored |
|---|---|---|
| setJ 14B | 1/16 (`17cc6854`) | 0 |
| setH-fix 14B | 5/51 | **0/5** |
| trial35 30B | 2/18 | — |
| trial35 32B | 4/18 (+1 `running`) | — |

**Were they progressing when killed?** By the naive metric, spectacularly: 27–29 successful writes, last 3 calls
all `OK`. By content, no — they are §3's blind-spot loops. `17cc6854`: 23 identical 284-byte appends, file
541 → 8973 bytes. `a3a58e96`: 20 identical appends. `aa2d8cd2`, `91231920`, `da7271a7`, `1f5b74f0`: `repeatCalls`
26, 24, 26, 27 respectively. The one genuine mixed case is `c75eab5e` (30B): 26 distinct calls of 30, real
debugging — that one plausibly deserved more budget.

**This means budget deaths are not an independent failure mode for the 14B — they are the loop guard's blind spot
wearing a different label.** Any analysis that treats "budget" as "needed a bigger budget" will draw the wrong
conclusion for 6 of the 7 14B/32B cases inspected: what they needed was to be **stopped sooner**.

One factual correction to the pre-registration: setJ's README states exhaustion is "0/20 … (14B)" on goals 1–20.
On the 16 completed goals the 14B hit the step budget **once** (`17cc6854`, goal 8). Minor, but the README's
argument for keeping `AGENT_MAX_STEPS=30` cites that zero.

---

## 7. What I would actually change (ranked by evidence, not by appeal)

1. **Make the deciding guard consult `repeatCalls`.** The blind spot in §3 is one condition: a run with
   N identical mutating calls (N≈5) should stop regardless of `landed`. Evidence: 6 runs × ~20 wasted GPU calls,
   plus file corruption, plus 0 score. This is the only change here with a measured cost to justify it.
2. **Fix the masking** — classify from the last error step carrying a *guard* signature, not the last error step.
   One line; fixes 75% of setH-fix repair-goal selection. (Mirrors `fix-the-deciding-path-not-the-advisory-one`.)
3. **Count `NO CHANGE` as a refusal** in `repeatFailures` (12 runs mis-worded).
4. **Do not** invest further in making loop detection fire *better or sooner* for score. §1c.

---

## 8. Comparison with `06-loop-detection.md`

`audit/06-loop-detection.md` **did not exist** at the time of this audit, nor at the time of writing this
section. The audit directory contained only `02-harness.md`, `03-parser.md`, `04-edit-tools.md`, `05-guards.md`.

No AGREE / CONTRADICT / MISSED tally can be produced against a report that is not present. The findings above
stand as a primary analysis; if `06` is written later, this file should be diffed against it — the highest-value
checks are §1a (the score split, which I contradict against the task premise), §3 (the `landed` blind spot and
its mechanism), and §5 (the masking rate of 38/51).
