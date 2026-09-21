# Replay / reconstruction — R1..R8. Frozen 2026-09-21, before any persistence code exists.

## The boundary, frozen first

> **A persisted admission record is an INPUT to a new admission attempt.
> A saved acceptance verdict cannot itself authorize anything.**

Everything below is a consequence of that one sentence, and every arm is a way of trying to violate
it.

## Two design decisions, made explicitly and before the outcome is known

### 1. What an old opaque handle identifies after restart

A ref is an address in a store that no longer exists. After a restart it identifies **a persisted
record and nothing else**. So the two operations get different names, different return shapes, and
one may never call the other:

    locate(ref)   -> { ok, record } | { ok: false, why }      NEVER returns a token
    resolve(ref)  -> { ok, token }  | { ok: false, why }      only for refs THIS store issued

`locate` is a filing-cabinet lookup. It hands back the recorded claim, constructor, context and
ancestry — the artefact that already deliberately does not contain the token. Turning a located
record into authority requires running admission again, with the record as input. **If loading a
record could ever produce a token, loading would be an accidental minting operation**, which is the
failure class this whole step exists to prevent.

A named hazard, recorded now because I can see it before it fires: `nextRef` uses a module-level
counter plus six random characters, and the counter **restarts at zero in a fresh process**. Refs
are therefore not globally unique across restarts, only probabilistically so. R1 tests the
consequence directly.

### 2. Reproduction is not currency

Replay can show that *the same evidence, re-executed, still justifies the same claim*. It cannot
show that *the claim is true now*. These are different propositions and the result document must not
let one stand in for the other.

**There is no freshness rule in the registry today.** I am recording that before running anything.
Replay in this run therefore establishes **reproduction only**, and a claim re-established by replay
carries exactly the currency its evidence carried when recorded — which is none beyond that
evidence. Any freshness requirement must be an admission rule, authored in the registry, frozen
before its outcome is known. Inventing one after seeing a replay succeed would be a retroactive
repair.

## The arms

| arm | required observation |
|---|---|
| **R1** fresh process | a previously issued handle alone grants **no** authority in a fresh store — including when the ref-counter has restarted and produced a colliding-looking address |
| **R2** valid replay | recorded evidence and dependencies undergo admission **again**; successful execution produces authority in the new store, **across a real process boundary** |
| **R3** verdict-only control | saved `accepted` / `minted` / `established` / `state` fields cannot substitute for evidence — a record stripped of everything but its verdict establishes nothing |
| **R4** changed evidence | replay evaluates the **changed** evidence; the previous verdict cannot carry acceptance forward |
| **R5** missing dependency | replay refuses, or remains open, **naming the missing dependency** |
| **R6** changed scope | authority for the old repository or claim domain cannot bind in the new one |
| **R7** circular records | records cannot bootstrap authority by referring to one another |
| **R8** primary preservation | replaying F2's relation still cannot close F2's ordinary derivation; witness binding remains unreached |

## R2 crosses a real process boundary

A second `store()` inside one process would test store isolation, not restart. It leaves the module
graph, the calculus's private WeakSet, every already-minted token and the ref counter alive and
reachable. The positive arm therefore:

1. parent process emits admission records to a file on disk;
2. parent exits;
3. a **child `node` process** starts, imports the modules fresh, reads **only that file**, and runs
   admission;
4. the child reports its outcome as text on stdout.

Nothing but bytes crosses. If the child can be shown to have minted authority, it minted it.

**Positive control for the boundary itself**: the child also attempts `isAuthority()` on a JSON
round-trip of a token from the file. That must be `false`. If it is ever `true`, the boundary is not
what I think it is and every other arm in this table is uninterpretable.

## Predictions, committed now

- **R1 passes as written** — `entries` is a fresh `Map`; `resolve` returns the "an address is not an
  establishment" refusal. The counter-restart sub-case is the one I am least sure of: I predict the
  fresh store still refuses, because it refuses *every* ref it did not issue, not merely unknown
  strings.
- **R2 requires new code that does not exist.** There is no serializer and no replay driver today.
  What it must earn: the ability to lose every grant of authority and recover exactly what
  re-execution justifies.
- **R3, R6, R7 pass by existing machinery** — `admitToken` refuses unbranded objects, world identity
  is already compared in `resolveEvidenceRoot`, circularity is already refused there.
- **R4 is where I expect the first real failure**, because a replay driver is exactly the place
  where somebody caches a verdict to avoid re-running work.
- **R5** I expect to be *open*, not *refused*, and the distinction matters: a missing dependency is
  unresolved, not disproven.
- **R8 must not improve.** F2's ordinary derivation has no closed alternative. If replay ever
  "fixes" that, replay has manufactured something.

## Forbidden in this run

No new registry rules (still **3 authored, 0/15**). No freshness rule invented mid-run. No repair of
the F2 boundary. No path by which a record becomes a token without admission. The persisted artefact
remains a record and never gains a serialized token field.

## The finding this is aimed at

> The process forgot every grant of authority, retained the evidence, and recovered exactly the
> authority that re-execution justified — **including the same unresolved F2 boundary.**

If instead re-execution recovers *more* than the original run did, or recovers it *without* the
evidence, that is the counterexample and it gets recorded as one.
