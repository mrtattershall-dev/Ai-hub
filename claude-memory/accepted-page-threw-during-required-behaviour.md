---
name: accepted-page-threw-during-required-behaviour
description: 2026-09-27 - the ACCEPTED increment-1 page throws 5 times during the arrow-key movement it was accepted for; step 1 ran before any keypress so the gate could not see it. Test-coverage gap; corrected check VERSIONED not edited
metadata:
  type: feedback
---

2026-09-27 (`server/baselineValidity.mjs`): the untouched accepted increment-1 page raises
**five** `Cannot set properties of null (setting 'textContent')` errors while performing
`farm-i1`'s own required behaviour - the arrow-key movement it was accepted FOR. `draw()` ends
with `document.getElementById('day').textContent` and no such element exists. It still passes
step 1, because **step 1 is evaluated before any key is pressed**.

    farm-i1 (the spec it was accepted under)   passing [1,2,3]    errors during the run: 5
    farm-plant (the current spec)              passing [1,2,3,5]  errors during the run: 17

So the acceptance rested on a check that could not see the defect: a **test-coverage gap**, not
a property of the page's successors.

The corrected check is **versioned, not edited in place**: `farm-plant` stays at 6 steps so
earlier results remain interpretable; `farm-plant-v2` adds "no page or console error was raised
at any point". `farmPlantV2Spec.test` 10/10 pins that the baseline FAILS the new step, a correct
handler alone STILL fails it (so it is not a planting check in disguise), and supplying the
missing element passes all seven. Comparisons already under way stay on the old spec.

**Why:** a gate that evaluates its error check before the behaviour runs cannot see errors the
behaviour causes. This one accepted a page that throws on every keypress.

**How to apply:** ask WHEN each assertion is evaluated, not just what it asserts - an error
check placed before the actions is blind to them. When a gap like this is found, version the
check and record which results were measured under which version; never edit the spec earlier
results were scored against. Related: [[silent-failures-are-the-class]],
[[over-strict-checkers-invisible-to-known-bad]], [[error-text-selects-a-repair-family]].
