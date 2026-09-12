# 09 — Bridge audit: hub ↔ model (set J, live)

READ-ONLY. Serving tree `ai-coding-hub-indent` @ `3d7a080`, `agent.js` md5 `d53b1f230cb0`.
Evidence read at audit time while the three GPU evaluations were still running, so per-arm
counts below are a snapshot, not final.

| arm | model | GPU | trial dir | goals scored so far |
|---|---|---|---|---|
| `coder14b-setj` | Qwen2.5-Coder-14B-Instruct-**AWQ** | A10G | `trial35-Cq4RcJ` | 16 (done 7, work 4) |
| `coder30b-setj` | Qwen3-Coder-30B-A3B-Instruct | H100 | `trial35-cWxzHB` | 18 |
| `coder32b-setj` | Qwen2.5-Coder-32B-Instruct | H100 | `trial35-8XrYOc` | 17 |

All three endpoints report `max_len: 16384` (deploy logs, `/api/health`).

---

## A. Prompt assembly — what is actually sent

Per turn, `withLedger(run.history)` (agent.js:2946-2955):

1. `system` = `SYSTEM_PROMPT` from `agentPrompt.js`, **15,811 chars (~3.9k tok)** — role, format,
   every tool's doc, RULES, worked example, BUILDING APPS, ledger discipline, VERIFY-before-finish,
   CORRECTNESS RULES.
2. `user` anchor: GOAL + workspace listing (never pruned; found by the `GOAL:` marker).
3. `assistant` `BUILD PLAN: …` + `user` "Good. Now BUILD it…" (from the separate planner call).
4. Alternating `assistant` reply / `user` `TOOL RESULT (<tool>):\n<result>` (or `TOOL REFUSED`, `TOOL ERROR`).
5. Appended **per call, never stored in history**: Google tool docs (only when connected — not here),
   the TASKS.md ledger block, the asset-library summary + canonical vocabulary.

The planner call is separate and carries its own short system prompt (137 chars; one goal in each arm
got a 97-char variant from `plannerSystemFor`).

**Verified identical across the three arms**: system prompt sha256 `2bafb070b691`, 15,811 chars, in
16/17/16 first-turn transcript records respectively.

### Inaccuracies in what the model is TOLD about its tools

1. **`append_file`'s example is ESM in a CommonJS workspace.** The same prompt says a `.js` file written
   with `import/export` "will NOT run", then documents `append_file` with
   `export function lerp(a, b, t) { … }`. The example is the part models copy. (`agentPrompt.js`, append_file block.)

2. **`append_file` is the one write path with no guards, and the prompt pushes it as the safe one.**
   `agent.js:3443-3445` captures `beforeSrc` **only** for `write_file` and `edit_file`:
   ```js
   if ((tool === 'write_file' || tool === 'edit_file') && args.path && /\.(py|c?js|mjs)$/i.test(args.path)) {
   ```
   So the destructive-write refusal, the DUPLICATE refusal, the lost-definition and lost-export warnings
   all skip `append_file`. Meanwhile the prompt says append_file "cannot lose what is there… it is the
   easiest and safest way to extend a file" and the RULES say "To ADD something to an existing file …
   use append_file". Net effect: the model is steered to the unguarded route, where appending a second
   copy of a function is accepted silently, while the *identical* change through `edit_file` is refused
   with "would have DUPLICATED". (Matches the known `append_file escapes the duplicate guard` finding —
   still true at `3d7a080`.) Guards are also limited to `.py/.js/.cjs/.mjs`; `.html`/`.md` writes are
   unguarded, and the prompt says nothing either way.

3. **The DUPLICATE refusal is documented only under `edit_file`**, but implemented for `write_file` too
   (3557-3578). A model rewriting a whole file gets a refusal its documentation never described.

4. **`edit_file` LINES vs FIND precedence is undocumented.** `if (lines) { … }` runs before the FIND
   branch, so a reply carrying both silently uses LINES and discards FIND.

5. **`OCCURRENCE` works on two different match counts.** The exact-match branch fires only when
   `exact > 1 && occurrence`; with exactly one *exact* match, OCCURRENCE is ignored and that match is
   edited — even if the model was counting the *tolerant* matches the ambiguity error just printed to it.
   The doc ("when it matches several places, add OCCURRENCE: <n>") never says matching happens in two
   passes with different counts.

6. **Tolerant edits silently re-indent the model's REPLACE** (`reindentTo`, the set J fix). Better
   behaviour, but the model is not told its indentation will be rewritten to the region's.

