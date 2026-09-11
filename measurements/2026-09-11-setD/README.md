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
  (matched to goals by thought text) and run through the same checks. The count is the steps that
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
