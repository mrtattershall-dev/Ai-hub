# Audit 02 — the measurement harness (`trialJ.mjs` and its launch scripts)

Read-only audit, performed 2026-09-12 ~07:00 CDT **while all three paid arms were still running**
(14B at goal 16, MoE at goal 18, dense 32B at goal 15). Nothing was started, stopped, edited or killed.

Targets:

    tools/trialJ.mjs      the harness (main target)
    tools/run-setJ.sh     per-arm driver + records tar + scorer invocation
    tools/launch-J.sh     deploy + identity proof
    tools/watchdog.sh     stopApp.mjs watchdog
    tools/neutral.cjs     assert-neutralising preload

Evidence: the three live temp dirs (`trial35-Cq4RcJ` 14B, `trial35-cWxzHB` MoE, `trial35-8XrYOc` dense 32B),
their `runs/`, `index.jsonl`, `traces/`, the three `*-rows.json`, the three `*-setJ.log`, and the served
tree `C:/Users/tatte/Projects/ai-coding-hub-indent`.

---

## Summary verdict

The harness is **sound on the things that decide the published number** — goal order, workspace isolation,
provenance of the serving tree, and the records that outlive the run. The published comparison
(`compare-setJ.mjs`) reads `checks-J.json`'s `impl`, **not** the harness's own `good` flag, which limits the
blast radius of the two known defects considerably.

What it is **not** sound on: it charges infrastructure failures to the model, its diagnostic columns
(`err`/`grd`) are wired to wording the hub no longer emits, and one plausible timing path can silently delete
a goal from the denominator. One arm runs on different hardware under a wall-clock cap, which is a real and
asymmetric confound.

Ten defects and three latent hazards below, ranked at the end by how much each could distort a score.

---

## A. Goal loading, ordering, isolation — CLEAN

- `GOALS_FILE` is set by `run-setJ.sh` to `goals-J20.json`, parsed as a JSON array (`trialJ.mjs:97`), so the
  `fullAgent.mjs` fallback parser and the five appended extras are dead in this configuration. Confirmed:
  the fallback would read from `HUB_TREE_EARLY`, which is now the serving tree anyway.
- Goals are fed **in array order, one `/agent/start` per goal**, strictly sequentially — the loop waits for a
  terminal status before the next start (`trialJ.mjs:125-156`). Verified against the logs: rows 1..N appear in
  goal-file order in all three arms.
- Numbering is consistent end-to-end. `goals-J20.json` is goals 1–10 = create `s1..s10`, 11–20 = extend
  `s1..s10`. `checks-J.mjs:798` computes `goal = k * 10 + c.n`, which produces exactly that mapping. **No
  off-by-one between the harness's goal *n* and the scorer's goal *n*.**
- Isolation **between arms** is correct: each `trialJ.mjs` process gets its own `mkdtempSync` dir, its own
  `hub.json` (fresh, `history: []`), its own `AGENT_WORKSPACE`, `AGENT_RUNS_DIR`, `RUN_INDEX`,
  `AGENT_TRACES_DIR`, `AGENT_QUEUE_FILE`, and a random port in 5900–5989.
- State carried **between goals within an arm** — the workspace, its git history, `TASKS.md`,
  `ESCALATIONS.md`, the task ledger — is carried **deliberately and correctly**: goals 11–20 extend the files
  goals 1–10 created. That is the design, not a leak.
- `SEED_DIR` is unset in all three arms (no `seeded from` line in any log), so every arm started from an empty
  workspace. Confirmed.

Nothing is carried that should not be, and nothing that should be is reset.

---

## B. The per-goal loop and what each column actually measures

### How a goal is decided finished

`trialJ.mjs:154` breaks on `['done','error','stopped','interrupted','failed','awaiting_approval']` **and**
`run.busy !== true`. Waiting for `busy` to clear is correct and load-bearing — the hub 409s the next start
while the previous run still owns the workspace (`agent.js:4483`), so breaking on status alone would turn
every subsequent goal into a false `START FAILED`.

### Column by column

