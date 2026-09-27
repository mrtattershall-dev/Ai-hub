# CONSTRAINTS-1 CALIBRATION — the development page, and what it cost me to find out the apparatus was in the way

2026-09-27, **$0**, local. The lamp page (`legasus/bench/panel/baseline-as-delivered.html`,
sha `f9c49c2a8dd58599`) is used here as a **development case**, exactly as agreed: TRANSFER-1 stays
frozen, I am allowed to tune against this page, and **the evaluation of whatever comes out of it has
to happen on a third page that neither version has seen.** Nothing here is a result about whether
extracted constraints help. It is the record of getting the instrument to work at all.

## The question the instrument is for

> On untouched programs, compare equal-sized prompts containing either ordinary nearby code or
> automatically extracted, task-relevant constraints. Hold the model, edit interface, budget and
> checks fixed. Measure completed additions and regressions.

## What the extractor does, and the defect that shaped it

`server/codeFacts.mjs` reads a program and the site the frozen policy chose, and reports four things
kept deliberately apart: **structure** (what encloses the edit), **behaviour** (how the code already
writes each piece of state, with the line, as a worked example), **constraints** (what the
declaration forbids) and **uncertainty** (every write it could not resolve, every script that would
not parse, every call it declined to follow). It never receives a spec, a check or a diagnostic, and
its source is asserted to reference none.

**The first version returned ZERO constraints on the first real page it was pointed at.** It read
only the writes performed inside the chosen site — and this page's handler does not write state, it
calls `toggleLamp(index)`, which does. An extractor that reads only the statements in front of it
misses the state of any program organised into functions, which is most of them. It now follows calls
into functions the file declares, to depth 3, and every fact carries the path it was reached by. Two
more defects came out of its own tests: ranking by "tightest constraint" put `ctx` (const, written,
three calls away through the redraw) above `LAMPS` and the budget then truncated the fact that
mattered; and the quoted declaration omitted its keyword — `LAMPS = [...]` rather than
`const LAMPS = [...]` — dropping the one word that IS the constraint.

With those fixed it extracts, automatically and with no hint from me, the fact TRANSFER-1 lacked:

    LAMPS (line 14) is const: change it in place; assigning LAMPS throws.
    Existing code: LAMPS[index] = !LAMPS[index]; (line 31).

## THE APPARATUS FINDING, which is the actual content of this record

The comparison could not be run as designed. At a ~650-character budget:

    arm none          the TRANSFER-1 prompt. 67 output tokens, code, reached the gate.
    arm constraints    800 output tokens, hit the cap, and every one of them was more `//` prose:
                      "if you want to turn on a lamp, press the corresponding key" repeated to the
                      token limit. Containment found no code, so the candidate was REFUSED as EMPTY.
    arm nearby         800 output tokens, hit the cap, and wrote a NEW listener - REFUSED as
                      ADDS_A_LISTENER. The window contains `addEventListener`, and the model copied
                      it.

**A block of comment lines makes more comment lines the natural continuation.** That is the same
class as every other interface finding in this project: the shape of the prompt decides whether
anything usable comes back, independently of what the prompt says. Two consequences, and both are
limits on the experiment rather than results from it:

1. **The prose rendering cannot be used.** At a 150-character budget it dropped every fact and
   emitted nothing, making that cell silently identical to the control — which is how I found it:
   the cell behaved exactly like `none` (3 of 3 const-assignment errors, steps 1-4 passing). A
   treatment arm that quietly becomes its own control is the worst kind of defect, because the table
   still fills in. So the facts are now rendered **one line per fact**, which fits more of them in
   less space, and the style used is recorded in every run.

   The rendering also now **separates a fact from a proposal**, because they are different kinds of
   claim and only one of them is source-backed:

       FACT      LAMPS is declared `const` at line 14; existing code writes it as
                 LAMPS[index] = !LAMPS[index] at line 31. Both are readable in the file and can be
                 checked against it.
       STRATEGY  "change it in place rather than assigning to it" is a PROPOSAL consistent with those
                 facts. Whether it satisfies the task is not established by them and is not claimed.
                 It carries its own label, and it can be withheld, so facts-only and
                 facts-plus-strategy are separable rather than conflated.

   No ready-made fix is offered either way. Handing over `LAMPS.fill(false)` would make any success
   uninformative about the extraction, which is the thing under test.
