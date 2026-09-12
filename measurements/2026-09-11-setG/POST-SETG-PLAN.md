# After set G: offline again, then fix everything remaining — multi-agent

tatte: "After run g, offline testing again and then prepare and mitigate (fix) all bugs … Again multi agents on fixing
after run g".

## Step 1 — close the window properly (before any of the below)
Stop both apps via `stopApp.mjs` only (the watchdogs do this on ALL DONE or at 110 min), then an independent
`python -m modal app list --json` to prove nothing is billing, then record in COORD: minutes per GPU, cost, running
total, and the Rule 3 identity lines. Restart the fuzzer.

## Step 2 — score set G and answer the pre-registered predictions
`checks-G.mjs` runs inside `run-setG.sh`, so the numbers arrive with the window. Judge against the committed
pre-registration (9afb8d0): Qwen3-Coder 42+/100 (from 36), base 14B 10+/100 (from 2), statuses expected to look worse
while the work is better. Then `regress-G.mjs` per model for "worked when written" vs "works at the end" — the number
that says whether destruction is actually gone, which is the whole point of this run.

## Step 3 — offline testing again
Full `server/run-offline-suite.sh` (now with the open-bug roll-up and both load-signature retries), then rebuild replay
scenarios from set G's records and replay them against the same hub for free. Set G's transcripts are the new corpus.

## Step 4 — multi-agent fixing of the remaining open list
Each agent gets ONE item, and the same contract that produced the twenty fixes so far: reproduce it against a real hub
FIRST (a failing test, not a reading), then fix, then a mutant per independent half proving the test can see it. No fix
ships unpinned; no test may report green over a documented failure (`KNOWN-OPEN` convention).

Assignments, in damage order (reordered after the repeat audit found corruption, not just waste):

0-A. **`edit_file` does not tell the truth about what it wrote, and repeated edits CORRUPT files. This is first.**
   Verified directly in the kept set G workspaces, not taken on report: `s6_graph.py` 1987 lines with 28
   `def __init__` and 33 `def nodes` in ONE class; `s3_matrix.js` 2374 lines, the largest file in either workspace;
   `s1_library.js` with `returnBook` declared twice. Mechanism: 180 of the 14B's 212 repeated `edit_file` calls
   wrote to disk again, because the success string is invariant of the outcome. The `LINES` path answers
   `OK: edited X lines 67-68 (2 line(s) deleted)` no matter which lines now occupy that range, and a `FIND` whose
   `REPLACE` contains the `FIND` text re-matches on the next call and duplicates the block. The destructive-write
   refusal cannot see any of this, because duplication REMOVES nothing - it is the mirror image of the bug that
   refusal was built for. Fix shape: the answer must encode what changed (new line count, or a hash, or a one-line
   diff summary), and an edit that would leave a DUPLICATE of a definition the file already has must be refused.
   **Bounding the repeat alone is not enough: it saves budget and leaves the corruption.**

Assignments, in damage order:

0. **An identical back-to-back call that SUCCEEDS is unbounded — found live in set G, and it is mine.** The 14B fired
   the repeated-call notice 142 times across 21 of 29 goals; 113 on `edit_file`; 133 of them repeating the immediately
   previous call verbatim. Median edit 919 chars (not one-line nibbling), 25-28 successful edits per run, and four runs
   died at exactly the 30-call cap with zero tool errors. Cause: `repeatFailures` counts only identical repeats whose
   answer was an ERROR — deliberate, so a repeated successful `read_file` is not called a tool refusal — so the
   *successful* identical repeat gets a sentence forever and nothing bounds it. Attribution and bound are two jobs and
   only the failing case got the bound. Shape to reproduce then fix: a bounded escalation on any identical
   back-to-back call (notice → substitute, which now works → stop), keeping the "tool refused" wording for the ERROR
   case only. **This outranks the step budget: raising the budget would just buy more repeats.**

0b. **The 30B variant of the same root: re-orientation burns the budget.** 73 goals, 38 budget-exhausted, and ALL 38
   stops are "ran out of step budget" — not one guard kill. 209 notices across 57 goals, only 44 verbatim
   back-to-back, spread read_file 70 / run_command 68 / run_python 28 / edit_file 8. So this model re-reads files and
   re-runs the same commands rather than re-editing. 291 successful writes/edits and 66 tool errors say the work is
   landing; it simply runs out of calls. Fix candidates to reproduce: (a) an identical `read_file` should return
   something *different* — a pointer to what it was already given — rather than the same bytes at the cost of a step;
   (b) an identical `run_command`/`run_python` whose output is unchanged should say so and not cost a step; (c) decide
   whether a step should be charged at all for a call that returned a byte-identical answer. Same root as item 0: the
   notice is advisory and nothing escalates.

