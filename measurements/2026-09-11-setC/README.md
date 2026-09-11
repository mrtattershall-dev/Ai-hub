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

## Results — hidden checks on the final workspace, every fail line hand-reviewed (2026-09-11)

**Qwen3-Coder kept everything it built: 32/40 steps work at the end, and 0 regressions. Every step
that worked when written still worked after the remaining goals. The base 14B finished with 7/40 and
3 regressions, including a file that no longer loads at all.**

| set C, 40 chained goals | Qwen3-Coder-30B-A3B | base 14B |
|---|---|---|
| **steps that work at the end** (hidden checks, final workspace) | **32** | **7** |
| ... counting goal 22's 1 ms-late expiry as a pass | 33 | 7 |
| steps that worked when written (checkpoint state, same checks) | 32 | 9 |
| **REGRESSED** (worked when written, broken by a later goal) | **0** | **3** |
| hub status "done" | 38 | 7 |
| hub said "done", hidden check fails | 6 | 4 |

Per project (implementation correct at the end, of 5):

| | s1 bank | s2 words | s3 events | s4 matrix | s5 cache | s6 parser | s7 todo | s8 router |
|---|---|---|---|---|---|---|---|---|
| Qwen3-Coder | 5 | 5 | 4 | 4 | 4 | 3 | 3 | 4 |
| base 14B | 0 | 2 | 3 | 0 | 2 | 0 | 0 | 0 |

"Done as asked" and "implementation correct" were identical for both models: neither model's own
asserts ever broke correct code (no CT).

GPU: both deployed 06:33, identity pasted in COORD before any number, stopped by the watchdogs through
stopApp.mjs (Qwen3-Coder 07:04:55, 14B 07:07:56; independent re-list: both stopped, 0 tasks).
H100 31 min (~$2.05), A10G 34 min (~$0.62).

### Qwen3-Coder's 8 failures (all hand-checked against the final files)

| goal | step | what is wrong |
|---|---|---|
| 13 | once() | the listener runs, but emit() returns 0 for it |
| 20 | matrix validation | determinant([[1,'a'],[2,3]]) returns NaN instead of throwing |
| 22 | cache time-to-live | expires 1 ms late (at 101, not at exactly 100). A boundary reading; counted strict above |
| 28 | unary minus (stopped) | '4*-2' throws; '2--1' gives -1, not 3 |
| 30 | power | '2^-1' throws; the other four power cases are right |
| 32 | todo remove() | done(999) does not raise KeyError |
| 34 | priorities (stopped) | pending() lists low priority first: ['a', 'd', 'b', 'c'] |
| 37 | query strings | '/search?q=cats' no longer matches '/search' (404) |

None of the 8 worked at its checkpoint either, so each is a step it never got right, not one it
broke later. 6 of the 8 were reported "done" by the hub.

### Base 14B

33 of 40 runs ended "stopped". Its 3 regressions:
- **26 (s6 tokenize):** passed when written. By the end, loading s6_parser.js crashes node with an
  out-of-memory fatal error on any input: the file's own top-level code loops forever.
- **31, 33 (s7 todo):** passed when written, then a later goal renamed the list attribute, and they
  end with AttributeError: 'TodoList' object has no attribute 'todos'.

These are exactly the long-run failure the retrain is for: work that was right, broken by later work
on the same files.

### Against the pre-registration
- The regression count uses a stricter method than the README named: each goal's end state is rebuilt
  from the hub's git checkpoints and run through the same hidden checks (tools/regress-C.mjs, with
  checkpoints matched to goals by their thought text; 0 of Qwen3-Coder's and 5 of the 14B's end states
  needed the timing fallback). trial35's own per-goal flag is kept in the ON DISK column of the logs.
- Predictions: Qwen3-Coder 30-36 correct with 1-4 regressions (got 32, and 0 regressions). Base 14B
  20-30 (got 7, far below). "More regressions than Qwen3-Coder" held (3 vs 0), but not "concentrated
  in the rule-change steps": its regressions were step-1 and step-3 work broken by later rewrites.