| column | source | correct? |
|---|---|---|
| `status` | `run.status` | yes |
| `steps` | `run.steps.length` | yes — but counts `checkpoint`/`note`/`policy_allowed` steps, so it is "journal entries", not "actions". 14B avg 18.2 steps for 8.9 model calls. |
| `calls` | `run.modelCalls` | **yes, and better than it looks** — `agent.js:2980,2993` refunds a call for a context-overflow squash and for a dropped connection, so infrastructure does not inflate it. This is the field the 30-call budget is actually checked against (`budgetExhausted`, `agent.js:152`). |
| `err` | `steps.filter(type==='tool' && /^ERROR:/)` minus `grd` | **NO — see D2** |
| `grd` | of those, `/boundary marker and/` | **NO — effectively dead, see D2a** |
| `secs` | harness wall clock | measures the harness, not the model — see D10 |
| `ON DISK` | file existence + run/parse + `FN-MISSING` | **`FN-MISSING` false on ~every row (given); the per-file `:runs`/`:parses`/`:ok` verdicts are correct** |

### D1 (given) — `FN-MISSING` and its real blast radius

Confirmed as described: `wanted` harvests every `word(` from the goal's **English prose**
(`trialJ.mjs:212`), and `defined()` (`:214`) matches `function`/`def`/assignment/method forms but **not
`class X`**. Hence `FN-MISSING(book,owns)`, `FN-MISSING(Matrix)`, `FN-MISSING(paragraphs)`,
`FN-MISSING(number,of)`, `FN-MISSING(Cache)`, `FN-MISSING(time,status,bytes,seconds)` — identical strings in
all three arms, which is itself the proof they are prose artifacts and not model behaviour.

**Scope beyond the column.** `verdict.push('FN-MISSING(...)')` lands in the same array `good` is computed
from (`trialJ.mjs:221`), so any `FN-MISSING` sets `good: false`, and `good` is what the harness prints as
`WORK ACTUALLY DONE : n/N   <- the number that matters`. Measured on the live rows:

| arm | rows | `good` as printed | `good` with `FN-MISSING` verdicts ignored |
|---|---|---|---|
| 14B | 15 | **4** | 11 |
| MoE | 17 | **9** | 17 |
| dense 32B | 14 | **5** | 13 |

So the harness's own headline understates by 7, 8 and 8 goals respectively.

**Mitigations that hold.** (1) `compare-setJ.mjs` never reads `good` — it reads `checks-J.json`'s `impl`, so
the *published* comparison is unaffected. (2) All three sibling agent reports already caught this
independently and quarantined it (`agent-report-coder3.md:13` "the live `ON DISK` column is not the score";
`agent-report-dense32b.md:158`). No downstream conclusion currently rests on it. It remains a live trap for
anyone reading the terminal.

### D2 (given) + siblings — the `err`/`grd` columns are wired to the wrong strings

The given defect (`NO CHANGE:` counted as neither) is real: 4 occurrences in the 14B arm, 2 in the dense 32B,
0 in the MoE. Four **more** classes of the same bug:

**D2a — `grd` is effectively dead, and the refusals it was meant to protect are billed to the model.**
`grd` matches `/boundary marker and/`, which in the served `agent.js` appears **only at line 352**, the
workspace-boundary-marker refusal. The two guards that actually fire in set J are worded
`ERROR: this ${tool} would have REMOVED …` (`agent.js:3538`) and `… would have DUPLICATED …` (`:3568`).
Both start `ERROR:`, neither matches `/boundary marker and/`, so **both are counted in `err`**. Measured
across the live records:

| arm | goal | table prints | truth |
|---|---|---|---|
| MoE | 5 (`s5_expr.js`) | `err 5 grd 0` | 4 × "would have REMOVED" + 1 genuine |
| dense 32B | 12 (`s2_logs.py`) | `err 4 grd 0` | 4 × "would have REMOVED" + **0 genuine** |
| dense 32B | 8 (`s8_grades.py`) | `err 3 grd 0` | 2 × DUPLICATED + 2 × NO CHANGE + 1 genuine |
| 14B | 16 (`s6_graph.py`) | `err 4 grd 0` | 3 × DUPLICATED + 1 genuine |
| 14B | 11 (`s1_library.js`) | `err 4 grd 0` | 1 × DUPLICATED + 3 genuine |

