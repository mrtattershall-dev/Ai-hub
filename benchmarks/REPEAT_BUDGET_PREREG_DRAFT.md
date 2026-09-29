# DRAFT preregistration — does changing the repeat policy or the call budget improve completion economically?

**Status: DRAFT, not authorized, nothing run.** The live arm costs GPU money, which is the owner's
decision. The offline arm is free and could run on request. Written before any intervention so the
endpoints cannot be chosen after seeing results.

Owner's framing, which this adopts: *"a flat 73% conversion rate doesn't identify its cause. A binding
call-budget explanation needs a controlled budget comparison, including cost and regressions."*

## THE CONSTRAINT THAT SPLITS THIS INTO TWO EXPERIMENTS

The replay rig **cannot test a budget increase.** Its mock serves the next recorded reply and cannot
react; when the recording runs out it sends one `finish` and marks the replay EXHAUSTED. So a larger
budget does not produce more work offline — it produces more EXHAUSTED, which is an artefact of the
instrument and not a measurement of the hub.

This divides the question by what each instrument can answer:

    OFFLINE (free, deterministic, replay rig)
        Does a changed repeat policy RECLAIM CALLS? A mechanical property of the hub given fixed
        model output, which is exactly what the rig measures.

    LIVE (costs GPU, real model)
        Do reclaimed calls PRODUCE WORK, and at what cost? A behavioural property of the model, which
        no replay can answer because the model must be able to react to the changed policy.

Running only the offline arm and reporting it as "completion improved" would be the same error as
reporting a route's silence as a measurement. The offline arm is a **precondition**: if no calls are
reclaimed, there is nothing for the live arm to test, and the live spend is not justified.

## THE DENOMINATOR, MEASURED FIRST

Across 1,213 scenarios / 17,466 recorded replies in `measurements/replay/scenarios`:

    byte-identical repeat of an earlier reply in the same run      1796   10.3% of replies
    same tool+path as an earlier call in the same run              8412   48.2%
        of those, a DIFFERENT body (a genuine retry)               2331
        same tool+path AND identical body                          6081   34.8% of replies

    worst arms, by exact-repeat share
        setH-coder14b-sethctl    383 of 746   51.3%
        setG-coder14b-setg       356 of 768   46.4%
        setH-coder14b-sethfix    233 of 570   40.9%
        setE-coder14b-base       180 of 795   22.6%

Two readings, and the weaker one is not used. "Same tool+path with an identical body" is **not**
automatically waste — re-reading a file that has since changed is legitimate. **Byte-identical repeat
of a whole earlier reply** is the strong signal, and it is 10.3% overall and **over half** of the 14B
control arm's replies. These are the repeats that survived whatever guard was live at recording time,
so they are the residue of the existing mechanism, not a measure of its absence.

## ENDPOINTS, FIXED NOW

    OFFLINE, per scenario, policy OFF vs ON, identical recordings
        E1  model calls consumed                        primary. reclaimed = OFF minus ON.
        E2  EXHAUSTED count                             must NOT rise. A rise means the policy made
                                                        the hub ask for MORE, not less.
        E3  status distribution (done/stopped/...)       must not shift toward stopped.
        E4  the 9 preservation controls                  must stay 9 of 9. No destruction regression.
        E5  scenarios with ZERO repeats                  SPECIFICITY control: reclaimed must be 0.

    LIVE, per goal, arm vs arm, same goals and checker
        L1  goals ATTEMPTED                              reach
        L2  goals whose feature WORKS AT THE END          completion. Reported separately from L1,
                                                          because conversion has been flat at ~73%
                                                          while reach moved, so a change in L1 alone
                                                          is not a completion result.
        L3  regressed = worked when written, broken at end
        L4  model calls, tokens, and wall time PER GOAL COMPLETED   the cost endpoint. "Economically"
                                                          means L2 per unit of L4, not L2 alone.
        L5  cost in dollars for the window                declared before the run, capped.

## PREDICTIONS, STATED BEFORE RUNNING

    P1  The offline arm reclaims calls, concentrated in the 14B arms. Falsified if reclaimed <= 0 on
        the arms with >40% exact repeats.
    P2  E5 holds: zero reclaimed on zero-repeat scenarios. If this fails the policy is not keying on
        repetition and the reclaim in P1 cannot be attributed to it.
    P3  Reclaiming calls does NOT by itself raise L2. Stated deliberately as the null, because the
        hub's own history is twenty fixes that stopped destruction without raising the score, and
        conversion has held at ~73% across all of them. If L2 rises, that is a real finding; if it
        does not, the honest conclusion is that the budget was not the binding constraint either.
    P4  If L2 does not rise while L1 does, the result is REACH, not quality, and must be reported as
        reach - the same distinction that has already caught four inferences in this project.

## WHAT WOULD MAKE THIS EXPERIMENT WORTHLESS, AND THE CONTROL AGAINST IT

A repeat policy that mechanically substitutes a different result changes what the hub returns, and the
recorded model cannot react to it. So offline, a policy could "reclaim" calls purely by ending runs
earlier — which looks like efficiency and is actually truncation. **E2 and E3 are the guards**: a
policy that reclaims calls by stopping runs shows up as EXHAUSTED falling while `stopped` rises, and
that is a loss disguised as a saving.

Prior art in this repo, at n=5 on one stuck context: advisory nudges produced 0 of 5 productive turns,
mechanical substitution 5 of 5. That is encouraging and it is n=5 on a single context. It is the
reason to run the offline arm, not evidence of the outcome.

## ORDER, AND WHAT IS NOT BEING PROPOSED

    1. offline repeat-policy arm        free. If E1 reclaims nothing, STOP and report that.
    2. only then, a live arm            owner's spend decision, with L5 capped in advance.
    3. a budget comparison              LIVE ONLY. There is no offline version of it.

Not proposed here: raising the budget as a first move. Set G's finding was that the budget was spent on
identical repeats that SUCCEEDED, so the repeat policy is the mechanism that would free budget without
buying more of it. Raising the budget first would pay for the waste rather than remove it, and would
confound the two changes.

Nothing in this document authorizes a run.
