# H-CLOSURE — can correctness-by-accident be separated from justified correctness?
Frozen 2026-09-21, before any perturbation was run.

## The hypothesis

> A conclusion is entitled only when every premise required by its derivation has a dependency
> closure terminating in admitted grounds. An unresolved frontier may not be silently treated as
> satisfied.

## The discriminator, and why final answers cannot supply it

Do not search for wrong answers. Search for

    final answer CORRECT  +  required frontier OPEN
    versus
    final answer CORRECT  +  required frontier CLOSED

If these can be told apart, correctness-by-accident has been separated from justified correctness.
Site #7 is the model: its verdict is right because a `ContextVar`'s default happened to be null.

## The tautology guard, which is the whole difficulty

**Perturbation sensitivity is NOT the criterion.** Perturb any rule and verdicts move; that is
ordinary rule-dependence, not an open frontier. So frontier status must be fixed **independently of
the perturbation**, and it is:

    rule                       premise                                     decidable at the site?
    `.get` is a trusted        the receiver has dictionary semantics       NO - proven by
    primitive                                                              H-DEFINED's three
                                                                           indistinguishable pairs
    `a or b` excludes falsy    the expression is a BoolOp with a           YES - a syntactic
                               non-falsy right operand                     property of the node
    a literal is its value     the node is an ast.Constant                 YES - syntactic

Only the first has an undecidable premise, and that was established by a separate frozen experiment
before this one was written. **Frontier status is read off premise decidability, never off
sensitivity.**

## Method

`reach1.py` is **not modified** — it is a preserved specimen. The perturbation is applied by
rebinding `TRUSTED_TAILS` to the empty set at runtime, which makes the undecidable-premise rule
refuse instead of assert. The 60 frozen prospective cases are re-run unchanged.

    ARM BASE      as committed
    ARM OPEN-PERT the undecidable-premise rule refuses
    ARM CTRL-PERT the `or_fallback` rule refuses - a DECIDABLE premise, perturbed as a control

## Predictions

**CL-1.** Under OPEN-PERT, exactly the settled verdicts whose closure contains a name-matched
trusted `.get` fact change; every other settled verdict is unchanged.
FALSIFIER: verdicts without such a fact change, or verdicts with one do not.

**CL-2.** The affected verdicts are **correct in ARM BASE**. Correctness therefore does not
separate them from the unaffected ones, and frontier status does.
FALSIFIER: the affected verdicts are wrong in ARM BASE, which would make this ordinary defect
detection rather than a separation of accident from justification.

**CL-3 — the guard, scored explicitly.** CTRL-PERT also changes verdicts, and those changes are
**not** evidence of an open frontier, because that rule's premise is decidable at the site. If I
report CTRL-PERT's movement as openness, that is an apparatus failure and is scored as one.
FALSIFIER of the whole design: CTRL-PERT moves nothing, which would mean the two rules are not
comparable and the control is inert.

## Disposition

    CL-1 and CL-2 hold, CL-3 respected    a mechanical separation of accidental from justified
                                          correctness exists on this frozen set. One target,
                                          three rules, 60 cases. Not a general architecture.
    CL-1 fails                            frontier status does not predict which conclusions rest
                                          on unsettled premises; H-CLOSURE loses its discriminator
    CL-2 fails                            this is ordinary defect detection wearing new vocabulary

## Rules

No file modified; the perturbation is a runtime rebinding. Sites #7 and #10 stay unrepaired. The
claim that closure is the root is **not** under test here and is not adopted — only whether the
separation is mechanically available.
