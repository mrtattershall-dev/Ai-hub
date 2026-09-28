# r4 — does the completeness bound survive consumption? RESULT (pre-repair).

Predictions frozen in `0018592` (`STOPPING_SCOPE_PREREG.md`), from the owner's observation on Entry
16. Run against `d188998` unmodified. Written before the repair.

## Raw run

    ✔ SC-1 ATTACK  the bound does not survive objectivesFromContest
    ✔ SC-2 ATTACK  by Law 1: erasing the bound GAINS a permission
    ✔ SC-3 ATTACK  nextAction makes the same claim with no bound at all
    ✔ SC-4 ATTACK  evidenceFrontier CLOSED carries no bound and its why reads as completeness
    ✔ SC-5 CONTROL the verdicts themselves are unaffected by any of this

    tests 5  pass 5  fail 0

## SC-2 is the result

This project's own Law 1 instrument, pointed at this project's own API, one commit after that API was
written:

    informationMonotonicity({ rich: <the bounded verdict>, erase: objectivesFromContest,
                              consumers: [concludes no justified investigation exists] })

    ok      false
    gained  ['concludes no justified investigation exists']
    why     FORBIDDEN TRANSITION: objectivesFromContest destroyed information and GAINED permission
            for concludes no justified investigation exists. Authority was manufactured out of
            information loss.

Non-vacuity is asserted in the same test: the consumer is REFUSED on the rich state and GRANTED on an
unbounded artifact, so the predicate is not constant.

Entry 16 attached the bound to the verdict and did not follow it downstream. The step that turns a
verdict into work-or-no-work - the artifact PURPOSE consumes - dropped it immediately. The repair was
real and it was one function wide.

## SC-4 is the one the owner did not name, and it is the deeper of the two

`evidenceFrontier` reports CLOSED when every producer on a **declared list** was attempted, and says
*"every required producer was attempted and nothing authorized is pending"*. In `quiesce-check.mjs`
that list is three hand-written strings. So the completeness gap Entry 16 named at the CONTEST layer
already exists at the FRONTIER layer, and `contestState` inherits it: a contest is reported over a
frontier whose closure is itself bounded by an input nobody argued was complete.

Entry 16 said the frontier is "a set of questions someone wrote down". SC-4 shows the evidence
requirement is a set someone wrote down too.

## What this does NOT show

SC-5 holds: no verdict changed. Every state, every objective list, every OPEN/CLOSED decision is what
it was. This is entirely a defect in what the artifacts SAY they establish, which is the same class as
the provenance finding one commit earlier - correct operational behaviour, absent or wrong account of
why it is justified - and the reason that class matters is on display here: the erased account is not
inert, it is a permission the next consumer will take.
