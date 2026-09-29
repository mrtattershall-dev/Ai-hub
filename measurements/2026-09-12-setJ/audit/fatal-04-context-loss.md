# fatal-04 — what the model is shown, and what it loses

READ-ONLY audit. Scope: the prompt the hub builds, the history it discards, and the replies it truncates.
Serving tree `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js` (md5 `d53b1f230cb0`, the tree each arm's
log names). Evidence: 835 model calls across four arms — `coder14b-setj` (137), `coder30b-setj` (216),
`coder32b-setj` (217), `coder32b-seti` (265).

**All four arms served `max_len=16384`**, verified in each deploy log, not assumed:

    coder14b-setj  Qwen2.5-Coder-14B-Instruct-AWQ  A10G  max_len 16384
    coder30b-setj  Qwen3-Coder-30B-A3B-Instruct    H100  max_len 16384
    coder32b-setj  Qwen2.5-Coder-32B-Instruct      H100  max_len 16384
    coder32b-seti  Qwen2.5-Coder-32B-Instruct      H100  max_len 16384

## Summary of findings, ranked by goals lost

| # | finding | goals lost | status |
|---|---|---|---|
| 1 | History window is capped by **message count (12 tail msgs ≈ 6 turns)**, not tokens; 38–70% of the token budget goes unused | **2 proven** (setI 13+14), 8 implicated | measured + replayed |
| 2 | A dropped stream is retried with the **identical over-large prompt**; the hub's context recovery is unreachable against this backend | **1** (14B goal 5) | measured |
| 3 | `max_tokens` = the whole window, so a long write is bounded by `16384 − prompt` with no warning | contributes to #2 | measured |
| 4 | `estimateTokens` = chars/4 against a real 2.9–3.2 chars/token | 0 directly; it is what lets #2 and #3 happen | measured |
| 5 | The "… N earlier steps trimmed" notice under-reports loss by ~15× | unquantified | measured |

---

## A. The real prompt size per call

`run.callStats[].promptTok` is exactly `estimateTokens(msgs)` = `ceil(chars/4)`, so `chars = promptTok × 4` is a
faithful record of what was sent (content only — the chat template adds more).

| arm | calls | median chars | p90 | max | median tok @3 c/t | max tok @3 c/t |
|---|---|---|---|---|---|---|
| coder14b-setj | 137 | 23,340 | 26,920 | 29,508 | 7,780 | 9,836 |
| coder30b-setj | 216 | 26,332 | 36,760 | **52,240** | 8,777 | **17,413** |
| coder32b-setj | 217 | 25,184 | 31,088 | 36,420 | 8,395 | 12,140 |
| coder32b-seti | 265 | 24,972 | 31,748 | 48,620 | 8,324 | 16,207 |

Prompt alone is the wrong ceiling test. Because `max_tokens` is set to the entire window (section E), generation is
bounded by whatever the prompt leaves, so **prompt + reply** is what has to fit in 16,384:

| arm | calls with prompt+reply > 16,384 @3 c/t | worst call |
|---|---|---|
| coder14b-setj | 0 | 14,332 |
| coder30b-setj | **7** (all in `c75eab5e`) | 17,493 |
| coder32b-setj | 0 | 12,255 |
| coder32b-seti | **4** (`d841ad44` ×1, `33adc835` ×3) | **21,525** |

Runs that crossed: **`c75eab5e`** (30B, goal 5), **`d841ad44`** and **`33adc835`** (setI, goals 12 and 8).

### The chars/token ratio, measured rather than assumed

The hub assumes 4.0. Two independent measurements from these records:

- `c75eab5e` sent a **52,240-char prompt that the server accepted**. Had the ratio been 2.9, that is 18,014 tokens and
  vLLM would have rejected it. So for that content the ratio is **≥ 3.19**.
- `382c6ce9`'s third call returned a reply cut off mid-identifier — the signature of hitting the generation ceiling,
  not an EOS. Prompt 26,073 chars + reply 21,542 chars = **47,615 chars stopped at the 16,384 boundary → ~2.91
  chars/token** for numeric-assert JavaScript.

So the true ratio is **2.9–3.2 and content-dependent**; 4.0 is wrong by 25–38% in the dangerous direction, and no
single constant fixes it — the hub has to ask the server.

