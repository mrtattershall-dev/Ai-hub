# Substitution without coexistence — result. X1..X5 against `SUBSTITUTION_PREREG.md`.

    5 arms, all green.  169 -> 174 tests in this directory.

## The attack succeeds

> **Removing the competing claimant makes the unauthorized transfer succeed again.**

Authorize history **A**; delete A entirely; present byte-identical **B** in A's former position;
leave the authorization untouched. There is exactly one claimant carrying the authorized content —
the shape C3 permits — and:

    continuity[0].kind          CONTINUED
    outcome.obligation.mode     DESIGNATED
    outcome.obligation.governedBy   GOVERNING_BY_AUTHORIZED_CONTINUITY
    unresolvedGovernance        []

**The governance of an absent history attached to its replacement, and nothing was reported.** X1
resolves the selection back through an independent fixture map to confirm the object was `B`, not
`A` — the occurrence digest could not have told them apart, because nothing in the inputs can.

This was predicted, and it is recorded as an **open failure**. No identifier was invented to close
it: the preregistration forbade that, and X3's reasoning says why — the intended history is absent
and unrepresented, so uniqueness among presented claimants cannot establish that the sole claimant is
the intended one.

## The containment's scope, as measured

| situation | outcome |
|---|---|
| multiple presented claimants at the authorized content | **refused** (`INDISTINGUISHABLE`) |
| sole claimant, content differs | **refused** (`UNAUTHORIZED`) — X2, the content-change protection is untouched |
| **sole byte-identical claimant, intended history absent** | **transfers** — X1 |

X3 asserts the discriminating fact directly: **removing the competing claimant turns a refusal into a
transfer with nothing else changed.**

## Two corrections carried out in this run

**The "wherever" claim is withdrawn.** `CONTAINMENT_RESULT.md` now states the defensible form and
records that **C3 demonstrates retained transfer capability, not correct historical attachment.**

**L6's evidence is separated from the origin check.** The containment refuses before execution
reaches the origin comparison, so L6's current behaviour cannot be cited as evidence that the origin
check is load-bearing. Its observation — a byte-identical copy inherits nothing — still stands, by a
*different* mechanism. The origin check's own evidence remains the lineage run's mutation record
(*origin ignored, content alone continues* → caught by L6 **as it then behaved**), and that is now
historical evidence about a superseded configuration rather than a live demonstration.

## The specimen left the production options surface

`__specimenUncontainedContinuity` was a callable bypass on `replayMerged`'s public options. The
preserved body now lives in `_specimen-support.mjs`, which no production module imports, and
`replayMerged` takes an ordinary `continuityResolver` injection point instead of a flag naming a
defect. **X5 asserts the old magic string has no effect.** X4 asserts the specimen still exhibits
P2's failure from its new home and is still injectable, so P1..P5 keep measuring it end to end.

**Stated limit, not softened: in JavaScript a bypass that exists is callable by anyone who imports
it.** X4 reaches it by importing it. This removes the defect from the options surface and reduces
accidental selection; it does not make selection impossible.

## Two further disclosures, found while doing this

**The FORK branch is now unreachable.** Two *qualified* claimants necessarily share the authorized
content, so the co-presence containment always fires first. The branch is kept and labelled rather
than deleted, so L5's earlier result stays legible.

**The old FORK guard refused the whole run unconditionally; the containment does not.** It refuses
the *transfer*, and whether the run refuses is then decided by the frozen unattached-governance
policy. Where no governance depended on the transfer, refusing everything was disproportionate, and
that stricter behaviour was **not** reinstated to keep an assertion green. L5 now records both
changes; C5 covers the case where governance did depend on it and the run does refuse.

## Arm by arm

| arm | outcome |
|---|---|
| **X1** the substitution attack | **the failure, confirmed and open** |
| **X2** content control | **held** — content-change protection unaffected |
| **X3** scope | **stated as measured**: the refusal and the transfer differ only in whether the competitor is present |
| **X4** specimen survives relocation | **held** |
| **X5** flag gone from the options surface | **held**, with its limit stated |

## Standing, unchanged where it should be

- The registry still recognises **3 authored rules, 0/15**.
- **S6 untouched. `COMPLETE` unsatisfied. F2 untouched. H-IDENTITY-AUTHORITY at NONE.**
- The threat model is still **carelessness**. X1 requires no malice: a journal removed and replaced
  by a byte-identical one, in the same slot, is an ordinary accident.
- **The missing input is unchanged and now has two demonstrations behind it**: P2 (co-present
  substitution, contained) and X1 (substitution by replacement, **not** contained). What is needed is
  governor-controlled information that binds an authorization to the intended journal before the
  merger assigns positions, survives reordering, distinguishes byte-identical histories, and is not
  acquired by copying a serialized label.
