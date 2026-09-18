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
| A gate with only a REFUSE list silently suppresses yield everywhere | admitting elif raised yield for all three models, 1.5B p = 8.4e-8 |
| R4: multi-operation correctness is ARCHITECTURAL | 162 assembled, 162 verified, P(correct|assembled) 1.000 at every capacity, model never saw the other operation |
| Order is derived from domains, not presentation | T_CONTAIN and T_REVERSE identical at all three models |
| Transaction yield is the SQUARE of operation yield | 1.5B op-yield 0.833, predicted 0.694, observed 0.700 |

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
    authority envelope   ONE opinion, with an ADMIT list of legal realizations and a refuse list

Every stage that can REJECT needs an ADMIT list of legal realizations, not only a refuse list.

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

    14B + EXTENT    yield 1.000   precision 0.988   verified 0.988   [0.933, 0.998]
    7B  + EXTENT    yield 0.963   precision 0.948   verified 0.913
    1.5B + NEGATED  yield 0.900   precision 1.000   verified 0.900

Two deterministic decisions - one rendering phrase and one authority-envelope rule - moved a FIXED 14B
from 0.625 to 0.988 end to end. This INVERTS the scale window: with both defects corrected, capacity is
straightforwardly worth having and the 14B is best on every column at once. The scale window was not
wrong about what it measured - it was measuring a system with two correctable defects in it.

## Next gates, determined by evidence rather than preference

1. **THREE-operation transactions** — R4 passed at two operations with zero probe failures, which means
   the transaction verifier HAS NO LIVE CATCH yet. Within a two-operation family the composition can
   only go wrong if the ordering does, and Legasus owns ordering. Three operations give more ordering
   relations and the first realistic chance for a model-produced domain to differ from the requested
   one, which is the only way an authorized fragment can break a transaction.
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
