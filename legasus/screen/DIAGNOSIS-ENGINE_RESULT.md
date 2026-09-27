# DIAGNOSIS ENGINE — the step that was being done by hand is now mechanical: competing explanations, a chosen observation, elimination, a bounded scope with obligations, or a refusal that names what is missing

2026-09-27, **$0**, nothing deployed. `server/diagnose.mjs`, `server/diagnose.test.mjs` 26/26.

## The gap this closes

Every experiment so far asked a model to fix something and measured what came back. The step between
detecting a failure and editing was always done by a person: notice what evidence is missing, design
the probe, interpret it, choose the scope. REPAIR-2 is the clean case. The error

    [JS ERROR] Cannot read properties of null (reading 'addEventListener')

is equally consistent with **the element is not there yet**, **the id is wrong**, and **the interface
was never built**. The model chose the first because nothing separated them. **That choice is now
made by observation rather than by whoever reads the error.**

## What it does, in order

    1 reproduce          no reproduced failure, no diagnosis. Declines as UNREPRODUCED and says a
                         reproduction must capture the error, the code version and the observed state.
    2 signature          read off the evidence: a malformed script, a null property read or write, a
                         check that says the state must not change, a required effect absent.
    3 competing          every explanation the catalogue holds for that signature, each declaring the
                         observation that could contradict it. An explanation nothing can contradict
                         is not allowed in the catalogue.
    4 observe            take the observations those explanations name - and only those.
    5 eliminate          discard every explanation the observation contradicts.
    6 one survivor       or DECLINE: tied, all contradicted, observation unavailable, or no signature
                         matched. Each refusal names what is still needed.
    7 bounded plan       cause, the smallest scope the evidence implicates (a file line from the
                         stack), the obligations that must hold, and the LIMITS of what the
                         observation supports.

**Signatures are taken one at a time in priority order**, because they are not independent: a script
that does not parse explains every behavioural failure after it, and a page that threw while loading
never reached its behavioural checks, so those verdicts describe nothing.

## The proof that it is not a lookup table

The same engine, the same error signature, three worlds that differ only in what the page contains:

    the element is nowhere              -> INTERFACE_NEVER_BUILT
    the element appears after parsing   -> LOOKUP_TOO_EARLY
    an id one letter away exists        -> WRONG_IDENTIFIER

**Three different causes from one engine, decided by the observation.** And on the real arm B
candidate, from its own run, it reaches `INTERFACE_NEVER_BUILT` — the cause the model got wrong — with
scope `line 106` and the obligation *"the repair must not depend on an element with id "plant", which
the document does not have"*.

It also refuses properly. Hand it the same failure with the DOM observation removed and it declines
with `OBSERVATION_UNAVAILABLE`, names `IDS_PRESENT` as what it needs, and lists the three
explanations it cannot separate.

## What is automatic and what I authored

    AUTHORED   the catalogue: which explanations exist for a signature, which observation
               discriminates them, what each implies for scope and obligations.
    AUTOMATIC  for a given failure: which explanations apply, which observation to take, what that
               observation eliminates, whether one survives, and the scope and obligations that
               follow. No person reads the error.

**This is selection within a declared space, not open-ended invention.** It is the step that was
being done by hand and nothing more. Giving it an unfamiliar failure class would test whether the
space is wide enough, and that is untested.

## Three defects it found in my own work while being built

    predicates read the wrong probe   explanations received the observations flattened together, so
                                      one read a field that did not exist and threw at the moment it
                                      was meant to be eliminating an explanation. Each explanation now
                                      receives results keyed by probe and may only consult the one it
                                      declared.
    every probe was demanded          arm B's real failure declined for want of a state delta that
                                      cannot exist on a page exposing no state. Fixed by the priority
                                      ordering above.
    only the first script was parsed  a malformed LATER block was missed entirely, and its load-time
                                      exception was diagnosed as a behavioural cause. Every block is
                                      now checked, and the reported line is translated into a file
                                      line so the scope points at the real file.

Each was caught by a test written to discriminate, not by inspection.

## What this does NOT establish

- **That a repair follows.** The engine produces a cause, a scope and obligations. Nothing has yet
  been repaired by it, and the next experiment is whether these obligations plus this scope let a
  model produce an accepted edit.
- **That the catalogue is adequate.** Five signatures, five explanations, three probes. Unfamiliar
  failures are exactly what has not been tried.
- **Autonomy.** The catalogue, the task, the checks and the edit format are all mine. What is
  automatic is the choice of observation and scope for a failure inside the declared space.
- **That passing checks means correct.** Every obligation is "supported by these checks". The
  movement check measured position correctly for weeks while missing the exceptions raised during
  movement; that is recorded in `NARROW-2_RESULT.md` as a test-coverage gap.

## Where it fits

    detect -> explain -> observe -> eliminate -> bounded repair -> verify -> retain or restore

The first four are now mechanical (`diagnose.mjs`). Verify, retain and restore already exist and are
tested (`judgeCandidate`, `acceptance`, `repairLoop`'s revert rule). **The missing link is handing the
plan's scope and obligations to the repair attempt** — currently the loop sends the raw error instead.
Wiring diagnosis into the loop is the next $0 step, and measuring whether it changes acceptance is the
next experiment after that.
