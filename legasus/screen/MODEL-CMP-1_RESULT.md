# MODEL-CMP-1 — arm A (the local 1.5B) is the baseline row: 0 of 5 accepted. Arm B is not authorized and was not run.

2026-09-26, **$0**. Configuration frozen in `MODEL-CMP-1_DEFINITION.md` before the run and not
touched since. Starting page sha256 `1ce6bfac00c8…`, hub `3ebb553`.

## Arm A — qwen2.5-coder:1.5b, local

    accepted (RETAIN)                 0 / 5
    planting clause passed            0 / 5
    movement preserved                4 / 5
    inserted non-comment content      2 / 5
    generation time                   82 s total, 16.4 s mean
    output tokens                     865 total
    end-to-end including the gate     696 s total, 139 s mean
    cost                              $0.00 (local)

    seed 1  code Y  movement Y  planting .  PRESERVE_INCOMPLETE   21 s  160 tok  tail trimmed
    seed 2  code .  movement Y  planting .  PRESERVE_INCOMPLETE   10 s  139 tok  tail trimmed
    seed 3  code .  movement Y  planting .  PRESERVE_INCOMPLETE   10 s  139 tok  tail trimmed
    seed 4  code Y  movement .  planting .  RESTORED              19 s  297 tok
    seed 5  code .  movement Y  planting .  PRESERVE_INCOMPLETE   21 s  130 tok

**The frozen pipeline is stable.** Arm A reproduced INC4-1's exploratory cell D outcome for outcome,
seed for seed, including which two attempts inserted code and which one produced a regression. So
any later arm's difference will be about the model rather than about run-to-run drift — five seeds
is still five seeds, but the configuration itself is not wandering.

**CORRECTED by arm C.** This section originally read "16 seconds of generation against 139 seconds
end to end", concluding that verification is about seven eighths of an attempt. **That mean was
driven by one outlier.** The five verification times were 19, 15, 13, **554** and 13 seconds; without
the 554 s row the mean is **15 s**, and arm C measured 21 s for the same local code. The outlier
matches a 9.5-minute gap before the next attempt, on a machine with a recorded history of sleeping
mid-run. Verification here takes roughly **13 to 24 seconds**, so on this CPU generation and
verification are comparable rather than 1:7. Verification only dominates once generation is fast:
see `MODEL-CMP-1_armC_RESULT.md`.

## What arm A's failures are

Two attempts inserted code; neither implemented planting. The better one bound the **pre-existing
broken functions** to keydown so every key ran every handler; the other broke movement and was
rolled back byte-exact. Three attempts inserted comments only. The state after all five is the
accepted increment-1 page, unchanged.

## Read with these limits

- **Exploratory configuration.** The one-line instruction and the tail trim were both chosen after
  inspecting failures in INC4-1. They are frozen here so arms are comparable, not because they were
  specified blind, and they **inflate this row relative to anything chosen in advance.**
- **Assisted, not autonomous.** The site, the format, the instruction and the output processing are
  supplied by the harness. Choosing the site and the step — the manager's work — is absent from this
  design and is not measured by any arm.
- **The model is the next variable, not the only explanation.** Prompt sensitivity, suffix handling
  and output processing stay live; this design holds them fixed rather than ruling them out.
- Five seeds. This is a row, not a rate.

## Arm C

Run, and reported separately in `MODEL-CMP-1_armC_RESULT.md`: the same 1.5B on a Modal A10G
generated **11.9x faster** (1.4 s against 16.4 s per attempt, 114 tok/s against 10.6) and produced
**the same failures - 0 of 5 accepted, planting failed in all five.** Estimated cost under $0.10 of
the authorized $2 cap, app stopped and verified idle.

## Arm B

**Not run. No paid run is authorized.** The definition names everything a second arm must hold
identical, and the record above gives it a baseline to be compared against, including time and
cost. A stronger model succeeding here would establish a usable **assisted-generation** path and
nothing about an autonomous manager.

Records: `MODEL-CMP-1_DEFINITION.md`, `MODEL-CMP-1_armA_seed1..5.json` (each with `rawReply`,
`transformed` and `candidate` plus its sha256), `MODEL-CMP-1_run-armA.log`, `MODEL-CMP-1_gate.log`.
Verification before the arm ran: `fimWireCheck.mjs` (the suffix reaches the model),
`localEdit.test` 42/42 (a correct edit through this exact hole reaches RETAIN),
`farmPlantSpec.test` 12/12 (one mutant per clause).
