# AUDIT-2 stage 3 — the protocol, fixed before the paid run

**Status: FROZEN. Pages generated and emitted; no arm has run.**

## What this measures, and what it does not

Arm A is localized planner-guided infill. Arm B is direct whole-page generation and repair. Their
**interface and output budget differ** — a 400-token slot against a 3000-token page — so this result
**cannot isolate "guidance text alone."**

It answers the product-relevant question instead:

> For the same model and the same campaign constraints, which complete method produces more
> independently verified repairs?

Either the manager earns its extra structure or it does not. Attributing any difference to a single
component is stage 5's job, and stage 5 is on development pages only.

## The pages: 8 written, 6 eligible, 2 not

Written after stages 1-2 were frozen and after both protocols were captured. **None of the four pilot
pages appears here**; those are development pages.

| page | shape | observation | addition rule | eligible |
|---|---|---|---|---|
| e1 | definition list, class-based hiding, listener on the field | browser.input | FILTER | yes |
| e2 | click counter, two buttons, no text input | browser.click | KEY | **no** |
| e3 | keyboard-driven marker, arrow keys, document listener | browser.keyboard | KEY | yes |
| e4 | list hidden by the `hidden` property, `redraw()` called at load | browser.input | FILTER | yes |
| e5 | form with a submit handler, list built on submit | none | — | **no** |
| e6 | object-held state, arrow-function listeners, inline style | browser.input | FILTER | yes |
| e7 | two independent click toggles over sections | browser.click | KEY | yes |
| e8 | table rows, delegated listener on document | browser.input | FILTER | yes |

**Mix: 3 interaction modalities (input, keyboard, click), 2 addition rules, 6 distinct hiding and
state mechanisms.** Not variations of one shape.

### The two ineligible pages, and why — reported, never silently dropped

- **e2** — the addition was **already true on the baseline**. Its carried-forward interactions are
  "click up" then "click down", which return the counter to 0; the KEY addition then asks that the
  page show its load state, which it already does. That is an **emitter weakness**, not a page defect:
  the emitter does not check that its two chosen interactions leave the application somewhere other
  than where it started. Recorded as future work; not fixed mid-audit.
- **e5** — `NO_CHANGE_OBSERVED`. Typing into the field changes nothing downstream (the list is built on
  submit), and submitting an empty field is a no-op by design. The effect is **sequence-dependent
  across two adapters** — type, *then* submit — and the observer probes each plan separately. A known
  coverage limit, already named in the observer's own `unresolved` output.

Neither page is excluded for being hard. Both appear in the denominator of *eligibility*, which is
reported separately from either arm's success.

## Procedure, fixed

1. **Selection order**: e1, e3, e4, e6, e7, e8 — the written order, filtered by eligibility. No
   reordering after any arm runs.
2. **Task emission**: `emitTaskAuto.mjs`, identical for both arms, run once per page *before* either
   arm. Both arms read the same `task.json`.
3. **Evaluator**: `retainPath.judgeAndDecide` + `shouldRetain`, outside both arms. An arm's own belief
   about its success is recorded and ignored.
4. **Per-arm call limit**: 12 calls, 4 rounds, seeds 1-3 per page — the frozen budget, identical.
5. **Campaign-wide GPU deadline**: `--max-gpu-seconds 1800` per arm, enforced in flight, with the app
   stopped by the watchdog. Deployment happens *inside* the clock via `--deploy`.
6. **Arm order**: **arm A first**, then arm B. Neither arm is changed after the other has run.

## Every denominator, declared now

Reported per arm over **all 6 eligible pages**, never over a filtered subset:

- verified completions / 6
- regressions **produced** and regressions **surviving** — separate columns
- refusals by reason: `WRONG_SLOT_LANGUAGE`, `NOT_PARSEABLE_JAVASCRIPT`, `EMPTY` (arm A);
  `ECHOED_THE_INPUT`, `NO_COMPLETE_PAGE`, `SCRIPT_DOES_NOT_PARSE` (arm B)
- classification spread: MET / PARTIAL_EFFECT / NOTHING_WORKED / BROKE_WHAT_WORKED / NOT_JUDGED
- **interrupted pages** — a page that did not run to a recorded end is not a completed page with a
  null result, and the campaign exits non-zero if any occurs
- calls made, prompt and output tokens, generation seconds, wall clock
- cost, read from billing and reconciled against the watchdog
- human interventions — expected 0; any is reported in the headline

## Admission test, before the stage starts

| term | value |
|---|---|
| accrued under AUDIT-2's cap | $0.00 |
| outstanding exposure (nothing running) | $0.00 |
| this stage's maximum (2 × 1800 s at ~$0.86/hr) | $0.86 |
| shutdown allowance (45 s scaledown + stop latency, twice) | ~$0.04 |
| **total** | **~$0.90** |
| hard stop | $4.00 |

**Admitted.** AUDIT-1's $0.336 was a separate, closed authorization and is not charged against this cap.
