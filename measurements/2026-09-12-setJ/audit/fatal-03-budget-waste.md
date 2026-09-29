# fatal-03 — where the 30 calls actually go

READ-ONLY audit. Corpus: 190 runs / 2,419 model calls across six arms
(setJ 14B/MoE/dense, setI dense, setH 30B-fix and 14B-fix). 35 of those runs died on the
30-call budget; they are the 1,028 calls this report dissects.

Served binary confirmed: `git show 3d7a080:server/agent.js` hashes to md5 `d53b1f230cb0`, which is
the digest each set-J arm log records. The `ai-coding-hub-indent` working tree is two commits
past that (`141b634`, `a2858e2`), so every code claim below is quoted from the extracted
`3d7a080` blob, not from the current file.

---

## TL;DR

**One call in three inside a dying run is the model re-sending a call the hub already answered —
and the hub says OK and does it again.** 315 of 1,028 calls (30.6%). The hub detects every one of
them (`run.repeatCalls` is incremented, a warning is stapled to the answer) and acts on none.

**The 30-call budget is not the constraint.** Dying runs spend a mean of **10.9 calls on new work**
out of 30. Runs that *finish* use a mean of **10.0 calls total**. All 35 dying runs would fit
inside a **20-call** budget if their waste were removed; 31 of 35 would fit inside 15.

**The decisive asymmetry:** when the hub answers a repeated call OK, the pileup reaches **28**.
When it refuses, the pileup has **never once exceeded 6** — across 64 refused groups in the entire
corpus. Refusal is already the working brake; it is simply not wired to the write path.

---

## B. THE RANKED WASTE TABLE — the deliverable

All 1,028 model calls in the 35 budget-death runs. "Waste" = the call bought no information the
run did not already have.

| # | category | calls | % of budget-death calls | who pays |
|---|---|---|---|---|
| **1** | **Repeated identical call, hub answered OK and re-executed it** | **315** | **30.6%** | 14B catastrophically, dense/MoE mildly |
| **2** | **Re-read of a file THIS RUN had already written** | **168** | **16.3%** | 30B almost exclusively |
| 3 | Re-read of a file already read (new line range) | 78 | 7.6% | 30B |
| 4 | Repeated identical call, hub refused | 23 | 2.2% | all |
| 5 | `find_miss` — FIND snippet not found | 22 | 2.1% | dense |
| 6 | destructive/duplicate-definition guard refusal | 12 | 1.2% | MoE, dense |
| 7 | `file not found` | 9 | 0.9% | 30B |
| 8 | `NO CHANGE` (REPLACE identical to target) | 8 | 0.8% | dense/I32 |
| 9 | other errors | 6 | 0.6% | — |
| 10 | ambiguous FIND | 3 | 0.3% | — |
| 11 | recovery: `git_undo` | 3 | 0.3% | 30B |
| | **TOTAL WASTED** | **644** | **62.6%** | |
| — | productive: write landed | 188 | 18.3% | |
| — | productive: test/command ran | 110 | 10.7% | |
| — | productive: first look at a file | 75 | 7.3% | |
| — | productive: `task_done` | 8 | 0.8% | |
| | **TOTAL PRODUCTIVE** | **381** | **37.1%** | |

Categories 1 + 4 are the same defect seen from two sides: an identical call the hub already
answered. Together **338 calls, 32.9%**. Categories 2 + 3 are the same defect for reads:
**246 calls, 23.9%**.

