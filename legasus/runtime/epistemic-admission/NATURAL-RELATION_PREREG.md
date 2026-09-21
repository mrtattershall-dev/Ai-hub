# Natural relation production — N1..N8. Frozen 2026-09-21, after selection, before production.

## What selection chose, and it was not convenient

The frozen procedure in `NATURAL-RELATION_SELECTION.md` ran first and picked the **first qualifying
fact in fixture order**:

    case        F2, REACH-1 get_path
    relation    COVERAGE(F2:derivation0:premise0, FUNCTION_PARAMETER)
    repository  pytorch@9b6e45278f06
    recorded by obligation.coverage[FUNCTION_PARAMETER] == EXHAUSTIVE

**F2 is the case whose own claim cannot be admitted** — it is census site #7, the undecidable
premise. So the selected relation comes from a run that FAILS. That is a better test than F4 would
have been, and I did not choose it.

Two cases were disqualified for a real reason: F3 and F5 record the same relation facts but carry no
observation with evidential force, so they do not qualify.

## The division of responsibility, restated because it is the whole point

    producer            reports FACTS it already records, and requests a claim
    normal admission    decides whether the relation is established
    authority store     preserves the resulting handle
    later consumer      decides whether that exact relation satisfies its obligation

There is no `relation_established` field and none may be added. A producer that certifies its own
relation has relocated self-certification, which is the defect every step of this sequence removes.

## The arms

    N1  an ordinary producer run containing the necessary facts emits a relation claim,
        with NO test-side retargeting
    N2  that claim goes through the NORMAL certificate and admission path, and relation authority
        genuinely mints and enters the store
    N3  a later independent certificate referencing ONLY the opaque handle consumes it and derives
    N4  remove one fact necessary for relation production -> the claim is ABSENT or REFUSED,
        never fabricated
    N5  the same apparent relation in the wrong repository or claim domain -> later consumption
        refuses
    N6  relation authority that came from a valid DERIVATION rather than direct observation ->
        later consumption still works                                   <- anti-refusal
    N7  the producer emits some other TRUE fact from the same evidence -> it cannot silently
        substitute for the required relation
    N8  if no natural qualifying relation had existed, the experiment terminates there

**N8 already discharged**: a qualifying relation exists, found by the frozen rule. Had none
qualified, nothing would have been added to make one.

## Forbidden in this run

No new registry rules. The registry stays at three and honestly **0/15** against the spent
historical declarations. This tests whether the existing line can manufacture an input those rules
already demand — not whether the registry can be made to look more general.

No new producer evidence. The relation certificate is emitted from the **same** evidence record the
ordinary case already carries; only the proposition drawn from it differs.

## H-IDENTITY-AUTHORITY is exposed here

If a legitimate producer→relation→consumer path requires an identity correspondence that is
operationally reliable while no independent equivalence proposition can be established, **that is the
counterexample** and it is to be recorded as one, not forced through the hypothesis. If instead every
successful transfer terminates in established identity evidence, that is a sixth arrival and still
not a law.
