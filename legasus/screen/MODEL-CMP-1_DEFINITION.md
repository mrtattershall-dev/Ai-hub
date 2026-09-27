# MODEL-CMP-1 DEFINITION — one frozen assisted handler task, run identically across models

Frozen 2026-09-26, before any arm is run. The local 1.5B arm runs at **$0**. **Arm C (the same
1.5B on a Modal GPU) is AUTHORIZED at $2 total — see below; the authorization was recorded here
before deploying.** Arm B (a stronger model) is **NOT** authorized and is not run. The earlier $3
authorization for the 7B narrow cells is a different experiment and stays HELD and unlaunched.

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

    A   qwen2.5-coder:1.5b, local CPU      $0      BASELINE - run
    C   qwen2.5-coder:1.5b, Modal GPU      AUTHORIZED $2 total - run (ollama 0.34.4)
    C2  the same, serving version PINNED to 0.33.3 to match arm A - run, same authorization
    B   a stronger model, to be chosen     NOT authorized, NOT run

**Arm B, when it is authorized, must serve on a PINNED version** (`OLLAMA_VERSION` in
`server/modalOllama.py`, verified in the build log and by the server's startup line). Arm C2 proved
the pin works and also showed that the version was not what made CPU and GPU outputs differ - the
hardware alone does that, on 3 of 5 seeds, so arm B will not be seed-pairable against arm A either.

## Arm C — AUTHORIZED: $2 total, recorded before deploying

**Authorized by Micheal (tatte), 2026-09-26:** *"$2 total cap authorized for the 1.5B Modal
comparison … Include startup, idle time, and shutdown in the $2 cap."* Recorded here before any
deploy, per standing practice. The same message notes that the attempt to launch it from another
workspace spent nothing, and that this session may act on the authorization without asking again.

**What arm C changes: the hardware, and nothing else.** It is a BACKEND comparison, not a
model-size comparison — the same 1.5B, the same five seeds, the same weights and quantization (the
same ollama model tag, its digest compared against the local one before any attempt), the same
prompt, suffix, decoding, output processing and acceptance gate. `server/modalOllama.py` runs the
same ollama inside a Modal container on an A10G and exposes ollama's own HTTP API, so the harness
reaches it through `--model-url` and differs only in latency.

**Reading it, as directed:**

    faster generation, same failures   a SPEED result only. It would show the GPU produces the same
                                       wrong candidates sooner, and would not touch the coding
                                       problem. This is the expected outcome.
    better acceptance                  must NOT be attributed to GPU-versus-CPU before checking
                                       BACKEND differences: ollama version, digest, context length,
                                       sampler defaults, and whether the FIM rendering matches.
                                       The digest and wire checks below exist for that.
    slower or equal generation         possible, and worth reporting plainly: a cold start, the
                                       proxy hop and network latency all sit inside arm C's clock.

**Generation and verification are timed apart** in every record already (`timing.generateMs` against
`timing.playMs` / `timing.acceptanceMs`), because arm A showed verification is about seven eighths
of an attempt's wall clock and that part runs locally in both arms.

**Cost control, inside the $2 cap:** `min_containers=0` so nothing idles between sessions; the
weights are baked into the image so a cold start does not pay to download them; `scaledown_window`
300 s to stay warm across the local verification gaps rather than cold-starting five times;
`max_containers=1`; a 1800 s function timeout. **The app is stopped explicitly at the end** (`modal
app stop --yes`, which must be non-interactive). Container seconds are costed at the verified A10
unit price of $0.000306/s and reported with startup, idle and shutdown included.

**Checks before the first attempt, both cheap:**

    same weights          /api/tags digest on Modal must equal the local digest for the same tag
    same wire rendering   fimWireCheck.mjs against the Modal URL must give the same verdict as
                          locally: prompt+suffix renders like a hand-built infilling request and
                          exceeds an empty-suffix request by the suffix's own token count

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
