# verify-02-harness.md — second, independent audit of the set J measurement harness

Scope: `tools/trialJ.mjs`, `run-setJ.sh`, `launch-J.sh`, `watchdog.sh`, `neutral.cjs`
(+ `compare-setJ.mjs`, which is the reporting end of the same harness and where one finding lands).

Method: re-derived from primary sources only. Every column checked against the run JSON for
**all 16 goals of the completed 14B arm** and cross-checked against the 30B (18 goals) and the
32B (17 goals) live temp dirs. The first report was not opened until after this section was written.

Data read (read-only):
- `runs/coder14b-setj/` (16 run JSON + 16 transcripts + index.jsonl + traces.jsonl + workspace.bundle)
- `/tmp/trial35-Cq4RcJ` (14B), `trial35-cWxzHB` (30B), `trial35-8XrYOc` (32B)
- `*-rows.json`, `*-setJ.log`, `*.status`, `watchdog-*.log`, `goals-J20.json`
- `ai-coding-hub-indent/server/agent.js` (guard strings, `slimForDisk`, `RUN_ARG_MAX`, workspace seeding)

---

## A. Column-by-column verdict

Verified per goal against `runs/coder14b-setj/runs/<runId>.json`, n=16 (all rows), plus spot checks
on the other two arms.

| column | verdict | evidence |
|---|---|---|
| `#` | correct | — |
| `status` | value correct, **meaning misleading** | 16/16 match `run.status`. But it merges infrastructure outcomes with model outcomes — see B1. |
| `steps` | value correct, **label misleading** | 16/16 match `run.steps.length`. It is not tool calls: goal 8 shows `61` steps = **30** tool steps; the rest are `plan`/`checkpoint`/`policy_allowed`/`note`/`error` pseudo-steps. Retry noise inflates it: goal 5's 10 "steps" include 3 retry `note`s and 2 `error`s, so half the row is infrastructure. The cap is on **model calls**, not steps, so a reader sees `61` next to a 30-cap and mis-reads the budget. |
| `calls` | **correct** | 16/16 match `run.modelCalls`. `30` = the budget cap (`AGENT_MAX_STEPS=30`). |
| `err` | **WRONG — undercounts by ~2x, and biased by failure type** | see A1 |
| `grd` | **WRONG — structurally zero; inverts its own stated purpose** | see A2 |
| `secs` | value correct as wall clock, **not comparable across arms** | see A3 |
| `ON DISK` | **WRONG — false FN-MISSING on 8 of the first 10 goals in every arm** | see A4 |

### A1. `err` — undercounts real tool failures by roughly half, in a direction that flatters the worse arm

`toolErrs` matches only `/^ERROR:/`. Verified `err` equals that count exactly on 16/16 rows, so the
column faithfully reports what it measures — but what it measures is not "tool errors".

Counted over every `type:'tool'` step:

| arm | tool steps | counted as `err` | `NO CHANGE:` uncounted | non-zero `EXIT:` uncounted | traceback/assert text uncounted |
|---|---|---|---|---|---|
| 14B | 123 | 15 | 4 | 14 | 14 |
| 30B | 197 | 6 | 0 | 10 | 10 |

Two separate misses:

1. **`NO CHANGE:` refusals** (the known defect) — 4 in the 14B arm, counted as neither `err` nor `grd`.
2. **Failing `run_command` / `run_python` are invisible** (not previously known). A command that exits
   non-zero returns `STDOUT:…/STDERR:…/EXIT: 1`, never `ERROR:`. 14 such results in the 14B arm, 10 in
   the 30B arm, none counted.

The bias matters more than the magnitude. `err` counts only the *edit-plumbing* class
(`edit_file` FIND misses, duplicate refusals, file-not-found). It does **not** count the model
writing broken code and running it. So an arm that writes bad code and executes it reads *cleaner*
than an arm that fumbles an edit. That is backwards for a measurement whose question is code quality.

### A2. `grd` — zero on every row of every arm, and guard refusals are charged to the model as errors

`grd` filters `toolErrs` by `/boundary marker and/`. That string appears once in `agent.js` (line 352):
the `package.json` workspace-boundary refusal. It is **not** any of the guards set J exists to measure.

The real guard strings, none of which this column can see:

- `noChangeAt` → `"NO CHANGE: your REPLACE is identical…"` (agent.js 663/707/714/812) — **not `/^ERROR:/`, so counted as nothing at all**
- destructive write → `"ERROR: refusing to overwrite …"` / `"would have REMOVED"`
- duplicate → `"ERROR: this edit_file would have DUPLICATED…"`
- tolerant re-indent → `"OK: edited … (matched ignoring indentation)"`

