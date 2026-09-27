# MODEL-CMP-1 DEFINITION — one frozen assisted handler task, run identically across models

Frozen 2026-09-26, before any arm is run. **NO PAID RUN IS AUTHORIZED BY THIS DOCUMENT.** The
local 1.5B arm runs at **$0** to fix the baseline. Any hosted arm needs a fresh authorization from
Micheal recorded here before deploying; the earlier $3 authorization for the 7B narrow cells is a
different experiment and stays HELD and unlaunched.

## Why this exists

Interface adaptation stops here. INC2-1, INC3-1 and INC4-1 spent 58 attempts on this model and
produced no accepted functional addition, and the last run showed **my own instruction text moving
the code-insertion count from 0 of 5 to 3 of 3**. Continuing to vary the harness measures the
harness. So: freeze one configuration that is known to permit a solution, and change **only the
model**.

**Model choice is the next experimental variable, not the only remaining explanation.** Prompt
sensitivity, suffix handling and output processing all remain live, and this design holds them
fixed rather than ruling them out. A stronger model succeeding here would establish a usable
**assisted**-generation path. It would say nothing about an autonomous manager, because the site
and the step are supplied by the harness.

## The architecture this is a step toward

Use the cheap model where it succeeds and escalate the difficult edits within a budget. That needs
one number per model on the same task: **does it produce an accepted addition, at what time and
what cost.** This experiment produces exactly that, one row per model.

## FROZEN: every element held identical across arms

    starting page      legasus/screen/NARROW-2_accepted_index.html   (sha256 recorded at run time)
    task               farm-plant   (benchTasks.js), unchanged
    requested check    play-plant.json steps 1-6, mutant-validated (farmPlantSpec.test 12/12)
    protected check    steps 1-3, movement, judged SEPARATELY from the handler
    gate               playCheck -> evaluator -> acceptance policy, via judgeCandidate.mjs
    interface          localEdit.mjs --protocol fim
    the named site     --region-from "        document.addEventListener('p', plantSeed);"
                       --region-to   "        document.addEventListener('load', loadGame);"
                       (a 5-line hole; the movement wiring stays in the prefix by construction)
    instruction        --fim-instruction, verbatim, one line:
                       // p plants: if the player's tile is empty and inventory.seeds > 0, set
                       tiles[x+','+y] = { crop: 'wheat', stage: 0 } and do inventory.seeds--;
                       otherwise change nothing.
    output processing  --trim-tail   (cut the infill at the first line closing script/body/html)
    decoding           temperature 0.2, seed 1..5, --max-tokens 1500, --deadline-sec 900
    attempts           five seeds per arm, one attempt each, no retries, no prompt tuning

**Nothing in that list may change between arms.** If any of it has to change, every arm is re-run.

## The instruction and the tail trim are EXPLORATORY

Both were introduced **after inspecting failures** in INC4-1: the one-line instruction after the
nine-line version produced empty completions, the tail trim after the model closed the document
inside the hole. They are post-hoc choices, not pre-registered ones, and they are frozen here only
so the arms are comparable. **They inflate what the configuration achieves relative to anything
chosen blind**, and no arm's result may be reported without saying so.

## Assistance ledger (identical for every arm)

    supplied by the harness   the output format; the edit SITE; a one-line instruction; the tail
                              trim; the observability seam (already in the starting page)
    not supplied              the implementation, the control flow, the negative-clause handling
    NOT measured here         choosing the site, choosing the step, deciding when to stop - the
                              manager's work, entirely absent from this design

## Recorded per attempt

    accepted (RETAIN)                      the headline outcome
    requested / protected verdicts         planting and preservation, apart
    inserted non-comment content           and the raw reply beside the transformed candidate
    wall-clock seconds, output tokens       time
    dollars                                cost: $0 for local, metered for any hosted arm
    termination                            natural stop vs token ceiling vs deadline

Every record carries `rawReply`, `transformed` and `candidate` (with its sha256), so the
transformation the harness performed is visible next to what the model actually emitted.

## Arms

    A  qwen2.5-coder:1.5b, local          $0      BASELINE - run now
    B  a stronger model, to be chosen     needs authorization, NOT run

## Pre-registered readings

- **Baseline accepted > 0:** the frozen configuration can already produce an accepted addition, and
  the earlier zeros were the instruction text rather than the model. That would be the single most
  important correction this line of work could make.
- **Baseline 0, stronger model > 0:** an assisted-generation path exists at a larger size. The next
  question is the escalation budget, not more interface work.
- **Both 0:** the configuration is wrong in a way no model rescues, and the assumption to attack is
  the site or the task decomposition - which is the manager's job, and unbuilt.

## Verification before the baseline arm runs

    the suffix reaches the model      fimWireCheck.mjs: the harness's request renders into the same
                                      token sequence as a hand-built infilling request (26 == 26),
                                      exceeds an empty-suffix request by exactly the suffix's 12
                                      tokens, and produces the same greedy first token. Token
                                      accounting, NOT a dump of the rendered request.
    the region permits a solution     localEdit.test cell 10: a hand-written correct edit through
                                      this exact 5-line hole reaches RETAIN.
    the gate can fail                 farmPlantSpec.test 12/12: one mutant per clause.
