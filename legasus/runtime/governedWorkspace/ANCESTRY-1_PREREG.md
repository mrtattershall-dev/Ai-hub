# ANCESTRY-1 — speculative state, frozen 2026-09-29 05:55 CDT, before any implementation

Clock read with `date`, not estimated.

## The dividing line this slice exists to draw

Two relations have been carried by one field. `baseRevision` answers only the first:

| relation | question | present today |
|---|---|---|
| **conflict** | do these packets touch the same scope? | yes — `baseRevision` + `staleFor`, both scope-local |
| **ancestry** | was this candidate verified in a world containing these other changes? | **no field can express it** |

A packet has no way to name a state of files it does not touch. So *"C verified on base + A + B"* is not
unimplemented, it is **inexpressible**. Test 5 of GOVERNED-WORKSPACE-1 asserts that an unrelated `b.js`
churning leaves an `a.js` packet eligible — the correct rule for conflict, and the wrong rule for ancestry,
because a candidate verified against a particular `b.js` is invalidated by `b.js` moving even though the
two can never collide.

## VERIFIER-1 comes first, and is a precondition, not a companion

`validation` is recorded at `prepare()` and **executed nowhere**. `rollback` likewise. A queue that merely
consumed those fields would automate a declaration — the project has a name for this shape already:
detection wired to no consumer, and a receipt describing the intention rather than what landed.

`PromotionReceipt.verifierReceiptDigest` **cannot be honest until a verifier actually runs**. So:

> **VERIFIER-1: `validation` becomes an EXECUTED check whose result is recorded as its own event, produced
> independently of the packet that declared it.** A declared expectation and an observed verdict are
> different facts and get different fields. The verifier reads the bytes on disk itself; it may not be
> handed the contents the packet proposed, or it would be grading the intention again.

Only then does a receipt digest mean anything, and only then may ANCESTRY-1 cite one.

## The shapes

    CandidatePacket
      baseTreeRevision          state of the whole governed tree the candidate began from
      assumedReceipts           [receiptDigest...] promotion receipts this candidate was verified WITH
      scopes                    the targets it may affect        (conflict)
      effect                    the proposed contents            (unchanged)

    PromotionReceipt
      parentTreeRevision        what it began from
      assumedReceipts           what it assumed                  (ancestry)
      observedTreeRevision      what the tree became, READ, not declared
      verifierReceiptDigest     VERIFIER-1's independent verdict
      authorityLineageDigest    the token lineage that permitted promotion

`baseTreeRevision` and `observedTreeRevision` are digests over the governed tree, so a candidate can name a
world rather than a file. `baseRevision` is **kept unchanged** for conflict; ancestry does not replace it.

## The ONE operation

> **When a predecessor receipt is rejected, superseded, or no longer matches the current tree, mark only
> its TRANSITIVE DESCENDANTS `STALE_ANCESTRY`.**

No re-generation. No automatic reissue. No merge queue. No scheduler. Make ancestry visible and
invalidation correct; nothing more is in scope, and a result that required more would falsify this slice
rather than extend it.

`STALE_ANCESTRY` joins the retryability vocabulary as **STALE** — the world moved, the same work may
proceed once re-verified against a new ancestry — never DENIED.

## Alternatives are not descendants

Two rival candidates for `a.js` are an **alternative set**: same scope, neither assuming the other. The
failure this forbids is representing them as parent/child, which today is indistinguishable from a
dependency chain — the first commits, the second gets STALE, and the record cannot say whether that was a
lost race or an invalidated descendant.

## Required cases

| | prediction |
|---|---|
| **AN-1** | an unrelated `b.js` change does NOT stale a candidate that neither read nor assumed `b.js` |
| **AN-2** | a candidate that assumed predecessor A DOES become `STALE_ANCESTRY` when A is removed or changes |
| **AN-3** | two rivals for `a.js` are marked an ALTERNATIVE SET, not parent/child |
| **AN-4** | a stale descendant CANNOT promote until re-verified against a new ancestry receipt |
| **AN-CONTROL** | a descendant whose ancestry is intact DOES promote — without this, AN-2/AN-4 could pass against a layer that stales everything |
| **AN-TRANSITIVE** | C assuming B assuming A: invalidating A stales BOTH B and C, and a sibling of A that nothing assumed is untouched |
| **V-1** | a declared `validation` that the bytes on disk SATISFY produces a verifier event with a passing verdict |
| **V-2** | a declared `validation` the bytes VIOLATE produces a FAILING verdict — the check can fail |
| **V-3** | the verifier reads disk: given a packet whose declared contents differ from what landed, the verdict follows DISK, not the declaration |
| **V-CONTROL** | a packet declaring no validation is unaffected — verification is not silently made universal |

Every negative case asserts the absence of the effect, not merely a returned verdict.

## What ANCESTRY-1 does NOT establish

- **That any controller routes through this layer.** Nothing does. `governedWorkspace` still has zero
  importers outside its own tests, and `AGENT_GOVERNED_WRITES` is still never set to `1` anywhere. A green
  suite here is "the layer behaves correctly in isolation" — the same boundary GOVERNED-WORKSPACE-1 drew,
  and the same one `acceptanceDecision` failed with 30 green assertions and no consumer.
- **That speculative execution helps.** This slice adds no scheduler and runs no experiment.
- **Anything about the eventual four-vs-four comparison.** Recorded separately: a dependent candidate that
  sees predecessor output gains INFORMATION, not only coordination. The first coordination experiment must
  give descendants the SAME declared predecessor artifact in BOTH arms, so the difference measured is
  whether invalidation and re-verification are correct when the predecessor fails — not whether later
  agents received more helpful context. If the measured dependency rate is near zero the arms are the same
  experiment and the result is uninformative, so the dependency rate is a reported property of the task
  set, not an assumption.
- Child-process writes, symlinks, Windows junctions, distributed clocks, concurrency beyond in-process
  interleaving: unchanged and still ungoverned.
- E4 single use, E5 allowance, E6 expiry, E7 revocation, E9 the race: still not built.
