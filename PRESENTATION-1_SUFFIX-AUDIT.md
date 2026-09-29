# FIM suffix-boundary audit — a harness defect, and it changes nothing about the outcome

Post-hoc analysis of saved bytes. **PRESENTATION-1 was not rerun and is not revised.** Reported
separately, as required.

## The question

Six S completions ended with `</script></body></html>`. I called that a completion-horizon failure.
That was an overstatement — two explanations fit, and they are distinguishable from the bytes on disk:

1. the model did not know when its middle should end
2. the harness did not treat an **exact repeat of the supplied suffix** as a normal boundary

## Controls first

| control | result |
|---|---|
| **erasure** — real code *after* the repeated suffix | located, and the trailing code is **reported, never silently dropped** |
| **malformed** — a near-miss suffix (`</scrip>`) | **not cut**; stays refused |
| **clean** — an exact repeat | cuts to exactly the middle, nothing after |

4 of 4. A trimmer that is too eager is worse than none.

## Result

| | count |
|---|---|
| S completions analysed | 12 |
| suffix repeated **byte for byte** | **5** |
| a JavaScript-only middle recovered by cutting there | **5** |
| ...where the control then **exists** | **0** |
| ...where the feature is **constructed** | **0** |
| completions where cutting would erase real trailing code | **0** |

## What this establishes

**Explanation 2, for 5 of 12.** Those completions re-emitted the supplied suffix exactly, and cutting
at it recovers a middle that parses as JavaScript. **My harness failed to cut; the model did not fail
to stop.** Trimming a re-emitted suffix is routine in FIM harnesses and `containToSlot` does not do it.
That is an apparatus defect, and it is mine.

**My "completion-horizon" reading of those six is withdrawn.** Five are the harness. The sixth — s12 —
was refused as wrong-slot-language *without* repeating the suffix, so it has a different cause that this
audit does not identify. **The horizon hypothesis is not supported by this evidence** and needs its own
study.

## What it does not change

**Nothing about the outcome.** Of the five recovered middles, the control exists in **zero** and the
feature is constructed in **zero**. They bind a handler to a control they never create — the same shape
the feasibility probe showed. Fixing the boundary would convert five refusals into five rejections.

**PRESENTATION-1's primary gate is unchanged: 0 accepted in every condition.**

And the primary finding is unchanged: **presentation changed behaviour dramatically and did not produce
a complete verified feature.** Inline-comment intent produced document-ending continuations with no
usable code; separated front-loaded intent produced page-aware executable JavaScript that still missed
feature construction.

## The defect, recorded and not yet fixed

`containToSlot` should treat an exact re-emission of the supplied suffix as a boundary. It is not being
changed today: PRESENTATION-1's records would then describe a harness that no longer exists, and the
fix belongs to a declared change with its own controls — the erasure control above is the one it must
pass.
