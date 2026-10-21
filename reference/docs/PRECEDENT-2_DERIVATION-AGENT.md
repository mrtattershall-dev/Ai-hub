# PRECEDENT-2 — the derivation-agent claim pattern, and what it fixes here

**Date:** 2026-09-29 · **Source:** user-supplied archive `baselib-main.zip`, read-only, nothing executed.

**Scope of this reading:** the status enum and the claim implementation, verified directly in
`DerivationSparql.java`. Not a characterisation of the framework.

## The two claims I checked, and what they actually say

**Status lifecycle — confirmed.** `StatusType.java` is exactly five states:
`REQUESTED, INPROGRESS, FINISHED, ERROR, NOSTATUS`. `NOSTATUS` is the one worth noting: *no status* is a
named member of the enum rather than a null, which is the same discipline as typing an uncertainty
instead of leaving a gap.

**Atomic claim — confirmed, and it is better than "atomic."** `updateStatusBeforeSetupJob` is a single
guarded update that, in one statement:

- flips the status to `InProgress`,
- stamps `retrievedInputsAt` with the moment the inputs were read,
- inserts a freshly generated `uuidLock`,
- all under `FILTER NOT EXISTS { <derivation> retrievedInputsAt ?existing }`.

**And then it reads the uuid back and checks it is its own.** That read-back is the part worth copying.
The guard alone is only as atomic as the store's transaction semantics; the read-back makes the claim
*verifiable by the claimant* regardless of what the store guarantees. The code's own comment says why:
to avoid concurrent updates to the same derivation by different agent threads.

That is the discipline this project arrived at independently, applied to concurrency: **do not trust the
guard, verify you hold the lease.** A guard that silently failed to exclude would otherwise look exactly
like a guard that worked.

`retrievedInputsAt` is the second transferable piece. It records *when the inputs this job read were
read*, as a property of the job — which is precisely the value that was found **missing** from the
governed workspace earlier today, where the packet's `baseRevision` was recorded and never compared.

## What it fixes here, concretely

The audit of `governedEdit` found three gaps. This pattern speaks directly to two:

| gap found today | what this pattern supplies |
|---|---|
| the packet's `baseRevision` is decorative — recorded, never compared | `retrievedInputsAt` is the job's own record of what it read, and the claim is refused if one already exists |
| no **stale** vs **denied** axis; the stale case is lexically `ACTION_DENIED_REVISION_MISMATCH` | losing a claim is not a denial. Another worker holds it; the work is re-runnable against the new state |
| freshness is opt-in by the requester (the grant may carry no pinned revision) | **not addressed** — this pattern assumes declared inputs, and says nothing about a requester minting its own unpinned authority |

The third gap is the one that matters most for Legasus and is the one no precedent so far centres:
binding a *verified fact* to a *narrowly scoped permission* for a real write. World Avatar coordinates
through shared state and causes real effects; it does not gate those effects on evidence admitted for
that specific target at that specific revision.

## Honest limits

- It is RDF/SPARQL over a triple store, built for scientific entities. Translating it to code revisions,
  permissions, rollback and model routing is not a port; it is a redesign that keeps one idea.
- I verified the claim mechanism and the status enum. I did not verify the stale-upstream waiting, the
  downstream reconnection, or the DAG traversal, and this record claims nothing about them.
- **A proven coordination pattern is not a proven benefit here.** The falsification bar stated in
  `INTEGRATION-1_DEFINITION.md` is unchanged: does an evidence-governed work-state produce more verified
  progress per compute than the same generator in a linear loop? Borrowing a good pattern does not move
  that bar one inch, and adopting it *because it is proven elsewhere* is how an architecture becomes
  unfalsifiable.

## Named next work

1. **Weld the decoding parameters and test the weld hostilely** (from PRECEDENT-1). Still first: it is
   cheap and every comparison in this project currently rests on a recorded rather than enforced value.
2. **Give the executor a stale-vs-denied axis**, with the claim read-back as the model. Prerequisite for
   "propose freely, commit only when fresh."
3. Only then coordination, and only against a sequential baseline.
