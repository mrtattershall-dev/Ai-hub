# TRANSFER-2 DEFINITION — can Legasus supply ASSISTED-1's assistance itself, on a sealed page, without my choices?

Frozen 2026-09-27, **before any eligibility check is run and before any sealed page is read.** Local,
**$0**. No verified spend authorization exists; Modal stays off.

## The question

ASSISTED-1 obtained one verified success on a development page and recorded **eight interventions**. All
eight were mine. This asks the next question and only that one:

> **Can the system choose the site, the context and the feedback by itself, on a page I have not read,
> and reach an accepted addition?**

A success here is automation of assistance whose attainability was already shown. A failure is a failure
of the policy, on one page, and is reported as that.

## PART 0 — THE PAGE ORDER, FIXED NOW

Three pages were generated on 2026-09-27 and committed at `ad9aa0e` before any of this experiment's
assistance existed. **They are tried in the order they were generated. No other order is permitted.**

    1  legasus/bench/dice      sha e899be776227f2bb
    2  legasus/bench/counter   sha 0842a76ac9233458
    3  legasus/bench/bars      sha 9dff0d2dfa0329be

**The first ELIGIBLE page is used. Ineligibility is never a reason to skip to a page that looks easier**
— every failure is recorded with its mechanical reason and the order simply continues. If none is
eligible, the experiment reports that and does not run.

## PART 1 — ELIGIBILITY, mechanical only

Decided by `server/sealedPage.mjs`, on rules fixed here, with no judgement of mine:

    1  the generation is RECORDED and was NOT TRUNCATED. doneReason must be `stop`. A page whose
       generation hit the token cap is INELIGIBLE, however good it might look - `dice` hit the cap at
       1400 tokens, which was recorded in `ad9aa0e` before anyone read it.
    2  every inline script PARSES
    3  the page LOADS with zero page or console errors
    4  it exposes `window.app.state()` returning a readable, JSON-serialisable state
    5  it RESPONDS to at least one of the declared probe keys - there is existing behaviour to preserve
    6  it does NOT respond to the addition's trigger key - the addition is genuinely absent

**Eligibility does NOT require the page to satisfy the original one-line request, and that is a
decision, not an oversight.** Requiring it would let me discard pages until one complied, which is the
selection pressure this whole section exists to remove. So the page is taken as the artefact it is.

**What is recorded separately, for whichever page is used: whether the original request was fulfilled.**
Because the carried-forward checks establish **preservation of observed behaviour and nothing more**.
They never establish that the page did what was asked. ASSISTED-1's page is the case in point - its three
keys all cycled instead of selecting, and its checks were still perfectly valid checks of what it did.

## PART 2 — THE ADDITION, one page-independent rule

Fixed now so that I cannot pick something that suits the page:

> **Pressing the trigger key returns every piece of state to what it was when the page loaded.**
> The trigger is the first of `0`, `z`, `Escape`, `Backspace` that the page does not already respond to.
> The existing controls must keep working afterwards.

Its checks are generated mechanically from the probe: the load state is captured, the responding keys are
pressed to move the state away from it, the trigger is pressed and the state must equal the load state
exactly, the trigger is pressed again and it must still equal it, then a responding key must still change
it - and no error at any point.

## PART 3 — THE POLICY, frozen with hashes

**The system chooses. I do not.**

    site        autoGuide.chooseSite - R1 extend a dispatching listener, R2 a new listener after the
                last, else DECLINE by name
    scaffold    autoGuide.buildScaffold
    instruction autoGuide.buildInstruction, from the requirement's words
    context     codeFacts: the compact FACT/STRATEGY/NOT-ESTABLISHED rendering, at a declared token
                budget, ranked by call distance from the site
    containment localEdit.containToSlot
    feedback    built AUTOMATICALLY from the gate's own output - the failing step numbers, the state it
                saw, and any captured error text. No sentence of it is written by me at run time.
    escalation  declared below

    the escalation rule, and where it came from. ASSISTED-1 observed that with the slot inside
    `if (key === x) { }` the model produced no code across four attempts, and that code appeared when the
    slot became a new listener after an early return. That is an ORDERING, not a demonstrated cause, and
    this rule is the way to test it rather than the conclusion of it:
        if every attempt at a site yields NO CODE (containment refuses EMPTY), switch to the other
        scaffold shape once. If that also yields no code, stop and report.
    This is a REVISION of the TRANSFER-1 policy, made on the development case, and the protocol for that
    is exactly what is being followed: revise after a failure, freeze, and test on a page neither version
    has seen.

Hashes of every file that decides anything are recorded in `TRANSFER-2_MANIFEST.txt` at freeze time, and
the EXECUTED versions are recorded again after the run.

## PART 4 — THE BUDGET, and how calls are reported

    addition attempts        12 model calls, hard limit
    interventions by me      0 permitted. Any human rescue is RECORDED AS AN INTERVENTION and makes the
                             result "the policy plus N rescues", never "the policy".
    feedback rounds          at most 4, seeds within a round at most 3

**Reported separately, and never summed into one number:**

    additionAttemptCalls     the 12-call budget above. This is the experiment.
    pageGenerationCalls      4, already spent, for the four pages on 2026-09-27
    pageRegenerationCalls    1, already spent, regenerating ASSISTED-1's page A after it failed
                             eligibility for want of a state seam
    probeCalls               browser probes for eligibility and spec generation - no model involved
    oracleCalls              token counting - no candidate produced

**The total preparation cost is retained and reported**: 5 model calls before this experiment's first
attempt, and they are part of what the work cost even though they are not attempts.

## Pre-registered readings

- **Accepted, zero interventions.** The system supplied ASSISTED-1's assistance itself on a page I had
  not read. The strongest claim available here, and still one page, one model, one requirement shape.
- **Accepted, but only after N rescues.** Then the result is the policy plus N named gaps, and each gap
  is a specific thing to build.
- **Declined.** The policy could not locate a site and said so. A good failure: it names what it needed.
- **No success within the budget.** The policy's assistance was not sufficient on this page within 12
  calls. Not a capability claim, not a claim about other pages.

**What no outcome here can establish:** reproducible generation (unless seeds are repeated and reported
as such), anything about the other sealed pages, or anything about a requirement shape other than "one key
triggers an effect".
