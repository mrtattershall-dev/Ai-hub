# LegaScreen v2 — FROZEN BASELINE at `ab47226`.

Recorded before v3 is designed, so that v2 cannot be remembered as broader than it was. History is
not rewritten; this is what the thing actually does.

## Demonstrated, each with an executed witness

    ERASURE                field-level loss, object -> object, over reachable exports   (v0/v1, SC-1)
    ALIAS                  a state word owned by two modules, one directory, one depth  (C8-word)
    COMPOSITION LAUNDERING entitlement gained by inserting a relay, 64 generated chains  (C1 + ANY)
    CONJUNCTIVE WEAKENING  a declared conjunction surviving the loss of a conjunct       (C2)

## Known failures, each measured rather than supposed

    MALFORMED-INVOCATION SPECIFICITY   v1 erasure on calculus.mjs: 7 positives / 8 functions, nearly
                                       all wrong-shape artifact. Fixed in v2 by requiring a witness;
                                       the v1 probes still carry it.
    SAME-NAME PERTURBATION ASSUMPTION  v2 perturbs an output dimension by stripping an input key of
                                       THE SAME NAME. Where the output is derived from a
                                       differently-named input, the perturbation is vacuous.
    DERIVED-BY-ANOTHER-NAME BLIND SPOT 3 dimensions UNSCREENED at HEAD for exactly that reason
                                       (adapt criterion, adapt history, narrow criterion).
    SURFACE                            7 witnessed transforms across 4 modules. Development
                                       calibration, not repository screening.
    PROSPECTIVE DISCOVERY              1 attempt, 0 new findings. The rescan surfaced only the defect
                                       that motivated the probe.
    AGGREGATION SEMANTICS DECLARED     I-WEAKENING applies only where a human wrote down that the
                                       operation is conjunctive. Nothing discovers that.

## The standing claim, at the strength the evidence supports

Four demonstrated lenses, five measured blind spots, and one failed attempt at discovery. Per
`protection.mjs` this is MECHANIZED_REGION for each lens and COVERED_CLASS for none;
`classCoverage` is UNKNOWN and no run has changed that.
