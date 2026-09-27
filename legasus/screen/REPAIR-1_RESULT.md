# REPAIR-1 and REPAIR-2 — 0 of 4 repaired. Two blockers were observed: the applier refused the model's transcription, and the error text did not distinguish "not there yet" from "not there at all".

2026-09-27. Directed by Micheal; no cap was stated, and the bound was mine (4 candidates, at most 3
rounds, stop at $0.50 of A10G). **Spent: $0.085 for REPAIR-1 and about $0.19 for REPAIR-2, so $0.28
for this experiment and about $0.57 hosted in total.** Definition frozen beforehand in
`REPAIR-1_DEFINITION.md`. The gate was unchanged throughout; nothing was accepted.

## REPAIR-1 — exact matching refused every repair

    candidate   round 1          round 2          round 3          accepted
    seed 2      NOT_FOUND        NOT_FOUND        NOT_FOUND        no
    seed 3      NOT_FOUND        NOT_FOUND        NOT_FOUND        no
    seed 4      NOT_FOUND        NOT_FOUND        NOT_FOUND        no
    seed 5      NOT_FOUND        NOT_FOUND        NOT_FOUND        no

    12 repair rounds, 96 s of generation, 6,174 output tokens, 0 applicable edits

**The cause is mechanical, and offline analysis of the stored replies splits it in two:**

    seeds 2 and 5   the FIND is a UNIQUE match once indentation is ignored. The model quoted the
                    lines at column 0; the file indents them by eight spaces.
    seeds 3 and 4   every quoted line exists in the file, but the SEQUENCE does not: it regrouped
                    lines that are not adjacent, putting all the comments together and then the code.

**In all four, the model quoted the region that actually contains the defect.** It located the site
and was refused on transcription.

A second flaw: rounds 2 and 3 re-sent identical evidence and got identical replies. A refused round
told the model nothing, so repeating was guaranteed to repeat. **Two thirds of the budget bought the
same refusal three times.**

## Two harness changes, and what they are

    file-anchored tolerant matching (opt-in)  the span is located with whitespace ignored, then the
                                              FILE's lines are replaced and the replacement is
                                              re-indented to the FILE's indentation. The recorded
                                              hazard is a matcher that splices at the MODEL's
                                              indentation and drops a method out of its class; this
                                              is its opposite. Zero matches, several matches and
                                              reordered sequences are all still refused.
    the refusal is fed back                   that an edit did not match is a machine fact, so the
                                              next round is told it, in the applier's own words.

A third change came out of testing those: **exact matching was splicing mid-line.** A test asserting
that an added line inherits the file's indentation caught a FIND of `go();` matching inside
`      go();`, with the replacement's second line landing against the left margin — the same
de-indentation hazard arriving through the front door. Exact matches must now begin at a line start.
`localEdit.test` 50/50, `repairLoop.test` 15/15.

## REPAIR-2 — with the same evidence and a matcher that accepts the model's whitespace

    candidate   round 1                     round 2            round 3            accepted
    seed 2      APPLIED -> play [2,3,5]     APPLIED, threw     APPLIED, threw     no
    seed 3      NOT_FOUND                   NOT_FOUND          NOT_FOUND          no
    seed 4      NOT_FOUND                   no edit block      no edit block      no
    seed 5      APPLIED, still threw        6 blocks, threw    APPLIED, threw     no

**The offline prediction held exactly:** the two candidates whose FIND differed only by indentation
(2 and 5) now applied; the two that had reordered lines (3 and 4) were still refused. The tolerant
matcher did what it was built for and no more.

## The one round that moved, and why it is the real finding

Seed 2, round 1. Given only the captured error, the model wrapped the wiring in a
`DOMContentLoaded` handler:

    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('keydown', movePlayer);
        document.getElementById('plant').addEventListener('click', plantSeed);
        ...
    });

**That is a correct, idiomatic repair for the error it was shown.** "Cannot read properties of null
(reading 'addEventListener')" is the classic symptom of running before the DOM is parsed, and
deferring the lookup is the textbook fix. Its effect on the page was real and measurable:

    before   play []          RUNTIME_EXCEPTION_AT_LOAD   nothing observable at all
    after    play [2,3,5]     NONE                        state readable, movement working

The script no longer throws at top level, so execution reaches the seam and the page becomes
observable for the first time in this line of work. It still failed: **in the state observed, the
element is absent even after the document reports `readyState: complete`**, so when
`DOMContentLoaded` fires the lookup is still null and still throws, one error at load time, which
fails step 1 and therefore the protected set. The round was reverted.