7. **`run_command` / `run_python` are documented as "(a human must approve it)" and mostly are not.**
   The harness runs `AGENT_APPROVAL_MODE=build`, whose BUILD allowlist auto-approves
   `node npm npx python pytest tsc git(non-publishing) mkdir cp mv …` inside the workspace
   (`approvalPolicy.js`). Observed: 36/60/44 `run_command` and 22/40/36 `run_python` steps executed across
   the three arms with exactly **one** denial (`rm _snippet.py`, 30B goal 15). Understating availability
   discourages the verify-then-fix loop the rest of the prompt demands.

8. Accurate, checked against code: `read_file` (MAP above `BIG_FILE_LINES = 250`, numbered lines,
   "… N more lines below", 14,000-char cut); `write_file`'s REMOVE escape; `edit_file`'s "OK tells you
   the new line count and whether your FIND is still there" (`changed()`); `search_file` (under-documented
   — it also accepts a directory as a scope and falls back literal→regex); the ledger/NOTES claims.
   `download_file` is documented unconditionally but only enabled behind a flag (agent.js:1669).

---

## B. History / context — the hub is sized for a window 50% larger than the server's

`pruneHistory` (2336-2410) preserves by marker: system, the `GOAL:` message, the notes anchor, the
`BUILD PLAN:`; caps each anchor at `budget/3` and each survivor at `budget/4` (middle-out truncation);
then admits recent messages newest-first until the token budget is spent, with `MIN_TAIL = 2` and
`MAX_HISTORY_MSGS = 16`. **What gets dropped is the middle** — tool results 4-10 steps back. The most
recent result is always kept, so "lost the result it most needs" is unlikely for the last one, but the
outline/line numbers a `LINES:` edit depends on are exactly the kind of mid-history result that goes.

**The numbers do not match the server:**

- `NUM_CTX = 24_576` (agent.js:166). The served window is **16,384** on all three arms.
- `contextTokensFor(db)` returns the provider row's `context_tokens` if declared. `trialJ.mjs` writes
  `hub.json` with `api_keys.ollama = { base_url, model }` only — **no `context_tokens`** — so it falls back
  to `NUM_CTX = 24,576`.
- `historyBudget = 0.55 × 24,576 = 13,516 tokens` of history, **before** the per-call ledger/asset blocks
  and **before** any output, against a 16,384-token server window.
- `num_ctx: 24576` is sent in `options` and **vLLM ignores it entirely** — `modal_serve_vllm._opts` reads
  only `temperature` and `num_predict`. Nothing on the server corrects the hub's assumption.
- `estimateTokens` is `chars / 4` (`escalate.js`). Dense code tokenizes closer to 3 chars/token, so the
  estimate that guards the budget runs ~25-30% low exactly where replies are code.

**Silent overflow at the boundary — the recovery path cannot fire.** vLLM raises an over-length prompt
error *inside the streaming generator* (`_run → gen() → self._chat → llm.generate`), after the response
headers and heartbeats are already on the wire. The hub's `CONTEXT_OVERFLOW` classifier only inspects
`r.status === 400` (agent.js ~1990). So an over-window prompt can never arrive as a 400; it arrives as a
mid-body close — i.e. as `Premature close` — and is then treated as a *dropped connection* and retried
with the identical, still-too-long history.

Evidence across all three arms: `ctxSquashes > 0`: **0**; "Context overflow" notes: **0**;
"history squashed": **0**. The automatic prune-and-retry has never run against this server.

---

## C. Streaming and failure — one goal was ended by infrastructure

Handling is sound in principle: a close **with** content keeps the partial and lets the parser judge; a
**stall** always fails the call (so a half-written `write_file` cannot execute); drops are retried
`CONN_RETRIES = 3` at 15/30/45s with `run.modelCalls--` refunds.

The one real failure, 14B/A10G, run `382c6ce9` (goal 5, `s5_expr.js`) — transcript + run file:

```
n=3 turn  sent=2415  reply=21542  (284.3 s)   <- one opening fence, ends mid-token
n=4 turn  ERROR Model stream failed before any content: Premature close   (+0.4 s)
n=4 turn  ERROR …Premature close   (+15.8 s)
n=4 turn  ERROR …Premature close   (+30.7 s)
n=4 turn  ERROR …Premature close   (+45.7 s)
```

run steps:

```
[tool] write_file  OK: wrote 102 bytes to s5_expr.js
[tool] edit_file   OK: edited s5_expr.js; now 37 lines (+31).
[error] The reply was cut off inside its code block - nothing was written; asking for the file in smaller pieces.
[note]  The model connection dropped (…Premature close) - nothing ran; waiting 15s and retrying (1/3).
[note]  … (2/3).   [note] … (3/3).
[error] Run paused at step 4 — the model is unreachable. Check Ollama is running, or re-point the
        tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
```

