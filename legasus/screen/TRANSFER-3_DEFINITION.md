# TRANSFER-3 DEFINITION — can the frozen policy extend the first qualifying unfamiliar page, with no human repair and no guidance change?

Frozen 2026-09-27, **before any page of this set is generated.** Local, **$0**. No verified spend
authorization exists; Modal stays off.

## The question, exactly

> **Can the frozen policy extend the first qualifying unfamiliar page without human repair or guidance
> changes?**

TRANSFER-2 stopped with zero eligible pages and produced **no result about the policy**. This is its
successor with a changed page-generation protocol and selection procedure, so it gets its own number and
its own freeze.

## What changed from TRANSFER-2, and the two corrections that made it change

1. **Held-out pages may be generated AFTER the policy is frozen.** What matters is not the clock but the
   information flow: **their contents and outcomes must not inform any policy change before evaluation.**
   TRANSFER-2 treated post-freeze generation as fatal and so had nothing left to run on. The rule that
   actually protects the test is stated below and is about not changing the policy, not about timing.
2. **Filtering for baseline eligibility is legitimate.** This is a test of extending WORKING software, so
   eligibility DEFINES THE POPULATION being tested rather than biasing it. The obligations that come with
   that: **every generated page is preserved, every rejection is preserved with its reasons, and the
   eligibility rate is reported** - so the filter cannot hide how many pages had to be thrown away.

## THE RULE THAT PROTECTS THIS TEST

**From the moment generation begins, the guidance policy does not change.** Not the site rules, not the
scaffold rules, not the instruction, not the context extraction, not the containment, not the feedback
construction, not the escalation. If something in the policy turns out to be wrong, the run reports that
and the fix is tested on a later set. Any human repair during the run is recorded as an intervention and
makes the result "the policy plus N rescues", never "the policy".

## PART 1 — THE GENERATOR, frozen

**The prompt template, verbatim.** `<ASK>` is the only substitution.

    Write one complete HTML file, nothing else, no explanation, no markdown fence.
    <ASK>
    REQUIRED, the page will be rejected without it: attach key handling with
    document.addEventListener('keydown', ...) and NOT to the canvas element.
    REQUIRED, the page will be rejected without it: the last line of the script must be exactly
    window.app = { state: () => ({ ...<every piece of state the page keeps> }) }; so that automated
    tests can read the state.
    Use a single <canvas> and one inline <script>. Plain JavaScript, no libraries.

The two REQUIRED clauses are generator assistance added because ASSISTED-1's page A failed for want of a
seam and TRANSFER-2's `counter` failed for a canvas-bound listener. **Neither clause guarantees a valid
baseline, and neither is trusted: the eligibility checks below establish it, or the page is rejected.**

    model        qwen2.5-coder:1.5b     temperature 0.3     num_predict 2600     seed 7
    generation cap   8 pages, one call each. No ninth page, whatever the eligibility rate.

**The eight asks, fixed now, in this order.** All deterministic and key-driven; none is a farm, lamp or
traffic page.

    1  A single square on a canvas that moves one cell left or right when ArrowLeft or ArrowRight is pressed.
    2  A tally of votes for two options drawn on a canvas. Key 1 adds a vote to the first, key 2 to the second.
    3  A brightness level from 0 to 5 drawn as a bar on a canvas. ArrowUp raises it and ArrowDown lowers it, staying in range.
    4  A colour name shown on a canvas. Key c cycles through red, green and blue.
    5  A stack of up to five blocks drawn on a canvas. Key a pushes a block and key b pops one.
    6  Two players' scores drawn on a canvas. Key a scores a point for the first player and key b for the second.
    7  A 3x3 grid of cells on a canvas, all empty. Keys 1, 2 and 3 fill the first, second and third cell of the top row.
    8  Three vertical bars on a canvas, all at height one. Keys a, b and c each make their own bar one taller.

## PART 2 — ELIGIBILITY, mechanical, and the selection order

**Order: the generation order above. The FIRST eligible page is used automatically. If none qualifies,
the experiment STOPS and reports that.** Ineligibility never justifies reaching for a page that looks
easier.

