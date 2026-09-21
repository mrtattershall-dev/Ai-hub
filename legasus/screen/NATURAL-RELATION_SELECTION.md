# Natural relation production — the SELECTION procedure, frozen before any producer change
2026-09-21. Nothing in `certificate.py` or `obligation.py` is modified until this has been applied
and its outcome recorded.

## The rule

1. Enumerate the relations the three admitted rules already require. That set is fixed by the
   registry and is **not** extended: `MEMBERSHIP`, `COVERAGE`.
2. For each **ordinary** producer output — the six frozen cases, unchanged — enumerate the relation
   facts the producer **already records** in its own obligation and extent record.
3. A fact **qualifies** only if the producer already has, without anything being added:
   - the relation, its subject, and its object/domain;
   - the repository the observation was made in;
   - an observation carrying evidential force and an attribution.
4. Take the **first** qualifying fact in fixture order.
5. **If none qualify, the experiment terminates there.** No evidence is added, no producer
   vocabulary is invented, and no registry rule is created to make one qualify.

## What is forbidden

- Adding a fact to the producer so that a relation becomes producible.
- Adding a fourth rule. The registry stays at three, honestly **0/15** against the spent historical
  declarations. This experiment tests whether the existing line can manufacture an input those rules
  already demand — **not** whether the registry can be made to look more general.
- Any producer field of the form `relation_established: true`. The producer reports **facts**; the
  existing admission machinery decides whether the relation is established. A producer that
  certifies its own relation has simply relocated self-certification.

## Why the order matters

If the selection ran after the producer change, "which relation shall we make producible" and "which
relation is naturally producible" would be the same question, and the answer would be whatever was
convenient. Freezing the rule first makes the outcome capable of being **no**.
