# SIM-0b — PREREGISTRATION: does the corrected oracle predict fresh observations?

Frozen before the run. SIM-0 (265e15be prereg, 5048e69d result) is DISAGREE and stays DISAGREE.
Its frozen n* = 69,514 stays in the record as a frozen wrong prediction. The factor-of-3 diagnosis
and n* = 7,724 are, at this freeze, a POST-HOC explanation. SIM-0b tests that explanation on
observations nobody has seen.

## What changes, and nothing else

    ORACLE   standard error of the per-line RTP is sqrt(Var(spin)) / (3 sqrt(n)), not / sqrt(n)
    SEEDS    random.seed("SIM0b|<world>|<n>|<r>")   - fresh; no SIM-0 seed string is reused
    HARNESS  server/sim0b.py = sim0.py with ONLY the seed prefix changed (diff: 3 lines - the
             docstring, the seed call, the recorded seedScheme); sim0b.mjs = sim0.mjs pointed at
             it with label SIM-0b
Unchanged: subject sha256 fae51974..., P1, P2, worlds W0/W1, statistic (RTP per line), decision
rule (W0 iff RTP > 0.234250), grid n in {100, 1000, 10000, 70000}, R = 400, CPython 3.13.14.
The boundary does not move under the correction: the equal-z boundary depends only on the
RATIO of the two deviations, and the factor 3 cancels.

## Frozen predictions (corrected oracle)

    n        predicted error (each world)   99% interval of errors in 400
    100      0.3956                          133 - 184
    1000     0.2013                           60 - 102
    10000    0.0041                            0 -   6
    70000    ~1e-12                            0 -   0
    n* (1% each way) = 7,724 spins

These are the same numbers the SIM-0 result printed post-hoc. That is the point: they were fixed
by the correction before these seeds were drawn.

## Outcome classification (unchanged from SIM-0)

    AGREE     all 8 cells inside        -> 7,724 becomes a prospectively confirmed prediction,
                                           for these worlds, this claim, this statistic, this rule
    MARGINAL  exactly one cell outside  (~8% by luck alone)
    DISAGREE  two or more outside       -> the factor of 3 was not sufficient; look for what else
                                           the inference model is missing
Secondary checks S1 (means within 4 SE of exact), S2 (variance not distinguishable from IID),
S3 (replay 10/10) carried over unchanged.

Named risk: the n = 100 cells rely most on the normal approximation (discrete payouts). In SIM-0
those cells read 170 and 142 against 158 expected - both inside the corrected interval, but the
asymmetry is noted here before the run, not after.
