# S1 / S2 / S3 — specificity and reason topology

Preregistered in commit `3ad9d5a`, before any of this was run. The predicted obligation sets were derived
by reading frozen r2's `PREDICATES`, not by observing outcomes.

## Results

    S1  PRESERVING transformations still ADMITTED   58/59
          ADDED_COMMENT              10/10
          BLANK_LINE                 10/10
          TRAILING_WHITESPACE         9/10    <-- S1a, see disposition below
          TRAILING_WHITESPACE_SAFE   10/10    <-- S1b
          PARENTHESIZED_RETURN         9/9
          TRAILING_NEWLINES          10/10
    S2  DESTRUCTIVE lose EXACTLY the preregistered  60/60   HELD
    S3  graph reason topology == r2 failed set     119/119  HELD

## S1a — FAILED, and the intervention was the thing that was wrong

    Case          T04 (textwrap.dedent) / TRAILING_WHITESPACE
    Expected      ADMIT      — appending trailing spaces was labelled semantics-preserving
    Observed      REFUSE     — by frozen r2 AND by the graph, identically
    Investigation `dedent` contains a backslash line continuation at its line 44:
                      assert not line or line.startswith(margin), \
                  Whitespace after a line continuation is a Python SyntaxError. The transformation
                  introduced real syntax damage.
    Independent
    confirmation  CPython's own parser rejects the transformed source. Both gates were correct; my
                  labelling of the intervention was not.
    Disposition   INTERVENTION INVALID. RETAINED IN THE FILE AND IN THIS RECORD.

This is the most useful outcome in the run. The mistake was not found by adjusting the system until the
test went green - it was found because the disagreement forced an inspection, and the intervention turned
out to carry an independently identifiable defect. Both gates detected damage I had asserted was harmless.
That is specificity WORKING.

S3 held on this very case: the two mechanisms lost the same six obligations in the same order.

## S1b — the transformation I should have written

`TRAILING_WHITESPACE_SAFE` appends trailing spaces to every line that does NOT end in a continuation, so
it is preserving BY CONSTRUCTION rather than by my assertion. 10/10 admitted.

S1a is not replaced by S1b. Both run, both are reported.

## Why S2 and S3 are the load-bearing results

S2 (60/60) says I read the gate correctly, including the cascades: `SIGNATURE_UNCHANGED` and
`NON_EMPTY_BODY` are keyed by `ctx.fn`, so RENAMED destroys all three, and the prediction said so in
advance.

S3 (119/119) is the strong one. It is not "accept or reject?" but "which obligations died, which survived,
and which failures cascaded from another failure?" - reproduced case by case by a mechanism written later,
against a verifier written earlier, under interventions neither was fitted to.

## What this still does not establish

Both sides evaluate the same six predicates over the same `describe()` output. This establishes that the
generic entitlement algebra reproduces r2's bespoke combination across the whole lattice of failure
patterns, and that it does so under intervention. It does NOT establish that the graph re-derives the
primitives: a defect inside `describe()` would pass through both sides untouched and this experiment
could not see it.

## Apparatus defects this line of experiments has exposed so far

Every one was found by a contradiction leading to an ancestry inspection, and none was repaired by
loosening the test:

    aliased execution identities             (module:line collapsing distinct code objects)
    a vacuously successful prediction        (P3 held while every subject had fallen OUT)
    historical candidate truncation          (a 400-char prefix masquerading as the candidate)
    incorrect scope modelling                (pinning `implementation` on every ancestor)
    missing alternative-justification         (conjunctive supports under-admitting 65 subjects)
    an inert commit guard                    (threshold exempting its own test message)
    a patch script reporting a change it never made
    a supposedly harmless transformation that introduced a syntax error

The central result has survived all eight corrections.
