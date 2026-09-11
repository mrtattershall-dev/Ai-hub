# Set D — 100 interleaved goals: does the work survive a LONG run? (pre-registered 2026-09-11)

Written, and the checker validated, BEFORE any model saw these goals.

## Why
tatte, after set C: "After c is done running, run one more with d that has 100 prompts to fully assess".
Set C (40 goals, 8 projects of 5 steps, one project at a time) showed Qwen3-Coder keeping its work: 0
regressions. Set D is longer and harder on memory. The next set, E, follows the hub fixes these runs point to.

## Design
- **10 projects x 10 steps = 100 goals, INTERLEAVED**: goal = (step - 1) * 10 + project, so the run does
  step 1 of every project, then step 2 of every project, and so on. Every file is reopened after nine
  unrelated goals. All 100 run sequentially in ONE workspace (trial35, isolated local hub, same
  harness as sets A-C). File names use the r prefix so trial35's per-goal scorer sees them (checked:
  all 100 goals name a file it recognises).
- Projects: r1 ledger (JS; step 10 = R1_NOTES.md), r2 text statistics (Python; CLI and --json),
  r3 task graph (JS; ordering, cycles, critical path, JSON), r4 geometry (JS; centroid, hull,
  validation), r5 key-value store (Python; nested transactions, expiry, persistence, limits),
  r6 business days (Python), r7 grid paths and Life (Python), r8 money in cents (JS; rounding,
  allocation, currencies), r9 **browser to-do app** (HTML+JS; element ids given in the goals),
  r10 **integration report** (JS; requires r1_ledger.js and r8_money.js, using only features from
  the same round or earlier; step 10 = R_INDEX.md).
- **Hidden checks (tools/checks-D.mjs) run on the FINAL workspace**, so a later goal that breaks an
  earlier one fails the earlier one. Code steps are scored two ways:
  - **done as asked**: loaded as left, own asserts included;
  - **implementation correct**: own asserts neutralised.
  r9 is driven in puppeteer with the hub's launch options, over a local http server: typing, Enter,
  clicks, filters, reload with localStorage. R1_NOTES.md and R_INDEX.md must name every public method
  or export, and must not name anything that exists in no r-file. That is the fabrication seen in
  sets A/B.