**Consequence.** `historyBudget` = `floor(24576 × 0.55)` = **13,516 est-tokens = 54,064 chars = 17,000–18,600 real
tokens.** The hub's own history budget permits a history that *cannot fit the 16,384 window* — before the system
prompt and the per-call extras are added. `NUM_CTX` is 24,576 because no arm set it; `contextTokensFor` returns it
directly for an ollama-kind provider, and `trialJ.mjs` writes the endpoint into `api_keys.ollama`, so the 16,384
the server actually serves is never consulted.

### Fixed overhead that pruning can never touch

Measured from the first call of every run:

    system prompt   15,811 chars
    TASK LEDGER        487 chars   (appended per call by withLedger, outside run.history)
    ASSET LIBRARY    2,045 chars   (ditto)
    -------------------------------
    total           18,343 chars ≈ 5,700–6,300 real tokens = 35–38% of the window, on every call

`pruneHistory` budgets as if 55% of a 24,576-token window were available for history, while ~37% of a 16,384-token
window is already spent before the goal is stated.

---

## B. `pruneHistory` — what it drops, in what order

`agent.js:2347`. Returns early unless `h.length > 16` **or** `estimateTokens(h) > budget`. Otherwise:

1. **Head (anchors), by marker not index:** `h[0]` (system), the `GOAL:` message, a `Your notes from earlier work`
   message (absent in these runs), the `BUILD PLAN:` assistant message. Each capped to `budget/3` = 4,505 est-tok.
2. **Tail, newest-first**, each capped to `budget/4` = 3,379 est-tok (13,516 chars), admitted until **either**
   `tail.length >= MAX_HISTORY_MSGS − head.length − 1` **or** the token budget is spent (`MIN_TAIL = 2` always survives).
3. Everything between head and tail is replaced by one notice message.

### The binding constraint is the message count, not tokens

With head = 3 (system, goal, plan — confirmed present in every final history), the tail cap is **16 − 3 − 1 = 12
messages**. History alternates assistant/tool-result, so **12 messages = the last 6 turns.**

I replayed `pruneHistory` verbatim over every run's reconstructed history (`scratchpad/replay-prune.js`; the
transcripts carry the true message stream, and the TASK LEDGER / ASSET LIBRARY blocks are per-call extras that never
enter `run.history`). Results:

- **Prune first fires at call 8 in every run of every arm** (occasionally call 9).
- The **token budget was never the binding constraint in any of the 835 calls.** Final windows measured 5,070–9,414
  est-tok against the 13,516 allowance — **38–70% of the history budget unused**, and ~60% of the real 16,384 window
  unused, while content was being discarded on message count alone.

So from call 8 onward the model sees: system prompt, goal, build plan, a one-line notice, and **the last 6 turns.**
Nothing else, no matter how much room is left.

### Cumulative loss vs what the model is told

In a 30-call run, **47 history messages are dropped** (18–23 of them tool results). The notice says
`(… 3 earlier steps trimmed to save context …)` — because `dropped` is computed against the *already-pruned* array,
so it reports only the current prune, never the cumulative loss. Every run in all four arms reports the same "3",
whether it ran 8 calls or 30. Across all runs the notice claimed 1,134 trimmed steps while 801 distinct messages were
actually dropped; per-call, a model at call 30 is told 3 steps are missing when 47 messages are gone.

### Can it drop a tool result the model is about to act on?

Not the immediately preceding one — `MIN_TAIL = 2` guarantees the last result survives. But **anything ≥ 7 turns back
is gone**, and that is where the damage is (section C). `capMessage` middle-truncation is rare: **4 events**, all in
one run (`d841ad44`).

---

## C. Did a run lose information and then produce wrong code?

**Yes — one proven destructive case, and it cost two goals.**

Method: for all 390 write/edit/append actions, classify by whether that file's most recent read was still in the
window at the moment of the write.

    file had been read, read STILL in the window : 158
    file NEVER read in this run                  : 208   <- model behaviour, not hub loss
    file HAD been read, read PRUNED OUT          :  24   <- the fatal class, 8 goals, all impl=false

