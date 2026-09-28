# OBSEVAL-1 DEFINITION - the complete observer-to-checker path, on fresh pages, with no adapter chosen by hand

Frozen 2026-09-28, **before any page of this evaluation is generated.** Local, **$0**. No verified spend
authorization; Modal stays off. Named OBSEVAL-1 because `EVAL-1` is a 2026-09-26 record and is preserved.

## THE MILESTONE, stated narrowly

> **Legasus chooses and validates an appropriate observation method on unfamiliar browser software
> without a human choosing it - and then extends one.**

A working adapter is progress. **A verified addition to an unfamiliar INPUT- or CLICK-driven application
is the milestone.** The two are reported separately and neither is read off the other.

**This is not a claim about software generally.** A handful of browser pages says nothing about command
line tools or warehouse systems. Those domains are declared in the adapter interface and have no adapters.

## THE EXECUTED REVISION

    3ea58945e784de1bd959cb3ce7f11d981a877521

Hashes of every file that decides anything:

    99682c2e9471e84bf504bcdf57c7f1d3d2baec86661a7ad743ddca32b42d86ce    22874  server/observationSelect.mjs
    367040aca8d8b0262ba268ccfd9346424fe08d8e79d7c6cecdc654c627a9495b     7150  server/actions.mjs
    68edb0fb67d4d35539c6fa5d4e0d9296da3fe32f2780de5a8b97aa27fc5b6158    13972  server/playCheck.js
    224c31d94a29747ecfece847b5e0cd4eef527a3f0a486983996eab93e7981174    10416  server/emitTaskAuto.mjs
    0282632004a32b475a3e06149715f9545b3103634ca08d27f7a2090edd68f2e7     6568  server/adapters/browser.mjs
    856f6426dcbe184ef2bebff544f0a84075c7d111892432bebd43f2624e0b82c9     4410  server/adapters/interface.mjs
    cb609905bbb1cd73901ce18e8a3e73eaced8e36790d4c50499fe6dbca6b21136     5702  server/acceptanceDecision.mjs
    c0f24e2c72dfb312ec6b5830614a3594d50b1223a9a16b13610ad8e4a5a454c3     4548  server/retainPath.mjs
    cbf4983a7ba89e219a4cbb29cfe8977f51efa440bcc0d8763b44960bc314d732    19101  server/autoGuide.mjs
    c735f92f19bf17d4f0bdddffe578bd14e422c2b04606fa58a5af404084af3a04    43239  server/codeFacts.mjs
    978bc299e5660034605d2f0049b952b9e2e8e7e9adc63163d0e8c4d8d53f9ee2    37806  server/localEdit.mjs
    99e50264209ad4002df979fbd6edde9a45e7a9f09fe3d2085f9f8f201fffd623    12253  server/evaluator.js
    64aa3b7bcb1ad51b5eaba23f996095ab692abbf9f715f3dd29e4685a3caa2bf3     9908  server/acceptance.js
    df56ddc0180262307dec4eb0dd7d171b9a416e25238023e189047586f215e5b4     7484  server/judgeCandidate.mjs

Re-recorded after the run. **Nothing in the path changes once generation begins.** If something in it is
wrong, the run reports that and the fix is tested on a later set.

## PAGE GENERATION AND SELECTION RULES

    count       8 pages, generated after this freeze. No ninth, whatever the eligibility rate.
    model       qwen2.5-coder:1.5b, temperature 0.3, num_predict 2600, seed 7
    prompts     two shapes, 4 each, so the evaluation is not all one modality:
                  INPUT  "A page listing five <items>, each with a name. A text input with id 'filter'
                          shows only the items whose name contains the typed text."
                  CLICK  "A page listing five <items>, each with a name. A button with id 'toggle'
                          hides the list, and clicking it again shows the list."
                Both add only: "attach handling with document.addEventListener(...) on the document,
                not inline onclick attributes. Use plain HTML and one inline <script>. No canvas.
                Plain JavaScript, no libraries."
                NO STATE-SEAM CLAUSE. A page with no accessor must be observable through the DOM, and
                requiring one would hide whether that works.
    order       generation order. The FIRST page whose observation outcome is CONFIRMED_BEHAVIOUR and
                which yields a valid task is the subject for an addition attempt.
    ineligible  kept with its GENERATION-LOG and its outcome. Never a reason to reach for an
                easier-looking page.

## BUDGETS, frozen

    probe budget     60 interactions per page, 8 plans, 12 per plan (observationSelect.BUDGET)
    attempt budget   12 model calls, 4 rounds, 3 seeds per round
    interventions    0 permitted; the runner has no way to accept one
    generation       8 model calls, reported separately from attempts

## INDEPENDENT EXPECTED BEHAVIOURS

    CARRIED-FORWARD  from OBSERVATION of the baseline - what the page already does, in the modality it
                     responds to. Preserving behaviour means preserving what is there, bugs included.
    THE ADDITION     from the frozen requirement, never from the candidate: **pressing a free trigger key
                     returns the page to the observable state it had at load.** The trigger is the first
                     of 0, z, Escape, Backspace the page does not already respond to. On the baseline
                     these checks MUST FAIL, and emitTaskAuto refuses to emit a task unless they do.
    VISUAL CONTRACT  none. These pages have no declared layout, so the visual arm reports NOT EVALUATED
                     and does not block - per GATE-2, a checker limitation is not a requirement failure.

## WHAT IS REPORTED, SEPARATELY

    1  was the selected observation method APPROPRIATE?   which adapter, on what evidence
    2  did it CAPTURE ACTUAL BEHAVIOUR?                   confirmed interactions and their effects
    3  did the BASELINE meet its requirements?            a page can be observable and still not do what
                                                          it was asked for. Judged against the PROMPT,
                                                          not against the page.
    4  did a subsequent ADDITION succeed?                 accepted / blocked / refused / no success
    5  calls, elapsed time, human interventions

Plus per page: the observation outcome, the coverage limits detected, and whatever was left unresolved.

## Pre-registered readings

- **An addition accepted on an input- or click-driven page, zero interventions.** The milestone. Still
  one page, one model, one requirement shape.
- **Observation succeeds, the addition does not.** The adapter work is established and the building is
  not. **This is the outcome I consider most likely**, because the guidance policy has only ever been
  tested on keyboard-driven canvases.
- **Observation fails on all eight.** Reported with the outcome classes and coverage limits, and it says
  nothing about the applications themselves.

**Stopping rule:** the evaluation stops at the declared budgets. No tuning on a failed evaluation page -
any fix is tested on a later set, and the failure is preserved.