The n=3 reply is a runaway `write_file test_s5_expr.js` of `assert.strictEqual(evaluate('1078 / 1079 - 1080'), …)`
lines that **stops mid-token** (`…assert.strictEqual(e`) — a hard generation-limit stop, not an EOS.
`replyWasTruncated` caught it correctly and nothing was written.

Then the four identical instant failures. The input never changed between attempts and each failed in
well under a second, which is a **deterministic rejection, not a flapping network**. Reconstructed, the
history+ledger for that call is **49,768 chars**; the hub's own estimate is **12,442 tokens — under its
13,516 budget, so `pruneHistory` did not prune**. At 3 chars/token (normal for that digit-dense assert
code) the same text is **~16,600 tokens, over the server's 16,384 window**. That is the leading
explanation and it is cheaply testable offline once the GPU window closes: replay that exact recorded
history against the endpoint and see whether it returns the same instant close.

Result: `status: interrupted` → the harness scores the disk and moves on. Row 5 = `interrupted, 4 calls,
395 s, s5_expr.js:runs FN-MISSING(numbers), good=false`. **A goal that had used 4 of its 30 allowed calls
was ended by the bridge and counted as a miss in the arm's denominator (4/16).** The two H100 arms
recorded zero stream errors.

Other ways infrastructure lands on the model's score:

- The transcript's error record carries **no `sent`** — the one call you would most want to replay is the
  one the evidence does not hold.
- `pauseAdvice` names **Ollama** and tells the operator to re-point a tunnel; the endpoint is a Modal
  vLLM server registered under `api_keys.ollama`. Wrong remedy, recorded in the run.
- Retries refund `modelCalls`, but **not** the 8-minute per-run wall clock: the 92 s of backoff (and the
  284 s runaway before it) came out of the model's time budget.

---

## D. Timeouts — effective values

From `trialJ.mjs`'s spawned-hub env (overrides in **bold**):

| knob | value | default |
|---|---|---|
| `MODEL_FIRST_BYTE_S` | **600** | 420 |
| `MODEL_STALL_S` | 90 | 90 |
| `MODEL_TIMEOUT_S` | 1800 | 1800 |
| `MODEL_PROBE_S` | 8 | 8 |
| `MODEL_RETRIES` (429/5xx) | 3 | 3 |
| `AGENT_CONN_RETRIES` / `_MS` | 3 / 15000 | 3 / 15000 |
| `AGENT_MAX_STEPS` | **30** | 250 |
| `AGENT_MAX_MINUTES` | **8** | 90 |

**A slow-but-correct model is not cut off by the hub.** The serving script emits a keep-alive every
`HEARTBEAT_S = 5` while generation blocks, and the hub re-arms the stall timer on every chunk, so
`MODEL_STALL_S` can never fire mid-generation on this server; only the 1800 s ceiling bounds it. The
trade (stated in the serving script) is that a genuinely hung generation is invisible to the stall timer.
Slowest arm: the 14B/A10G reported 0.7 tok/s at its worst and its longest single call was 284 s — far
inside the ceiling. No run in any arm ended on "time budget"; six ended on the 30-call step budget.

Two timing notes: because heartbeats start immediately, `firstByteMs` measures the heartbeat, not real
time-to-first-token, so the hub's `SLOW BACKEND` warning and tok/s telemetry are measured over the whole
blocking call including queueing — it mis-describes the A10G arm but gates nothing. And
`budgetExhausted` is checked only *between* turns, so one long call can overrun the 8-minute budget.

---

## E. Sampling parameters

Hub (agent.js:1929-1935), Ollama shape:
`{ model, messages, stream: true, keep_alive: '30m', options: { temperature: 0.2, num_ctx: 24576, num_predict: -1 } }`.
`TEMPERATURE = 0.2` is a hard-coded const (not env-tunable); `NUM_PREDICT = -1`.

Server (`modal_serve_vllm._opts` / `_params`): `temp = 0.2`; `npred = -1 → npred ≤ 0 → npred = MAX_LEN`
→ `max_tokens = min(16384, 16384) = 16384`; `top_p = 0.95` (because temp > 0); **no stop sequences** on
either side. `keep_alive` is ignored by vLLM (harmless).

