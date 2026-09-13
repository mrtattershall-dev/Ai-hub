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
