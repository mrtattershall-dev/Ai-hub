# Witness binding — a relation NAME is not a relation INSTANCE. Frozen 2026-09-21.

## The defect, stated at the right level

The calculus already holds that **coexistence does not establish relation**: two individually proven
endpoints do not prove an edge between them. The fourth specimen generalises that one level deeper:

> **Naming a relation does not establish that the relation holds between THESE endpoints.**

`derive()` matches witnesses by the `relation` string, so `{ relation: 'COVERAGE' }` satisfies a
coverage obligation while referring to a different world, or to nothing at all.

    COVERAGE                                        a label
    COVERAGE(evidence E, domain D, claim C)         a relation instance

## Two freedoms, and only one is under attack here

    1. RULE SELECTION       which rule applies to this derivation?        NOT attacked now
    2. WITNESS SATISFACTION does this witness establish the required      THIS experiment
                            relation between these concrete things?

The zero-correspondence census says the registry has no standing on (1). That stays measured and
unimproved. **The fifteen pre-registry declarations remain hostile held-out material**: no
applicability predicate is authored against them, and `adequacy.test.mjs` is not edited.

## Who owns satisfaction

> The producer may supply a witness **candidate**. It may not declare that the candidate satisfies
> the obligation. **The rule owns the matcher.**

`legaknow/calculus.mjs` is **not modified** — it is the authority kernel, and changing the
specification to fit the consumer is the defect this whole line exists to avoid. Binding is checked
in the runtime, before `derive()` is called: a candidate that fails its matcher is simply not
forwarded, so the calculus refuses on a missing witness, on its own terms.

## The arms

    W1  correct relation, correct claim/domain/endpoints          ACCEPT
    W2  same relation name, wrong claim domain                    REFUSE
    W3  same relation name, correct domain, no established        REFUSE
        evidence (evidence_root null)
    W4  same relation name and evidence, bound to a different     REFUSE
        premise/subject than the inference depends on
    W5  a legitimate witness with all bindings present            ACCEPT

**W5 is the refusal-machine guard.** Without it the safe-looking repair becomes "no witness ever
satisfies anything", which passes W2–W4 perfectly and is worthless.

## Predictions

**B-1.** W1 and W5 accept; W2, W3 and W4 refuse, each naming which binding failed.
FALSIFIER: any refusal without a named binding, or any acceptance among W2–W4.

**B-2 REGRESSION.** The v1.2 specimen is closed: changing a certificate's claim domain to one never
covered no longer mints. The previously recorded defect must now fail to reproduce.
FALSIFIER: it still mints.

**B-3 DRIFT COVERS SEMANTICS.** The rule digest must change when a **matcher** changes, not only when
a requirement is added. A matcher is part of what the rule means, so a runtime whose matcher moved
must refuse a certificate pinned to the old definition.
FALSIFIER: the digest is stable across a matcher change.

**B-4 NO CALCULUS EDIT.** `legaknow/calculus.mjs` and `observation.mjs` are byte-unchanged, verified
by git.
FALSIFIER: any diff.

**B-5 THE CENSUS IS UNTOUCHED.** `adequacy.test.mjs` still reports zero correspondence over the
fifteen held-out declarations. Witness binding must not be used to make the coverage table look
better.
FALSIFIER: the corrected tally moves.

## Contract v1.3

`relation_witnesses[]` becomes objects rather than strings:

    { relation, subject, object, domain, evidence_root, provenance }

v1.2 certificates are refused by v1.3 and vice versa. v1.0.0, v1.1 and v1.2 are preserved unmodified.

## Rules

The registry stays at three rules. No rule is added. The new matchers constrain **existing**
obligations and do not introduce new ones. Census untouched, calculus untouched, no merge.
