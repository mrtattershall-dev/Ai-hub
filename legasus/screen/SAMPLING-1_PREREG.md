# SAMPLING-1 — is the 7B stall caused by the protocol, or by the sampling configuration?

Preregistered 2026-09-22, BEFORE the run. A cheap rival-explanation test, run BEFORE the
PROTOCOL-1 integration touches agent.js.

## The rival explanation

PROTOCOL-1's premise is that responsibility pile-up causes the 7B stall. An untested rival:
**the model was served in a generation regime that invites repetition.**

    parameter             prior campaign        official Coder generation_config.json
    temperature           0.2                   0.7
    top_p                 0.95                  0.8
    top_k                 disabled (not set)    20
    repetition_penalty    1.0 (NOT SET)         1.1
    do_sample             -                     true

`repetition_penalty` was never set at all - neither the hub nor `modal_serve_vllm.py` passes
one, so vLLM's default of 1.0 applied. **Every observed termination was a repetition failure:**
`outline_file` x6 byte-identical, "the model produced the same response 3 times", the same
hallucinated FIND resent verbatim.

That is a live rival explanation for a campaign whose dominant termination mode was repetitive
output, and it was never separated from the protocol claim.

**Correction recorded:** an earlier draft of this reasoning cited `repetition_penalty=1.05`.
That is the NON-Coder Qwen2.5-7B-Instruct value. Qwen2.5-Coder-7B-Instruct specifies **1.1**,
and the non-quantised Coder model specifies 1.1 too, so this is not an AWQ peculiarity. The
1.05 came from the wrong model card - exactly the failure `read-the-model-card-first` exists
to prevent, caught before it reached a run.

## What Amendment 14 actually established

    claimed:  "not eligible under the monolithic protocol"
    honest:   "not eligible under the monolithic protocol, SERVED AT temp 0.2 WITH NO
               REPETITION PENALTY"

Two claims that were never separated. This experiment separates them.

## Design

Hub stays MONOLITHIC. `c506b90` behaviour otherwise unchanged. The ONLY variable is the
generation regime, and the values are sent EXPLICITLY in the request path rather than inherited
from server defaults - so there is no "what did vLLM actually apply?" question afterwards.

    temperature=0.7  top_p=0.8  top_k=20  repetition_penalty=1.1

    model      Qwen2.5-Coder-7B-Instruct-AWQ      GPU   A10G
    context    NUM_CTX = max_model_len = 24576    cap   10 minutes
    replicates 3, sequential
    tasks / workspace / tools / verification / d2   unchanged

Three replicates because a single run cannot distinguish a regime change from a lucky draw,
and because if the old pathology remains they will each terminate in seconds - the cost is
minutes of GPU, not 30.

## Measurements, frozen before the result

    effective runtime            model calls
    productive target writes     successful / refused edits
    parse failures               repeat events
    terminal reason              verified progress at termination

## The discriminator - NOT "did it repeat less"

> **Does the model now sustain materially more PRODUCTIVE autonomous work?**

Fewer repetitions with the same 0-1 useful edits is not a pass. The baseline to beat, measured
at temp 0.2 / no penalty:

    ~12-19s effective runtime of a 600s allowance | 6-7 calls | 0-1 productive writes
    | repeat/loop termination | IDENTICAL at 60s and 600s budgets

## Pre-committed readings

    IF the replicates still give ~15-30s, few calls, 0-1 useful edits, repeat termination
        -> sampling is a WEAK explanation; PROTOCOL-1 gets stronger footing and proceeds
           against the existing baseline.

    IF they give minutes of operation, multiple valid mutations, continued progress across
    tool results, substantially fewer repetition stops
        -> STOP. Amendment 14's "monolithic protocol is not eligible" was CONDITIONAL ON A
           POOR SAMPLING CONFIGURATION. PROTOCOL-1 must be re-premised against the corrected
           monolithic baseline before any integration.

## What this cannot invalidate

d2, Phase 1, the terminal governance, quarantine/restore and the real-hub intervention
controls are untouched by this - they were established with scripted models and deterministic
fixtures, not with the live 7B. What a positive result would invalidate is narrower and
specific: **the inference that responsibility pile-up was the likely binding cause of the 7B
stall.**

## Changes this requires, both to frozen artifacts

    agent.js                 TEMPERATURE is hard-coded at line 334 and not env-overridable;
                             the hub sends no top_p / top_k / repetition_penalty at all
    modal_serve_vllm.py      _params() hard-codes top_p and passes neither top_k nor
                             repetition_penalty, so request values would be silently dropped
                             - the same "silently ignoring a caller's parameters" defect its
                             own comments record having been fixed once before

Both are recorded departures from Amendment 3's frozen configuration, made for this
experiment and carried forward only if it succeeds.
