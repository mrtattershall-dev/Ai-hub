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
    harness  measurements/2026-09-12-setH/tools/trialH.mjs    sha256 1538be4d0eb2cd83 (PATCHED 2026-09-13; was a27980f8949a6dbd)...
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

**CORRECTION, same day.** An earlier version of this file explained the 4-vs-6 row mismatch between
`rows.json` and `trial.log` as incremental flushing that "lost its tail". **That was wrong.** The real cause:
**the T4 driver was never actually stopped.** It was still running 26 minutes later (node PID 17328, started
08:42:33), grinding goals against a dead endpoint. When its log was moved to `t4-dead/`, the live process kept
appending through the moved file handle - reaching 6 rows - while `rows.json` stayed frozen at the 4 rows it
held at move time. Nothing was lost by flushing; a run I believed dead was alive and still writing.

I diagnosed a plausible file-I/O quirk when the fact was an unkilled process. The check that would have caught
it immediately is the one I skipped: list the processes. It also means the laptop was running TWO concurrent
harnesses against the same 8 cores, which is the CPU-starvation confound that corrupted a timing comparison
earlier in this same session.

**Attempt 2 (L4 24GB, max_len 8192) ALSO FAILED - 3 of 5 goals lost, 60%.** Root cause, from the
container's own log:

    ValueError: The decoder prompt (length 8357) is longer than the maximum model length of 8192.

**I set max_len too low.** The hub's prompts pass 8192 by the second goal, and set H's 10-step projects grow
from there. Each oversized call errored; the hub reads that as a dropped connection and retries the SAME
oversized prompt three times (30s, 45s), so every affected goal died after ~150s with status `interrupted`.
That is why the loss was systematic rather than random, and why goals 1 and 4 survived - their prompts were
still small.

**My validation of that endpoint was worthless, and precisely why is worth recording.** I "proved" it with a
37,095-character prompt that returned 200, and argued: if the real token count were over 8192 vLLM would
refuse, it did not, therefore the headroom is genuine. The first half is sound; the conclusion inverts it. I
proved my PROBE was under the limit, then treated that as proof the HUB's prompts were - validating with a
stand-in smaller than the thing it stood for, with `chars/4` hiding the difference. I also tested streaming
only with tiny prompts and large prompts only without streaming, never the combination the hub actually uses.

**Attempt 3 (this run): L4 24GB, max_len 32768, gpu_frac 0.85, min_containers 1, max_containers 2.**
32768 is the model's native context. KV cost is ~28 KB/token, so a full 32768-token sequence is ~0.92 GB
against ~20.4 GB available - 8192 was a T4-era number carried onto a card with 50% more memory for no reason.

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

### Attempt 3 validation (recorded BEFORE any result exists)

Endpoint under test reported `{"ok":true,"engine":"vllm","model":"Qwen/Qwen2.5-1.5B-Instruct","gpu":"L4",
"max_len":32768}`, served by a NEW app (`ap-ej5f7Z9r...`, 09:14) after the 8192 app (`ap-uoxn3ae...`, 08:51)
was stopped and confirmed at **0 tasks** - so no stale container could answer.

All three sent with `stream:true`, the path the hub actually uses:

    test         prompt                                    result
    realprompt   20,628 chars ~ 8,351 tokens (REAL,        200, 3.9s, real build plan
                 recovered from a run transcript - the
                 size that was failing at 8192)
    over2        41,261 chars ~ 16,704 tokens              200, 3.1s
    over3        61,894 chars ~ 25,058 tokens              200, 3.0s

**Why this is evidence and the previous validations were not.** `over2` and `over3` exceed 8192 tokens BY
CONSTRUCTION, so on the old endpoint they had to fail; passing is therefore informative. Attempt 2's check
could not have failed - it used a synthetic prompt that was under the limit - which is why it passed while
the endpoint was broken. A test that has never been shown to fail is not yet evidence.

Two of my "tests" during this repair also silently tested NOTHING: a filename substitution produced a path
that did not exist, curl sent an empty body, and the server returned `200` with `bytes=0`. I nearly read that
as a pass. Every request in the table above asserts its file is non-empty before sending, and an empty
response is counted as a FAIL rather than an absence of errors.

Density (SUPERSEDED - see the CORRECTION section below; the real figure is > 3.78 chars/token): `chars/4` - the estimate
that produced the 8192 sizing - overstates capacity by ~60% on this content.

### tatte's prediction, made blind during attempt 3

At 2026-09-13 14:2x UTC, with attempt 3 running, **1 goal completed** (goal 1) and no score computed - `checks-H.mjs` runs only at the end, tatte called it:

> "I think we're gonna hit 18 out of 100"

**18/100.** Logged here before any score existed, so it is judged the same way as mine. For reference, the
predictions already standing:

    tatte           18/100
    mine            >= 7/100 (at or above the 14B treatment arm) AND < 30/100 (below the 30B control)
    banked arms     14B 2 control / 7 treatment | 30B 30 control / 39 treatment | refs 100/100

tatte's 18 sits inside my band but is a far sharper call - a point estimate against my 23-point range. If the
result lands at 18 +/- 2 his number is the better prediction and mine was hedged.

### Attempt 3 (max_len 32768) STOPPED at goal 6 - and it produced the session's real finding

Rows before stopping (preserved in `l4-32768-runaway/`):

    1  stopped   6 steps   4 calls    30s   s1_library.js:runs FN-MISSING(book,owns)
    2  stopped   4 steps   1 call    485s   s2_logs.py:MISSING
    3  stopped  12 steps   7 calls    18s   s3_matrix.js:MISSING
    4  stopped  10 steps   5 calls    66s   s4_markdown.py:MISSING
    5  stopped   3 steps   1 call    488s   s5_expr.js:MISSING
    6  stopped  11 steps   5 calls    12s   s6_graph.py:MISSING

**THE FINDING: the 1.5B's dominant failure is degenerate repetition collapse, and it generates until the
context window is exhausted.** The recorded replies:

    goal 5   71,152 chars   `assert(evaluate("10/2") === 5);` repeated to the end of the window
    goal 2  133,289 chars   `- Verify that the script is ...`  repeated to the end of the window

Modal logged the matching request: `POST /api/chat -> 200 OK (duration: 478.5 s, execution: 478.4 s)`. A
SUCCESSFUL request, 478 seconds of GPU execution. Nothing was down.

**Why a bad turn became a dead goal.** `modal_serve_vllm.py` `_opts()` line 227: Ollama's `num_predict: -1`
(what `agent.js:175` sends, meaning "never truncate a long file mid-write") is translated to
`npred = MAX_LEN`. So generation is capped by the CONTEXT WINDOW, never by `DEFAULT_MAX_NEW=3072`. Raising
max_len 8192 -> 32768 therefore quadrupled the cost of every collapse, ~126s -> ~478s, which is exactly what
turns a recoverable bad turn into a goal killed by `AGENT_MAX_MINUTES=8`. The dead goals' own records say so:

    goal 2: plan -> "Could not parse an action" -> Stopped: ran out of time budget (8 min)
    goal 5: plan -> outline_file               -> Stopped: ran out of time budget (8 min)

**I called goals 2 and 5 "infrastructure loss" twice before reading these records.** They were not. My
monitor's "high seconds + <=1 model call" alarm labelled them ENGINE DEATH, which is a false positive: the
engine was healthy and generating the whole time. The keepalive log is what broke the theory - zero anomalies
during goal 5's 488 seconds, i.e. the server answered MY pings in under 2s while the hub's call ran on.

**Same root cause as the Qwen3-Coder lesson already in this project's notes: sampling was never configured.**
`_params()` sets `temperature` and `top_p` only. There is **no `repetition_penalty`**. Qwen2.5-Instruct's
model card recommends temp 0.7 / top_p 0.8 / top_k 20 / repetition_penalty 1.05; this serves temp 0.2 and
top_p 0.95 with no penalty and no top_k. The hub's loop guard has been fighting a sampling problem that was
never set.

**Decision, and the reason it is deliberately conservative.** Attempt 4 sets **max_len 16384** - which is not
a guess: `agent.js:174` declares `NUM_CTX = 16_384`, so the hub already believes it has a 16K window. 32768
hands the model more room to run away than the hub expects; 8192 is less than its real prompts need (that was
attempt 2). 16384 matches the hub and is also this deploy file's own default.

**`repetition_penalty` is deliberately NOT added.** The 14B and 30B arms were served by this same file with
these same sampling defaults. Adding a penalty now would hand the 1.5B a correction the arms never got and
break the only thing that makes this comparison meaningful. Configuring sampling per the model card is the
obvious NEXT experiment, run as its own arm - not smuggled into this one.

### CORRECTION: the "~2.47 chars/token" figure above is WRONG

I derived it by pairing a 21,157-char prompt recovered from a transcript with the 8,357-token count in the
Modal error. **Those are not the same request.** The prompt I recovered was the largest one that had a
recorded REPLY; the request that actually failed never produced a reply, so it is not in the transcript at
all. I paired a character count with a token count from a different request and then sized three rounds of
validation on the result.

Measured instead of inferred: a **66,021-char** prompt was accepted and generated at `max_len 16384`, so
density is **> 4.03 chars/token** — not 2.47 (66,021 chars also fit; the transport wall, not the model, stops anything larger). Every token estimate earlier in this file that was computed as
`chars / 2.47` overstates tokens by roughly 55% and should be read as a loose upper bound only.

**The oversize control is unreachable on this transport, and that is itself the answer.** Pushing a request
body past ~68 KB fails (measured: 67,846 B generates, 69,990 B dies) with `curl` exit 18 (`CURLE_PARTIAL_FILE`) before vLLM ever sees the prompt — which is
why three earlier "tests" returned `http=200` with `bytes=0` and no output file, and why I nearly logged them
as passes for a third time. So I cannot construct a request that exceeds 16384 tokens. But the property the
control was meant to protect holds by a wider margin than the control could have shown: the largest REAL hub
prompt across 62 recorded prompts is ~8,532 tokens (~34 KB), roughly **half** the largest body proven to fit
and generate.

**Lesson, stated plainly:** always capture the transfer's exit code. `http=200` with an empty body is not a
pass, and `grep` finding no error inside a file that was never created is not evidence of success.

### Attempt 4 — launched 2026-09-13 14:49:09 UTC (config recorded before any result)

    endpoint   L4 24GB, max_len 16384, gpu_frac 0.85, min_containers 1, max_containers 2
    verified   /api/health {"gpu":"L4","max_len":16384} AND trial.log's own ENDPOINT line
    workspace  trial35-oBCvBP (fresh)      hub 41bc7f58c162f6dcdba3fc06d87b6b0014c98d08
    caps       AGENT_MAX_STEPS=30, AGENT_MAX_MINUTES=8, AGENT_BATCH_ACTIONS=0
    artefacts  goals 1f29e971e72f9461 | checks ea0d8b53535313ef  (unchanged, byte-identical to the arms)

**Why 16384 and not something larger or smaller.** `agent.js:174` declares `NUM_CTX = 16_384`, so the hub
already assumes a 16K window; `pruneHistory` bounds prompts against a token budget derived from it
(`agent.js:2547`). 8192 truncates real prompts (that was attempt 2). 32768 hands the model more room to run
away than the hub expects, and since `_opts()` makes max-new-tokens equal to the context window, a wider
window directly multiplies the cost of a repetition collapse (that was attempt 3).

**`repetition_penalty` is deliberately NOT set.** The 14B and 30B arms were served by this same file with
these same sampling defaults (temperature + top_p only). Adding a penalty here would give the 1.5B a
correction the arms never received. A configured-sampling run is the next experiment, as its own arm.

**The oversize control was UNREACHABLE, not passed — stated honestly.** I wanted a prompt exceeding 16384
tokens to prove the limit sits where I think. I could not build one: request bodies past ~68 KB die in
transport (`curl` exit 18) before vLLM sees them — 67,846 B generates, 69,990 B does not. So the bracket has
two passes (8,351- and 12,361-char-estimated prompts, both generated) and **no failing control**. What can be
claimed instead is a bound: 66,021 chars generate fine at 16384, while the largest real hub prompt across 62
recorded prompts is ~34 KB — roughly half. The margin is real; the gate is simply not constructible here.

**What to judge this run against:** tatte 18/100; mine >= 7/100 and < 30/100. Arms: 14B 2/7, 30B 30/39,
refs 100/100. Infrastructure-lost goals will be reported separately from model failures, with the
distinguishing evidence (recorded reply length) named for each.

### Repetition collapse, QUANTIFIED at max_len 16384 (first 6 goals of attempt 4)

    1  stopped   4 calls   21s   s1_library.js  FN-MISSING(book,owns)
    2  stopped   6 calls  226s   s2_logs.py     THROWS FN-MISSING(time,status,bytes,seconds)   <- file WRITTEN
    3  stopped   5 calls   36s   s3_matrix.js   MISSING
    4  stopped   5 calls  557s   s4_markdown.py THROWS FN-MISSING(paragraphs)                  <- file WRITTEN
    5  stopped   2 calls  509s   s5_expr.js     MISSING
    6  stopped   4 calls   12s   s6_graph.py    MISSING

Measured throughput, from vLLM's own counters: **~60 tok/s output** (54.55-63.82 observed). Collapsed replies,
by character count: 26,267 / 28,231 / 27,908 / 62,465 / 41,925 / 28,076 / 26,415 / 27,322.

The arithmetic closes exactly, which is how we know these goals died of generation and not of an outage:

    goal 5  three collapses  118,604 chars ~ 29,650 tok / 60 tok/s ~ 494s   (observed 509s)
    goal 4  four  collapses  123,738 chars ~ 30,900 tok / 60 tok/s ~ 515s   (observed 557s)

**My 16384 prediction was half right, and the wrong half matters.** I predicted a collapse would cost
~120-250s and leave the goal survivable. Per collapse that holds - and goal 2 survived one, at 226s, and still
wrote its file. What I got wrong was assuming ONE collapse per goal. They repeat: 3 and 4 times in goals 5
and 4. Bounding the window bounds each collapse, not how many occur.

**The plan call collapses too, and it is invisible in `calls`.** Goal 5's row reads `2 calls` while THREE of
its replies collapsed - the 62,465-char one was the PLANNER reply, and the planner is not counted in
`modelCalls`. Any diagnosis keyed on the `calls` column will undercount this.

**3 of 6 goals affected, but there is real signal underneath.** Goals 2 and 4 wrote files with content
(`THROWS FN-MISSING(...)` = file present, function absent). The 1.5B is producing code and then losing its
budget to repetition, which is a different failure from "cannot write the code".

**Decision: the run continues UNTOUCHED.** Changing sampling now would be the fifth serving change today, would
void a pre-registered comparison, and would hand the 1.5B a `repetition_penalty` the 14B/30B arms never had.
That is the NEXT arm, run separately and reported as its own number.

**Revised ETA: ~6.3 hours** at the measured 227s/goal (6 goals in 22.7 min), not the 1.5-3 hours estimated
from the first two goals. ~$5 of L4 time.

### Attempt 4 run 1 ended at goal 17 — I corrupted it by editing the driver WHILE IT WAS RUNNING

    goal  status   calls  secs   on disk
     1   stopped     4     21   s1_library.js:runs FN-MISSING(book,owns)
     2   stopped     6    226   s2_logs.py:THROWS FN-MISSING(time,status,bytes,seconds)
     3   stopped     5     36   s3_matrix.js:MISSING
     4   stopped     5    557   s4_markdown.py:THROWS FN-MISSING(paragraphs)
     5   stopped     2    509   s5_expr.js:MISSING
     6   stopped     4     12   s6_graph.py:MISSING
     7   stopped     4    593   s7_cache.js:runs FN-MISSING(Cache)
     8   stopped     6    274   s8_grades.py:MISSING
     9   stopped     4    572   s9_board.html:ok s9_board.js:MISSING
    10   stopped     7    307   s10_desk.js:MISSING s1_library.js:runs s7_cache.js:runs
    11   stopped     4    560   s1_library.js:runs FN-MISSING(checkout,available)
    12   stopped     4    524   s2_logs.py:THROWS FN-MISSING(parse_log,bad_lines)
    13   stopped     6     72   s3_matrix.js:runs                       <- CLEAN PASS on disk
    14   stopped     4     15   s4_markdown.py:THROWS
    15   stopped     4    518   s5_expr.js:MISSING
    16   stopped     3     36   s6_graph.py:MISSING
    17   running     2    602   s7_cache.js:runs FN-MISSING(delete,clear)

16 complete, mean 302s, 9 of 16 over 250s. Preserved in `a4-run1-17goals/`; the workspace with the actual
files is `trial35-oBCvBP`.

**What I did wrong.** I launched the run at 09:49:09 and then edited `drive.sh` afterwards to fix a mangled
comment block. **Bash reads a script incrementally by byte offset.** My rewrite added 6 lines above the
command region, so when `node trialH.mjs` (line 53) finished, bash resumed at a shifted offset and executed
the invocation again — truncating `trial.log` (`> "$SP/trial.log"`) and starting a fresh workspace
`trial35-mzdCHX`. Run 1 ended ~11:19; run 2 began 11:19:46. **Never edit a shell script that is currently
executing.**

