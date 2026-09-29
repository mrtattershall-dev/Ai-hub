---
name: setg-survivors-load-time-throws
description: 2026-09-22 Set G coder30b recovery — all 6 regressions are 3 files whose module-level self-tests THROW AT require(); every hub guard ran; the parse-only rollback restored throwing versions; route completeness was NOT the missing thing
metadata: 
  node_type: memory
  type: project
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-22T10:38:20.290Z
---

Set G coder30b recovery (2026-09-22): **ESTABLISHED.** A clean uncontended run (real
NODE_EXIT=0) reproduced the recorded line byte-for-byte (`78 run | 33 when written | 29 at end |
REGRESSED 6`), and agreed with an earlier diagnostic run on all 78 per-goal rows and all six
identities — goals **1, 10, 13, 15, 33, 43**. The MECHANISM below is established independently,
from the original run files and a per-commit `require()` bisect of the 444-commit workspace
bundle. Clean-run artifacts: `legasus/screen/ROUTE-COMPLETENESS_setG-clean-rows.{txt,json}`.

    6 regressions = 3 destruction events, all the same class:
      s3_matrix.js  goal 63 breaks load; goal 73 fixes it (EXIT 0), then re-breaks it with a
                    module-level test line `[x].transpose()` (line 464)   -> goals 13, 33, 43
      s1_library.js goal 21 ("fix variable naming in the test code") -> unloadable, never recovers
                    -> goal 1, and goal 10 by cascade (s10 requires s1)
      s5_expr.js    goal 25 breaks, goal 35 restores, goal 45 re-breaks, never recovers -> goal 15

Every goal text says "Include asserts that all pass, then run it with node", so every file has
top-level self-tests that run at `require()`. A later goal in the same file introduces a syntax
error, changes behaviour so an OLD test throws, or adds a NEW broken test - and the module
becomes unloadable for every consumer at once.

**In goal 73 every hub mechanism executed and the file was still left broken:**
`run_command` reported EXIT 1 with the exact line; the lostDefs guard REFUSED a destructive
rewrite (step 36); the end-of-run rollback ran. Its criterion is `quickCheck(f)` = PARSES, so
it restored the newest committed version that parses - which throws at require. **Parse was the
wrong bar.** All six methods were present in the final file.

All four breaking runs (21, 45, 63, 73) show the same shape: tool-run EXIT 1 (up to 5x per
run), parse-rollback in three of them, goal 21's finish gate refusing ("Project does not run
(node) - not finished"), and every one ending on "ran out of step budget (30 model calls)".
Detection at up to three layers; action at none. lostDefs never fired in 21/45/63 because
nothing was lost by name - which the mechanism predicts.

**Why:** the recovery was run to test B-RC route completeness. Answer for Set G: NOT the missing
thing. The guard was on the route. The seven `git_undo` calls through the unguarded approval
path caused none of it (no load-state flip coincides with an undo). What is missing is (1) a
detector whose bar is "the module still loads", and (2) a MECHANISM, not a sentence, attached
to the tool run's EXIT 1 (see [[advisory-vs-mechanical-recovery]], [[hub-detects-but-does-not-act]]).

**How to apply:**
- Any preservation/rollback check on a module must include "it still `require()`s", not just
  "it parses". Set G's three files all parse at their final commit.
- Regress-style own-end-vs-final comparison cannot see break/restore/re-break; the per-commit
  load bisect can, and it is cheap (git show + node -e require, ~seconds per file).
- Count destruction EVENTS (files), not regressed goals ([[goal-coupling-wrong-denominator]]).
- Trial scorer `FN-MISSING(...)` can be prose parentheses in the goal text
  ([[mutant-escaped-means-check-the-expectation]]).

Record: legasus/screen/ROUTE-COMPLETENESS_STEP2.md. Related: [[fix-the-deciding-path-not-the-advisory-one]].
