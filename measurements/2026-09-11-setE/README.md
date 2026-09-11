# Set E - 100 new interleaved goals (pre-registered 2026-09-11, before any GPU time)

tatte: "After d has results, analyze the deep seated bugs and fix them so run E can have another 100 prompts."
Same format as set D, so the two compare: 10 new projects x 10 steps, interleaved by round
(goal = (step - 1) * 10 + project), all in one workspace. The q prefix makes trial35 see every file (checked: 100/100).

Projects: q1 warehouse with reservations (JS; step 10 = Q1_NOTES.md), q2 CSV table toolkit (Python; CLI),
q3 calendar with conflicts and free slots (JS), q4 template engine (JS; escaping, filters, sections, partials,
compile), q5 rate limiters with an injected clock (Python), q6 JSON paths (Python; wildcards, diff, merge),
q7 text buffer with undo/redo and edit groups (JS), q8 units and recipes (Python; CLI), q9 browser shopping cart
(HTML+JS), q10 integration report rendering q1 data through q4 (JS; step 10 = Q_INDEX.md).

Checker (tools/checks-E.mjs), validated before any model saw the goals:
- refs/ 100/100 both ways; empty workspace 0/100;
- tools/mutate-E.mjs: 41 planted bugs, 41 caught exactly. That includes cross-project bugs (a template bug that also
  breaks q10's report; a discount bug seen from four steps), invented names in the notes and the index, a missing
  index file, and wrong own asserts in JS and Python (CT on all 10 steps).

## Pre-registration (binding: committed before either app was deployed)

tatte, verbatim: "After d has results, analyze the deep seated bugs and fix them so run E can have another 100
prompts." - and, shown the two open choices with recommended defaults and asked to say go: "Continue".

**Hub:** main with server/ at 421ce9e (the e-fixes merge; server/ unchanged since). Each log's hub line names the
repo HEAD at launch. Set-D fixes in effect: full transcripts, forced finishes marked UNVERIFIED, AGENT_UNATTENDED
(deny instead of park), checkpoint resilience (add --ignore-errors, stale index.lock, visible failure note), run
files kept, rewrite definition-loss warning, rollback names what it removed and carries a "Re-add" task.

**Harness:** tools/trialE.mjs = set D's trial35 plus record keeping only (AGENT_MAX_RUN_FILES=100000, runId per
goal, hub sha, per-goal rows). tools/run-setE.sh scores the final workspace with checks-E.mjs and keeps run files,
transcripts, traces, the run index and a git bundle of the workspace in runs/<label>. Same step/time limits as D
(30 steps, 8 min per goal).

**Models, GPUs, caps** (same deploy settings as set D: min 0, max 1, scaledown 120 s; stops ONLY via stopApp.mjs,
Rule 7a):
| app | model | GPU | harness cap / watchdog cap | worst case |
|---|---|---|---|---|
| coder30b-sete | Qwen/Qwen3-Coder-30B-A3B-Instruct (bf16) | H100 | 120 / 125 min (D needed ~98 min for 100 goals) | ~$8.2 |
| coder14b-sete | Qwen/Qwen2.5-Coder-14B-Instruct-AWQ | A10G | 95 / 100 min (D: 100 goals in 77 min) | ~$1.8 |
Worst case ~$10.0 against ~$14.2 left of the $30 cap. The harness starts no new goal 8 min before its cap.

**Dry run (offline, no GPU, 2026-09-11 10:38):** trialE + run-setE on the merged hub (421ce9e) against a mock model,
3 goals: the log names the hub commit and every goal's runId, the per-goal rows are written, and runs/<label> holds
3 run files, 3 full transcripts (plan, turn, turn), the traces, the run index and a git bundle of the workspace.

**Settings (the recommended defaults, taken with tatte's "Continue"):**
1. AGENT_BATCH_ACTIONS=0 (off, as in set D), so E measures the set-D fixes and nothing else.
2. Approvals answered by the harness as in set D: git_commit and git_undo approved, everything else denied.
   AGENT_UNATTENDED is not set.

**Predictions** (made before any model has seen the goals; set E is new, so D is a guide, not a baseline):
- Qwen3-Coder: 55-75 of 100 steps work at the end (D: 52 under the hub bugs). Regressions among steps that worked
  when written: 0-5.
- Base 14B: 5-20 of 100.
- Record keeping (the direct test of the fixes): end states known for at least 95 of 100 goals for BOTH models
  (D: 49 and 1); a transcript for every goal; no silent checkpoint death (any failure shows as a note and is counted).
- The definition-loss warning fires at least 3 times for Qwen3-Coder; every rollback that removes a definition
  leaves a "Re-add" task, and the next goal on that file is scored for whether it re-added it.
