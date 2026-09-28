# World identity — in what world is an observation's authority valid? Frozen 2026-09-21.
Settles S5. **Nothing is implemented until this measurement is run.**

## Why "add repository to the context" is not the experiment

S5 showed the world check is inert because `token.context` carries
`{evidence_scope, examined, domain_size}` and no repository. The tempting repair is to insert one.
That risks collapsing three things that are not the same:

    claim domain         what population the proposition ranges over
    observation context  the circumstances under which the evidence was produced
    evidence extent      the portion of the domain actually examined

A detector may execute **in repository R** while examining **only sample S** and establishing a
proposition **about function F**. Three coordinates, one currently missing field.

> **The question is not "what should we add". It is: what is the MINIMUM set of coordinates whose
> equality is necessary for an observation's authority to transfer?**

## Method — a search, not an assertion

Candidate coordinates: `repository`, `claim_domain`, `evidence_extent`, `procedure`.

For every subset `C` of those, a world check compares only the coordinates in `C` and is evaluated
against the arms below. A subset **qualifies** if it gives the required verdict on all of them. The
result is the set of **minimal** qualifying subsets.

## The arms

    D1  same evidence, same claim, DIFFERENT repository          must NOT transfer
    D2  same repository and procedure, DIFFERENT claim domain    must NOT transfer
    D3a same repository and claim domain, token established over
        a WIDER extent than the witness needs                    MAY transfer (narrowing is free)
    D3b same repository and claim domain, token established over
        a NARROWER extent than the witness needs                 must NOT transfer (widening needs
                                                                 its own authority)
    D4  every coordinate identical                               MUST transfer   <- anti-refusal

**D4 is the anti-refusal control.** Without it the answer "compare everything" wins trivially and
the runtime becomes unable to reuse anything.

**D3a is the arm that discriminates.** If `evidence_extent` is an **equality** coordinate, any
difference blocks transfer, including legitimate narrowing — so D3a fails. Extent therefore cannot
be part of world identity in the same way the others are; it needs an ordering, not an equality.

## Predictions

**M-1.** No single coordinate qualifies. `repository` alone fails D2; `claim_domain` alone fails D1.

**M-2.** The unique minimal qualifying subset is **`{repository, claim_domain}`**, with
`evidence_extent` governed by an ordering rather than equality, and `procedure` not required for
transfer at all.
FALSIFIER: some other subset is minimal, or several are, or none qualifies.

**M-3.** Including `evidence_extent` as an equality coordinate fails **D3a specifically** — it
refuses a legitimate narrowing. This is predicted as a property of the coordinate, not of my code.

**M-4.** `procedure` is not necessary for transfer. Two observations of the same relation, over the
same domain in the same repository, by different procedures, may both establish it.
FALSIFIER: D1–D4 require procedure equality.

## What the result governs

Whatever qualifies minimally is what belongs in the token context, and nothing more. A coordinate
that is not necessary for transfer is recorded provenance, not identity — the distinction
`justification.mjs` already draws between a dimension and an `UNADMITTED` coordinate.

## Rules

Measurement only: `adapter.mjs`, `rules.mjs` and the contract are **not modified in this step**.
`legaknow` untouched. Rule selection stays frozen at 0/15. The S5 defect stays unrepaired until this
settles what the repair should be.

---

# The repair, frozen after the measurement and before implementation

The measurement determined the answer; it was not chosen. Identity is **`{repository, claim_domain}`**.
`evidence_extent` is carried as provenance and **ordered**, never compared for equality.
`procedure` is provenance only.

## What changes

    contract v1.4   measurement.observation.context gains a required `repository`
                    (the producer knows which target it analysed; nothing else can supply it)
    adapter         observeArgs builds the token context as { repository, claim_domain, examined,
                    domain_size, procedure } - identity first, provenance alongside
    store           the world check compares BOTH identity coordinates, and requires the token's
                    examined extent to be >= what the witness needs

## Predictions

    R-W1  S5 now REFUSES. The prediction that failed in LINEAGE_RESULT now passes, for the reason
          the measurement gave.
    R-W2  S1 still succeeds - legitimate lineage is not broken.   <- anti-refusal
    R-W3  a token that examined MORE of the domain than the witness needs still transfers;
          one that examined LESS does not.
    R-W4  every other suite is unchanged, the census stays at zero, legaknow stays byte-unchanged,
          and the rule digests MOVE (the matcher changed), so the producer must re-pin.
