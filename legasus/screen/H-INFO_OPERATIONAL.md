# H-INFO, operational form — amended by what PyTorch demonstrated (2026-09-21)

Two amendments earned by evidence, and three hypotheses that are not.

## Amendment 1 — the domain is the REACHABLE state space (earned)

The mathematical core is unchanged:

    R(s1) = R(s2)  and  P(s1) != P(s2)   =>   no g exists with P = g o R

But the operational condition must quantify over states the program can actually produce:

    for all s1, s2 in S_reachable :  R(s1) = R(s2)  =>  P(s1) = P(s2)

**Earned by demonstration, not argument.** `validate_cuda("")` collapses a real distinction over
its nominal input domain. Over the program's reachable domain the state does not exist:
`get_env` is `os.environ.get(name) or default`, so an empty value becomes `"8.9"` before the
decision ever sees it. I had produced the collision by calling the function directly.

Two consequences, stated as sentences because they are what the retraction cost:

> **A distinction need not be preserved if the program has already made one side of that
> distinction unreachable.**
>
> **A local counterexample is not a program counterexample until its decisive state is
> reachable.**

### What this does to every detector in this branch

A local detector can establish:

    there EXISTS an input under which this computation collapses a relevant distinction

It cannot thereby establish:

    the running program can produce that input

**Reachability is a separate entitlement edge**, and no detector here has ever carried it.
SCREEN-1, A2/B2, and the Stage B diagnosis all reasoned at the function level and reported at
what read as the program level. That is the same substitution in a new place.

## Amendment 2 — contract claims and world claims are different propositions (earned)

PyTorch's own test asserts `APIError -> False` for `local_image_exists`. It is authoritative, and
it settles:

    P_contract   "this function should return False when the Docker API raises"

It does not settle:

    P_world      "the image is absent"

The same `False` represents `ESTABLISHED_ABSENT` and `QUERY_FAILED`. A source can be fully
authoritative over the contract while saying nothing about whether the contract represents the
world faithfully. **Finding an authoritative source does not, by itself, fix the proposition** —
different sources may be legitimately authoritative over *different* claims.

## Hypotheses — recorded, standing NONE, nothing installed

**H-GRAPH.** There may be no unique `P`. A system may contain a graph of related propositions —
`P_contract`, `P_consumer`, `P_world`, `P_safety`, `P_user_visible` — with different evidence and
different authorities, and "what is the proposition?" may be the wrong question. *Suggested by
case 1's disagreeing sources and case 2's contract/world split. Untested.*

**H-SUBST.** The recurring failure may not be lossy representation at all, but:

    evidence establishes P1; downstream reasoning proceeds as though it established P2

with information loss, reachability, causal attribution and partial criterion implementation as
four different *causes* of the same substitution. The instances:

    attempted modification  -> actual modification        (the no-op repair)
    warning absent          -> warning suppressible       (first D4 apparatus)
    one clause satisfied    -> criterion satisfied        (X1)
    partitions differ       -> comparison instantiated    (first H-INFO run)
    local input possible    -> program state reachable    (case 3, retracted)
    API returns False       -> world state is absent      (case 2)
    path configured         -> write will succeed         (case 1)

*Seven instances, all retrospective, all found by the same author. H-SUBST has made no
prospective prediction and H-INFO may be a special case of it. Neither claim is adopted.*

## The next attack, named and not started

Amendment 1 creates a new burden: a screener must establish **reachability**. So attack that.

> **Can reachability of a decisive state be established by any non-analyst, non-executing
> source — and how far from the decision site does the evidence lie?**

Case 3's reachability was settled by a guard **two call hops and one file away** from the
decision. If that distance is unbounded in general, then local screening can never license
program-level claims, and the correct output of a local detector is a claim explicitly scoped to
the function — not the program.

That is a measurable question on the already-selected cases, and it is the one that most
constrains what any future screener is entitled to say.

## Standing, unchanged

H-INFO: one discriminating result against H-RICH on an author-built construction; **not**
discriminated on a natural target; now operationally narrowed twice. The mathematical core has
never been attacked and is not what is in doubt.
