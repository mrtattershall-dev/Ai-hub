# Fatal-10 — what is actually stopping the MoE, and what is its ceiling

`Qwen3-Coder-30B-A3B-Instruct`, over set J (`coder30b-setj`) and set H (`coder30b-sethfix`, with
`coder30b-sethctl` and set G as controls). Read-only audit. Every number below was recomputed from
`*-checks.json`, `*-rows.json` and the run records; numbers reused from earlier audits are marked.

**Headline: the hub is no longer the constraint. Of the MoE's 61 unscored goals in set H, 2 are
hub-attributable and 46 were never started. A perfect hub scores 41/100 instead of 39/100. A window twice as
long scores about 75/100.**

---

## 0. A records defect that invalidates the obvious method

`runs/coder30b-sethfix/index.jsonl` holds **52 rows for 53 runs**. The missing one is goal 28
(`5ec8046d-d9f4-4ef8-bb7d-1e306f5b2269`, status `interrupted`). Anything keyed on index order is therefore
**off by one from goal 28 onward** — my own first pass mis-attributed goals 28–53 before I caught it.
Everything in this report is keyed by `rows.json` (`n` → `runId`), which is complete and correct.

Set J is aligned (18 rows, 18 index entries); only set H drifts.

---

## A. The five-bucket accounting

Every unscored goal lands in exactly one bucket. Set H first (100 goals), then set J (20 goals).

### Set H — `coder30b-sethfix`, scored 39/100, attempted 53

| bucket | goals | n | evidence |
|---|---|---|---|
| scored | 38 in range + **g69 windfall** | **39** | g69 (`s9` step 7) passes though only 53 goals were issued — a free pass the checker grants on the final workspace. The control gets it too. |
| **(i) never attempted** | 54–100 less g69 | **46** | `-- window closed: 47 goal(s) not started --`; harness exit 0 at 03:34:39 after 86.9 min. |
| **(ii) attempted, code wrong** | 5, 11, 14, 19, 20, 24, 27, 34, 44 | **9** | see below |
| **(iii) attempted, correct, then destroyed** | 4 | **1** | see below |
| **(iv) attempted, own goal met, rejected by the checker** | 29, 39, 49 | **3** | see below |
| **(v) lost to a hub defect** | 28, 46 | **2** | see below |

46 + 9 + 1 + 3 + 2 = **61 = 100 − 39**. ✔

### Set J — `coder30b-setj`, scored 14, 18 of 20 goals reached

| bucket | goals | n | evidence |
|---|---|---|---|
| scored | 1,2,3,6,7,8,9,10,11,12,13,16,17,18 | **14** | |
| **(i) never attempted** | 19, 20 | **2** | `-- window closed: 2 goal(s) not started --`. Cause is recorded in set J's own RESULT: three arms run concurrently, 165–178 s/goal against 116 s solo. |
| **(ii) attempted, code wrong** | 4, 5, 14, 15 | **4** | g4 `one paragraph 'Hello world'`; g5 `"2 3" did not throw`; g14 headings emitted unwrapped; g15 `2*-3` still `Invalid expression` at budget death. |
| (iii) / (iv) / (v) | — | **0** | no destruction, no checker rejection, no fatal hub defect in set J. |

2 + 4 = **6 = 20 − 14**. ✔

### The evidence, bucket by bucket

**(v) g28 — infrastructure, the model became unreachable.** The only clean hub/infra kill in either set.
Twelve of 30 calls in, the record reads: three retries at 15 s, 30 s, 45 s, then
`Run paused at step 12 — the model is unreachable … (Model stream failed before any content: Premature close)`.
The goal (module-level `letter(percent)` in `s8_grades.py`) was never written; the checker's reason is
`no attribute 'letter'`. Cost: 1 goal and 265 s of the window.

**(v) g46 — `append_file` put a class method outside its class, then two guards deadlocked the repair.**
The most instructive failure in the corpus, and the same mechanism as the `append_file` / de-indent findings
already on record. Sequence, verbatim from the run:

1. `append_file s6_graph.py` with `    def topo_order(self):` → `OK: appended 1534 bytes`. Appending puts it
   at end-of-file — **after** `if __name__ == "__main__":` at line 188 — so it is neither a class method nor
   module-level. The file still compiles, so nothing complains.
