# PREREGISTRATION — does the open-end rendering survive at 14B?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why this and why now

`EXTENT` took the 7B's invented-bound rate from 16/80 to 1/80 and its authorization precision from
0.775 to 0.986. The scale window found the 14B's dominant failure is **the same class**: 17 of its 18
leaks were `0 < n < 10` — an invented lower bound on an unbounded-below domain.

If the rendering rule is real it should remove that too. If it does not, the rule is 7B-specific and
the "best configuration" table is a local result rather than an architectural one.

**Same harness, same four shapes, same three renderings, same contract-derived probes, same sampling.**
The only change is the model. 3 x 4 x 20 = **240 generations.**

## Prediction, written before running

> **`EXTENT` reduces the 14B's `TOO_NARROW` rate substantially** — the failure class it removed at 7B
> is precisely the 14B's known dominant class, so if the rule is about the contract rather than about
> one model this must replicate.
>
> **`NEGATED` stays inert**, as it was at 7B.
>
> **The 14B's authorization precision under `SILENT` will be better than the 7B's** (the scale window
> had 0.925 against 0.802) but **worse than the 1.5B's**.

**Falsified if `EXTENT` does not move the 14B.** That would mean the rendering rule is tied to a
particular capacity rather than to the contract, and the fourth renderer rule would have to be
re-scoped to "7B and below" — a much weaker claim than the one now in `RESEARCH_STATE.md`, which would
need correcting rather than defending.

**Also falsified as an architecture claim if `EXTENT` introduces `TOO_WIDE` failures.** At 7B it
introduced none. A rendering that fixes narrowness by buying overreach is not an improvement, it is a
trade, and the two columns are reported separately so it cannot hide.

## Cost and safety

T4 under standing authorization; the 14B at q4 is ~9GB and fits. `scaledown_window` 5 min, AC
confirmed, stop with `--yes` and verify. **Rule 3** before any generation.

---

# RESULT — the open end at 14B

GPU window stopped and verified: every `legasus` app row `stopped`.

    rendering   too-narrow   authorized   verified   P(correct | authorized)
    SILENT        20/80          62          42            0.677
    NEGATED       14/80          60          46            0.767
    EXTENT         2/80          64          62            0.969

    SILENT vs EXTENT    p = 4.0e-5        SILENT vs NEGATED    p = 0.334

## The rule belongs to the contract, not to one model

`EXTENT` cut the 14B's invented-bound rate from **20/80 to 2/80** and its authorization precision from
0.677 to **0.969**. The effect replicates at a third capacity, on the same four shapes, with the same
machine-generated probes.

`S_LOWER` under `SILENT` is the most extreme cell measured anywhere in this project:

    S_LOWER / SILENT     20/20 authorized,  ZERO verified   — every single one `100 < n < 200`
    S_LOWER / NEGATED    20/20 authorized,   6 verified
    S_LOWER / EXTENT     20/20 authorized,  18 verified

The 14B did not *sometimes* invent the upper bound. It invented it **every time**, twenty times out of
twenty, with maximum proposal yield throughout. Two words in the specification took that to 18/20.

## Predictions, scored

**CONFIRMED — `EXTENT` reduces the 14B's `TOO_NARROW` rate substantially.** 20/80 → 2/80, p = 4.0e-5.

**CONFIRMED — `NEGATED` stays inert.** 14/80 against 20/80, p = 0.334. Same verdict as at 7B, now at
two capacities: naming an absent bound does nothing, stating an open extent relationally does
everything.

**CONFIRMED — `EXTENT` introduces no `TOO_WIDE` failures.** Zero, in every cell, at every capacity. The
rendering does not buy narrowness back with overreach.

**FALSIFIED — "the 14B's `SILENT` precision will be better than the 7B's."** It is **worse**: 0.677
against the 7B's 0.775 in the same harness. Capacity and semantic precision are not merely uncorrelated
under `SILENT`, they are *inversely* ordered across all three sizes now measured — 0.981, 0.775, 0.677.

## AN APPARATUS DEFECT, and the S_STRADDLE cells are VOID because of it

`S_STRADDLE` at 14B authorized 2/20, 0/20 and 4/20 — against the 7B's 14/20, 19/20, 15/20. Every
refusal is `not exactly one guard and one return`, and the raw outputs say why:

    elif n < 10:
        return "small"

**The 14B writes `elif`, and the authority envelope only accepts `if`.** Placed after `if n > 5: return
"big"`, an `elif` is valid Python and semantically identical — the preceding branch returns, so the
chain is equivalent. It is a **legal realization**, and `CONSTRAIN` is rejecting it.

This is the same class as window 10's `n <= 10` discovery: **the apparatus penalizing a correct answer
it did not anticipate.** It is worse here because it is invisible unless a model happens to prefer that
style — the 1.5B and 7B rarely do, the 14B strongly does, so the defect masquerades as *"the 14B is
catastrophically bad at S_STRADDLE"* (6/60 against the 7B's 48/60, p = 2.7e-15).

    THE S_STRADDLE CELLS AT 14B ARE VOID AS A CAPABILITY MEASUREMENT.

They are not deleted and not rescored. They stay in the record as measured, labelled void, exactly as
ladder 1's `R1` and visibility rev 1's `W0` did.

**What is NOT affected:** the `EXTENT` finding lives in `S_LOWER`, where authorization was 20/20 in
every rendering. The headline result stands on cells the defect never touched.

The acceptor is also internally inconsistent, which is how it survived this long: `normalize` splits
one-line `if` **and** `elif`, and `conditionOf` extracts from `(?:el)?if` — only `accept` insists on
`if`. Three functions, two opinions.

## What this changes

1. **The fourth renderer rule is now confirmed at three capacities** and is the strongest single lever
   found: 1.5B unaffected (no headroom), 7B 16/80 → 1/80, 14B 20/80 → 2/80.
2. **Authorization precision under `SILENT` is inversely ordered with capacity** — 0.981, 0.775, 0.677
   for 1.5B, 7B, 14B. Under `EXTENT` the ordering nearly vanishes: 1.000, 0.986, 0.969.
3. **`CONSTRAIN` needs an anti-oracle control of its own.** `PROVE` has had one since window 10 — two
   legal realizations must pass. The authority envelope never did, and the first model with a different
   style preference exposed it. That is the next gate and it is an apparatus repair, not an experiment.