CORRECTED after review: an earlier wording said the buttons "do not exist and never will". The
observation supports less than that. **`readyState: complete` with the id absent rules out "waiting
for DOM readiness will create it" in that observed state.** It does not rule out every later dynamic
insertion — another script, a timer, a fetch callback could add the element in a page that had one.
This page has none, but that is read from its source, not established by the measurement.

**So the evidence underdetermined the fix.** That error message is equally consistent with "the
element is not there yet" and "the element is not there at all", and the model chose the first. The
file was in the prompt, and reading it would have settled the question — but nothing in the evidence
pointed at the document's contents. **This is the sharpest thing either run establishes: feeding back
the error text alone selects a plausible repair family, not the right one.**

CORRECTED after review: an earlier summary said this "located exactly why" the repairs failed. It
does not. **These are the blockers that were OBSERVED** — a refused transcription, and an error
message that underdetermines its own fix — **and observing them does not enumerate every cause.**
Removing both could leave the repair failing for reasons no round has exposed yet: the handler
semantics, the breadth of the edit required, the model's grasp of the negative clause, or something
not yet named. What follows is a next experiment, not a diagnosis of the whole failure.

The fix that follows is concrete, cheap and still machine-only: when a null-element error occurs,
report the ids the document actually contains. That is a fact the harness can read off the page, not
an analysis I would be supplying.

## The latent baseline defect, now reproduced on the untouched baseline

**Reproduced directly** (`server/baselineValidity.mjs`): the untouched accepted increment-1 page
raises **five** `Cannot set properties of null (setting 'textContent')` errors while performing
`farm-i1`'s own required behaviour — the arrow-key movement it was accepted FOR — and still passes
step 1, because step 1 is evaluated before any key is pressed.

    farm-i1 (the spec it was accepted under)   passing [1,2,3]   errors raised during the run: 5
    farm-plant (the current spec)              passing [1,2,3,5] errors raised during the run: 17

**So the earlier acceptance rested on a check that could not see this: a test-coverage gap.** It is
recorded as one, and the corrected check is **versioned rather than edited in place**:

    farm-plant      UNCHANGED, 6 steps - every earlier result stays interpretable
    farm-plant-v2   7 steps: the same, plus "no page or console error was raised at any point"

`farmPlantV2Spec.test` 10/10 pins what that version is worth: the accepted baseline FAILS step 7; a
correct planting handler alone STILL fails step 7, so step 7 is not a planting check in disguise;
and supplying the missing `#day` element as well passes all seven, so the spec is satisfiable. The
old spec still scores the baseline exactly as it did before.

**Comparisons already under way stay on `farm-plant`.** Raising the bar mid-comparison would mix a
second repair into the measurement.

## How that defect first appeared: in a candidate's run

The repaired page also logged four `Cannot set properties of null (setting 'textContent')` errors
during movement. Those are **not the candidate's**: the accepted increment-1 page's own `draw()` ends
with `document.getElementById('day').textContent = ...` and there is no such element. The baseline
passes step 1 only because `draw()` is never called before step 1 is evaluated. **Any candidate that
makes the keys work inherits that error.** It did not decide this verdict — step 1 failed on the
load-time error before any keypress — but it means the accepted page carries a defect that the gate
cannot see in the baseline and will see in its successors.

## Against the pre-registered readings

- **"A repair reaches RETAIN"** — did not happen. 0 of 4, in both runs.
- **"Repairs apply but do not fix"** — this is REPAIR-2 for seeds 2 and 5, and the diagnosis is now
  specific: the evidence selects the wrong repair family.
- **"Repairs do not apply at all"** — this was REPAIR-1 entirely, and REPAIR-2 for seeds 3 and 4.
  The obstacle there is transcription, not comprehension.
- **"A repair breaks the protected behaviour"** — happened in every applied round, and the policy
  restored and the loop reverted every time, which is what both were built to do.

## What is and is not established

- **Established:** the model locates the defect site reliably (4 of 4); it cannot transcribe a
  region faithfully enough for exact matching (4 of 4); with whitespace tolerance it produces
  applicable edits (2 of 4); and one of those edits genuinely improved the page's failure class.
- **Not established:** that the model can repair from machine evidence. It has not done so once.
- **Not established:** that better evidence would be enough. The id-listing idea is untested.
- **Not autonomy.** The candidate, the task, the edit format and now the whitespace tolerance are all
  supplied by the harness.

Records: `REPAIR-1_DEFINITION.md`, `REPAIR-1_seed{2,3,4,5}.json` (exact matching),
`REPAIR-2_seed{2,3,4,5}.json` (tolerant matching), `REPAIR-1_run.log`, `REPAIR-2_run.log`,
`REPAIR-1_window.log`, `REPAIR-2_window.log`. Each round carries the evidence given, the raw reply,
the apply results, the resulting play and failure class, and whether the working copy was kept or
reverted.
