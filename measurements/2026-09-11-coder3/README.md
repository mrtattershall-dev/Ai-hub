# Base Qwen3-Coder-30B-A3B on the hub - the same 40 goals (PRE-REGISTRATION)

Written before the model produced anything. tatte, 2026-09-11: "We haven't reran coder3 in the hub
in a while. Let's try that base model first".

    model  Qwen/Qwen3-Coder-30B-A3B-Instruct (bf16, no adapter) on H100, vLLM, served as coder30b
    goals  goals-A/B.json, byte-identical to the 14B-vs-32B head-to-head and the 14B rerun
    hub    main 3eed8b7 (the harness starts its own isolated hubs from main)
    grade  the head-to-head's hand-graded scale: P / CT / NX / RM / INH / F

COMPARISON POINTS (hand-graded, "done exactly as asked" of 40):
    base 14B   22 (head-to-head, hub 725bf46)   21 (rerun, hub 454814a)
    base 32B   27 (head-to-head, hub 725bf46)
    Qwen3-Coder on the OLDER 35-goal set (2026-09-10): work done 34/35, done 32/35 - different goals

CAVEAT: the hub changed since those numbers (finish gate is page-aware and baseline-aware,
b467392; git_undo, ac51e19). That mostly touches the web/game goals (t5, t8, u5, u8), so a small
part of any difference may be the hub, not the model. One pass; run-to-run variance is large.

PREDICTION: at least 32B level, 27+/40 done as asked - a newer coder, and strong on the older set.
Recorded weakness to watch (memory: model-self-verification-gap): Qwen3-Coder writes correct code
and then a self-check that contradicts it - expect CT (correct code, own test wrong) cases.

tools/: run-coder3.sh (harness), watchdog.sh (stopApp.mjs only), compare-coder3.mjs (scorer view).

## Results — hand-verified 2026-09-11 (graded while set C ran)

**Base Qwen3-Coder-30B-A3B: 34/40 done exactly as asked — the best model measured on these 40 goals
(base 14B 22, base 32B 27). Implementation correct 34 (14B 32, 32B 33). Zero "own test wrong":
every self-test it wrote was right.** The scorer said 39/40 work; hand-grading found 5 of those false.

| hand-verified, 40 goals | base 14B | base 32B | **Qwen3-Coder** |
|---|---|---|---|
| **done exactly as asked** | 22 | 27 | **34** |
| correct code, model's own test wrong | 7 | 2 | 0 |
| works, but a stated requirement missed | 1 | 4 | 0 |
| correct, broken only by an earlier goal's file | 2 | 0 | 0 |
| failed | 8 | 7 | 6 |
| **implementation correct** (rows 1-4) | 32 | 33 | **34** |
| scorer "work" (for comparison) | 25 | 35 | 39 |

GPU: deployed 05:56, identity 05:59:44 (pasted in COORD), stopped 06:21:03 by the watchdog through
stopApp.mjs (exit 0; independent re-list: stopped, 0 tasks). ~25 min of H100, ~$1.65.

### The 6 failures

| # | goal | what happened |
|---|---|---|
| A10 | Clear button | Read t5_page.html five times and never wrote anything. Each response was a read plus more actions; only the first ran, and it repeated the same response until the run stopped. |
| A18 | test other files | t11_check.js calls isEven, isOdd and isInRange on t4_intervals.js. None of them exist. It catches the TypeErrors and prints "All tests completed successfully!". Never tests mergeIntervals. |
| A20 | index | Lists all 14 t-files, but invents what four of them do: "standard deviation" (t6), "route registration and navigation" (t7), "checking if a value is a number or string" (t11), "setting and clearing bits" (t12). |
| B13 | pre-release | compare() splits on "." before it looks for "-", so '1.0.0-rc.1' sorts AFTER '1.0.0'. '1.0.0-beta' works. Same check the 14B failed; a narrower bug. |
| B14 | WASD + wrap | Wrote u8_game.html, which loads u8_game.js, and never wrote u8_game.js. test_web reported the 404 four times. The model called it "a limitation of the test environment" and claimed the files existed. After 3 finish-gate blocks the gate stood aside, and the run was recorded **done**. |
| B20 | index | Descriptions invented for 7 of 12 files (u4 "flattens nested arrays", u5 "pagination", u9 "deep copying", u2 "finds anagrams from a list", u11 "validation and sanitization framework", ...). Both .html files missing. |

Everything else is P. Notes on the Ps:
- **A5:** the delete-at-zero rule was already written in A4, so the file was unchanged; the behaviour is right.
- **A8:** T_INTERVALS.md stops mid-sentence, but the answer ("yes, it sorts by start") and the unsorted assert are there.
- **B4:** the asserts were moved into test_cart.js after the file tried to require itself.
- **B5:** git checkpoints show only total() changed.
- **B15:** created the u8_game.js that B14 never wrote. Three obstacles move, and putting the player on one shows "Game Over" (driven in puppeteer, screenshot checked). It clamps at the edges; wrapping was B14's requirement.

### What this says

1. **Its code is right, and its checks of its own code are right.** 0 CT, against the 14B's 7. The
   self-verification gap seen in earlier Qwen3-Coder runs did not appear on these goals.
2. **Its failures are about describing files, not writing them:** three of the six (A18, A20, B20)
   are confident text about files it did not read. It is fluent enough that the prose sounds checked.
3. **One of the six (A10) is caused by the hub's one-action rule, and the hub's forced finish recorded a second (B14) as done.**
   Coder3 put more than one action in **44 of 295 responses (15%, in 15 of 40 runs)**; the base 14B did in
   8 of 263 (3%). The hub runs only the first. In A10 the model repeated the same multi-action response
   until the run stopped. In B14 it never tried to write u8_game.js: its own ls showed only the .html,
   test_web reported the 404 four times, and it still said both files existed. The reads that would
   have shown the file missing were among the discarded actions.

### Hub findings (proposals, not built)

- **A forced finish looks exactly like a clean one.** The whole finish gate is inside
  if ((run.finishBlocks || 0) < 3); from the 4th finish call on, the run is recorded done with no marker.
  The training converter already drops these by counting gate messages; the hub UI and trial35 do not.
  Proposal: mark it (run.forcedFinish = true) and show "finished UNVERIFIED".
- **The one-action-per-response rule cost Qwen3-Coder A10 outright, and in B14 it discarded the reads that would have shown the missing file.** Proposal: run a response's
  actions in order and stop at the first error, returning every result. The alternative is to keep
  discarding and name each dropped action in the result, so the model cannot assume it ran.
- **Index and notes goals invite fabrication.** A cheap check could verify that every function or
  method an index mentions exists in the file it names.

Grading method: tools/gradeAB.mjs (value checks on known inputs, run as-is and with the model's own
asserts neutralised; the first pass gave 24/25 P), ../2026-09-10-14b-rerun/tools/gradeweb.mjs for the
8 web and game goals, a puppeteer drive of B15 into an obstacle, git-checkpoint diffs for A5 and B5,
and every comprehension file read against the source it describes.