`grd` is `0` on **every row of all three arms**. The comment above it reads "A guard refusal is the system
WORKING — counted apart so it cannot penalise the fix." It does precisely what it was written to prevent:
the guard firing correctly is displayed as the model erroring. Set J exists to measure whether two guard-path
fixes move a number, so this is the most consequential mis-wiring in the file even though it does not touch
the published score.

**D2b — run-ending events are in no column at all.** `toolErrs` filters `type === 'tool'`, but loop-guard
kills, budget exhaustion and connection pauses are `type: 'error'` steps carrying `.text`, not `.result`.
Census of error-step texts: 14B has 15 (7 loop-guard kills: 2 "same tool call returned the identical answer",
5 "the same response N times"; 1 budget), MoE 6, dense 32B 4 (3 budget). None of these appear in `err`,
`grd`, or anywhere else in the table. A row can read `err 0 grd 0` and be a loop-guard death — exactly the
given symptom, and the mechanism is broader than `NO CHANGE:`.

**D2c — a failing verification run is not an error either.** A failed `node file.js` returns a result
prefixed `STDERR:` / `EXIT:`, not `ERROR:`. Counts: 14B 14 `STDERR:` + 5 `EXIT:`; MoE 8; dense 32B 15 + 3.
None counted.

**D2d — the classifier cannot distinguish a guard from a typo.** Because every refusal shares the `ERROR:`
prefix, the only way to separate "the hub protected the file" from "the model sent a bad path" is to match
the guard wording — which is what `grd` was for. Suggested repair is a single change: classify on the three
wordings the hub actually emits (`would have REMOVED`, `would have DUPLICATED`, `boundary marker and`) plus a
separate `NO CHANGE:` counter, exactly as `compare-setJ.mjs:fixSignals()` already does correctly. **The
comparator gets this right and the live table gets it wrong**, from the same records — a textbook case of the
"fix the deciding path, not the advisory one" lesson, inverted: here the advisory path is the broken one.

---

## C. Stop conditions — one real hazard, one clean

### `TRIAL_STOP_AT` — clean

`run-setJ.sh` computes `STOP = now + (CAP_MIN - 8) * 60000` and `trialJ.mjs:129` refuses to **start** a new
goal past it, printing `-- window closed: N goal(s) not started --` and breaking. It never cuts a running
goal. Verified from the status files: 14B start 06:10:39 / no new goals after 06:57:39, MoE 06:11:03 /
06:58:03, dense 32B 06:18:35 / 07:05:35 — i.e. `CAP_MIN=55` was used, not the 95 default.

Goals not started are simply absent from `rows`, and `compare-setJ.mjs` handles this correctly with its
pre-registered truncation rule (scores each arm over the goals it reached, recomputing the target over the
same range). Good.

### The 8-minute / 30-call caps — plumbed correctly

`AGENT_MAX_STEPS=30` and `AGENT_MAX_MINUTES=8` reach the hub as env vars and are read at `agent.js:123-124`.
`budgetExhausted()` (`:151`) checks **model calls** against 30 and **minutes since `budgetStart`** against 8.
The step cap fired 1× (14B), 2× (MoE), 3× (dense 32B). **The time cap has not fired once** — no
`ran out of time budget` text exists in any arm's records. `budgetStart` correctly excludes paused time
(`agent.js:4663`).

### D6 — the 10-minute harness deadline is misaligned with the hub's caps, and overrun is silently destructive

`trialJ.mjs:137` sets `deadline = Date.now() + 10 * 60000`. If it expires while the run is still active, the
`while` simply falls through: the harness pushes a row with a **non-terminal** status and immediately starts
the next goal. That `/agent/start` hits `activeTopLevelRun()` and returns **409 `busy: true` with no
`runId`** (`agent.js:4483`) → `trialJ.mjs:135` prints `START FAILED` and `continue`s.

