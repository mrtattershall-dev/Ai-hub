# Journal lineage — L1..L8. Frozen 2026-09-21, before any continuity code exists.

*(Named `JOURNAL-LINEAGE` because `LINEAGE_PREREG.md` is already the authority-lineage
preregistration from S1..S8 and is not to be overwritten. Different subject, different run.)*

## The question, which is not about identifiers

> **Who may establish continuity?**

A journal-supplied UUID would provide a *name*. It would not establish entitlement to inherit an
earlier journal's governance. Generating identifiers is the easy half and not the half that matters.

## Three permissions, deliberately separate

| permission | what it establishes |
|---|---|
| **identify a predecessor** | this is the historical record being referenced |
| **authorize a successor** | this new occurrence may continue that history |
| **transfer governance** | *these particular obligations* apply to that successor |

**Continuity does not automatically transfer governance.** An authorized revision could change
precisely the content an obligation governed. And the converse: **reordering an unchanged journal
must not require permission to revise its contents** — nothing was revised.

## What a journal may say, and what it may never say

A journal may carry a **continuity assertion**: `{ predecessor: <occurrence>, content: <digest> }`.
That is *identification only*. It authorizes nothing, and L1 attacks the assumption that it does.

Authorization comes from the **governor**, naming what it is authorizing:

    continuity: { <predecessorOccurrence>: { successorOrigin, successorContent, transferGovernance } }

`successorContent` is a digest of the record **excluding its origin** — stable under reordering,
different after a revision. `successorOrigin` is **merger-assigned**, so a copied journal cannot
supply it. Together they answer *who may establish continuity*: the governor authorizes, and the
merger's origin assignment is part of what is authorized. **A journal can identify; it can never
authorize itself.**

**Named limit, before it is measured:** content-based successor binding cannot by itself tell a copy
from the original. That is why the origin is in the authorization, and it is why L6 exists.

## Forks, frozen rather than left to insertion order

If **more than one** record satisfies a continuity authorization, **neither inherits** and the run
refuses, naming both. This is the merge rule again — *merging does not choose between them* — and
insertion order must not be allowed to decide what an ambiguous authorization meant.

## The arms

| arm | required observation |
|---|---|
| **L1** identification is not authorization | a journal asserting continuity, with no governor authorization, inherits **nothing**, and the assertion is reported rather than silently ignored |
| **L2** authorized reorder — **the decisive positive control** | an authorized continuity operation **preserves the intended obligation across reordered inputs**, across a **fresh process boundary** |
| **L3** the paired attack | a replacement journal copies **every serialized label and continuity assertion** but lacks the authorizing basis, and **fails to inherit governance** — across the same fresh process boundary, so live object identity cannot supply the missing distinction |
| **L4** revision | content changed: governance covers the revision **only** if the authorization names the new content. Otherwise it does not transfer, and says so |
| **L5** fork | two successors satisfying one authorization: **neither inherits**, the refusal names both, and the outcome is identical under both input orders |
| **L6** identical content, separate histories | equality alone does not merge identities — two byte-identical records under different origins are two histories |
| **L7** the permissions are separable | continuity authorized with `transferGovernance: false`: the successor is recognised as continuing the history and **inherits no obligations** |
| **L8** interaction with unattached governance | a continuity authorization whose predecessor is absent is unattached governance, and the frozen `INVALIDATE` default applies to it |

## Why L2 and L3 must cross a process boundary

Both sides of the decisive pair are about what a *replacement* can and cannot inherit. In one
process, object identity, a shared store, a live WeakSet and the module graph are all available to
make two things distinguishable for reasons that have nothing to do with the contract. **Only bytes
may cross**, exactly as R2 required, or the pair proves something weaker than it appears to.

## Predictions, committed now

- **L1** I expect to hold once identification and authorization are separate — and to be the arm a
  naive implementation fails, because carrying a `predecessor` field is the obvious place to put
  trust.
- **L2** is the load-bearing positive control. If it fails, continuity is not established and the
  rest of the suite is measuring refusals that would happen anyway.
- **L3** I expect to hold **because of the origin**, not because of the content: a perfect copy has
  identical content by construction. If it holds for any other reason, I have mis-measured it.
- **L4** I expect to hold, and to be where "continuity" and "governance" visibly come apart.
- **L5** I expect to need new code; nothing today refuses an ambiguous authorization.
- **L7** is the clearest test that the three permissions are three: if `transferGovernance: false`
  still transfers, they were one thing wearing three names.

## Forbidden in this run

No registry rules added or changed (still **3 authored, 0/15**). No strength lattice. No exhaustion
mechanism. `COMPLETE` stays unsatisfied. **S6 stays preserved and untouched.** No freshness rule. No
repair of the F2 boundary. **The `INVALIDATE` default is not weakened to make continuity
convenient** — lineage must justify restoring continuity without reopening silent substitution. No
signature or cryptographic ownership scheme: the threat model here remains carelessness, and
inventing one would claim a boundary this work has not established.
