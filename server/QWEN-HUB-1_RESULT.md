# QWEN-HUB-1 — functional smoke of qwen/qwen3.8-27b:free through the current hub

**Frozen 2026-09-29 23:33 CDT.** NOT a Legasus benchmark. It answers one question: **can the current hub
make a stronger model act through its tools — read → edit → run → preserve existing behavior?**

## Environment established first

- **Docker was the concrete cause of the acceptance `EVALUATION_ERROR` state in this environment.** With
  the engine running, `server/acceptance.test.mjs` is **27/27** and both positive controls
  (`t2-repair-python-parse`, `t3-add-node-median`) return real PASS on candidate AND surviving workspace.
  This morning, engine down, the same test was 15 failed. Shown, not assumed.
- Pinned worker image `sha256:fa49b576…08a8c3` (`legasus-worker:1`) present locally and runs node offline.
- Both fixtures proven verifiers BEFORE any model call: each seed fails-requested / passes-protected, and
  a reference fix passes both.
- Provider probe (2 calls, free): `qwen/qwen3.8-27b:free` reachable, key valid, cost $0. It is a REASONING
  model — content is empty if `max_tokens` is tiny (all budget goes to `reasoning_tokens`); given room it
  returns normal `content` with reasoning in a separate field.

## Result — classified by `server/runClassify.mjs`

| attempt | class | model calls | changed | requested | protected |
|---|---|---|---|---|---|
| t1-repair-node-average #1 | **PROVIDER_ERROR** (OpenRouter throttle) | 1 | none | — | — |
| t1-repair-node-average #2 | **RETAINED** | 2 | stats.js | PASS | PASS |
| t3-add-node-median #1 | **PROVIDER_ERROR** (OpenRouter throttle) | 0 | none | — | — |
| t3-add-node-median #2 | **RETAINED** | 3 | numbers.js | PASS | PASS |

**Of the runs where the model actually acted: 2/2 RETAINED.** qwen read the file, made the edit through
the hub's tools, and the frozen check confirms requested behavior now passes AND protected behavior is
preserved.

## The two non-results are infrastructure, and the hub was honest about it

Both failures were **OpenRouter free-tier rate-limiting (429)**. The runs' own step text says so —
"openrouter is throttling this key" — and the hub **paused with a reason** rather than producing a fake
result. `t3#1` had **0 model calls**: the model never acted.

## A classifier defect this run produced, and the fix

The first-pass harness labelled both throttle-paused runs `RESTORED_OR_FAILED` — a model-outcome label —
because the untouched seed reads requested=FAIL / protected=PASS. **A run the model never drove was scored
on its checks.** Same class as the acceptance `EVALUATION_ERROR` debt: an instrument that did not run
producing a result-shaped output.

Fixed as a rule in `server/runClassify.mjs`: infrastructure states (`PROVIDER_ERROR`, `NOT_EVALUATED`) are
decided **by precedence, before any check verdict is read**. The load-bearing test is a FAIL CONTROL — a
throttled run whose verdicts look like a model outcome must still classify `PROVIDER_ERROR` — plus a
NON-VACUITY control proving the same verdicts DO reach a model outcome once the model is shown to have
acted. 8/8 tests pass; re-deriving the four QWEN-HUB-1 rows through the committed classifier reproduces the
hand correction.

## Boundaries — kept narrow

- **Functional hub smoke, not Legasus end-to-end.** n = 2 successful runs.
- Both successes ended at **`awaiting_approval`** (the model called a test command; auto-approval was off),
  so the verified EDIT landed and both checks pass, but the run did **not reach `finish`**. RETAINED is
  about the edit, not a completed session.
- **This has NOT shown the full launch → governed authority → effect → verification → persist/restart
  loop.** That is TEST-(-1), through the ordinary launch path, next.
- Total cost across probes + 4 runs: **$0**.

## Debt recorded, not fixed here

`server/batch.js` has the same class of hole in milder form: a throttle-paused run with 0 model actions is
still evaluated on its surviving (untouched) workspace and recorded as a behavioural verdict. It separates
termination from verdict but does not separate "model never acted" from "model acted and left a partial".
`runClassify.mjs` is where that precedence now lives; wiring `batch.js` through it is future work.
