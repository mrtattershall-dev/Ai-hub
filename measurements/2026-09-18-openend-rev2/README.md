# PREREGISTRATION — the open end, revision 2: same experiment, repaired envelope

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why there is a revision 2

Revision 1's `S_STRADDLE` cells at 14B are **void**, and the reason is an apparatus defect: the
authority envelope accepted only `if`, the 14B writes `elif`, and after a branch that returns those are
equivalent. `CONSTRAIN` was refusing a **legal realization**, and the result read as a catastrophic
model failure — 6/60 against the 7B's 48/60, p = 2.7e-15 — that was entirely the harness.

`legasus/legagate/envelope.mjs` is now the single authority envelope with one opinion, carrying the
anti-oracle control it never had: ten fragments that must be **admitted**, all legal realizations
differing only in surface, and six that must be **refused**, with negative controls in both directions
so neither list can go vacuous.

## What is frozen, and how that is checkable

`contract-identity2.test.mjs` compares revision 1 and revision 2 region by region — the four shapes,
the three open-end phrasings, `plan`, `promptFor`, assembly, program execution, the contract probes,
the dense-equivalence control, and the controls — and fails if anything outside the declared diff has
moved. Twelve witnesses including a mutation control. The declared diff is `CONSTRAIN` and nothing
else.

## All twelve cells re-run at every capacity

Widening an envelope can only move acceptance **up**, but it can move it up *anywhere*. A table half
under the old envelope and half under the new one would not be a table. Revision 1's numbers stay as
history; these are new.

3 renderings x 4 shapes x 3 models x 20 samples = **720 generations.**

## Prediction, written before running

> **`S_STRADDLE` at 14B recovers from 6/60 to a yield comparable with the other shapes.** If it does
> not, `elif` was not the whole story and something else is wrong with that cell — which would matter
> more than the repair.
>
> **`EXTENT` still beats `SILENT` on `TOO_NARROW` at 7B and 14B**, by roughly the margins already
> measured. The envelope repair should not touch this: it changes what is *admitted*, not what the
> model writes, and the open-end effect lives in `S_LOWER`, where authorization was already 20/20.
>
> **Authorization precision falls slightly at 14B**, because the newly admitted `elif` outputs are
> proposals that were previously refused, and refused proposals never had a chance to be semantically
> wrong. A *rise* in precision would be the surprise.
>
> **The 1.5B and 7B move little**, since they rarely write `elif`.

**Falsified if the repair changes the open-end result.** That would mean the two effects are entangled
and the revision-1 conclusion needs re-scoping rather than carrying forward.

**A quiet way this could go wrong, stated so it is checked:** if admitting `elif` raises yield while
*dropping* verified counts, the envelope is now admitting a class the verifier cannot judge — the exact
trade hazard 3e warns about in the other direction. Yield and precision are reported separately so this
cannot hide inside a verified rate.

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, AC confirmed, stop with `--yes` and verify.
**Rule 3** checks all three models before any generation.

---

# RESULT — open end, revision 2 under the repaired envelope

GPU window stopped and verified: every `legasus` app row `stopped`, 0 containers.

    model   rendering   too-narrow   precision   verified/80
    1.5B    SILENT         1/80        0.986         71
    1.5B    NEGATED        0/80        1.000         72
    1.5B    EXTENT         2/80        0.972         70
    7B      SILENT        17/80        0.785         62
    7B      NEGATED       15/80        0.813         65
    7B      EXTENT         4/80        0.948         73        p = 4.0e-3 / 2.8e-2 vs SILENT
    14B     SILENT        17/80        0.787         63
    14B     NEGATED       11/80        0.863         69
    14B     EXTENT         1/80        0.988         79        p = 6.2e-5 on both

    proposal yield, revision 1 -> revision 2, the envelope repair alone
      1.5B  0.704 -> 0.900       7B  0.908 -> 0.983       14B  0.775 -> 1.000

## The repair worked, and it was far bigger than the cells it was found in

`S_STRADDLE` at 14B: **6/60 authorized → 60/60**, p = 1.9e-27. The `elif` diagnosis was correct and
complete.

**But my prediction that "the 1.5B and 7B move little" is falsified.** Every model's yield rose
sharply — the 1.5B by 0.196 (p = 8.4e-8). All three write `elif` more often than I assumed, and the
envelope had been suppressing yield **across every model and every shape**, not just in the cells where
it was conspicuous enough to notice.

> Revision 1's yields were all depressed by an apparatus defect. Its *precisions* were much less
> affected, because precision is conditioned on being authorized — which is exactly why those two
> numbers are kept apart.

## My prediction about precision was wrong, and being wrong is the proof

> *"Authorization precision falls slightly at 14B... A rise would be the surprise."*

It rose: **0.806 → 0.879**. The reasoning was that newly admitted proposals never previously had a
chance to be semantically wrong, so admitting more should dilute precision. That assumed the newly
admitted class was average. It was not — the `elif` outputs were *legal realizations*, so admitting
them raised yield **and** precision together.

**That is the cleanest possible confirmation that they were legal.** Had they been junk the envelope
was rightly refusing, precision would have fallen exactly as predicted.

## The open-end result survives the repair

Preregistered: *"falsified if the repair changes the open-end result."* It does not.

    7B    too-narrow  17/80 -> 4/80    p = 4.0e-3
    14B   too-narrow  17/80 -> 1/80    p = 6.2e-5
    1.5B  1, 0, 2 out of 80            no effect, and none available — there is no headroom

`EXTENT` remains the dominant lever at both capacities that have room to move, and `NEGATED` remains
the weaker of the two interventions at both. The two effects are not entangled.

## The best configuration has changed, and it is now the largest model

    configuration        yield    precision    verified
    1.5B + NEGATED       0.900      1.000        0.900
    7B   + EXTENT        0.963      0.948        0.913
    14B  + EXTENT        1.000      0.988        0.988      [0.933, 0.998]

**14B + `EXTENT` reaches 79 of 80.** Proposal yield 1.000 — the model was never once refused across 80
samples and four contract shapes — with authorization precision 0.988.

Under `SILENT` the same model sits at 63/80, and under revision 1's envelope it looked worse still.
**Two deterministic decisions — one rendering phrase and one authority-envelope rule — moved a fixed
model from 0.625 to 0.988 end to end.** The model did not change.

This inverts what the scale window concluded. There, capacity bought yield and spent precision, and the
1.5B was the precision leader. With the renderer and the envelope both corrected, **capacity is
straightforwardly worth having**: the 14B is now the best on every column simultaneously.

## Honest limits

- The 1.5B's `EXTENT` cell (2/80 too-narrow against `SILENT`'s 1/80) is noise, not a cost. It has no
  headroom and nothing to show.
- Revision 1's numbers are history, not errata. Its *conclusions about rendering* stand; its *yield
  figures* were depressed by the envelope and should not be quoted as capability measurements.
- The envelope repair was found by one model's style preference. Nothing guarantees there is not
  another legal realization no model in this study happens to prefer — which is the argument for the
  admit list being extended whenever a new realization is observed, rather than trusted as complete.
- Still one task family, one operation, one parameter, four contract shapes.
