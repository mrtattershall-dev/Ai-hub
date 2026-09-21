# H-CLOSURE result — CL-1 FAILS, and the reason corrects the hypothesis
2026-09-21. Preregistration `H-CLOSURE_PREREG.md`, frozen before any perturbation.
`reach1.py` not modified; perturbations are runtime rebindings. Raw:
`legasus/out/reach1/closure_audit.json`.

## Scoring

    settled verdicts in ARM BASE                          29
    closure contains an undecidable-premise fact           3
    moved under OPEN-PERT                                  1

    CL-1  FAILS   only 1 of the 3 moved; the moved set is not the open set
    CL-2  HOLDS   the one that moved was CORRECT in BASE
    CL-3  RESPECTED  the control moved 1 case, overlapping the open set in 0 cases, and that
                     movement is reported as rule-dependence, NOT as openness

## Why CL-1 failed, which is the finding

The two open-frontier cases that did **not** move are **over-determined**. Each has an independent
derivation that reaches an admitted ground without using the undecidable rule:

    working_directory::path        `with working_directory(""):`   -> literal ''    (closed)
    parse_reenabled_issues         `param_default ''`, `literal None`, many falsy literals

The one that moved has no such branch. Every literal in its closure is `'include'`, which is truthy
and therefore cannot produce the verdict. Its **only** support was
`self._hash_cache_var.get()` — the `ContextVar`.

> **An open premise somewhere in a closure does not make a conclusion unjustified.** It only does so
> when no independent closed derivation also supports it. The word doing the work in the hypothesis
> is *required*, and a premise inside a redundant branch is not required.

My operationalization conflated *"the closure contains an open-premise fact"* with *"the verdict
depends on it"*. Those differ exactly when the conclusion is over-determined, and 2 of 3 cases were.

## The corrected predicate — and it is POST-HOC

    fragile  iff  no derivation supporting the verdict terminates in admitted grounds
                  independently of the undecidable rule

Computed mechanically over the same three cases, it matches movement 3/3. **That is fitting, not
confirmation**: the predicate was derived from the run it is scored on. It needs a fresh frozen set
before it means anything, and it does not rescue CL-1.

## CL-2 holds, and this is the specimen the whole design was for

    path_helper.py::get_path::path      BASE verdict REACHABLE

The verdict is **correct**: `_hash_cache_var` is declared `ContextVar(..., default=None)`, so the
traced value can be falsy. It is correct **because of a default the harness never read**. Under
OPEN-PERT it becomes UNKNOWN, which is the honest verdict given what the harness can establish.

So among settled, correct verdicts, a mechanical procedure separated one whose support was a single
undecidable premise from 28 that did not depend on one. **Correctness did not distinguish them;
support structure did.** That is the separation the experiment was built to look for, and it
survives on one case.

## CL-3, stated because it is the easiest thing to get wrong here

The control perturbation — refusing a rule whose premise **is** decidable at the site — also moved a
verdict, and shares zero cases with the open set. Perturbation sensitivity is therefore not evidence
of an open frontier, and is not reported as such anywhere in this result. The control was not inert,
so the design is not degenerate.

## Standing

One case. One target. One rule. The separation is mechanically available and was demonstrated, but
CL-1 as frozen failed and the repaired predicate is post-hoc. **H-CLOSURE is not established**, and
the claim that closure is the root was never under test here.

What this adds to the record is narrower and, unusually, is a correction to the hypothesis rather
than support for it:

> **Entitlement is a property of the derivation, not of the closure.** A conclusion with an open
> premise may still be justified by a redundant closed derivation, and a conclusion with a small
> tidy closure may rest entirely on an undecidable one.

Nothing installed. Sites #7 and #10 remain unrepaired; #7 is the support of the single specimen
above and is now load-bearing for three separate results.
