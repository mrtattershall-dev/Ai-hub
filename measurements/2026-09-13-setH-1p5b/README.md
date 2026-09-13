# Set H, third model — is a 1.5B as capable at CODING as a 14B? (PRE-REGISTRATION, written before the window opens)

tatte, verbatim:

> "I don't believe in capability gap. I think 1.5b is misunderstood. It's not a generalized ai. It's just as
> capable as 14b in coding, the difference is that with larger language models the 'larger' is understanding,
> verbiage, noun understanding, definition of parse and syntax instead of just knowing what a syntax is."

> "You tell gpt to make a file for a fantasy game, it generates a photo of a fantasy game, and thats the errors
> you get when you make it too generalized."

> "Let's test it then." — then, on speed: "Use the cheapest gpu that makes 13 hours like 13 minutes",
> "I know I just want it faster", and "You have my permission to run it when it's ready."

Nobody has ever run a 1.5B on the goal sets the 14B and 30B were scored on. Every 1.5B number this project holds
comes from a four-rung ladder **I** wrote, including its proofs. This run removes that objection: same goals, same
checker, neither authored for this model.

## The design

    model    Qwen/Qwen2.5-1.5B-Instruct, served by vLLM on T4, as qwen15b
    goals    measurements/2026-09-12-setH/goals-H.json        sha256 1f29e971e72f9461...  (byte-identical to set H)
    checks   measurements/2026-09-12-setH/tools/checks-H.mjs  sha256 ea0d8b53535313ef...  (byte-identical to set H)
    harness  measurements/2026-09-12-setH/tools/trialH.mjs    sha256 a27980f8949a6dbd...
    neutral  measurements/2026-09-12-setH/tools/neutral.cjs   sha256 86fa0d1f3202c19e...
    caps     AGENT_MAX_STEPS=30, AGENT_MAX_MINUTES=8, AGENT_BATCH_ACTIONS=0, supervisor off, fresh workspace
    hub      29b08ef5c49d (this worktree) — NOT the arms' hub, see Confound 2
    app      qwen15b-seth-1p5b   (distinct name on purpose: deploying under an existing name silently REPLACES
                                  the running app — that swapped a 30B out from under live batches once)
    stop     python -m modal app stop qwen15b-seth-1p5b --yes    (the plain form prompts [y/N] and aborts
                                  non-interactively; that overran a window by ~5 min and billed for it)
    cost     T4 ~$0.59/hr; a few containers under an hour ≈ $2-5

## The comparison, banked before this run (impl = the model's own asserts NEUTRALISED)

| arm | hub | score | s3 |
|---|---|---|---|
| coder14b control | unpatched | **2/100** | 0/10 |
| coder14b treatment | eaa70c1 | **7/100** | 3/10 |
| coder30b control | unpatched | **30/100** | 6/10 |
| coder30b treatment | eaa70c1 | **39/100** | 6/10 |
| reference implementations | — | 100/100 | 10/10 (re-verified on this machine 2026-09-13) |

Measured run-to-run noise from the set G/H control pair: **score spread 1-2 points; goals-attempted spread 19.**
So score comparisons carry weight and throughput comparisons mostly do not.

## Goal composition (what is actually being asked)

    100 goals | 60 name a .js file | 41 name .py | 12 HTML/DOM/canvas | 90 say "EXISTING" (edit-in-place)

Set H is overwhelmingly **interleaved edit-in-place work**: 10 projects x 10 steps, each step growing a file the
previous step wrote. The 1.5B has never attempted this — every ladder rung wrote fresh files.

## PREDICTIONS, committed before the window (judge these, not a story told afterwards)

1. **1.5B total >= 7/100**, i.e. at or above the 14B treatment arm. Basis: tonight's measurement found its entire
   deficit is convention, not code — per 100 replies it invents 3.5 tool names, 3.5 field labels and produces 3.5
   unparseable replies, against 0.0/0.0/0.0 for the 14B — and this hub carries the dialect fixes for exactly that.
2. **1.5B total < 30/100**, i.e. below the 30B control. I do not expect parity with a 30B.
3. **Near-zero on the 12 HTML/DOM goals.** No shown shape covers DOM work.
4. **Python (41 goals) is the biggest uncertainty.** Tonight's dialect fixes are CommonJS-shaped; nothing was done
   for Python, so if the convention thesis holds the Python slice should lag the JS slice.
5. **The 14B's characteristic failure will NOT dominate the 1.5B's.** The 14B lost methods it had already written
   (`a.add is not a function`, `X.identity is not a function`, `a.inverse is not a function`) across ten edits to
   one file. If the 1.5B fails, I predict it fails EARLIER (never producing the method) rather than by destroying
   its own prior work.

**If prediction 1 fails, tatte's thesis is not supported by this test and I will say so plainly.**

## Confounds, stated before any number exists

1. **Different artefact.** Modal serves `Qwen2.5-1.5B-Instruct` in full precision via vLLM; every local number
   tonight came from Ollama's **quantised** `qwen2.5:1.5b`. Same family, not the same weights. GPU results are not
   directly comparable to tonight's local ladder numbers.
