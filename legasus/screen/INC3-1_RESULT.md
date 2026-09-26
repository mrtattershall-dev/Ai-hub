# INC3-1 RESULT — a bounded edit made the program change where a replacement file could not, and still built nothing. This 1.5B failed to select useful edit sites under the tested anchor protocol. Twenty attempts, zero accepted, ten regressions all rolled back byte-exact.

2026-09-26, **$0** (local ollama, qwen2.5-coder:1.5b, same laptop, hub `17ac589`). Frozen
definition: `INC3-1_DEFINITION.md`, written before any run. Held identical to INC2-1: the model,
the machine, the task (`farm-i2`), the starting file (`NARROW-2_accepted_index.html`, the accepted
increment-1 page), the requested and protected steps, the declared play, the independent evaluator
and the acceptance policy — the last three through a **shared** `judgeCandidate.mjs` called by both
harnesses, with `narrowArtifact.test` 34/34 over that extraction as the evidence it changed nothing.
**Changed: only what the model is asked to emit.**

## Four cells, twenty attempts

    cell                         E1 edit  E1c inserts   E2b        E4 changed  E6 protected  E7 requested  E8
                                 produced non-comment   localized  program     (steps 1-3)   (steps 1-5)   accepted
    INC2-1 whole file (prior)      5/5       -             -          0/5          5/5           0/5        0/5
    anchor, model picks site       3/5      3/5*          0/3         3/5          0/5           0/5        0/5
    anchor, replicate              3/5      3/5*          0/3         3/5          0/5           0/5        0/5
    fim, harness region 42 lines   5/5      3/5           n/a         5/5          1/5           0/5        0/5
    fim, harness region 5 lines    5/5      0/5           n/a         5/5          5/5           0/5        0/5

    * counts a line that is not a comment. In the anchor cells those "lines" were a stray
      `=======` separator (twice per run) and one paragraph of the instruction text. **No anchor
      attempt inserted JavaScript.** The measure separates comments from everything else; it does
      not check that what remains is code, and it nearly misled me into reporting prose as code.

    totals over 20 runs   accepted 0    regressions produced 10    restored 10 (all
                          IDENTICAL_TO_START)    hit the 4,000-token ceiling 7

**The two fim rows stay apart and are never pooled.** They differ in what the harness took
responsibility for - 42 lines including the movement wiring, against 5 lines that leave it intact -
and they fail differently: the wide region produced code and lost movement, the narrow one
preserved movement and produced no code. Averaging them would hide both.

## What each cell actually did

**anchor — it did not select a useful edit site in any of the ten attempts.** On every attempt it copied the **entire
file** into the FIND slot: 3,871 characters, 115 lines, the whole page, `findIsWholeFile = true`.
Three attempts finished that copy and then supplied as the replacement either the literal
`=======` separator (8 characters) or a paragraph of the instruction text (526 characters). So the
applied "edit" **deleted the page**. Two attempts were still copying the file into FIND when the
reply ended, leaving an unclosed block that was never applied. The copying behaviour from INC2-1
survived the change of interface; it simply aimed at whichever slot was available.

**The replicate reproduced it exactly.** Same five seeds, same two incomplete copies, same
replacement sizes (3871→526, 3871→8, 3871→8), same three rollbacks. This behaviour is stable, not
a draw.

**fim, 42-line region — real code, wrong semantics, and a harness choice that confounds the
protected failures.** Three of five infills contained actual JavaScript (30, 34 and 53 non-comment
lines). The best (seed 5) wrote `plant`, `grow` and `update`, then wandered unprompted into
increments 3 and 4. It failed because its planting required the tile to **already** contain a crop,
so planting on an empty tile did nothing. Four of five failed the protected steps, and those four
failures are **confounded by my region choice**: my region ran from `plantSeed` through the last
listener and swallowed `addEventListener('keydown', movePlayer)`, so an infill that did not re-add
it lost movement. **That does not establish the model contributed nothing to them** - re-adding the
wiring was within reach of the reply, and one seed (5) did keep movement working under the same
region. The cell cannot separate the two causes, which is why the corrected region was run as its
own cell rather than as a replacement for this one.