The rules, implemented in `server/sealedPage.mjs` and hashed in the manifest:

    1  the generation is recorded and doneReason is `stop` - a truncated page is INELIGIBLE
    2  every inline script parses
    3  the page loads with ZERO page or console errors
    4  the state expression is READABLE at load - reading it must not throw, and must not yield nothing
    5  at least one probed key CHANGES the state - there is existing behaviour to preserve
    6  a trigger key is FREE - the page responds to none of `0`, `z`, `Escape`, `Backspace`
    7  the state stays readable through the whole probe - a seam that breaks after a press is not a
       usable subject, because then the checks would fail for a reason unrelated to the candidate

**State is read as structured data** by `server/observeState.mjs`, which loads the page, evaluates the
state expression and returns the value. TRANSFER-2's probe asserted `false` on every step so that the
gate would print the state inside a failure message and then parsed it back with a regex; that regex
returned null for a state which was a JSON *string* and would have rejected a readable page while
reporting the wrong reason. **The observer is not part of the gate** - `playCheck` stays byte-identical -
so no change to observation can move a verdict.

**The checker is controlled in both directions.** It has been run against a page known to be a valid
baseline (`legasus/bench/traffic/baseline-a2.html`) and returns ELIGIBLE with trigger `0`. A checker that
only ever rejects would look just as rigorous and be worthless.

**Eligibility does not require the page to satisfy its ask**, for the reason given in TRANSFER-2: it
would let me discard pages until one complied. Whether the ask was fulfilled is recorded separately,
because the carried-forward checks establish **preservation of observed behaviour and nothing more.**

## PART 3 — THE ADDITION, one page-independent rule

> **Pressing the trigger key returns every piece of state to what it was when the page loaded, and the
> existing controls keep working afterwards.**

Its checks are generated mechanically from the observation: the load state is captured; the responding
keys are pressed to move the state away from it; the trigger is pressed and the state must equal the load
state exactly; the trigger is pressed again and must still equal it; a responding key must still change
it; and no error at any point.

## PART 4 — THE POLICY, unchanged and hashed

    site         autoGuide.chooseSite         R1 / R2 / DECLINE by name
    scaffold     autoGuide.buildScaffold
    instruction  autoGuide.buildInstruction
    context      codeFacts compact FACT / STRATEGY / NOT-ESTABLISHED, ranked by call distance
    containment  localEdit.containToSlot
    feedback     built automatically from the gate's output - failing step numbers, the state seen, any
                 captured error text. No sentence of it written by me at run time.
    escalation   if every attempt at a site yields NO CODE, switch scaffold shape once, then stop

Hashes in `TRANSFER-3_MANIFEST.txt` at freeze time; the EXECUTED hashes recorded again after the run.

## PART 5 — BUDGET AND CALL ACCOUNTING

    addition attempts      12 model calls, hard limit
    feedback rounds        at most 4; at most 3 seeds per round
    interventions by me    0 permitted; any rescue recorded as one

**Reported separately, never summed:**

    additionAttemptCalls    the 12-call budget - this is the experiment
    pageGenerationCalls     up to 8, this set
    priorPreparationCalls   5, already spent (4 pages on 2026-09-27, 1 regeneration for ASSISTED-1)
    browserProbeRuns        eligibility and observation - no model involved
    oracleCalls             token counting - no candidate produced

**Reported, and not optional: the ELIGIBILITY RATE** — how many of the 8 generated pages qualified, with
every rejection and its reasons preserved alongside the pages themselves.

## Pre-registered readings

- **Accepted, zero interventions.** The frozen policy extended an unfamiliar page by itself. One page,
  one model, one requirement shape - and the strongest result this line has been able to attempt.
- **Accepted after N rescues.** The result is the policy plus N named gaps; each gap is a thing to build.
- **Declined.** The policy could not find a site and said what it needed. A good failure.
- **No success within the budget.** Reported in those words. Not a capability claim.
- **No eligible page.** Reported with the eligibility rate. Says something about generating subjects, and
  nothing about the policy.
