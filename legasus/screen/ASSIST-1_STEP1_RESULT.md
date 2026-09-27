# ASSIST-1 step 1 — PASSED. The local 1.5B produced a working, independently verified, error-free planting handler. It took seven human interventions, and that list is now the specification for step 2.

2026-09-27, **$0**, local only, nothing deployed. Step 1's question was narrow: **does a ceiling
exist — can the chosen model produce an accepted handler with assistance a person tuned?** It does.

## The outcome

    round  intervention added                      attempts  accepted  regressions  code inserted
      1    (I1-I5, carried in)                        5          0          0            2 of 5
      2    I6 the hole becomes the handler BODY       5          0          4            5 of 5
      3    I7 trim at the suffix boundary             5          3          0            5 of 5

    totals  15 attempts, 3 accepted, 4 regressions all restored byte-exact, 766 s of generation,
            1,247 s end to end, 7,524 output tokens, $0.00

**The three accepted candidates are byte-identical** (sha `c6c8553a61aa`). What the model wrote:

    if (!tiles[k] && inventory.seeds > 0) {
        tiles[k] = { crop: 'wheat', stage: 0 };
        inventory.seeds--;
    }

Four lines. The empty-tile guard, the seed guard, the crop, and the seed spent **inside** the guard —
which is exactly the clause the 7B got wrong when it had its decrement outside the guard.

## Verified independently, three ways plus the strict spec

    playCheck directly, 6-step spec      OK, passing [1,2,3,4,5,6]
    the automatic diagnostic             OK, 6/6 pass
    the independent evaluator            requested PASS, protected PASS
    the STRICT spec (no error at any     passing [1,2,3,4,5,6,7], failing none, ERRORS 0
    point in the run)
    the independent evaluator, strict    requested PASS

**All three invocation paths agree, and it is error-free under the stricter specification too.** This
is the first accepted functional addition in this programme that is also error-free — the increment-1
page that everything was built on never was.

## What made the difference, in order of size

1. **I6 — dividing the work smaller.** Round 1 failed identically five times: the model bound the
   file's own `plantSeed` to keydown, and that function sets stage 1 and never spends a seed, so no
   wiring could satisfy the check. Making the hole the **body of one handler** — key filter, tile key
   and redraw supplied — moved code insertion from 2 of 5 to 5 of 5.
2. **I7 — a boundary the model would otherwise cross.** Round 2 inserted code every time and broke the
   page 4 times in 5, because it ran past a small hole by re-emitting the lines that follow it: 15 to
   147 lines where 4 were wanted. Cutting the infill at the first line of the suffix took the same run
   from 0 accepted to 3.
3. **The verified baseline (I5).** Movement was preserved 5 of 5 in every round here. Every earlier
   increment-2 experiment inherited a page that threw on each keypress; removing that is why an
   error-free result was reachable at all.

## The intervention ledger — the specification for step 2

Every one of these is a decision I made. **Step 2 is Legasus making them.**

    I1  choose the unit of work: one named handler with a negative clause, not a feature
    I2  choose the interface: a hole in the file rather than a whole-file return
    I3  choose the instruction's SHAPE: one line, not nine
    I4  recognise that the model closes the document, and cut there
    I5  validate the starting page through the full sequence before building on it
    I6  when the model reuses a broken existing function, shrink the hole to the logic itself
    I7  when the model runs past a small hole, cut at the boundary it crossed

I4, I6 and I7 share a form worth naming: **observe the specific way the output overshot its slot, and
move the boundary to match.** That is a rule a system can apply, not a taste judgement. I1, I2 and I3
are choices about decomposition and framing. I5 is a discipline about baselines.

**Step 2's bar:** reach an accepted, independently verified handler with **zero interventions from me**,
and report its own counts against the 15 attempts, 766 generation seconds and 7 interventions here.

## What this establishes, and what it does not

- **Established:** this 1.5B, locally, at $0, can produce a working planting handler that passes an
  unchanged independent gate and the stricter no-error spec, under assistance a person tuned. The
  ceiling exists.
- **Established:** the earlier "no accepted handler" results were about the configurations tried, not
  about the model. **I was closer to right when I said the constraint was our apparatus and our
  specification than when I said it was the model — but only the specific claim is supported: under
  this assistance, this model does it.**
- **NOT established:** that the model would do it with less assistance, or that any of these seven
  interventions is necessary. Only the ones removed and retested would be.
- **NOT established:** anything about a second increment, an unfamiliar task, or a failure class the
  catalogue does not cover.
- **NOT autonomy, at all.** Seven human decisions produced this. That is the entire point of counting
  them, and step 2 is the test that matters.

## Cost and effort, for comparison in step 4

    attempts                  15 (5 per round, 3 rounds)
    accepted                  3, all byte-identical
    regressions produced      4, all restored byte-exact by the unchanged policy
    generation                766 s total, 51 s mean per attempt
    end to end                1,247 s total, 83 s mean per attempt
    output tokens             7,524
    dollars                   $0.00
    human interventions       7 (I1-I5 carried in, I6 and I7 added during this step)
    human wall-clock          three tuning rounds, each requiring me to read the failures and decide

Records: `ASSIST-1_DEFINITION.md`, `ASSIST-1_r{1,2,3}_seed{1..5}.json`, `ASSIST-1_run-r{1,2,3}.log`,
`ASSIST-1_gate.log`, `ASSIST-1_accepted_index.html`, `ASSIST-1_scaffolded_start.html`.
Harness frozen per `AUDIT-1_RESULT.md`, plus I7 (`trimInfillTail` now takes the suffix), which is
recorded there as an intervention rather than a silent change.
