---
name: slot-shape-beat-information
description: ASSISTED-1 2026-09-27 - one verified success on an unseen page in 5 calls / 8 interventions; the decisive intervention was the SHAPE of the edit slot, not any information supplied
metadata:
  type: feedback
---

ASSISTED-1, $0 local, 1.5b, traffic-light page written after the definition was frozen. Budget 20
calls / 12 interventions; used **5 and 8**. Accepted: `state.color = lightColors.red; drawLight();` -
9 of 9 requested checks, all carried-forward checks, 0 errors, evaluator PASS, RETAIN. Rebuilt from the
ledger to a MATCHING sha and re-verified 9/9 in a fresh browser.

**The change of SLOT SHAPE PRECEDED the first code production** - stated as a sequence, not a cause.
Interventions 1-4 delivered the same
requirement four different ways and produced NO CODE: with the slot inside `if (e.key === 'r') {`, the
model read the instruction comment as a TEMPLATE and generated chains of `} else if (e.key === 'a') {`
each with its own comment line. Changing the scaffold to a NEW LISTENER WITH AN EARLY RETURN
(`if (e.key !== 'r') return;`) produced code on the first try.

Then, and only then, did information help: extracted state facts made the output tidy (5 tokens, one
line, no runaway) but still wrong (`switchLight()`, which cycles); failing-step FEEDBACK moved it to
correct.

**THE LIMIT, which matters more than the finding:** one ordered sequence does not establish that shape
was the SOLE binding constraint, and it does not retrospectively explain CONSTRAINTS-1/2. Other things
changed between those attempts too (the anchor moved, the prefix grew). The feedback likewise PRECEDED
success without its effect across trials being established. Also separate REPRODUCIBLE EXECUTION of the
saved artefact (demonstrated) from REPRODUCIBLE GENERATION (never attempted).

**Why it is worth testing:** two whole experiments (CONSTRAINTS-1/2) spent their effort on WHAT to put in
the prompt and returned nothing, and a plausible reading is that the binding constraint was the STRUCTURE
the completion had to continue. A
comment in an empty if-block makes more branches the natural continuation; a statement position after
an early return makes a statement the natural continuation. Same family as
[[generation-interface-masks-capability]] and [[instruction-shape-dominated-the-result]].

**How to apply:** before tuning prompt CONTENT, check that the slot's natural continuation is the kind
of thing you want - and to actually establish it, hold everything else fixed and vary ONLY the shape,
across seeds. autoGuide's R2 rule already produces the shape that worked, so the target is partly
built - whether the policy can pick it plus the facts plus the feedback WITHOUT a human, on a page it
has not seen, is the open question. One success = ATTAINABILITY, never a ceiling, never reproducibility
(one seed, one attempt), never automation (all 8 interventions were mine). See
[[constraint-arms-not-runnable]].

Sealed for that transfer test, generated before this assistance was designed and unread:
legasus/bench/dice (e899be776227f2bb), counter (0842a76ac9233458), bars (9dff0d2dfa0329be).