Two compounding problems:
1. The harness's 10 minutes include paused/retry time; the hub's 8 minutes do not. A run that spends 90s in
   connection backoff (which happened — see D4) is 90s closer to the harness deadline and no closer to the
   hub's.
2. `MODEL_TIMEOUT_S=1800` allows a single model call to run 30 minutes, three times the harness deadline.

Closest approach so far: **MoE goal 9 finished at 578.7s — 21 seconds inside the 600s deadline.** 14B goal 9
was 376.7s, dense 32B goal 9 343.6s. The two `running` statuses currently persisted are just the in-flight
runs, not stranded ones. **Not yet triggered, but it came within 21 seconds, and if it triggers it can
cascade** for as long as the stuck run holds the workspace.

### D7 — `START FAILED` records nothing

`trialJ.mjs:135` `continue`s **without pushing a row**. A start failure therefore silently shrinks the
denominator, and the failed goal's identity survives only in stdout. Combined with D6 this is the cascade
path: one overrun goal can delete several goals from `rows.json` while the log still looks orderly.

### The watchdog can kill the endpoint mid-goal

`watchdog.sh` stops the Modal app on `ALL DONE` **or** at `CAP_MIN` minutes from when it armed — whichever
first. The 14B/MoE watchdogs armed 06:08 for 65 min → app stop ~07:13, while the harness may start a goal as
late as 06:57/06:58. A goal started at 06:57 that runs past 07:13 loses its endpoint mid-flight and becomes a
connection failure charged to the model (D4). Window is ~16 minutes against an 8-minute cap, so this is
unlikely but not impossible, and the failure mode is silent.

---

## D. Provenance — the fix is complete for the hub, incomplete for assets

### The hub tree: verified correct, enforced three ways

The bug fixed today was real (`HUB_ENTRY` defaulted to the main checkout while the provenance line printed
`HUB_TREE`). The repair is **complete and defence-in-depth**:

1. `run-setJ.sh` greps the served `agent.js` for `reindentTo`, `regionAnchor`, `noChangeAt` and **refuses to
   start** if any is absent.
2. `HUB_TREE` is an **inline prefix** on the `node` command, not a bare bash assignment (which would not
   export).
3. `trialJ.mjs:36` derives `HUB_ENTRY` from `HUB_TREE_EARLY`, and `:117` records the same variable, so the
   line cannot name a tree other than the one spawned.
4. Both the git sha **and** an `agent.js` md5 are recorded, covering a dirty worktree.

Independently verified on disk:

    ai-coding-hub-indent  HEAD 3d7a0800fe27a052f571d21737f08bf76f33b881   agent.js md5 d53b1f230cb0
    ai-coding-hub (main)  HEAD cb1f8ce3cb2b174f20e4ee1fee7c7ca232c80824   agent.js md5 6647c9479311

All three `*-setJ.log` files and all three `launch-*.out` files report `-indent @ 3d7a080 | md5
d53b1f230cb0`. The md5s differ between trees, so **the wrong tree is demonstrably not being served**. The
`loadGoals()` fallback also derives from `HUB_TREE_EARLY` (and is unused here anyway). No second path for the
hub itself.

### D8 — but there IS a second path: `ASSETS_ROOT`

`trialJ.mjs:37` hardcodes `ASSETS_ROOT = 'C:/Users/tatte/Projects/ai-coding-hub/assets'` — the **main
checkout** — and never derives it from `HUB_TREE`. Meanwhile the served hub resolves its own
`ASSETS_DIR = join(__dirname, '..', 'assets')` (`assets.js:38`) → the **`-indent` tree**. Those are different
directories, and they are not equivalent:

    ai-coding-hub/assets          13,525 entries
    ai-coding-hub-indent/assets   2 entries — LICENSES.md and manifest.json (13,523 items listed), zero asset files
                                  (checked the first 500 manifest entries: 0 present on disk)

`contextBlock()` (`assets.js:408`) advertises `ASSET LIBRARY: 13523 files served at assets/` straight from
the manifest with **no existence filter** — only `reindex()` filters, and it is not called on this path. So a
served run would be told 13,523 assets exist and every one would 404, while the harness's `ON DISK` check
would resolve the same paths against the main checkout and call them fine. **Two opposite errors, one on each
side of the measurement.**

