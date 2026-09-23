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
