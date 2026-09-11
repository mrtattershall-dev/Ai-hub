# Set C — 40 chained goals: does the work survive a long run? (pre-registered 2026-09-11)

Written, and the checker validated, BEFORE any model saw these goals.

## Why
Sets A and B are 40 independent small goals. The skill that matters for the 14B coder is
**long runs that stay accurate**: step 5 of a project must not break steps 1-4. Set C measures that.

## Design
- 8 projects x 5 steps = 40 goals, run **sequentially in ONE workspace** (trial35, isolated local hub,
  same harness as sets A/B). Each step builds on the previous one (goals-C.json). File names use the
  `s` prefix so trial35's per-goal scorer sees them.
- Projects: s1 bank (JS, step 5 = accurate notes file), s2 word counter (Python, step 3 changes a rule,
  step 5 CLI + import-safety), s3 event bus, s4 matrices, s5 LRU cache with an injected clock,
  s6 expression parser, s7 todo list (Python, JSON persistence), s8 router.
- **Hidden checks (tools/checks-C.mjs) run on the FINAL workspace**, after all 40 goals — so a later
  step that breaks an earlier one fails the earlier step. Each step is scored two ways:
  - **done as asked** — module loaded as the model left it, its own asserts included;
  - **implementation correct** — the model's own asserts neutralised (tools/neutral.cjs; python -O).
  The gap between the two is the "correct code, own test wrong" (CT) failure seen in sets A/B.

## Validation of the checker (before any run)
- refs/ (hand-written reference solutions): **40/40** both ways.
- empty workspace: **0/40**.
- tools/mutate-C.sh: 16 planted bugs (non-atomic transfer, failed withdraw logged, notes missing a
  method, apostrophe rule undone, CLI running on import, emit stopping at first throw, once not
  removed, no matrix validation, LRU not refreshed on get, delete counted as a miss, left-assoc power,
  ids reused after load, no 405, wildcard matching the bare prefix, wrong own assert in JS and in
  Python). **Every mutant fails exactly the intended step(s)**; the two own-assert mutants score CT
  (implementation correct, done-as-asked fail) on all 5 steps of their chain.
- Checker revised twice during validation, before any model run: step 10 now imports with a realistic
  argv (an unguarded CLI would otherwise hide), step 23 uses capacity 1 so stats do not depend on LRU
  order (one bug no longer costs two steps).

## Models (GPU: inside tatte's $30 generation cap; tatte: "Let's do it")
- `coder30b-base` Qwen/Qwen3-Coder-30B-A3B-Instruct bf16, H100, min 0 / max 1, scaledown 120 s.
- `coder14b-base` Qwen/Qwen2.5-Coder-14B-Instruct-AWQ, A10G, min 0 / max 1, scaledown 120 s.
- Identity (Rule 3): /api/health pasted in COORD before any number counts.
- HARD CAP 50 min per app from harness start; no new goal within 8 min of the cap; stopped ONLY by a
  watchdog via `node training-data/factory/stopApp.mjs <app>` (Rule 7a). Worst case ~$3.3 + ~$0.9.

## What will be reported
1. Hidden-check score on the final workspace, both ways, per model, per project.
2. **Regressions**: steps whose feature worked when written (trial35 per-goal work check at that time)
   but fails on the final state.
3. trial35's own per-goal numbers (status done / work done) — reported, but NOT the headline, since
   it cannot see regressions.
4. Hand-review of every fail/CT line against the workspace before the numbers are final.

## Predictions (written before running)
- Qwen3-Coder: 30-36/40 implementation correct; 1-4 regressions.
- base 14B: 20-30/40; more regressions than Qwen3-Coder, concentrated in step 3-5 rule changes
  (s2 step 3, s3 step 4, s6 steps 3/5).
