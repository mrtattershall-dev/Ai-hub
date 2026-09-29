# PHASE 1 RESULT — the information contract is ESTABLISHED (2026-09-22, clock 07:15)

Scored against PHASE1-OBSERVATION_PREREG.md, frozen before the integration was written.
Worktree `ai-coding-hub-phase1`, branch `phase1-host-event`, from hub 3f5a8ff. Main tree never
touched: `fuzzForever` (running since 09-12) reruns `fuzzLoop` against on-disk code, so an
in-place edit would have fuzzed an uncommitted change and contaminated both that campaign and
the baseline.

## The claim this licenses, in full

> **The real AI Coding Hub can transmit canonical execution evidence into a consumer on its
> actual Agent path, without a difference detectable by the 90-file suite at the characterised
> resolution.**

NOT "without changing hub behaviour" full stop. The suite is the instrument and the instrument
has known, measured noise: two of its files flip under load, three never ran for want of
`MODEL_BASE`. That distinction is the difference between a measurement and a guarantee, and it
is exactly the kind of gap `unstated-env-fact-looks-like-model-quality` records being read
later as something it was not.

**Still no claim that Legasus improves autonomous coding.** A Phase 1 sink observes and returns
nothing; the arms cannot differ in software outcome. That is Phase 2.

## Coverage, stated with its denominator

    execution sites covered ....... 1 of 3   (agent.js:3396; NOT 2690 subtask, NOT 4590 approved-pending)
    mutation mechanisms covered ... 1 of 6   (the agent tool table; the PTY mutates out-of-process)

Sites 2690 and 4590 still execute tools with no event and no before-image. This denominator
travels with every Phase 1 coverage claim, as with the route census.

## C1-C5

    C1  one event per execution, no drops, no duplicates ......... ESTABLISHED (real path)
    C2  before-image verbatim, or absence as a typed REASON ...... ESTABLISHED
    C3  entrance present, correct, distinct from source .......... ESTABLISHED
    C4  suite identical with the consumer on and off ............. ESTABLISHED (3 parts, below)
    C5  no verdict vocabulary flattened on return ................ ESTABLISHED

`hostEvent.test.mjs`: **20 passed, real NODE_EXIT=0.**

C1 was NOT checked against a replica. Part B spawns a real `index.js` against `fakemodel.mjs`
with `HOST_EVENT_LOG` set, then compares the JSONL the hub itself wrote against that run's own
`type === 'tool'` steps: equal count, same tools, same order. The test SKIPS loudly rather than
passing if the harness is unavailable — a criterion that quietly stops being checked is worse
than one that fails.

## C4 in three parts, decided mechanically

    BEFORE  85/90 passed, 965s     AFTER  88/91 passed, 929s
    files added: hostEvent.test.mjs    removed: none

    (a) 85 deterministic ...... 85 still passing, 0 changed
    (b) 3 environmental ....... realChain/realGame/realModel: exit 2 at 0s, before AND after
    (c) 2 load-sensitive ...... isolation decides, per the frozen protocol:

            batchActions.test.mjs   pristine 3/3 PASS (298/314/305s)
                                    post     3/3 PASS (283/281/278s)
            verifierInfra.test.mjs  pristine 3/3 PASS (14/13/12s)
                                    post     3/3 PASS (13/12/13s)

`wiring.test.mjs` passes: `hostEvent.js` is genuinely imported by `agent.js`, not an unwired
capability.

### The trap the characterisation avoided, recorded because it nearly fired the other way

In the sweeps those two files went `CRASH 0xC0000409 @270s -> PASS @286s` and
`FAIL(1) @30s -> PASS @12s`. Both IMPROVED after the change. Without the pristine
characterisation the available inference would have been "Phase 1 fixed two tests" — flattering
and false. They are load-sensitive; the sweep result for them is uninformative in BOTH
directions, which is why only the isolation runs were allowed to decide.

## What was built

    server/hostEvent.js        the canonical event, the sink registry, the file sink
    server/hostEvent.test.mjs  C1-C5
    server/suiteBaseline.mjs   the 90-file sequential sweep (exit status is the verdict)
    server/agent.js            +1 import, +1 env-gated sink attach, +1 emit, entrance threading

### Three design decisions worth keeping

**The emit sits BEFORE the duplicate-call guard.** Eleven lines later that guard appends a
warning to `result`. A consumer reading it after that is told the hub's commentary instead of
the tool's answer — the same "decorating a value another mechanism keys on" mistake agent.js's
own comment records having already cost it once.

**Absence is a reason, not a null.** `NOT_A_WRITE` / `TOOL_NOT_COVERED` / `EXT_NOT_COVERED` /
`NEW_FILE`. `append_file` and an uncovered extension no longer look like "there was nothing
there" — which is precisely how 20 appended copies once survived the duplicate guard.

**A FILE sink, not an in-process callback.** The hub under test is a child process; an
in-memory listener could only ever have tested a convenient imitation of the process boundary.
It is also C4's honest on/off switch: `HOST_EVENT_LOG` unset means zero sinks and
`emitHostEvent` returns on its first line.

## Scope bound, frozen before C1-C5 ran and restated here

The event is the **pre-governance execution observation** — what the tool returned, when it
returned it. It is not the hub's final disposition. `tool returned X` and `final effect Y` come
apart, and reconciling them is a different information contract needing its own
preregistration. Phase 1 was not expanded to solve it.

## Next threshold

Phase 2 changes the category from `Hub -> Legasus observes` to
`Hub -> Legasus judges -> Hub behaviour can change`, on effect class (d): a proposed write
after which the module no longer loads. Amendments 1-4 of PHASE2-INTERVENTION_PREREG.md already
freeze the effect class, the served 7B configuration, the run manifest and the promotion rules.