**fim, 5-line region — the protected steps pass because nothing happened.** With movement wiring
left intact, the protected steps passed 5 of 5 — and **zero of five infills inserted a single line
of code.** Four filled the 4,000-token ceiling with one self-contradictory comment repeated for up
to 20,570 characters and seven minutes ("The player can't move into a tile that has a crop planted
there that is at stage 3 and is not at stage 3"). The fifth wrote two comment lines about saving
and loading. **This is the INC2-1 reading again, one level down: a perfect protected score bought
by doing nothing is not a safety result, it is an absence of work.**

## Against the pre-registered readings

- **"The interface was the obstacle"** — partly, and only for one boundary. E4 changed-the-program
  went from 0 of 5 to 3 of 5 to 5 of 5, so the whole-file interface was what stopped the program
  changing at all. **But in the anchor cells the change was destruction**, so E4 must always be
  read next to E2b and E6.
- **"The interface was part of the obstacle"** — this is the closest reading for the fim cell:
  the program changes, real code sometimes appears, and the feature is still not implemented.
- **"The interface was not the obstacle"** — this holds for the anchor cell on its own terms: under
  this block format the failure moved to producing a usable edit at all, so removing the whole-file
  interface did not by itself unblock the work.
- **The difference between the cells localizes the difficulty.** `anchor` fails where `fim`
  sometimes produces code. CORRECTED after review, because the first wording claimed far more than
  the evidence: what this establishes is that **this 1.5B failed to select useful edit sites under
  the tested anchor protocol**, and that it sometimes wrote code when a site was supplied. It does
  NOT establish a property of the model or of its size. One block format, one system prompt, one
  temperature, one file, five seeds and one replicate were tried; a different edit format, a
  different decoding setting, or a different way of presenting the file are all untested and any
  of them could change the result.

**E7 is 0 of 20.** No cell, no region and no seed implemented planting and growth. **The localized
edit did not turn INC2-1's finding into a capability.**

## The safety half, stated separately

    regressions produced        10 of 20 (the anchor deletions and the lost-movement infills)
    restored                    10 of 10, every one IDENTICAL_TO_START
    accepted                    0 of 20 - nothing unverified was ever promoted
    partial splices on disk     0 - no block is applied unless EVERY block is applicable
    ambiguous or absent anchors  refused by construction, never guessed at

This is the first run in this line of work where the loop **produced real destruction on live
attempts and rolled all of it back byte-exact**. It is a genuine result for the protection
mechanism and no result at all for the builder.

## Cost and stutter, as product requirements

Seven of twenty runs hit the token ceiling, generating for 5.5 to 7.2 minutes each to emit nothing
usable. Against roughly 80 seconds for a whole-file reply, **the edit interface made the model
slower and more repetitive, not faster.** On a typical desktop that is the difference between a
pause and an abandoned session, so it counts against this protocol as a product path, separately
from its zero acceptance.

## Instrument changes made because this run nearly misreported itself

    added    rec.edit.localization + E2b editIsLocalized - per block findChars, findLines,
             findFractionOfFile, findIsWholeFile, netChars. Without it, "changed the program" read
             as "made a localized change" when the program had been deleted.
    added    nonCommentContent + E1c editInsertsNonComment, with its limit written into the
             function: it separates comments from everything else and does NOT establish that the
             remainder is JavaScript. The anchor cells are exactly why that caveat exists.
    added    test cell 9 reproduces the real failure (whole-file FIND, empty replacement) and
             asserts E1/E2 yes, E2b no, E4 yes, E6 no, RESTORED.
    added    test cell 10 pins the 5-line region and proves a correct edit still reaches RETAIN
             through it. WHAT THAT CONTROL ESTABLISHES, precisely: the region PERMITS a solution
             and the gate can be passed through it. It does NOT isolate model capability from
             prompt format, decoding settings or interface fit - a zero in that cell is a fact
             about this configuration as a whole, not about the model alone.
    note     E1c was measured post-hoc for these records. It is a deterministic function of the
             stored reply, so the numbers are what a re-run would have recorded; the anchor cell
             WAS re-run under the instrumented harness and reproduced exactly.

## The assistance ledger, as promised

Both edit cells: the harness supplies the **edit format**; the feature is **not** split into
implementation steps; the observability seam already exists in the starting file. The fim cells
additionally get **the site, chosen by me after diagnosing the page**, and an **instruction
comment** inserted at the top of the hole, recorded verbatim in every record. **The fim numbers
therefore measure the model plus my decomposition, and the one cell that asked the model to choose
its own site scored zero JavaScript in ten attempts.**

## NOT established

- That a localized-edit interface cannot work here. A smaller unit of work - one named handler
  with a stopping rule - has not been tried, and it is what my own pre-registered reading points
  to. INC4-1 does exactly that.
- Any property of the model or of 1.5B models in general. Every claim here is about **this model
  under these protocols, formats and decoding settings**.
- Any rate. These are counts over five seeds per cell.
- Anything about a larger model. The 7B cells remain **AUTHORIZED at $3 but HELD and not launched,
  $0 spent** (`NARROW-1_DEFINITION.md`). No paid run was launched for this record.
- That the game advanced. It did not. Increment 1 is still the only accepted increment.

Records: `INC3-1_DEFINITION.md`, `INC3-1_{anchor,anchor2,fim,fimsmall}_seed1..5.json`,
`INC3-1_run.log`, `INC3-1_run-fimsmall.log`, `INC3-1_run-anchor2.log`, `INC3-1_gate.log`.
Tests: `localEdit.test` 38/38, `narrowArtifact.test` 34/34, `acceptance.test` 33/33.