0c. **Then, and only then, revisit AGENT_MAX_STEPS.** With 0 and 0b fixed, measure how many calls a goal actually needs
   before changing the cap. Raising it first would buy more repeats and hide both bugs.

1. **`detectKind` says 'node' for every workspace** — the hub writes a package.json boundary marker and detectKind
   checks it before `.py`, so a pure-Python goal can never be judged as Python without an entry. Already has a red in
   `finishGateEntry` (3 known-open). Fix the detector, keep the marker.
2. **The end-of-run rollback walks up to 25 commits** and keeps the first version that merely parses — it can silently
   unwind several goals' work on a file, with no commit and no trace. Needs a bound, a record, and a re-commit.
3. **Non-JS/PY files have no destructive-write guard at all** — `defNames`/`exportNames` return empty for `.html`,
   `.json`, `.css`, `.md`, so the refusal that protects `.js`/`.py` does nothing for the files game work lives in.
4. **Forced and `cleanTests>=3` finishes are recorded as clean `done`** in `run-index.jsonl` and the training traces —
   unverified code entering the corpus labelled success. Measurement integrity; also contaminates training data.
5. **`OCCURRENCE: n` indexes a different sequence** than the candidate list the model was shown (exact matcher vs
   tolerant matcher), so the hub edits a different site than the one it previewed, and reports OK.
6. **CRLF**: a multi-line exact FIND never matches a CRLF file, so every such edit silently degrades to the tolerant
   path (which discards indentation), and edits leave mixed line endings that inflate later FIND misses.
7. **`read_file`'s MAP branch** truncates with `.slice(0, 14_000)` after appending its own "read ONLY what you need"
   instruction — the same shape already fixed on the main read path.
8. **Ledger `task_done` resolves by unstable number or unanchored substring** — renumbering on every read/write plus
   eviction means a number can close the neighbour, and a substring can close an already-done carried task, while the
   tool answers `OK: "<title>" done`.
9. **Run files are written non-atomically** — a truncated `<id>.json` is silently skipped by `loadRuns`, so a whole run
   record disappears (steps, history, resume) with no warning. `queue.js` and `taskLedger.js` already do tmp+rename.
10. **Boot-time queue pruning strands chained goals** — only the 50 newest finished items are kept, and `dequeue` gates
    on `after` being present, so a restart mid-chain can leave the tail permanently unrunnable.
11. **Interrupted runs are evictable from memory** — `evictOldRuns` excludes running/awaiting but not `interrupted`, and
    `loadRuns` only runs at boot, so resumable work becomes unresumable in any 100-goal battery.
12. **The two gate defects with no fixture yet**: a failed visual inspection falls through BOTH the visual and the
    runtime gate; and one bare `catch` around verification turns any throw into a silent pass. Reproduction first —
    these are the two I refused to patch on reading alone.

## Standing constraints for all of it
No GPU spend without explicit authorisation quoted in COORD. Never push (tatte's alone). The live hub is restarted only
on tatte's word. Stops only via `stopApp.mjs`. Run one hub-spawning job at a time — CPU contention produced three
phantom test failures in one session, and a flaky suite is a silent failure of its own.

## Added 2026-09-12 during wave 1 (these are MY bugs, not the hub's, and they cost measurement)

13. **The regression rig discards its child's exit status** - measurements/replay/regress.mjs parsed the checker's
    --out file without checking spawnSync, so a checker failure became a bare ENOENT, killed the whole analysis, and
    left a 0-byte .txt. HARDENED (names sha, goal, exit, signal, stderr, keeps the tree). Still TO DO: re-run both
    labels - 55 distinct end states for coder14b-setg and 76 for coder30b-setg, 131 export+check passes - and find out
    which state actually fails. Eliminated already: the goal-order assertion (0 mismatches both labels) and the first
    exported end state (checker exit 0, node_modules and package.json present, res.json written).

14. **Multi-agent launches must use WORKTREE ISOLATION.** Wave 1's two fix agents share one checkout, so branch
    switches carry each other's uncommitted edits. No tool in this build can message a running subagent, so the only
    remedies are reconcile-by-hand or stop-and-lose-work. Every later wave gets its own worktree.

15. **Before trusting any red-first reproduction, prove the code under test RAN.** rollbackBounded reported green over
    four goals because its breaking write was refused by the destructive-write guard, so the end-of-run repair never
    executed. Check each new fixture against the guards that already exist (destructive-write refusal, marker refusal,
    the 3-identical-replies stop, the repeated-call notice, the step budget, the end-of-run reparse) and say which one
    would intercept it. A fixture that cannot reach its target is green forever.