**Honest caveat first.** 8-for-8 is *not* proof of causation. Most of those 24 are refusal-retry loops in runs already
stuck, and the arm with **zero** read-then-lost writes (the 30B) is also the best-scoring arm — so the aggregate
correlation is confounded by model strength. Within-arm there is no significant signal. The case below carries the
weight, not the correlation.

I also have to **withdraw a case I initially thought was the strongest**: 14B `ce597440` (goal 16), where the model
renamed `self._nodes` to `self.nodes` and collided with the existing `nodes()` method. The replay shows that edit was
made while the read was **still in the window**. Pruning did not cause it. Only the three *later*, already-refused
retries were made blind.

### The proven case: `coder32b-seti` `de950b2d` (setI goal 14)

Its own goal was s4_markdown.py. It finished that goal successfully and was then diverted:

- **Calls 1–13:** edits `to_html` for headings, writes `test_s4_markdown.py`, runs it —
  `Test case 1..6 passed. EXIT: 0` — and calls `finish`.
- **Call 14:** the finish gate refuses: *"Do NOT finish yet — the project does not run"*, naming **`s3_matrix.js`**,
  a file left syntactically broken by goal 13. The model diverts into a file its goal never mentioned.
- **Call 15:** reads `s3_matrix.js` lines 35–45. **Call 19:** reads lines 35–55. That is the last time it sees the file.
- **By call 25 that read has been pruned out of the window** (replay-confirmed).
- **Calls 21–30:** the model repeats one THOUGHT — *"The syntax error is due to an extra closing brace. I will remove
  the extra brace"* — issuing `edit_file` with `LINES:` and a FIND that no longer matches, walking the line range
  **down** as it guesses where the brace is: 52-53 → 51-52 → 50-51 → 49-50 → 48-49 → 47-48 → 46-47.

The `LINES:` path replaces by line number regardless of the FIND, so each call deleted a **real line of working code**.
From the tool results:

    call 26  replaced: "return new Matrix(result);"
    call 27  replaced: "const result = this.rows.map((row, i) => row.map((..."
    call 29  replaced: "throw new Error('Matrices must have the same shape..."

The file shrank **55 → 47 lines, one working line per call**, while the model believed it was deleting a stray brace
it could no longer see. Final state of `sub()` in the preserved workspace:

      sub(other) {
        // Subtraction logic here
      }

**Cost: two goals.** setI goal 14 died on the step budget having already passed its own test at call 13; setI goal 13
(`s3_matrix.js`, `add`/`sub`) scores impl=false with its `sub` body gone.

### Not context loss, reported for honesty

14B `17cc6854` (goal 8) appended the identical 284 bytes **26 times**, leaving `def add_assignment` defined 23 times
in an 8,973-byte file — all of them *after* `if __name__ == "__main__":`, so none is a method. But the traceback
naming that exact failure (`'Gradebook' object has no attribute 'add_assignment'`) was in the model's window every
time, and the run performed **zero reads**. This is a model failure amplified by a tool that answered `OK` 26 times,
not a context-loss defect.

---

## D. Stream failures

Census over all 835 calls, from the transcripts' own error records:

| arm | failed model calls |
|---|---|
| coder14b-setj | **4** (all one run) |
| coder30b-setj | 0 |
| coder32b-setj | 0 |
| coder32b-seti | 0 |

All four are `coder14b-setj` `382c6ce9`, **goal 5**, all `Model stream failed before any content: Premature close`.

**Timeline.** Call 3 ran **282 s** and returned a 21,542-char reply cut off inside its code block (the hub detected
this correctly and asked for the file in smaller pieces). Call 4 then failed four times — 11:19:09, 11:19:25,
11:19:56, 11:20:41 — with 15 s / 30 s / 45 s backoff. `connRetries` reached `CONN_RETRIES=3`; the fourth fell through
to `isConnError` and the run was set `interrupted`.

**Was it scored against the model? Yes.** `coder14b-setj-rows.json` n=5: `status: interrupted, good: false`. The
harness treats `interrupted` as terminal, records the row and moves to goal 6 — no retry, no re-run. It counts in the
arm's 16 reached goals and its published 4/16.

