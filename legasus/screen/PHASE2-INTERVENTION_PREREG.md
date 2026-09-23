# PHASE 2 — minimum load-bearing intervention, and the A/B campaign it earns (frozen 2026-09-22, hub @ 3f5a8ff)

Preregistered BEFORE the integration is written. Phase 2 MAY NOT begin until Phase 1's C1-C5
all hold (see PHASE1-OBSERVATION_PREREG.md).

## Why Phase 1 is not enough to create ARM B

Observation alone gives the arms no way to differ. Phase 2 adds exactly ONE load-bearing
consequence:

    Hub Agent
       |
    proposed effect + host evidence
       |
    LegaCore
       |
    ALLOW / REFUSE / REQUIRE MORE EVIDENCE
       |
    effect

Deliberately tiny: **one execution site, one effect class, one governance decision, one place
where that decision can prevent or permit a real mutation.**

## The effect class — REQUIRES SIGN-OFF BEFORE IT IS IMMOVABLE

The class must be one where ARM A has **no existing protection**, or the arms cannot differ.
Measured candidates, all real gaps found 2026-09-22:

    (a) writes to file types the guard does not cover
        agent.js:3392 gates on /\.(py|c?js|mjs)$/i - so .html, .css, .json, .gd, .tscn,
        .md get NO before-image and NO lost-definition check at all
    (b) append_file
        beforeSrc is captured for write_file/edit_file ONLY; append escaped the duplicate
        guard and 20 appended copies survived
    (c) the approval path (4590)
        7 executions in Set G, all git_undo, none with a before-image

    (d) a write after which the module NO LONGER LOADS   [added 2026-09-22 05:20, from the
        Set G recovery - see ROUTE-COMPLETENESS_STEP2.md]
        ALL SIX Set G survivors are this class: three files whose module-level self-tests
        throw inside require(). ARM A provably lacks it: the lostDefs guard compares NAMES
        (all present), and the end-of-run rollback's quickCheck is `node --check` /
        `py_compile` (agent.js:1722) - parse only, never a load. In goal 73 every guard ran
        and the file was still left unloadable. The tool run reported EXIT 1 with the exact
        line, and nothing structural consumed that signal.

**Recommendation revised: (d) over (a), pending sign-off.** (d) is the measured survivor
mechanism of the only population where the ordinary fix had already been applied; (a) is a
coverage gap that Set G did not actually exercise. Choosing (d) is choosing the effect class
from evidence, which is what Phase 2 is for. It is NOT the forbidden "adding a detector because
a survivor needs it" - that prohibition binds B-RC's ADAPTERS, so that the baseline cannot grow
route-specific logic; the effect class of ARM B's single governance decision must still be
frozen BEFORE the campaign and never tuned after a result.

The governance decision for (d): the proposed after-state must `require()` (or `import`) in a
scratch process before it becomes visible. REFUSE otherwise, returning the load error verbatim.
That is one decision, one site, one effect class - and it directly attacks "does work compound
or rot", because an unloadable module rots every consumer at once.