**Impact on set J: nil** — no goal in `goals-J20.json` references an asset (they are `s1`–`s10`: library,
logs, matrix, markdown, expression parser, graph, cache, gradebook, kanban board, desk). This is recorded as
an *incomplete fix*, not an active defect: the principle "the tree that serves must be the tree that is
measured" was applied to `HUB_ENTRY` and the goals loader and **not** to `ASSETS_ROOT`. It will bite the first
game/asset goal set run on a worktree. It also contradicts the standing note that the hub and its verifier
must share an `assetVersion`.

---

## E. Records — one silent loss, everything else intact

### Intact and verified

- **Transcripts are genuinely untrimmed.** MoE arm: 223 transcript lines across 18 runs, kinds `plan` (16)
  and `turn` (207), **zero** truncation markers, **zero** entries missing both `reply` and `error`, longest
  reply 9,692 chars. `appendTranscript` (`agent.js:2216`) writes `sent` as the delta since the model last
  spoke **after the first call**, with the complete message list on the first — so a replay reconstructs
  faithfully. This is the fix for the set C loss (248 of 568 replies) and it is holding.
- **`slimForDisk` is not biting.** It truncates only string `args` values longer than `RUN_ARG_MAX = 30,000`
  (`agent.js:2157-2172`), leaving `result` untouched. Scanned all three arms: **0 truncated args**. The cap is
  deliberately matched to what the trace harvester keeps.
- **No run file was reaped or overwritten.** `AGENT_MAX_RUN_FILES=100000` vs a default of 300, so `reapRuns()`
  never deletes. Every run has its `.transcript.jsonl` beside it. Run-file counts (16/18/16) exceed the
  logged row counts by exactly one — the in-flight run.
- **`RESULTS_JSON` is rewritten after every goal**, so a crash loses at most the current goal.
- `run-setJ.sh` archives `runs`, `traces`, `index.jsonl` and a `git bundle --all` of the workspace, and
  deliberately never copies `hub.json` (provider keys). Correct.
- `forcedFinish` is captured per row and is **0 on all three arms** — the "a forced finish looks like done"
  hazard is not biting this set. It is captured but never printed or summarised; worth surfacing.

### D3 — `interrupted` runs are silently dropped from BOTH forever-records

`agent.js:3920` is the **single** call site for the two durable records:

    if (['done', 'error', 'stopped'].includes(run.status)) { saveTrace(run); recordRunIndex(run); }
    persist(run);   // capture final/paused state (incl. 'interrupted' and 'awaiting_approval')

`interrupted` is excluded. So an interrupted run is written to `runs/*.json` and its transcript, but **never**
to `index.jsonl` (the series kept forever) or `traces.jsonl` (the training corpus).

Measured, live: the 14B arm has **16 run files and 15 index lines**. The missing id is
`382c6ce9-71f0-4699-ac5c-7cfa7e6d4e5f` — goal 5, status `interrupted`. (The one missing id in each of the
other two arms is just the in-flight run, which has not finished yet.)

Consequence: the index says the 14B ran 15 goals when it ran 16, and the corpus has no row for a goal that
consumed 395 seconds of paid GPU. The run JSON survives, so it is recoverable — but every consumer that reads
`index.jsonl` as the record of what happened is reading a number that is quietly one short, and
`finishVerdict()` already has a `not_finished` value that would have covered this case. This is the standing
"silent failures are the class" pattern: the record reports fine while evidence is lost.

---

## F. Things that make a model look worse than it is

### D4 — an infrastructure failure is recorded as a failed goal and never retried (worst of these)

14B goal 5, run `382c6ce9`, full step trace:

    [5] tool/edit_file  OK: edited s5_expr.js; now 37 lines (+31).
    [6] error   The reply was cut off inside its code block - nothing was written; asking for the file in smaller pieces.
    [7] note    The model connection dropped (Model stream failed before any content: Premature close) - waiting 15s, retry (1/3).
    [8] note    ... waiting 30s and retrying the same call (2/3).
    [9] note    ... waiting 45s and retrying the same call (3/3).
    [10] error  Run paused at step 4 — the model is unreachable. ... then Resume. (Premature close)

