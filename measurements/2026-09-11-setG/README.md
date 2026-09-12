# Set G - set F's 100 goals again, on the hardened hub (PRE-REGISTRATION, written before the window opens)

tatte: "Run a coder three run now then" and "Go ahead and do a 14 b too".

**One variable.** Same 100 goals as set F (goals-G.json is byte-identical to goals-F.json), same hidden checks
(checks-G.mjs byte-identical to checks-F.mjs - sha256 in prep-checksums.txt), same two models, same GPUs, same caps,
same approval policy, same AGENT_BATCH_ACTIONS=0, a fresh empty workspace per model. **Only the hub differs**: set F
ran on main at c92c2d1; set G runs on main at **dae46b2**, which adds twenty fixes made offline today, every one with a
failing test written first and a mutant proving the test can see the fix.

    models  coder3  = Qwen/Qwen3-Coder-30B-A3B-Instruct on H100, served as coder30b  (30B MoE, ~3B active)
            14B     = the base 14B coder on A10G, served as coder14b
    hub     main dae46b2 (4764bde + b60e6ef + dae46b2); the harness starts its own isolated hubs from main
    cost    H100 ~95 min ~$7.0 + A10G ~95 min ~$1.6 = ~$8.6; running total after this ~$41.6

## What changed in the hub since set F, and why (all measured, none guessed)
Destruction, which cost set F a third of Qwen's working code (48 goals worked when written, 36 at the end, 16
regressed): a write or edit that would remove definitions or exports the file already had is REFUSED and the file
restored; `REMOVE: <names>` expresses a deliberate deletion. The parser no longer reads its fields from inside the
fenced body, so a file mentioning `REMOVE:` cannot authorise its own deletion. `edit_file` writes replacement text
literally instead of expanding `$&`/`$'`. `search_file` reads a query as text before treating it as a pattern.
Honesty: `read_file` no longer presents a fragment as a whole file (its truncation notice used to be cut off by the
truncation it announced). The loop-break substitution no longer hands over a blind 6,000-char prefix labelled as a
`read_file` result - and it was UNREACHABLE since the repeat-notice merge, which this run is the first to exercise.
`run_command`/`run_python` keep stderr and the EXIT line however large stdout is. The finish gate verifies the goal's
OWN project (it could pass a goal on an unrelated leftover .js), a pass expires when the workspace changes, and a
browser test that could not run banks no clean test.
Progress: the stuck-loop guard no longer counts a repeat when work landed in between, keys on the whole reply rather
than its first 2000 chars, and names the TOOL when a tool refused identically - set F lost 77 of the 14B's 100 goals to
that guard after a median of six tool calls. A resumed run gets a fresh wall clock and no longer dies on its first
tool call. A retried model call no longer costs a step.

## Predictions (fixed before the window; the run is decisive either way)
1. **Qwen3-Coder (coder3)**: 36/100 on set F. Destruction removed should raise it; the stricter gate should not lower
   the checks (they score the workspace, not the status). **Predict 42+/100.** The replay already proved the mechanism
   fires: 10 destructive writes refused across 9 of these exact goals.
2. **Base 14B**: 2/100 on set F, with 77 goals killed by the repeat guard at ~6 calls. **Predict 10+/100** - the floor
   is that it survives past six calls; anything less means the guard was not the binding constraint.
3. **Statuses will look WORSE while the work is better**: expect more `stopped`/UNVERIFIED and fewer false `done`,
   because the gate now runs the goal's own project. The replay showed 22 of Qwen's `done`s were false. Judge this run
   by the hidden checks, not by how many runs say `done`.
4. **If the checks do NOT move while destruction demonstrably stops, that is the answer**: the tools were not the
   ceiling and the model is. Either way this run settles it.

## The open question this run exists to answer
Does a model USE the room the fixes create - resend a file complete after a refusal, and fix its project across the
three gate blocks - or repeat itself into the loop guard? The offline replay cannot answer it: the mock cannot react.

## Rules for the window
Status file written before any GPU time so the watchdog is armed first (Rule 7a: stopApp.mjs only). Rule 3 identity
proved against /api/health before a single goal runs. Laptop on AC with a keep-awake held. Fuzzer paused. Independent
`python -m modal app list --json` at the close. Records kept per model: 100 run files, 100 transcripts, traces, run
index, workspace git bundle.