Two checks of mine failed to catch it:

  * `bash -n drive.sh` returned OK, so I called the file clean. **`bash -n` checks SYNTAX, not whether a word
    resolves to a command.** The corrupted comment produced `line 48: lama.: command not found` at runtime —
    non-fatal, so the run proceeded and the error scrolled past in the driver's output unread.
  * I read an empty `grep` for rows 11+ as "my regex is wrong" rather than "the file was truncated". The log
    had in fact been reset to a bare header. Silence is not success — again.

**UNEXPLAINED, and recorded as such:** why run 1's `trialH` stopped at goal 17 instead of continuing to 100.
The offset-shift explains the RE-LAUNCH, not the original process ending. I am not inventing a cause for it.

### CONFIRMED HUB DEFECT: sub-task calls bypass the call_loop guard

Goal 17 spent 602s with `modelCalls=1` on the parent. Its step breakdown:
`{plan:1, checkpoint:1, subtask_start:1, subtask_step:40, subtask_done:1, tool:1}` — a single
`spawn_subtask` whose sub-agent ran **40 steps in 270s, of which 39 were the byte-identical
`↳ edit_file s7_cache.js`** (2 distinct step texts across 40 steps).

The `call_loop` stop added earlier today keys on `run.callLog` / `run.callRepeats` (agent.js:3743-3785) of the
run whose loop is executing. `spawn_subtask` delegates to `runSubtask(goal, depth, _activeRun)` with its own
`sub` object, and the parent receives only a **display-only** `subtask_step` line (agent.js:2988). Grepping
the subtask path for any repeat/loop/budget guard returns **nothing**. So a sub-agent can repeat one
SUCCEEDING call 39 times and nothing stops it.

This is the house pattern again — detect-but-don't-act — reappearing inside the feature built to fix it. The
guard is real and fires at the top level (it stopped goal 3 of attempt 3); it simply does not reach one level
down.

### ROOT CAUSE: one slow goal poisons every goal after it — and `0/100` is NOT a score

Attempt 4 run 3 ended with `checks-H.mjs` reporting **0/100**. That number must not be quoted as the 1.5B's
result. **Only 11 of the 100 goals ever ran.** The other 89 failures are `missing <file>` for work never
attempted.

What actually happened, from the trial's own output:

    11  running   1 call  602s  s1_library.js:runs FN-MISSING(available)
    ...
    88  START FAILED {"error":"a run is already working in this workspace (running)"}
    ...
    100 START FAILED {"error":"a run is already working in this workspace (running)"}
    --- summary ---
    goals run : 11      wall clock : 57.7 min      total model calls : 50

The trial did NOT stop at goal 11 — it completed all 100 iterations in 57.7 minutes. `trialH.mjs:125` logs
`START FAILED` and `continue`s **without recording a row**, so 100 iterations produced 11 rows.

**The chain.** A repetition collapse generates up to ~16k tokens. At the run's observed **minimum of 16.7
tok/s** (max 65.2), that is ~950s inside a SINGLE model call. `AGENT_MAX_MINUTES=8` cannot fire mid-call —
the budget is checked between steps. `trialH.mjs:127` sets a 600s per-goal deadline; it expired first, so the
harness recorded the row as `running` and moved to the next goal **while the run was still active in the
hub**. From then on every `/agent/start` was refused 409, and goals 12-100 died instantly.

**This explains both truncations with one mechanism**: run 1 stopped at goal 17, run 3 at goal 11, each with a
`running` row at ~602s. It supersedes the "UNEXPLAINED" note recorded earlier — the driver-edit byte-offset
bug explained the RE-LAUNCH, never the ending.

**Why the arms never hit it:** no 14B or 30B goal ever exceeded 600s, so the branch was never entered. The
harness has an undiagnosed ceiling that only a model producing >600s goals can reach.

**The harness already knows about this bug class.** `trialH.mjs:135`: *"Without this one parked run held the
workspace and every later goal failed to start (set D, 14B, goal 9: 'open')."* That was fixed for
`awaiting_approval` — a parked run is drained by answering its approval. The deadline-expiry path was never
given the same treatment, so it parks a run and abandons it.

**On the pinned hash.** `trialH.mjs` is pinned at `a27980f8949a6dbd` so this is byte-comparable to the arms.
Fixing this changes that hash. The fix only alters behaviour in a branch the arms never entered (no arm goal
exceeded 600s), so it is a no-op for them and preserves comparability in substance. That argument is recorded
here rather than the hash being quietly re-pinned.

**Real signal from the 11 goals that did run** (files that exist and execute):

    s5_expr.js    threw: tokenize is not exported / toRPN is not exported / compile is not exported
    s6_graph.py   AttributeError: 'Graph' has no attribute 'reachable' / 'components'
    s6_graph.py   add_edge() takes 3 positional arguments but 4 were given
    s1_library.js threw: L is not a constructor

These are export-shape and signature failures on written, running code - not an inability to produce code.

### Harness patched: `trialH.mjs` a27980f8949a6dbd -> 1538be4d0eb2cd83

Two changes, both harness-side. **Neither alters what the model does or how work is scored.**

1. **Per-goal deadline 10 -> 30 min** (`:127`). At 10 minutes the harness abandoned a still-running goal and
   moved on, leaving the run ACTIVE in the hub, so every later `/agent/start` was refused 409. The run always
   terminates on its own — `agent.js:3190` evaluates `budgetExhausted` at the top of every turn, so once a long
   call returns `AGENT_MAX_MINUTES` ends it. The harness was giving up ~380s too early. Sizing: a full
   16384-token collapse at the observed FLOOR of 16.7 tok/s is ~981s; `MODEL_TIMEOUT_S=1800` bounds one call.
2. **A goal that never started now RECORDS A ROW** (`status: never_started_parked`, `disk: GOAL NEVER RAN`).
   Previously `:125` logged `START FAILED` and `continue`d, so 89 never-executed goals left no trace and were
   scored as model failures.

Verified by `tools/parkedRunPredicate.test.mjs` — 9/9, including four NEGATIVE controls (hub down, HTTP 500,
empty object, undefined) that must NOT be tagged parked. That direction matters: mislabelling a real failure
as "never ran" would inflate the model's score, so the test is built to catch that specifically.

**On comparability.** The pin existed so this run is byte-identical to the 14B/30B arms. It no longer is. The
justification is that both changes are only reachable for a model that produces >10-minute goals, and **no arm
goal ever exceeded 600s** — so the patched branches are unreachable for them and the fix is a behavioural
no-op on the arms' data. The original is preserved at `scratchpad/trialH.mjs.pinned-a27980f8`. This is recorded
rather than the hash being quietly re-pinned.

**What is NOT changed, deliberately:** no `repetition_penalty`, no `max_new` cap, no sampling change. The arms
ran these defaults and the 1.5B will too. Capping generation would have been the easier fix and would have
changed what the model produces; these two changes only fix the harness's bookkeeping.

**Residual risk, stated:** `MODEL_TIMEOUT_S=1800` means one pathological call could still exceed even the
30-minute deadline and park a run again. I found no hub endpoint to drain a parked run, so the cascade is made
RARE and VISIBLE rather than eliminated.

### Hypothesis sharpened by tatte, 2026-09-13 (this supersedes the loose framing above)

tatte, verbatim:

> "A better version is: a well-trained 1.5B coder may contain much of the same procedural coding knowledge as
> a 32B model, while having much less capacity to reliably retrieve, combine, and maintain that knowledge under
> pressure. Context length is one constraint, but parameter count affects much more than memory span."

> "Where your idea gets genuinely interesting is if the benchmark eventually shows the 1.5B reaching close to
> the 32B when you externally compensate for those weaknesses—good harness, iterative execution, constrained
> outputs, retrieval, task decomposition, larger external memory, retries, etc."

This is a better hypothesis than the one this file was pre-registered against, and the earlier phrasing
("as capable, the difference is context/understanding") should be read as superseded. **Context window is NOT
the operative constraint**, and this run's own failures show it:

    "export tokenize, toRPN and compile"          a spec that fits in a few dozen tokens - all three missing
    add_edge() takes 3 positional arguments but 4  signature not preserved across an edit
    L is not a constructor                          file runs; the requested API shape is not there
    3/10 identical-goal reproducibility             same goals, same config, two runs, outcomes flip BOTH ways

None of those are memory-span failures. They are failures to hold a small specification intact while doing
something else - exactly the "retrieve, combine, maintain under pressure" axis.

**We already hold one data point where scaffolding closes the gap completely.** Earlier the same day, on the
gate ladder: qwen2.5:1.5b scored 36/36 on level 1 under ONE-PROMPT-PER-GATE, and failed the same level under
the monolithic prompt - same model, same task, same machine. That is an existence proof that external
structure can substitute for parameters in a narrow domain, which is the strong form of the thesis.

### Metrics this run will report (per tatte's list), and what is NOT computable

Computable for the 1.5B from what is already recorded:

    pass rate                  checks-H.mjs (asIs + impl with own asserts neutralised)
    attempts per pass          trialH rows carry `calls` (= run.modelCalls) per goal
    tokens per successful task  hub records run.callStats[] = {ms, tokPerSec, outTok, promptTok, attempts}
    wall-clock / GPU cost      per-goal `secs`, plus Modal container-seconds
    run-to-run reproducibility  THREE independent runs now exist on identical goals+config (17, 11, and this)

**NOT computable for the 30B/14B arms: their per-goal rows are not on disk.** Only the banked aggregate scores
survive (14B 2/7, 30B 30/39). So `attempts per pass`, `tokens per pass` and reproducibility CANNOT be compared
against the arms from existing data.

**Therefore the strong experiment tatte describes - "1.5B + harness vs 32B + same harness" - is not what this
run measures.** Two gaps: (1) no per-goal arm data, and (2) Confound 2 already on record - the arms ran hub
`eaa70c1`, this runs a later hub with a patched trialH. Closing it requires re-running the 30B on THIS harness,
which needs a bigger GPU (the 30B wants ~80GB; L4 cannot hold it) and is a separate spend decision.

### CORRECTION: the arms' per-goal data DOES exist, and here is the comparison table

The section above says the arms' per-goal rows are "not on disk" and that "only the banked aggregate scores
survive". **Both statements are wrong.** They are in `scratchpad/setH-rows-backup/` as
`<arm>-rows.json` (per-goal `n,status,steps,calls,err,grd,secs,disk,good,forcedFinish`) plus
`<arm>-checks.json` (100 per-goal `asIs/impl/why`). I concluded absence from a narrow scan that never opened
the directory.

I also first computed failure modes from `scratchpad/base/coder30b-sethfix.json` (16/100) and
`base/coder14b-sethfix.json` (4/100). **Those are not the arms' results** - they are later re-scores of COPIED
workspaces and score lower because the copies lost files. The authoritative files reproduce the banked numbers
exactly: 14B ctl 2, 14B fix 7, 30B ctl 30, 30B fix 39. A mismatch against the banked figures is what caught it.

**All four arms attempted far fewer than 100 goals.** This reframes every "/100" figure:

    arm             attempted  passes  conv%   calls/goal   CALLS PER PASS   s/goal   SECS PER PASS
    14B control         49       2       4%       14.2         348.5         110s       2692s
    14B treatment       51       7      14%       10.2          74.3         103s        753s
    30B control         58      30      52%       21.0          40.6          93s        179s
    30B treatment       53      39      74%       20.1          27.3          98s        134s

**CALLS PER PASS is the sharpest discriminator, and it is exactly the axis tatte predicted.** The 30B needs
27.3 model calls per passing step; the 14B needs 74.3 - **2.7x the inference for the same outcome** - and the
unpatched 14B needs 348.5. Wall clock per pass: 134s vs 753s vs 2692s. The models are not simply "better and
worse": the smaller one reaches a pass at several times the compute, which is the "similar reachable capability,
very different single-pass competence" shape.

Note the direction of `calls/goal`: the 30B spends MORE calls per goal (20-21) than the 14B (10-14), yet far
fewer per PASS. The 14B is not being throttled - it is terminating early and often.

**FAILURE MODES (my categorisation of the checker's own `why` strings, not the checker's labels):**

    arm             INTERFACE: API absent   wrong behaviour   ran but threw
    14B control            22%                   61%              14%
    14B treatment          28%                   58%              14%
    30B control            37%                   41%              21%
    30B treatment          62%                   21%              16%

**This complicates the hypothesis in a useful way.** Interface failure - "wrote the code, the requested API is
not there" - is **not** a small-model signature. It is 62% of the BEST arm's residual failures and only 28% of
the 14B's. As a model improves it stops producing wrong behaviour, and what remains concentrates in interface
contract. So "maintaining the exact interface contract" is the LAST thing to go at every size measured here,
not a distinguishing 1.5B weakness.

What IS so far distinctive to the 1.5B is **repetition collapse**, which neither the 14B nor the 30B exhibits
in any of these four arms.

**Still not computable for the arms:** tokens per successful task (rows carry `calls`, not token counts), and
true run-to-run reproducibility (control and treatment are different hubs, not repeats; the `.0224`/`.0312`
files are mid-run snapshots of the same runs, not independent replicates).

### CORRECTION: this run is NOT per-gate. It is the SAME monolith the arms ran.

tatte reasoned that the historical 14B/30B numbers are unclean because the arms ran a monolithic prompt while
the 1.5B now gets one focused prompt per gate. **That premise is false, and it came from my own loose
summarising.** Verified:

    gateLoop/gateIndex imported by index.js, agent.js or trialH.mjs : NOTHING
    agent.js:33    import { SYSTEM_PROMPT } from './agentPrompt.js'
    agent.js:2918, 4783    { role: 'system', content: SYSTEM_PROMPT }    <- one 298-line monolith
    systemPromptFor wired into the hub : NEVER  (the [68] item, deprioritised)

`gateLoop.mjs` is a STANDALONE program sharing no code path with the hub. The per-gate architecture exists and
works, and **has never been connected to set H.** Consequences:

  * This run is **1.5B + monolithic harness** - the same architecture as the arms. The remaining difference is
    hub VERSION (arms on `eaa70c1`; this on a later hub with patched `trialH`), already logged as Confound 2.
  * So `30B = 39/53` IS a fair architectural comparator after all, and the arms' low scores remain evidence
    about model-under-monolith rather than artefacts of a different agent design.

### Scope of the 36/36 gate result - weaker than I implied

I cited it as an existence proof for externalised cognition. Its actual scope:

  * `gateLoop.mjs` is a **4-rung ladder** (add.js; s1_library.js; s2_stack.js; math.js+main.js), not 100 goals.
  * **I wrote every proof.** The file's own header says the only honest phrasing is *"same model, same goal,
    same proof, fewer guards, different prompting."*
  * The 36/36 was **level 1** - `add.js` - across wordings and temperatures. Rung 4 (two files that must
    agree) reached 10/10. That is suggestive, not a result across a varied set.

So tatte's **Hypothesis C (externalised cognition substitutes for orchestration capacity)** is plausible and
worth testing, but **my data does not yet strongly support it** and I should not have said it did. Nothing in
this run tests C at all.

### What the killer experiment actually requires

"1.5B, 14B and 30B on an identical individual-gate harness, identical goals, multiple seeds" needs:

  1. A gate harness covering set H's 100 goals. `gateLoop.mjs` has **4 hand-built rungs**; the gate definitions
     and per-gate proofs for 100 goals do not exist and are real work.
  2. Gate proofs NOT authored by me, or the 1.5B's score measures my answer key (the stated flaw in the ladder).
  3. A 30B on the same harness: ~80GB, so not an L4 - a separate spend decision.

### Goal overlap IS computable, and will be reported

Arm per-goal results are keyed `chain/step/file` with an `impl` boolean, in identical order across arms, so
`solved-by-X ∩ solved-by-Y` is directly computable - for the arms today and for the 1.5B when this run scores.
That is the comparison tatte asked for, and it is available on the monolithic architecture without new spend.

### Step 3: runtime-grounded forensic audit — the shadowing hypothesis is DEAD, and a claim of mine is withdrawn

**WITHDRAWN: "every arm was scored against a broken export check."** That was wrong. The authoritative
`checks-H.mjs` contains **zero** references to `exportNames` or `defNames`. It scores by EXECUTION -
`spawnSync` + `require()` + `typeof M[n] !== 'function'` (`checks-H.mjs:193, 253`). So the banked scores
(14B 2/7, 30B 30/39) are runtime-grounded and completely unaffected by the `exportNames` defect.

**The 62% interface-failure figure also stands.** It was computed by categorising the checker's own `why`
strings, which are produced by executing the files - not by static analysis. The `exportNames` bug corrupted
only the hub's IN-RUN guidance to the model (the missing-export note, `lostExports` refusals). Real, worth
fixing, never a scoring defect.

**Shadowed exports are essentially absent from the historical record.** Across 10 preserved workspaces and
~139 JS files, exactly ONE file (in `coder14b-sethctl`) holds more than one top-level `module.exports =`:

    coder14b-sethctl  10 js  >1 module.exports: 1        30B control     20 js  0
    coder14b-sethfix  10 js  0                           30B treatment   17 js  0
    (i32, j14, j30, j32, setH, setJ bundles)             all 0