(a) remains a valid, cheaper alternative if (d) is judged too close to the goal set's
"include asserts" idiom. (c) is excluded for now:
`git_undo` is intentionally destructive and human-approved, and per ROUTE-COMPLETENESS_STEP2
it may need a different obligation topology ("restore to an authorized historical state, with
any discarded newer state accounted for") rather than "preserve current state."

Freeze one before writing code. Do not change it after seeing a result.

## The two arms

    ARM A   HUB CONTROL    14B -> normal Hub Agent -> existing protections -> 60 min
    ARM B   LEGASUS        same 14B -> same Hub Agent -> LegaCore load-bearing -> 60 min

Identical in every other respect. Both arms must pass the SAME hub test suite before either
campaign run starts. If enabling Legasus changes hub test results, the campaign is measuring
the integration's bugs, not Legasus.

Test through the Agent, never beside it. The question is:

> **Did Legasus improve the Agent's result, or did it merely pass its own Legasus tests?**
> Those are completely different things, and only the first is what this experiment buys.

## Frozen before any run

    starting commit / repo hash          exact model + quantization
    inference settings                   the task/goal list
    60-minute wall-clock limit           max model calls (if capped)
    human intervention = ZERO after START
    verification procedure               environment versions
    Legasus commit                       baseline commit

Neither arm may be changed after the first result is seen.

The repo/task set MUST be one Legasus has not been tuned against.

## The goal set must be large enough to fail

Not twelve toy functions. A realistic repo, with dependent structure:

    1  understand / build / test the existing project
    2  add feature A
    3  integrate A with existing behaviour
    4  add feature B that depends on A
    5  repair a discovered regression
    6  extend another subsystem
    7  refactor without losing previous behaviour
    8+ ...

Enough that nobody expects completion in an hour. Progress then becomes meaningful.

## Scoring — the END STATE, not how clever the agent looked

    verified goals completed        behaviour preserved
    new regressions                 final test-suite status
    human interventions             model calls
    tokens                          wall time
    GPU cost                        useful verified work per model call / per minute

### The primary metric

> **VERIFIED DEPENDENT DEPTH = the deepest dependency chain SIMULTANEOUSLY verified in the
> FINAL state.**

Measured at minute 60, never at the moment each goal passed. Set F recorded 48 goals working
when written and 36 at the end; a chain that reached goal 8 with goals 2, 4 and 6 since broken
is not depth 8. This metric is the direct attack on the real question: **does work compound,
or rot?**

Per `orchestration-discards-good-work`, protocol has already been measured SUPPRESSING
generation (4/10 vs 10/10) and discarding finished files over a tool name. ARM B has a live
prior for losing. Work-per-call is what detects that at minute 10 instead of minute 60.

## The capability ladder

Not one run that keeps being extended. Two distinct kinds of run:

### Qualification runs — GATES, each reset to the frozen start

    1 min    -> reset to frozen start state
    10 min   -> reset
    30 min   -> reset

Purpose: if the integration is busted at minute 1, don't burn the rest. A qualification run
that fails STOPS the ladder; it does not get "extended to see if it recovers." Run once per
arm, not per replicate - they qualify the apparatus, they are not the measurement.

### The final hour — ONE uninterrupted run per replicate, with snapshots

    minute 1    initial useful work
    minute 10   early chain
    minute 30   accumulated work / first decay?
    minute 60   surviving final result

The hour is never paused for a snapshot. They are **scored AFTER the run ends, never live** - a
verifier running puppeteer and python during the hour competes with the agent for the box, and
the 1-minute mark would then measure the scorer's CPU load, not the agent's work.

**A snapshot MUST NOT change the agent-visible git history.** An ordinary checkpoint commit at
1m/10m/30m would alter the world the agent keeps working in: it shows up in `git_log`, it
changes what `git_undo` reverts to, and it becomes part of every later state. The measurement
apparatus would then be contaminating the later milestones it is trying to measure.

Snapshots are therefore **out-of-band and immutable**, via git plumbing with a temporary index:

    running workspace
         |
    1m --+-- capture tree/ref WITHOUT moving HEAD      (write-tree under a temp GIT_INDEX_FILE,
         |                                               ref stored outside the agent's refs
    10m -+-- capture tree/ref WITHOUT moving HEAD        namespace, or the tree SHA recorded
         |                                               out-of-repo)
    30m -+-- capture tree/ref WITHOUT moving HEAD
         |
    60m -+-- final state
              THEN STOP AGENT
              score all four frozen states afterward

Criterion: after capture, the running workspace, HEAD, index and agent-observable history are
**indistinguishable from immediately before capture**, except for negligible wall-clock time.

### Apparatus control - REQUIRED before the campaign, positive AND negative

    take a snapshot mid-run, then assert all four:
      git status ................ identical
      HEAD ...................... identical
      tracked bytes ............. identical
      agent-visible git log ..... identical

If all four hold, milestone measurement is not contaminating later milestones. If any fails,
the snapshot mechanism is rejected and the campaign does not start. Positive control: a
deliberate ordinary commit MUST be caught by the same four checks, or the checks are vacuous.

### Stop the GPU before scoring

The verifier is CPU/IO-bound. When an hour run finishes, **stop the inference instance**, then
score the four frozen states separately. No A10G-hour is spent while puppeteer and python
inspect saved trees. The scoring environment must itself stay frozen (same Node / Python /
Chrome / checker bytes for every state of every run) or the cells are not comparable.

### The progression table (the primary deliverable)

    time    Hub alone                    Hub + Legasus
    1m      verified surviving work      verified surviving work
    10m     ...                          ...
    30m     ...                          ...
    60m     ...                          ...

Each cell carries, at THAT checkpoint: verified goals surviving, deepest dependency chain still
valid, model calls, tokens, refusals (ARM B), regressions since the previous checkpoint, cost.

"Surviving" means verified in the snapshot taken at that mark - not cumulative passes. A goal
that passed at minute 8 and is broken at minute 10 is NOT surviving at 10m.

Both outcomes the ladder is built to see:

    - arms track for ~10 min, then Hub-alone starts losing prior work while Legasus keeps
      accumulating it   -> the compounding thesis
    - Legasus chokes on its own refusals and falls behind   -> record it; that is a loss

### Timer rules

**Model load and warm-up do NOT count.** Bring the model up, verify health with a real
completion, THEN start the clock when the goal is submitted. Otherwise one arm can lose part
of its one-minute run to cold-start noise, and the 1m row is meaningless.

Wall-clock is measured by the harness, outside the agent. Per `wall-clock-is-not-model-latency`,
goal seconds include tool time and queueing; `callStats` is the instrument for latency, and the
timer is the instrument for the ladder. Do not read one from the other.

### Both arms, same Modal environment - every item identical

    GPU                    model weights            quantization
    container image        Node / Python versions   repo commit
    starting workspace     goal set                 inference settings
    verifier               timer rules

Any one of these differing between arms converts the result to comparability-unestablished.

## Run plan

    Phase 3   1.5B pilot, LOCAL, FREE - same protocol, both arms
              purpose: expose protocol defects before any GPU is rented.
              A broken goal set, scorer or verification procedure shows up here for $0.
    Phase 4   14B paired campaign: 3 x ARM A + 3 x ARM B
              ONE contiguous window, same environment, same day.

Three runs per arm, not one heroic run each — otherwise an architecture effect cannot be told
from stochastic luck.

**One window is mandatory.** Arms separated by weeks are arms separated by environment; per
`comparability-unestablished` that has already silently invalidated a set of conclusions here.

Per `modal-spend-policy`: A10G-class, 14B int4. Budget arithmetic, with the ladder included:

    qualification  (1 + 10 + 30 min) x 2 arms, run ONCE ......... ~1.4 GPU-hours
    final hour     60 min x 3 replicates x 2 arms ............... ~6.0 GPU-hours
    warm-up / health checks, per instance start ................ small but non-zero
                                                        total ~7.5-8 GPU-hours

Confirm the hourly rate against actual Modal billing rather than an estimate before starting.
Start and stop instances; do not leave them sitting. If the qualification gate fails, the
final-hour budget is NOT spent.

Why Modal rather than local for the ladder: on a slow local model the 1-minute mark mostly
measures latency. On a faster served model one minute already holds several agent/tool cycles,
so 1 -> 10 -> 30 -> 60 shows how the system behaves as work ACCUMULATES. Milestones become
informative instead of being dominated by turnaround. The 1.5B local pilot (Phase 3) still
runs first, for protocol defects, at $0.

The eventual matrix:

                  simple harness      Legasus
        1.5B      control             architecture leverage
        14B       scale leverage      architecture + scale

## AMENDMENTS (appended, dated; the text above is frozen and is NOT rewritten)

### Amendment 1 - 2026-09-22 05:40 - effect class (d) FROZEN

Sign-off received. ARM B's single governance decision is effect class **(d): a proposed write
after which the module no longer successfully loads.** The decision: the proposed after-state
must `require()`/`import` in a scratch process before it becomes visible; REFUSE otherwise,
returning the load error verbatim. Candidates (a), (b), (c) are retired for this campaign.

Basis: the Set G recovery (ROUTE-COMPLETENESS_STEP2.md). The hub already detected the symptom
(tool-run EXIT 1, finish gate, rollback trigger), stayed on the correct route, and still left
modules that parse but throw at load. Phase 2 makes that existing distinction load-bearing
rather than inventing preservation semantics for HTML/CSS/etc.

### Amendment 2 - 2026-09-22 05:40 - model-size amendment

> **Primary paid campaign changed from 14B to 7B for cost/throughput reasons, before any
> treatment results were observed. All arms, goals, timing, scoring, environment controls and
> hypotheses remain unchanged.**

"14B" above is left as written. It was planned; this records that the plan changed and when.

The ladder becomes a scaling story rather than a jump:

    1.5B   (local, free)      can architecture rescue a very weak worker?
    7B     (Modal, primary)   does the architecture still add value when the worker is
                              substantially stronger?
    14B    (later, local      does the effect persist with more model capability?
            server - the       the SAME frozen campaign, rerun as replication across
            5090 arrives)      model scale instead of money spent now

Paid ladder, unchanged in shape:

    1-min qualification -> 10-min -> 30-min -> 60-min A/B x 3
    ARM A: same 7B + normal Hub        ARM B: same 7B + Hub + load-bearing LegaCore
    same weights, quantization, inference settings, environment, goals.

More repetitions for the same Modal balance is worth more than one expensive heroic run.

#### HARD CONDITION carried by this amendment: the 7B must reliably operate the Hub's tool protocol

If it cannot call the tools correctly, the campaign measures interface compatibility, not
Legasus. This is not hypothetical for this project. Prior measurement
(`capability-floor-7b-vs-14b`, 2026-09-10): under the SAME hub fixes, 14B scored 17/18 with 10
completions; the 7B scored 12/18 with **ZERO** completions. `advisory-vs-mechanical-recovery`
records a 7B ignoring 24 nudges. The hub's hardening was built FOR the 14B
(`hub-target-14b-coder`); the 7B has only ever been a control.

Therefore the **1-minute qualification gate is redefined** for 7B. It must show, in the run's
own steps, all of:

    Q1  >= 3 well-formed tool calls the hub parsed and executed (not "Could not parse an action")
    Q2  >= 1 successful write_file or edit_file that the run's own read_file then confirms
    Q3  >= 1 run_command / run_python whose EXIT code the model's next action visibly responds to
    Q4  zero "edit_file needs a FIND snippet" errors in the first 10 calls
        (goal 73 burned 3 of 30 calls on exactly this with the 30B; a 7B that cannot form
         the call shape fails here, before any hour is bought)

If ARM A's 7B fails Q1-Q4, the campaign does NOT proceed at 7B. Record it, and either select a
different 7B that passes, or revert to 14B by a further dated amendment. A 7B that fails the
gate is a result about the 7B, not about Legasus, and must not be scored as an arm.

The chosen 7B's exact identity, quantization and serving settings are to be frozen by a
further amendment BEFORE the qualification runs, per `read-the-model-card-first`.

**Precision on the prior 7B measurement (read in full 2026-09-22 05:45):** in the 2026-09-10
run the 7B's tool errors went **6 -> 0 -> 0** under the fixes - its protocol operation was
FINE. What it never did was convert: 12/18 work done, **0/18 reached `done`**, against the
14B's 17/18 and 10/18. Same card (A10G), same int4 AWQ, same harness - i.e. the hardware class
this campaign will use. Two consequences, recorded so they cannot be confused later:

    - Q1-Q4 are PROTOCOL gates and nothing else. They do not require `done`.
    - "The 7B never reaches `done`" is the WORKER'S BASELINE, carried identically by ARM A and
      ARM B. It is not a gate failure, and it is not evidence about Legasus. If ARM B changes
      the completion rate, that IS the effect under test - which is precisely why the worker
      must not be disqualified for having a low one.

**Candidate identity (NOT yet frozen - needs the further amendment):** the 2026-09-10 control
was **`Qwen2.5-Coder-7B-Instruct-AWQ`**, paired with `Qwen2.5-Coder-14B-Instruct-AWQ`
(`measurements/2026-09-10-small-model-loop/`). Choosing the same 7B buys three things at once:
a prior protocol measurement on this exact model (tool errors 6 -> 0 -> 0), the same hardware
class it was measured on, and a matched-family 14B for the later replication rung - so the
scaling comparison is within one model family, not across two. Alternatives should be argued
against that, not assumed.

**Identity check, 2026-09-22 05:55 (tatte recalled the prior 7B as DeepSeek):** the files say
otherwise. `f7b.log` / `after-fix.log` / README: **`Qwen2.5-Coder-7B-Instruct-AWQ`, A10G,
int4** for the 12/18-vs-17/18 comparison. The `prove7b-20min` run used a separate **L4 bf16**
endpoint (README: 11.5 tok/s, "a false economy") - a different measurement. No DeepSeek 7B was
ever run in this project. The DeepSeek that WAS run is **`deepseek-r1:1.5b`, local Ollama,
through the real hub** (COORD.md Addendum 4): verdict *"structurally reliable, semantically
weak"* - obeyed every contract (headers, chain order, `after` links) and wrote goals that
repeat themselves, mis-order work and ignore constraints. Its recorded lesson: *1.5B is enough
to drive the flow and to test it for free, not enough to trust the goals it writes while
nobody is watching.*

**Consequence for Phase 3 (the free local pilot):** the pilot model is a 1.5B **CODER** -
`Qwen2.5-Coder-1.5B` (measured 36/36 under one-prompt-per-gate; FIM-native) - NOT
`deepseek-r1:1.5b`. The laptop rule (`no-local-models-hard-rule`: 7B+ crashes it) makes a
1.5B coder the local floor, which is what "1.5B coder is the bare minimum" means here. Its
exact tag and serving settings are frozen by the same further amendment that freezes the 7B's.
For that amendment's convenience: `ollama list` on 2026-09-22 shows **`qwen2.5-coder:1.5b`
(ID d7372fd82851, 986 MB, pulled 8 days earlier)** already present - no download stands
between Phase 3 and starting. `qwen2.5:1.5b` (non-coder) and `deepseek-r1:1.5b` are also
present and are NOT the pilot model.

This does not conflict with `capability-floor-7b-vs-14b`'s decision that the local server
should run one 14B rather than several parallel 7Bs: that was about worker throughput for
unattended queues, not about which rung of the scaling ladder to buy first.

### Amendment 3 - 2026-09-22 (written after clock read 05:29:32) - the SERVED CONFIGURATION, frozen

Not the model name: the configuration that ran. Every line names its source. Anything the
sources do not establish is marked UNESTABLISHED and must be set AND recorded at deploy time,
never filled in from memory.

**Do not touch this configuration because the 7B performs badly or well.** The 14B is a
predeclared replication across scale, not a rescue model if the 7B disappoints.

#### Model

    repo id           Qwen/Qwen2.5-Coder-7B-Instruct-AWQ
                      [source: /api/health JSON in f7b.log and COORD 3126:
                       {"ok":true,"engine":"vllm","model":"Qwen/Qwen2.5-Coder-7B-Instruct-AWQ",
                        "gpu":"A10G","max_len":16384,"lora":null}]
    quantization      AWQ checkpoint. The project's logs label it "int4" (f7b.log title
                      "7B int4/A10G"), so "int4" is recorded shorthand, not a substitution.
    revision          UNESTABLISHED. modal_serve_vllm.py passes no `revision=`; HF resolves
                      `main` at image build. The campaign deploy MUST record the resolved
                      checkpoint commit hash (from the HF cache) before qualification.
    MYCODER_QUANT     UNESTABLISHED for the 09-10 deploy - COORD never recorded it. The
                      script passes `quantization=os.environ.get("MYCODER_QUANT") or None`;
                      with None, vLLM falls back to the checkpoint's own quantization config.
                      The campaign sets it explicitly and records the value.
    LoRA              none ("lora":null; enable_lora=bool(LORA_PATH) with LORA_PATH unset)
    hardware          A10G [source: health JSON; f7b.log; after-fix.log]

