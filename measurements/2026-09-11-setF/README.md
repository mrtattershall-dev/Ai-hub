# Set F - 100 new interleaved goals (DRAFT - checker validated, NOT yet pre-registered)

tatte, asked to choose between re-running set E's goals and a fresh set: "Fresh f set".
Same format as sets D and E, so the three compare: 10 new projects x 10 steps, interleaved by round
(goal = (step - 1) * 10 + project), all in one workspace. The s prefix makes the trial harness see every file.

Projects (all new domains):
| # | project | language | notes |
|---|---|---|---|
| s1 | library: books, loans, holds, due days, fines, limits | JS | step 10 = S1_NOTES.md, checked against the source |
| s2 | access-log analyzer | Python | ends as a command-line tool; step 10 changes the line format |
| s3 | matrix: arithmetic, determinant, inverse, solve, text form | JS | |
| s4 | markdown subset to HTML, table of contents | Python | |
| s5 | expression evaluator: parser, error positions, tokens, RPN, compile | JS | step 10 adds comparisons |
| s6 | weighted directed graph: search, Dijkstra, topological order, DOT | Python | |
| s7 | LRU cache with expiry on an injected clock, stats, eviction callbacks | JS | |
| s8 | gradebook: weights, drops, missing-as-zero, curve, CSV | Python | ends as a command-line tool |
| s9 | kanban board page | HTML + JS | driven in a real browser |
| s10 | a "desk" module built on s1 and s7 | JS | step 10 = S_INDEX.md, checked against every s-file |

Designed from what sets D and E showed about long runs:
- a cross-file dependency (s10 requires s1 and s7; each s10 step only uses what the same round has built);
- steps that change earlier behaviour and must keep the rest working (s1 due days, fines and limits; s2's optional
  seconds; s5's comparisons; s8's categories, which must leave a single-category result unchanged);
- a browser project, and two documentation steps checked for invented names.

Checker (tools/checks-F.mjs), validated before any model saw the goals:
- refs/ 100/100 both ways (asIs and implementation); empty workspace 0/100;
- tools/mutate-F.mjs: 69 of 69 planted bugs caught exactly, including cross-project ones (an s1 fine-rate bug and a
  case-sensitive search that must also fail the s10 steps built on them), and wrong own asserts in JS and Python
  (CT on all 10 steps).
- Where a goal leaves a detail open, the check does not test it: e.g. double unary minus, negative exponents,
  several spaces between matrix entries, token values for brackets, eager versus lazy expiry, the order clear()
  reports entries in, headings inside code blocks.

## Pre-registration (DRAFT - binding when committed before either app is deployed)

tatte, asked which models should run set F with about $6.7 of the $30 cap left, chose "14B + Qwen3-Coder" (the option
that said: about $10 worst case, about $3.3 over the $30 cap - raising the cap), and for batch actions chose "Off, as in
D and E".

**Hub:** main with the seven set-E fixes (server/ at b3c2614): dropped-connection retry, leftover tasks scoped to the
goal's files, verify_project checks the goal's own file and language, FIND==REPLACE edits say NO CHANGE, a value
hiding a method is named, a write dropping module.exports names says so (plus the set-D fixes). Each log's hub line
names the repo HEAD at launch.

**Harness:** tools/trialF.mjs (= set E's trialE.mjs) and tools/run-setF.sh, dry-run proven on a mock: every run
file, full transcript, trace and a git bundle of the workspace are kept. 30 steps and 8 minutes per goal, as in D and E.
AGENT_BATCH_ACTIONS=0; approvals answered as in D and E (git_commit and git_undo approved, the rest denied).

**Models, GPUs, caps** (same deploy settings as D and E; stops ONLY via stopApp.mjs, Rule 7a):
| app | model | GPU | harness cap / watchdog cap | worst case |
|---|---|---|---|---|
| coder30b-setf | Qwen/Qwen3-Coder-30B-A3B-Instruct (bf16) | H100 | 120 / 125 min | ~$8.2 |
| coder14b-setf | Qwen/Qwen2.5-Coder-14B-Instruct-AWQ | A10G | 95 / 100 min | ~$1.8 |
Worst case ~$10.0, about $3.3 over the $30 cap as tatte chose. The laptop stays on AC and a keep-awake power request
runs for the window (set E lost Qwen3-Coder's last 36 goals to a battery sleep). At set E's pace (about 1.3 minutes a
goal) Qwen3-Coder may not start all 100 goals inside 120 minutes; goals it never starts are reported as such.

**Predictions** (before any model has seen the goals):
- Qwen3-Coder: starts at least 90 goals; 50-70 of 100 steps work at the end; regressions among steps that worked
  when written: 0-5.
- Base 14B: 10-25 of 100 (set E: 12); repeat-guard stops 30-60 (set E: 75), because the fixes remove the stale tasks,
  no-op edits and wrong verifications that fed its loops.
- Record keeping: end states known for every goal that ran, and a transcript for every goal.
- The fixes, counted from the transcripts: no leftover task naming another goal's file reaches a model call;
  verify_project never runs a file other than the goal's own; NO CHANGE fires for any FIND==REPLACE edit.