So `max_tokens` is never a small fixed cap — **but it is not a real 16,384 either**: the engine cannot
generate past `max_model_len − prompt_len`, so the effective output bound is 16,384 minus whatever the
prompt costs, and the hub is willing to send 13,516 *estimated* (more in real tokens) of history. On the
failing call the prompt alone was ~12.4k by the hub's own estimate. That is precisely the shape of
"the reply was cut off inside its code block": one reply in the whole set, 21,542 chars, 284 s, ending
mid-token. With no stop sequences, nothing ends a runaway early either.

---

## F. Are the three arms identical in form?

**Yes, on everything the hub controls.**

- Same hub tree and binary: `run-setJ.sh` refuses to start unless `agent.js` carries `reindentTo`,
  `regionAnchor`, `noChangeAt`; logged `3d7a080` / md5 `d53b1f230cb0` in all three run logs.
- Same harness (`trialJ.mjs`), same env block, same `goals-J20.json`, same checker.
- **System prompt byte-identical**: sha256 `2bafb070b691`, 15,811 chars, in all three arms' transcripts.
- Same request shape and parameters (temperature 0.2, num_ctx 24576, num_predict -1, stream true) — they
  come from module constants, not from per-arm configuration.
- Same serving script, same `max_len` 16384, same `MAX_CONTAINERS=1`, `@modal.concurrent(max_inputs=1)`,
  same heartbeat and top_p rule.

Intended differences: GPU (A10G vs 2×H100) and quantization (14B is AWQ 4-bit, the others bf16).

Unintended consequences of those differences, which make the arms *not quite* equally treated:
the 14B/A10G arm is the only one that met the Premature-close failure and lost a goal to it; and because
the 16,384 window and the 8-minute per-run clock are shared constants, they bind differently on an arm
generating several times slower. Goals reached in the window also differ (16/18/17), which is throughput,
not bridge.

---

## G. Does anything alter the model's text before the parser sees it?

**No.** vLLM returns `out[0].outputs[0].text`; the hub accumulates only non-empty `message.content`
(`if (j.message?.content) full += …`) with no trimming or normalisation, and `raw` is what `parseAction`
receives and what is pushed into `run.history`. Heartbeats carry `content: ""` and are skipped — correct;
the only cost is that a genuine empty chunk is indistinguishable (harmless).

After parsing, on the way to disk (all deliberate, but worth naming):

- fenced content loses exactly one trailing newline (`fenceM[2].replace(/\n$/, '')`); `clean()` strips a
  trailing fence + newline from FIND/REPLACE; `append_file` re-adds a trailing newline, `write_file` does not;
- `stripLineNumberPrefixes` rewrites content when every non-blank line carries an ascending `N: ` / `N| ` prefix;
- a tolerant edit re-indents REPLACE to the matched region (`reindentTo`);
- `capMessage` truncates history messages middle-out — that changes what the model *sees* next turn, not
  what it said.

One inconsistency: `edit_file` reads `LINES/OCCURRENCE/REMOVE/DUPLICATE` from `outside` (fenced blocks
stripped, deliberately, so file content cannot inject a directive), but **`read_file` reads its `LINES:`
from the raw `text`** — so a fenced block containing `LINES: 10-20` can change what a `read_file` action
fetches. Low severity (a read is not destructive), but it is the same injection class the edit path was
hardened against.

---

## Recommendations, cheapest first

1. **Tell the hub the truth about the window.** Set `context_tokens: 16384` on the provider row in
   `trialJ.mjs`'s `hub.json` (or set `NUM_CTX=16384` in the harness env) so `historyBudget` becomes
   ~9,011 tokens instead of 13,516. Costs nothing, changes no code.
2. **Make an over-length prompt a 400, not a dropped stream.** In `modal_serve_vllm`, tokenize and check
   `prompt_len` against `MAX_LEN` *before* returning the `StreamingResponse`, and return a 400 whose body
   says "context/too long". The hub's `CONTEXT_OVERFLOW` squash-and-retry then fires as designed instead
   of three blind retries and a paused run.
3. **Bound generation deliberately**: send `num_predict` ≈ 3072 (the serving script's own
   `DEFAULT_MAX_NEW`) rather than `-1`, so a runaway costs one truncated reply rather than the rest of the
   window — and so the truncation is a *policy*, not a side effect of prompt size.
4. **Charge estimateTokens honestly for code** (3 chars/token, or tokenize) — it is the only guard between
   the hub and the server's real limit.
5. **Record `sent` on failed calls** in the transcript, so an infrastructure failure is replayable.
6. **Fix the two doc inaccuracies that cost calls**: make the `append_file` example CommonJS, and either
   extend the destructive/duplicate guards to `append_file` or stop advertising it as the safe way to add.
7. `pauseAdvice` should name the actual endpoint (Modal/vLLM), not "the Ollama tunnel".
