# ASSIST-5 — an accepted addition that survives the FULL accumulated checks. The system chose the guidance; zero interventions during execution. One page, three listeners, 521 characters added.

2026-09-27, **$0**, local. Same frozen policy as ASSIST-2, plus the two fixes that run's failure
demanded, plus one refinement those fixes forced. **The game now moves, plants and grows, and every
previously accepted behaviour still holds.**

## The result

    what the system chose      site rule R2 (read off the file), the scaffold, the instruction
    attempts                   2 (seed 1 preserved but incomplete, seed 2 accepted)
    generation                 106.3 s, 1,050 output tokens
    interventions during the run  0

    grow spec, playCheck              passing [1,2,3,4,5,6], errors 0
    the automatic diagnostic          6/6
    the independent evaluator         requested PASS
    the accumulated protected set     PASS  [farm-plant-v2: PASS, farm-grow: PASS]
    the planting spec, all 7 steps    passing [1,2,3,4,5,6,7], failing none, errors 0

    the artifact    keydown listeners 2 -> 3     stray duplicate bindings 0
                    characters 4,092 -> 4,613    added 521 characters for one feature

What was spliced, after structural truncation dropped 109 lines the model wrote past its slot:

    day++;
    for (const [key, value] of Object.entries(tiles)) {
        if (value.stage < 3) {
            value.stage++;
        }
    }
    draw();

## The three fixes, and the sequence that produced them

    ASSIST-3  the accumulated protected set alone. The same class of candidate that ASSIST-2 accepted
              was now RESTORED: seed 2 passed all six growth checks and was rejected because the
              accumulated planting requirement failed. The gate caught the regression in a live run.
              0 accepted of 5.
    ASSIST-4  structural containment alone, refusing anything over budget. Safe and useless: 8 of 8
              REFUSED as TOO_LARGE, 32 to 94 code lines for a 20-line slot. This model always writes
              past a small slot even when its first lines are right.
    ASSIST-5  containment with STRUCTURAL TRUNCATION: cut at the first point where the completion would
              close a block it did not open, then refuse what still cannot sit in the slot. Accepted on
              the second attempt.

**ASSIST-4 is why the third step exists, and it is a real result, not a stumble.** Refusing every
over-long completion is correct and produces nothing; the cut has to be structural rather than absolute.
The cut never depends on the model reproducing any particular line — that dependence is exactly what
failed in ASSIST-2.

## The qualifications, kept

- **This is not an efficiency comparison with ASSIST-1.** The tasks differ, and ASSIST-1 did the
  preparation this run inherited. 2 attempts against 15 is not a speedup; the two runs are not
  comparable on effort.
- **The system being evaluated includes the output limit and the choice of protected checks.** When
  ASSIST-2 let a regression through I called neither "the policy's fault"; that drew the boundary too
  narrowly. Containment and protected-check selection are parts of this system, and their failure was
  the system's failure.
- **The task was fresh; the page informed the rules.** R2 fired because I had read this page when I
  wrote the rules. This shows automatic application on that page, not independent generalisation. A page
  I have never seen is the test that has not been run.
- **Zero interventions applies to execution.** I built the fixes between runs. What is established is
  that the policy needs no human inside a run, not that the system needed no human this week.
- **Two attempts, one accepted.** No rate follows.

## The regression case is kept, and the corrected system refuses it

`regressionCase.test` 10/10 pins it from both sides: the ASSIST-2 completion is refused structurally
(43 code lines for a 20-line slot), the ASSIST-2 artifact fails the accumulated protected set at the
planting requirement's step 6 while its growth behaviour still passes — which is precisely why the old
protected set missed it — and a bounded growth implementation still passes both the new requirement and
every accumulated one. **A fix that only refused things would have failed that second half.**

## Intentional requirement changes are explicit

    accumulates   ['farm-plant-v2']
    supersedes    farm-plant -> farm-plant-v2, "the same planting requirement with the no-error clause
                  added; checking both would test the same behaviour twice"

Dropping a check is now a recorded decision with a reason, never an omission.

## What this establishes

- **The milestone: an accepted addition that survives every accumulated check**, with the system
  choosing site, scaffold and instruction, and no intervention during execution. The page moves, plants
  and grows; planting still stops when the seeds run out; no errors anywhere.
- **The accumulated protected set catches what a hand-picked one missed**, demonstrated live in ASSIST-3
  and pinned in a regression test.
- **NOT established:** generalisation to an unseen page, any success rate, or that this survives a
  fourth increment. The next honest test is a page whose shape I have not read.

Records: `ASSIST-5_accepted_index.html`, `ASSIST-5_run.json`, `ASSIST-3_run.json`, `ASSIST-4_run.json`,
`ASSIST-2_RESULT.md` (the failure that produced the fixes), `server/regressionCase.test.mjs` 10/10.
