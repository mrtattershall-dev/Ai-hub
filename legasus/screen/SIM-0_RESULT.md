# SIM-0 — RESULT: DISAGREE. The world matched the arithmetic; my evidence model did not.

EH1 run `2026-10-01T15-58-48-059Z__SIM-0__6f11a1fe`, SEALED, exit 0, CPython 3.13.14, 339 s,
51.9M spins of the subject's own code. Prereg `SIM-0_PREREG.md` at 265e15be, unchanged.

## Frozen classification: DISAGREE (5 of 8 cells outside)

    cell        observed errors / 400    frozen 99% interval    
    W0 n=100        170                  160 - 212    IN
    W1 n=100        142                  160 - 212    OUT
    W0 n=1000        85                  131 - 181    OUT
    W1 n=1000        86                  131 - 181    OUT
    W0 n=10000        2                   56 -  96    OUT
    W1 n=10000        2                   56 -  96    OUT
    W0 n=70000        0                    0 -  10    IN
    W1 n=70000        0                    0 -  10    IN

Every miss is in ONE direction: the classifier was far MORE accurate than predicted.

## Secondary checks: all as predicted

    S1  W0 pooled RTP 0.245983 vs exact 0.246000  (z -0.20)
        W1 pooled RTP 0.222600 vs exact 0.222762  (z -1.97)    W1 < W0 confirmed
    S2  W0 Var(spin) 1.77391  exact-correlated 1.77337  IID 1.77445  -> not distinguishable
        W1 Var(spin) 1.69357  exact-correlated 1.69514  IID 1.69467  -> not distinguishable
    S3  replay W1 n=1000 r=0..9: byte-equal, 10/10
    P1  dropped exactly ["main()"]

So the world matched the exact arithmetic on its mean (both worlds) and its variance; the
counterintuitive A-lowers-return result is confirmed; the line correlation is immaterial here.

## Cause of the disagreement: a unit error in MY oracle, not the world

The decision statistic is RTP per LINE: winnings / (3n). Its standard error is
sqrt(Var(spin)) / (3 sqrt(n)). The prereg used sqrt(Var(spin)) / sqrt(n) - the per-SPIN deviation
against a per-LINE mean, missing the factor 3. Every frozen error rate and the distinguishing
horizon followed from that line.

    frozen   n* = 69,514 spins     "100 spins: 46.5% wrong"
    correct  n* =  7,724 spins     "100 spins: 39.6% wrong"      (9x, = 3 squared)

POST-HOC, and labelled as such - it is a fit after seeing the data, not a confirmation:

    n        corrected predicted error   99% interval   observed W0 / W1
    100      0.3956                      133 - 184      170 / 142    both in
    1000     0.2013                       60 - 102       85 /  86    both in
    10000    0.0041                        0 -   6        2 /   2    both in
    70000    ~0                            0 -   0        0 /   0    both in

## What this establishes

1. The frozen prediction was FALSIFIED by the data, and the falsification pointed at the
   evidence model, not at the subject. A correct mean (S1 held to z 0.2) was carried by a wrong
   account of how much a sample can support - "a correct answer produced by an incorrect evidence
   model", produced by the person who wrote the oracle, one day after naming that exact hazard.
2. The number that was celebrated before the run ("69,514") was wrong by 9x. A horizon stated
   without its derivation being checked is the same overclaim as an unscoped "no violation".
3. Scope (narrowed per tatte before the result): for these two frozen machines, this claim, the
   RTP statistic and this decision rule, n with W was enough to carry the evidence the data
   showed - but only once the inference procedure M was right. Evidence strength here was a
   function of (N, W, C, M), and M was where the error lived. Whether horizon is first-class:
   still not decided.

## Not established

The corrected predictions are post-hoc. Confirmation needs SIM-0b: the corrected oracle frozen
FIRST, fresh seeds (a new seed prefix), same harness otherwise. Nothing about Life, models,
repairs, or Legasus architecture.
