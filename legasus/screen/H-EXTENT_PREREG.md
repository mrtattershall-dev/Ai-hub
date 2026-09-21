# H-EXTENT — replace the scope rank with domain, quantifier, membership and coverage
Frozen 2026-09-21, before the replacement was built or run.

## Why the rank is deleted rather than patched

The shadow run showed `rank(SAMPLE) < rank(FUNCTION)`, so a sample claim backed by single-function
evidence passed the obligation gate. A product lattice `(structural scope, coverage)` would still be
wrong, because legal promotion also depends on the **quantifier**.

One established witness inside one function legitimately supports

    ∃ f ∈ R : X(f)

and cannot support

    ∀ f ∈ R : ¬X(f)

**Same evidence, same structural location, opposite verdicts.** So no rule of the form
`evidence_scope >= claim_scope` can be correct, at any dimensionality. The obligation object is

    claim domain  ×  claim quantifier  ×  observed extent  ×  coverage evidence

and a scalar rank collapses it — which is itself an illegal compression under the law
`legaknow/monotonicity.mjs` already states.

## The replacement model

    Claim     { domain, quantifier ∈ {EXISTS, FOR_ALL, NONE, POINTWISE}, predicate }
    Evidence  { observed[], membership_established[], coverage ∈ {PARTIAL, EXHAUSTIVE, UNKNOWN} }

Compiled obligations, not ranks:

    EXISTS     one x with membership in the domain established AND the predicate established for x
    FOR_ALL    EXHAUSTIVE coverage of the domain, plus the predicate for every observed x;
               or a general argument covering the domain
    NONE       EXHAUSTIVE coverage of the domain, plus no observed x satisfying the predicate.
               Zero observations without coverage is worthless - SCREEN-1 in one line.
    POINTWISE  the predicate established for the named x

Comparison returns **three** values: `LICENSES`, `DOES_NOT_LICENSE`, `INCOMPARABLE`. There is no
total order to fall back on.

## Predictions

**Q-1 INCOMPARABILITY.** A repository-wide sample and an exhaustively analysed function are
`INCOMPARABLE` — neither licenses the other.
FALSIFIER: the model orders them.

**Q-2 ANTI-REFUSAL, and the most important row.** One function-located witness **does** license a
repository-level `EXISTS` claim, provided membership in the repository is established.
FALSIFIER: it is refused. A naive "never widen structural scope" fix would look safe here while
destroying legitimate existential reasoning, and Q-2 is what catches that.

**Q-3.** The *same* witness does **not** license a repository-level `FOR_ALL` or `NONE` claim.
FALSIFIER: either is licensed.

**Q-4.** Exhaustive coverage of a frozen sample licenses `FOR_ALL` over **that sample** and not over
the population it was drawn from.
FALSIFIER: the population claim is licensed, or the sample claim is refused.

**Q-5 — the shadow specimen, with its reason frozen in advance.** Removing the evidence that
observed cases belong to the claimed domain must narrow the strongest licensed claim, and the reason
must be the frozen one: **`EXISTS` over a domain requires established membership in that domain**,
so the licensed claim's domain falls back to the observed set. This must follow from the compiled
obligation, **not** from the specimen being programmed into a test.
FALSIFIER: the removal is inert, as it was under the scalar lattice.

## Disposition

    Q-1..Q-5 hold        the replacement expresses what the rank could not. Not installed;
                         `entitlement.gate_obligation` keeps its defect as a preserved specimen.
    Q-2 fails            the replacement is a refusal machine and is worse than the defect
    Q-5 inert            the replacement reproduces the original failure and is abandoned

## Language-neutral certificate, recorded as the seam

The branches are not merged and will not be. The certificate is the interface, and its shape is
recorded here so both sides can agree on it independently:

    claim { domain, quantifier, predicate }
    evidence_refs[]
    obligation { passed, unmet[] }
    derivation { passed, open_frontier }
    measurement { passed, instrument }
    licensed_narrowing
    NO cause field, at any level

Python emits it; a JavaScript `legaknow` could validate and mint from it without either side
importing the other's internal assumptions.

## Rules

Nothing installed. `entitlement.py`, `reach1.py` and `hadmission.py` are unchanged, and census sites
#7, #10 plus the scope-lattice defect remain as specimens. If Q-2 fails, the replacement is reported
as worse than what it replaces.
