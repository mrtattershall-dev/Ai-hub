# GATE-2 — the revised acceptance gate, frozen

Frozen 2026-09-28, **before any page of the next set is generated.** Local, **$0**. No verified spend
authorization; Modal stays off.

## What changed, and the distinction it rests on

The old gate read `window.app.state()` and nothing else. A hand-written page that reports the expected
state while drawing the real totals passes it 7 of 7 (MEASUREMENT-GAP-1). GATE-2 adds a second and third
source, under rules that keep **a requirement failure** and **a checker limitation** apart:

    situation                                      treatment
    the task declares a SUPPORTED visual contract  conformance AND correct displayed totals are REQUIRED;
                                                   failing either is a REQUIREMENT FAILURE and blocks
    the page is outside the checker's supported    visual correctness is NOT EVALUATED; recorded, and it
    layouts, and the task required nothing         does NOT block
    generic state-to-pixel consistency             findings and coverage are RECORDED; there is no
    (`renderEvidence`)                             rejection rule at all

**Why not advisory everywhere:** that would let a KNOWN WRONG DISPLAY pass on precisely the tasks where it
can be verified. **Why not blocking everywhere:** that would reject almost every real page for a fact
about the checker rather than about the page - `LAYOUT_DOES_NOT_CONFORM` is the common case, not the rare
one.

## The three arms, and they are reported separately always

    FUNCTIONAL   the frozen gate: playCheck, evaluator, acceptance, judgeCandidate. BYTE-IDENTICAL to
                 TRANSFER-2's manifest. Decisive in the negative: a visual pass never rescues a
                 functional failure.
    VISUAL       server/visualCheck.mjs. Blocking ONLY when the task declares `visualContract.required`.
                 Validated in five directions against hand-written fixtures in VISUAL-1: correct,
                 wrong totals, swapped labels, stale display, and the misleading accessor.
    RENDER       server/renderEvidence.mjs. ADVISORY EVERYWHERE, with no rejection rule, because both of
                 its rules have legitimate exceptions in both directions: different states can look
                 identical, the same state can look different, and consistent pixels can still depict
                 the wrong result. Its COVERAGE is carried through so a reader can see which rules ran.

The combination is `server/acceptanceDecision.mjs`, 30 assertions in `acceptanceDecision.test.mjs`
covering all four situations plus the two failure modes above.

## What a task must declare to get a blocking visual check

    "visualContract": {
      "required": true,
      "name": "400-pixel scoreboard",
      "layout": "legasus/bench/visual/scoreboard-layout.json",
      "trace":  "legasus/bench/visual/trace.json"
    }

**The layout and the trace are written by hand from the requirement, and the expected drawing is rendered
in a SEPARATE BROWSER PROCESS on a blank document.** Deriving the expected drawing from the candidate's
own draw calls would reproduce its mistake and call it agreement.

**Exact pixel comparison is for a controlled fixture under a pinned browser, font, viewport and scale
factor.** It is not a general definition of visual correctness and is not to be pointed at arbitrary
interfaces. OCR would trade its precision for flexibility and its own misreadings; neither is universally
more robust.

## The next run, and how it is reported

    the pages        FRESH, generated after this freeze, and they must satisfy the DECLARED BASELINE
                     ELIGIBILITY CRITERIA already frozen in TRANSFER-3 - the same seven mechanical rules,
                     unchanged
    the policy       unchanged from SEQ-1, hashes in GATE-2_MANIFEST.txt
    reporting        FUNCTIONAL and VISUAL outcomes reported SEPARATELY for every page, and an
                     unsupported visual check is reported as such rather than omitted. The eligibility
                     rate is reported. Calls are reported per category and never summed.

**Every subject used so far is development material** - the three set3 pages, the SEQ-1 page, the floor
fixtures, the visual fixtures and the deceptive page. None of them can serve as evidence in the next run.

## What this freeze does not claim

- **Not that the gate is now sound.** It is better instrumented. A page that reports the expected state
  AND draws the expected totals AND is internally consistent can still be wrong in ways none of the three
  arms looks at - persistence, timing, input handling outside the traced keys, anything off-canvas.
- **Not that the visual checker generalises.** It understands one fixed layout. Every other page is
  `NOT_EVALUATED`, and that is an honest report of a limitation, not a pass.
- **Not that renderEvidence's rules are sound.** They are heuristics with known exceptions, which is
  exactly why nothing is permitted to reject on them.
