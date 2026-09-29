---
name: system-chose-guidance-then-gate-accepted-junk
description: ASSIST-2 2026-09-27 - the policy chose site, scaffold and instruction unaided and got an accepted addition in 2 attempts with ZERO interventions; it also let a regression through because the boundary failed and the protected set was too narrow
metadata:
  type: project
---

2026-09-27, ASSIST-2, **$0 local**, policy frozen before it was written, fresh task
(`farm-grow`: the t key advances the day and grows every planted tile, stopping at 3) whose
checks were mutant-validated first, starting from the page the model produced in ASSIST-1.

**The system decided, unaided:** the SITE (rule R2 - no existing keydown listener dispatches on
key values, so a new listener goes after the last one, read off the file); the SCAFFOLD (trigger
filter plus a redraw, and it DECLINED to supply a tile-key line because this requirement names
every planted tile rather than the player's own - the opposite of what ASSIST-1 needed); the
INSTRUCTION (131 chars from the requirement's own words).

    me guiding (ASSIST-1)   15 attempts, 3 accepted, 766 s, 7 interventions
    the system (ASSIST-2)    2 attempts, 1 accepted, 126 s, 0 INTERVENTIONS

Verified: grow spec 6/6, automatic diagnostic 6/6, independent evaluator requested and
protected PASS, zero errors.

**AND IT LET A REGRESSION THROUGH.** The accepted page fails the older planting spec's step 6
("with seeds exhausted, p changes nothing"), which it passed before. Before: 2 keydown
listeners, 4,092 chars, 7/7. After: **24 listeners, 4 stray 't' bindings, 8,083 chars, 6/7.**
Two causes, both mine:

1. **the boundary failed** - the trim cuts at the suffix's first line, which was
   `try { draw(); } catch ...`; the model wrote plain `draw();`, nothing matched, and it ran on
   for 4,000 chars inventing handlers. One binds 't' to harvestCrop, inert only because its
   guard looks for crop 'seed' while planting writes 'wheat'.
2. **the protected set was too narrow** - I gave the task 3 protected steps; the broken
   behaviour was accepted work outside them. The gate did what it was told.

**Why:** an acceptance gate that checks only the behaviours it was given **will accept an
incoherent change**. Zero interventions is not the same as a clean pass.

**How to apply:** compute the protected set as the UNION of every previously accepted check,
never hand-pick it. Make output-boundary enforcement independent of the model reproducing a
particular line (brace depth returning to the hole's level, or any completion line appearing in
the first lines of the suffix, or a cap at a small multiple of the slot). Both are
task-independent infrastructure, like [[assist-1-ceiling-exists]]'s I4/I5/I7 - and both are
recorded for the NEXT run rather than applied retroactively.
