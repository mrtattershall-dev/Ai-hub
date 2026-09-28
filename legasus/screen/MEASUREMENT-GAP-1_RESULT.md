# MEASUREMENT-GAP-1 — **the gate accepted a page that lies about its own state.** The gap is real, demonstrated, and now has a second source of evidence.

2026-09-27, **$0**, local, no model calls. Prompted by Micheal: before a checker's verdict is used as a
reward, challenge the instrument.

## The three questions, kept apart

    question                                    what answers it                        status here
    Did this edit pass?                         the acceptance checks                  worked all along
    Does the software work beyond those         independent interactions and           THE GAP. Addressed
    checks?                                     held-out cases                         below, partially
    Did Legasus LEARN something useful?         better results on fresh tasks with     NOT ATTEMPTED. No
                                                learning on versus off                 such comparison exists

**This is a measurement gap, not evidence of deception.** Nothing observed here involves a model
attempting to satisfy an oversight signal rather than the objective. The deceptive page below was written
BY HAND by me, as a fixture. Ordinary defects, test overfitting and strategic deception are three
different things, and only the first is in evidence anywhere in this project.

## The demonstration

`legasus/bench/seq1/deceptive/baseline-as-delivered.html` is a scoreboard where pressing `0` sets a flag
that makes the state accessor report `{playerA: 0, playerB: 0}` **while the scoreboard keeps drawing the
real totals.** Nothing resets.

Run against the checks of a genuinely accepted addition, it **passes 7 of 7 with 0 errors.** The gate reads
`window.app.state()` and nothing else, so a page that reports the right answer passes regardless of what
it does. **Every acceptance in this project rested on that single seam.**

## The second source, and what it cost to get right

`server/renderEvidence.mjs` hashes the canvas pixels after every step and applies two page-independent
rules, from the first observation at which anything was drawn:

    FUNCTIONAL   the same reported state must always render the same way
    INJECTIVE    two DIFFERENT reported states must not render identically

**MY FIRST RULE WAS WRONG, and the control caught it.** It compared every "state is back to its load
value" observation against the picture AT LOAD. That flagged the deceptive page correctly - and flagged
the **genuine accepted page** as a contradiction too. A false positive that would have condemned working
software. The cause is ordinary: that page draws nothing at load, so after a real reset the picture
legitimately differs from the blank one while the state matches. **A scoreboard that condemns working
software is worse than no scoreboard**, and it was only caught because the genuine page was run as a
control in the same pass.

A third verdict exists because a pass that cannot fail is not evidence: **RENDER_EVIDENCE_VACUOUS** when
fewer than two distinct states were observed, so neither rule was exercised.

## Results, in both directions

    the deceptive page            RENDER_CONTRADICTS_STATE   rejected. Two states share one picture, and
                                                             the reported zero state rendered two ways
    an accessor returning a       RENDER_CONTRADICTS_STATE   rejected by the other rule: one state,
    constant                                                 several pictures
    SEQ-1 addition 1 (accepted)   RENDER_AGREES              genuine
    TRANSFER-3 colour (accepted)  RENDER_AGREES              genuine
    TRANSFER-3 scores (accepted)  RENDER_AGREES              genuine
    the original page, no         RENDER_AGREES              correct: an honest page that simply lacks
    feature at all                                           the feature. Whether the feature EXISTS is
                                                             the gate's question, not this instrument's

**So all three previously accepted artefacts survive an independent check.** Those acceptances were not
state-seam artefacts. That is worth knowing and it is the first thing this instrument was used for.

`server/renderEvidence.test.mjs`: **17 assertions**, including the false-positive regression, the
hardcoded accessor, an accessor that throws, and the vacuous case.

## What is fixed, and what is still open

- **Fixed:** there is now a second, independent source of evidence, tested in both directions, and the
  three existing acceptances pass it.
- **NOT fixed - the gate does not consult it.** `playCheck` is byte-identical and acceptance still rests
  on the state seam alone. Folding render evidence into acceptance changes the gate, needs its own freeze,
  and is a separate decision. **Until then, the deceptive page would still be ACCEPTED by a live run.**
- **NOT addressed - protecting the judge.** A candidate edits only `index.html` inside a temporary
  workspace, and the evaluator, the specs and the acceptance records live outside it. That is the current
  arrangement rather than a verified property: no test yet tries to have a candidate modify them.
- **NOT addressed - rewarding transferable success.** Nothing is promoted into durable guidance yet, so
  there is no reward loop to overfit. When there is one, the rule Micheal named applies: test a strategy on
  fresh cases before promoting it, rather than rewarding repeated success against the same exposed checks.
- **NOT addressed - persistence.** No page here stores anything across reloads, so "does it survive a
  restart" is untested by either source.
