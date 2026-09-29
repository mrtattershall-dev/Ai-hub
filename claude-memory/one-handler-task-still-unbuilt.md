---
name: one-handler-task-still-unbuilt
description: INC4-1 2026-09-26 - farm-plant (one handler, negative clause, mutant-validated) got 0 accepted in 23 attempts across four interfaces; every cell that produced code was handed its site and step
metadata:
  type: project
---

2026-09-26: `farm-plant` narrows the unit of work to ONE handler - p plants on an empty
tile with seeds and spends exactly one seed; in every other case it changes nothing - with
movement as the protected set and the spec validated against one mutant per clause
(`farmPlantSpec.test` 12/12; step 5 is vacuously passable by inaction, so it counts only
with 4 and 6).

Four interfaces, 23 live attempts, **0 accepted, 0 passed the planting clause**:

- whole file: echoed the starting page byte-identical 5/5, 901 tokens each. **A narrower
  request alone does not lift the echo** ([[whole-file-return-echoes-the-input]]).
- anchor: still copied the whole file into FIND 4/5; one whole-file deletion, restored.
- fim with the site given: code in 3/3 with a one-line instruction, but the closest
  attempt wrote NO planting logic - it bound the five pre-existing broken functions to
  keydown, so every keypress ran every handler and arrow keys harvested. Scope drift into
  explicitly forbidden keys in 4/5.

5 regressions, 5 byte-exact restores, 0 accepted - the fourth consecutive run to report
that, and it does not move the builder.

**Why:** the goal is ONE accepted functional addition. Shrinking the feature was not
enough, and the interface variants are exhausted for now: the stopping rule in
INC4-1_DEFINITION was applied rather than trying a fifth.

**How to apply:** the open decision is a MODEL choice and needs fresh authorization from
Micheal (7B cells stay HELD at $3, $0 spent). And note what every producing cell required:
**I chose the site and the step.** That is an assisted code generator; Legasus choosing and
assembling small tasks itself is the unbuilt part of the manager. See
[[instruction-shape-dominated-the-result]], [[product-north-star-autonomous-builder]].
