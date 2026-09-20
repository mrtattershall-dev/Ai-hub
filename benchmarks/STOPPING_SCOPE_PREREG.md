# r4 — does the completeness bound SURVIVE CONSUMPTION? Predictions frozen before any attack.

Raised by the owner, 2026-09-20, reviewing Entry 16: *"the qualification has to survive consumption.
If some downstream code can take only `result.state === 'QUIESCENT_CONTEST'` and discard
`doesNotEstablish`, then you've recreated the same information-loss problem at the API boundary."*
Recorded as the owner's observation. They did not inspect; this does.

## Measured before predicting

    objectivesFromContest(contest)   takes the WHOLE verdict, returns { objectives, why }
                                     -> `establishes` / `doesNotEstablish` are not in the output
    nextAction({ candidates })       returns { quiesce: true, action: null, why }
                                     -> makes the SAME shape of claim and never had a bound at all
    evidenceFrontier({ requiredProducers, attempted, pending })
                                     -> CLOSED iff every DECLARED producer was attempted;
                                        quiesce-check declares ['CPython doctest', 'git', 'pytest']

## The three sites, and the third is the one the owner did not name

1. **The bound is erased at exactly the step that turns a verdict into work-or-no-work.**
   `objectivesFromContest` is what PURPOSE consumes. Its output says "zero objectives" and carries
   nothing that denies "therefore nothing is worth investigating".

2. **`nextAction` makes the same claim with no bound at all**, over a CANDIDATE LIST someone
   supplied. "There is currently no justified next action" is bounded by who wrote the candidates.

3. **`evidenceFrontier.CLOSED` has the same defect one layer DOWN, and it is where the gap
   originates.** CLOSED means "every producer on a declared list was attempted", and its `why` says
   *"every required producer was attempted and nothing authorized is pending"* - which reads as
   completeness over the evidence. `contestState` then inherits a CLOSED frontier and reports on it.
   The completeness gap Entry 16 named at the contest layer is already present at the frontier layer,
   in a list literally hand-written in quiesce-check.

## Predictions

    SC-1  ATTACK. objectivesFromContest(quiescent verdict) has no `establishes` and no
          `doesNotEstablish`. The bound does not survive the step that produces the work artifact.
    SC-2  ATTACK, by the project's own Law 1 instrument. informationMonotonicity with
          rich = the verdict, erase = objectivesFromContest, and a consumer that makes the inference
          precisely when nothing denies it, reports a FORBIDDEN TRANSITION: erasure GAINED permission.
          NON-VACUITY: the same consumer must be REFUSED on the rich state, or the predicate is
          constant and the test proves nothing.
    SC-3  ATTACK. nextAction's quiescent result carries no bound of any kind.
    SC-4  ATTACK. evidenceFrontier's CLOSED result carries no bound, and its `why` asserts
          completeness over "required producers" without recording that the requirement list is
          declared.
    SC-5  CONTROL, expected to hold before and after: a frontier with a MISSING producer is OPEN, and
          an OPEN contest still yields its objectives. The bound must not change any verdict.

## Expected repair

Each artifact carries the bound appropriate to ITS claim, because the three claims differ:

    frontier CLOSED    establishes   every producer DECLARED required was attempted, nothing
                                     justified is pending
                       does not      that the declared list covers the evidence that could
                                     discriminate. The list is an input.
    contest            (Entry 16's SCOPE, unchanged)
    objectives         inherits the contest's bound verbatim - it is a projection of that verdict
    nextAction         establishes   no candidate OFFERED is justified
                       does not      that no justified action exists. The candidate list is supplied.

## The residual, stated in advance so the repair cannot be oversold

Carrying the bound through the pipeline means a consumer must now DELIBERATELY drop it rather than
receive an artifact that never had it. It does NOT make the bound inseparable: `verdict.state ===
'QUIESCENT_CONTEST'` remains readable on its own, and nothing here prevents that. A representation in
which the state cannot be read without its bound would change every consumer and every comparison in
the freeze gate, and is not started. That residual is recorded as UNKNOWN, not solved.