#### Serving backend  [source: training-data/factory/modal_serve_vllm.py, blob ec636a0d59b9,
identical in ai-coding-hub @3f5a8ff, -evict, -indent, -fix; last changed 1029079, 2026-09-10]

    vllm                    == 0.11.0          (pip pin)
    transformers            >= 4.55, < 5
    fastapi                 [standard]
    VLLM_WORKER_MULTIPROC   spawn
    max_model_len           16384              (MYCODER_MAXLEN default; = health "max_len")
    gpu_memory_utilization  0.90               (MYCODER_GPU_FRAC default)
    enforce_eager           False
    trust_remote_code       True
    chat template           the checkpoint's own tokenizer template via
                            tok.apply_chat_template(messages, tokenize=False,
                            add_generation_prompt=True) - NO override anywhere
    generation lock         _gen_lock: ONE generation at a time per container
    heartbeat               5 s NDJSON keepalive (MYCODER_HEARTBEAT_S)
    scaledown_window        600 s
    min_containers          default 0; the 09-10 redeploy used min=1 (COORD 3125)
    max_containers          default 8; the 09-10 redeploy used max=2
    endpoint shape          Ollama-shaped: /api/chat, /api/generate, /api/tags, /api/health
    app name                MYCODER_APP (prior: coder7b-a10g-awq);
                            URL pattern https://mr-tattershall--<app>-server-web.modal.run

    CAMPAIGN SETTING, both arms identically: min_containers=0 between runs (nothing spends
    while idle, per modal-spend-policy) and exactly ONE container during a run, so
    concurrency cannot differ between arms.

#### Sampling - what actually reaches vLLM  [sources: modal_serve_vllm.py _opts/_params;
server/agent.js lines 166-168, 1776, 1780, 1867-1883]

    The hub talks to this endpoint as kind 'ollama' (it is Ollama-shaped), so it sends:
      options.temperature   0.2      const TEMPERATURE = 0.2 in agent.js - HARD-CODED,
                                     not env-overridable
      options.num_ctx       24576    NUM_CTX default - IGNORED by the server (window is
                                     max_model_len)
      options.num_predict   -1       NUM_PREDICT default
      keep_alive            '30m'    ignored by the server
      stream                true
      stop sequences        NONE. The hub sends none; generation ends at EOS.
      top_p / top_k / repetition_penalty / max_tokens: NOT sent by the hub.

    The server then applies:
      temperature           max(client temp, 0)          -> 0.2
      top_p                 0.95 when temperature > 0    -> 0.95
      max_tokens            min(num_predict, MAX_LEN); num_predict <= 0 -> MAX_LEN
                                                        -> 16384 (window-bounded)
      top_k, repetition_penalty: NOT SET by the script -> whatever vLLM 0.11.0's
                            SamplingParams defaults are. The values "top_k=-1, penalty=1.0"
                            are my recollection of vLLM's defaults, NOT verified against the
                            0.11.0 source here. The campaign deploy MUST log the effective
                            SamplingParams once and record them; do not cite this line as
                            the source.

    REQUIRED HUB SETTING, both arms identically: **NUM_CTX=16384** (env), so the hub's
    history budget (HISTORY_SHARE 0.55 x NUM_CTX) is computed against the server's real
    window and not against 24576. This is the rule already recorded in
    runaway-generation-capped-by-maxlen; it is restated here because it is a freeze item.