2. The model notices and tries to move it: `edit_file` → `ERROR: this edit_file would have DUPLICATED 1
   definition(s) … topo_order (1 -> 2)`.
3. It tries to delete the stray copy: `edit_file lines 239-271` → `ERROR: this edit_file would have REMOVED
   1 thing(s) … topo_order`.
4. It escapes with the explicit override (`remove: "topo_order"`) → 33 lines deleted.
5. Budget death at 30 calls, then the harness: `s6_graph.py did not parse at the end of the run — restored
   the version this run committed at ae7fc96` — i.e. **the version with `topo_order` still misplaced**.

Verified on the final workspace: `def topo_order` sits at line 239, inside the `__main__` block;
`hasattr(Graph, 'topo_order')` is **False** and `hasattr(s6_graph, 'topo_order')` is **False**. The model wrote
correct code; the tool placed it where it could never be called, and the two guards blocked the only repair it
attempted. 1 goal.

**(iii) g4 — the one destroyed pass.** Goal 4 finished `verified` in 8 calls with
`python s4_markdown.py` → `All tests passed!`. Set I's checkpoint reconstruction (reused, not re-derived —
the workspace copy here carries no `.git`) scores it `impl=Y` at the goal-20 checkpoint and `impl=n` at goal
100. The final file calls `_escape_html(content)` at line 89 and **never defines it**.

Provenance, which I could not close and which is itself a records gap: `def _escape_html` appears **exactly
once in the entire 53-run archive** — in goal 52's repair attempt, which the hub correctly rejected
(`LINES: 240-270 is outside s4_markdown.py, which has 176 lines`). The *call* is already present in goal 44's
reads. No earlier run's record mentions the string at all, and the records do not truncate
(longest stored args JSON 10,889 chars, zero ellipsis markers — only `index.jsonl` truncates). So the edit
that introduced the call is not recoverable from the records. What *is* established: **no guard refusal, no
tolerant splice and no rollback ever touched `s4_markdown.py`** — the destruction is model-side, not hub-side.

**(iv) g29, g39, g49 — the model met its own goal and the checker failed it on an earlier one.** All three
fail with `card A/B has no .s9-right button`. Their actual goals were counters (g29), a delete button (g39)
and `localStorage` persistence (g49), and the records show each delivered: g29 finished `screen_checked` with
`test_web` reporting `To Do 0 | Doing 0 | Done 0` on screen. The checker's later `s9` scenarios all click
`.s9-right` first, and `grep -c s9-right` on the final `s9_board.js` and `s9_board.html` returns **0** —
because goal 19, the goal that adds those buttons, died. Not a checker bug; a deliberate re-test of an earlier
step. It is scored as three separate losses.

**(ii) the nine wrong-code losses.** Each is confirmed by the model's own output inside its own run, not by
inference: g24 ends with `Got: <p>&lt;strong&gt;bold text&lt;/strong&gt;</p>` — escaping applied after
emphasis; g34's own `test_inline_code.py` prints `Test 1: FAIL`; g44 is still debugging `_process_links`
against a live traceback when the budget ends; g11's own test prints
`Available copies after checkout: 2` where 1 was required; g5 and g20 fail identically in the unpatched
control, so they are not hub-conditional.

**g19 is the one judgement call, and it is worth 4 goals.** Status `stopped` at **11 of 30 calls**:
`Stopped: the model produced the same response 3 times in the last 8 steps without making progress`. All 11
calls are `read_file` on the same two files (31 and 33 lines — it received the whole file each time), and the
hub's advisory repeat notice fired 6 times and changed nothing. I score it **(ii)**: the model looped, the hub
detected it correctly and did not cause it. The alternative reading — that killing a run at 11 of 30 calls
removed the chance of recovery — is priced separately in section C, because through the coupling in (iv) this
single run costs **4 goals** (19, 29, 39, 49).

---

## B. Goal coupling, for the MoE alone

The earlier audit's corpus-wide figures (8 arms, 80 pairs) are **P(second | first passed) = 0.563** and
**P(second | first failed) = 0.083**. Recomputed over the MoE's own four runs (set G, set H control, set H
treatment, set J = 40 project-pairs):

| | second passes | second fails |
|---|---|---|
| **first passed** | 20 | 8 |
| **first failed** | **2** | **10** |

    P(second passes | first passed) = 20/28 = 0.714
    P(second passes | first failed) =  2/12 = 0.167
    penalty ratio 4.3x   (corpus-wide: 6.8x)

