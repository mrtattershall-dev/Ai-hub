# SIM-0b — RESULT: AGREE (8 of 8 cells inside the frozen intervals)

EH1 run `2026-10-01T16-07-08-652Z__SIM-0b__14f68694`, SEALED, exit 0, 390 s, fresh seeds
(`SIM0b|...`), subject fae51974, P1 dropped exactly ["main()"]. Prereg 864046e0, unchanged.

    cell        observed / 400    frozen 99% interval    (SIM-0, old seeds)
    W0 n=100        171              133 - 184    IN       170
    W1 n=100        162              133 - 184    IN       142
    W0 n=1000        93               60 - 102    IN        85
    W1 n=1000        64               60 - 102    IN        86
    W0 n=10000        2                0 -   6    IN         2
    W1 n=10000        2                0 -   6    IN         2
    W0 n=70000        0                0 -   0    IN         0
    W1 n=70000        0                0 -   0    IN         0

    S1  W0 RTP 0.245894 (z -1.27)   W1 RTP 0.222652 (z -1.34)      W1 < W0 again
    S2  Var(spin) W0 1.77240, W1 1.69448 - not distinguishable from IID, as predicted
    S3  replay 10/10 byte-equal

## The chain, as it now stands

    69,514   frozen (SIM-0)            -> DISAGREE, 5/8, all misses one direction
    factor 3 diagnosis                 -> post-hoc at 5048e69d
    7,724    frozen (SIM-0b), new seeds -> AGREE, 8/8

7,724 is now a prospectively confirmed prediction - for these two frozen machines, the per-line
RTP statistic, the equal-z decision rule at 0.234250, 1% error each way, CPython 3.13.14. It is
not a property of slot machines, of simulation, or of evidence in general. 69,514 stays in the
record as the frozen wrong number that the chain started from.

## Watched, not claimed

The n = 100 cell for W0 sat above its expectation (158) in BOTH runs: 170, 171 - pooled 341/800
against 316.8, about 1.8 standard deviations. This is the normal-approximation risk named in both
preregs. Two runs do not establish it, and nothing here is classified on it. W1 n=1000 (64) sat
near its lower bound. Both are inside their frozen intervals.

## What this does and does not decide

It shows the inference procedure M, once corrected, predicts unseen observations here; and that
in SIM-0 the observations, world and claim were sound while M carried the entire error. It does
NOT decide whether horizon is a first-class field in Legasus, and says nothing about deterministic
temporal evidence (Life), any model, or any repair. SIM-0 is closed: DISAGREE, then repaired and
replicated.
