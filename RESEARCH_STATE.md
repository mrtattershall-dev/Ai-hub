# RESEARCH STATE — Legasus

**The repository is memory; the current gate is context.** This file is the compact handoff: what is
established, what is dead, what the apparatus guarantees, and what the next gate is. Measurement
READMEs hold the detail; commit messages hold the reasoning.

---

## The architecture, in six verbs

    OBSERVE   LegaParse    what is true about the current program
    DECIDE    LegaCore     what must become true, what must remain true, which wins on overlap
    RENDER    Renderer     the smallest sufficient model-facing representation
    PROPOSE   the model    a candidate implementation; nothing it says is authoritative
    CONSTRAIN LegaGate     is this an authorized KIND of attempt - shape, scope, surface
    PROVE     LegaVerify   does it satisfy the contract; did behaviour and structure survive
    COMMIT                 only verified truth becomes repository state

**The model proposes code. Legasus owns reality.** `ATTEMPT AUTHORITY != COMMIT AUTHORITY.`

---

## Established, with the evidence

| Claim | Evidence |
|---|---|
| Bounding the model does **not** raise capability; it converts destructive commits into refusals | `R3` and `R3P` both 8/20, p = 1.000; semantic errors 9/20 → 0/20, p = 0.0012 |
| Authorization is a strong filter and **not** a sufficient one | ran 87/87, then leaked; 1116/1130 = 0.988 over eight families; every leak caught by execution |
| `RENDER` is an architectural stage, not prompt engineering | `IMPLICIT` produced **zero** exclusion predicates in 720 generations across 4 excluded values and 3 model sizes |
| Render the **relation**, not bound metadata | 6/20 vs 17/20, p = 0.001, layout held fixed |
| Add nothing the window already answers | one redundant sentence: forbidden-line reproduction 5/40 → 22/40, p = 1.1e-4 |
| Name what is excluded; do not gesture at it | `IMPLICIT` 0/160 vs `RELATIONAL` 18/160, p = 4.6e-6, across 4 values |
| Delta phrasing moves the verified rate | three equivalent phrasings, identical plans: 55 / 59 / 67 out of 80 |
| Capacity raises proposal yield but **not** semantic precision | yield 0.875 → 0.946 → 1.000; precision 0.976 → 0.802 → 0.925 |
| Larger models make **different** errors, not fewer | 14B's leaks are 17/18 compound guards like `0 < n < 10` |
| A probe set built on one model's failures ratifies another's | without two probes the 14B scores 239/240 and looks best |
| Contract-derived probes catch what luck provided | replay: 31/31 of the leaks a pre-luck probe set would have passed |
| The pipeline generalizes across contract shape at 1.5B | 98 authorized, 98 verified, four shapes, machine-generated probes |
| State an open end RELATIONALLY; naming its absence is inert | 7B too-narrow 16/80 -> 1/80, p = 1.3e-4; NEGATED vs SILENT p = 1.000 |
| The renderer can repair a CAPACITY-INDUCED failure mode | invented bounds: 0 at 1.5B, 18/133 at 7B, removed by rendering alone |

## Dead, and staying dead

- **"other" read as "the remaining positive ones"** — `OTHER` produced *zero* `n > 0` conditions in 80.
- **window × wording interaction** — w7 p = 0.008, w8 p = 0.18, preregistered prospective p = 0.38.
  The **main** effect survives (p = 0.018). Not established.
- **"identifier naming primes copying"** — target vs non-target indistinguishable, p = 0.65.
- **"authorization precision is capacity-invariant"** — falsified, and non-monotonically.
- `R1` of ladder 1 (format confound) and `W0` of visibility rev 1 (missing program fact) are **void
  rungs**, recorded as such.

## Apparatus guarantees now mechanized

    escape-guard         collapsed escapes AND any raw control character, anywhere      7 occurrences
    sufficiency          the prompt must supply every fact the expected output needs
    interaction          logistic LRT; negative control is main effects, equal odds ratios
    contract-identity    a frozen contract compared region by region, with a mutation control
    contract probes      derived from the obligation; audit REFUSES an insufficient set
    dense equivalence    a surviving mutant is only a failure if a 605-input sweep says it differs
    conformance P1-P8    witnessed, replayable, no over-constraint, channel complete

Three controls are mandatory per family: **can the apparatus express a pass / a failure / can the model
obtain the facts.** A fourth where relevant: **is the endpoint reachable at all.**

## Metrics that must never be collapsed

    P(useful proposal)          authorized / samples
    P(correct | authorized)     the shape and scope gate alone
    P(correct | verified)       that gate plus execution
    refusal topology, realization diversity, seconds per verified change

A refusal is not a wrong commit. An authorized proposal is not a correct one. Only a verified proposal
may change repository state.

## Best configuration measured

    7B + EXTENT rendering    yield 0.900   authorization precision 0.986   verified 0.888
    1.5B + EXTENT            yield 0.725   authorization precision 1.000   verified 0.725

The first configuration where capacity is straightforwardly worth having: the renderer bought back the
precision capacity was costing, without giving up the yield capacity was buying.

## Next gates, determined by evidence rather than preference

1. **Multi-operation transactions** — every family so far has one operation. `R4` has been deferred
   four times for want of a multi-operation family; LegaCore already models provider/consumer edges and
   legal topological orders, so the apparatus exists and the family does not.
2. **Structural preservation in the loop** — `structure.mjs` and Narrowability V2 exist but no
   generation family verifies structure alongside behaviour.
3. **Two parameters** — `requestedBehaviour` declines a generic subject unless the unit has exactly one
   parameter, which is correct and is also a hard stop on broadening. Extending it is a `DECIDE`
   revision, not an edit.
4. **A 24GB card for 32B** — needs its own authorization; the standing grant is T4.

## Standing rules

Preregister before generation, freeze before running, never rescore, keep nulls. Quote tatte's words in
`COORD.md` for GPU authorization. AC power before any window. Stop with `--yes` and verify. Rule 3
before any generation. Write JS and prose with an editor, never a heredoc or a `-e` argument.