Per arm: set G `PP5 PF0 FP0 FF5`; set H ctl `PP4 PF3 FP1 FF2`; set H fix `PP5 PF3 FP1 FF1`; set J
`PP6 PF2 FP0 FF2`.

**The coupling is real for the MoE but materially weaker than the corpus figure.** It is better on the first
pass *and* better at recovery: 0.167 against 0.083. The corpus number is dragged down by the 14B, and using
it to model the MoE overstates the penalty by about 2x.

**How many of its losses are second-pass goals made unwinnable by a first-pass loss?** In set H's attempted
range, **7 of the 15 attempted failures (47%)** are later-step goals in a chain whose earlier step had already
failed:

    chain 4  (s4_markdown.py)  g4 f -> 14 f, 24 f, 34 f, 44 f      4 downstream losses
    chain 9  (s9_board.html)   g19 f -> 29 f, 39 f, 49 f            3 downstream losses

And the counter-evidence that matters just as much — **the MoE recovered in 5 of its 7 broken chains**:

    chain 1  g11 f -> 21 P, 31 P, 41 P, 51 P
    chain 5  g5  f -> 15 P, 25 P, 35 P, 45 P
    chain 7  g27 f -> 37 P, 47 P
    chain 8  g28 f -> 38 P, 48 P
    chain 10 g20 f -> 30 P, 40 P, 50 P

Coupling only becomes fatal when the earlier defect is **structural** — a module that raises on import
(chain 4) or a DOM artifact every later fixture clicks (chain 9). A behavioural miss it simply overwrites.
**Two root defects produced 9 of the 15 attempted failures.**

---

## C. The realistic ceiling, with the arithmetic

Fix every hub-attributable loss in (A)(v), change nothing else:

    set H observed                                    39 / 100
      + g28  model-stream close, no auto-resume        +1
      + g46  append_file placement + guard deadlock    +1
      = hub-perfect ceiling                           41 / 100

    if the g19 loop-guard kill at 11/30 calls is also charged to the hub:
      + g19                                            +1
      + g29, g39, g49 (unwinnable once g19 failed)     +3
      = upper ceiling                                 45 / 100

    set J observed                                    14 / 18 reached
      + nothing in (v)                                 +0
      = hub-perfect ceiling                           14 / 18
      (16 / 20 if the concurrency-truncated window is charged to the harness)

**A perfect hub is worth +2 points, +6 at the most generous reading.** Note what this does *not* buy: it does
not touch the 46 goals never started, and it does not touch the 9 wrong-code losses.

---

## D. The binding constraint once the hub is perfect

**It is wall-clock throughput, by an order of magnitude, and it is the cheapest thing on this list to fix.**

    goals attempted                    53 / 100
    hit rate within the attempted range 38 / 53 = 71.7%
    47 goals never started x 71.7%   ~= +34 goals

    projected score with the window doubled:  ~75 / 100
    projected score with a perfect hub:         41 / 100

    the window is worth ~17x the entire hub-defect block.

The window is time, not budget: 86.9 min for 53 goals (≈98 s/goal) against a 110-min watchdog cap; the
harness closed with 47 goals unstarted. `AGENT_MAX_MINUTES` is 8 per goal and `AGENT_MAX_STEPS` is 30. At the
observed 98 s/goal, the remaining 47 goals need roughly **77 more minutes**. This is a launch parameter, not
an engineering problem.

Hub friction is *not* what consumed the window. Calls whose result was a hub-side dead end:
**48 of 1,051 (4.6%)** in set H and **6 of 216 (2.8%)** in set J — at 4.6 s/call that is about **3.7 minutes**
of an 87-minute window.

Behind throughput, in order:

1. **The 30-call cap.** 22 of 53 runs died on it. The MoE spends whatever it is given — but raising the cap
   costs wall-clock, so it trades directly against constraint #1.
2. **Concentrated model defects.** 9 of 15 attempted failures come from **2 of 10 projects** (`s4_markdown.py`
   5, `s9_board` 4). This is not a broad competence gap; it is two repeated defects — escaping applied after
   inline markup, and a read-loop on the board files.