- **Regressions (tools/regress-D.mjs):** each goal's end state is rebuilt from the hub's git checkpoints
  (each run file's own checkpoint steps - measurements/replay/runstates.mjs; unknowable states are marked unknown) and run through the same checks. The count is the steps that
  worked when written and fail at the end.

## Validation of the checker (before any run)
- refs/ (hand-written reference solutions): **100/100** both ways.
- empty workspace: **0/100**.
- tools/mutate-D.mjs: **32 planted bugs, 32 caught exactly**; every mutant fails exactly the intended
  goals and no others. They cover all 10 projects, including:
  - a cross-project bug: splitMoney giving the extra cents last also fails r10's evenSplit;
  - notes and an index that invent a function;
  - an index missing a file;
  - web trim, filter and persistence bugs;
  - wrong own asserts in JS and in Python, which score CT on all 10 steps of their project.
- One checker bug was found in validation and fixed before any model ran. In goal 61's setup, f's
  deposit was the last undoable operation, so the check expected the wrong undo. The reference was
  right; the check was reordered.

## Models (GPU: inside tatte's $30 generation cap, ~$6.8 used before this run)
- `coder30b-setd`: Qwen/Qwen3-Coder-30B-A3B-Instruct, bf16, H100, min 0 / max 1, scaledown 120 s.
- `coder14b-setd`: Qwen/Qwen2.5-Coder-14B-Instruct-AWQ, A10G, min 0 / max 1, scaledown 120 s.
- New app names, so set C's watchdogs can never touch these apps.
- Identity (Rule 3): /api/health pasted in COORD before any number counts.
- Caps: no new goal after 87 min from harness start. The watchdog cap is 100 min from deploy start,
  and apps are stopped ONLY via stopApp.mjs (Rule 7a). Worst case ~$6.6 + ~$1.8; expected ~$4.6 + ~$1.4.
- Same hub code as set C (no server/ change in between).

## What will be reported
1. Hidden-check score on the final workspace, both ways, per model and per project.
2. Regressions, and how many goals the hub called "done" that fail their check.
3. Hand review of every fail/CT line against the workspace before the numbers are final.
4. The recurring failure patterns, split into hub bugs and model limits. The hub bugs are then fixed
   (tested, merged) before set E, as tatte asked.

## Predictions (written before running)
- Qwen3-Coder: 75-88/100 implementation correct at the end, 0-4 regressions. Weakest: r9 (web), the
  harder r4 steps (hull, validation), and the two documentation steps. R_INDEX.md is expected to fail
  on invented or missing names, as its indexes did in sets A/B.
- Base 14B: 15-35/100, 5-15 regressions.

## Harness change before the base 14B's re-run (made before that GPU run, 2026-09-11 07:5x)
The first 14B attempt (coder14b-setd) failed as a measurement. At goal 9 it ran "open r9_app.html". That needs
approval, and trial35 never answered approvals, so the parked run held the workspace and goals 10-100 all failed
to start. Details are in COORD.

set D's trial35 now answers approvals the way rungoals.mjs does, and logs every answer: git_commit and git_undo
are approved, anything else is denied. It was proven offline first with tools/preflight-approval.mjs: a mock
model replays the 14B's own goal-9 replies, the "open" is denied, and goal 2 starts. Qwen3-Coder's run was
already in flight on the unpatched copy and has never parked (0 START FAILED), so for it the change is a no-op.
The 14B re-runs as coder14b-setd2.

## Qwen3-Coder continuation from goal 72 (decided before its GPU run, 2026-09-11 08:5x)
Qwen3-Coder's run (coder30b-setd) was in flight on the unpatched trial35. At goal 72 it asked to git_undo, which
needs approval, and goals 73-100 all failed to start. Two more facts constrain the resume:
- The hub had stopped checkpointing after goal 53, because a model-made file named "10 + 20 + 5 = 35, not 45." cannot
  be added by git on Windows, and checkpoint errors are swallowed. So no commit holds goal 72's start state.
- The hub also deletes run files past 40, so only goals 33-72 kept their run records. The traces keep all steps,
  without replies.

The continuation (coder30b-setdc) therefore seeds a fresh workspace from the LIVE parked workspace: 56 files,
with the one unaddable file left out and goal 72's partial edits included. It then runs goals 72-100 with the
patched trial35 (approvals answered; AGENT_MAX_RUNS=1000) on the same hub code.

The final hidden-check score is reported on the continuation's final workspace. Regressions are counted only
across goals whose start and end states exist as checkpoints.

## Results (hidden checks on the final workspaces, 2026-09-11)

**Qwen3-Coder finished set D with 52/100 steps working at the end. The base 14B finished with 5/100.** Neither
model's own asserts ever broke correct code (0 CT). Both runs were hurt by hub and harness bugs this set exposed;
the hub bugs are fixed and proven on the e-fixes branch (below).

| set D, 100 interleaved goals | Qwen3-Coder-30B-A3B | base 14B |
|---|---|---|
| **steps that work at the end** | **52** | **5** |
| per project (of 10) | r1 3, r2 6, r3 7, r4 8, r5 5, r6 3, r7 6, r8 5, r9 4, r10 5 | r2 2, r3 2, r6 1, all others 0 |
| failures: function or method missing | 19 | 52 |
| failures: wrong result | 22 | 11 |
| failures: throws on a valid call / error case not handled | 3 / 4 | 11 / 1 |
| failures: the file does not load | 0 | 20 |

How the runs actually went (see COORD for the ledger):
- **Qwen3-Coder** ran goals 1-72 on the unpatched harness. At goal 72 it asked for git_undo, which needs approval,
  nobody answered, and goals 73-100 failed to start. It was continued from goal 72 (coder30b-setdc), seeded from the
  live parked workspace because checkpoints had died after goal 53. The score is on the continuation's final workspace.
- **Base 14B**: the first attempt parked at goal 9 ("open r9_app.html"). The re-run, with the harness answering
  approvals, ran all 100 goals.

### Regressions - and what could not be known
The hub's own record keeping failed during set D, so regressions can be counted only where an end state survives
(measurements/replay/regress-multi.mjs, which marks everything else unknown rather than guessing):
- **Qwen3-Coder:** end state known for **49 of 100** goals. 32 run files were deleted by the hub (40-file cap), 18
  goals came after checkpointing died, and 1 is the resume boundary. Of the 49, 26 worked when written, and
  **1 regressed: goal 36 (r6 holidays), broken by goal 46's whole-file rewrite.**
- **Git forensics tell the fuller story:** 7 working functions were written and later deleted - r5 delete, r7
  neighbors, and r6 add_days, is_weekend and add_business_days by whole-file rewrites; r3 earliestStart and ready()
  by the hub's end-of-run syntax rollback. Most fall in goals whose records were lost, which is why the regression
  count alone undercounts.
- **Base 14B:** end state known for 1 goal (60 run files deleted, 39 goals after its checkpoints died). Its
  regressions cannot be counted.

### Hub bugs found by set D, fixed on e-fixes (each with a test that fails without it; merged after the full suite)
1. **Approval deadlock.** One approval request in an unattended run parks the run, and every later goal fails to
   start. Fix: AGENT_UNATTENDED=1 denies instead of parking (unattendedApproval 4/4).
2. **Checkpoints died silently.** A model-made file Windows cannot open ("10 + 20 + 5 = 35, not 45.") broke `git add`
   for the rest of Qwen3-Coder's run; a stale .git/index.lock did the same to the 14B's. Fix: add with
   --ignore-errors, clear stale locks, and note any checkpoint failure in the run (checkpointResilience 5/5).
3. **Run files deleted at 40.** evictOldRuns unlinked run files, so the 300-file disk cap never bound. Fix: memory
   only (checkpointResilience).
4. **Whole-file rewrites silently dropped working functions.** Fix: the write result names what was removed
   (defLoss 6/6). Replayed on the real goal 46, it fired and named add_business_days, add_days,
   business_days_between, fmt, is_weekend, parse.
5. **The end-of-run syntax rollback silently deleted new work.** Fix: the note names what it removed, and a
   "Re-add ..." task goes into TASKS.md for the next goal (rollbackCarryover 3/3). Replayed on the real goals 43 and
   93, it named earliestStart and ready and left the tasks.
Also carried from sets A-C: full untrimmed transcripts per run, and forced finishes marked UNVERIFIED.

### Against the predictions
- Qwen3-Coder: predicted 75-88 correct with 0-4 regressions. Got 52, with 1 measured regression plus 7 deleted
  functions found by forensics. The prediction missed badly: interleaving 10 projects cost far more than set C's
  one-project-at-a-time chains.
- Base 14B: predicted 15-35, got 5.

GPU: set D cost ~$9.0 (14B ~$0.22 + ~$1.5; Qwen3-Coder ~$4.7 + ~$2.6). Running total of the $30 cap: ~$15.8.
