# ASSIST-2 DEFINITION — can the system choose the guidance itself, on a task whose site and structure I have not supplied?

Frozen 2026-09-27, **before the policy is implemented and before it is run.** Local, **$0**. No paid run
is authorized.

## The question

ASSIST-1 step 1 showed the model can produce working logic when a person shapes the slot. Seven things
were mine. Three of them are mechanical and become infrastructure; **three are judgement, and this is the
test of whether the system can make them:**

    I1  which slice of the requirement to attempt now
    I3  what to say, and in how few words
    I6  WHERE the slot goes

## The fresh task: `farm-grow`

I supply a requirement and checks. I supply **no site, no scaffold, no solution structure**.

    requirement   the t key advances time: day goes up by one, and every planted tile grows by one
                  stage, stopping at stage 3. t must not create or remove tiles. Everything that
                  already works must keep working.
    structured    { trigger: { kind: 'key', key: 't' },
                    effects: ['day goes up by one', "every planted tile's stage goes up by one,
                              stopping at 3"],
                    invariants: ['no tile is created or removed', 'everything that already works keeps
                              working'] }
    checks        play-grow.json, 6 steps, requested 1-6, protected 1-3 (load, movement, planting)
    validated     farmGrowSpec.test 11/11: a correct handler passes 6/6; one mutant per way growth can
                  be wrong fails exactly the step that owns it; breaking planting fails the protected
                  set. Recorded: step 6 is vacuously passable by inaction, so it counts only beside 4
                  and 5.
    starts from   ASSIST-1_accepted_index.html - the page the model itself produced, movement and
                  planting working, zero errors

**The goal text names no function, no line and no site**, and the test asserts that.

## The policy, frozen here before it is written

**P1 — unit of work.** Attempt all effects of ONE trigger together. Split only after a failure, and
only along the effect list.

**P2 — site selection, in order, first match wins.**

    R1  if a listener for the trigger's event type exists AND dispatches on the trigger value
        (contains `e.key ===` or a switch on it) AND does not begin with an early return that
        excludes the new value, then add a branch inside that listener.
    R2  otherwise add a NEW listener of that event type, immediately after the last existing one, with
        a filter for the trigger value.
    if neither can be located, DECLINE and name what was not found.

**P3 — what the scaffold may contain**, derived from the file, never from me:

    always      the trigger filter (`if (e.key !== 't') return;` or the branch condition)
    if the file defines a zero-argument redraw that EVERY existing handler of that event type calls,
                a trailing call to it
    data preparation ONLY if the requirement's effects name the player's own tile - for this task they
                name "every planted tile", so NO tile-key line is supplied
    nothing else

**P4 — instruction.** One line, built from the effects and invariants verbatim, capped at 200
characters. No examples, no field names invented, no code.

**P5 — boundaries (infrastructure, always on).** Cut the completion at a document close or at the first
line of the supplied suffix. Apply only on an exact unique match. Never splice partially.

**P6 — escalation, at most two site choices.** If the page throws at load, the site is wrong: switch to
the other rule. If the failure is behavioural, keep the site and use the remaining seeds. **No prompt
tuning, no new scaffolding, no human input.** Five seeds per site choice.

**P7 — verification.** The unchanged gate decides acceptance. The strict no-error spec is reported
beside it and never fed back.

## What is fitted, and stated plainly

I wrote these rules **knowing this page**. R1's early-return clause exists because this page's handler
begins with `if (e.key !== 'p') return;`, and I knew that when I wrote the rule. **So the rules are
general in form but authored with one example in view**, and a policy that works here has not been shown
to generalise. The test will therefore include synthetic pages where the OTHER rule must fire, to show
the policy is not a single hardcoded path — and that is still weaker than a page I have never seen.

## Recorded per run

Which rule fired and why; the scaffold the policy wrote; the instruction it produced; every attempt's
verdict; the failure class; whether escalation fired; accepted or not; the strict result beside it; and
**the count of interventions by me, which must be zero.**

## Pre-registered readings

- **Accepted with zero interventions.** The system chose the scope and guided the model to working,
  independently checked software. That is the milestone.
- **Accepted only after escalation.** Also the milestone, and the escalation rule earns its place.
- **Declines.** A result: it could not locate a site, and said so rather than guessing.
- **Attempts and fails.** The counts say where: no code, wrong site, or behaviour. Each points at a
  different missing rule.
- **I have to intervene.** Then step 2 has failed, and what I had to supply is the next thing to
  automate. **Any intervention is recorded as a failure of this experiment, not smoothed into the
  result.**

## Bar

    ASSIST-1 step 1 (me guiding)   15 attempts, 3 accepted, 766 s generation, 7 interventions
    ASSIST-2 (the system)          to be reported on the same axes, interventions must be 0