3. **Self-verification.** `console.assert` cannot fail the process: in set H goals 5, 25 and 52 (set J goal 5)
   a command printed `Assertion failed: …` and still exited 0. The MoE is not badly affected — it usually
   writes a separate runner — but it is the mechanism by which wrong code finishes `verified`.

---

## E. Remaining hub defects, ranked by goals recoverable **for the MoE**

**First, a correction to the brief's premise.** The MoE is *not* write_file-heavy on this workload. Recounted
from the transcripts:

    set H fix : edit_file 141 | write_file 46 | append_file 21 | read_file 385 | run_command 158
    set H ctl : edit_file 143 | write_file 62 | append_file 26
    set J     : edit_file  33 | write_file 23 | append_file  1

The "27 write vs 6 edit" shape does not hold in the 100-goal runs — **`edit_file` is its most-used mutation
tool by 3:1**, and `edit_file` fixes reach it directly (15 FIND-not-found, 5 FIND-arg-missing, 5 NO CHANGE,
11 destructive-write refusals in set H alone).

| # | defect | goals recoverable | evidence |
|---|---|---|---|
| 1 | **Window too short** (not a defect — a launch parameter) | **~34** | 47 never started; 71.7% hit rate in range |
| 2 | **Loop guard kills a read-loop at 11 of 30 calls**, advisory notice ignored 6x first | **up to 4** | g19 → g29, g39, g49 |
| 3 | **`append_file` appends a class method outside its class**, then DUPLICATED + REMOVED refusals deadlock the repair; end-of-run rollback restores the misplaced version | **1** | g46; `hasattr(Graph,'topo_order')` False on a file that compiles |
| 4 | **Model stream premature close, no auto-resume** | **1** | g28, 3 retries then paused at step 12/30 |
| 5 | `run_python` accepts JavaScript, writes and runs `_snippet.py` | 0 | **74 events** in set H, 13 in set J — pure call and time tax |
| 6 | Destructive-write refusal fires on the model's own helpers | 0 | 11 events set H, 4 in set J g5 (4 of 30 calls in a run that then died on budget) |
| 7 | `FIND` not found (15) / `FIND` arg missing (5) / `NO CHANGE` (5) | 0 | friction only, no fatal goal |
| 8 | **`index.jsonl` drops interrupted runs** (52 rows / 53 runs) | 0 goals, but corrupts analysis | any index-ordered attribution is wrong from g28 on |
| 9 | Stale `does not parse` warnings — `s3_matrix.js does not parse` on 11 consecutive runs | 0 | every workspace file compiles at the end; g43 and g53 both **passed** |

Items 5–7 are the ones twenty fixes have been aimed at. **For this model they are worth zero goals.**

---

## F. Would another GPU run show a detectable difference?

**No. Do not spend a window on it.**

The MoE's score across runs, three of them on 100 identical goals:

    set G      unpatched hub   78 attempted   29 / 100
    set H ctl  unpatched hub   58 attempted   30 / 100     <- 1-point spread, 20 fewer goals attempted
    set H fix  patched hub     53 attempted   39 / 100
    set J      patched+2       18 of 20       14

Score is reproducible to about **±1**; goals-attempted is not (78 → 58 on a byte-identical configuration).
The entire hub-attributable block is **2 points** (39 → 41), or 6 at the most generous reading. Two points is
**inside the measured spread**; six is exactly the margin set J's own pre-registration says the design needs
to resolve, and that was with a fixed goal count — here the denominator itself moves by ±20.

So a rerun testing the (v) fixes is underpowered by construction. The one change worth a GPU window is the
one in section D: **double the wall clock and run a single arm**. A projected +34 is not a margin the rig
could miss, and it would also produce the first MoE measurement whose denominator is the full 100 goals.

---

## What this audit changes

- The MoE's problem is **not** the hub. 2 of 61 unscored goals are hub-attributable; a perfect hub scores 41.
- It is **not** correctness either, in the aggregate: 71.7% of what it reaches, it gets right.
- It is **reach**. 47 of 100 goals were never started, and the fix is a launch flag.
- The coupling penalty is real but **2x weaker for the MoE than the corpus figure** — it recovers from 5 of 7
  broken chains. Coupling is only fatal when the earlier defect is structural.
- Two root defects (`s4_markdown` escaping, the `s9` read-loop) produced 9 of its 15 attempted failures. That
  is where model work pays, not in broad capability.