2. **The nearby-code arm is a COMPETING CONTEXT STRATEGY, not a placebo, and I had it wrong.** I
   first wrote that a window containing `addEventListener` makes it an invalid control. It does not:
   pasting the code around the edit is what a person actually does, and *that strategy induced
   listener copying in this configuration* is a result about the strategy. The two arms are two ways
   of spending the same budget, and each one's failure mode belongs in the table. What the record
   still owes the reader is WHICH window was used and what was in it, so the outcome can be attributed
   to the content rather than to the size.

3. **Characters were the wrong unit.** Commented prose and indented JavaScript do not tokenise at the
   same rate, so equal character counts hand one arm more of the model's real context than the other.
   The frozen comparison matches on TOKENS, measured by the server that will read them
   (`num_predict: 0` returns `prompt_eval_count`), with each reading taken twice and interleaved -
   a cached prompt can report fewer evaluated tokens than it contains, and a number that will not
   reproduce is not a measurement.

4. **An empty fact block is an UNDELIVERED TREATMENT.** The 150-character cells are not evidence
   about constraint guidance; they are cells where no constraint was delivered. The rendering now
   returns `factsDelivered`, and any cell with zero is labelled undelivered rather than counted.

## What the sweep actually showed, at every budget it reached

Three seeds a cell, prose rendering, character budgets. The two 150 cells delivered NO facts, so they
are undelivered treatments, not data about guidance:

    budget  arm           delivered      outcome
    150     constraints   0 facts        undelivered. Behaved as the control: 3/3 threw
                                         `Assignment to constant variable`, steps 1-4.
    150     nearby        0 chars        undelivered, same as above.
    300     constraints   1 fact         3/3 reached the gate, 0 threw, steps 1-4 and 8. All three
                                         wrote `return;` - a no-op.
    300     nearby        172 chars      1 refused EMPTY, 2 wrote `drawPanel();`, 0 threw, steps
                                         1-4 and 8.
    450     constraints   ~2 facts       3/3 reached the gate, 0 threw, steps 1-4 and 8.
    450     nearby        438 chars      3/3 REFUSED EMPTY.
    650     constraints   530 chars      1 REFUSED EMPTY, 2 reached the gate at 5 steps, 0 threw.
    650     nearby        525 chars      1 REFUSED EMPTY, 1 REFUSED UNBALANCED, and 1 candidate that
                                         threw AT LOAD - 0 steps passing, the protected set failed,
                                         and acceptance RESTORED it byte-exact.

**Nothing here is a completed addition. Zero accepted in every cell.** The two arms did fail
differently, though, and that difference is about the strategies rather than about sizes: the
nearby-code arm is the only one that ever BROKE THE PAGE - one candidate threw at load, failed the
protected set, and was restored byte-exact - and it is the only one that copied an existing listener.
The constraint arm never produced a load-time throw at any budget.

The one change worth naming is
that a delivered const fact moved the failure from THROWING to DOING NOTHING: the model stopped
assigning to the constant and wrote `return;` instead. That is the same trade this project has already
recorded elsewhere - bounded authority buying refusal rather than correctness - and it is an
observation from a page I am tuning against, on three seeds, not a finding.

## The replication that came free

Every cell whose injected block was empty reproduced TRANSFER-1 on the CURRENT harness: steps 1-4
passing, 5-8 failing, `Assignment to constant variable`, `PRESERVE_INCOMPLETE`. That matters because
it means the control for the real comparison is taken on the same harness as the treatments, not
borrowed from a two-day-old run.

## What this record does NOT establish

- **Nothing about whether extracted constraints improve generation.** The extractor finds the right
  fact; that is a separate claim from presenting it helping, and this record does not support the
  second one. No arm has produced a completed addition at any budget.
- Nothing about which arm is better. The cells are 3 seeds, unmatched on tokens, on one page, with a
  rendering that has since been replaced.
- Nothing about a third page. Every observation here is on the page I am allowed to tune against.
- Nothing about the model's capability. This is an interface measurement, and the one clear reading
  is that at this interface a several-hundred-character comment block suppresses code generation.
