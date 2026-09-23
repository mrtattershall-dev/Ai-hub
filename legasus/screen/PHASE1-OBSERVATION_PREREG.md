# PHASE 1 — observation integration (frozen 2026-09-22, hub @ 3f5a8ff)

Preregistered BEFORE the integration is written.

## The state this starts from, measured

    legasus/ source -> hub server modules ................. 0 imports
    server/ + client/src/ -> legasus|legacore|legascreen ... 0 references
    LEGA* / AGENT_LEGA* env switches ...................... none

**Legasus has never improved the Hub Agent because Legasus has never been inside the Hub
Agent.** It has been run AGAINST the hub (97 test files instrumented for coverage) and never
INSIDE it. Every Legasus result to date is of the beside-the-Agent kind.

This does not retract those results. It bounds them: they are about LegaCore's concepts and
machinery, not about autonomous coding outcomes.

## What Phase 1 does

`agent.js:3396` emits ONE canonical host execution event. A governance consumer reads it.
Nothing else changes. No hub behaviour is altered, no mutation is prevented or permitted
differently.

The event carries what is already in scope at that site:

    tool, args, beforeSrc, result/rawAnswer, run{id, goal, source}, callKey

plus `entrance`, which must be threaded from the router as LINEAGE and MUST NOT be inferred at
3396 (see HOST-BOUNDARY_PATTERN.md).

The event is the authoritative record. `saveTrace()` becomes a projection over it, not its
source. LegaCore MUST NOT consume `saveTrace()` output — that would repeat the 2026-09-19
`cf6dffd` error in subtler form.

## THE HARD LIMIT ON WHAT PHASE 1 MAY CLAIM

> **"Events successfully reached LegaCore" is NOT evidence that Legasus improves autonomous
> coding, and may never be reported as such.**

In Phase 1 the two arms are:

    ARM A   Hub Agent -> mutation
    ARM B   Hub Agent -> mutation
                      \-> LegaCore observes it

These **cannot differ in software outcome.** Legasus here is instrumentation, not an
intervention. Any A/B run conducted at Phase 1 would measure nothing, and running one would be
an error, not a weak result.

## What Phase 1 CAN establish

Exactly one thing: **the information contract.** That the facts LegaCore needs exist at the
host boundary at full fidelity, and survive the crossing.

Success criteria, all required:

    C1  every tool execution at 3396 produces exactly one event (no drops, no duplicates)
    C2  beforeSrc arrives unmodified when captured, and arrives as NULL-AND-MARKED when not -
        never as an empty string, and never reconstructed
    C3  `entrance` is present and correct, distinguishing at minimum:
              actor=model  entrance=supervisor
              actor=model  entrance=human-started-agent
              actor=human  entrance=approval-resume
    C4  the hub test suite passes IDENTICALLY with the consumer on and off
        (baseline the pass counts BEFORE the change, per baseline-consumers-before-changing-shared-code)
    C5  no LegaCore verdict vocabulary is flattened on return - UNRESOLVED, UNKNOWN_RULE,
        INSUFFICIENT_EVIDENCE, REFUSED and INVALIDATED stay distinct from `false`/`failed`

## Known holes Phase 1 does NOT close, stated in advance

    - 2690 (subtask) and 4590 (approved pending) still execute tools with NO event and NO
      beforeSrc. Phase 1 covers 3396 ONLY.
    - the 5 direct HTTP workspace mutators emit nothing.
    - the PTY (mechanism 6) mutates out-of-process and cannot emit from inside Node at all.

Coverage claim for Phase 1 is therefore **1 of 3 execution sites, 1 of 6 mutation mechanisms.**
Report mechanisms before sites, always.

## C4 CLARIFIED - frozen 2026-09-22 06:12, with the sweep at 14/90 and the result NOT yet known

    C4 does NOT ask:  "Did Phase 1 make every test pass?"
    C4 DOES ask:      "Did Phase 1 introduce a behavioural difference OUTSIDE its declared
                       observation-only contract?"

So if pristine 3f5a8ff is `89 pass / 1 deterministic crash` and Phase 1 gives `89 pass / 1 SAME
deterministic crash`, **C4 is satisfied.** A pre-existing failure is part of the baseline. It
must not be repaired on the way through, and an imaginary 90/90 green state must not be
demanded.

### The baseline as observed so far (recorded, not repaired)

    8/90  FAIL  270s  batchActions.test.mjs   exit 3221226505

`3221226505` = `0xC0000409` = Windows STATUS_STACK_BUFFER_OVERRUN: a process-level fast-fail,
not an assertion failure. The RAW child exit code is recorded rather than translated into
"test failed", because the distinction is the finding.

### Characterisation protocol for batchActions.test.mjs - BEFORE any Phase 1 wiring

    1. rerun from pristine 3f5a8ff several times, agent.js still untouched
    2. same crash every time      -> baseline DETERMINISTIC FAILURE
       mixed pass/crash/failure   -> baseline FLAKY / ENVIRONMENT-SENSITIVE
    3. record wall time AND raw exit code for every attempt
    4. repair neither behaviour
    5. run the post-integration characterisation under the SAME background-fuzz condition
       where possible