The hub did the right thing: it retried three times, refunded the model calls, and **paused the run as
resumable** rather than killing it. But:

- `AGENT_SUPERVISOR=0`, so the supervisor's auto-resume of interrupted runs (`agent.js:4262`) is off.
- `trialJ.mjs` has **no resume path at all** — `interrupted` is in its terminal-status list (`:154`), so it
  scores the goal and moves on.

Result: the goal is charged to the model. Its row reads `interrupted … 395s … s5_expr.js:runs`, a half-written
file is left in the workspace, and `checks-J.mjs` will score chain 5 against that half-written state — which
also drags **goal 15** (chain 5 step 2) down, since the extension goal had no working base to extend. A
single `Premature close` costs the 14B arm up to two scored goals. This hit **only the A10G arm**.

### D5 — the arms are not on equal hardware, under a partly wall-clock cap

Measured from each arm's own `index.jsonl`:

| arm | GPU | precision | tok/s min-avg | tok/s max-avg | first-byte avg |
|---|---|---|---|---|---|
| 14B | **A10G** | AWQ 4-bit | 15.3 | 36.5 | **6,400 ms** |
| MoE | H100 | bf16 | 28.4 | **136.0** | 1,422 ms |
| dense 32B | H100 | bf16 | 18.1 | 35.4 | 4,170 ms |

The 30-**call** cap is hardware-neutral. The 8-**minute** cap is not: at 15 tok/s with a 6.4s first byte, the
14B buys materially less work per minute than the MoE's 136 tok/s peak. The time cap has not yet fired on any
arm, so **this has not yet cost a goal** — but it is a systematic, one-directional confound sitting one slow
goal away from biting, and it biases exactly the arm the pre-registration predicted would gain most.

The AWQ-vs-bf16 confound is honestly pre-registered in the README. **The A10G-vs-H100 difference is not
mentioned there** — `compare-setJ.mjs` carries the `hw` field but the README's "Held constant" section does
not list hardware. It should be stated alongside the quantisation confound.

### D9 — the scorer is chain-level, so a later goal retroactively zeroes an earlier one

`checks-J.mjs` runs **one script per chain** containing all ten step-checks against the **final** workspace.
If the file fails to load, `a.load` fails every step of that chain at once. So goal 11 breaking
`s1_library.js` marks **goal 1 failed too**, even though goal 1 was verifiably correct when it was written.

This is intentional — it is the north-star "does earlier work survive later goals?" property, and
`compare-setJ.mjs`'s create-vs-extend split is built on it. But it means the per-goal vector compared against
`BASELINE_BY_GOAL` is **not** a record of what the model did at that goal, and a per-goal delta must not be
read as a per-goal capability change. Worth stating explicitly wherever those vectors are published.

### D10 — `secs` is harness wall time, not model time

`secs = (Date.now() - t0) / 1000` spans the whole start→terminal wait, including the 3-second poll
granularity, the 1.5s post-approval sleep, and connection backoff (the 15+30+45 = 90s in goal 5 above). It is
not a model-speed measure. `index.jsonl`'s `ms` (from the run's own clock) is the better field and is already
recorded. Note also that all three arms show a large `secs` spike on goals 9–10 simultaneously (376/579/344s)
— three hubs and a browser check contending on one laptop, not a model property.

### D11 — the `named` regex only scores files beginning q–u