**Every historical "X is not exported" failure audited against Node itself — 20 of 20 were never written:**

    arm            goal  file            want         runtime actually exports
    14B ctl/fix    65/75/85  s5_expr.js  tokenize/toRPN/compile   evaluate
    30B ctl/fix    65/75/85  s5_expr.js  tokenize/toRPN/compile   evaluate
    30B ctl/fix    40..90    s10_desk.js makeLookup, canBorrow,   shelfLine|availability|memberLine|...
                                         snapshot, searchLines

Not shadowed, not mis-scored, and not "defined but unexported" - `definedInText` was false in all 20, so the
requested function is absent from the file TEXT. The models did the early steps of each chain and never wrote
the later ones. The checker was right every time.

**So the 62% "code exists, API absent" category means: the FILE exists and exports OTHER things, while the
specific requested function was never written.** That is a genuine capability/effort failure, not an artefact.

**A probe artefact I caught mid-audit:** the first run labelled 11 of 20 `FILE WILL NOT LOAD`. False. Those
modules PRINT on load (`s10_desk.js` is a CLI), so stdout began with their own output and a strict
`startsWith('EXP ')` missed the marker. Scanning lines instead, all 20 load and answer. Had I reported the
first pass, I would have published "the 30B's files do not even load" - the fifth apparatus-fault-as-finding
of the day.

### The 1.5B's shadowing is its OWN failure mode, and it is narrower than I claimed

The three-export gate failure is NOT contract-retention. Dumping the bytes on 4 of 4 attempts showed the model
produced **completely correct code** - all three functions, and `module.exports = { tokenize, toRPN, compile };`
- while the ORIGINAL `module.exports = { tokenize };` survived below it, because the model's FIND spanned only
the function it was extending.

So my earlier "granularity boundary at three contracts" and the Mode A / Mode B reading are **both withdrawn**.
The honest statement: the 1.5B held all three obligations long enough to implement them correctly, then failed
at INTEGRATION - it did not remove the line its own change superseded. That is a much narrower weakness, and
one a separate exports gate eliminates by construction.

**The provisional 3/6 stays on record as provisional**, not deleted: it was measured with a runner that had a
workspace bug, and the byte-level view of the same task shows correct code every time with a shadowed export.

## Gate experiments, 2026-09-13 evening: what is DEMONSTRATED vs what is UNRESOLVED

All local (Ollama `qwen2.5:1.5b`, temp 0.2), zero GPU cost. Real `parseAction` and real `edit_file`
from `agent.js` via `__toolPolicyTest`. Every proof validated in BOTH directions before use: it must
fail on the untouched file with the expected exit code AND pass on hand-written correct code.

### THE NOISE FLOOR, measured by accident and decisive

`guarded pass@1` is the first attempt, before any feedback exists - the prompt is byte-identical
across feedback conditions, and the concrete proofs were verified to make identical pass/fail
decisions. It **cannot** be affected by the feedback manipulation. It moved **0/8 -> 3/8** between
two arms anyway.

So at N=8, differences of one, two, even three successes are not interpretable as treatment effects
in this setup. That demotes several comparisons made earlier tonight to DESCRIPTIVE observations:
v3->v4 "statefulness helps" (1/8 -> 2/8), v4->v5 (2/8 -> 3/8), and the `intent@1` swing (4/8 -> 7/8)
which was already withdrawn.

### DEMONSTRATED (existence proofs and deterministic facts)

  * A 1.5B performs tightly-scoped JS edits cleanly. `delete()` gate 12/12 and `has()` gate 8/8 on
    executed behavioural proofs, with neighbouring behaviour preserved.
  * Whitespace-tolerant matching rescues patch-location imprecision. The `has()` gate passed 8/8
    behaviourally while only 2/8 matched exactly - strong coding competence, weak location precision.
  * **Proof feedback can produce successful self-repair.** THREE directly observed
    `landed-but-failed -> PASS` transitions with state retained. This proves the mechanism CAN work.
    It does NOT establish how often, nor that statefulness raises success probability.
  * Persistent state both preserves useful partial work AND compounds damage: transition traces show
    `r0 -> r1 -> r1 -> r2` (stall then complete) and `r1 -> r1D` (valid partial then damaged).
  * Deterministic guards demonstrably PREVENT destructive edits (rollback on `lostDefs`/`lostExports`
    and on duplicate definitions). No successful recovery has yet been causally attributed to a guard
    refusal - these are not homogeneous trials, so the claim is "not observed", not "cannot happen".
  * The Python gate produces a consistent WRONG-TARGET substitution: asked to ADD `degree`, the model
    rewrites the existing `neighbors` instead, 8 of 8, pass@8 = 0. Strong local evidence of a failure
    MODE; "the model cannot do it" would need broader sampling or a changed scaffold.
  * The large-file semantic defect enters a repeated fixed point: 8 goals, all failing, retries
    largely reproducing an equivalent edit (`clear()` returning `this.items.length` AFTER clearing).
    The 21 retries are NESTED in 8 goals - effective independent N is ~8, not 21.
  * `exportNames()` was objectively wrong and is fixed. This is deterministic software evidence, not
    model sampling: old implementation fails 5 of 13 cases, fixed implementation agrees with the Node
    runtime, 95 regression tests across 10 files stay green. It did NOT contaminate authoritative
    historical scoring - `checks-H.mjs` imports only node builtins and is byte-identical.

### UNRESOLVED (effect sizes this setup cannot resolve)

  * Whether stateful repair beats stateless resampling.
  * Whether concrete counterexamples beat generic feedback.
  * Whether longer feedback alone helps (the concrete arm changed specificity AND length together).
  * How much "restore last-known-BEST state" would add over "continue from latest".
  * How any of this compares with 14B/30B under identical scaffolding.

### DESIGN CORRECTION for the 100-goal harness: pair the goals

Do not compare arms as independent proportions. Run the SAME goals under each condition and record
the per-goal outcome pair, then count DISCORDANT pairs:

    A fail / B pass      vs      A pass / B fail

Each goal acts as its own control, which buys substantially more power than comparing `41/100` with
`55/100` - and it is the only comparison that separates "the scaffold caused this" from "this run
sampled a luckier sequence". Clustering matters too: transitions and retries are nested inside goals,
so the effective N is the number of GOALS, never the number of attempts.

### The rung ladder for feedback content (only rung 2 attempted, and imperfectly)

    1  generic failure          "the behaviour check still fails"
    2  concrete observed values "called with items.length === 3; returned 0; afterward length === 0"
    3  explicit diagnosis       "the later module.exports shadows the earlier one"
    4  explicit repair          "save the length before clearing"

Rung 2 must hand back OBSERVATIONS and leave the causal inference to the model. My large-file message
violated that - it ended "which is correct - only the RETURNED VALUE is wrong", which is rung 3. The
`three-exports` message stayed clean (runtime exports vs required names, no causal claim).

## Reach x conversion: what the historical /100 scores actually conflate

Every set-H arm was REACH-LIMITED inside an ~90 minute window, not quality-limited:

    arm             attempted  calls/goal  secs/goal  wall clock  passes  conditional conversion
    14B control        49/100     14.2       110s       90 min       2          4%
    14B treatment      51/100     10.2       103s       88 min       7         14%
    30B control        58/100     21.0        93s       89 min      30         52%
    30B treatment      53/100     20.1        98s       87 min      39         74%

At ~98s/goal, 100 goals needs ~163 minutes. They had ~88. So a published `/100` conflates two
quantities:

    score = reach x conditional conversion        e.g. 30B fix: 0.53 x 0.736 = 0.39

**Both terms depend on model AND architecture: S(M,A) = R(M,A) x C(M,A).** Neither belongs solely to
one. Tonight is direct evidence that CONVERSION moves with architecture: the same 1.5B made ZERO
top-level `edit_file` calls under the monolith and scored 12/12 (`delete()`) and 8/8 (`has()`) under
narrow gates. That is not extra reach; it is a changed probability of converting an attempted task
into correct behaviour.

**WITHDRAWN: "conversion is a model property and it doesn't move", and the conclusion drawn from it
("gating widens the absolute 14B-vs-30B gap from 32 to 60").** That follows only if gating affects
reach alone, which is precisely what has not been measured. Gated conversion could rise sharply for
the weaker model, for the stronger one, for both, or for neither.

**The 74/100 projection is a reference scenario, not a forecast.** It means: *if the 47 unreached
goals had the same conditional success probability as the 53 reached ones, the expected score would
be ~74.* The attempted set is NOT a random sample - set H chains are ordered and later steps depend
on earlier ones, so the unreached tail is probably harder.

**And "throughput is orchestration" is too strong.** Goal seconds decompose as
`T_goal = T_model_inference + T_agent_overhead`, and the available rows carry `calls` and `secs` but
no token counts, so the split cannot be recovered from this data. 20 calls/goal makes orchestration
cost likely, but cutting 20 calls to 5 does not automatically yield 4x if gated calls carry richer
context and run longer.

### The table the 100-goal gated experiment must fill

    model   architecture   reach   conditional conversion   score   calls/success   time/success
    1.5B    gated            ?              ?                 ?           ?              ?
    14B     gated            ?              ?                 ?           ?              ?
    30B     gated            ?              ?                 ?           ?              ?

Compared against the monolithic arms above, that answers three separable questions instead of one:
does gating improve REACH (near-certain, but measure it); does gating improve CONVERSION (tonight
says it can, where orchestration/integration was the failure source); and does model scale still
dominate once both are optimised.

### The research question, restated

Not "is a 1.5B equivalent to a 30B" - the historical arms already make literal parity unlikely. The
question worth the GPU is:

> How much of the apparent capability gap between coding models is intrinsic competence, and how much
> is the larger model's ability to SURVIVE an architecture that forces it to internally perform
> navigation, memory, coordination, integration, repair and tool-protocol management?

A gated 1.5B landing far below a gated 30B is not a failed experiment. It measures what parameters
actually buy once the orchestration tax is stripped out.

## CONFOUNDS IN THE MODEL AXIS - the "1.5B vs 14B vs 30B" comparison cannot answer a size question

Identified 2026-09-14, and it invalidates the framing this whole file was built on.

**The three arms differ in at least six ways at once:**

    cell    model                        params        specialised  generation  serving
    small   Qwen2.5-1.5B-Instruct        1.5B dense    NO (general)  Qwen2.5     ollama Q4_K_M, CPU
    mid     Qwen2.5-Coder-14B-Instruct   14B dense     yes (coder)   Qwen2.5     AWQ on A10G
    large   Qwen3-Coder-30B-A3B          30.5B MoE,    yes (coder)   Qwen3       vLLM on H100
                                         ~3.3B ACTIVE

So the axis varies parameter count, architecture (dense vs mixture-of-experts), training generation,
code specialisation, quantisation AND serving stack simultaneously. Every "model size" statement in
this file is therefore a statement about a bundle of six differences.

**The specialisation confound is the sharpest.** Tonight's local model is `qwen2.5:1.5b` =
Qwen2.5-1.5B-**INSTRUCT**, a GENERAL model, compared against two CODE-SPECIALISED models. That
understates the small cell, and nothing in this project's notes had flagged it.

**And the MoE point matters for the "30B" label**: ~3.3B parameters are active per token, so the
large cell is not simply "20x the small cell".

### The restructured program: one factor per experiment

    SPECIALISATION  Qwen2.5-1.5B-Instruct  vs  Qwen2.5-Coder-1.5B-Instruct
                    same ollama build, same Q4_K_M, same ~986MB, same harness, same pinned decoding.
                    Asks what coder specialisation buys AT FIXED SCALE. Cleanest comparison available
                    and it costs nothing - both run locally.

    SCALE           Qwen2.5-Coder-1.5B  vs  Qwen2.5-Coder-14B
                    same family and specialisation; needs matched serving and quantisation policy.
                    This is the closest thing to a size effect this project can measure.

    ARCHITECTURE    Qwen3-Coder-30B-A3B as its own FAMILY cell, not the top of a size axis.

    ORCHESTRATION   monolithic  vs  narrow-gated  vs  narrow-gated + proof feedback,
                    crossed with the above.

### Dependent variables stay decomposed, never collapsed into one score

    generation stable -> protocol valid -> artifact emitted -> artifact integrated
      -> proof executed -> proof passed

That is what lets the write-up say WHERE scale, specialisation, decoding and orchestration each
enter the failure chain, instead of asserting that small models can or cannot code.

### Decoding must be PINNED, never inferred

Ollama's `/api/show` returns no parameter block for this model. I inferred from that that ollama's
library default `repeat_penalty 1.1` was active. **That inference is not safe** - ollama's runtime
default is documented as 1.0 (disabled), and an empty parameter block does not prove any Hugging
Face generation setting was imported. The effective penalty for tonight's runs is therefore UNKNOWN.
Every cell from here pins temperature, top_p, top_k, repeat_penalty and repeat_last_n explicitly.

The separate, still-true point: `modal_serve_vllm.py`'s `_params()` sends temperature and top_p ONLY
- no penalty, no top_k - and that is the path the GPU set-H runs used, where 71k- and 133k-character
repetition collapses were recorded.

### The suppressor sentence, with defensible wording

    "Keep it short and complete - a long answer risks being cut off before the end."

    without the sentence   7/12 produced a file
    with the sentence      0/12

Across 24 trials, adding the sentence was associated with 0/12 successes versus 7/12 without it.
These were sequential small-N runs from the same setup, and protocol-collapse variability made the
baseline far less stable than the initial 4/4 suggested - so the effect SIZE is not established, and
**what the sentence suppresses is still unknown**: file emission, collapse probability, protocol
compliance, or coding quality after a valid artifact exists. The mechanical endpoints above are what
will separate those.


---

## 2026-09-14 - the orchestration layer costs the model twice, and the instrument was wrong first

### The instrument defects came first, and every one of them moved a number