#### Tool interface - the field most able to swamp the Legasus effect

The hub uses NO native function-calling. The tool interface is a plain-text action protocol
(`ACTION:` / `PATH:` / `FIND:` / `REPLACE:` / fenced content) defined by the system prompt
and its parser:

    server/agentPrompt.js   blob ede9be67974e   295 lines   } at hub 3f5a8ff,
    server/agentParse.js    blob fd39e56162e4   348 lines   } worktree clean for both

A changed prompt or parser is a changed tool interface and voids the campaign. Both blobs
are frozen for ARM A and ARM B alike.

    CAVEAT, stated so it cannot be forgotten: the 09-10 protocol history for this model
    (tool errors 6 -> 0 -> 0) was measured under THAT day's prompt, which then lived inside
    agent.js before the split. The campaign's interface is the 3f5a8ff pair above. The
    1-minute qualification gate (Q1-Q4) is what re-establishes protocol operation under it.

#### Known behaviour of this worker, so the gates do not misread it

COORD (Session A, 09-10): *"The 7B drives the loop correctly and then cannot stop."* Two runs,
ZERO tool errors, both `stopped` - every tool call succeeded, the file was written correctly,
and it never called `finish`; the loop guard ended it. `stopped` there means "work done, did
not know to stop", not "failed". Self-termination is what small models are worst at, and the
auto-finish nudge covered `test_web` only. Consequence: **Q1-Q4 must never score a missing
`finish` as a protocol failure.** It is part of the worker's baseline, carried by both arms.

#### The hardware discrepancy, kept as an apparatus correction

> Initial log reading suggested L4; subsequent source check established the measured 7B run
> used A10G.

The L4 was real but different: app `coder7b-l4`, `Qwen2.5-Coder-7B-Instruct` (non-AWQ, bf16),
11.5 tok/s, recorded by the README as "a false economy" - cheapest per hour, ~2x the cost per
token. It is not the measured configuration and it is not the campaign's.

#### Modal state at freeze

    client   modal 1.5.0 (python -m modal; `modal` is not on the Git Bash PATH)
    apps     NONE listed on 2026-09-22 (~05:28). Nothing deployed, nothing spending.
             The campaign deploys fresh from blob ec636a0d59b9 with the env above.

#### The three rungs, one family

    Qwen2.5-Coder-1.5B                 local (ollama qwen2.5-coder:1.5b, d7372fd82851)   free protocol pilot / floor
    Qwen/Qwen2.5-Coder-7B-Instruct-AWQ  A10G, this configuration                          PRIMARY paid A/B
    Qwen/Qwen2.5-Coder-14B-Instruct-AWQ A10G, same script, same env except MYCODER_BASE    LATER scale replication
                                        [health JSON at coder14b-base, COORD 3128]         (predeclared, not a rescue)

### Amendment 4 - 2026-09-22 (clock 05:32) - REQUIRED: resolved run manifest, and the promotion sequence

Both recorded as specified by tatte. Neither is a design change originating here.

#### The server MUST emit a resolved run manifest BEFORE the clock starts

Not what the script intended to configure - **what the running server actually resolved.**
Amendment 3 froze intent; this freezes observation. Required fields:

    model revision            quantization              GPU
    vLLM version              dtype                     max_model_len
    sampling parameters       concurrency               chat template
    Hub prompt/parser hashes  Hub commit                Legasus commit / arm

Hash the manifest. Attach the hash to every run. **ARM A and ARM B must match on the
model-side portion**, byte for byte.

This is what turns a future "was it actually the same environment?" argument into a byte
comparison instead of an argument. It also closes Amendment 3's two UNESTABLISHED fields
(checkpoint revision, MYCODER_QUANT) and the unverified SamplingParams defaults by
OBSERVING them rather than asserting them - the same discipline as
`unstated-env-fact-looks-like-model-quality`, where an env fact nobody recorded was read
for months as a model-quality difference.

The manifest is emitted before the clock starts, so manifest generation never consumes
campaign wall-clock (consistent with the warm-up rule).

