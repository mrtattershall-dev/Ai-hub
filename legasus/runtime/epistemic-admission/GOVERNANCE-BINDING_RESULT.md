# Governance binding — result. G1..G5 against `GOVERNANCE-BINDING_PREREG.md`.

    5 arms, all green.  138 -> 143 tests in this directory.  5 mutants run, 5 caught.

## The attack was real

**G1: an unchanged governance map applied its obligation to a different record, and nothing in the
run said so.** Two consumers sharing the local ref `auth:1:same`, origins assigned by input
position, governance keyed by `(origin, ref)`. Reversing the input leaves the key identical, leaves
the coordinates identical — `origin-0/auth:1:same` both times — and lands `DESIGNATED` on the *other*
consumer. Comparing coordinates certifies nothing, which is exactly the shape A6 warned about, now
demonstrated for **governance** rather than provenance.

**G2: a replaced journal keeping its assigned label inherited the old obligation.** Same coordinates,
different record, same governing mode applied.

Both are recorded as failures of coordinate keying, and `(origin, ref)` keying was **not deleted to
make an arm pass** — it is kept so the cost stays visible.

## The predicted sharpest failure arrived: G3

The obligation contract fingerprint digests the governance **map**. Two runs sharing a map over
*different* assignments of records to origins therefore compare as **the same contract** while
governing **different subjects** — `sameObligationContract(fwd, rev)` is `true` and the subjects are
demonstrably not the same.

The fix is a **second, separate digest** over what the map actually landed on:
`(origin, ref, occurrence)` for every record. They answer different questions and are now two
functions — `sameObligationContract` (the map) and `sameGovernedSubjects` (what it governed). A
genuine reproduction agrees on both; G3 exhibits a case where the first says yes and the second says
no. Collapsing them back into one digest is caught by a mutant.

## What occurrence keying buys, stated exactly

The subject of governance was frozen as a **record occurrence** — *this record, as merged from this
origin* — digested over `(origin, ref, canonical content)`.

**It converts a silent misapplication into a reported non-application.** Under the reorder that
defeats coordinate keying, the occurrence entry simply does not resolve: no consumer is governed,
and `unresolvedGovernance` names the entry that governed nothing. Under the journal replacement, the
impostor inherits nothing and the absence is reported.

**It does not make governance follow the record.** An occurrence contains the origin, so governance
does not survive an origin reassignment — it refuses. That is the frozen mechanism working as
specified, and it is a *safe failure*, not attachment.

> **Missing coordinate, named so it is not rediscovered: nothing in this contract denotes "this
> record" independently of the merger's origin assignment.** A journal has no lineage identity. Until
> it does, governance can be protected from landing on the wrong subject but cannot be kept attached
> to the right one across a reassignment.

## Arm by arm

| arm | outcome |
|---|---|
| **G1** reorder, colliding refs | **coordinate keying misapplies silently — demonstrated.** Occurrence keying refuses and reports |
| **G2** replace a journal, keep the label | **coordinate keying lets a different record inherit the obligation — demonstrated.** Occurrence keying refuses and reports |
| **G3** replay under reassigned origins | **the predicted failure**, fixed by a separate subjects digest |
| **G4** duplicate a journal | **held** — same origin collapses to one record and governance is unmoved; a *different* origin gives a **different occurrence**, the duplicate is not governed, and **content equality is not one occurrence**. The multiplicity run's conclusion about corroboration, arriving from the other side |
| **G5** governance denoting nothing | **held** — reported with what it denoted, and *it did not fall through to the default*: a governance entry that quietly matches nothing is the same defect class as a guard wired to nothing |

## Mutation table

| mutant | caught by |
|---|---|
| occurrence ignores content (coordinates only) | G1, G2, G3 |
| occurrence ignores origin (content only) | G1, G4 |
| unresolved governance silently ignored | G1, G2, G5 |
| subjects fingerprint collapsed into the map fingerprint | G3 |
| occurrence governance falls through to coordinates | G1, G2, G4, G5 |

## One apparatus defect, preserved

**G1's first assertion contradicted my own frozen mechanism.** It expected the obligation to
*follow* the record across the reorder. It cannot — the origin is part of the occurrence, as the
preregistration says in the sentence that specifies the mechanism. The prereg was right and the
assertion was wrong, and it is the assertion that changed. Worth noting because the tempting repair
ran the other way: redefining the occurrence to exclude the origin would have made the arm pass and
would have reintroduced content-equality-as-identity, which G4 exists to refuse.

## Two reporting corrections carried out first

- **A1's ambiguity is resolved.** *The request is refused* and *asking is identical to not asking*
  cannot both describe the whole outcome. The identical projection is now named exactly — the
  **admission projection**: state, minting, binding, supply, enforced mode — while the obligation
  record deliberately differs because the request is documented. A1 also now carries a case where
  **the admission succeeds and the request is still refused**, so rejecting the request and
  rejecting the admission are shown to be independent.
- **The authorization conclusion carries its boundary**: *under the tested separation, a requester
  cannot override the governing obligation supplied by the call-site governor* — which establishes
  neither who may act as governor nor, before this run, that governance stays attached to its
  subject.

## What is still not shown

- **Journal lineage identity does not exist.** That is the missing coordinate above and the obvious
  next preregistration.
- Origin assignment remains unconstrained; occurrence keying limits the damage without constraining
  the merger.
- **Registry ownership is still not established**, so the governor is still the call site.
- `COMPLETE` remains vocabulary without a mechanism. **S6 is untouched and still stands.** The
  registry is still **3 authored rules, 0/15**. F2 untouched. H-IDENTITY-AUTHORITY stays at **NONE**.
