# r4 — LegaScreen v1. RESULT: the three-case bar is met, and the composition probe found more than was recorded.

Predictions frozen in `6534588` (`LEGASCREEN_V1_PREREG.md`). One harness, three probes, run unchanged
against HEAD and three historical trees extracted with `git archive legasus/legaknow`.

## The runs

    TREE       P-ERASURE                              P-ALIAS                    P-COMPOSITION
    HEAD       4 pos / 16 ex / 1 unscreened           7 pos / 104 ex             0 pos / 64 ex
    77fd921    6 pos  <- objectivesFromContest        7 pos                      0 pos / 64 ex
               lost establishes, doesNotEstablish
    58b62aa    3 pos                                  6 pos  <- CONTESTED        0 pos / 64 ex
                                                      ledger.mjs, provenance.mjs
    b11e51f    3 pos                                  5 pos                      4 pos / 64 ex
                                                                                 <- A=S1 -> M=null -> C=S2

## V1-1, V1-2, V1-3 all held. V1-3 was the decisive one.

P-COMPOSITION is the only probe here written as a METAMORPHIC PROPERTY over a generated space rather
than as a scan: *lengthening a justification path must not grant what the direct path refuses*. It
enumerates 64 three-node chains over {null, ANY, S1, S2}, builds the two-node graph with the same
endpoints, and compares entitlement. It contains no mention of `null`, of C1, of which dimension
matters, or of what a laundering defect looks like.

At `b11e51f` it surfaced C1. At HEAD it surfaces nothing over the same 64 chains. **The erasure result
was not a scan finding a scan-shaped defect; a property stated in general found a composition defect
in a generated space.**

## AND IT FOUND A ROUTE MY HAND ANALYSIS NEVER ENUMERATED

    repository: A=S1 -> M=null -> C=S2     <- C1 as recorded
    repository: A=S1 -> M=ANY  -> C=S2     <- NOT in the wave-1 attack, NOT in any test I wrote
    repository: A=S2 -> M=null -> C=S1     (the symmetric pair of each)
    repository: A=S2 -> M=ANY  -> C=S1

The wave-1 preregistration predicted the null intermediate and tested exactly that. An intermediate
at **ANY** laundered identically, and I never wrote it down. The C1 repair happens to close it - the
`conclusion ANY from a premise established at S1` branch refuses the middle edge, which is why HEAD
is silent - so nothing is newly broken. But the repair covering it was luck of construction, not
coverage I had demonstrated, and per `protection.mjs` that distinction is the whole point.

A generated space found a member of the class that hand enumeration missed. That is the first
evidence in this project that screening reaches where preregistered attacks did not.

## False positives, reported and not tuned

P-ALIAS carries its standing collisions at every commit - 7 at HEAD, and a DIFFERENT 7 at 77fd921
(pin.mjs exists there, instruments.mjs does not), which is why the set size alone is not the signal.
P-ERASURE carries wrong-shape artifacts, the cause named in v0: JavaScript does not throw when a
function is handed the wrong shape. No probe was narrowed after seeing its target.

**The delta across commits remains the usable signal**, not the absolute count.

## UNSCREENED

At HEAD, `stopping.attainment` is reported as never called - the corpus produced no call it accepted.
At the historical trees it does not exist. A clean positives list says nothing about it.

## The region this earns, per protection.mjs

    detector   LegaScreen v1, three probes on one harness
    witness    this run: three known defects surfaced at the three commits where each was live,
               with no probe naming a file, function, field or commit
    covers     SC-1 (erasure), the C8 word alias, C1 (composition) - and one unrecorded C1 variant
    region     field erasure over one module's reachable exports; state-word collisions in one
               directory at one nesting depth; three-node chains over one dimension and four scope
               values

NOT covered, unchanged from v0 and restated: value-level loss inside a retained field, array- and
Map-shaped transformations, every module outside the scanned ones, chains longer than three, more
than one dimension at a time, and every pathology the owner listed that is not one of these three.
The bar is met for three cases; the class is not covered, and `classCoverage` stays UNKNOWN.
