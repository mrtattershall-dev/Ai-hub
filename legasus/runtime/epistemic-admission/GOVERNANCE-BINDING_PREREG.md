# Governance binding — G1..G5. Frozen 2026-09-21, before any binding code exists.

## The question A6 opened and did not answer

A6 demonstrated that an unchanged **origin label** can name a different underlying record after
reordering. Governance is keyed by `(origin, ref)`. So:

> If the `ref` also collides, can an unchanged governance map apply an obligation to the **wrong
> consumer**?

A6 did not demonstrate that. It demonstrated the same failure for *provenance*. This run attacks
**governance binding**: separation protects the governing channel; stable binding must protect what
that channel governs.

## The intended subject of governance, frozen first

Four candidates, and they are different contracts:

| candidate | what it would mean |
|---|---|
| a positional label | governance follows whatever currently sits in that slot |
| exact recorded content | governance follows identical bytes, wherever they appear |
| a journal lineage | governance follows a provenance chain |
| **a record occurrence** | governance follows **this record, as merged from this origin** |

**This run takes the record occurrence.** A governance entry denotes *this record, as merged from
this origin* — not a slot, not bytes, not a lineage.

**Content equality is explicitly rejected as the subject.** Two byte-identical records in different
origins are two occurrences, not one. Content equality establishes neither common origin nor
ownership nor independent evidence — the same conclusion the multiplicity run reached about
corroboration, arriving here from a different direction.

### The mechanism that follows from it

`merge()` computes an **occurrence identifier** for every record: a digest over
`(origin, ref, canonical entry content)`. Governance may be keyed by occurrence.

Consequences, stated before they are measured:

- A governance map written against occurrences from one merge **will not resolve** in a merge whose
  record-to-origin assignment differs. It must then **refuse, naming the unresolved entry** — never
  silently fall through to the default, because a governance entry that quietly matches nothing is
  the same defect class as a guard that fires and is wired to nothing.
- `(origin, ref)` keying is **kept**, because removing it would hide what it costs. G1 and G2
  measure both keyings side by side.

## The arms

| arm | question |
|---|---|
| **G1** reorder two consumers with the same local `ref` | does governance follow the intended record, or its positional label? |
| **G2** replace a journal while retaining its assigned label | can a different record inherit the old obligation? |
| **G3** replay under reassigned origins | is the original contract demonstrably attached to the same subject, or merely to the same coordinates? |
| **G4** duplicate a journal | can duplication redirect governance, or change which evidence the provenance denotes? |
| **G5** unresolved governance | a governance entry that denotes no record in this merge is **reported**, not silently ignored |

## An apparatus requirement, from the tenth wrong-referent instance

> **An identity-sensitive assertion must check both the identifier and the object it resolves to.**

A6 showed why: comparing labels alone certified stability while the underlying evidence moved. Every
arm here compares the triple `(origin, ref, occurrence)` — never a coordinate on its own — through a
helper that fails if the occurrence is missing.

## Predictions, committed now

- **G1 and G2 will fail under `(origin, ref)` keying and hold under occurrence keying.** That is the
  point of measuring both: the failure is the finding, and the occurrence key is the thing that
  earns its place by preventing it.
- **G3**: I expect the contract fingerprint to be *insufficient* on its own, because it digests the
  governance map and not what the map denotes. If two runs have the same map and different
  assignments, the fingerprints match while the subjects differ. **I expect that to be the sharpest
  failure in this run.**
- **G4**: duplication under the *same* origin already collapses to one record (M7). Under a
  *different* origin I expect two distinct occurrences, and governance not redirected.
- **G5** will need new code: nothing today reports a governance entry that matches nothing.

## Forbidden in this run

No registry rules added or changed (still **3 authored, 0/15**). No strength lattice. No exhaustion
mechanism. `COMPLETE` stays unsatisfied. **S6 stays preserved and untouched.** No freshness rule. No
repair of the F2 boundary. The default stays as T1 pinned it. `(origin, ref)` keying is not deleted
to make an arm pass — where it fails, it is recorded as failing.
