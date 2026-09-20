# r4 — producer #2. Selection rule and predictions, frozen BEFORE candidates are inspected.

Every external claim in r4 currently rests on **one** authority: CPython `doctest`. That is the narrowest
part of the evidence base, and an abstraction validated against a single producer is an abstraction shaped
by it.

The rule is frozen first so the second producer cannot be chosen for fitting the abstraction just built.

## P2-SELECTION — eligibility

A candidate is eligible iff **all** hold. None requires inspecting what it would say about any subject.

1. An **independently implemented external authority**, already present or installable in this
   environment before the experiment.
2. Establishes a **real software fact Legasus has reason to consume** — not a fact invented to be
   consumed.
3. Differs from doctest on **at least 3** of:
   - evidence unit
   - identity scheme
   - execution model
   - native result vocabulary
   - criterion
   - state / history semantics
   - isolation model
4. Its raw output is machine-readable without Legasus reimplementing its semantics.

## Selection, applied mechanically

Among eligible candidates, choose the one differing from doctest on the **most** axes in (3); ties broken
by **lexicographically smallest tool name**. Rationale stated in advance: maximum ontological distance is
what tests whether the evidence boundary is generic or doctest-shaped. Chosen for **strain**, not for
expected agreement.

**No candidate's behaviour, output or results on any subject may be inspected before this rule selects.**

## Predictions

    E1   raw producer evidence survives WITHOUT translation into Legasus vocabulary
    E2   producer-native identity remains authoritative; no forced module|source or example-ordinal
         scheme is imposed on it
    E3   native distinctions survive storage even where Legasus currently has no corresponding
         distinction
    E4   the adapter cannot create evidential distinctions absent from raw evidence
    E5   producer failure yields non-knowledge, never fallback reenactment of producer semantics
    E6   at least one SCOPED Legasus claim legitimately derives from producer #2 evidence
    E7   at least one distinction remains PRODUCER-SPECIFIC. A common abstraction is NOT achieved by
         collapsing everything to PASS / FAIL / UNKNOWN
    E8   existing doctest evidence and its adaptation remain unchanged
    E9   a deliberately malformed or incompatible producer record is REFUSED, not coerced
    E10  historical evidence stays interpretable after BOTH (a) the subject is unavailable and
         (b) the producer implementation is unavailable

**E7 is the anti-collapse control.** Flattening every producer into three states would satisfy E1–E6
trivially and would mean the boundary had abstracted away the thing it exists to carry.

**E10 combines two halves this project discovered separately:**

    subject lifetime  != evidence lifetime      (raw preservation, external-producer work)
    producer lifetime != evidence lifetime      (the replay retirement)

Together they imply something stronger than "save provenance":

> **The lifetime of justified evidence is determined by its recorded validity conditions, not by the
> continued existence of either endpoint that produced it.**

## Failure is the useful outcome

If producer #2 forces the supposedly generic evidence boundary to change shape, **that is the result** —
recorded, not engineered away. An abstraction that never has to bend under a second authority was never
tested.
