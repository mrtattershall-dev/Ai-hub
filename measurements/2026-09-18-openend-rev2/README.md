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