`/\b[qrstu][\w.]*\.(?:js|py|html|md)\b/gi` (`trialJ.mjs:167`). A goal naming `index.html` or `app.js` yields
no named files → `verdict` empty → `good = false` via the `verdict.length > 0` requirement, indistinguishable
from a real failure. Safe for set J (every file is `s1`–`s10`); fragile for the next goal set. The comment
above it records that this exact class of bug already bit once ("matching only `q` silently scored every new
goal as (no file named)") — the fix widened the character class instead of removing the assumption.

### D12 — approvals: sound, with one cost worth naming (not a defect)

`AGENT_APPROVAL_MODE=build` auto-allows build/test commands, so ordinary verification (`node x.js`,
`python x.py`) never prompts — confirmed by `policy_allowed` step counts of 29 / 46 / 35. Only genuinely
destructive commands ask. One approval fired in the whole set: MoE goal 15, `rm _snippet.py`, correctly
denied by the harness policy (`git_commit`/`git_undo` only). It is printed and collected in `approvals`, so it
is visible rather than silent. The one thing to note: a denial's recovery steps are billed to the model's
30-call budget, and that run did subsequently die on the step budget.

---

## Ranked by how much each could distort a score

Ranked by effect on **the published number** (`checks-J.json` `impl`, via `compare-setJ.mjs`), with a clear
split for the ones that distort the *diagnosis* rather than the score.

**Tier 1 — can change the published score, and one already has**

1. **D4 — infrastructure loss charged to the model.** Already cost the 14B arm goal 5, plausibly goal 15 too.
   Hit only the A10G arm, i.e. the arm the pre-registration predicts on. *Fix: resume `interrupted` runs, or
   at minimum exclude them from the denominator and re-run them.*
2. **D6 + D7 — the 10-minute deadline can silently delete goals.** An overrun makes the next start 409 and
   `START FAILED` pushes no row at all, shrinking the denominator with no record. Came within **21 seconds**
   of firing on MoE goal 9. *Fix: raise the deadline above `AGENT_MAX_MINUTES` + backoff, and always push a
   row on `START FAILED`.*
3. **D5 — A10G vs H100 under a wall-clock cap.** Systematic and one-directional; has not yet cost a goal
   because the time cap never fired, but it is undeclared in the README's "Held constant". *Fix: declare it;
   prefer the call cap over the minute cap for cross-hardware arms.*
4. **D9 — chain-level scoring.** Does not bias an arm, but means per-goal deltas cannot be read as per-goal
   capability. *Fix: documentation, not code.*

**Tier 2 — distorts the diagnosis, not the score (but the diagnosis is what set J is for)**

5. **D2a — guard refusals counted as model errors; `grd` is dead on every row of all three arms.** Set J's
   entire question is whether two guard-path fixes move the number; the column meant to keep guard behaviour
   from penalising the model reports `0` everywhere while those refusals are billed as `err`. The correct
   classifier already exists in `compare-setJ.mjs:fixSignals()`. *Highest-value cheap fix in the file.*
6. **D1 — `FN-MISSING` false on every row, and it zeroes the harness's own `WORK ACTUALLY DONE` headline**
   (4/15, 9/17, 5/14 printed vs 11/15, 17/17, 13/14 actual). Contained only because the published comparison
   does not read `good` and all three agent reports independently quarantined it.
7. **D2b/c/d — loop-guard kills, budget exhaustion and failed verification runs appear in no column**, so a
   row reads `err 0 grd 0` through a loop-guard death.

**Tier 3 — records and latent hazards**

8. **D3 — `interrupted` runs vanish from `index.jsonl` and `traces.jsonl`.** One real instance live now
   (14B: 16 runs, 15 index lines). No score impact; corrupts the forever-record and the training corpus.
9. **D8 — `ASSETS_ROOT` is a second, unfixed provenance path** pointing at the main checkout while the hub
   serves `-indent`, whose assets dir holds a 13,523-item manifest and zero files. Zero impact on set J;
   will bite the first asset-using goal set on a worktree.
10. **D11 — the `named` regex only matches files starting q–u**; a non-matching goal scores `good: false`
    indistinguishably from a real failure.

**Sound, for the record:** goal ordering and numbering (harness↔scorer aligned), per-arm workspace isolation,
hub-tree provenance (enforced three ways and verified by md5 against both trees), untrimmed transcripts,
`slimForDisk`/`RUN_ARG_MAX` not biting (0 truncations), no run files reaped or overwritten, `modelCalls`
correctly refunded for infrastructure retries, `TRIAL_STOP_AT` never cutting a running goal, and the approval
policy.
