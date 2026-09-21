# P-IDENTITY — can any non-analyst source fix the proposition? (frozen 2026-09-21)

Stage B showed `H-INFO verdict = f(R, P)` with `P` chosen by the analyst. This attacks that
degree of freedom directly.

> **The question.** Holding the program and the evidence fixed, can any source *not controlled by
> the analyst* select between independently plausible propositions, **before** the H-INFO
> analysis runs?

No new case selection: the three cases frozen at adbee47 are reused exactly, so no selection
freedom enters here.

## Why the obvious answer is refused in advance

"Take `P` from the docstring" merely relocates the problem: it asserts the docstring's authority
over the caller, the tests, the type, and the actual consumer. That authority is itself a claim
requiring evidence. The same objection applies to every single source below, which is why the
test is about **agreement between them**, not about anointing one.

## The candidate sources, and their frozen extraction rules

    S1 docstring     the first sentence of the function's docstring, or NONE
    S2 type          the return annotation as written, or NONE
    S3 name          the function's identifier
    S4 decision      the source line of the `if`, plus what its branch does
    S5 tests         every assertion in the repository's tests that names the function
    S6 consumer      what downstream code does with the value - specifically, whether it uses the
                     value in a way that assumes more than the value states

## The measurable, chosen so it needs no judgement from me

For each case there is a **decisive state** — the one whose classification decides whether a
collision exists:

    case 1   SET_unwritable   (Path returned; write would fail)
    case 2   API_ERROR        (False returned; the image may exist)
    case 3   EMPTY            (True returned; nothing was validated)

> For each source, **is the decisive state addressed at all?** Mechanically: does the source's
> text or behaviour constrain what should happen in that state?

This is checkable by reading each source for a mention of the decisive condition, and does not
require me to decide which `P` is correct — which is the very freedom under attack.

## Predictions

**I1.** For case 1, the sources **disagree**: `S1` (docstring: *"the Path ... or None if not
set"*) addresses only configuration and is silent on writability, while `S6` (consumer:
`with sp.open(mode) as f` — unguarded) **behaviourally assumes** writability. Two non-analyst
sources therefore support two different propositions, with opposite collision verdicts.
FALSIFIER: the sources agree, or one is silent in a way that leaves no genuine alternative.

**I2.** For case 3, **no source addresses the decisive state**. Neither docstring, type, name,
decision line, nor tests says what an empty arch list means. `P` is not underdetermined between
two candidates — it is simply **unspecified** by every non-analyst source available.
FALSIFIER: any source constrains the empty case.

**I3.** Taken together, no single source reliably fixes `P` across the cases — S1 is absent in
one case and silent in another, S5 may not exist, and S6 assumes without stating.
FALSIFIER: some source addresses the decisive state in every case in which it exists.

## Dispositions

    sources disagree or are silent      no non-analyst discipline fixes P from these sources;
                                        the verification problem does not begin with evidence
    one source is decisive everywhere   that source is a CANDIDATE authority - and its authority
                                        then needs its own justification, which this experiment
                                        does not provide

## Rules

No source is added after seeing the results. If a source is absent for a case, that is recorded
as **absent**, not as agreement. Proposition provenance (origin, authority, subject, scope,
consumer, exact claim) is **not** installed; it is a candidate structure and this experiment is
about whether anything can populate its `authority` field at all.
