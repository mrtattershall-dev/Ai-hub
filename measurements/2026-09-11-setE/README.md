# Set E - 100 new interleaved goals (DRAFT - checker validated, NOT yet pre-registered)

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

## Pre-registration (DRAFT - becomes binding when committed with tatte's go and the hub commit filled in)

**Hub:** main after the e-fixes merge; the exact commit is written in the GPU ledger and in each log's `hub` line
(trialE.mjs prints it). Set-D fixes in effect: full transcripts, forced finishes marked UNVERIFIED, AGENT_UNATTENDED
(deny instead of park), checkpoint resilience (add --ignore-errors, stale index.lock, visible failure note), run
files kept, rewrite definition-loss warning, rollback names what it removed and carries a "Re-add" task.

**Harness:** tools/trialE.mjs = set D's trial35 plus record keeping only (AGENT_MAX_RUN_FILES=100000, runId per
goal, hub sha, per-goal rows). tools/run-setE.sh scores the final workspace with checks-E.mjs and keeps run files,
transcripts, traces, the run index and a git bundle of the workspace in runs/<label>. Same step/time limits as D
(30 steps, 8 min per goal).

**Models, GPUs, caps** (same deploy settings as set D; stops only via stopApp.mjs, Rule 7a):
| app | model | GPU | watchdog cap | worst case |
|---|---|---|---|---|
| coder30b-sete | Qwen/Qwen3-Coder-30B-A3B-Instruct (bf16) | H100 | 120 min (D needed ~98 min for 100 goals) | ~$7.9 |
| coder14b-sete | Qwen/Qwen2.5-Coder-14B-Instruct-AWQ | A10G | 95 min (D: 100 goals in 77 min) | ~$1.75 |
Worst case ~$9.7 against ~$14.2 left of the $30 cap.

**Open choices (recommended defaults shown; tatte's call):**
1. AGENT_BATCH_ACTIONS - recommended OFF, as in set D, so E measures the set-D fixes and nothing else.
2. Approvals - recommended: the harness answers as in set D (approve git_commit and git_undo, deny the rest), so
   E compares with D. The alternative, AGENT_UNATTENDED=1, has the hub deny everything that would ask, git_undo
   included - a behaviour change for the model.

**Predictions** (made before any model has seen the goals; set E is new, so D is a guide, not a baseline):
- Qwen3-Coder: 55-75 of 100 steps work at the end (D: 52 under the hub bugs). Regressions among steps that worked
  when written: 0-5.
- Base 14B: 5-20 of 100.
- Record keeping (the direct test of the fixes): end states known for at least 95 of 100 goals for BOTH models
  (D: 49 and 1); a transcript for every goal; no silent checkpoint death (any failure shows as a note and is counted).
- The definition-loss warning fires at least 3 times for Qwen3-Coder; every rollback that removes a definition
  leaves a "Re-add" task, and the next goal on that file is scored for whether it re-added it.
