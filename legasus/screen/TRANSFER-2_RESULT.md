# TRANSFER-2 — **NOT RUN. NO SEALED PAGE WAS ELIGIBLE.** All three failed a mechanical check, each for a different reason.

2026-09-27, **$0**, local. Definition and page order frozen at `3d1c743` **before any eligibility check
was run**. The rule said: try the pages in generation order, use the first eligible one, and if none is
eligible, report that and do not run. None was eligible.

**Zero addition attempts were made. The policy was never exercised, so nothing here is evidence about
the policy.**

## The eligibility table

Tried in the frozen order. Each failure is mechanical and names its rule.

    1  legasus/bench/dice      INELIGIBLE
       TRUNCATED_GENERATION    doneReason was `length` - it hit the 1400-token cap. Recorded in commit
                               ad9aa0e BEFORE anyone read the page, which is the whole point of having
                               the rule: the disqualification could not have been chosen to suit me.
       NO_INLINE_SCRIPT        the truncation cut the file off before a complete <script> block

    2  legasus/bench/counter   INELIGIBLE
       NO_EXISTING_BEHAVIOUR   no probed key changed the state. Its listener is
                               `canvas.addEventListener('keydown', ...)` on a canvas with no tabindex,
                               so the canvas never receives keys and ArrowUp/ArrowDown do nothing.
       (it passed everything else: generation complete, script parses, loads with 0 errors, and its
       state IS readable - `"{\"value\":0}"`. It also contains a second defect that would have bitten
       later: `window.app.state = JSON.stringify(newState)` REPLACES the state function with a string,
       so the seam would break after the first successful press.)

    3  legasus/bench/bars      INELIGIBLE
       ERRORS_AT_LOAD          1 - `Cannot read properties of undefined (reading 'forEach')`
       (this one is the closest to usable: it responds to a, b and c, and its state reads
       `{"bars":[{"height":1},{"height":1},{"height":1}]}`. It fails on one rule only. The rule is not
       being bent for it.)

## What this is actually a finding about

**Three of three pages written by this 1.5B from a one-line request were unusable as experimental
subjects**, and for three different reasons: a truncated generation, keys wired to an element that cannot
receive them, and a throw at load. That is a fact about using model-written pages as test subjects, and it
is the same wall ASSISTED-1 hit - its page A had to be regenerated because it omitted the state seam
entirely.

**And a large part of the blame is mine, not the model's.** The three sealed pages were generated with the
`plain` seam wording. ASSISTED-1's page A also failed with the `plain` wording, and only succeeded once I
made the seam a `firm` requirement. **I sealed three pages behind a request I already had reason to
believe was too weak, and did not add the one thing - a document-level listener - that the counter page
then failed on.** A future set needs both requirements in the request before sealing.

## Why no fourth page was generated

**Because generating one now would destroy the property that makes a sealed page worth anything.** These
three predate this experiment's assistance design; a page written after it does not, and choosing a fresh
page now - having just seen three fail - is precisely the selection pressure the frozen order exists to
prevent. The honest move is to report the negative and set up the next sealed set deliberately.

## Call accounting, reported separately and not summed

    additionAttemptCalls       0   the experiment never reached an attempt
    pageGenerationCalls        4   the four pages of 2026-09-27
    pageRegenerationCalls      1   ASSISTED-1's page A, after it failed eligibility for want of a seam
    browserProbeRuns           6   eligibility and state probing - no model involved
    oracleCalls                0
    interventions by me        0
    dollars                    0

**Total preparation cost retained: 5 model calls**, all spent before this experiment's first attempt, and
all of them part of what the work cost even though none is an attempt.

## What this establishes, and what it does not

- **Established:** the eligibility rules work, and they disqualified pages for reasons that were fixed in
  advance and are checkable after the fact. The truncation rule in particular fired on evidence committed
  before the page was read.
- **Established:** a probe that cannot read state is worse than no probe. Two defects in my own probe were
  found and fixed before any verdict was issued: it asserted `true`, so playCheck never reported the state
  it saw (seventeen blank lines that I could have "interpreted"); and its value parser returned null for a
  state that was a JSON *string*, which would have disqualified the counter page while reporting the WRONG
  REASON. The reason a page is rejected has to be true, not just the verdict.
- **NOT established:** anything whatsoever about whether the policy can supply ASSISTED-1's assistance
  itself. That question is untouched. It is the next experiment and it still needs a subject.
- **NOT established:** anything about the model's page-writing ability in general. One request wording,
  one model, four pages, and the wording was demonstrably too weak.

## The next step, precisely

Generate a new sealed set with the request that ASSISTED-1 proved sufficient - the **firm** seam wording -
plus a stated requirement that key handling be attached to `document`. Run the eligibility checker on each
**before** sealing, keep only pages that pass, and record the order and hashes before any assistance is
designed against them. Then TRANSFER-2 runs as frozen, unchanged.
