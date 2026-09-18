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
