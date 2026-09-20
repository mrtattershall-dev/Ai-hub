# r4 — authority under composition, wave 2. RESULT of the preregistered attacks (pre-repair).

Predictions were frozen in `80724ba` (`benchmarks/COMPOSITION_PREREG_2.md`) before any attack file
existed. This records the run against the code at `455f2a2` (wave 1 fully repaired), unmodified.
Written before any wave-2 repair and not rewritten afterwards.

Attack files:

    legasus/legaknow/composition-attack-2.test.mjs      W2-a, W2-b
    legasus/legaprogress/frontier-attack.test.mjs       W2-c
    legasus/legareward/dominance-attack.test.mjs        W2-d
    legasus/legaexternal/adapt-attack.test.mjs          W2-e, W2-g
    legasus/legaexternal/producer-attack.test.mjs       W2-f   (runs CPython)

## Raw run

    ✔ W2-a-1 ATTACK  a refuter established at S2 refutes a claim about S1
    ✔ W2-a-2 CONTROL a refuter in the SAME world refutes
    ✔ W2-a-3 CONTROL a for-all refuter refutes a claim about any world
    ✔ W2-b-1 ATTACK  reestablish() moves the scope under an identity that encodes the old one
    ✔ W2-b-2 CONTROL reestablish() with evidence only keeps the scope and the identity
    ✔ W2-c-1 ATTACK  a STALE witness still connects the region and scores ADVANCEMENT
    ✔ W2-c-2 CONTROL the same witness VALID connects
    ✔ W2-c-3 CONTROL with no witness at all the subject is UNSUPPORTED
    ✔ W2-d-1 ATTACK  a candidate missing the BEHAVIORAL metric is EQUIVALENT and survives the frontier
    ✔ W2-d-2 CONTROL promotion already refuses it (the safe direction holds today)
    ✔ W2-d-3 CONTROL with the metric present on both, dominance is decided on it
    ✔ W2-e-1 ATTACK  an absent producer version is stringified into the criterion
    ✔ W2-e-2 ATTACK  a record with no producer at all is adapted rather than refused
    ✔ W2-e   CONTROL a versioned producer builds the criterion it always did
    ✔ W2-f-1 ATTACK  an IMPORT_FAILED record is given a document and an array-index ordinal
    ✔ W2-f-2 CONTROL a PASS record carries its real DocTest name and ordinal
    ✔ W2-g-1 ATTACK  a git record whose native result is spelled PASS receives doctest's semantics
    ✔ W2-g-2 CONTROL the same git record with git's own vocabulary is UNKNOWN_MAPPING
    ✔ W2-g-3 CONTROL a doctest PASS still maps
    ✔ W2-g   FINDING pytest has no declared mapping: every pytest verdict is UNKNOWN_MAPPING today

    tests 20  pass 20  fail 0

## Reading

Every prediction reproduced; zero falsified. As in wave 1, the predictions came from reading the
implementations, so this is what accurate reading yields and is not evidence the reading was
complete. Wave 3 will include predictions of NO defect - places where the reading says the code is
right - so that this program can be falsified in both directions.

Composition instances added to the hypothesis's evidence:

    W2-a  a refuter in another world defeats a claim: authority transferred across the REFUTES edge
          by ignoring scope (Law 2)
    W2-c  a stale witness is an edge: "stale -> current" inside the progress ratchet (ledger Law 1)
    W2-g  the adapter grants doctest's semantics to any producer whose vocabulary happens to match:
          same name -> same authority at the boundary (Law 2, Law 4)

Representational holes:

    W2-b  reestablish() rewrites a scope the identity now encodes (C7 through a second door)
    W2-d  an unmeasured behavioural metric reads as compatible on the Pareto frontier
    W2-e  an absent version and an absent producer both become the string "undefined"
    W2-f  producer #1 fabricates a document and an ordinal for a record that has no example -
          the producer #2 strain ("undefined#undefined"), living in producer #1 all along

## The finding beside W2-g

pytest has no declared mapping. Every pytest verdict adapts to UNKNOWN_MAPPING. That is the
adapter refusing to invent, which is correct - and it means no scoped Legasus claim has ever
derived from pytest evidence. Producer #3 established scope construction; it did not establish
derivation. Recorded as a limit of what Entry 11 showed, not as a defect.
