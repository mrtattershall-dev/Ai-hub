# CONSTRAINTS-2 DEFINITION — does automatically extracted context produce more completed additions on code nobody has tuned against?

Frozen 2026-09-27, **before any untouched page exists.** Written before the run, and the commit order
is the evidence.

## AUTHORIZATION, recorded before deployment

> "I authorize a 5 hour run on 1.5b on the cheapest build setup and authorize a cap of 10 dollars."
> — Micheal, 2026-09-27

**Cap: $10 total. Duration: 5 hours. Model: `qwen2.5-coder:1.5b`.**

**And the cheapest build setup for this question is the local box, at $0, so that is what runs.** The
reasons are specific, not frugality for its own sake:

    comparability   every prior record - TRANSFER-1, ASSIST-1..5, CONSTRAINTS-1 - was taken on the
                    local ollama build. Seeds do not reproduce across backends (recorded in
                    MODEL-CMP-1), so a GPU run would not be comparable with the control it needs.
    the speedup is  the A10G gave 11.9x on GENERATION. Verification is 13-24 s per candidate and runs
    smaller than   on this machine either way, so end-to-end the gain is far below 11.9x. Paying for
    it looks       it would buy less than it appears to.
    the question    does not need a bigger or faster model. It needs untouched pages and an honest
                    denominator.

So the authorization stands recorded and **unspent**. If the evaluation runs out of local throughput
before it has enough units to say anything, that is reported as a limit, and spending against this cap
becomes a separate decision with its own record - not something absorbed silently.

## The question

> On untouched programs, compare equal-sized prompts containing either ordinary nearby code or
> automatically extracted, task-relevant constraints. Hold the model, edit interface, budget and
> checks fixed. Measure completed additions and regressions.

**The milestone it serves: one useful addition caused by automatically selected guidance.** Not an
extractor that finds the right fact - that is already true and is not the claim. Not a prompt that
delivers it - that is plumbing. An addition that works, on a page nobody tuned against, because the
guidance was chosen automatically.

## PART 1 — the calibration, and its stopping rule

CONSTRAINTS-1 showed the interface can swallow the treatment: a block of comment lines makes more
comment lines the natural continuation, and at some sizes neither arm produces usable code. So one
bounded calibration runs first, **on the lamp page only**, which is the page I am permitted to tune
against.

    token budgets   {40, 80, 120}, and only these three
    arms            constraints, nearby
    seeds           1, 2, 3
    total           18 model calls, on one page, and then calibration STOPS

**The selection criterion, declared now so it cannot be chosen to suit the answer.** Pick the
**largest** budget at which **both** arms:

    1  DELIVER - the constraint arm renders at least one fact, and the nearby arm a non-empty window
    2  REACH THE GATE with at least 2 of 3 seeds - a containable candidate that gets judged

Ties break to the SMALLER budget. **If no budget satisfies both, the comparison is reported as not
runnable at this interface, and no evaluation is run.** That is a real outcome and it will be
published as one, not worked around by adding budgets until something passes.

After selection: **the rendering, the budget, the style and the strategy flag are frozen** and recorded
with the sha256 of every file that decides anything. No further tuning on the lamp page, whatever the
evaluation shows. Repeated tuning on the page that motivated the work cannot establish transfer.

## PART 2 — the evaluation, on untouched pages

    the pages       written by the local 1.5B from one-line requests, AFTER this definition and the
                    frozen rendering are committed. Not farm pages, not lamp pages. I read each one
                    only to (a) validate its baseline through its full sequence and (b) define the
                    requested addition and its checks - both the experimenter's job - and never to
                    change a rule. A rule that needs changing is a failure of transfer, reported as
                    one.
    the arms        none (no added context), nearby, constraints - all three, every page, same seeds
    held fixed      model, seeds, edit interface, scaffold, instruction, containment, token budget,
                    temperature, max tokens, and every check
    the only        the content of one block above the slot
    difference

### Counting, and the denominator

**Every assigned task is counted.** One task = one page x one arm x one seed. The denominator is the
number of tasks ASSIGNED, never the number that happened to get somewhere.

    counted in the denominator, always:
      the policy DECLINED to choose a site
      extraction delivered ZERO facts
      the model returned nothing
      containment REFUSED the completion
      the candidate was judged and rejected
      the candidate was accepted

**Delivery failures are reported separately AND kept in the denominator.** A cell where extraction
delivered no facts is not evidence about constraint guidance - and it is also not permission to shrink
the denominator. Both facts go in the table: `assigned`, `delivered`, `accepted`, and
`accepted / assigned` alongside `accepted / delivered`, with the second never quoted alone.

### What is measured on every task

    the arm, the page, the seed, the site rule chosen and its stated reason
    the facts DELIVERED: how many, which names, which verdicts, what was dropped
    the rendered request: the block, the full prompt head, its sha256, and the suffix's sha256
    token counts: the no-context prompt, this arm's prompt, the block, measured ON THE INFILL
      TEMPLATE, taken twice, and flagged if a reading did not reproduce
    the RAW completion and the EXTRACTED candidate, both kept
    refusals by structural reason
    the protected set's verdict, per sequence
    NO-OP candidates: a candidate that neither throws nor changes anything is its own outcome, counted
      apart from both "threw" and "completed"
    errors raised, and whether any was `Assignment to constant variable`
    regressions: protected-set failures, and whether each was restored byte-exact
    accepted additions, judged by the unchanged gate
    time: generation only, with the token oracle's time reported SEPARATELY
    dollars, and interventions by me (must be 0)

### Pre-registered readings

- **Constraints accepted more than nearby and more than none, across pages.** The strongest thing this
  design can support, and it would still be one model, one edit interface, one requirement shape.
- **No arm completes anything.** The likeliest outcome on this evidence, and it says the binding
  constraint is not which context is presented. That is worth knowing and will be reported plainly.
- **Both treatments below the no-context control.** Added context costs more than it gives at this
  interface. Also a result.
- **A rule has to change.** Transfer failed. The result stands as recorded; any revision is tested on
  pages neither version has seen.

**What no outcome here can establish:** anything about a larger model, another language, another edit
interface, or a requirement shape other than "one key triggers an effect". And no arrangement of these
numbers can show that the facts were *necessary* - the model was given the whole file in every arm, so
any effect is an effect of SURFACING what it already had.
