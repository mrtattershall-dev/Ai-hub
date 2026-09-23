# PROTOCOL-1 — does narrowing model responsibility increase sustained productive work?

Preregistered 2026-09-22, BEFORE any implementation. A NEW experiment, not an amendment to
PHASE2-INTERVENTION_PREREG.md, which is closed at its stopping criterion (Amendment 14).

## The question

> **Holding the 7B model, tasks, tools, hardware, sampling and verification constant, does
> reducing the model's responsibility per turn increase sustained productive autonomous work?**

**NOT** "does Legasus win". d2 is not under test here. The Phase 2 campaign could not measure
Legasus because the generator/harness pair cannot stay alive long enough for the comparison to
mean anything - so this experiment asks whether it can be made to.

## Why this is earned rather than assumed

    1.5B, monolithic protocol   ~20 calls, ZERO writes to a protected target
    7B,   monolithic protocol   6-7 calls, 12-19s of a 600s budget, 0-1 productive writes
                                IDENTICAL trajectory at 60s and 600s budgets

Two model sizes, the same failure shape, one size apart. That is
`protocol-not-capability-ceiling` reproduced: a 1.5B scored 36/36 when the task boundary was
narrow and failed the monolith at the same capability.

This does NOT prove a narrower protocol will help. It earns the experiment.

## The responsibility pile-up, named

A single monolithic turn currently asks the model to:

    understand the goal -> decide what information it needs -> choose a tool -> REMEMBER WHAT
    IT ALREADY SAW -> construct exact tool syntax -> interpret the result -> decide whether to
    retry -> decide whether it is finished

The two observed pathologies:

    outline_file x6   re-requests a file the hub has already supplied
    hallucinated FIND recalls source text that never existed, for a file it never read

**CORRECTED SCOPE - do not overstate this.** An earlier draft asserted "both are bookkeeping
failures, NOT reasoning failures". That is more than the evidence supports. What IS established:

> The observed failures occurred DESPITE the hub supplying the required information, and they
> are CONSISTENT WITH failures of state tracking, action selection and exact-text bookkeeping
> rather than a demonstrated lack of coding knowledge.

Repeatedly requesting an already-seen file could still reflect attention or planning limits
inside the model. **This experiment is what decides it:** if externalising the bookkeeping
recovers usable work, the bookkeeping reading gains support; if the stall persists, it does
not. Freezing the interpretation now would be assuming the answer the experiment exists to
find.

## The proposed treatment: a gated micro-loop

Not a smarter prompt - a SMALLER JOB PER MODEL CALL.

    GOAL
     -> 1. OBSERVE    controller provides the relevant current state
     -> 2. DECIDE     model chooses ONE bounded intent
     -> 3. PRODUCE    model produces only the artifact that intent needs
     -> 4. APPLY      controller applies it deterministically
     -> 5. VERIFY     checks run automatically
     -> 6. CONTINUE   controller advances state
        (the model never owns the whole loop)

### The split of authority

    MODEL OWNS (intent authority)        CONTROLLER OWNS (bookkeeping authority)
      what behaviour should change         which files have been observed, and their hashes
      reasoning about code                 exact current source state
      generating code                      which tools are legal in the current phase
      choosing among a few next intents    whether an action changed anything
                                           whether this action has already failed
                                           verification, completion criteria
                                           preservation, promotion

This is the same principle d2 already applies to effects, applied to evidence.

### Four mechanical rules, built from general boundaries - NOT from the specimens

**These must be derived from responsibility boundaries, not tuned around `outline_file x6` or
the hallucinated FIND.** Those are specimens. If the rules are general, the pathologies should
disappear as a CONSEQUENCE; if they only disappear because they were targeted, the experiment
has proved nothing.

    R1  EVIDENCE FRESHNESS
        every model decision receives the exact current content/hash of the object it reasons
        about. The model is never asked to recall source text.

    R2  PHASE-RESTRICTED TOOLS
        OBSERVE -> inspection only. MUTATE -> mutation only. VERIFY -> automatic.
        Not 28 possible actions every turn.

    R3  NO UNCHANGED REPETITION
        if (intent, arguments, relevant-state-hash) repeats with no new evidence, the
        controller does NOT send another warning - it mechanically transitions: re-observe,
        choose another strategy, or stop.
        General law: a completed evidence-acquisition step cannot be repeated while its
        underlying evidence is unchanged.

    R4  MUTATION CREATES VERIFICATION OBLIGATIONS
        do not ask the model whether it should test. write -> obligations -> verify ->
        evidence -> next action.

R4 is the Legasus shape applied to the loop itself. A stale patch fails as
`PATCH_REJECTED_STALE` and returns to OBSERVE, rather than the model resending it twice.