**Per arm** (identical-call repeats as a share of that arm's total calls, all runs not just deaths):

| arm | total calls | identical repeats | rate |
|---|---|---|---|
| H14 (14B, setH-fix) | 520 | 223 | **42.9%** |
| J14 (14B, setJ) | 138 | 42 | **30.4%** |
| I32 (dense, setI) | 265 | 70 | 26.4% |
| J32 (dense, setJ) | 217 | 47 | 21.7% |
| H30 (MoE, setH-fix) | 1,063 | 165 | 15.5% |
| J30 (MoE, setJ) | 216 | 25 | **11.6%** |
| **all** | **2,419** | **572** | **23.6%** |

---

## A. CALL-BY-CALL, EVERY RUN THAT DIED ON THE BUDGET

`repeatOK` = identical call the hub accepted · `reread` = re-read of a file already read ·
`refusal` = hub said no · `newWork` = first read, landed write, test run, or task_done.
`good` = the goal actually scored.

| arm | run | repeatOK | reread | refusal | **newWork /30** | good |
|---|---|---|---|---|---|---|
| H14 | 1f5b74f0 | **27** | 0 | 1 | **2** | no |
| H14 | aa2d8cd2 | **26** | 0 | 1 | **3** | no |
| H14 | da7271a7 | **26** | 1 | 0 | **3** | no |
| H14 | 91231920 | **25** | 0 | 0 | **5** | no |
| H14 | a3a58e96 | **25** | 0 | 0 | **5** | no |
| J14 | 17cc6854 | **24** | 0 | 0 | **6** | no |
| H30 | b472e3d1 | 14 | 2 | 0 | 13 | yes |
| J32 | 4adb170b | 11 | 0 | 1 | 16 | no |
| H30 | 5bfddda6 | 9 | 10 | 2 | 9 | no |
| H30 | cbca693a | 9 | 4 | 1 | 15 | yes |
| J32 | ba1cc927 | 8 | 6 | 6 | 10 | no |
| H30 | 1ba6e1db | 8 | 3 | 4 | 13 | yes |
| J32 | 153f5c99 | 7 | 4 | 5 | 11 | yes |
| H30 | 11bdb6be | 7 | 12 | 0 | 11 | no |
| H30 | 8ab14e33 | 7 | 6 | 0 | 14 | no |
| J30 | 66fb8638 | 6 | 8 | 0 | 16 | yes |
| J32 | ee180f39 | 6 | 1 | 1 | 17 | no |
| I32 | d841ad44 | 6 | 1 | 3 | 14 | yes |
| H30 | 103bbf2f | 6 | 11 | 0 | 13 | no |
| H30 | 460c3a73 | 6 | 7 | 2 | 13 | no |
| H30 | 74a0b4d0 | 6 | 8 | 2 | 14 | no |
| H30 | 93296505 | 6 | **17** | 5 | **2** | no |
| H30 | fcde48b3 | 6 | 7 | 1 | 12 | no |
| H30 | a258480e | 5 | **15** | 1 | 8 | yes |
| H30 | 65e42fec | 4 | **16** | 0 | 9 | yes |
| H30 | 89e8add0 | 4 | 9 | 2 | 15 | no |
| J30 | c75eab5e | 3 | 7 | 4 | 15 | no |
| H30 | 064124ea | 3 | 10 | 3 | 12 | yes |
| H30 | 2b984077 | 3 | 11 | 2 | 13 | no |
| H30 | a815c21d | 3 | **15** | 0 | 11 | no |
| H30 | fc8e64f9 | 3 | **16** | 3 | 8 | yes |
| I32 | de950b2d | 2 | 3 | 2 | 17 | no |
| H30 | 4cf74595 | 2 | 13 | 2 | 12 | no |
| H30 | 5c1908cc | 1 | **15** | 2 | 11 | no |
| H30 | 5c855c29 | 1 | 8 | 4 | 16 | no |
| | **sum** | **315** | **246** | **60** | **384** | 10 good / 25 lost |

Two distinct death shapes:

- **Write-repeat death** (top six rows, all 14B): 24–27 of 30 calls are one identical write.
  `newWork` is 2–6. **0 of 6 scored.**
- **Read-churn death** (the 30B block): 8–17 calls re-reading a file the run itself just wrote.
  `newWork` 8–16. These runs are working, just expensively — 7 of 21 still scored.

There are almost no calls lost to hub *refusals*: 60 of 1,028 (5.8%), and only 3 `git_undo`
recoveries in the whole corpus. **The hub is not burning the budget by saying no. It is burning it
by saying yes.**

---

## C. THE BIGGEST CATEGORY, TRACED END TO END

Run `1f5b74f0` (setH 14B, goal 21). Goal: *add `returnBook(isbn, member)` and `loans(member)` to
the existing `Library` in `s1_library.js`.* 30 calls, 2 of new work, goal lost.

```
call 1  outline_file s1_library.js   -> 26 lines, 1 declaration
call 2  edit_file FIND "}"           -> ERROR: matches 7 places, ambiguous.
                                        "Either add OCCURRENCE: <n> ... or use LINES: <a>-<b>"
call 3  edit_file LINES 15-15        -> OK: edited lines 15-15 (1 replaced by 3);
                                        replaced "}"; now 28 lines (+2)
call 4  edit_file LINES 15-15        -> OK ... replaced "loans(member) {"; now 30 lines (+2)
                                        + WARNING "You already ran this exact edit_file"
calls 5-30  the byte-identical call, 26 more times
                                     -> OK every time; +2 lines every time; 82 lines at the end
        [error] Stopped: ran out of step budget (30 model calls).
```

The model took the hub's own advice at call 2 — *use `LINES: <a>-<b>`* — and the hub then executed
that advice 28 times. Each pass replaced line 15 with a 3-line block whose **first** line is
`loans(member) {`, so line 15 afterwards reads `loans(member) {` again and the call is perfectly
self-perpetuating. The file grew 26 → 82 lines of interleaved orphan `}` and `return` fragments and
stopped parsing (`s1_library.js:THROWS`).

**Why nothing stopped it.** Three guards were in range and all three abstained:

1. **The duplicate-definition guard** (`3595`) counts *declarations* before and after. The block
   re-inserts the same single `loans` header it just consumed, so `defCounts` reads 1 → 1. The
   corruption never changes a definition count, so the guard is structurally blind to it.
2. **The loop guard** (`3043`) is
   `run.recent.filter((r, i) => r === norm && run.recentAt[i] === landed).length >= 3`,
   where `landed` is the count of writes that have returned OK. Every repeat here *lands*, so
   `landed` increments on every step and no remembered reply can ever match the current one.
   **The guard disarms itself precisely because the corrupting call succeeds.**
3. **The repeat detector fires correctly and does nothing.** At `3474`
   `run.repeatCalls = (run.repeatCalls || 0) + 1` — it reached 27 — and at `3479` the hub appends
   the sentence *"You already ran this exact edit_file in this run"* to a result it has already
   executed. Grepping the served file: `repeatCalls` appears exactly four times — one comment, one
   increment, and twice interpolated into a message string. **It is never compared to anything.**
   The only mechanical stop, at `3067`, requires `run.repeatFailures >= 1` — repeats that the tool
   *refused*. A repeat that succeeds cannot ever reach it.

**What the hub could have answered instead.** At call 4 — the first byte-identical repeat of a
mutating call — it should have refused and not written:

> ERROR: you already sent this exact `edit_file` and it landed (lines 15-15, +2 lines).
> `s1_library.js` is UNCHANGED — nothing was written. Re-applying it would insert a second copy
> beside the first. Lines 13-19 now read: `<the seven lines>`. If `loans` is already there, move
> on; if it is wrong, address it with `LINES: 15-17`.

That is one sentence more than the warning the hub already composes, on the same code path, with
the same data in hand — the difference is that it returns before writing.

**The evidence that refusal is the right brake, measured across all 190 runs.** Group every
identical `(tool, args)` call and split by what the hub answered the *first repeat*:

| hub's answer to the first repeat | groups | calls | mean len | **max len** | groups ≥10 |
|---|---|---|---|---|---|
| **accepted (OK)** | 198 | 669 | 3.38 | **28** | **6** |
| **refused (ERROR / NO CHANGE)** | 64 | 165 | 2.58 | **6** | **0** |

Every one of the six ≥10 pileups in the corpus is an accepted write, and every one of those six
runs died on the budget. **No refused group has ever exceeded 6 calls.** Refusal does not merely
save calls — it caps the blast radius at a value already demonstrated 64 times.

Sizing: accepted-repeat groups burned **471 calls beyond their first**. The six extreme groups
alone burned 144 of them; capped at the refused-group ceiling they would burn ~30 — **~114 calls
returned to six runs whose `newWork` was 2–6**.

---

## D. IS THE 30-CALL BUDGET THE PROBLEM? No.

| population | n | mean calls | median | mean new-work calls |
|---|---|---|---|---|
| finished (`done`) | 85 | **10.0** | 8 | 7.5 |
| stopped short (< 30) | 56 | 9.3 | 8 | 4.4 |
| **died on budget** | **35** | 30.0 | 30 | **10.9** |

A finisher spends **10 calls total**. A budget-death run does **10.9 calls of new work** — slightly
*more* real work than a finisher does in its entire life — and then burns 19 more on repetition and
re-reading. **All 35 dying runs would fit inside a 20-call budget** with the waste removed; 31 of 35
would fit inside 15. Raising the ceiling to 40 would hand the 14B runs 10 more calls to append the
same method a 37th time.

**One arm-specific caveat, and it is the one the mission asked about.** The MoE's two set-J budget
deaths are the *least* wasteful runs in the entire corpus: `c75eab5e` (newWork 15, repeatOK 3) and
`66fb8638` (newWork 16, repeatOK 6). Both were genuinely working — writing debug harnesses, running
node, narrowing a unary-minus bug — and simply ran out of room; `66fb8638` scored `good` anyway.
So the honest split is:

- For the **14B and dense** arms the budget is nowhere near binding; waste is.
- For the **MoE** the budget is close to binding, because it wastes so little. Its 2 deaths versus
  its baseline's 0 are the cost of doing more real work per goal, not of a new defect.
  **Do not fix the MoE's budget deaths by cutting waste it does not have.**

---

## E. SINGLE-TOOL-SINGLE-FILE PILEUPS, AND WHAT THE HUB SAID EACH TIME

Every pileup ≥ 8 calls on one (tool, file). `17cc6854`'s 26 appends are not unique — they are the
sixth-largest instance of the same defect.

| arm | run | pileup | what the hub answered | died on budget |
|---|---|---|---|---|
| H14 | 1f5b74f0 | **29× edit_file** s1_library.js | 27× `OK` + repeat-warning, 1× ambiguous-FIND, 1× `OK` | yes |
| H14 | da7271a7 | **28× edit_file** s4_markdown.py | 26× `OK` + warning, 2× `OK` | yes |
| H14 | aa2d8cd2 | **27× edit_file** s9_board.js | 26× `OK` + warning, 1× `OK` | yes |
| J14 | 17cc6854 | **26× append_file** s8_grades.py | 22× `OK` + warning, 4× `OK` | yes |
| H14 | 91231920 | **26× edit_file** s9_board.js | 24× `OK` + warning, 2× `OK` | yes |
| H14 | a3a58e96 | **20× append_file** s8_grades.py | 19× `OK` + warning, 1× `OK` | yes |
| J32 | ee180f39 | 18× edit_file s8_grades.py | 13× `OK`, 2× NO CHANGE, 2× DUPLICATED-refusal, 1× find_miss | yes |
| H30 | 93296505 | **18× read_file** s3_matrix.js | 18 distinct line ranges of the same file, 2 with warning | yes |
| J32 | 4adb170b | 17× edit_file s5_expr.js | 14× `OK` (11 "matched ignoring indentation"), 3× find_miss | yes |
| I32 | 33adc835 | 17× edit_file s8_grades.py | 14× `OK`, 3× NO CHANGE | no (26) |
| H30 | a258480e | 16× read_file s3_matrix.js | 16 distinct ranges | yes |
| I32 | de950b2d | 15× edit_file s3_matrix.js | 11× `OK`, 2× find_miss, 2× LINES-out-of-range | yes |
| I32 | d841ad44 | 13× edit_file s2_logs.py | 6× `OK`, 5× NO CHANGE, 2× find_miss | yes |
| H30 | fc8e64f9 | 13× read_file s6_graph.py | 13 distinct ranges | yes |
| J32 | ba1cc927 | 12× edit_file s8_grades.py | 6× `OK`, 3× find_miss, 2× NO CHANGE, 1× DUPLICATED | yes |
| H30 | b472e3d1 | 12× run_command | 5× identical `EXIT: 0` + warning | yes |
| H14 | ac9bc89f | 8× edit_file s1_library.js | **6× DUPLICATED-refusal** → run stopped at **call 11** | **no** |
| H14 | cf9a7fb4 | 8× edit_file s5_expr.js | **4× NO CHANGE, 3× find_miss** → stopped at **call 13** | **no** |

The last two rows are the control. Identical behaviour from the model; the hub **refused**; the
pileup stopped at 6 and the run ended at call 11–13 instead of 30. The run still failed — but it
failed cheaply and **without corrupting the file**, which is the difference between losing one goal
and poisoning a chain.

**The read pileups are a distinct, second-rank defect.** `93296505` spent 18 of 30 calls reading
`s3_matrix.js` at 18 different offsets — 14 of them *after* its own append had changed the file —
because every landed write silently invalidates the line numbers the model is holding. No warning
fires (the ranges differ, so it is not an identical call), and the run ended with `newWork = 2`.

---

## GOALS RECOVERABLE — the ranking that matters

Of 35 budget deaths, **25 lost their goal**.

| lever | runs it touches | goals currently lost | calls returned |
|---|---|---|---|
| **1. Refuse an identical mutating call instead of executing it** | 12 repeat-dominated runs (≥8 accepted repeats) | **9** | ~114 in the 6 worst runs alone; 471 beyond-first calls exist in total |
| **2. Make a write tell the model what the file now looks like** | 12 read-churn runs (≥10 re-reads) | **8** | up to 246 |
| 3. Everything else (all refusals, find_miss, guards, undo) | scattered | ~3 | 60 |

Lever 1 also carries a multiplier lever 3 does not: five of its six extreme runs left a file that
**does not parse**, and set J's own RESULT.md establishes that a non-parsing file fails every goal
in its chain (P(second pass | first failed) = 0.083, a 6.8× penalty). One corrupted
`s1_library.js` sits under 9 of the 103 scored rows in the H14 arm. *(Attribution caveat: three
later H14 runs also wrote that file, so those 9 rows are not solely chargeable to `1f5b74f0` — but
every extreme repeat run does end with a non-parsing artefact of exactly this kind.)*

---

## THE SINGLE CHANGE

**In `agent.js` at line 3479 — where the hub already knows the call is a repeat — return a refusal
for mutating tools instead of stapling a warning onto a write it has already performed.**

The detection is built, correct, and running: `MUTATING_REPEAT` (line 1626) already declares that
`write_file`/`edit_file`/`append_file` repeat on their *arguments, not their answers*, `byArgs` is
already computed at 3471, and the branch at 3472 already fires on exactly the right condition. The
code comment at 1621 even records that in set G `repeatCalls: 25` was "the ONLY thing that ever
reacted to 26 identical corrupting edits" — the observation was written down, and the counter was
left advisory. Every one of the six ≥20 pileups in this corpus ran through that branch and got a
sentence instead of a stop.

This is the project's standing pattern, third instance: *fix the deciding path, not the advisory
one.* The hub currently detects 315 wasted calls per 1,028 and acts on zero of them.

Expected return: **~114 calls into the six runs that had 2–6 calls of real work**, a hard ceiling of
6 on any future pileup (never exceeded in 64 refused groups), and five files that parse instead of
five that do not.

Second, and cheaper than it looks: have a landed write append the resulting region (the
`OK: edited lines 15-17 ... now 82 lines` answer already computes it) so the model does not need a
read_file to learn what it just did. That addresses the 168 calls spent re-reading a file the run
itself wrote — the entire 30B failure mode.

**Do not raise `AGENT_MAX_STEPS`.** Finishers use 10 calls; dying runs already do 10.9 calls of real
work. More budget buys more repetition.
