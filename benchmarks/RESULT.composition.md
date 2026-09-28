# r4 — authority under composition. RESULT of the preregistered attacks (pre-repair).

Predictions were frozen in `a62b1c4` (`benchmarks/COMPOSITION_PREREG.md`) before any attack file
existed. This file records the run of those attacks against the code at `aa03ab9`, unmodified. It is
written before any repair and is not rewritten afterwards; post-repair status lives in the ledger.

Attack files (each assertion states the PREDICTED DEFECT; each sits beside a control):

    legasus/legaknow/composition-attack.test.mjs    C1, C7
    legasus/legaknow/calculus-attack.test.mjs       C2, C3
    legasus/legaknow/unadmitted-attack.test.mjs     C4, C5, C6
    legasus/legaknow/provenance-attack.test.mjs     C8
    legasus/legaknow/stopping-attack.test.mjs       C9-a
    legasus/legaknow/vocabulary-attack.test.mjs     C10

## Raw run

    node --test legasus/legaknow/{composition,calculus,unadmitted,provenance,stopping,vocabulary}-attack.test.mjs

    ✔ C1-a ATTACK  A@S1 -> D1@null -> D2@S2 is ENTITLED for a consumer that does not pin repository
    ✔ C1-b CONTROL the direct edge A@S1 -> D2@S2 is REFUSED for the same consumer
    ✔ C1-c NON-VACUITY the same chain with D1@S1 is REFUSED, so the null is the laundering agent
    ✔ C7-a ATTACK  the same proposition at two scopes has ONE id, and add() overwrites the first
    ✔ C7-b CONTROL a different proposition gets a different id
    ✔ C2-a ATTACK  a premise that never established repository composes into a conclusion AT S1
    ✔ C2-b CONTROL concrete-and-different premises are refused without a bridge
    ✔ C3-a ATTACK  the mint symbol is recoverable from any real token, and a forgery then passes
    ✔ C3-b CONTROL without the brand the same object is refused
    ✔ C3-c         clone and JSON round-trip of a real token are NOT authority
    ✔ C4-a ATTACK  a git-shaped scope carrying a key NAMED collectionCohort is promoted by pytest's admission
    ✔ C4-b POSITIVE CONTROL a pytest-shaped scope promotes
    ✔ C5-a ATTACK  the bookkeeping key UNADMITTED is admissible as a dimension
    ✔ C5-b ATTACK  with UNADMITTED active, two scopes carrying IDENTICAL blocks fail covers()
    ✔ C5-c CONTROL before any such admission the same two scopes cover each other
    ✔ C6-a ATTACK  a carried value shadowed by a top-level value of the same UNADMITTED name vanishes
    ✔ C6-b ATTACK  the same shadowing after the name is ADMITTED
    ✔ C6-c CONTROL with no top-level value the carried one is kept
    ✔ C8-a ATTACK  two bindings over the SAME bytes with DIFFERENT producers: last wins, silently
    ✔ C8-b ATTACK  the seal does not cover attribution: mutating producedBy leaves the seal valid
    ✔ C8 CONTROLS  same path/changed bytes -> NOT_ESTABLISHED; different path/same bytes retains;
                   a removed record changes the seal; an undeclared producer is refused at bind
    ✔ C9-a ATTACK  an irrelevant pending string holds the contest OPEN with ZERO objectives
    ✔ C9-a CONTROL the same frontier with nothing pending is QUIESCENT
    ✔ C9-a POSITIVE CONTROL a pending item that IS a justified investigation keeps it open
    ✔ C10 ATTACK   OBSERVATION_DIMENSIONS carries history twice

    tests 25  pass 25  fail 0

## Reading

Every predicted defect reproduced and every control held. Zero predictions were falsified. That is
recorded plainly rather than dressed up: the predictions were derived from reading the
implementations, not from theory, so full reproduction is the expected outcome of accurate reading
and is NOT evidence that the reading was complete. What the controls establish is that each attack
reached the mechanism it claims to attack - the neighbouring case is refused in the same file, so a
refusal machine could not pass and a tautological attack could not pass.

## What the hypothesis now has

The handoff hypothesis - individually justified inputs plus an authorized relation may produce
output authority unsupported by the joint evidence - has FOUR concrete instances in the deciding
paths of r4, beyond the pytest case that motivated it:

    C1  a null intermediate: every edge locally legal, the path launders S1 into S2
    C7  identity excludes scope: a second add() moves the referent under an existing dependent
    C4  admission keyed by name: a pytest-argued dimension governs git records
    C8-a a last-wins digest map: the Entry 5 defect inside the module written to fix it

and four representational holes that are not compositions but let compositions go wrong:

    C2  absence means "for all" in calculus and "never established" in justification
    C3  the brand is recoverable, so "unforgeable" holds only against code holding no token
    C5  a reserved key is admissible and then manufactures NOT_COMPARABLE
    C6  a carried value can be shadowed and silently lost
    C8-b the seal covers the artifact set and not the attributions
    C9-a a pending string is a stall with no exit

None requires a new law. Each is named in the preregistration against the invariant whose
implementation admits it (Law 2, Law 5, the calculus header, the Entry 11 UNADMITTED contract, the
provenance binding property, Law 7's fourth condition).

## MEASURED, beside the run

    calculus.mjs production importers      NONE. The quiesce-check scan lists it as an importer;
                                           that is the string in its own file list, not an import.
    add() return value consumed by         no production caller
    node ids stored in any JSON artifact   none found

So the calculus is explanatory at runtime today, and C7's repair cannot break a stored identity.

## Not tested here, carried forward

    C9-b  TERMINAL measured by path      to be repaired with a digest pin; testable only once the
                                         pin exists
    C9-c  delegate({from: 'OWNER'})      recorded, not repaired: owner identity is procedural