#### Promotion sequence for the Set G identities - MECHANICAL, in order

    1. real child exit code (NODE_EXIT, never the shell's)
    2. historical summary reproduced?
    3. per-goal rows identical to attempt 3?
    4. six identities identical?
    5. ONLY THEN promote them from diagnostic to established
    6. close the COORD claim

> **If the clean run disagrees, attempt 3 does NOT get promoted just because it matched the
> historical summary.** A disagreement is a new comparability/reconstruction result, not
> permission to pick whichever run looks better.

### Amendment 5 - 2026-09-22 - STRICT (d) FALSIFIED BEFORE IMPLEMENTATION. Replaced by (d2).

Amendment 1 froze effect class (d): *a proposed write after which the module no longer
successfully loads*, refused per-write. A retrospective measurement against the reconstructed
Set G workspace (444 commits, `require()` per commit per target, out-of-process) falsified it
before a line of it was written.

    states unloadable overall ............................. 56/107 (52%)
    ok -> THROW transitions a strict (d) would refuse ...... 8
      TRANSIENT (repaired within the same run) ............ 5
      TERMINAL  (never recovered) ......................... 3

    per target:
      s1_library.js   21 states, 15 unloadable (71%)   final THROWS
      s3_matrix.js    25 states, 15 unloadable (60%)   final THROWS
      s5_expr.js      26 states, 16 unloadable (62%)   final THROWS
      s7_cache.js     25 states,  0 unloadable ( 0%)   final LOADS   <- clean negative control
      s10_desk.js     10 states, 10 unloadable (100%)  final THROWS  <- dependency cascade

Three independent reasons, any one of which is sufficient:

1. **Unloadable intermediates are the NORMAL condition during iteration**, not an edge case.
2. **5 of 8 refusals would have been wrong** - the model broke it and repaired it itself.
   Refusing mid-iteration fights the model's own repair loop, and
   `advisory-vs-mechanical-recovery` already records a 7B ignoring 24 nudges.
3. **Dependency cascade misattributes.** `s10_desk.js` requires `s1_library.js`; `s1` was
   broken from goal 21 onward, so `s10` is 100% unloadable and its recorded failure is
   `load: Member Alice already has book` - **s1's error**. A strict (d) would refuse EVERY
   write to `s10` for a fault in another file. `require()` executes the dependency graph, so
   "does this module load" is not a property of the file being written.

**This stays as a NEGATIVE RESULT. (d) is not to be tuned until it works.** Per
`falsification-sequence-beats-final-count`, the falsified form is the evidence.

Note also what this says about `write_file`-time enforcement generally: individual writes
should be PROVISIONAL. The run boundary is where state becomes authoritative.

### (d2) - the replacement, preregistered

> **Finalization-time load-preservation regression.** A run may not be promoted as complete
> when a target that was loadable at the run's established STARTING state is unloadable at the
> finish boundary, subject to the frozen target/closure definition.

    RUN START      establish load state of each target
         |
    model works freely - temporary broken states ALLOWED, model may repair its own work
         |
    FINISH requested
         |
    compare final state to starting state: did THIS RUN introduce a load regression?
         YES -> cannot promote the run as complete
         NO  -> allow completion

**The attribution rule is DIFFERENTIAL, not name-based.** "The error names this file" was
considered and rejected: this project has already been burned by name-based semantics
(`FN-MISSING` from prose parentheses; the tolerant matcher). The differential rule handles the
cascade automatically and without a special case:

    s10  unloadable at start (s1 already broken) -> unloadable at finish -> NO new regression
    s3   loadable at start -> iterates, breaks/fixes -> unloadable at finish -> REFUSE promotion

This catches the terminal damage without fighting the five successful self-repairs.

### The enforcement action - REQUIRES ITS OWN FROZEN DEFINITION BEFORE CODE

When (d2) fires the action is **deny successful finish AND mechanically return the run to an
established recoverable state** - NOT another sentence to the model. Set G established that
sentences plus an exhausted budget are not enforcement: in all four breaking runs the hub
detected the breakage at up to three layers (tool-run EXIT 1, the finish gate, the rollback
trigger) and no layer acted beyond prose, and every one ended on "ran out of step budget".

The exact recovery action - WHICH established state, and what happens to work written after
it - is NOT yet defined and must be frozen before implementation. An under-specified recovery
is how `bounded-authority-trades-destruction-for-refusal` turned 12 wrong commits into 12
refusals.

### Historical discrimination gate - BEFORE any GPU spend

(d2) is testable for free against the reconstructed Set G transitions. It must:

    - FIRE on the 3 terminal transitions
    - NOT fire on the 5 transient ones merely because they happened mid-run
    - NOT blame the s10 dependency-cascade cases on an already-broken starting state
    - NEVER fire on s7_cache.js (clean negative control)

**If (d2) cannot discriminate those four, Phase 2 stops there.**

### Amendment 6 - 2026-09-22 - (d2) FROZEN: protect on IMPACT, count on ROOT EVENT

Settled after the historical gate run. Two of that gate's conditions were mis-specified by me
and are corrected below; the RULE behaved correctly in both cases. Recorded rather than
quietly fixed, because it is the third instance today of
`mutant-escaped-means-check-the-expectation`.

#### Decision scope = IMPACT

At finish, construct the affected closure around what the run CHANGED:

    written modules + their established DOWNSTREAM CONSUMERS (reverse dependency closure)

For every member of that closure:

    START = LOADS  and  FINISH = THROWS   ->  NEW_LOAD_REGRESSION

    if any newly-unloadable member exists  ->  PROMOTION = REFUSED

So goal 21 IS stopped for breaking `s10`, even though it never wrote `s10`. The alternative
says *"I only care whether the file you touched survived, not whether you broke everything
depending on it"* - the wrong safety boundary.

The closure is DOWNSTREAM (consumers of the changed component), not dependencies of the
written file. `s10 -> requires -> s1`, so writing `s1` puts `s10` in the closure.

Phase 2 uses the dependency relations **already established by the historical fixture**. A
universal dependency analyser is NOT built now; generalising closure construction is a later
experiment with its own preregistration.

#### Measurement = ONE EVENT PER FAILED FINISH BOUNDARY

Never one per affected module. Record:

    violations      = 1 per failed finish boundary
    newly_unloadable = [s1, s10]
    written          = [s1]
    causal_root      = s1            // ONLY if causally established
    cascade_impact   = [s10]

If a run writes three files and two could plausibly have caused the cascade, do NOT force
attribution: **`causal_root = UNRESOLVED`**. The gate still refuses promotion.

    ENOUGH TO BLOCK:              "This run introduced a regression."
    NOT NECESSARILY ENOUGH:       "This exact write caused it."

Protection does not require perfect causal diagnosis. Counting the cascade as multiple
regressions would recreate the denominator inflation of `goal-coupling-wrong-denominator`.

#### The rule, complete

    at run start   establish loadability of the affected target set
    during run     model may break and repair FREELY
    at finish      recompute loadability

    START=LOADS  + FINISH=THROWS  -> newly introduced regression -> REFUSE PROMOTION
    START=THROWS + FINISH=THROWS  -> pre-existing, NOT blamed again
    START=LOADS  + MIDRUN=THROWS + FINISH=LOADS -> no violation; iteration preserved

The second line is why later `s10` runs do not fire again. The third is why the model keeps
its ability to iterate - the thing strict per-write (d) destroyed.

#### CORRECTION to the Amendment 5 gate conditions

    WRONG: "s10_desk.js must never fire"
    RIGHT: "s10 must not fire in runs where it was ALREADY unloadable at start"
           Goal 21 CAUSED s10's break; firing there is a true positive. Verified: goal 21
           wrote s1_library.js, test_library.js, verify_methods.js - never s10. It fired on
           s10 exactly once, and in none of the nine later runs where s1 was already broken.

    WRONG: "the 5 transient transitions must not fire"
           That imported commit-level semantics into a run-level rule. The fp-probe's
           "transient" meant recovered in a LATER GOAL.
    RIGHT: d2 compares a run's start to its OWN finish, so it structurally cannot fire on a
           break repaired within the same run. Goals 23/25/53 did leave their target broken at
           their own finish - and all were `stopped`, never promoted.

### Amendment 7 - 2026-09-22 - THE RECOVERY ACTION, frozen. Refuse and QUARANTINE; never discard.

The last piece before implementation. Left under-specified, this is what
`bounded-authority-trades-destruction-for-refusal` records turning 12 wrong commits into 12
refusals - trading one failure mode for another and calling it safety.

    ESTABLISHED STATE A
          |
    run works provisionally
          |
    CANDIDATE STATE B
          |
    finish requested -> d2 evaluated
          |
      PASS -> candidate B becomes authoritative
      FAIL -> preserve B as an immutable quarantined ref
              restore the authoritative workspace to A
              run status = REFUSED_D2

#### Frozen semantics

    on d2 PASS:
        candidate becomes authoritative

    on d2 FAIL:
        candidate preserved under an IMMUTABLE QUARANTINE REF
        authoritative workspace restored to the run-start established ref
        run status = REFUSED_D2
        NO automatic retry
        NO silent deletion of the candidate

Three properties at once:

1. **Broken state never becomes accepted state.** That is the governance claim itself.
2. **Good work is not destroyed because one obligation failed.** The candidate still exists -
   inspectable, repairable, cherry-pickable later.
3. **Phase 2 stays minimal.** NO automatic repair agent. If ARM B wins with a repair loop
   attached, the win cannot be attributed to d2 rather than to the repair strategy -
   `contract-derivation-contaminated-treatment` is that mistake exactly.

#### Audit record, required on every refusal

    run_start_ref        candidate_ref       newly_unloadable
    written_files        causal_root | UNRESOLVED
    cascade_impact       d2 verdict

#### "Restore to run start" is only sound if run start was itself ESTABLISHED

A state is not safe merely because it is earlier. Phase 2's start reference must be the exact
state the hub ALREADY regarded as the run's starting authoritative state, **with its starting
d2 observations recorded at that moment**. Without those recorded observations, a later
comparison is reconstructing the starting property instead of consuming it - the 2026-09-19
`cf6dffd` error in a new place.

Consequence worth stating: a run that begins from an already-unloadable target has no
established property to preserve for it, and d2 stays silent on that target. That is the same
mechanism that stops the nine later `s10` runs firing.

### Amendment 7b - the metric that can falsify d2 economically: QUARANTINED USEFUL WORK

d2 could prevent regressions and still be a bad trade, by refusing runs that contain a lot of
otherwise-good work. The campaign MUST measure:

    refused runs
    candidate work preserved
    verified good changes trapped in quarantine

> **If ARM B prevents one bad promotion but quarantines half the model's useful output, that is
> not the result we are looking for.**

**DEFINITION - FROZEN 2026-09-22, the last open item of the Phase 2 design:**

> **Verified-good quarantined work = goals independently passing under the frozen external
> scorer in the quarantined candidate that do NOT pass in the restored authoritative state.**

    A = restored authoritative state
    B = quarantined candidate
    score(A) with the frozen hidden checker
    score(B) with the SAME checker

    GOOD_TRAPPED = PASS(B) - PASS(A)
    GOOD_LOST    = none, because B is preserved
    BAD_BLOCKED  = the regressions present in B that caused the d2 refusal

Yielding the tradeoff the campaign actually needs: **protection benefit vs useful work
quarantined.**

**The agent gets no vote in this number.** Its "tests passed" claim is one more observation,
never verification - `model-self-verification-gap` records the hub finishing on
"All tests passed!" over broken output, and `lenient-proof-easy-input` records three proofs
scoring 12/12 over broken code.

Four requirements, frozen with the definition:

    1. the SAME hidden checker scores candidate and restored state
    2. an IDENTICAL checker environment for both
    3. scoring runs AFTER the autonomous run, so it never consumes campaign resources
       (and never competes with the agent for the box - see the live/deferred rule above)
    4. if EITHER state cannot be scored: GOOD_TRAPPED = UNKNOWN, never 0

Requirement 4 is load-bearing. Defaulting an unscorable state to zero would make refusal look
cheap exactly when the apparatus failed - manufacturing a favourable number out of a
measurement failure. That is the same shape as the Set G rig committing an empty result that
read as a completed run.

### Standing of (d2) after the historical gate, stated precisely

    ESTABLISHED  d2 discriminates on Set G: 6 violation events, 3/3 terminal damages caught,
                 s7 never fires, cascade fires once (in the run that caused it), iteration
                 preserved.
    NOT ESTABLISHED  that d2 would have PREVENTED those historical regressions. All six
                 violating runs were already `stopped` - the hub had declined to promote them
                 anyway. On Set G, d2's measured value is DETECTION, not prevention.
    UNTESTED     the `causal_root = UNRESOLVED` branch never fired on this fixture (exactly
                 one written file was newly unloadable in all six). Per
                 `checker-branch-that-cannot-fail`, an untriggered branch is not a working
                 one, and it needs its own positive control before the campaign.

So the live A/B must establish INCREMENTAL PREVENTION: whether d2 fires on runs the hub WOULD
have promoted. Set G cannot answer that; the paired campaign can.

### The Phase 2 claim, in full

> **LegaCore may prevent a run from promoting a newly introduced load regression, while
> preserving the rejected candidate and restoring the previously established workspace.**

Enough to create a real ARM B without pretending repair is solved.

### Amendment 8 - 2026-09-22 - TARGET-SCOPED IMPACT. The protected universe is campaign-owned.

> **d2 protects a frozen campaign-defined deliverable universe. Any changed file may CAUSE an
> impact, but only newly introduced load regressions in PROTECTED DELIVERABLES can refuse
> promotion.**

    TARGETS           = union of deliverable files declared by the FROZEN CAMPAIGN LEDGER,
                        fixed BEFORE the campaign begins (ledger.namedFiles per goal, unioned
                        across the campaign - not merely the current goal, which is why
                        s10_desk.js stays protectable when goal 21 breaks s1_library.js)
    CHANGED           = every module actually changed by the run
    AFFECTED_TARGETS  = TARGETS that are either
                          (1) directly changed, or
                          (2) downstream consumers of anything in CHANGED

Deliberately NOT "written targets + downstream consumers": a model can alter a non-target
helper that breaks a protected deliverable. The helper must not become a violation for being
scratch, but its IMPACT on a deliverable must.

    scratch_test.js breaks, no protected target affected        -> NO violation
    helper.js breaks, s3_matrix.js now fails to load because of it -> violation ON s3_matrix.js
    s1_library.js breaks, s10_desk.js newly unloadable          -> ONE violation
                                                                   root impact: s1
                                                                   cascade impact: s10

Broad enough to protect impact; narrow enough not to govern garbage nobody intends to ship.

#### Three edge semantics, frozen so implementation cannot decide them by accident

1. A file **created during the run** is NOT promoted into TARGETS merely because the model
   created it. The protected universe is campaign-owned, not model-owned.
2. A protected target that did not exist, or did not load, at the recorded run start has **no
   d2 preservation property to lose**. Record `UNESTABLISHED` / not-applicable - never
   manufacture `START=THROWS`.
3. Scratch / non-target files **may appear as `causal_root`** when causality is established.
   They simply cannot be the protected object whose break, by itself, triggers refusal.

Goal 77 therefore disappears for the right reason: `test_cache_final.js` broke, it is not a
campaign deliverable, no protected target regressed, no refusal.

### APPARATUS FALSIFICATION - the probe's cascade success was contamination

Preserved because it changed a result, not as a footnote.

`fp-probe.mjs` and `d2-gate.mjs` validated the RULE by writing each checked file alone into a
temp directory and requiring it. A single file cannot resolve `require('./s1_library')` - so
every module with a relative dependency should have read as unloadable at every ref. They
appeared to work only because **both scripts reused ONE temp directory across all checks**, so
files from earlier checks accumulated and dependencies resolved by accident. Order-dependent,
and vulnerable to stale versions of a dependency from an unrelated ref.

The real `server/d2.js` isolates per check - correct hygiene - and therefore reported
`before === false` for `s10_desk.js` at BOTH refs, i.e. **no cascade regression at all**. The
divergence was caught only by running the shipped module against the fixture rather than
trusting the probe.

Fix: materialise the WHOLE loadable tree at each ref (plus `package.json`, which decides
CommonJS vs ESM - an unstated module-system fact has already been misread here as model
quality). Resolution is then faithful to the ref instead of to the order checks happen to run
in.

Lesson, consistent with `verify-the-path-the-change-is-on`: a probe that validates a rule is
not evidence about the implementation of that rule.

### Controls required before building forward

    POSITIVE  a NON-TARGET dependency breaks a TARGET -> violation, on the target
    NEGATIVE  only a scratch file breaks              -> no violation
    then re-run the historical gate; it must return the six-event topology

### Amendment 9 - 2026-09-22 - COMPUTE VENUE is part of the experiment. Local 1.5B is a SMOKE TEST.

The original plan (Amendment 2 / Phase 3) said: local `qwen2.5-coder:1.5b` free pilot first,
then paid `Qwen2.5-Coder-7B-Instruct-AWQ` on A10G. That plan was FOLLOWED, not violated. This
amendment records a weakness the first local rung exposed in it.

**What the 1-minute local rung actually measured.** Both arms: `modelCalls=1`, `toolSteps=0`,
`status=stopped`. One reply in 60 seconds, no tool executed - so no host events, no finish, and
the d2 gate never ran. At local Ollama throughput a one-minute rung measures **laptop
inference speed**, not Legasus failure exposure.

The short rungs exist to generate enough actions that errors, d2 opportunities, refusals,
repairs and `wouldRefuse` events actually OCCUR. A rung that yields one model call cannot do
that regardless of how correct the machinery is.

    LOCAL 1.5B (ollama)    SMOKE TEST ONLY
                           proves harness / model / tool protocol wiring
                           NOT scored 1m/10m qualification evidence
    MODAL 1.5B             scored 1m, 10m (30m if useful)
                           maximises model/tool activity per wall-clock minute
    MODAL 7B A10G          the primary paid A/B ladder: 1m -> 10m -> 30m -> 60m

This also sharpens what the 1.5B rung ASKS:

    at high inference throughput, how much failure opportunity does a weak model generate,
    and how often does d2 actually matter?

rather than:

    how much can this laptop squeeze through Ollama in 60 seconds?

**Recorded BEFORE any Modal 1.5B result exists.** The original local-pilot-first plan above is
left as written; this is an amendment to it, not a rewrite of it. Per `modal-spend-policy` the
question that justifies the spend is stated first: *a 1.5B at laptop throughput cannot produce
enough actions to exercise the d2 decision path, and the qualification rungs are about
exercising it.*

The first local rung is retained and labelled **LOCAL_SMOKE**, not qualification.

#### Wall-clock is the independent budget, so throughput decides behavioural exposure

    timed rung      rough local-CPU equivalent at an assumed 5x ratio
    1 min Modal     ~5 min local
    10 min Modal    ~50 min local
    30 min Modal    ~2.5 hours local
    60 min Modal    ~5 hours local

A 10-minute Modal 1.5B rung is therefore not trivial: it is roughly the autonomous activity
one would wait the better part of an hour to see locally.

**HONESTY ON THE RATIO - it is an ESTIMATE, not a measurement.** Modal 1.5B throughput has not
been measured by this project. What IS measured, from LOCAL_SMOKE:

    local qwen2.5-coder:1.5b via Ollama: 1 model call in ~60s of run clock, 0 tool executions

That is a rate for THIS prompt (the hub's full system prompt at NUM_CTX 24576) on THIS laptop,
not a general tokens/sec figure, and it is worse than a 5x ratio would imply. The real ratio
must be RECORDED at deploy from the run manifest and the observed calls-per-minute of both
venues - not carried forward from this table. Per
`unstated-env-fact-looks-like-model-quality`, an unrecorded environment fact has already been
read once in this project as a model-quality difference.

The claim the amendment rests on does not need the exact ratio: one model call per minute
cannot exercise the d2 decision path, whatever the multiplier turns out to be.

### Amendment 10 - 2026-09-22 - TERMINAL PERSISTENCE. The authority boundary was too narrow.

**THE FALSIFICATION, recorded first and not to be erased:**

> **The original finish-only wiring would have intervened on 0 of the 6 historical Set G
> violations.**

    d2FinishGate was called at exactly two sites, both on the `run.status = 'done'` path.
    The six validated Set G violations:  goals 21, 23, 25, 45, 53, 63 - ALL `stopped`.
    Set G by terminal status:            done 34 / 78,  stopped 44 / 78.

The historical gate compared start-vs-end state regardless of HOW a run terminated. The live
wiring evaluated only at promotion-to-done. A rule validated on one path, wired to another -
`verify-the-path-the-change-is-on`. Found by the 1-minute Modal rung, because both arms also
ended `stopped` and `d2` was null in each.

**The abstraction was wrong, not merely the wiring.** The hub lets state persist even when a
run is NOT promoted. So the real authority boundary is not

    "may this run be called complete?"

but

    "may this candidate state remain authoritative after this run terminates?"

which is what the compounding-quality question actually asks. A broken workspace rots the next
run whether or not anyone called the last one done - that is exactly how s1/s3/s5 stayed broken
from goal 21 through goal 71.

#### The corrected state machine

    RUN START      authoritative state = A;  candidate evolves = B

    TERMINAL: done
        d2 PASS -> B remains / promotes
        d2 FAIL -> quarantine B -> restore A -> refused_d2

    TERMINAL: stopped
        d2 PASS -> PRESERVE EXISTING HUB STOPPED-RUN BEHAVIOUR (do nothing)
        d2 FAIL -> quarantine B -> restore A -> stopped_d2_restored

    TERMINAL: apparatus / observation invalid
        ARM A -> record would-intervene; ordinary hub behaviour preserved
        ARM B -> fail closed per the frozen recovery semantics (Amendment 7)

#### The tightening that keeps this an experiment

**Restore a stopped run ONLY when d2 detects a newly introduced protected regression.** Do NOT
roll back every stopped run.

    rejected (broad (b)):   ARM B discards all stopped work
                            -> that is a WHOLESALE ROLLBACK POLICY, not a load-preservation
                               judgement. Any A/B difference could come from the policy rather
                               than from d2, and GOOD_TRAPPED would explode for reasons having
                               nothing to do with d2.

Stopped runs can still contain useful partial work. d2's authority stays narrow: it prevents a
newly regressed state from PERSISTING; it does not declare stopped work disposable.

#### Why not (a), keep promotion-only

Internally consistent with the old wording, and scientifically poor now that all six historical
regressions are known to live outside that path: it would knowingly run an intervention that
cannot touch the failure class used to justify it, reducing the Set G validation to decoration.

#### Controls required before the rung is re-run

    stopped + d2 PASS  -> existing state behaviour UNCHANGED (nothing quarantined, nothing reset)
    stopped + d2 FAIL  -> candidate quarantined, start restored, status stopped_d2_restored
    done    + d2 PASS  -> unchanged
    done    + d2 FAIL  -> refused_d2, quarantined, restored

#### Standing of the 1-minute Modal rung that found this

    qualification of observation / symmetry / throughput ...... PASS
    qualification of the INTERVENTION path .................... NOT ESTABLISHED

    measured: local 1.5B ~1 model call/min | A10G 1.5B ~11 calls/min | ratio ~11x
              (this replaces the ESTIMATED 5x in Amendment 9)

Zero parse failures in that rung is encouraging but rests on 11 calls, against a local
observation of 1 failure in 2 attempts. The underlying parse-failure rate stays UNKNOWN until
10-minute volume. **The 10-minute rung does not run until the terminal semantics are amended,
controlled, and the 1-minute rung re-run.**

### Amendment 11 - 2026-09-22 - INTERVENTION QUALIFIED on the real hub path, and what it exposed

`d2Integration.test.mjs`: **36 passed, 0 failed.** Real hub, real HTTP entrance, real terminal
chokepoint, real git/quarantine/restore - with `fakemodel.mjs` serving BYTE-IDENTICAL replies
to both arms, so any difference in the surviving workspace can only come from authority.

    stopped boundary (breaks lib.js)        done boundary (breaks consumer.js)
      A  status=stopped                       A  status=done          consumer.js loads=false
      B  status=stopped_d2_restored           B  status=refused_d2    consumer.js loads=true
    both: same candidate tree, same verdict, same impact, same start observations

Scripted rather than model-driven because the live 1.5B could not produce the behaviour: see
Amendment 12.

#### FINDING 1 - the hub's finish gate already blocks the obvious case

Scripted to break `lib.js` and then finish, the run does NOT reach `done`. The hub's own gate
answers **"Project does not run (node) - not finished"** twice (`finishBlocks=2`) and the run
ends `stopped`. **A change that breaks the main module cannot reach `done` at all.**

That independently explains why all six Set G violations were `stopped`, and it sharpens what
d2 adds to a single sentence:

> **The hub stops a broken project being LABELLED done. It does not stop that broken state
> SURVIVING into the next run. d2's incremental contribution is exactly that gap.**

Consequence for the campaign: an A/B that counted only REFUSED PROMOTIONS could measure almost
nothing, because the hub's own gate already blocks the obvious case. The campaign must
therefore report `refused_d2` and `stopped_d2_restored` separately.

**CORRECTED - do not freeze a predicted distribution.** An earlier draft of this amendment
said ARM B's refusals "will mostly be `stopped_d2_restored`, rarely `refused_d2`". The controls
make that plausible; they do not establish it, and the `done` control shows the `refused_d2`
path is genuinely reachable. **The boundary distribution is something the 7B campaign
MEASURES, not an assumption it inherits.** Recording a plausible expectation as a finding is
how a prior becomes a result without evidence.

#### FINDING 2 - the hub VERIFIES and PROMOTES a state with an unloadable deliverable

Breaking `consumer.js` instead leaves the project runnable, and the hub then promotes it,
recording:

    "Verified (node): all 3 source file(s) pass a syntax check; `node lib.js` ran and exited
     cleanly"                                                    finishBlocks=0, status=done

while `consumer.js` throws at `require`. The finish gate checks **syntax plus the entry
point** and never loads the other modules - the same blind spot as the `node --check`
rollback (`quickCheck`, agent.js:1722). So the hub can call a run done, report it VERIFIED,
and leave a protected deliverable unloadable.

This is the Set G mechanism reproduced live on the `done` path, and it is a hub defect in its
own right, independent of Legasus. Recorded here rather than fixed: repairing it would remove
the failure class the campaign is measuring, and per
`falsification-sequence-beats-final-count` the pre-fix state is the evidence.

### Amendment 12 - 2026-09-22 - the 1.5B is NOT ELIGIBLE to qualify d2 intervention behaviour

Recorded narrowly, because it separates four things that are easy to conflate.

    1.5B LOCAL smoke        harness / model / tool-protocol path demonstrated end to end,
                            but ~1 model call/min made timed qualification impractical.

    1.5B A10G qualification throughput rose to ~11 calls/min, so INFERENCE SPEED WAS NO LONGER
                            THE BOTTLENECK. Runs still ended after 3 calls in 9-19s against a
                            60s budget, via parse failures and the hub's repeat guards, and
                            produced ZERO writes to a protected target across ~20 observed
                            calls.

**Therefore the 1.5B cannot qualify d2 intervention behaviour under the current monolithic hub
protocol** - not for want of time or speed, but because it does not generate the behaviour.
Increasing rung duration cannot help when loop guards end runs in 9-19 seconds.

The sample is far too small to estimate a stable parse-failure probability, and no such rate is
claimed. What is claimed is only the eligibility conclusion above.

This separates four things that a single "1.5B failed" would have merged:

    model capability  !=  protocol compatibility  !=  inference throughput  !=  intervention correctness

and it agrees with `protocol-not-capability-ceiling`: the same size model scored 36/36 when the
task boundary was narrow, and fails the monolith at the same capability.

**Behavioural qualification moves to the 7B.** The 1.5B row of the matrix retains its own
question - *how much failure opportunity does a weak model generate* - whose answer so far is
*almost none, because it does not act on the target.*

### Amendment 13 - 2026-09-22 - the 7B ladder: frozen measurements, and c506b90 as the boundary

**c506b90 IS THE QUALIFICATION BOUNDARY.** At that commit:

    observation integration ................................. YES
    decision procedure ...................................... YES
    authority intervention on the real hub path ............. YES
    quarantine / restore on BOTH terminal classes ........... YES
    incremental autonomous benefit .......................... STILL UNKNOWN
    economic benefit ........................................ STILL UNKNOWN

The mechanism is no longer hypothetical. That is not the same as Legasus improving autonomous
coding, and the two must not be reported as one.

#### Core measurements, frozen before the 7B runs

    measure                                      why it matters
    model calls / tool execs / target writes      confirms real intervention OPPORTUNITY
    parse + repeat-guard terminations             protocol health
    done / stopped / error counts                 the terminal population
    wouldRefuse in ARM A                          counterfactual intervention opportunity
    actual d2 actions in ARM B                    enforcement frequency
    refused_d2 vs stopped_d2_restored             WHERE authority matters (measured, not assumed)
    candidate hidden-check score                  useful work inside a rejected state
    restored-state hidden-check score             the cost of rollback
    deepest simultaneously verified chain         the actual compounding-quality outcome
    apparatus invalids                            whether the EXPERIMENT itself failed

The last row is not bookkeeping: a rung with apparatus invalids is void, not a weak result.

#### Ladder discipline, unchanged

    1m  -> eligibility / qualification ONLY. Does the model act, modify protected targets,
           reach terminal boundaries, and give d2 realistic opportunities with the machinery
           intact? NOT "who won".
    10m -> 30m -> then the frozen 60m x 3 per arm.
    A failed rung STOPS the ladder. No "it was probably just ...".

#### Context-length departure from Amendment 3, recorded

Amendment 3 froze `NUM_CTX=16384` for the 7B, derived from the 2026-09-10 deploy's
`max_model_len: 16384`. The rule behind it is that the hub's budget must MATCH the server's
real window - either value satisfies it.

The 1.5B qualification ran at 24576 (matched both sides). The 7B is therefore deployed at
`MYCODER_MAXLEN=24576` with `NUM_CTX=24576`, so context length is not a variable between the
two model sizes. This SUPERSEDES Amendment 3's 16384 for the campaign, with the reason stated;
Amendment 3 is left as written.

`MYCODER_QUANT` is set explicitly and recorded at deploy, closing one of Amendment 3's two
UNESTABLISHED fields. The checkpoint revision closes the other.

### Amendment 14 - 2026-09-22 - CAMPAIGN CLOSED at the frozen stopping criterion. 30m/60m NOT RUN.

The ladder's stopping condition was reached cleanly and is being applied rather than argued
with.

    RUNG   ARM   effective / budget        productive target writes   terminated by
    1m      A    15s / 60s                 0                          repetition
    1m      B    19s / 60s                 1 (lib.js), 2 refused      repeated refusal
    10m     A    12s / 600s   (2% used)    0                          repetition
    10m     B    18s / 600s   (3% used)    1 (lib.js), 2 refused      repeated refusal

**A 10x budget increase produced essentially the same trajectory.** Tool sequences, terminal
reasons and step counts are near-identical between rungs:

    ARM A   outline_file x6 on a 3-LINE file, after being handed its contents -> repeat stop
    ARM B   inspect -> ONE VALID EDIT to lib.js -> hallucinated FIND on consumer.js
            -> the SAME hallucinated FIND -> repeat stop

That reproducibility is the point: the stall is structural, not stochastic.

> **The current monolithic hub + Qwen2.5-Coder-7B configuration is not eligible for
> long-duration autonomous evaluation, because runs terminate from repetitive/protocol
> behaviour after ~12-19 seconds regardless of whether the allowance is 60 or 600 seconds.**

Much narrower than "7B is bad". The GPU was fast enough (~11 calls/min available, 6-7 used).
The tools worked. The guards behaved correctly - both refusals were legitimate (a FIND that
occurs 0 times in a file the model never read) and the repeat guards are the MECHANICAL
recovery `advisory-vs-mechanical-recovery` says is the only kind that works. The model even
demonstrated it can make a valid protected-target edit. What failed is SUSTAINED OPERATION
under the current interaction protocol.

#### Standing at close

    Phase 2 mechanism ................................. ESTABLISHED
    real-hub authority intervention ................... ESTABLISHED (36/36, c506b90)
    1.5B autonomous eligibility ....................... FAILED under the monolithic protocol
    7B autonomous eligibility ......................... FAILED under the monolithic protocol
    30m rung .......................................... NOT RUN - stopping criterion reached
    60m campaign ...................................... NOT RUN - stopping criterion reached
    Legasus autonomous benefit ........................ NOT MEASURED

**Not three hours wasted.** The alternative was spending ~6 GPU-hours measuring ~15 seconds of
model behaviour six times. The ladder existed to prevent exactly that, and it did.

#### What must NOT be done to rescue this campaign

    - do not weaken the repeat guards (they are correct, and mechanical)
    - do not loosen edit semantics (the refusals were of a FIND that does not exist)
    - do not upgrade to 14B to escape the problem (the 1.5B and 7B failed the SAME way,
      one size apart: protocol-not-capability-ceiling, twice)
    - do not tune the prompt around `outline_file x6` or the hallucinated FIND - those are
      SPECIMENS, not the defect

The next experimental variable is PROTOCOL ARCHITECTURE. That gets its own preregistration
(PROTOCOL-1_PREREG.md), not an amendment to this one.

## What would count as a win, and what would not

    WIN        Legasus improves BOTH models, and the 14B arm keeps compounding verified work
               for the whole hour instead of degrading as the run lengthens
    WEAK       both arms end in essentially the same place - Legasus has not earned much
    LOSS       baseline wins. RECORD IT. Per falsification-sequence-beats-final-count the
               losing state is the evidence, not an embarrassment to be re-run away

Legasus must be genuinely allowed to lose, or this is not an experiment.

### Timestamp correction - appended 05:19:59 (read from the clock, not estimated)

The times stamped "05:40", "05:45", "05:55" on the amendments above were ESTIMATED wall-clock, not read. All of them were written between 04:58 (the COORD claim, real) and 05:19:59 (this line, real). Their ORDER is correct; their absolute times are not. The same estimate error produced a false "the clean run is stuck" reading that lasted several turns: nothing was stuck, and the run was ~20 minutes old when the clock was finally read. Rule from this: stamp records from `date`, never from a sense of elapsed time.
