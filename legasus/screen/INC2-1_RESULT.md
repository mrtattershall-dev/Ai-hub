# INC2-1 RESULT — handed its own accepted page and asked to extend it, the 1.5B returned the same file five times out of five. The loop protected increment 1 perfectly and built nothing.

2026-09-26, **$0** (local ollama, qwen2.5-coder:1.5b, same laptop, hub `c245ed1`). The test the
product goal actually needs: can the system **add increment 2 to the artifact it already got
accepted, without breaking increment 1?** Five seeded attempts at `farm-i2` — requested play
steps 1-5, protected steps 1-3 — starting from `NARROW-2_accepted_index.html`, the increment-1
page the independent gate retained. Same model, same seam protocol (v2), same play, same
evaluator, same acceptance policy.

## The answer, in one table

    boundary                                   INC2-1 (extend the accepted page)
    B1 artifact produced                             5 / 5
    B2 complete, natural stop                        5 / 5
    B3 contract clean (one fence, no prose)          5 / 5
    B3b the artifact CHANGED the file                0 / 5     <- the finding
    B4 reached execution                             5 / 5
    B5 passed the requested diagnostic               0 / 5
    B6 passed the protected steps                    5 / 5
    B7 accepted                                      0 / 5

    play, every seed          PASS 1,2,3   FAIL 4,5     (exactly the seeded page's own behaviour)
    disposition, every seed   PRESERVE_INCOMPLETE
    increment 1 afterwards    intact in all five - the file was never altered
    generation                67-71 s, prompt 1,399 tok, output 901 tok in ALL FIVE

**All five replies were the seeded page.** Three were byte-identical to it; the other two
differed by a single trailing newline and nothing else. Every seed spent exactly 901 output
tokens, and the five replies collapse to **two distinct texts, which differ from each other only
in that newline**. The instruction was not vague about wanting more: it asked for `p` to plant a
seed on the player's tile, `t` to advance a tick and grow crops, and planted tiles to be drawn.

**This is a replication, not a surprise.** A recorded finding from earlier work on this model
says whole-file rewriting made it echo its input 8 times in 10 where localized repair worked.
Handed a whole file and asked to return a whole file, it copies. At 5 of 5 on a real accepted
artifact, that failure mode is now the thing standing between this system and "keeps building".

## What the loop did right, stated separately from what it failed to do

The two halves of the product came apart cleanly here, and they should be read apart.

    the protection half   worked. Nothing was accepted (0/5). No regression was produced (the
                          protected steps passed 5/5). Increment 1 was never damaged. No
                          unverified candidate was reported as a completion. Five wasted
                          attempts cost the user nothing but time.
    the building half     did nothing. Zero increments were added. PRESERVE_INCOMPLETE five
                          times is the honest label for "the work is still there and it is not
                          finished", and five identical honest labels are still no progress.

**"Survives a restart, adds another feature without breaking the first ones" is NOT demonstrated.**
The "without breaking" clause holds trivially, because nothing changed. The "adds another
feature" clause failed outright.

## A $0 probe: is the echo caused by the interface or by the task?

Three seeds, the **same increment-2 instruction and the same seam**, with the current file NOT
placed in the prompt (a from-scratch page instead).

    seed   changed the file   play                      protected   disposition
    1      YES                passing []                FAIL        NO_VERIFIED_BASELINE
    2      YES                passing []                FAIL        NO_VERIFIED_BASELINE
    3      YES                passing [1,2,3,4]         PASS        PRESERVE_INCOMPLETE

    output 678-726 tok, 49-51 s, prompt 481 tok

These three rows are a **re-run** after the labelling fix below, so that the stored dispositions
are the ones reported here. The first run of the same three seeds gave the same three outcome
classes, but seed 1's text was not identical between the two runs (678 output tokens against
747): **a fixed seed does not make this configuration reproduce byte for byte**, which is worth
knowing before any conclusion is drawn from a single seeded attempt.

Written fresh, it wrote new code 3 of 3, and one attempt produced movement **and planting** —
step 4, `p` plants a seed on the player's tile and spends a seed — failing only the growth tick.

**So "it cannot write planting code" does not explain the echo.** That is what the probe
establishes, and the limit of it. It does not isolate the handed-in file as the cause: the two
configurations also differ in prompt length (1,399 vs 481 tokens) and in whether a prior file's
behaviour had to be preserved, the probe is three seeds, and it deliberately violates the
increment chain's own precondition by starting `farm-i2` from nothing. **The next step it argues
for is a localized-edit interface for later increments** — insert or replace a named region
rather than return the whole file — tested the same way, at $0, against this same accepted page.

## A mislabel the probe exposed, and the fix

Seeds 1 and 2 above started from an empty workspace, so the protected steps had **never** passed.
The acceptance policy restored `startRef` byte for byte, saw the protected check still failing,
and called it **RESTORE_FAILED — "damage detected and NOT undone, must halt"**. No damage
existed. The caller (my probe) had violated `startRef`'s documented precondition that it be a
state already verified for the task.

The direction of the error was safe — it halted — but the diagnosis was wrong in a way that
matters: a recovery controller reading RESTORE_FAILED goes looking for a regression to undo,
when what it actually lacks is a baseline.

    fixed    a new disposition NO_VERIFIED_BASELINE fires when the workspace IS the start commit
             byte for byte and the protected check still fails. It still halts, promotes nothing
             and counts nothing; it names the real condition, and carries a note saying so.
    fixed    RESTORE_FAILED now means only what it says: the bytes on disk are NOT the verified
             start's.
    fixed    the campaign summary counts NO_VERIFIED_BASELINE on its own line, so it can neither
             inflate the regression count nor vanish into the totals.
    fixed    the narrow harness records the surviving workspace verdict and surviving bytes, not
             just the disposition label.
    tested   acceptance 33/33 (new cell 5 builds an unsatisfiable protected spec and asserts
             NO_VERIFIED_BASELINE with IDENTICAL_TO_START bytes), narrowArtifact 34/34,
             recoveryController 30/30, playCheck 19/19, lessons 20/20.

**No earlier result changes.** No stored campaign or screen record contains a RESTORE_FAILED
disposition, so nothing previously reported was this case in disguise.

## The harness defect this cell found first

The very first attempt died instead of recording anything: the model's reply was byte-identical
to the seeded file, `git commit` exits 1 on an empty tree change, and the harness had no guard.
**The most informative outcome of the attempt was the one it could not write down.** Fixed:
`artifactChangedFile` is now a recorded boundary (B3b), the candidate commit tolerates "nothing
to commit" and nothing else, and test cell 7 drives the real harness with the real accepted page
as both the seed and the reply — no crash, B3b no, protected still passing, PRESERVE_INCOMPLETE —
with a control that alters one line and records B3b yes, so the boundary is not a constant.
(My first version of that cell seeded the bench positive control, which already passes steps 1-5,
so echoing it back passed for a legitimate reason and proved nothing. The cell now checks its own
fixture before asserting anything.)

## NOT established

- That the 1.5B cannot do increment 2. It was never given an interface suited to editing.
- That the handed-in file is the isolated cause of the echo (see the probe's limits above).
- Any rate: 0 of 5 and 3 of 3 are counts in small samples, not performance estimates.
- Anything about the 7B. Its cells stay **AUTHORIZED at $3 but HELD and not launched, $0 spent**
  (`NARROW-1_DEFINITION.md`). No paid run was launched for this record; everything here is $0.

Records: `INC2-1_seed1..5.json`, `INC2-1_run.log`, `INC2-1_gate.log`, `INC2-1_scratch_seed1..3.json`,
`INC2-1_scratch_run.log`.