The 14B arm's result histogram contains 4 × `"ERROR: this edit_file would have DUPLICATE…"`. Those
match `/^ERROR:/` but not `/boundary marker and/`, so **they land in `err`**. The code comment above
`grd` says a guard refusal is "counted apart so it cannot penalise the fix". The column does the
opposite of what its comment claims: the guard firing correctly is recorded as the model erroring.

`grd = 0` across 51 goals and three arms is the tell — it was never a real signal in set J.
`compare-setJ.mjs`'s `fixSignals()` measures these correctly; the trialJ table does not. Same class as
the standing lesson *fix the deciding path, not the advisory one* — here the correct counter exists in
the advisory script while the headline table uses the broken one.

### A3. `secs` — correct wall clock, but not a model measurement

Verified against `index.jsonl`'s `ms`: `secs` is consistently 1–3 s larger (the 3000 ms poll interval).
Fine as wall clock. But it also absorbs, undifferentiated: container cold start, stream-retry backoff
(goal 5 = 15+30+45 = 90 s of pure backoff), approval round-trips (1.5 s sleeps), and the post-status
`busy`/teardown wait. Goal 5's `395 s` is ~90 s backoff plus one 282 s call. Comparing `secs` between an
A10G arm and an H100 arm therefore compares infrastructure luck as much as model speed.

### A4. `ON DISK` — confirmed, and larger than "one false column"

Two independent bugs, both verified:

1. **Prose harvesting.** `wanted` takes every `\b(\w+)\s*\(` from the goal's *English*. Verified tokens:
   `book`, `owns` (goal 1: "copies of a book (adding…", "the library owns (0 for…"), `time`, `status`,
   `bytes`, `seconds` (goal 2's field list), `paragraphs` (goal 4), `numbers` (goal 5), `number`, `of`
   (goal 6), and — my favourite — **`js`** on goal 10, harvested from `s7_cache.js (require them…)`.
2. **`defined()` has no `class` alternative.** `Matrix` and `Cache` are reported missing while
   `class Matrix {` and `class Cache {` are **line 1** of `s3_matrix.js` / `s7_cache.js` (grep-confirmed
   in the saved workspace).

**The part that is not yet in the known-defect statement — where the false positives fall.**
FN-MISSING fires on goals **1,2,3,4,5,6,7,10** in *all three arms identically*, and is essentially
absent from goals 11–20. This is structural, not random: the create goals are prose-heavy specs, the
extend goals are terse and their `word(` tokens are genuine function names. Goals 8 and 9 escape by
accident — goal 9's prose contains no `word(` at all, and goal 8's parentheses all follow `)` rather
than an identifier.

Because `good` demands that **every** verdict entry end in `:runs`/`:ok`/`:parses`, one false
FN-MISSING zeroes an otherwise perfect goal. Rows poisoned solely by a false FN-MISSING (named file
existed and ran):

| arm | reported "WORK ACTUALLY DONE" | rows poisoned by false FN-MISSING | corrected |
|---|---|---|---|
| 14B | 4/16 | 6 (goals 1,2,3,4,5,7) | **10/16** |
| 30B | 10/18 | 8 (goals 1–7,10) | **18/18** |
| 32B | 8/18 | 8 (goals 1–7,10) | **16/18** |

A mechanical recount ("any row whose file verdicts are all clean but which carries an FN-MISSING")
returns 7 poisoned rows for the 14B, i.e. 11/16. I report **10/16** instead, because one of those seven
is a **true positive**: 14B goal 11 `FN-MISSING(checkout,available)` is correct — grep-verified, the
14B's `s1_library.js` defines neither, while the 30B's (lines 29/46) and the 32B's (lines 25/33) define
both. The check is not worthless; it is drowned at roughly 24 false positives to 1 true one.

Caveat: "named file exists and runs" is a weak bar. The hidden checker `checks-J.mjs` is the real
arbiter and is **independent of this bug**. The corrupted number is trialJ's own
`WORK ACTUALLY DONE` line — which is what the three `agent-report-*.md` files and the per-arm logs quote.

---

## B. Goals ended for reasons that are not the model's fault, recorded as if they were

**Yes — and one fired in set J.**

**B1. 14B goal 5 — the endpoint died, the row says `interrupted` and looks ordinary.**
From `382c6ce9…json`: `connRetries: 3`, steps 6/7/8 are
`"The model connection dropped (Model stream failed before any content: Premature close) — nothing ran;
waiting 15s/30s/45s and retrying"`, step 9 is `"Run paused at step 4 — the model is unreachable."`
Nothing ran. This is an infrastructure failure, and it is printed in the same shape as a model that
gave up. It cost the arm three separate things:
- the goal (scored 0),
- **395 s of a 2820 s goal-start window (14%)**, almost all of it retry backoff,
- and the workspace state — it left a 102-byte placeholder `s5_expr.js` ("// Placeholder
  implementation, return 0") that goal 15 then had to repair.

Only the A10G arm suffered this. Stream failures by arm: **14B 3 retries / 1 run lost; 30B 0; 32B 0.**

**B2. Other non-model endings recorded inline:** 30B has
`"Planning step skipped: Model error 408: Missing request, possibly due to expiry or cancellation"` —
a server-side fault recorded as an ordinary step.

**B3. Budget exhaustion is presented as `stopped`,** identical to a model giving up. Budget endings:
14B 1, 30B 2, 32B 4. `compare-setJ.mjs`'s `endings()` separates these correctly; the trialJ table does not.

**B4. `START FAILED` deletes a goal from the denominator.** On a start failure the loop `continue`s
*without pushing a row*. The goal vanishes rather than scoring 0 — `rows.length` shrinks, so the rate
`worked/rows.length` silently improves. Did not fire in set J, but it is a silent-denominator bug of
exactly the class in the standing "silent failures" lesson.

**B5. The harness deadline is shorter than the timeouts beneath it — a live near-miss.**
`deadline = Date.now() + 10*60000` (600 s), but `MODEL_FIRST_BYTE_S=600` and `MODEL_TIMEOUT_S=1800`.
A single slow call can outlive the harness's patience: the `while` exits with a **non-terminal** `run`,
the row prints whatever status was last polled, and the next `/agent/start` hits a still-busy hub →
409 → `START FAILED` → row dropped (B4). **30B goal 9 ran 579 s against that 600 s deadline — 21 s of
margin.** This is not theoretical; it nearly fired.

**B6. The 8-minute pre-cap stop is clean.** `TRIAL_STOP_AT` only prevents *starting* a goal; it never
cuts a running one. The `-- window closed --` line is honest. All three arms got the same 47-minute
goal-start window from their own start (`CAP_MIN=55`, minus 8), and each watchdog's 65-minute kill
deadline sat comfortably after it (14B stop-new 06:57 vs kill 07:13; 32B 07:05 vs 07:20). The 32B's
8-minute-later start is not a cap bias. **No finding here.**

---

## C. Workspace isolation — clean; the `node_modules` asymmetry is model-made and score-neutral

**Genuinely fresh and identical at goal 1.** `mkdtempSync` per arm, `SEED_DIR` unset in all three runs,
so each workspace starts empty.

**`package.json` is harness-supplied and byte-identical across arms** — written by the hub at
workspace init (agent.js:206) as the boundary marker:
`{name:"agent-workspace", type:"commonjs", …, devDependencies:{mocha:"^12.0.1"}}`. It is *not* an arm
difference; it appears in every trial workspace on this machine, including ones holding a single file.

**`node_modules` + `package-lock.json` in the 14B arm are model-created** — it ran `npm install`,
honouring the `mocha` devDependency the hub advertises. Effect:

- **Disadvantage, mild and self-inflicted:** it spent wall clock and model calls on an install no other
  arm did — inside a time-capped window (section D), that is real cost.
- **Score impact: none, this time.** `run-setJ.sh`'s tar excludes `node_modules`, so `checks-J.mjs`
  scores a workspace where the install is *gone*. I grepped every arm's deliverables: the only requires
  are `assert` and `fs`, both builtins. Nothing broke.
- **Latent trap worth naming:** the harness seeds a `devDependencies: mocha` it never installs, and then
  discards any install a model performs. Had any model written a mocha-based test, its work would have
  scored 0 for a reason entirely authored by the harness.

So: the `node_modules` listing neither advantages nor disadvantages the 14B arm's score. It cost it time.

---

## D. Hardware → score, not just speed. This is the harness's biggest defect.

**Yes, and it is not subtle.** Nothing in the per-call logic is hardware-dependent; the conversion
happens through the interaction of three design choices:

1. The window is **time**-based — `TRIAL_STOP_AT = start + 47 min` — so a slower GPU reaches fewer goals.
2. The headline is a **rate over goals reached**, `worked / rows.length`.
3. Because of A4, **almost the only scorable goals are in the tail (11–20)**. Of goals 1–10, only 8 and 9
   can ever score `good` in any arm.

Compose them and the metric becomes approximately *"how many goals past #10 did you reach"* — i.e. a
throughput measurement wearing a correctness label:

| arm | GPU | goals reached | of those, in the scorable tail | reported |
|---|---|---|---|---|
| 14B | A10G | 16 | 6 | 4/16 |
| 30B | H100 | 18 | 8 | 10/18 |
| 32B | H100 | 17 | 7 | 8/17 |

Two compounding effects on top:

- **Infrastructure flakiness tracked the hardware.** All stream failures landed on the A10G arm (B1),
  and one of them burned 14% of that arm's window.
- **`compare-setJ.mjs` never applies its own truncation rule.** `targetOverRange()` is defined at
  line 42 under a comment calling it *"the TRUNCATION RULE, fixed before any set J number was visible…
  Comparing a truncated arm against a 20-goal target would understate it"* — and it is **never called**.
  Lines 113–115 use the fixed `r.target` (4 / 15 / 6), which are full-20 baselines. So every arm is
  scored against a 20-goal target having reached 16–18 goals, and the penalty falls hardest on the arm
  the time cap truncated most — the A10G arm again. The rule exists, is documented, is dead code.
  (Third instance in this codebase's history of the pattern: the guard is written where it advises and
  missing where it decides.)

The direction is consistent across all four mechanisms: **the arm on the slower GPU is penalised four
separate times for being on the slower GPU.**

---

## E. Record integrity — one real, systematic loss

**Intact:**
- **No truncation.** Zero files anywhere in `runs/` contain `slimForDisk`'s marker
  `"more characters not kept on disk"`. `RUN_ARG_MAX = 30_000` was never reached in set J.
- **No reaping.** `AGENT_MAX_RUN_FILES=100000`, so `reapRuns()` never deleted a run or transcript.
- **Run ↔ transcript pairing is complete:** 16/16 (14B), 18/18 (30B), 18/18 (32B). No empty transcripts.
- `workspace.bundle` present for both finished arms.

**Lost — and the loss is not random:**

| arm | run files | index.jsonl lines | traces.jsonl lines |
|---|---|---|---|
| 14B | 16 | **15** | **15** |
| 30B | 18 | 18 | 18 |
| 32B | 18 | 18 | 18 |

(Corrected after the 32B arm finished: its earlier 17/18 gap was just the in-flight run and closed on
completion. **Only the 14B has a permanent loss.**)

The 14B's missing index line is **goal 5 — the run that the endpoint killed (B1)**. The run that
documents the infrastructure failure is precisely the one absent from both the index and the trace
corpus. The full run JSON and transcript survive, so nothing is unrecoverable — but any analysis driven
off `index.jsonl` or `traces.jsonl` will silently under-report, and will under-report **failures
specifically**. The index is written on a normal run finish; a run that dies unreachable never gets one.

*(Superseded: at first pass `runs/coder32b-setj/` did not yet exist, because `run-setJ.sh` copies records
only after the harness exits. The 32B arm has since completed — `ALL DONE 07:11:40` — and its 18/18/18
records are now durable. No finding.)*

**Minor:** `ASSETS_ROOT` is hardcoded to the **main** checkout (`ai-coding-hub/assets`) while the served
tree is `ai-coding-hub-indent` — the same "measure one tree, point at another" class the file's own
header warns about. The directory exists and no set J goal referenced an asset, so no impact here.

---

## Summary — is it the tip of one iceberg?

**It is one iceberg, and the two known defects are its two smallest peaks.**

Wrong or misleading columns: **`err`** (undercounts ~2x, biased against edit-fumblers and blind to
broken code), **`grd`** (structurally zero; charges correct guard refusals to the model as errors),
**`ON DISK`** (false FN-MISSING on 8 of the first 10 goals in every arm), **`steps`** (counts
pseudo-steps and retry noise, not tool calls), **`secs`** (absorbs backoff and cold start),
**`status`** (merges infrastructure death with model failure).

Penalties a model pays for the harness's own behaviour:
1. A dead endpoint scored as a model failure, costing the goal, 14% of the window, and the downstream
   workspace state (14B goal 5).
2. False FN-MISSING zeroing 6–8 correct goals per arm.
3. A time-capped window whose only scorable goals sit in the tail, converting GPU speed into score.
4. `compare-setJ.mjs` measuring truncated arms against full-20 targets because its own truncation rule
   is never called.
5. Latent: a `START FAILED` silently shrinks the denominator; a >600 s call would do the same (30B goal 9
   came within 21 s); a mocha-based test would score 0 because the bundler drops the `node_modules` the
   harness's own `package.json` invites.

The unifying defect: **the harness cannot tell its own failures from the model's**, and every one of
those confusions resolves against the slower arm.

---

## Comparison with `audit/02-harness.md` (first auditor)

*(appended after writing the above)*
