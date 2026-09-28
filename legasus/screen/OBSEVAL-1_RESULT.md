# OBSEVAL-1 — **Legasus chose the observation method itself on 4 of 8 fresh pages. The addition was declined, at zero cost, for a named reason.**

2026-09-28, **$0**, local, `qwen2.5-coder:1.5b`. Frozen at `a657679`, executed revision
`3ea58945e784de1bd959cb3ce7f11d981a877521`. 8 pages generated after the freeze, all `doneReason: stop`,
all kept. **No adapter was chosen by a human at any point.**

## 1. WAS THE SELECTED OBSERVATION METHOD APPROPRIATE?

**Yes, on all eight — the method proposed matched the application's real surfaces every time.**

    e1-books, e2-cities, e3-tools, e4-fruits   browser.input proposed and selected
      evidence: a text input at #filter, and an `input` listener registered on it
    e5-notes, e6-files, e7-orders, e8-users    browser.click proposed and probed
      evidence: a clickable control at #toggle, and a `click` listener registered on it

Nothing routed on a filename, a task id or a comment. Every page was judged on its registrations and
surfaces alone. **None of these pages exposes `window.app.state()`** — the prompt deliberately omitted
the seam clause, and the input pages were observed entirely through the DOM.

## 2. DID IT CAPTURE ACTUAL BEHAVIOUR?

**4 of 8. And the four failures are a defect in my instrument, not in the applications.**

    INPUT  4 of 4   CONFIRMED_BEHAVIOUR
    CLICK  0 of 4   NO_CHANGE_OBSERVED

**The click pages work.** `e5-notes` sets `noteList.style.display = 'none'` on click - the toggle does
exactly what it was asked to do. My snapshot could not see it, because it tested each element's OWN
computed display, and **`display` is not inherited**: an `<li>` inside a hidden `<ul>` still reports
`list-item`. Measured directly rather than reasoned about:

    with the UL visible   {"liDisplay":"list-item","liRects":1}
    with the UL hidden    {"liDisplay":"list-item","liRects":0}

`getClientRects()` collapses to zero; computed display does not. **The fix is to test rendered rects in
both `observationSelect` and `actions.DOM_VIEW`.** It is NOT applied here: OBSEVAL-1's own frozen rule is
that nothing in the path changes once generation begins and a defect is fixed on a later set. So the
click group's `NO_CHANGE_OBSERVED` stands as what this revision produced, **and it is not a finding about
those four applications.**

That the layer reported `NO_CHANGE_OBSERVED` rather than "no behaviour" is the distinction working: the
record says explicitly that this is not a finding of absence, and names what was uncovered.

## 3. DID THE BASELINE MEET ITS REQUIREMENTS?

Judged against the PROMPT, not against the page. For the subject, `e1-books`: **partly established, and
the limit is mine.**

    asked for   a text input at #filter showing only the items whose name contains the typed text
    observed    typing "a" left visible ["Book List"] - all five books hidden. The books are named
                "Book 1".."Book 5", none of which contains "a", so hiding all five is CORRECT.

**But the probe only ever typed strings that match nothing.** `TYPE_SET` is a fixed, page-independent
`['a', 'zzqq']`, and neither matches "Book N". So the filter is confirmed to HIDE NON-MATCHING items
correctly, and **whether it SHOWS matching items was never exercised.** A probe that derived a matching
string from the page's own visible text would test both halves; this one cannot. Recorded as a limitation
of the probe design, to fix on a later set.

## 4. DID A SUBSEQUENT ADDITION SUCCEED?

**No. The policy DECLINED, and this is the good kind of failure.**

    round 1: the policy DECLINED - NO_LISTENER_FOUND:
             "somewhere that already handles a key press, to put this beside"

    attempt calls   0 of 12       accepted 0     refused 0     blocked 0
    protected failures 0          restored 0     interventions 0

**It named what it needed and spent nothing.** This is the concrete architectural gap, stated by the
system itself: `autoGuide` places an edit either inside an existing keydown listener (R1) or after the
last one (R2), and **an input-driven page has no keydown listener at all**, so neither rule can anchor.
The guidance policy has only ever been exercised on keyboard-driven canvases, and this is exactly where
that stops.

It also settles the prediction BATCH-1 left untested. There I predicted `UNSUPPORTED_TRIGGER` for a click
requirement and never reached the policy. Here the policy was reached, and declined for a DIFFERENT and
more basic reason: not the trigger kind, but the absence of any anchor for the edit.

## 5. CALLS, TIME, INTERVENTIONS

    page generation calls     8
    addition attempt calls    0 of 12        (the policy declined before generating)
    browser probe runs        ~40            observation, emission, validation
    wall clock                ~22 min        generation plus observation across 8 pages
    interventions by a person 0
    dollars                   0

## What this establishes

- **Established:** on fresh, unfamiliar pages with no state accessor, Legasus proposed an observation
  method from the application's own evidence, probed it in isolation, and confirmed real behaviour on
  every input-driven page — **with no human selecting an adapter.** That is the observation half of the
  milestone.
- **Established:** the task emitter builds checks in the selected modality. `e1-books` produced a valid
  task whose carried-forward checks are TYPE actions and whose addition is absent on the baseline.
- **Established, by declining:** the guidance policy cannot site an edit on a page with no keyboard
  listener, and says so by name at zero cost.

## What this does NOT establish

- **NOT the milestone.** A verified addition to an unfamiliar input- or click-driven application did not
  happen. Observation succeeded; building did not start.
- **Nothing about the four click applications.** Their `NO_CHANGE_OBSERVED` is my visibility defect.
- **Not that `e1-books` filters correctly** — only that it hides non-matching items. The probe never
  typed a matching string.
- **Nothing about software generally.** Eight browser pages of two shapes, one model.

## The two defects this run found in my own path, both to be fixed on a later set

    1  VISIBILITY   computed `display` is not inherited; use rendered rects. Cost: 4 of 8 pages
                    misreported as showing no change.
    2  PROBE TEXT   a fixed type-set can never match a page's own content, so only the negative half of
                    a filter is ever exercised.

And the gap the run was designed to find: **the guidance policy needs a way to site an edit on a page
with no keyboard listener.** That is the next thing to build, and it is a policy change, so it must be
frozen and evaluated on pages neither version has seen.