Then C4 compares against the **characterised** baseline. If pristine is flaky on that file,
the after-result is interpreted against that flakiness and is NOT automatically counted as a
Legasus regression.

### Why the fuzz campaign still matters here, differently

`fuzzForever`/`fuzzLoop` cannot feed Phase 1 source changes into the isolated worktree - that
contamination was closed by working in `ai-coding-hub-phase1`. What they CAN still do is change
machine load, which matters for tests that spawn long-running children and wait on timeouts.
`batchActions.test.mjs` booted its own hub and ran 270s before dying, so it is exactly that
shape. Hence step 5: characterise both sides under the same background condition, or say
plainly that they differed.

## THE CHARACTERISED BASELINE - pristine 3f5a8ff, recorded 2026-09-22 06:38

Sweep: **85/90 passed in 965s**, worktree `ai-coding-hub-phase1` @ 3f5a8ff, node v24.15.0,
`agent.js` untouched, `fuzzForever`/`fuzzLoop` running throughout on the main tree.
Artifact: `server/suite-baseline-BEFORE.json`.

The five failures are THREE different things. Treating them as one number would have been the
mistake.

### (a) 85 deterministic passes

Compared strictly after integration. Any of these turning red is a Phase 1 regression.

### (b) 3 environmental preconditions - deterministic, NOT defects

    realChain.test.mjs   exit 2, 0s
    realGame.test.mjs    exit 2, 0s
    realModel.test.mjs   exit 2, 0s

Established from source, not from the filenames:

    const BASE_URL = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
    if (!BASE_URL) { console.error('set MODEL_BASE'); process.exit(2); }

They need a live model endpoint; Modal had zero apps deployed. They must exit 2 after
integration too. If any of them ever RUNS, the comparison is invalid - the environment
changed, not the code.

### (c) 2 LOAD-SENSITIVE files - demonstrated, not suspected

    file                     in the loaded sweep              alone on the same commit
    batchActions.test.mjs    CRASH 0xC0000409, 270s           PASS 3/3  (298s, 314s, 305s)
                             (after printing "ok ON: nothing   "15 passed, 0 failed", stderr empty
                              destroyed (checkInvariants)")
    verifierInfra.test.mjs   exit 1, 30s                      PASS 3/3  (14s, 13s, 12s)
                             "2 passed (with failures above)"  "verifier infra: 3 passed"

Both pass 3/3 in isolation and both take LONGER under load (batchActions 298-314s alone vs a
270s crash; verifierInfra 12-14s alone vs 30s). That is contention, not breakage. This is the
`queueLock` coin-toss pattern COORD already records, and it is the machine-load contamination
class - fuzz cannot reach this worktree's source, but it competes for the CPU.

**Why this had to be done BEFORE wiring:** had the emit gone in first and the after-sweep shown
`batchActions` crashing, the obvious reading would have been "Phase 1 broke it." It breaks on
its own. The characterisation is what makes that inference unavailable.

### How C4 is decided against this baseline

    (a) the 85       strict equality. 85 must still pass.
    (b) the 3 real*  must still exit 2, having run 0s.
    (c) the 2 flaky  NOT decided by a single sweep. After integration each is run 3x IN
                     ISOLATION, exactly as here. C4 is satisfied if each still passes 3/3.
                     A sweep-run failure for these two is uninformative in either direction
                     and may not be reported as a Phase 1 regression OR as a Phase 1 success.

A single before/after sweep diff is therefore NOT the C4 test. The test is: 85 strict, 3
environmental unchanged, 2 characterised the same way on both sides.

## SCOPE BOUND - what the emitted event IS, and is not (frozen 2026-09-22, before C1-C5 ran)

The event emitted at agent.js:3396 is the **pre-governance execution observation**: what the
TOOL returned, at the moment it returned it. It is deliberately NOT the hub's final
disposition of that call.

Those come apart, and the hub already makes them come apart eleven lines later:

    tool returned X
      -> hub preservation/duplicate logic may transform or refuse X
      -> the final effect is Y

The emit is placed BEFORE the duplicate-call guard appends its warning to `result`, so a
consumer is told the producer's answer rather than the hub's commentary on it. That is the
same boundary rule as `cf6dffd`: adapt the authoritative producer's evidence, do not read a
downstream rendering of it.

**Phase 1 does not attempt to reconcile X with Y, and must not be expanded to.** A later
phase may need both the proposed effect and the final disposition as two linked facts; that
is a different information contract and needs its own preregistration. C1-C5 prove only the
contract frozen above.

## Failure condition

If the facts turn out NOT to be available at full fidelity at 3396 — if anything must be
reconstructed, inferred, or defaulted to make the event well-formed — that is a Phase 1
FAILURE and it falsifies the feasibility half of H-HOST-CONTEXT. Record it; do not patch
around it by having LegaCore fill the gap.
