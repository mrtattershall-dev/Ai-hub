# INC4-1 RESULT — one named handler, four interfaces, twenty-three attempts, no accepted addition. The biggest measured effect was the length of my own instruction comment.

2026-09-26, **$0** (local ollama, qwen2.5-coder:1.5b, same laptop, hub `cd32a75` and later). Frozen
definition `INC4-1_DEFINITION.md`, written before any run, with its stopping rule. Task
`farm-plant`: p plants on an empty tile with seeds and spends exactly one seed; in every other case
it changes nothing. Movement is the protected set, measured separately. The spec was validated
against six controls and mutants before the model saw it (`farmPlantSpec.test` 12/12).

## Every cell

    cell                                            code      protected   requested   accepted
                                                    inserted  (movement)  (planting)
    A  fim, site given, task-derived comment (9 ln)   0/5        -/5*         0/5        0/5
    B  anchor, the model picks the site               1/5        0/1          0/5        0/5
    C  whole file, narrowed request                   n/a        5/5          0/5        0/5
    A2 fim, site given, ONE-LINE comment              3/3        0/3          0/3        0/3
    D  A2 + deterministic tail trim                   2/5        4/5          0/5        0/5

    * cell A produced an EMPTY completion on all five seeds (one output token), so no candidate
      was written and nothing was judged.

    totals   23 live attempts, 0 accepted, 0 passed the planting clause,
             5 regressions produced and 5 restored byte-exact

## The largest effect was my instruction comment, not the model

Three lengths of instruction inside the same five-line hole, same model, same seeds, same site:

    instruction in the hole            result
    4 lines (increment-2 text)         comment loops to the token ceiling, 0/5 inserted code
    9 lines (the farm-plant goal)      EMPTY completion, 5/5, one token, no candidate at all
    1 line  (the same rule, compressed) CODE in 3/3, in 13-15 seconds

**INC3-1 reported "zero of five inserted any code" for this configuration. That number was a
property of the comment block I put in the hole.** With the identical region and task compressed to
one line, the same model wrote code every time. This is exactly the confound named in review: a
region that permits a solution does not isolate model capability from prompt format, and I had been
reading my own prompt as a model limit. **Every INC3-1 and INC4-1 fim number is a statement about
model plus instruction shape.**

## A defect in my harness, and the run it voided

The infill's instruction comment was **hardcoded to increment 2** (planting and growth). Pointing
the harness at the narrower `farm-plant` task therefore still asked for the old feature. Found by
reading cell A's prompt token count. Fixed: the comment is now derived from the task's own goal and
recorded verbatim. **The first cell-A run is void and is kept as
`INC4-1_run-fim-VOID-wrong-instruction.log`, not reported as a result.**

## The model does not respect the infill boundary

Given the site and the one-line instruction, all three attempts wrote code **and then closed the
document inside the hole** (`</script></body></html>`), even though the suffix they were given
already contained those lines. The model's own template does support infilling — it renders
`<|fim_prefix|> … <|fim_suffix|> … <|fim_middle|>` when a suffix is supplied — so the suffix reached
it and it wrote past the boundary anyway. The consequence was a script closed early, the
observability seam orphaned after it, and a page exposing no state: all six steps failed, three
times out of three.

    added    trimInfillTail - the harness cuts the middle at the first line closing the script or
             document. Deterministic, never adds anything, recorded per run as fimTailTrimmed and
             in the assistance ledger as infillTailTrimmedByHarness.
    effect   cell D: the page survived in 4 of 5 instead of 0 of 3, and movement was preserved.
             Still 0 accepted.

## What the closest attempt actually did

Cell D seed 1 inserted five lines, preserved movement, and failed the planting clause. It wrote no
planting logic at all. It bound the **pre-existing broken functions** to keydown:

    document.addEventListener('keydown', plantSeed);
    document.addEventListener('keydown', advanceTime);
    document.addEventListener('keydown', harvestCrop);
    document.addEventListener('keydown', saveGame);
    document.addEventListener('keydown', loadGame);

Every key press now runs every handler, so pressing an arrow key also harvests: the state filled
with `{ crop: 'empty', stage: 0 }` tiles and the planting check failed. It also drifted into the
keys the request explicitly forbade, as comments and wiring, in 4 of 5 attempts.

**Narrowing the feature to one handler did not stop the scope drift, and it did not produce the
handler.**

## The other two interfaces, on the narrowed task

**Cell C, whole file: the echo is unchanged.** All five seeds returned the starting page
byte-identical, 901 output tokens each — the same signature as INC2-1. **A narrower request alone
does not lift it.**

**Cell B, the model picks its own site: unchanged too.** Four of five were still copying the whole
file into the FIND slot when the token cap hit; the fifth applied a whole-file FIND with an 8-character
replacement and deleted the page, which the policy restored byte-exact. Under this block protocol,
with this narrowed task, it selected no useful edit site in five attempts.

## Against the pre-registered readings

- **"One accepted addition"** — did not happen. Zero of twenty-three.
- **"Code that fails the clauses"** — this is what happened in cells A2 and D: real code, wrong
  behaviour, diagnosable. That is the recovery controller's proper input, and it is the first time
  the loop has had a behaviour failure to describe rather than an absence of work.
- **"No code at all"** — true only under my longer instruction comments, which is why that reading
  now belongs to the prompt, not the model.
- **"B fails while A or C succeed"** — untestable here, since none succeeded.

## The stopping rule, applied

The rule was: stop the localized-edit line if every cell produces zero accepted **and** no cell
inserts code. Code was inserted in three cells, so the line is not dead — but **zero of
twenty-three attempts produced an accepted functional addition, and I am stopping variant
proliferation here rather than trying a fifth interface.** What the evidence now supports as the
open decision is a **model choice**, which needs fresh authorization and is not taken here. The 7B
cells remain AUTHORIZED at $3, HELD, unlaunched, **$0 spent**.

## The protection half, separately, and its limit

Five regressions produced, five restored, every one byte-identical to the accepted start; zero
accepted; no partial splices. **This is no longer news** — it is the fourth run in a row to report
it — and it does not move the builder. The remaining PRESERVE_INCOMPLETE rows are mostly candidates
that preserved movement by doing nothing useful, which is not a safety result either.

## NOT established

- Any property of the model or of 1.5B models. Every number here is **this model under a named
  interface, instruction shape and decoding setting**, and the instruction shape alone moved the
  code-insertion count from 0 of 5 to 3 of 3.
- That a localized edit cannot produce this handler here. Untried: a shorter instruction with the
  existing broken functions removed from view, and a hole that cannot contain a document tail.
- Anything about site selection as a capability. Cell B measures one block format.
- That the manager works. **Every cell that produced code was handed its site and its step by me.**
  Legasus choosing and assembling such tasks itself remains unbuilt, and that is the gap between
  an assisted code generator and the autonomous builder.

Records: `INC4-1_DEFINITION.md`, `INC4-1_{fim,anchor,whole,fim1line,fimtrim}_seed*.json`,
`INC4-1_run-{fim,anchor,whole,fimtrim}.log`, `INC4-1_gate.log`, and the void run kept as
`INC4-1_run-fim-VOID-wrong-instruction.log`.
Tests: `farmPlantSpec.test` 12/12, `localEdit.test` 38/38, `narrowArtifact.test` 34/34,
`acceptance.test` 33/33.