**Does a retry get a fresh budget?** The step is refunded (`run.modelCalls--`) but **the wall clock is not**. The run
spent 90 s of backoff out of an 8-minute budget and died at call 4 of 30 with ~6.5 minutes unused.

**Probable cause — stated as probable, not proven.** The prompt for call 4 was by far the largest the arm produced.
Reconstructed from the transcript: **47,932 chars over 16 messages ≈ 16,000 real tokens** at 3 c/t (17,750 at 2.7),
*plus* `max_tokens: 16384` requested. The shim streams keep-alive heartbeats while generating and re-raises a
generation failure after the response body has already begun — which node-fetch reports exactly as "Premature close"
with zero content accumulated. The endpoint was healthy one second later: goal 6 started at 11:20:42 and ran normally.
What would settle it is the Modal container log, which is not in these records.

**The hub-side defect is independent of the server cause, and it is the fatal part:**

- `isDropError` retries **the identical prompt**. `pruneHistory` did not fire before any of the four attempts
  (11,983 est-tok < 13,516 budget; 16 messages, not > 16), so all four sent the same over-large prompt unchanged.
- The hub's one automatic context recovery — `CONTEXT_OVERFLOW` squashing — fires only on an **HTTP 400** with a
  context-shaped body. This shim never returns one: it either succeeds or drops the stream mid-body. Confirmed:
  **`ctxSquashes` is 0 across all 835 calls in all four arms.** The recovery path is unreachable against this backend.

---

## E. `max_tokens` — what bounds a long file write

`NUM_PREDICT` defaults to **-1** (`agent.js:167`, "never truncate a long file mid-write"). On the ollama path the hub
sends `options.num_predict: -1`. The shim (`modal_serve_vllm.py:_opts`) maps `npred <= 0 → MAX_LEN`, then
`min(npred, MAX_LEN)` → **`SamplingParams(max_tokens=16384)` on every call**.

Nothing reserves room for the prompt. The effective bound on a long write is **`16384 − prompt_tokens`**: the more
context the hub sends, the less file the model can write, and neither side warns. The comment's intent — never
truncate a long write — is inverted in practice.

Two replies in the archive were cut mid-token:

- **14B `382c6ce9` call 3** — 21,542 chars, one unclosed fence, ends `assert.strictEqual(e`. Nothing was written; the
  hub detected it (`replyWasTruncated`) and asked for smaller pieces. The next call then failed 4× and the goal was lost.
- **setI `d841ad44` call 26** — 39,033 chars, ends mid-word at `if line.strip`. impl=false.

**Residual risk, not a measured loss:** `replyWasTruncated` only catches a reply whose fence is left *open*. A reply cut
**after** a closed fence but before the file is complete parses as a valid write and would land a truncated file over
working code. I found no confirmed instance in these four arms.

---

## F. Ranking, and what to fix

1. **The 12-message window (B, C).** Structural, fires at call 8 in every run, and it discards content while 38–70% of
   its own token budget and ~60% of the real window sit unused. Proven to have destroyed working code in one case
   costing two goals (setI 13+14); implicated in 8. The cap is `MAX_HISTORY_MSGS − head − 1` — a message count
   standing in for a token budget that is already computed right beside it.
2. **Retry-the-same-oversized-prompt (D).** One goal (14B goal 5) and the only infrastructure loss in 835 calls, but
   the mechanism is systemic: a drop is retried unchanged, pruning is not forced first, and the `CONTEXT_OVERFLOW`
   recovery cannot fire against a backend that drops the stream instead of returning 400.
3. **`max_tokens` = the whole window (E).** Two cut replies; one of them is the first half of finding 2.
4. **`estimateTokens` chars/4 vs a real 2.9–3.2 (A).** No goal lost to it directly, but it is what makes the 13,516
   budget unsafe and what let a 47,932-char prompt through unpruned. The budget should come from the server's
   `max_len` (16,384, which the health endpoint already reports and the hub already ignores), not from `NUM_CTX`.
5. **Found in passing, out of scope but load-bearing:** the finish gate refuses a completed goal because an
   *unrelated* file does not compile, and names that file. That is what sent `de950b2d` out of its own passing goal
   and into the blind-edit spree in finding 1.