## Design: CONTROL vs TREATMENT

    held constant   the 7B (Qwen2.5-Coder-7B-Instruct-AWQ), A10G, tasks, tool
                    IMPLEMENTATIONS, sampling, wall-clock budget, verification
    CONTROL         the current monolithic ACTION loop
    TREATMENT       the gated micro-turn protocol

Only the interaction contract differs.

## Measurements

    calls before termination                 productive mutations / total tool calls
    successful target mutations              repeated no-progress actions
    parser failures                          invalid / stale edits
    effective runtime USED (not allowed)     goals simultaneously verified at termination

### The baseline to beat, already measured

    7B monolith:  12-19s effective runtime | 6-7 calls | 0-1 productive writes
                  | terminated by repeat guard | identical at 60s and 600s

If the narrow protocol yields minutes of sustained productive activity instead of seconds,
that is a far more important result than any prompt tweak - and it would be the precondition
that makes the postponed Legasus campaign measurable at all.

## What would falsify it

If the gated protocol produces the SAME 12-19s stall, then responsibility narrowing is not the
binding constraint, and the honest conclusion is that this hub cannot host autonomous runs at
these model sizes regardless of protocol. That outcome must be reported, not iterated away.

## Explicitly out of scope

    - d2 / Legasus benefit (postponed, not abandoned)
    - upgrading to 14B to escape the problem
    - weakening the repeat guards or edit semantics: both were verified CORRECT
      (the refused FIND occurs 0 times in a file the model never read)

---

# AMENDMENT 1 — the responsibility split, frozen before compute

Date: 2026-09-22 (local), archival commit `f5ba97b`.
Status: **PROSPECTIVE.** No PROTOCOL-1 evaluation has run. This amendment is registered before
the comparison it governs produces any result.

PROTOCOL-1 tests a redistribution of responsibility, not a refactor of source files. Splitting
`agent.js` into twenty modules would not reduce what the model has to manage; moving state
tracking, sequencing and verification obligations into a controller is what does. The whole
experiment therefore turns on **which** obligations move, and that must be fixed in advance.

## Ownership

| decision | owner |
|---|---|
| propose an edit, or another attempt | **model** |
| declare that it believes the task is complete | **model** |
| track source state and enforce phase sequencing | **controller** |
| determine whether the requested behavior works | **the same independent evaluator in both arms** |
| decide whether a protected regression may survive | **the same d2 policy in both arms** |

The model **retains its completion judgment without becoming the authority on correctness.**
Those are different things and were previously conflated under "acceptance". A model may say it
is done; only the independent evaluator says whether the behavior works, and it is the same
evaluator in both arms, so it cannot become a treatment.

## The controller may not discard completed work

The controller **must not reject or discard finished work because the model used an unexpected
tool name, format, or phrasing.** Protocol non-conformance is a fact to record about the attempt,
never grounds for destroying the artifact the attempt produced.

This is the specific mechanism already observed to cost a 1.5B twice — suppressed generation and
discarded finished files over a tool name. Forbidding it is a design commitment, not a prediction
that it would recur.

## Four quantities, reported separately

Never summed, never collapsed into one score:

1. **protocol rejection** — attempts the controller refused for non-conformance
2. **termination** — why the run ended, by reason
3. **rollback** — what d2 refused to let survive
4. **independently measured quality** — verified new behavior retained at termination

A single number cannot distinguish "coordinated better" from "was allowed to finish", and those
are exactly the two hypotheses in play.

## What the prior results do and do not license

Two recorded results motivate this split:

- one-prompt-per-gate: a 1.5B scored 36/36 where the monolith failed the same content
- a different controller: a 1.5B scored 4/10 vs 10/10 (p=.031), suppressing generation and
  discarding finished files

Both moved state tracking out of the model; only the second also moved acceptance out. That
contrast **motivates** distinguishing the two, and it does **not isolate acceptance ownership as
the cause** — the two setups differed in other conditions that were never matched. The split
above is registered as a **design commitment to be tested**, not as an established finding, and
no result may be cited as confirming it unless the other conditions were held fixed.

## Excluded runs stay in the denominator

Traversal of a route closed for the experiment is an **experimental outcome**, not a discarded
sample. It is a preregistered exclusion, so:

- report **frequency by arm**, always
- report the excluded count alongside every rate computed from the remainder
- never let a protocol-induced exclusion vanish from the denominator

If one arm traverses closed routes more often than the other, that IS a result about the
treatment, and silently dropping those runs would hide it. This project already has a recorded
case of every published percentage resting on the wrong denominator.