2. **Different hub.** The arms ran on `eaa70c1`; this is `29b08ef` with tonight's prompt fixes. So this is
   1.5B-on-my-hub vs 14B-on-theirs — indicative, not a controlled A/B. Set H verified its arms BY HASH precisely
   because this matters.
3. **Parallelism is containers, not threads.** `@modal.concurrent(max_inputs=1)` is deliberate: vLLM's offline
   `LLM` class is not thread-safe and a lock serialises generate() regardless. Raising it would risk corrupting
   the scheduler, so concurrency comes from MYCODER_MAX_CONTAINERS — N containers is N GPUs billing.
4. **The laptop is still in the loop.** The GPU serves tokens; the hub, tool dispatch and verification subprocesses
   run locally on 8 cores. Past a few parallel chains the laptop is the bottleneck, not the card. Expect roughly an
   hour for 100 goals, not 13 minutes.

## Why this is worth the money

The ladder's proofs are mine, so a perfect ladder score proves only that I can write an answer key. `checks-H.mjs`
was written by someone measuring a 14B, validated before any model ran (refs 100/100, empty 0/100, mutants caught),
scores the FINAL workspace, and re-runs every project with the model's own asserts neutralised so a lenient
self-test cannot buy a pass. It was re-verified at 10/10 on the reference implementations on this machine today.
That is ground truth I did not author, on goals I did not choose.

---

## ADDENDUM, written 2026-09-13 after the first attempt died (predictions above are UNCHANGED)

The pre-registration above says T4 and it is left standing, wrong hardware and all, because editing a
pre-registration after seeing a failure destroys the only thing it is for. What actually happened:

**Attempt 1 (T4 16GB, max_len 16384) died.** It served two 4-token probes in 0.42s, so I declared the
endpoint good and fired 100 goals carrying 5,000-7,000-token prompts. vLLM raised `EngineDeadError` and
every subsequent request returned HTTP 500 in ~0.3s. **`/api/health` kept returning `{"ok":true}` over a
dead engine** - it reports the configuration it was launched with, not whether the engine is alive. That
is the silent-failure class again: the instrument answered OK while the thing it measures was gone.

Six goals were spent before I stopped it. They are preserved in `t4-dead/` and **excluded from scoring**:

    1  stopped       10 steps  4 calls  301s   s1_library.js:runs FN-MISSING(book,owns)
    2  interrupted    2 steps  0 calls    3s   s2_logs.py:MISSING
    3  stopped        9 steps  1 call   521s   s3_matrix.js:MISSING      <- 521s for ONE call = the engine dying
    4  stopped        6 steps  4 calls   24s   s4_markdown.py:THROWS FN-MISSING(paragraphs)
    5  interrupted    6 steps  2 calls  151s   s5_expr.js:MISSING
    6  interrupted    6 steps  2 calls  157s   s6_graph.py:MISSING

Goal 3 is the clearest artefact of the outage: nine steps, one model call, 521 seconds. None of these six
measure the model; they measure a dead GPU, so the relaunch restarts at goal 1.

**I miscounted this twice, so the count itself is recorded here.** I first reported two contaminated goals,
then four, and the truth is six. Both wrong numbers came from reading `rows.json`, which the harness flushes
incrementally and which lost its tail when the run was killed: it holds 4 rows where `trial.log` holds 6.
**`trial.log` is the record; `rows.json` is a derived summary that can silently be short.** Anyone scoring
this run later should count goal rows in the log, not entries in the JSON. The monitor armed for the live run
is what surfaced goals 5 and 6 - it was validated by replaying it against this very log, which is the only
reason the miscount was caught before it was committed.

**Attempt 2 (this run): L4 24GB, max_len 8192, gpu_frac 0.85, min_containers 1, max_containers 2.**

The lesson is one line: **a 4-token probe does not validate an endpoint that will receive 7,000-token
prompts.** So this time the endpoint was proven with the real thing before firing - a 37,095-char prompt
(the largest shape set H produces) with an 800-token budget:

    cold first call        123s   (container start, not prefill)
    same call, repeated    2.3s, 1.8s        64-token budget
    same call, 800 tokens  3.7s, 4.2s        complete code, closing fence, not truncated

A short call immediately after the big ones returned in 0.76s, which is what separates prefill cost from
container state. Per-call latency on the L4 is therefore ~4s, not 123s.

**Confound 1 is now sharper, not weaker.** The served artefact is full-precision `Qwen2.5-1.5B-Instruct`
on vLLM; every local ladder number came from Ollama's quantised `qwen2.5:1.5b`. Different weights. This run
is comparable to the banked 14B/30B arms on goals and checker, and NOT comparable to tonight's ladder.

**Confound 4 stands and now has a number.** The GPU answers in ~4s but the hub, tool dispatch and
verification subprocesses run on this laptop's 8 cores, sequentially. Wall-clock will be dominated by the
laptop and by the 8-minute-per-goal cap, not by the card.
