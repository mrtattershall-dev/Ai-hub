# STEP 1 — the destructive failure, its denominator, and a finding that reshapes the experiment

Owner's task, step 1: choose one real destructive failure from a recorded incident or reproducible
current behaviour, and establish the denominator behind "roughly a third" before it becomes an
experimental premise.

## THE DENOMINATOR, MEASURED

From `measurements/2026-09-11-setF/coder30b-setf-regress.json`, computed rather than quoted:

    model      goals   worked WHEN WRITTEN   worked AT END   REGRESSED   regressed/written
    coder30b     100            48                36             16           33%
    coder14b     100             4                 2              3           75%

**"Roughly a third" is 16 of 48, for ONE model in ONE set.** The denominator is *steps whose feature
worked when written*, not goals and not files. The 14B's 75% is over n=4 and is not a rate.

So the premise survives, narrowed: **33% of verified work was destroyed, n=48, single run.** And 16 is
small enough to inspect one at a time, which is what step 1 needs.

## THE SIXTEEN, SPLIT BY WHAT WAS ACTUALLY LOST

    SYMBOL LOST        9 of 16   a named function/method/export that existed and worked is GONE
    BEHAVIOUR CHANGED  7 of 16   the symbol is present; its behaviour regressed

    goal  1  s1_library.js    l.titles is not a function
    goal 10  s10_desk.js      library.titles is not a function
    goal 30  s10_desk.js      library.getLoans is not a function
    goal 41  s1_library.js    l.overdue is not a function
    goal 50  s10_desk.js      library.overdue is not a function
    goal  4  s4_markdown.py   module s4_markdown_mod has no attribute to_html
    goal 24  s4_markdown.py   module s4_markdown_mod has no attribute to_html
    goal 44  s4_markdown.py   module s4_markdown_mod has no attribute to_html
    goal 62  s2_logs.py       module s2_logs_mod has no attribute between

**`s4_markdown.py::to_html` was destroyed THREE separate times** (goals 4, 24, 44), each with its own
commit state. A recurring specimen, not a one-off, and the strongest single candidate.

Corroborated independently from a different set - `measurements/2026-09-10-14b-vs-32b/NOTES-live.md`:
`peek()` was added inside the Queue class at `e850e81` and PASSED when written; later checkpoints from
unrelated goals rewrote the file without it. Same class, different run, git-identified.

## THE FINDING THAT RESHAPES THE EXPERIMENT

**THE HUB ALREADY DETECTS THIS. IT WARNS AND WRITES ANYWAY.**

`server/agent.js:36` imports `lostDefs, lostExports, defCounts` from `defNames.js`. On a write that
drops an export, `agent.js:3546`:

    syntaxNote += `⚠️ This ${tool} REMOVED what ${args.path} exported: ${gone.join(', ')} ...
                   Put ${them} back in module.exports.`
    pushStep(run, { type: 'note', text: `${tool} ${args.path} dropped export(s) ...` })

A sentence appended to the model's prompt and a note in the run record. **The write proceeds.**

So for all 9 SYMBOL LOST cases:

    the agent was PERMITTED to write the file          - permission was never in question
    the loss was DETECTED                              - the detector already exists
    the write happened anyway                          - detection does not decide

**A LEGASUS AUTHORITY TOKEN MINTED FROM "THIS AGENT MAY WRITE THIS FILE" WOULD HAVE PREVENTED NONE OF
THE SIXTEEN.** This is the owner's caution arriving as a measurement rather than a worry: permission
to write and evidence that the write is acceptable are different propositions, and this incident class
is entirely about the second.

## WHAT THAT MAKES THE EXPERIMENT

The credible baseline (step 3) is not a new gate. It is **making the detection that already exists
decide instead of advise** - and the hub's own ledger already records this pattern twice
("fix the deciding path, not the advisory one"; "detects everything, corrects nothing"; a 7B ignored
24 nudges).

Stated before building, so it cannot be claimed afterwards:

> **PREDICTION: the small baseline prevents most of the 9 SYMBOL_LOST cases. Legasus adds nothing to
> those on its own.**

Legasus's possible contribution is narrower, and is the only part worth testing:

1. whether the preservation obligation can be made part of what MINTING REQUIRES, so a write cannot
   be authorized at all without evidence that verified symbols survive - as against a refusal bolted
   beside the write;
2. **ALTERNATE ROUTES**, which is where a bolted-on refusal historically fails here. `agent.js:3390`
   notes the before-image is captured for write/edit, and the ledger records `append_file` escaping
   the duplicate guard for exactly that reason - 20 appended copies survived while the guard refused
   27 times in the same run;
3. the **7 BEHAVIOUR_CHANGED** cases, which a symbol-existence check cannot see at all.

If the baseline wins on (1) and (3) and only (2) survives the removal control, the honest conclusion
is that Legasus contributed route-completeness and not authority - which would still be a production
case, but a much smaller one than "the hub should consume the calculus".

## NOT DONE

Step 2 (trace the complete action path: requester, authorizer, evidence required, write site,
bypass routes) is next and is MEASUREMENT. Steps 3-5 get a preregistration after it, because the
bypass structure determines what the baseline has to cover and therefore what the comparison means.

Nothing is integrated. Trunk is untouched. The specimen is frozen at `SPECIMEN_FREEZE.md`.