The specialisation-at-fixed-scale run (qwen2.5:1.5b vs qwen2.5-coder:1.5b, same ollama build, same
Q4_K_M, same 986MB, same goals, decoding pinned to Qwen's shipped config) reported coder 5/10
contract vs general 1/10. Dumping the workspace bytes before interpreting it found four defects:

1. **A checker branch that cannot fail.** `loadCheck` returned `{ok:true}` for html/md, and
   `deriveGate` returns no exports for goal 9 - and `[].every(...)` is `true`. Goal 9 was credited
   loads AND contract for free. The artifact it credited references `<script src="s9_board.js">`
   for a file the model never wrote and omits the required `s9-card` class. It scored the maximum.
2. **One workspace shared by both arms.** The second model overwrote the first, so the losing arm's
   artifacts were unrecoverable at analysis time.
3. **Raw replies discarded.** The runner kept `reply.length`. The short failures could not be read.
4. **Wrong path scored as silence.** The general model wrote goal 5's `evaluate` to `script.js` -
   6,220 bytes of real work - and `existsSync(lead)` scored it as having produced nothing.

The product checker `checks-H.mjs` was audited for the same class and is **clean**: it starts an
HTTP server and drives the page through puppeteer across eight behavioural steps including
localStorage persistence and WIP limits. The defect was in the scratch harness only; no published
`/100` was inflated by it.

Rebuilt with per-arm workspaces, replies written to disk **before** scoring, a real structural check
for html, and wrong-path as its own outcome. The html check was pinned by a control suite of 7 -
including a **positive** control that caught the replacement check being too strict (it demanded
`s9-card` be an `id`, when the goal text says `<li class="s9-card">`). A checker tightened without a
positive control trades free passes for false failures.

### The corrected run did not replicate its predecessor

    model                 stable  protocol  emitted  wrongPath  loads  contract
    qwen2.5:1.5b          8/10    7/10      6/10     1          2/10   2/10
    qwen2.5-coder:1.5b    10/10   2/10      2/10     0          1/10   1/10

The coder's protocol rate went **5/10 -> 2/10** with nothing changed upstream of `parseAction`.
Pure sampling on a bimodal phenomenon. Under content-only scoring both models land on 3/10. **The
"code specialisation is 5x better" reading of the first run is gone.** No per-model topology story
survives one N=10 run.

### Cost 1 - DISCARD: the harness threw away finished, working files

Re-scoring identical preserved replies with the harness supplying tool and path:

    qwen2.5-coder:1.5b   contract  1/10 -> 3/10     rescued goals 1, 6
    qwen2.5:1.5b         contract  2/10 -> 3/10     rescued goal 8
    rescued 3, lost 0 across 20 replies    exact McNemar p = 0.25 - NOT significant

Those bodies were extracted and executed: they **load and meet their export contract**. They scored
zero because the model wrote `ACTION: create_file` (twice) and `ACTION: Write`, or emitted no
`PATH:` line. Other invented tool names seen: `assert_all`, `include`, `define`, `export`.

The mechanism is readable in the bytes, so *why* is established; *how often* is not.

### Cost 2 - SUPPRESSION: the protocol stops the file being attempted at all

Three prompt shapes, paired by goal, qwen2.5-coder:1.5b:

    A  THOUGHT / ACTION / PATH / fenced body     body produced  4/10   loads 1   contract 1/10
    B          ACTION / PATH / fenced body       body produced  2/10   loads 1   contract 1/10
    C  fenced body only (harness supplies both)  body produced 10/10   loads 7   contract 5/10

    endpoint = a code body was produced at all (upstream of any parsing)
    A vs C   4/10 -> 10/10   6 discordant, 6 rescued, 0 reversed   exact McNemar p = 0.031
    B vs C   2/10 -> 10/10   8 discordant, 8 rescued, 0 reversed   exact McNemar p = 0.0078

In A and B the model emits a header and stops - **seven of B's ten replies were 35-39 characters**.
The orchestration tax was **0 in all three cells here**: no tool invention occurred, so cost 1 did
not fire at all this run. Both costs are real; which dominates varies run to run.

**The contract endpoint (1/10 -> 5/10) is p = 0.219 and is NOT significant.** What is established is
that the model attempts, and delivers a loading file, far more often.

**Removing THOUGHT made it worse (4/10 -> 2/10 bodies, p = 0.625).** That was the stated hypothesis
and it is unsupported. Cell C also BROKE one goal that passed under full protocol (goal 3).

### What content-only does NOT fix: every residual failure is a dropped obligation

Cell C's five remaining failures, by inspection of the bytes:

    goal 1   Library class correct       module.exports: 0        export obligation dropped
    goal 3   Matrix class correct        module.exports: 0        export obligation dropped
    goal 5   evaluate correct, exported  assert used 4x, require: 0   require obligation dropped
    goal 10  correct, exported           assert used 4x, never required   same
    goal 9   page correct                references a file it never wrote

**Not one is an implementation error.** Goals 1 and 3 end with demo code (`const matrix = new
Matrix(...); console.log(...)`) - the model wrote a script to run rather than a module to export,
despite the prompt stating `it must export: Matrix`. Goal 5's text says "Include asserts that all
pass, then run it with node"; the model complied and never required the module, and `assert` is not
a Node global.

This is the contract-load hypothesis appearing unprompted: implementation competence is intact, and
what degrades is the Nth obligation.

### The token budget was never binding

Longest reply 1,918 chars against a ~8,750-char budget (22%). Every stop was the model ending its
own turn. Raising `num_predict` cannot fix any failure in this corpus - the template can.

### Measurement rules this establishes

* Record the chain stage by stage: **generated -> body detectable -> parser accepts -> written ->
  loads -> contract**. Report two bottom lines - *harness-observed* (what the architecture achieves)
  and *artifact-available* (what the bytes achieve with orchestration supplied). The gap is the
  harness's own tax.
* Before concluding anything about a model from a low score, re-score its preserved replies
  content-only.
* Preserve raw replies BEFORE scoring, one workspace per arm, and ask of every endpoint: *what input
  makes this FALSE?* If there is no such input, it is not an endpoint.

### Replication at N=20: the protocol cuts REACH, not CONVERSION

Cells A and C rerun on 20 goals, qwen2.5-coder:1.5b, paired:

                            body produced   loads    contract
    A  full protocol            8/20          4        4/20
    C  content only            20/20         13       12/20

Decomposed the way score has to be decomposed here - score = reach x conditional conversion:

    REACH        a body produced at all      8/20 -> 20/20
                 12 discordant, 12 rescued, 0 reversed     exact McNemar p = 0.0005

    CONVERSION   contract GIVEN a body       5/8 (62.5%)  vs  12/20 (60.0%)
                 Fisher exact two-sided                              p = 1.000

**The protocol cuts reach. No change in conditional conversion was DETECTED** - which is not the
same claim. See the common-support correction below: the 62.5% vs 60.0% comparison was between
differently-selected denominators and should not be read as equivalence. This is the
same shape as the flat ~73% conversion recorded across 20+ hub fixes, one layer down: what moves is
reach, never quality.

The contract endpoints are significant at this N (observed p = 0.021, artifact-available p = 0.039)
but they are **less informative than the decomposition**, because artifact-available is still gated
on a body existing and therefore mostly re-measures reach. The clean quality comparison is the
conditional one, and it shows nothing.

The DISCARD cost fired once more: cell A goal 6, `ACTION: define_graph`, with a body that scored
`E L C` under artifact-available. That is a fourth verified working artifact lost to a tool name.
Tax = 1 in cell A, 0 in cell C.

### Correction: "no residual failure is an implementation error" does NOT generalize

That held for cell C on goals 1-10 and fails at N=20. Cell C's residual failures now include
genuine logic bugs - `Invalid regular expression: Range out of order in character class`,
`ValueError: invalid literal for int() with base 10`, and a hallucinated npm dependency
(`Cannot find module 'memory-cache'`) - alongside the dropped-obligation pattern (a missing
`module.exports`, a missing `require`, an html page referencing a file it never wrote). The first
ten goals were simply the easier ones. The dropped-obligation class is real; it is not the whole
residual.

### Correction: conditional conversion, restricted to the COMMON SUPPORT

The earlier comparison - full-protocol 5/8 (62.5%) vs content-only 12/20 (60.0%), Fisher p = 1.0 -
had two defects, both raised by tatte and both real:

1. **Fisher p = 1.0 does not establish equivalence.** It establishes that no difference was
   detected. On these denominators the test has almost no power.
2. **The denominators are SELECTED DIFFERENTLY.** The full-protocol arm produced bodies on 8 of 20
   goals; content-only on all 20. The extra 12 bodies plausibly come from a harder subset - exactly
   the goals orchestration prevented the other arm from attempting. The two rates describe different
   goal populations.

Recomputed from the preserved replies, restricted to goals where BOTH arms produced a body, paired:

    N=20 run, common support n=8  [goals 3,4,6,7,9,12,14,19]
        full protocol 5/8    content-only 5/8
        both 4  neither 2  discordant 2 (content-only rescued 1, broke 1)   McNemar p = 1.000

    N=10 run, common support n=4  [goals 3,4,9,10]
        full protocol 1/4    content-only 1/4
        both 0  neither 2  discordant 2 (content-only rescued 1, broke 1)   McNemar p = 1.000

    pooled        6/12 vs 6/12    4 discordant, 2 each way                  McNemar p = 1.000

Symmetric in both runs independently. This removes the selection problem - both columns describe the
same goals - and it still cannot establish equivalence at this N. The honest statement is:

> Under the current ONE-SHOT implementation condition, removing deterministic orchestration changed
> reach dramatically (8/20 to 20/20, 12 discordant, 0 reversed, p = 0.0005) and produced no evidence
> of improved conditional correctness on the goals both conditions reached.

That survives even if a repair loop later moves conversion substantially.

### Retraction: "a genuine model property that no harness cleverness will close"

Written about the ~60% conditional conversion. It was unsupported at the time and an experiment that
could falsify it was already running. A repair loop IS harness architecture; so are prompt
decomposition, proof feedback, constrained edits and retries. The claim is withdrawn and replaced by
the bounded statement above.

### What the benchmark was actually collapsing

Four distinct quantities behind one score:

    reach                 did the model attempt the artifact at all
    implementation        was the code correct once attempted
    harness preservation  did the rig keep what the model produced
    evaluator validity    could the checker have failed, and could it have passed

In paired trials, removing deterministic orchestration doubled artifact reach from 8/20 to 20/20
with **no reversed pairs**, while one-shot conditional correctness showed no detected improvement.
Separately, the harness was observed discarding at least four contract-satisfying implementations
solely because the model emitted an unrecognized action label (`create_file` x2, `Write`,
`define_graph` - each body extracted, executed, and verified to load and meet its export contract).
And evaluator defects were shown capable of BOTH directions: false passes (`[].every()` on an empty
requirement list; an unhandled file type returning ok:true) and false failures (demanding `s9-card`
be an id when the goal specifies it as a class).

The illustration is the two zeroes:

    correct protocol + stub implementation        throw new Error('Not implemented yet')
    wrong protocol label + correct implementation  ACTION: create_file, complete working class

Same score. Opposite engineering problem.

### The evaluator rule this yields

Every negative assertion needs a demonstrated FAILURE witness; every tightened checker needs a
demonstrated POSITIVE witness.

    known-bad  -> must fail
    known-good -> must pass

The `[].every()` and unhandled-type `ok:true` defects violated the first. The s9-card id/class
mistake violated the second. Either control alone would have missed one of them.

---

## QUARANTINE: every conversion number above this line is void

The contract generator that produced those runs mis-specified 7 of 20 goals, and it did not merely
mis-score the output - **it changed what the model was told to build.** `deriveGate` flattened

    "Add delete(key) and clear() to the EXISTING Cache in s7_cache.js"

into `wants = ["Cache", "delete", "clear"]`, discarding ownership. That flat list was rendered into
the PROMPT as "it must export: Cache, delete, clear", so the model wrote `function delete(key)` - a
SyntaxError, `delete` being a reserved word - and the same flat list was then used to score it.

**The prompt and the evaluator agreed with each other and both disagreed with the goal.** That is
treatment contamination, not a scoring error, so the affected results are VOID rather than
understated: once the apparatus alters the treatment, equal contamination across arms cannot be
assumed.

### What re-scoring the preserved artifacts showed

    cell C, N=20    published passes: 1,2,3,4,6,7,8,12,13,15,16,20
                    corrected passes: 1,2,3,4,6,7,8,12,15,20

    FALSE PASS (scored correct, actually wrong):  goals 13, 16
    FALSE FAIL (scored wrong, actually correct):  none

The error ran in the direction that INFLATES. Goals 13 and 16 were credited because the model
exported `add`/`sub`/`bfs` at module level exactly as the prompt demanded, and the checker looked for
them there. Goal 11 is the cleanest specimen: the model wrote correct methods AND obeyed the export
instruction -

    class Library { checkout(isbn, member) {...}  available(isbn) {...} }
    module.exports = { Library, checkout, available };     // ReferenceError at load

- a correct implementation inside a file that cannot be imported, broken by the instruction.

    three-way split under the corrected contract   PASS   PROMPT_HARMED   GENUINE   NO_BODY
      A  full protocol                               4          0            4        12
      C  content only                               10          3            7         0
      repair run, turn 1                            11          3            6         0

PROMPT_HARMED goals cannot be fixed by re-scoring; they need rerunning.

### What SURVIVES the quarantine

**Reach.** `NO_BODY` 12 in A versus 0 in C is the same 8/20 -> 20/20 result, and the contract plays
no part in whether a body was produced. The reach finding stands as recorded.

**The repair null is uninterpretable** and is withdrawn, not merely weakened: the repair gate was
asked to fix goals whose pass criterion was wrong, and in one case to fix damage the prompt caused.

### The apparatus built to prevent a repeat

  * `contract.mjs` - typed derivation: `{moduleExports, members:[{owner, kind, name}], domIds,
    domClasses}`. Ownership survives. It emits a SEPARATE human-readable rendering (what a person
    checks) and prompt rendering (what the model is told), so one heuristic no longer silently
    defines both the instruction and the evaluator.
  * `contractCheck.mjs` - module exports and class members verified as different obligations, each
    failure returning a DISTINCT rejection kind, so a repair gate can be typed on the reason.
  * `contract.test.mjs` - 15/15, both witnesses, including the regression case the old checker
    rejected. Writing the fixtures immediately exposed two more derivation bugs: prose `"a book
    (adding"` was being read as a method `book`, and a stopword list was silently deleting the real
    method `add` from goal 13.

Rendering the contract in English before running anything is what caught those. The rendering step
is not documentation - it is the test.

---

## CLEAN BASELINE - corrected contract, corrected prompts, fresh samples

qwen2.5-coder:1.5b, 20 goals, paired, same serving config / decoding / token budget / checker.
Only the orchestration wrapper differs between cells. Contract sentence identical in both.

                      REACH    parser    CONTRACT PASS
    A  full protocol   9/20      9/20         5/20
    C  content only   20/20     20/20        14/20

    REACH       11 discordant, 11 rescued, 0 reversed      exact McNemar p = 0.0010
    CONVERSION  common support n=9:  A 5/9   C 4/9
                5 discordant (C rescued 2, broke 3)        exact McNemar p = 1.000

**Reach replicates for the third independent time, now under an instrument we trust:**

    4/10 -> 10/10   p = 0.031     (old apparatus)
    8/20 -> 20/20   p = 0.0005    (old apparatus)
    9/20 -> 20/20   p = 0.0010    (corrected contract AND corrected prompts)

Zero reversals in all three. The prediction stated before the run was ~8/20 -> 20/20; the corrected
prompt is longer and names methods explicitly, and it did not suppress attempts.

**Conversion is the third consecutive null.** The discordance is not symmetric this time - C broke 3
and rescued 2, if anything favouring the full protocol - but p = 1.000. "No difference detected",
never equivalence. The common support is selected on cell A's reach set, a limitation the paired
design contains but does not remove.

### The residual has a shape now, not a count

    A   no_body 11    load_error 3   dead_ref 1
    C   missing_export 3   missing_member 2   dead_ref 2   load_error 1   missing_class 1

Cell C's six failures by inspection of the preserved bytes:

  * **goals 3, 11** - no export statement at all; both files end in demo code (`testMatrix()`,
    `library.checkout()`). Dropped-obligation class. ONE LINE each, mechanically repairable.
  * **goals 9, 19** - dead ref to `s9_board.js`, a second file never written. Missing-artifact
    class: route to a write gate, not to a repair gate.
  * **goal 10** - `describe is not defined`; the model wrote a test file against a framework global.
  * **goal 20** - NEW FAILURE CLASS, see below.

### New failure class: the model writes a program that rewrites the program

Goal 20 asks to add `availability(...)` to the EXISTING s10_desk.js and export it. The answer was:

    const fs = require('fs');
    let data = fs.readFileSync('./s10_desk.js', 'utf8');
    data += `
    exports.availability = (library, isbn) => {
      return 'available/copies';      // hardcoded stub, inside a string
    };
    `;
    fs.writeFileSync('./s10_desk.js', data, 'utf8');

`exports.availability` is inside a template literal and never executes, so `missing_export` is the
correct verdict. Two consequences worth recording:

  1. It is protocol-valid, loads without error, and exports nothing - invisible to any check that
     stops at "does it load".
  2. **Loading it OVERWROTE the file under test.** The workspace copy is corrupt and only the
     separately-preserved `.bytes` file is ground truth. Preserving bytes before scoring is what
     made this case readable at all - the same rule that was learned the hard way earlier tonight.

A load check executes model-written code with filesystem access inside the workspace. That is
inherent to executing an artifact, but this is the first observed instance of a generated file
actually mutating the workspace during evaluation.

### Triage for the repair pipeline, now on a contract worth building on

Of six residual failures: two are one-line mechanical fixes (append the export), two need a SECOND
artifact generated rather than a repair, and two are genuine misreadings of the task. Only the first
group should ever reach a deterministic repair gate; the second belongs to generation; the third is
where a narrow model gate earns its place.

---

## Execution isolation, and the held-out contract audit

**Execution contamination is now a named, tested failure class.** The canonical workspace is never
the cwd of generated code: every check copies the workspace to a disposable sandbox, runs there under
a 30s timeout, and hashes every file before and after. Mutation is reported as its own rejection kind
rather than absorbed. Ten witnesses, all passing, using goal 20's REAL bytes as the adversarial
specimen - including that a bystander artifact survives, that an artifact deleting a NEIGHBOUR cannot
reach the canonical workspace, and that an infinite loop is bounded by the timeout.

**The held-out set was audited before use, and the rendering caught three more derivation defects**
on goals 21-40, exactly as it had on 1-20:

    [29] "s9_board.html must export s9"   phantom export from "the EXISTING s9 board"; a page is not a module
    [31] missed placeHold, holds          head is prose, the API is after the colon
    [35] no contract at all               same shape: evaluate(expr, vars = {})
    [38] missed add_assignment, set_weight

Fixed, plus static-method enforcement ("a static identity(n)" is NOT satisfied by an instance
method - recording the kind without enforcing it would readmit the false-pass class). **24/24
fixtures**, both witnesses on every branch. Contracts are validated across goals 1-40.

## FIM is native, and it is this model's training objective

    ollama show qwen2.5-coder:1.5b
      Capabilities: completion, tools, INSERT
      28 blocks, 1536 hidden, 8960 FFN, 12 Q heads, 2 KV heads, RoPE 1e6, 32768 ctx, Q4_K_M

FIM is reachable through /api/generate with prompt (prefix) + suffix. A live probe asking only for a
missing method body returned **78 characters**, correct, clean stop. Assembled and EXECUTED: contract
passes, delete('a') true, delete('zz') false, size 1, clear() leaves 0, no contamination.
**N=1 - a feasibility proof, not a result.**

Qwen2.5-Coder was trained with explicit FIM and repository-level objectives (fim_prefix, fim_middle,
fim_suffix, repo_name, file_sep). So "here is the surrounding code, return the missing piece" IS the
training objective, while "here is the whole file and the error, return the corrected whole file" is
not - the most plausible explanation yet for the whole-file repair gate returning BYTE-IDENTICAL
replies on 8 of 10 goals. At temperature 0.7, copying a file handed straight back is the dominant
continuation. The localized-repair gate will use FIM, never whole-file regeneration.

### Model facts to state correctly

  * Q4_K_M is MIXED quantization, ~5.1 effective bits/param (Q4_K most matrices, Q6_K embeddings and
    some V/down projections, F32 norms). Not "4-bit".
  * 32,768 is the NATIVE context. 131,072 needs YaRN and is a DIFFERENT experimental condition.
  * Qwen3-Coder-30B-A3B is MoE: ~30.5B stored, ~3.3B ACTIVE per token - about 2.14x this model's
    active parameters, not 20x. The dense 14B is ~9.5x total, ~10x non-embedding.
  * Published 1.5B-Instruct scores move substantially with the harness (HumanEval 70.7 vs 64.6;
    MBPP 69.2 vs 51.0 in a later standardized re-evaluation). The apparatus moves public benchmark
    numbers for identical weights - the same finding this log documents from the inside.

### Bookkeeping corrections

  * The three reach runs contain **29** one-way discordant pairs (6 + 12 + 11), not 30.
  * They are **three separate replications**, not independent ones - goals and model conditions are
    reused across runs, so statistical independence is not established.
  * System-level endpoint on the clean baseline: contract pass A 5/20 vs C 14/20 decomposes to
    both 2, A-only 3, C-only 12, neither 3 - exact McNemar **p = 0.0352**. The defensible reading:
    *removing orchestration significantly improved system-level contract attainment, attributable
    primarily to increased reach rather than any detected increase in conditional artifact quality*,
    since the common-support comparison (5/9 vs 4/9, p = 1.000) argues directly against the latter.

### Protocol for the repair work, frozen before any of it is built

The six residual failures are the **development** set, not the test set. They have been inspected and
the architecture designed around their shapes; reporting uplift on them would measure how well their
lessons were encoded, not generalization.

    1. harden execution isolation                     DONE
    2. build typed repair machinery on the six        <- next
    3. FREEZE the repair rules
    4. evaluate on fresh held-out goals (21-40, contracts already audited)
    5. only then compare no-repair vs typed-repair conversion

---

# RESULT: v2 architecture on the untouched 41-60 holdout

Commit chain: `6e7bd73` axes disentangled, `a09e649` v1 frozen, `77eed90` canonical seed proven,
`68ab72c` v2 frozen, `9f66de3` analysis plan preregistered, `1b1faf7` per-trial start invariants,
`8bfeaf4` results.

Forty trials, both arms, identical model (`qwen2.5-coder:1.5b`, ollama 0.33.3, Q4_K_M, ctx 32768,
decoding pinned), identical evaluator, identical canonical starting state. Every trial asserted its
workspace hashed to the frozen seed `29c4cf9e4004311f` before generating; zero instrument errors.
Raw replies and written bytes preserved before any aggregate was computed.

## 1. Primary preregistered result

    verified goal attainment, all 20 goals
      v1  3/20        v2  11/20
      discordant 12   v1 fail -> v2 pass [43,46,47,48,50,52,56,57,58,60]
                      v1 pass -> v2 fail [41,51]
      exact McNemar p = 0.0386

    preregistered sensitivity, 19 goals, excluding weak-oracle goal 47
      v1  3/19        v2  10/19
      exact McNemar p = 0.0654      NOT significant

**The primary result is statistically fragile.** It depends on a single goal whose oracle was
labelled `STRUCTURAL_WEAK_NO_OP_PASSES` in the frozen strata - a no-op satisfies its structural
contract. The sensitivity analysis was preregistered precisely so this could not be discovered
afterwards and quietly omitted. At n=20 the primary endpoint is underpowered; it should be read as
promising, not settled.

## 2. Mechanism result (exploratory, but mechanistically stronger)

Among the 17 goals v1 failed, split by the stratum frozen BEFORE either arm generated:

    FIM_ELIGIBLE   rescued 9/10   (only goal 42 not rescued)
    fallback       rescued 1/7    (only goal 47, the weak oracle)
    Fisher exact two-sided p = 0.0037

    excluding goal 47:   9/10 versus 0/6      p = 0.0009

This cut was not the preregistered headline, so it is exploratory. It is nonetheless the more robust
finding, and there is a revealing asymmetry: **goal 47 is simultaneously the only thing propping up
the primary result (0.0386 -> 0.0654 without it) and the only thing weakening the mechanism result
(0.0037 -> 0.0009 without it).** One goal with an acknowledged-weak oracle doing contradictory work
in two analyses is a reasonable argument that the mechanism comparison is what will replicate.

### The predicted interaction held

    FIM_ELIGIBLE   13 goals   v1 3/13 -> v2 10/13    delta +7
    fallback        7 goals   v1 0/7  -> v2  1/7     delta +1

Separation is concentrated in the subset whose edit surface v2 actually changes. On those 13 goals
the intervention visibly changed the thing it was designed to change:

    whole-file rewrites   v1 12/13    v2 0/13
    lines removed         v1 1068     v2 0
    lines added           v1 311      v2 167
    outside-span changes  v1 n/a      v2 0
    span-safety rejections            v2 0

v2 deleted ZERO lines across every localized edit, at identical model cost (20 calls per arm). The
preservation layer never had to reject anything, because no localized edit ever damaged code outside
its authorized span.

### Stage decomposition

                          v1      v2
    body produced         95%    100%
    loads                 65%     90%
    structural contract   35%     70%
    verified goal         15%     55%
    behavioural goals      0%      0%

Reach was the bottleneck two experiments ago and was fixed. Whole-file integration damage was the
bottleneck after that, and localization has now attacked it. The next visible bottleneck is
behavioural delta preservation.

## 3. The behavioural null, stated precisely

Behavioural probes passed **0/6 in BOTH arms**. Every verified pass in either arm came from a
structural-only goal.

**The correct statement is NOT "v2 does not help behavioural edits".** Four of those six goals
(44, 45, 54, 55) route to whole-file fallback because `replace_method` was deliberately not wired
in, and two more (49, 59) are markup/multi-artifact goals that fall back for the same conservatism.
So **v2 was never applied to them** - they took the same path v1 took, and it failed for both.

The experiment improved the layer it changed and left untouched the layer it did not. That is a
coherent result rather than a mixed one, but it means the thesis is only established for localized
STRUCTURAL edits. There is still no evidence either way about behavioural modification.

## 4. Known v2 limitation - reported, not fixed

`add_method` inserts only `members[0]`. The outcome split perfectly:

    single-member add_method goals   7/7 PASSED   (43, 46, 48, 53, 56, 57, 58)
    two-member add_method goals      0/2 PASSED   (41 dueDay+overdue, 51 fines+pay)

**Both v1-pass -> v2-fail reversals are that one defect.** The reversal column is not random
degradation and not a measurement problem; the holdout found a crisp architectural boundary. It was
left in place rather than patched mid-experiment.

### Design trap for the v3 fix, recorded before it is built

Multi-member insertion is NOT "call FIM twice". Each insertion changes the file, so:

  * the second span must be recomputed against the POST-FIRST-INSERTION source;
  * the preservation audit must be re-baselined against that intermediate artifact.

Comparing the second insertion against the stale original would make it appear to have deleted the
first - a false preservation violation that would look exactly like model damage.

## What this establishes, and what it does not

**Established.** A 1.5B coder is substantially more reliable at localized structural edits when the
environment identifies the operation and owner, localizes the insertion, uses native FIM, forbids
unrelated edit surface, checks dependencies, isolates execution and applies typed repair. The model
gained no parameters and no extra calls. It was given less freedom, and verified output rose from
3/20 to 11/20.

**Not established.** Altering existing behaviour while preserving old behaviour; non-local semantic
change; browser-level application behaviour; survival across long sequential runs; any comparison
against 7B/14B. A model-size comparison now would measure v2's structural lane against a larger
model's everything, and the four `replace_method` goals would flatter the larger model for reasons
unrelated to parameter count.

## Scope of the claim

n=20, one model, one machine, architecture efficacy only. Both arms began from a known-good
predecessor, so this measures the edit itself and says nothing about sequential survival under
accumulated self-inflicted damage - that remains a separate experiment.

# FROZEN: what the repeatability calibration may and may not be cited for

Written 2026-09-14 after the budget investigation. The calibration (`ce7909a`, 8 independent
unseeded repeats on 8 development goals) is frozen here BEFORE its numbers get reused, because the
budget test showed that one of its failure explanations was wrong. Its pass/fail measurements are
unaffected; its causal story is not.

## TRUSTED - cite these

  * **pass/fail per repeat** and the empirical **P(pass)** per goal
  * **run-to-run disagreement** on repeated identical setups
  * the **STABLE_PASS / STOCHASTIC / STABLE_FAIL** classification
  * **goal 75 = 1/8** as the measured performance of the frozen `num_predict=600` configuration.
    This number does NOT change in light of anything below. It is what that configuration did.

## NOT CURRENTLY TRUSTED - do not cite these

  * the **exact cause of any individual failed trajectory**
  * the claim that **"12/12 v2 failures were syntax/load errors"** in the sense I used it. The LABEL
    is literally accurate - those trajectories did fail to load. What is wrong is the reading I put
    on it: I attributed them to the model emitting invalid code, and the budget test proved that at
    least some were the harness truncating valid code the model was still writing.
  * any conclusion built on those failure labels, including "the observed failure mass is
    pre-semantic" as an explanation of WHY rather than a description of WHERE it stopped.

**Why the causal story was lost:** that run recorded failure kinds and not bytes. My own
preserve-first rule, broken in the one run whose entire purpose was diagnosis. Every probe written
afterwards writes each reply to disk before classifying it.

## What the budget test settled

Same goal, same source, same prompt, same decoding, same seeds - only `num_predict` varies.

**Goal 75 was the harness.**

    seed 2   n=600   600 tok   stop=length  CAP   loads=false  -> load_error
             n=900   629 tok   stop=stop          loads=true   -> PASS
    seed 4   n=600   600 tok   stop=length  CAP   loads=false  -> load_error
             n=900   632 tok   stop=stop          loads=true   -> PASS

    n=600   PASS 0/2, hit cap 2/2        n=900   PASS 2/2, hit cap 0/2

The model needed 629-632 tokens. `arm.mjs` caps FIM at 600. It was cut off roughly 5% from the end
of a solution it had already chosen; allowed to finish, the file loads and the only remaining gap is
the missing export, which the deterministic repair closes.

**Goals 64 and 74 were NOT the harness.** 900 vs 1800 tokens, three seeds each:

    hit cap 0/12     terminated on 'stop' 12/12     loads 12/12
    old-regression green 0/12     delta 0/12
    seeds 2 and 3 produced BYTE-IDENTICAL output at both budgets

The generated `to_html` loads and implements a different, simpler renderer:

    'a\nb'  ->  'a\nb\n'                              no paragraph wrapping at all
    'a\nb'  ->  '<html><body>\na\nb\n</body></html>'   invented document scaffold
    'a\nb'  ->  '<p>a\n\n\nb'                          no line joining, unclosed tag

Asked to regenerate a whole function, the model solves an EASIER problem than the one the existing
function already solved - discarding paragraph joining, escaping, headings, emphasis, inline code,
links and lists. The old-behaviour regression gate caught this 12/12. More budget cannot fix it; the
unit of work is wrong. **The v3 conclusion therefore stands unchanged, and every v3 behavioural
failure is completed-but-wrong rather than cut off.**

**Goal 71 was not the harness either** - its FIM outputs were 120 and 139 bytes, far under any cap.

## Two harness defects disclosed, not discovered by a test that was looking for them

**1. `spanAddFunction` inserts without exporting.** It places the function correctly and never adds
it to `module.exports`, so every `add_function` goal whose contract requires an export fails on
`missing_export` until the deterministic repair fires. Traced end-to-end: route deterministic,
repair applied, contract PASS. The repair masked it completely - the defect is invisible in every
aggregate number because it is always immediately corrected.

**2. The arms used different FIM budgets.** `arm.mjs` 600, `arm3.mjs` 900. On the four v3-treatment
goals in the 61-80 pilot the arms differed by more than their two declared deltas. The direction
runs AGAINST v3 - the better-resourced arm still lost - so this does not rescue the v3 result, but
the comparison was not as clean as reported, and arms must never differ on anything but the deltas
under test. Any future arm comparison asserts budget equality as an instrument invariant.

## Consequence for how failures get classified from here on

A failure is only attributed to the model once the trajectory is shown to have terminated on `stop`
without reaching the cap. "Did not load" is a location, not a cause. Every probe preserves bytes,
token count, `done_reason` and the state before repair, so a wrong causal story can be corrected
from the record instead of re-run from scratch.

# VOID: the v3 behavioural result measured the apparatus, not the model

Written 2026-09-14, the same day as the budget freeze above, which this partly overturns. The budget
test correctly established that the v3 behavioural failures were NOT cut off by the generation cap.
It did not establish WHY they failed, and the causal story I attached to it - "the model solves an
easier problem than the one the existing function already solved" - was wrong in the same way the
calibration's failure taxonomy was wrong. I inspected the exact bytes sent to the model and found two
defects, either of which is sufficient on its own to void the measurement.

## Defect 1: the goal text never reaches the model on this route

    replaceBehaviour({ ..., fimFn: async (p, s) => fim(p, s), ... })
    async function fim(prefix, suffix) { ... body: { prompt: prefix, suffix, ... } }

Prefix and suffix are the ONLY inputs. There is no instruction channel on the
`safe_behavioural_replacement` route. The model was never told to add ordered lists, and never told
to add fenced code blocks.

## Defect 2: the two goals send a BYTE-IDENTICAL prompt

Goals 64 and 74 target the same function in the same file, so they produce the same span:

    goal 64   prefix sha256 fb9fb8a812919466 (2174B)   suffix sha256 4d1d0de022b4bf7c (699B)
    goal 74   prefix sha256 fb9fb8a812919466 (2174B)   suffix sha256 4d1d0de022b4bf7c (699B)

One prompt, two different held-out behaviours, scored against two different probes. **Passing both
was arithmetically impossible.** No model of any size could have satisfied both.

## What the model actually saw

`spanReplaceFunction` deletes the entire function body - 954 bytes, 37 lines containing paragraph
joining, escaping, headings, emphasis, inline code, links and unordered lists. None of it appears in
the prefix or the suffix: `flush_para`, `flush_list` and the hyphen-space list branch are all absent.
What remains is `_escape`, `_inline`, `_is_heading`, the line `def to_html(`, and ten asserts.

The nearest thing to an instruction in that prompt is the seed's own header line:

    # Goals 61+ are HELD OUT and deliberately not implemented.

So the model's only hint about the task is a sentence stating that the task is not implemented. Given
`def to_html(` and ten asserts, a plausible simple markdown renderer is a REASONABLE completion of
the prompt it actually received. The outputs stop looking like failure to preserve a complex function
and start looking like correct behaviour on a different question.

**The architecture erased the implementation whose behaviour had to be preserved, did not say what to
add, and then tested whether the erased behaviour survived.** The regression suite was protecting
information the generator was never given.

## What survives and what does not

**VOID - measured the apparatus.** The 0/4 behavioural result on the v3 treatment goals, the 0/12 in
the budget test, and any statement of the form "the 1.5B cannot do behavioural edits" or "whole-
function semantic work is too difficult for a 1.5B". The treatment never delivered the task.

**STILL TRUSTED - unaffected by this.** The old-behaviour regression gate, which did its job 12/12:
it refused every bad reconstruction and rolled back rather than letting it become authoritative. Full
rollback, span-boundary preservation and the baseline-must-pass-first refusal all behaved exactly as
designed under a generator that was being fed an impossible prompt. The v2 structural result (3/20 to
11/20) is on a different route and is untouched. So is the budget finding itself: these failures did
terminate on `stop` without hitting the cap.

## PROVEN: the held-out behaviour is expressible as a PURE INSERTION

Function-level confinement was already established - a correct implementation fits inside `to_html`.
That is what justified replacement. The stronger property was never tested, and it holds. Reference
patches, hand-written, expressed as anchored insertions with every anchor required to occur exactly
once, no model involved (`results-void-v3-behavioural/localdelta.mjs`):

                                                 goal 64      goal 74
      insertion sites                                  7            3
      existing lines DELETED or MODIFIED               0            0
      original to_html surviving byte-identical    37/37        37/37
      new lines the model must write                  16           15
      OLD regression suite                          PASS         PASS
      NEW delta probe                               PASS         PASS

Zero existing lines need to change. Whole-function replacement deletes 954 bytes in order to add 15.
Because the correct edit is insertion-only, the v2/v3 insertion preservation audit applies to it
directly - `insertionOnly` and `survivingSymbols` become usable again, which they are not for a
replacement.

## The corrected progression

    v2    do not regenerate the whole FILE       - keep the file, localize the edit
    v3    do not regenerate unrelated behaviour  - verify old behaviour after the edit
    next  do not DELETE the behaviour to be preserved, and SAY WHAT TO ADD
          - keep the existing body visible, generate only the new branch, and put the goal in the
            prompt

Two separate corrections are needed, not one. Restoring the body without adding an instruction
channel still cannot work: the model would see the code but still not know which of ordered lists or
fenced code blocks to add. A test that varies only body visibility would fail for the second reason
and be misread as evidence against localization, so it must not be run on its own.

## Process note

Both defects were found by dumping the exact bytes sent to the model rather than by reading the
harness code, and the same inspection would have caught them before the pilot ran. Every generation
route must now be able to print its complete prompt, and a route whose prompt does not vary with the
goal text is an instrument failure to be asserted against, not something to be discovered afterwards
from output that looks like model error.

# PREREGISTRATION: behaviour-localization feasibility (written before the run, results not yet seen)

Development goals only. **This is not v4 and it is not v4 performance.** It exists to decide whether v4
is worth building at all, by separating two apparatus defects from model capability. tatte's framing:
"Do the minimal corrected mechanism experiment first. Do not build v4 yet."

## The question

The v3 behavioural lane was not weak, it was **non-identifying** - no goal text reached the model and
goals 64 and 74 sent a byte-identical prompt. So nothing is yet known about capability. The cheaper
question, before any site-selection machinery:

> When the 1.5B is actually told what behaviour to add, and the working implementation stays visible,
> can it produce the required local deltas at all?

## Conditions - goals 64 and 74, seeds 1-8 fixed, one shared evaluator

    R  reference_control            no model. The proven reference snippets applied at the oracle
                                    sites, stepwise, through the same transactional harness.
    A  instruction_only             whole-function replacement exactly as v3 does it, PLUS the actual
                                    goal text. Isolates: was instruction starvation ALONE enough to
                                    explain the nonsense renderer?
    B  oracle_localized_insertion   existing to_html stays byte-identical and visible, goal text
                                    supplied, insertion sites supplied from the proven reference
                                    patch, model generates only the inserted snippets.

`num_predict` 1800 for A (proven non-binding at this task) and 600 for B; `hit_cap` recorded either
way so a cap can never again be mistaken for a semantic failure.

## What B is, stated so it cannot be over-read later

Labelled **ORACLE_LOCALIZATION_FEASIBILITY**. The oracle supplies three things per site: the anchor,
the indentation, and one line of intent. It never supplies the code. So B answers "given correct
localization AND correct decomposition, can the model write the snippets?" and says **nothing** about
whether a system could derive those sites. Deriving them is the entire research question v4 would
exist to answer, and only if B shows life.

## The instruction channel

Not the raw goal appended somewhere decorative. The prompt must separate immutable existing context
from the requested delta, because the model is no longer expected to infer its job from an identifier
like `between(`. For B, at the insertion point and at its indentation:

    # The code above and below is EXISTING and AUTHORITATIVE - do not repeat or rewrite it.
    # REQUESTED CHANGE: <exact goal text>
    # AT THIS POINT WRITE ONLY THIS: <oracle site intent>

For A the wording necessarily differs, because A's design deletes the body: keep EVERY existing
behaviour AND add the requested change. The instruction lives only in the generation prompt; the
candidate file is assembled from the ORIGINAL prefix, so both conditions write files shaped exactly
as v3 would have shaped them and the preservation audit is unchanged.

## Transactional, for the reason already learned the hard way

Every site is re-anchored against `source_{n-1}`, never pre-computed against the original - the same
trap recorded before v3 was built. Each intermediate must load. Any failure rolls the whole goal back
to `source_0`, and the rollback is asserted byte-exact rather than assumed.

## PREREGISTERED READINGS - fixed now, so the result cannot be narrated afterwards

    A succeeds            instruction starvation was a major cause on its own, and whole-function
                          replacement is less hopeless than it looked.
    A poor, B works       strong support for the v4 thesis: preserve the existing implementation,
                          expose the requested behaviour, minimise generated semantic surface.
    both fail             building a site selector is PREMATURE - even perfect localization does not
                          unlock the model, and the bottleneck is elsewhere.
    both succeed          both defects mattered; v4 needs both corrections, not one.

## Gating rule

If condition R does not verify both goals, **no other number in this run may be read**. A control that
only ever passes proves nothing either, so R also runs a known-bad witness: `MUTATE_SITE=n` corrupts
exactly site n and the run must abort at n with a byte-exact rollback.

## Denominators and what will not be claimed

n=8 seeds on 2 development goals, one model, one machine. No significance test on A versus B: this is
a mechanism check with a tiny fixed panel, and the two goals are the same file and the same function,
so they are not independent. Per-goal counts will be reported separately and not pooled into a rate.
No held-out evaluation is touched. Whatever the outcome, the frozen v2 and v3 results are not restated
on the strength of it.

## Everything preserved

Per run and per step: goal, condition, seed, the exact wire request JSON, the raw reply bytes, output
token count, `done_reason`, `hit_cap`, generated byte count, whether the snippet ends in a newline,
the source hash before and after every insertion, the selected site and its oracle intent, the load
result, old regression and new delta at every step, the abort point, rollback status and whether
restoration was byte-exact, and the final artifact hash. No summaries without bytes - the rule this
whole line of work exists because I broke it once.

## AMENDMENT to the preregistration, written before results (tatte, 2026-09-14)

### What B's oracle actually supplies - four things, not two

I described B as handing over "localization and decomposition". That undercounts it. The oracle
supplies **location + decomposition + ORDERING + local intent**, and ordering is genuine information,
not bookkeeping: site 2 defines `flush_ol` and site 3 calls it, so site 2 must precede site 3. The
reference control's `LR` at every intermediate is exactly what proves the supplied order is a valid
one, and a different order would have produced a spurious mid-sequence failure.

So if B works, the precise claim is:

> Given a correct multi-site EDIT PLAN - ordered insertion sites plus a local intent for each - can
> the 1.5B synthesize the required snippets while the preservation gates keep the program valid?

That is still a very useful feasibility question. But it means a v4 would have to solve more than
"find the insertion points". It would have to derive an **edit plan**: the sites, their dependencies
and order, and a small semantic instruction per site. Stating it now so a later reader cannot quietly
shrink the remaining problem to site-finding.

### A loophole closed before the numbers exist

Because the reference control proves that every intermediate state under this oracle plan both loads
AND keeps the old regression green, a model-generated snippet that fails an intermediate check is a
**genuine snippet failure**, not an artifact of the harness demanding transiently-invalid states. This
disposes of the objection in advance rather than after seeing which way the result went - the same
objection that, left open, would have made a B failure unfalsifiable.

### Why A remaining near zero while B works would be a strong result

Not "shorter prompts help". It would mean the model can perform the behavioural change once the
harness stops forcing it to reconstruct already-correct code, and instead presents the task at the
granularity the model can reliably execute. The distinction matters because the first reading suggests
prompt tuning and the second identifies the unit of work as the lever.

## B0 QUARANTINED, and the route-selection criterion fixed BEFORE the probe runs

### Withdrawing an overreach of mine, immediately

I wrote that condition A showed "the defect that matters is deleting the implementation, not only the
missing instruction". That is not established. A establishes one thing only:

> Restoring the instruction channel ALONE is insufficient - whole-function replacement with the exact
> goal text supplied is still 0/8.

The stronger causal claim - that keeping the existing implementation visible unlocks the model -
belongs to a valid B experiment, and B has not produced one yet. tatte's correction; accepted.

### B0 ORACLE_LOCALIZATION_FEASIBILITY - APPARATUS-INVALID, not interpretable as capability

    goal 64, seeds 1-8   sites completed 0,0,0,3,0,0,0,0 of 7
                         6/8 aborted with an EMPTY snippet at site 1

A zero-width FIM hole between two already-complete statements is a poor match to the model's infill
objective. It is shown a perfectly valid prefix/suffix pair and often concludes, reasonably, that
nothing belongs there; one seed echoed the instruction comment back instead. **This is another
apparatus defect, not evidence against oracle localization.** B0 is frozen and quarantined, and its
counts are never to be cited as model capability.

Seed 4 is the informative exception: it completed 3 of 7 sites before failing at site 4. The
transactional machinery is therefore not fundamentally incompatible with model-generated snippets. The
defect is specifically about how reliably the generator recognises that a completion is required.

### The state of evidence, stated precisely

    original v3   VOID                   the model never received the requested behaviour
    A             VALID                  behaviour specified, implementation removed        -> 0/8
    B0            INVALID/NON-IDENTIFYING implementation visible, but the FIM formulation
                                          frequently tells the model no completion is needed
    B1            pending                 implementation visible, behaviour specified,
                                          completion genuinely demanded, only local snippets

### ROUTE-SELECTION CRITERION - fixed now, before the probe is run

Written in advance so the route cannot be chosen by looking at which one produced the nicest code.
Probe: goal 64, sites 1 and 5 (a one-line declaration and the substantive branch), seeds 1-4, so
**8 trials per route**.

    RESPONSIVE = the reply is non-empty AND does not echo the instruction text.
    ELIGIBLE   = RESPONSIVE on at least 6 of 8 trials.
    CHOICE     = among ELIGIBLE routes, the highest count of candidates that LOAD.
    TIE-BREAK  = prefer V2_indent_primer, because it keeps the model in its native FIM objective and
                 adds no semantic information beyond the indentation the site already implies.
    IF NO ROUTE IS ELIGIBLE - report that and do NOT run B1. A third apparatus iteration would then be
                 the finding, and the honest conclusion would be that this model cannot be driven to
                 fill an insertion point by any of these three formulations.

RESPONSIVE deliberately does not include correctness. The probe decides whether a route can make the
generator produce a snippet at all; whether the snippet is right is what B1 measures.

### B1, frozen before it runs

    generation route      the probe's winner under the criterion above
    seed panel            11-18, FRESH - never used to choose the route, so the route is not selected
                          on the same stochastic trajectories used to evaluate it
    oracle sites          unchanged
    site order            unchanged
    local intent          unchanged
    transactional gates   unchanged - re-anchor per step, each intermediate must load, any failure
                          rolls back to source_0 byte-exactly
    goals                 64 and 74, reported separately, never pooled

The reference control R and the known-bad MUTATE_SITE witness are re-run against the chosen route
before B1 is read, because a route change is a harness change and the controls belong to the harness,
not to the condition.

### The result B1 could produce, and what it would license

If B1 works while A stays at 0/8:

> The model can implement the behavioural extension when the existing behaviour remains physically
> intact and the harness decomposes the change into small explicit insertions, but cannot reliably
> reconstruct the whole function even when given the same behavioural instruction.

That would be direct experimental justification for the next architecture. It would still NOT show
that a system can derive the edit plan - sites, order and per-site intent are all oracle-supplied.

### What this whole sequence has actually been

Three apparatus defects found in a row - no instruction channel, colliding prompts, and a generation
route mismatched to the model's training objective - each of which first presented as a model-capability
result. The work is debugging the interface between the model's training objective and the
architecture, not the model. Every one of them was caught by dumping bytes, and none by reading code.

## RESULT A: instruction alone does not rescue whole-function replacement (VALID, n=16)

Goals 64 and 74, seeds 1-8 each, the v3 replacement route with the exact goal text supplied through a
real instruction channel. Reported separately below the pooled line because the two goals share a file
and a function and are not independent.

    condition A   trials 16   VERIFIED 0/16   loads 15/16   OLD BEHAVIOUR KEPT 0/16
                  goal 64     VERIFIED 0/8    loads 7/8     old kept 0/8
                  goal 74     VERIFIED 0/8    loads 8/8     old kept 0/8
                  output tokens min/median/max 81 / 244 / 1800   hit the cap 1/16

**The code is almost always valid and the behaviour is always wrong.** 15 of 16 load. Zero preserve the
old behaviour. This is not a truncation artifact: one trial reached the 1800-token cap, the median is
244 tokens, and the rest terminate on `stop`.

Every seed invents a different renderer, which is the signature of reconstruction rather than editing:

    s2  'a\nb' -> '<h1>a</h1>\n<h1>b</h1>'
    s3  'a\nb' -> '<p>a</p><p>b</p>'
    s4  'a\nb' -> '<p>\na\n</p>\nb\n</p>'
    s5  'a\nb' -> '<p>a</p><ul><li>b</li></ul>'
    s6  'a\nb' -> '<html><body>a\n\n\nb\n</body></html>'
    s8  raises Invalid heading level

### The specific behaviour that dies

14 of 16 trials lose **paragraph line-joining** - `to_html("a\nb") == "<p>a b</p>"` - which is goal 4,
the oldest and most foundational behaviour in the file. The model reconstructs the recent, salient
features and drops the one that everything else is layered on. An aggregate pass rate would hide this
completely; it is visible only because the regression suite asserts each accumulated behaviour
separately. That is an argument for per-behaviour regression suites over a single end-to-end check.

### What this licenses, and what it does not

**Licensed.** Restoring the instruction channel ALONE is insufficient. The missing channel was a real
apparatus defect, and correcting only it leaves whole-function replacement at 0/16. The model now
demonstrably knows what was requested and still reconstructs the function instead of preserving its
accumulated semantics.

**Not licensed.** Any claim that keeping the implementation visible would fix it. That is B1's to earn.
A is a result about replacement, not evidence about localization.

## B0 data, recorded for the quarantine file rather than for interpretation

    sites completed   g64: 0 0 0 3 0 0 0 0 of 7      g74: 0 3 1 1 1 1 1 0 of 3
    reached the end of the plan   1/16
    per-STEP empty snippets       6 of 26 steps attempted
    abort reasons   6x empty snippet | 4x site 2 load error | 3x site 1 load error
                    1x site 4 load error | 1x anchor_ambiguous | 1x delta failed

Two details worth keeping, neither of them a capability claim:

  * the single trial that reached the end of its plan (goal 74, seed 2) **kept the old behaviour**
    while adding a wrong fenced-code implementation. A never managed that in 16 tries. Suggestive of
    the v4 thesis, and no more than suggestive - n=1, in a condition frozen as apparatus-invalid.
  * `anchor_ambiguous (3 occurrences)` fired once: a model snippet duplicated text and made a LATER
    site's anchor non-unique. The transactional harness caught it and rolled back rather than editing
    an ambiguous location. That is the re-anchoring requirement doing its job for a reason I had not
    anticipated - I expected anchors to go missing, not to multiply.

### Integrity

    rollbacks 32/32 byte-exact        reference control 2/2 verified

## ROUTE SELECTION, and B1 frozen before it runs

### The route probe (developmental, goal 64, sites 1 and 5, seeds 1-4, 8 trials per route)

    route              n   responsive(as-run)  responsive(echo-fixed)  echoed  loads  oldKept
    V1_comment_only    8   5/8                 4/8                     2       4      4
    V2_indent_primer   8   8/8                 6/8                     2       6      4
    V3_chat            8   7/8                 7/8                     1       1      1

    ELIGIBLE (>= 6/8 responsive):  V2_indent_primer, V3_chat
    CHOSEN:                        V2_indent_primer - most candidates that LOAD (6 vs 1)

**An instrument bug in my own criterion, and why it did not matter.** The preregistered definition of
RESPONSIVE is "non-empty AND does not echo the instruction", but I implemented `echo` as only three of
the instruction's phrases and omitted `AT THIS POINT WRITE ONLY THIS`. A 584-byte reply that began with
exactly that phrase scored `echo=false`. The definition did not change; its implementation was
incomplete, so it is fixed and both countings are shown above. **The winner is the same under both**,
and V1 fails the eligibility bar under both. The bug existed and was not decision-relevant. Recomputed
over the preserved replies with no new inference - the second time today that preserving bytes removed
the need to re-run anything.

**V3_chat is not rescued.** Its snippets come back with no leading indentation despite being told the
column, so 7 of 8 are responsive and only 1 loads. The frozen rule already prices that in. Adding
deterministic re-indentation would be a DIFFERENT route (V3b) needing its own developmental validation,
not a cleanup applied to the route the probe selected.

### The site-1 finding, which is not about the route at all

All three interfaces converge on copying the neighbouring line instead of following the intent:

    existing line      items = []
    oracle intent      "declare the accumulator list for ordered-list items, beside the existing
                        items list"
    V1 s1              items = []            loads, old kept - harmless duplicate, wrong content
    V2 s2              items.append("")      loads, old BROKEN
    V2 s3              items.append([])      loads, old BROKEN
    V3 s1-s3           items = []            no indentation at all, does not load
    V3 s4              items = []            loads, old kept

Not irrational. "An accumulator list beside the existing items list" does not uniquely determine a new
identifier - the reference implementation knows it is `ol_items`, the prompt never said so. Three
different interfaces producing the same neighbour-imitation is early evidence that **local context can
overpower a weak local instruction for this model**. And the inversion is the tell: the SUBSTANTIVE
branch at site 5 was generated correctly by some seeds (V1 s4 and V2 s2, ~70 bytes, loads, old
behaviour kept) while the trivial one-line declaration failed everywhere. Difficulty did not predict
failure; specification quality did.

### AMENDMENT before B1: the oracle intent must uniquely specify what to create

Sending a knowingly underdetermined local instruction into the supposedly oracle-assisted condition
would mean a later failure could not be attributed to the model. So B's oracle assistance is widened,
transparently, and the definition is restated in full. **B supplies:**

    insertion locations
    insertion order
    required indentation and context
    local semantic intent
    required local IDENTIFIERS wherever they are needed to make the edit uniquely specified

Both intent sets are kept in the apparatus - `purpose` (B0) and `purpose_b1` - so the change is visible
rather than retrofitted. Example:

    b0   declare the accumulator list for ordered-list items, beside the existing items list
    b1   declare a separate ordered-list accumulator named `ol_items`, initialised to an empty list;
         do not modify or redeclare `items`

The intents name the identifier to create and the neighbour NOT to touch. They do not dictate the code:
site 2 says "mirror the existing flush_list but emit an <ol> block from ol_items", not the expression.

This makes the eventual claim NARROWER and cleaner. B1 tests whether the 1.5B can EXECUTE a correct,
unambiguous edit plan - not whether it can resolve an ambiguous one, and not whether any system could
derive the plan.

### B1, frozen

    condition             B1_oracle_localized_insertion
    generation route      indent_primer, selected by the frozen criterion above
    oracle intent set     b1 (identifier-disambiguated)
    seed panel            11-18, FRESH - never used to select the route, so the route is not judged on
                          the trajectories that chose it
    goals                 64 and 74, reported separately, never pooled
    sites, order          unchanged from the proven reference patch
    transactional gates   unchanged - re-anchor against source_{n-1} every step, each intermediate must
                          load, any failure rolls back to source_0 byte-exactly
    num_predict           600, hit_cap recorded

### Controls re-run against the EXACT B1 apparatus, because a route change is a harness change

    reference control R             goal 64  7/7 sites, intermediates [LR x7]   VERIFIED
                                    goal 74  3/3 sites, intermediates [LR x3]   VERIFIED
    primer assembly lossless        10/10 sites - the reference snippet de-indented and re-assembled
                                    through the primer path is byte-identical to the reference
    known-bad witness               MUTATE_SITE=1 aborts at 1 (0/7), =5 aborts at 5 (4/7),
                                    =7 aborts at 7 (6/7), rollback byte-exact each time

The primer-assembly check exists because the chosen route makes the harness re-add the site
indentation to whatever the model returns. A control that never exercised that assembly step would not
be a control for this apparatus.

## RESULT B1: the intent fix worked on CONTENT and exposed a missing STOP CONDITION

Route `indent_primer`, intent set `b1`, fresh seeds 11-18, goals 64 and 74 reported separately.

    goal 64   VERIFIED 0/8   chains reached the end 0/8
    goal 74   VERIFIED 0/8   chains reached the end 1/8 (seed 11: old behaviour KEPT, delta wrong)

    steps attempted 31   EMPTY SNIPPETS 0 (B0: 6 of 26)   echoed instruction 14/31   hit the 600-cap 9/31
    per-site load-after   site 1  11/16      site 2  4/11      site 3  1/4

### What the amendment fixed

Naming the identifier worked. Site 1 now writes `ol_items = []` and `fence = None` instead of copying
the neighbouring `items = []`. The B0 neighbour-imitation is gone, and so are the empty snippets that
made B0 uninterpretable. Both of the previous apparatus defects are closed.

### The defect underneath

The model emits the correct first statement and then **does not stop**. It continues into invented
helpers (`flush_code()`), re-declarations of code already in the file (`def flush_para():`), or - most
tellingly - more lines in my own instruction-comment format:

    # AT THIS POINT WRITE ONLY THIS: declare a function named `flush_para`, which does not modify ...

14 of 31 steps echoed instruction text. **My instruction format taught the model to keep writing
instructions.** That is the same lesson as the earlier prompt-suppressor finding, from the other
direction: prompt text has large unintended effects, and a comment block invites more comment blocks.

`fence = None` - a 17-byte answer - arrived once inside a 2430-byte run-on that hit the token cap.

### Is the content right and only the length wrong? Yes.

Post-hoc over preserved bytes, STEP 1 ONLY - every seed of a goal shares the step-1 prompt, so the
comparison is clean, whereas later steps were conditioned on what the previous step actually produced
and cannot be reconstructed counterfactually. No new inference.

                          goal 64 step 1                    goal 74 step 1
    raw                 8/8 load, 8/8 old kept, 4/8 exact   3/8 load, 3/8 old kept, 2/8 exact
    D1 oracle-length    8/8 load, 8/8 old kept, 6/8 exact   8/8 load, 8/8 old kept, 7/8 exact
    D2 deterministic    8/8 load, 8/8 old kept, 6/8 exact   8/8 load, 8/8 old kept, 6/8 exact

`exact` means byte-identical to the reference patch snippet. D1 truncates to the reference's line count
- it uses the answer's length, so it is NOT implementable and exists only to separate "wrong content"
from "right content that ran on". D2 uses no oracle information: stop at the first line that dedents
below the site indentation, reproduces a structural line already in the source, or looks like an
instruction comment.

**D2 recovers step 1 completely - 16/16 load and keep old behaviour, 12/16 byte-identical to the
reference - and D2 is as good as D1.** An implementable bound captures essentially everything perfect
length control would buy.

### Status: B1 is a valid result about the apparatus, not yet a capability verdict

0/16 verified is real and is not being hidden. But the binding constraint it identifies is a missing
site boundary, with a deterministic remedy that needs no help from the model. Calling B1 "the 1.5B
cannot execute an edit plan" would repeat the mistake this whole sequence has been correcting.

**D2 was written while looking at these trajectories.** It is therefore developmental, and any gain
must be re-measured on a FRESH seed panel before it counts as a result. That is B2.

### The defect ledger so far - four in a row, each first presenting as model capability

    1  no instruction channel on the behavioural route          found by dumping wire bytes
    2  goals 64 and 74 sent a byte-identical prompt             found by hashing prompts
    3  zero-width FIM hole invites a legitimate EOT             found by preserving empty replies
    4  no stop condition at the site boundary                   found by preserving over-long replies

None was found by reading harness code. All four were found by keeping the bytes.

## B2 frozen before running: one variable, the site boundary

B1 identified a missing stop condition as the binding constraint. B2 adds exactly that and nothing
else.

    condition           B2_bounded_oracle_localized_insertion
    changed from B1     BOUND=d2 only
    unchanged           route indent_primer, intent set b1, sites, order, indentation, transactional
                        gates, num_predict 600, and THE INSTRUCTION TEXT
    seed panel          21-28, FRESH - not the panel that chose the route (1-4) and not B1's (11-18)
    goals               64 and 74, reported separately, never pooled

The instruction text is deliberately left alone even though B1 showed it teaches the model to write
more instruction comments (14 of 31 steps echoed it). Changing the wording AND adding the bound in one
step would leave neither attributable. The bound already stops at an instruction-echo line, so the
echo's effect is absorbed rather than hidden; rewording is a separate later variable if it is still
needed.

### The bound, stated exactly - no oracle information

Truncate the snippet at the first line that

    dedents below the site indentation            (left the site)
    looks like an instruction comment             (continuing the prompt's own format)
    re-declares a structural line already in the  (def/for/while/class already in source_{n-1})
      source

then strip trailing blank lines. Nothing here consults the reference patch or the expected length.

### Controls re-run against the B2 apparatus

    reference control R         goal 64 7/7 [LR x7] VERIFIED   goal 74 3/3 [LR x3] VERIFIED
    bound is a NO-OP on the     10/10 sites unchanged
      reference
    primer assembly lossless    10/10 sites
    known-bad witness           MUTATE_SITE=2 aborts at 2 (1/7), =5 aborts at 5 (4/7), rollback
                                byte-exact

The no-op check is the one that matters most here. A bound that truncated correct code as well as
run-on would raise the pass rate by mutilating the reference, and this control is the only thing that
distinguishes "stops the run-on" from "trims everything". It is the same trap as an over-strict checker
that passes every known-bad test.

### Preregistered reading

    B2 works while A stays 0/16     the model can EXECUTE a correct, unambiguous, bounded edit plan;
                                    the remaining research problem is deriving the plan
    B2 still fails at the same      the bound was not the constraint either; report the next mechanism
      sites                         rather than another count
    B2 fails at LATER sites         progress is real but the chain length is the limit - worth
      than B1                       measuring per-site survival rather than per-goal pass

D2 was written while looking at B1's trajectories, so THIS run on fresh seeds is what decides whether
it generalises. If B2 succeeds only on the seeds D2 was tuned against, that is a negative result.


## FROZEN: the four outcomes B2 can produce, written while it runs

Fixed now so the result cannot be narrated afterwards. D2 was designed after seeing B1, so only the
fresh 21-28 panel can distinguish a general boundary mechanism from a clever rescue of B1's particular
trajectories.

    1  B2 completes whole goals on fresh seeds
       Strong support for the narrow core claim: the 1.5B can execute the semantic change when
       planning, localization, specification, preservation and generation BOUNDARIES are all
       externalized. Not "Legasus proven" - the edit plan is still oracle-supplied.

    2  early sites improve, whole transactions still fail
       The principle holds locally but some later operation carries an unresolved burden. Response:
       inspect the FIRST FAILING SITE. Do not redesign anything else.

    3  D2 stops the run-on but the content becomes wrong
       Boundary control is real and content generation is the remaining capability bottleneck. This is
       the first outcome in the whole sequence that would license a capability statement, and only
       because four apparatus defects would by then have been removed.

    4  B2 looks essentially like B1
       The step-1 rescue did not generalize and D2 was overfit developmentally. Report it as a negative
       result; do not re-tune D2 on the 21-28 panel, because that would just move the overfitting.

## A finding that stands independently of B2: the interface, not the model

Four apparent model-capability failures in this sequence were failures of the interface between the
model and the harness:

    1  no instruction channel on the behavioural route     the task was never stated
    2  goals 64 and 74 sent a byte-identical prompt        two goals, one question; passing both was
                                                           arithmetically impossible
    3  a zero-width FIM hole in a complete program         the honest answer was EOT, and the model
                                                           gave it
    4  no boundary on generation authority                 the right first statement, then 2400 bytes
                                                           of unauthorized material

**All four were found by reading actual request and reply bytes. None was found by reading harness code,
and none was visible in an aggregate score.** That is no longer incidental; it is a repeatable pattern
in this project. A harness can make a capable local behaviour invisible by asking the wrong question,
hiding the task, destroying the context the task refers to, or granting too much generation authority -
and each failure mode produces output that looks exactly like the model being incapable.

### The sharpest of the four, as an architectural principle

14 of 31 B1 steps continued **my own instruction-comment format** as a pattern - generating further
lines like `# AT THIS POINT WRITE ONLY THIS: declare a function named flush_para ...`. The model was
doing precisely what an autoregressive/FIM model is trained to do: continue the pattern in front of it.

So the requirement is not "instruct the model better". It is:

> Shape the context so that the desired code fragment is the NATURAL CONTINUATION, and place everything
> beyond that fragment outside the model's authority.

Those are two distinct obligations - one on the prompt geometry, one on the harness's write authority -
and B0 versus B1 versus B2 separates them. B0 failed the first (nothing needed continuing). B1 satisfied
the first and failed the second (continuation never stopped). B2 tests whether satisfying both is
sufficient.

This also reframes what the earlier v2 success was. `def between(` worked not because it was a good
instruction - it is barely an instruction at all - but because it made the wanted code the only natural
continuation. The same property, arrived at by accident rather than design.


## RESULT B2: the boundary generalised, and the next defect is mine again

Route `indent_primer`, intent set `b1`, BOUND `d2`, fresh seeds 21-28, goals reported separately.

    goal 64   loads 5/8   OLD KEPT 1/8   NEW DELTA 0/8   VERIFIED 0/8
    goal 74   loads 8/8   OLD KEPT 2/8   NEW DELTA 0/8   VERIFIED 0/8
    rollbacks 16/16 byte-exact      reference control 2/2      bound no-op on reference 10/10

### A metric of mine that overstated progress, corrected before it is quoted

The harness aborts a transaction only when an intermediate fails to LOAD. A preservation break is
recorded and the chain CONTINUES, so later sites get built on a state that already violates the old
behaviour. v3's `multiInsert` required earlier members to survive; for these B conditions I required
only that the file load. That is a gap in the apparatus, and it inflates any "sites completed" figure.

                             depth (loaded)        HEALTHY depth (load AND preserve)
    B1 goal 64               1 1 1 1 1 2 2 2       1 1 1 1 1 1 1 2
    B2 goal 64               4 4 5 7 7 7 7 7       4 4 4 5 5 5 5 7
    B1 goal 74               0 0 0 0 0 1 1 3       0 0 0 0 0 1 1 3
    B2 goal 74               3 3 3 3 3 3 3 3       1 1 1 1 1 1 3 3

**Goal 64's improvement is real and large**: median healthy depth 1 -> 5, max 2 -> 7. **Goal 74's is
modest**: median 1 -> 1, with 2 of 8 reaching full depth. My interim claim that "every goal-74 chain
completes" was wrong in the way that matters - they completed in the loading sense while 6 of 8 had
already broken preservation at site 2.

### The causal profile, from the 2x2 counterfactual replay

    13x LOCAL_SNIPPET_DEFECT      3x DELTA_INCOMPLETE
     0x UPSTREAM_DEFECT           0x CROSS_SITE_INTERACTION      0x MULTIPLE_DEFECTS

Every counterfactual failure is local: the snippet fails even when transplanted onto reference
predecessors, and swapping it for the reference rescues the chain. **The oracle edit plan is exonerated**
- which the reference control already implied and the replay now confirms independently. No
compositional defects at all.

### Endpoint equivalence does NOT imply causal equivalence - demonstrated, not assumed

Four goal-64 trajectories produce the BYTE-IDENTICAL failure `'a\nb' -> '<p>a a b b</p>'`:

    seed 21   healthy depth 7   earliest causal boundary site 5
    seed 23   healthy depth 7   earliest causal boundary site 6
    seed 24   healthy depth 7   earliest causal boundary site 6
    seed 27   healthy depth 7   earliest causal boundary site 6

Same observable endpoint, different causal site. Goal 74's four identical endpoints all break at site 2
and DO share a cause. So an endpoint signature is sometimes a diagnosis and sometimes not, and there is
no way to tell which without the replay. This retrospectively justifies building it.

### What the model actually writes - the fifth apparatus defect, and it is mine

    seed 21   if fence: ... else: current.append(line.strip())
    seed 22   blocks.append("\n".join(codes + links))
    seed 23   codes.append(line)

`current` already accumulates every line four lines further down, so seed 21's added `else` makes every
line accumulate TWICE - that is the whole `a a b b` signature. And `codes` and `links` are not variables
of `to_html` at all: **they are locals of the neighbouring `_inline` function**, visible in the prompt.

This is B0's neighbour-imitation failure returning at the BODY level. The b1 amendment named the
identifier to create and the neighbour not to redeclare, but only for the one-line DECLARATION sites.
For the multi-line body sites the intent says "do not alter the existing branches" - and the model did
not alter them. It ADDED a redundant branch that shadows them, which the instruction never forbade.

So the b1 amendment was applied incompletely, by me. A sufficient intent for a body site has to say
that every case the new code does not handle must fall through to the existing code untouched, and
which identifiers are in scope. That is apparatus, not capability.

### Against the frozen four outcomes

Closest to outcome 2 - "early sites improve, whole transactions still fail; inspect the first failing
site, redesign nothing else" - and explicitly **NOT outcome 3**. Outcome 3 would license a capability
statement, and it is not licensed: the content errors trace to an under-specified instruction rather
than to failed algorithmic competence. The model is doing something quite reasonable in context, which
is reusing names and patterns it can see.

D2 itself is vindicated on fresh seeds: empty snippets gone, run-ons bounded, healthy depth up sharply
on goal 64, and the bound proven to be a no-op on all 10 reference sites so the gain is not bought by
mutilating correct code.

### The honest open question, which is now a design question rather than an experimental one

Five apparatus defects have been found in a row, and each fix revealed the next one. That sequence
could in principle continue indefinitely, so the interesting question is no longer "is there another
apparatus defect" but:

> How much specification must the harness supply before a 1.5B can execute a behavioural edit, and is
> that quantity something a real system could produce without a human writing it per site?

Each amendment so far has moved work from the model to the plan: locations, order, indentation,
identifiers, and now scope-and-fall-through. If the plan has to specify that much, the architecture's
hard problem is generating the plan, and the generator's role shrinks toward transcription. That is a
finding about where the difficulty lives, and it is worth stating plainly rather than discovering after
three more amendments.


## DEFECT 6, in the reference itself: a dead insertion site the probe could not see

Found while building a known-bad witness for the STRICT invariant, not by looking for it.

`MUTATE_PRESERVE=3` inserts `current.append("ZZZ")` - valid Python that must corrupt paragraph
accumulation - and the transaction still verified 7/7. That is only possible if the insertion never
executes.

    site 3 anchor was:  '            flush_list()\n            continue\n'

The anchor ENDED with `continue`, so everything inserted there landed after it at the same
indentation. **Unreachable.** Which makes the reference patch's own `flush_ol()` at site 3 dead too:

    reference patch, "1. a\n\n2. b"  ->  '<ol><li>a</li><li>b</li></ol>'
                          expected   ->  '<ol><li>a</li></ol>\n<ol><li>b</li></ol>'

**So the "PROVEN reference patch" was not a correct implementation of goal 64**, and `probe64` never fed
a blank-line-separated ordered list - the only input that can expose it. This is the lenient-proof
failure, sitting inside the artifact every other result in this sequence was validated against.

### Fixed

    anchor      now '            flush_list()\n' alone, so the insertion lands BEFORE the continue
    probe64     new assertion H: to_html("1. a\n\n2. b") must be two separate <ol> blocks
    witnesses   before the fix H is False and the probe fails; after the fix H is True and the
                reference verifies 7/7 with every intermediate green

### Consequences, stated rather than buried

  * The **expressibility proof stands for what it measured** - the edit is insertion-only and leaves
    37/37 lines byte-identical - but "the reference implements goal 64" was false until now.
  * **No earlier result is inflated by it.** Goal 64's delta was 0/8 in every B condition, and a
    stricter probe cannot raise a zero. The direction of the error is safe, which is luck, not design.
  * **Site 3's snippet content never mattered** in B0/B1/B2. Any trajectory was filling a site that
    could not affect the outcome, and could not be penalised for getting it wrong.
  * The reference control was **passing while validating against a lenient oracle** - exactly the
    failure mode the two-witness rule exists to prevent, and it survived because I only ever asked the
    reference to pass, never asked what input could make it fail.

### Why STRICT needed its own witness

The existing `MUTATE_SITE` witness inserts broken syntax, which the LOAD check catches first, so it
could never reach the preservation-abort branch. A fixture stopped by a different guard reports green
forever. `MUTATE_PRESERVE` inserts valid code that breaks behaviour, and it now aborts at exactly the
mutated site:

    MUTATE_PRESERVE=3  STRICT=1   steps 3/7  [LR LR L-]  aborted: site 3 broke old behaviour
    MUTATE_PRESERVE=6  STRICT=1   steps 6/7  [LR LR LR LR LR L-]  aborted: site 6 broke old behaviour
    MUTATE_PRESERVE=3  STRICT=0   runs to completion - which is what B2 was doing

That last line is the point: it demonstrates directly that the pre-STRICT harness carried on past a
preservation break, which is why B2's "sites completed" needed correcting by hand.

## Apparatus changes now in place for the next round

    STRICT=1            abort the transaction on a preservation break, not only a load failure, so
                        transaction depth IS healthy depth by construction
    INTENT=b2           the semantic-contrast block: what already owns the responsibility, which
                        identifiers are NOT available here, and that unhandled cases must fall through
                        to the existing code unchanged
    scope.mjs           the in/out-of-scope lists are DERIVED from the source, not hand-written

The derivation matters more than the wording. A field a planner can compute is a field a real system
could fill; a field only I can write is an oracle in disguise. `scopeFacts` correctly flags `codes` and
`links` - the two names B2 actually misused - as locals of `_inline`, and two of its own defects were
caught by asking what it must NOT forbid: it initially called `text` foreign (it is `to_html`'s own
parameter) and `i` foreign (the correct `flush_ol` writes `for i in ol_items`).


## B3 frozen and running: fresh seeds 31-38

    B2
    + corrected goal-64 oracle (site 3 anchored BEFORE the continue, so it is reachable)
    + strengthened probe64 (assertion H: a blank line must close an open ordered list)
    + STRICT - abort on load OR preservation failure
    + semantic-contrast plan (owns / not-available-here / sole fallthrough)
    + DERIVED in-scope and out-of-scope identifiers
    = B3            seeds 31-38, goals 64 and 74 reported separately, never pooled

Everything else is unchanged: route `indent_primer`, bound `d2`, `num_predict` 600, the same oracle
sites and order, byte-exact rollback.

### The refusal gate is deliberately NOT in this run

It would change WHICH operations reach the model at all, so a B3 improvement could no longer be
attributed between "better semantic specification" and "difficult sites filtered out before
generation". It matters for the architecture; it is not needed for the current question, which is now
narrow:

> Once generation is bounded and the local contract states semantic contrasts, scope and preserved
> fall-through, does the 1.5B execute the behavioural transaction more successfully?

### Historical records are NOT retroactively corrected

B0, B1 and B2 stand as experiments under the apparatus they actually ran on. One qualification is
recorded rather than applied backwards: **any claim that depended specifically on site 3 being a
semantically exercised operation is not trustworthy under the old apparatus**, because that insertion
was unreachable. Endpoint counts are unaffected (0 remains 0); per-site mechanism claims about site 3
are not.

### What defect 6 actually was, in general terms

    reference says PASS
    probe says PASS
    the specification says FAIL

The reference implementation and its oracle agreed with each other because both missed the same
behaviour - the self-confirming evaluator, in a new costume. It was exposed by a NEGATIVE witness
asking whether a supposedly meaningful site could influence execution at all. Positive controls could
never have found it: they only ever asked the reference to pass.

### The information split this run establishes

    ORACLE / human            what behaviour this local operation owns
    DETERMINISTICALLY DERIVED which names exist here, which belong to other functions, where
                             generation may occur, where it must stop

The second category is computed by `scope.mjs` and `boundToSite`. The more that moves from the first
column to the second, the less intelligence is being supplied by hand - and that ratio, not the pass
rate, is the honest measure of whether this is an architecture or an oracle demonstration.

### Next experiment, after B3 is interpreted

The refusal gate, with its own positive and negative witnesses:

    PASS    target unique, scope known, required identifiers resolved, existing owner and fallthrough
            known, boundary derivable
    REFUSE  ambiguous target, unresolved identifier, ambiguous ownership, conflicting transitions,
            unknown scope, edit not expressible in the allowed local operations

The trap to design against is the one already met twice: a gate that refuses everything passes every
known-bad test. It needs a proven known-good plan that it must NOT refuse.

## SIDE CONTROL, preregistered: the same harness pointed at qwen2.5-coder:7b

tatte-authorised, permissive, and explicitly a control. **The project objective is unchanged** - this
does not become a size comparison, and no frozen 1.5B result is restated on the strength of it.

    served       qwen2.5-coder:7b, one A10G on Modal, ollama, weights pulled in-container
    harness      IDENTICAL - same oracle sites, order, contrast block, bound, STRICT, probes
    conditions   A  whole-function replacement + goal text, seeds 1-8   (1.5B scored 0/16)
                 B3 bounded contrast-plan insertion, seeds 31-38        (1.5B scored 0/16)
    goals        64 and 74, reported separately, never pooled

Same family as the model under test, so the tokenizer, FIM special tokens and training objective
match and a difference cannot be blamed on the infill format.

### What it can and cannot tell us, fixed in advance

    7B passes A and B        the remaining gap is mostly size, and the apparatus is closer to
                             scaffolding-for-a-1.5B than to a general architecture
    7B passes B but not A    the architecture is doing real work at BOTH sizes - localization and
                             bounding help whoever is generating, which strengthens the design
    7B fails both            the harness or the task decomposition is still wrong, not the model,
                             and the 1.5B's 0/16 was never about 1.5B
    7B passes A but not B    my apparatus actively HURTS a stronger generator - the most useful
                             negative result available here

n=8 per goal per condition, one model, one machine. No significance test.

## RESULT B3 (1.5B) and the 7B side control

### B3 on qwen2.5-coder:1.5b, fresh seeds 31-38

    goal 64   completed 2/8   OLD KEPT 2/8   DELTA 0/8   VERIFIED 0/8
    goal 74   completed 4/8   OLD KEPT 4/8   DELTA 0/8   VERIFIED 0/8
    rollbacks 16/16 byte-exact    reference control 2/2

STRICT changed the shape as designed. B2 had goal 74 "completing" 8/8 while only 2/8 preserved
behaviour; B3 turns those broken completions into honest aborts, so **every chain that completes has
preserved every accumulated behaviour**. On the metric that survives both apparatuses - old behaviour
kept - it doubled on both goals: 1/8 -> 2/8 and 2/8 -> 4/8. Delta remains 0/16.

Two things argue AGAINST crediting the contrast block much:

  * **`codes` still appeared** despite the block naming it out-of-scope. Naming foreign identifiers did
    not stop the model reaching for them.
  * **`anchor_ambiguous (2 occurrences)` at site 5** on three goal-64 seeds: an earlier snippet
    duplicated text and made a later anchor non-unique, so the harness refused rather than editing an
    ambiguous location. Those chains died on plan integrity, not snippet quality.

### The causal taxonomy's fourth quadrant earned its place

    B3 (1.5B)   6x DELTA_INCOMPLETE   5x MULTIPLE_DEFECTS   2x LOCAL_SNIPPET_DEFECT   3x aborted

`MULTIPLE_DEFECTS` - the site-k snippet AND the upstream state independently defective - fires 5 times
here and fired 0 times in B1 and B2. Added at tatte's insistence before these results existed; without
it all five would have been labelled local or upstream depending only on which counterfactual was
inspected first, and there is no honest single-site attribution to make for them.

### SIDE CONTROL: the same harness on qwen2.5-coder:7b (one A10G, Modal)

    condition A   goal 64  loads 8/8  OLD KEPT 0/8  VERIFIED 0/8
                  goal 74  loads 5/8  OLD KEPT 0/8  VERIFIED 0/8
    condition B3  goal 64  completed 0/8  OLD KEPT 0/8  VERIFIED 0/8
                  goal 74  completed 1/8  OLD KEPT 1/8  VERIFIED 1/8

**Whole-function replacement fails at 7B exactly as at 1.5B: 0/16 verified, 0/16 preserving old
behaviour, at BOTH sizes.** And it fails the same way - seven of eight goal-64 seeds return

    'a\nb' -> '<p>a</p>\n<p>b</p>'    wanted '<p>a b</p>'

losing paragraph line-joining, goal 4, the oldest behaviour in the file, which the 1.5B lost in 14 of
16. **That failure was never about model size.** It is the task shape: delete a working implementation,
then ask for it back from ten asserts.

The localized route produced **the first verified end-to-end behavioural edit in this entire sequence** -
goal 74 seed 34 on the 7B: 3/3 sites, loads, old behaviour kept, delta passed. One out of sixteen, so
this is existence, not reliability.

Against the preregistered readings this is **"7B passes B but not A"**: the architecture does real work
at both sizes, since the route that localizes and bounds produced the only success anywhere while the
route that reconstructs produced none at either size. It is emphatically NOT "the gap is mostly size".

### The general 7B cannot run this harness at all

    qwen2.5:7b         capabilities ["completion","tools"]            -> no insert
    qwen2.5-coder:7b   capabilities ["completion","tools","insert"]   -> FIM works

ollama refuses the request outright: `registry.ollama.ai/library/qwen2.5:7b does not support insert`.
Conditions A and B are both `/api/generate` with a suffix, so the general model produces no score
rather than a poor one. **This whole localized-edit architecture is available only to models shipping
FIM weights** - a real constraint on the design, and one that no benchmark number would have surfaced.

### An apparatus nit, fixed

Running `CONDS=A` printed `reference control: 0/0 <-- READ NOTHING ELSE UNTIL FIXED`, which reads as a
failed control rather than an un-requested one. The warning now fires only when R was actually
requested. A frightening message with no defect behind it is its own kind of wrong.

### General vs coder at 7B, whole-file chat route (goal 64 only; goal 74 INVALID)

The general model cannot do FIM, so the only route both support is whole-file generation over
`/api/chat`. Not comparable to conditions A or B - different route, whole file rather than a span.

    qwen2.5-coder:7b   goal 64   loads 3/3   OLD KEPT 3/3   DELTA 0/3   VERIFIED 0/3
    qwen2.5:7b         goal 64   loads 3/3   OLD KEPT 1/3   DELTA 0/3   VERIFIED 0/3

**Goal 74 on this route is VOID, and the defect is mine.** Goal 74 is the FENCED CODE BLOCK goal, so a
correct generated file legitimately contains a triple-backtick fence - which terminates my
fence-delimited code-block extractor. The coder's goal-74 replies contain 5 fences and my extractor
captured **0 bytes**, scoring 0/3 for a reason that has nothing to do with the model. A delimiter that
also appears in the payload is not a delimiter. The general model's goal-74 numbers are void for the
same reason even though they happened to extract.

On the one valid cell, the specialisation shows up in **preservation, not in the delta**: the coder
keeps every existing behaviour 3/3 while the general model keeps it 1/3, and neither implements the
requested change even once. Consistent with the project's earlier general-vs-coder finding, and n=3.

### What the GPU window cost and produced

One A10G, deployed and stopped the same hour, `modal app stop --yes` verified (state `stopped`,
0 tasks, endpoint 404). Two models pulled into one container on a shared volume. The findings that
survive it:

  1. whole-function replacement fails identically at 1.5B and 7B, in the same place, for the same
     reason - so that failure is task shape, not capacity;
  2. the localized+bounded route produced the only verified behavioural edit anywhere in this
     sequence;
  3. the general 7B cannot use this architecture at all, because it ships no FIM weights.

## STATE-CONTINUITY AUDIT: is the experiment measuring the chain it claims to?

Five notions of "current program state" exist in this apparatus - the candidate after a model edit, the
reference/oracle file, the state the next anchor resolves against, the state the preservation probe
reads, and the state the 2x2 replay reconstructs. If one advances differently, every local result looks
legitimate while the measured causal chain is the wrong one. tatte's invariant: output(site N) ==
input(site N+1) for every branch claiming continuity.

                              B1        B2        B3       7B B3
    1 chain continuity       15/15     59/59     47/47     36/36     holds everywhere
    2 no state past a dead     2 LEAKS  11 LEAKS  holds     holds
      step
    3 replay re-derives       16/16     16/16     16/16     16/16     exact
      step 1 exactly
    4 bound state-INdependent   n/a     16/16     16/16     15/16     one exception
    5 delta representable     goal 64 old=true delta=true | goal 74 old=true delta=true

### 1, 3 and 5: the big suspects are cleared

**No stale-state bug.** Every transition that claimed to advance did advance: output(N) hashes equal
input(N+1) in 157 transitions across four runs. **The replay is faithful** - re-deriving step 1's
snippet from the reply bytes reproduces the recorded byte count 64/64 times, so the counterfactual
operates on the snippets the run actually used, not on reconstructions. And **delta representability is
now asserted rather than assumed**: applying only the reference snippets at only the exposed sites gives
old=true and delta=true for both goals, so "the sites cannot express the delta" is excluded as an
explanation for DELTA=0.

### 2: the leaks are the pre-STRICT gap, independently confirmed and quantified

    B1   2 leaks     B2   11 leaks     B3   0     7B B3   0

These are the runs where a preservation break did not abort. I had found and disclosed that gap by hand;
this invariant catches it mechanically and puts a number on it - **11 of B2's transitions were built on
already-broken state**. STRICT closes it completely: zero leaks in both STRICT runs.

Consequence for B2's record, stated precisely: the FIRST failing site is unaffected (the leak point IS
the first break), so B2's causal verdicts stand. What is not trustworthy is anything about what happened
at sites AFTER that point, because those ran on corrupt predecessor state.

### 4: a genuinely subtle finding - the bound is state-dependent

    7B B3  g64 s35   original-source bound 295B   vs   patched-source bound 122B

The bound's redeclares_existing rule consults the current source, so truncation can differ when
predecessors differ. For that trajectory the replay's case (b) applies a **different snippet** than the
run did, which means (b) is not "the same snippet on better predecessors" and does not isolate
predecessor state. 1 of 16 here; it invalidates that trajectory's quadrant assignment rather than the
method. Recorded as a limitation of the replay's isolation claim. The fix is to freeze each step's bound
decision at generation time and replay the frozen text.

## WORDING CORRECTION to the 7B write-up

I wrote "that failure was never about model size". That overreaches. What the evidence supports is:

> The 1.5B to 7B capacity increase does not resolve it, and the failure reproduces with the same
> topology - the same plausible-but-wrong paragraph semantics - after roughly a 5x parameter increase.

A 14B, 30B or frontier model could still cross the reconstruction threshold. If those reproduce the same
failure signature the size explanation gets seriously boxed in, but that is a claim for the filled-in
table, not for this cell.

### The claim that IS defensible now

> Across 1.5B and 7B, whole-function reconstruction repeatedly destroys previously accumulated
> behaviour, while preservation-oriented localized editing retains those behaviours and, at 7B, has
> produced at least one fully verified novel change.

B3's verified case crosses an epistemic boundary the earlier runs did not: old kept AND delta AND
verified means the architecture is not merely a better failure detector. At least once it navigated
accumulated constraints and added behaviour without regression. Proof of existence, n=1.

## DESIGN NOTE: localized editing is not FIM

The current implementation equates them because insert is the transport, which is why qwen2.5:7b
produced no score rather than a poor one. Conceptually the edit protocol should be the abstraction and
FIM one connector among several:

    FIM          -> constrained splice
    chat         -> structured patch
    tool model   -> edit operation
    diff model   -> validated diff

Then a non-FIM model participates in the same experimental treatment without changing the conceptual
condition, and the general-vs-coder question becomes answerable on the real architecture instead of on a
whole-file substitute. The intelligence and the transport are separate concerns, and this experiment hit
that distinction at the API boundary.

## The table to fill

    size    replacement verified   localized verified   replacement preservation   localized preservation
    1.5B            0/16                  0/16              0/16                      6/16 old-kept
    7B              0/16                  1/16              0/16                      1/16
    14B              -                      -                 -                         -
    30B              -                      -                 -                         -

If the larger rows behave like these two, the result stops being a prompting trick and becomes evidence
that architecture can substitute for some amount of model capability - and that some failures attributed
to model intelligence are failures in how the system asks a model to alter stateful code.
