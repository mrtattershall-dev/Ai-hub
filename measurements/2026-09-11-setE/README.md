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

## Results (hidden checks on the final workspaces, 2026-09-11)

**The laptop went to sleep on low battery at 12:37 and woke at 14:27 (Windows Kernel-Power 42, "Sleep Reason:
Battery"). That cut Qwen3-Coder off at goal 64 - 36 goals never started. The base 14B had just finished all 100.**
Qwen3-Coder's score is therefore not a test of its prediction; the 14B's is.

| set E, 100 interleaved goals | Qwen3-Coder-30B-A3B | base 14B |
|---|---|---|
| goals run | **64** (cut by the sleep) | 100 |
| **steps that work at the end** (as asked / implementation) | **35 / 35** of 100 - 35 of the 64 attempted | **12 / 15** of 100 |
| per project, implementation (of 10) | q1 6, q2 7, q3 7, q4 0, q5 3, q6 4, q7 2, q8 5, q9 1, q10 0 | q1 1, q2 7, q3 3, q4 0, q5 0, q6 1, q7 0, q8 1, q9 0, q10 2 |
| failures: function missing / wrong result / throws | 37 / 20 / 8 (includes the 36 steps never attempted) | 46 / 11 / 28 |
| run status 'done' | 46 of 64 | 23 of 100 |
| stopped by the repeat guard | 6 | 75 |
| end-of-run syntax rollbacks | 1 | 29 |
| **regressions** (steps that worked when written, broken by the end) | **8** of the 41 that worked when written - every one a q4_template or q10_report step ending in render is not a function - the module.exports line dropped at goal 54 (fix 7). Measured on a copy of the final workspace: restoring that one line brings back 5 of the 8, plus goal 74 (never reached, but its q4 code already handled it) - 41 of 100 instead of 35, and nothing gets worse. Goals 24, 34 and 40 have a second fault behind the first | **5** of the 19 that worked when written: q6_jpath goals 6 and 76 (later rewrites), q8_units goals 8 and 28 (convert later demanded a density for every conversion), q9_shop goal 9 |

- **q4 at 0/10 for both is real, not a checker fault.** The checker takes `render` from the module's exports. The
  14B's final q4_template.js exports only `compile` (its function is `renderTemplate`). Qwen3-Coder HAD
  `module.exports = { render }` and lost it at goal 54: two edits missed, it rewrote the file whole without the export
  line, and the hub said only "OK: wrote 10932 bytes" - render() was still defined, so the definition-loss warning
  could not see it. q10 builds on q4, so Qwen3-Coder's q10 0/10 follows from the same loss. This is fix 7 below.

### Record keeping - the set-D fixes, tested live
- Every goal that ran has its run file AND its full, untrimmed transcript: 100 + 100 for the 14B, 64 + 64 for
  Qwen3-Coder (set D had lost 32 and 60 run files, and all history beyond 16 messages). Git bundles of both
  workspaces are kept, so every checkpoint survives the temp folder.
- Checkpoints never died (0 checkpoint-failure notes); regressions are countable for every goal that ran: 100 of 100 for the 14B, 64 of 64 for Qwen3-Coder (set D: 49 and 1).
- Definition-loss warnings fired live 3 times for Qwen3-Coder (goal 58 find_best_fraction, and two rewrites of its own test file) and 2 times for the 14B (goal 96 dropped 8 functions from q6_jpath.py in one write; goal 17 removed text); rollbacks named what they removed and left "Re-add" tasks (29 for the 14B).
- The harness answered 3 approvals, all Qwen3-Coder's: goal 15 git_undo approved, 47 run_command denied, 54 git_undo
  approved.

### Against the predictions
- Qwen3-Coder: predicted 55-75 of 100 with 0-5 regressions. Not testable - 36 goals never ran. On the 64 attempted
  steps, 35 work (55%).
- Base 14B: predicted 5-20; got 12 as asked, 15 implementation. Inside the range.
- Record keeping: predicted end states known for at least 95 of 100 goals for both models, a transcript for every
  goal, no silent checkpoint death: met - end states known for 100 of 100 and 64 of 64 goals, a transcript for every goal, no checkpoint failure.
- Definition-loss warning predicted to fire at least 3 times for Qwen3-Coder: it fired exactly 3 times, two of them on its own test file - the prediction holds, just.

### Hub bugs set E exposed - fixed on branch f-fixes (each with a test that fails without it), not yet merged
Found by reading what the models were actually told, in the full transcripts. Replayed through f-fixes on the real
recordings ($0): the 14B's 100 goals and Qwen3-Coder's 64 (measurements/replay/results/setE-*).
| # | bug | how often in set E (14B / Qwen3-Coder) | replay through f-fixes |
|---|---|---|---|
| 1 | a model stream that closed before any content ("Premature close") paused the run for a human; unattended, the goal was lost | 1 / 0 | cannot be replayed (a network event); proven by connRetry.test |
| 2 | goal 1's plan tasks rode on every later goal's model calls, and models acted on them | 688 calls; the 14B closed 10 / Qwen3-Coder closed 45 | hidden in all 100 of the 14B's goals (699 calls) |
| 3 | verify_project ran `node q1_stock.js` for a Python goal (the workspace package.json made it "node") | 2 of 2 calls / 5 of 5 | checks the goal's own file in its language |
| 4 | edit_file with FIND identical to REPLACE answered "OK: edited" | 41 / 0 | NO CHANGE, 41 times in 19 goals |
| 5 | `this.text = ...` hid the `text()` method; the model re-read the method and looped (set D had the same with history) | 6 / 4 | named with both lines in 6 of the 14B's cases |
| 6 | a leftover naming no file stayed forever | (part of 2) | shown to the next goal only |
| 7 | a rewrite that dropped `module.exports` names said nothing | goal 54 (Qwen3-Coder) | goal 54 now warns: `q4_template.js: render` |

The 14B's 75 repeat-guard stops are the pattern most of these feed: a no-op edit, a stale task or a wrong
verification answered as success, the model repeats itself, the guard ends the goal - 29 times with a half-fixed
file rolled back.

Still open, and tatte's call: Qwen3-Coder packed several actions into one reply in 23 of 64 goals and was told 116
times that the extra actions were discarded (AGENT_BATCH_ACTIONS is off by default).

GPU: ~89 min H100 + ~89 min A10G, ~$7.5 (estimate - the apps scale to zero 120 s after the last request, so the
sleep itself cost nothing). Running total of the $30 cap: ~$23.3.
