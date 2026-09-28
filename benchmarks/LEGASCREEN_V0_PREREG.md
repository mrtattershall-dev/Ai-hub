# r4 — LegaScreen v0: can a mechanical screen rediscover defects it was never told about?

Proposed by the owner, 2026-09-20: a high-sensitivity screen over authority-bearing transformations,
tolerating false positives, feeding narrow diagnostics - screening, not diagnosis.

## What is being tested, and what is deliberately NOT being built

The vision is large: static and dynamic screening, an authority-flow graph, a mutation battery, an
unscreened-region map. Building that from the design downward would be this project's own worst
pattern - machinery whose coverage is asserted rather than demonstrated, which Entry 19 just finished
naming. So v0 tests the ONE premise everything else rests on:

    A screen given only the module surface and a declared invariant - and told NOTHING about any
    specific defect - flags transformations that this session found by hand.

If that fails, the vision does not get a second slice on enthusiasm.

## The pathology chosen, and why this one

Of the pathologies the owner listed, ONE has the most recorded instances in this repository and the
cleanest mechanical signature: **information disappears -> authority increases**. Its Law 1
instrument (`informationMonotonicity`) already exists and has always been pointed by hand. v0 points
it automatically.

    SIGNATURE   f(x) -> y, where x and y are objects, and an AUTHORITY-RELEVANT field present on x
                is absent from y.

The field vocabulary is declared and argued from the laws, not from the defects: a field naming
evidence, provenance, scope, witness, ancestry, grant, context, validity, or an epistemic bound is
authority-relevant because the laws turn on it. It is written before the screen is run and is not
tuned afterwards.

## Ground truth, pinned to commits where the defect was LIVE

    GT-1  objectivesFromContest dropped `establishes` / `doesNotEstablish`   live at 77fd921
    GT-2  the same function at HEAD carries them                             fixed at 84af085

GT-1 is the decisive one: the screen is run against a detached worktree at 77fd921 and has no
knowledge of SC-1, of the preregistration that found it, or of the word "stopping".

## Predictions

    LS-1  THE DECISIVE ONE. At 77fd921 the screen flags `objectivesFromContest` for losing
          `establishes` and `doesNotEstablish`. If it does not, the premise is falsified and v0 is
          recorded as a failed idea.
    LS-2  At HEAD the same function is NOT flagged, so the screen tracks the repair rather than the
          function's name.
    LS-3  NON-VACUITY. The screen exercises a countable number of (function, seed) pairs and reports
          it. A screen that calls nothing and flags nothing would satisfy LS-2 trivially.
    LS-4  FALSE POSITIVES ARE EXPECTED AND ARE REPORTED AS A RATE, not hidden. Screening is not
          diagnosis; a legitimate projection will flag. The number is the review burden and it is the
          honest cost of sensitivity. NO THRESHOLD IS TUNED to make it look better.
    LS-5  THE UNSCREENED REGION IS REPORTED. Every exported function the seeds could not exercise is
          listed. "Not flagged" must be distinguishable from "never called" - this is the 452/452
          problem applied to the screen itself, and a screen that hid it would be the thing it is for.

## What v0's region will be, stated in advance

Whatever it flags at 77fd921 and nothing more. Per `protection.mjs`, a detector's region is what its
witness demonstrates:

    object -> object transformations, over functions reachable by the declared seed corpus, for
    field-level erasure only

It will NOT see: value-level loss inside a retained field (C6's shadowed carried value), losses
through array or Map-shaped transformations (C8-a's last-wins), losses in modules outside the
scanned set, or any pathology other than erasure. Those are named now so that a green screen is never
read as a clean repository.

## Falsification

If LS-1 fails, the honest reading is that mechanical enumeration plus a declared invariant does not
reach the defects hand analysis reaches, and the screening thesis needs a different mechanism - not a
bigger seed corpus bolted on after seeing the result.
