# DIAGNOSIS ENGINE — a rule-based engine that selects observations, eliminates explanations conditionally, proposes a bounded scope with obligations, or declines by name. Now wired into the repair attempt.

2026-09-27, **$0**, nothing deployed. `server/diagnose.mjs`, `server/diagnose.test.mjs` 32/32, `server/repairLoop.test.mjs` 46/46.

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

## Conditional diagnosis, which is all it is

The same engine, the same error signature, three worlds that differ only in what the page contains:

    the element is nowhere              -> INTERFACE_NEVER_BUILT
    the element appears after parsing   -> LOOKUP_TOO_EARLY
    an id one letter away exists        -> WRONG_IDENTIFIER

CORRECTED after review: an earlier version called this "proof that it is not a lookup table". It is
not that. **Different answers in three constructed worlds demonstrate CONDITIONAL DIAGNOSIS — the
answer follows the observation — and nothing about whether a true cause has been established.** A
rule-based diagnostic engine is useful without the stronger label.

On the real arm B candidate, from its own run, it reaches `INTERFACE_NEVER_BUILT` — the hypothesis the
model got wrong — with a proposed scope at `line 106` and the obligation *"the repair must not depend
on an element with id "plant", which the document does not have"*.

## Two hypotheses that must never be promoted to fact

    WRONG_IDENTIFIER        an id one letter away SUGGESTS a wrong identifier. It does not establish
                            which element the program INTENDED - intent is not observable here - and
                            the requirement may name a different interface entirely, in which case
                            neither id is right.
    INTERFACE_NEVER_BUILT   an absent element establishes ABSENCE IN THE OBSERVED STATES. "Never
                            built" stays a hypothesis unless the paths that could create the element
                            have been checked. A creation-path observation was added for that, and it
                            is weak by construction: it reads THIS file for creation machinery and
                            external scripts, so it can support the hypothesis and can never
                            establish it.

Both now travel with those sentences attached, in the output and in the prompt.

## The output keeps four things apart

    observedFacts    what was measured: the raised error, the selector that returned nothing, the ids
                     present at failure, the ids present once ready with the readyState, the creation
                     machinery found, the state delta, a parse failure and its file line.
    hypothesis       the surviving explanation, labelled 'SURVIVING HYPOTHESIS - consistent with the
                     observations taken, not established as the cause', with what it SUPPORTS, what it
                     leaves UNRESOLVED, which explanations were eliminated, and its LIMITS.
    proposedScope    'PROPOSAL: this is where the failing operation was observed. It is not
                     established to be the right place to edit.' Plus the edit-before-rewrite
                     preference, as a preference.
    obligations      what any repair must satisfy: the explanation's own requirements, the failing
                     check by name, and every check that must keep passing.

**Line 106 locates the failing operation. It is not asserted to be the edit site**, and the prompt
says so in those words.

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
- **That the catalogue is adequate.** Five signatures, five explanations, four probes. Unfamiliar
  failures are exactly what has not been tried, and an unfamiliar one would most likely produce
  NO_SIGNATURE_MATCHED - a refusal, which is the right failure mode but not coverage.
- **Autonomy.** The catalogue, the task, the checks and the edit format are all mine. What is
  automatic is the choice of observation and scope for a failure inside the declared space.
- **That passing checks means correct.** Every obligation is "supported by these checks". The
  movement check measured position correctly for weeks while missing the exceptions raised during
  movement; that is recorded in `NARROW-2_RESULT.md` as a test-coverage gap.

## Wired into the repair attempt

`repairLoop.mjs --evidence diagnosis` now recomputes the diagnosis from each round's own observations
and hands over the four sections. What that prompt contains is pinned by tests
(`repairLoop.test` 46/46, cell 8): the facts are separated, the explanation is labelled a hypothesis,
what it does not settle is handed over with an explicit invitation to disagree, the absence limit
travels with it, the proposed line is marked as not established to be the edit site, and the
obligations include preserving what already passes. None of my analysis appears.

    the acceptance gate stays authoritative   the diagnosis changes what the model is told and nothing
                                              about what may be accepted. The policy, the protected
                                              spec and the revert rule are untouched.
    a decline STOPS the run                   when the engine cannot separate the explanations or an
                                              observation is missing, the round is recorded as
                                              DIAGNOSIS_DECLINED with the engine's reason and the loop
                                              ends. It does NOT fall back to the raw error - cell 9
                                              asserts the model is never asked, because a silent
                                              fallback would turn a refusal into an unremarked change
                                              of condition and make the comparison meaningless.

One more brittleness fixed on the way: the acceptance baseline was inferred from the candidate file's
own directory, which broke as soon as a candidate lived elsewhere. It is now an explicit option.

## Where it fits, and what is still unmeasured

    detect -> explain -> observe -> eliminate -> bounded repair -> verify -> retain or restore

Detect, explain, observe and eliminate are mechanical. Verify, retain and restore already exist and
are tested. The handover now exists too. **What has NOT been established is whether the guidance
produces better repairs.** The 46 and 32 tests support specified behaviour; they say nothing about
repair outcomes, and nothing about failures outside the catalogue. That comparison is frozen in
`DOM-EVIDENCE-1_DEFINITION.md` and needs authorization.
