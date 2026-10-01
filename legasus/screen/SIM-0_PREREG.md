# SIM-0 — PREREGISTRATION: can a claim's entitlement be read from accumulated simulated evidence?

Frozen 2026-10-01 before any run of the harness at full size. Characterization only: no model,
no integration, no Legasus module changed, no GPU. Harness `server/sim0.py` + `server/sim0.mjs`
(EH1) are frozen with this file.

## The question

Can a claim whose entitlement depends on accumulated simulated evidence be stated so that
observation COUNT, CONVERGENCE, and the SAMPLING MODEL are not mistaken for sufficient evidence?
The ORACLE is exact arithmetic. The simulator only GENERATES evidence. They are kept apart.

## The world

    SUBJECT   third-party "Python-Slot-Machine" main.py, sha256 fae51974cccc4b5d...afac7f0
              NO LICENCE FOUND (no LICENSE file, no README terms): read from outside the repo,
              never copied, vendored or committed. Our harness and measurements are ours.
    P1        drop module-level call statements (the file runs main() on import, which blocks
              on input()). Apparatus control: dropped == ["main()"] exactly.
    P2        W1 only: symbol_count["A"] = 3   (W0: A2 B4 C6 D8 -> 20 symbols; W1 -> 21)
    SEEDS     random.seed("SIM0|<world>|<n>|<r>") on the module-global random the subject uses
    PYTHON    CPython 3.13.14 - random.seed(str)/choice are reproducible only within an implementation
    UNIT      one spin = 3 lines x bet 1; RTP = winnings / (3 n)

W = (sourceSha256, P1, P2, seedScheme, python, n). A result means something only in its W.

## The oracle (exact; scratch derivation enumerates the column law: 3 ordered draws without
## replacement, columns independent)

                       W0                         W1
    RTP per line       123/500  = 0.246000        2063/9261 = 0.222762
    Var(spin)          1.77337                    1.69514
    cov(line i, j)     -0.000181 (corr -0.00031)  +0.000078 (corr +0.00014)
    Var/IID-Var        0.99939                    1.00028

Two things the oracle says that intuition might not:
 - ADDING a copy of the highest-paying symbol LOWERS the return (0.246 -> 0.2228): the pool grows,
   so every other symbol's triple-match probability falls by more than A's rises.
 - The line correlation I named as a "trap" (without-replacement draws within a column) is REAL
   but has magnitude 0.06% of variance. Predicted: evidentially IMMATERIAL for this machine.
   That earlier statement of mine ("gets the variance wrong") overstated it; recorded here.

## The decision rule and predictions (normal approximation, frozen)

Classify an n-spin sample as W0 if RTP > 0.234250 (equal-z boundary), else W1.
Distinguishing horizon at 1% error each way: n* = 69,514 spins. Grid n in {100, 1000, 10000, 70000},
R = 400 replicates per (world, n). Predicted misclassification and exact-binomial 99% intervals:

    n        predicted error (each world)   99% interval of errors in 400
    100      0.4648                          160 - 212
    1000     0.3901                          131 - 181
    10000    0.1888                           56 -  96
    70000    0.0098                            0 -  10

So: at 100 spins the evidence is a coin flip between two worlds whose returns differ by 2.3
points, though a single 100-spin sample can "look" like either. That is the entitlement number.

## Outcome classification (frozen)

    AGREE         all 8 cells inside their intervals
    MARGINAL      exactly one cell outside (8 cells at 99% -> ~8% chance by luck alone)
    DISAGREE      two or more outside; record which, and whether small-n non-normality explains it
                  (risk named in advance: payouts are discrete, n=100 is where it would show)
Secondary, each checked against the exact value:
    S1  pooled RTP per world (28M spins) within 4 standard errors of exact (W1 < W0 confirmed)
    S2  pooled Var(spin) vs exact correlated and IID values: PREDICTED NOT DISTINGUISHABLE at this
        horizon (the 0.06% effect is below the sampling error of the variance)
    S3  replay: W1 n=1000 r=0..9 recomputed, byte-equal RTP (determinism of the world)
Apparatus controls run before the freeze: sha refusal on a 1-line-modified subject (REFUSED,
exit 1); P1 dropped exactly ["main()"]; P2 changes only A; same seed equal, different seed differs.

## What it decides, and what it cannot

HORIZON QUESTION, scoped to this world only: if AGREE, "how far observation ran" is adequately
carried as ordinary coverage (n, with the world) - the evidence record needs n, and n is
sufficient. If DISAGREE, horizon needs more than a count (e.g. an effective sample size).
SIM-0 cannot decide horizon for DETERMINISTIC temporal evidence (Life: transitions under laws,
not samples), and says nothing about any model, any repair, or Legasus's architecture.
Not decided in advance: whether horizon becomes a first-class field.
