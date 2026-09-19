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
| Transaction yield is the SQUARE of operation yield | 1.5B op-yield 0.833, predicted 0.694, observed 0.700; cubed at three ops, 0.632 predicted vs 0.625 |
| T3: three operations, same result | 105 assembled, 105 verified, P(correct|assembled) 1.000 at every capacity |
| DECIDE ordering is LOAD-BEARING, by ablation | same fragments re-assembled in presentation order: 105/105 -> 0/105, every failure a DEAD OPERATION |
| DECIDE's cost is SPECIFIC to derived precedence | paired ablation over 0/1/2/3 violated edges: disjoint 0/54 broken, constrained 162/162 broken, p = 2.8e-52. The disjoint files really were rebuilt in a different order and verified anyway |
| NO realization substitutes for DECIDE, at any capacity | 0/648 guards defended against a sibling operation. Defence against the fact the PROMPT NAMES scales 48% -> 78% -> 96% across 1.5B/7B/14B; against the unnamed one it is flat at ZERO. A realization can only defend against facts its own prompt names, and cross-operation precedence is a property of the TRANSACTION, not of any operation |
| SEMANTIC LEAST PRIVILEGE, and it needs no capacity claim | ISOLATED is optimal at EVERY capacity (1.000/1.000/1.000) and no condition exposing foreign semantics beats it anywhere. A dominance result, not a comparison of means. Composition knowledge belongs to DECIDE, not automatically to PROPOSE - which reframes R4's per-operation isolation as NECESSARY rather than convenient |
| It is the foreign SEMANTICS, not the extra text | SIBLING_EXISTS (other work exists, no domains) 0/240 captured, P(correct) 0.996; SIBLING_NAMED (their domains) 125/236, P(correct) 0.550, p = 8.6e-49 |
| CAPTURE IS TWO PHENOMENA, and which one you have is a property of the MODEL | same sibling domains, only relevance changed: 14B 63/80 -> 0/80 (p = 8.2e-29, P(correct) back to 1.000) but 1.5B 51/78 -> 40/79 (p = 0.076, persists). ESTABLISHED AND NO MORE: 1.5B capture is substantially LESS SENSITIVE to whether the foreign domain is actually relevant than 14B capture is. 33 guards at 1.5B wrote n < 0 for an operation asked for n < 10 AFTER being told n < 0 belongs to a different function. The 14B failure is relationship-sensitive; the 1.5B mechanism is NOT YET ISOLATED - surface attraction, copying, anchoring and pattern interference are all live and naming one now would invent a mechanism from one contrast |
| ISOLATED dominates at every capacity, measured THREE times | 1.000/1.000/1.000 in all three families; the best rival reaches 1.000 only at 14B and 0.429 at 1.5B. A rendering rule that works only above a capacity threshold is not one the architecture can rely on, because the architecture's claim is that PROPOSE is substitutable |
| NONINTERFERENCE is mechanized, not just measured | `legarender/noninterference.mjs` - admit cases are the prompts that measured 1.000, catch cases the prompts that produced the capture, plus both negative controls |
| CAPTURE IS RELATIONAL, not attraction to foreign content | in the SAME paragraph and slot: a sibling INSIDE the operation's domain and of the same shape is adopted 188/595 (31.6%); one that CONTAINS it 6.0%; one of a different shape 4.2%; a DISJOINT one 0/119. p = 5.4e-18 against disjoint. The model appears to treat a shown narrower bound of the same form as a correction to its own threshold. Still confounded: narrower vs same-shape, and every sibling shown was genuinely part of the transaction |
| CROSS-OBLIGATION CAPTURE repairs only above a capacity threshold | crossover interaction, both directions significant: 1.5B 19/58 -> 1/43 p = 8.5e-5 WORSE; 14B 27/80 -> 78/80 p = 2.9e-19 cured, capture 65/80 -> 0/80. The same rendering helps the largest model and harms the smallest |
| RENDER needs a NONINTERFERENCE proof, not just sufficiency | sufficiency.mjs asks whether the prompt contains every required fact; the mirror obligation is whether it OMITS semantic facts belonging to other operations. Not too little AND not too much |
| A WRONG CONTRACT never reached commit, 0 leaks in 421 | DOMAIN COLLAPSE is the right implementation of the WRONG CONTRACT - a failure mode no earlier family produced, and one nobody designed. Across three families 421 transactions carried a captured contract: CONSTRAIN refused 85, PROVE rejected 336, LEAKED 0. P(correct\|assembled) fell to 0.050 while P(correct\|verified) stayed 1.000. Not circular: probes come from the CONTRACT, never from the proposal |
| DOMAIN COLLAPSE: naming a sibling's domain makes the wider operation ADOPT it | 0/232 -> 127/239 (53.1%), p = 4.0e-48, confined to operations that contain a sibling (0/479 elsewhere). `low`, asked for n < 10, wrote n < 0 89 times. EXCLUSION never once occurred: 0 of 1429 guards. Capacity does not protect - 1.5B 73%, 7B 6%, 14B 80%, the largest model worst, non-monotonicity recorded as observed and NOT explained |
| RENDER: stating more is not the same as stating what is DECIDABLE | adding a true fact the model cannot resolve is not neutral - it cost up to 95% of P(correct|assembled), and the damage landed in the HEALTHY arm |
| A verdict computed from the PLAN is not a measurement | `reachability` never saw the emitted code, so its verdict was a pure function of (plan, order) and condemned self-defending realizations containing no dead code. Fixed by `reachabilityExecuted`; the planned version is KEPT, because the GAP between the two is what a self-defending realization looks like |
| An ablation must not move its own expectations | probe expectations were recomputed from the presented order, so the broken program was graded against a broken expectation and the probes agreed by construction. That, with the analytic deadness term, fully explains the original `dead-op 105 / probe-fail 0` split |
| Models do not get the domain wrong when RENDER states it | 343 authorized T3 fragments, ZERO with a domain other than requested |
| CONSTRAIN provides INTERFACE PROTECTION, not semantic redundancy | corrected ablation: 14 of 28 refusals do not load unchanged; only 1 of 28 is a case PROVE would also catch |
| An ablation that REPAIRS the proposal is not an ablation | revision 1 measured CONSTRAIN OFF + repair and reached the opposite conclusion; void |
| OBSERVE is NOT established in this family | derived 624/692, blind-top 295/692, blind-BOTTOM 624/692 - identical to derived |
| The necessity table is a first-class artifact | NECESSITY.md - what happens when each stage alone is removed |
| Ablation finds defects it was not built to find | it rediscovered the elif over-constraint blind: 45 correct programs discarded under the old envelope |

## Dead, and staying dead

- **"other" read as "the remaining positive ones"** — `OTHER` produced *zero* `n > 0` conditions in 80.
- **window × wording interaction** — w7 p = 0.008, w8 p = 0.18, preregistered prospective p = 0.38.
  The **main** effect survives (p = 0.018). Not established.
- **"identifier naming primes copying"** — target vs non-target indistinguishable, p = 0.65.
- **"authorization precision is capacity-invariant"** — falsified, and non-monotonically.
- **"a realization can defend itself only against facts its own prompt names"** — proposed by the DECIDE
  specificity family (it fit both OBSERVE's 145 substitutions and DECIDE's zero), tested directly, and
  **falsified**. Naming the sibling facts produced 0 exclusions in 1429 guards and 53.1% DOMAIN COLLAPSE
  instead. The missing thing was never the fact; it was the derivation over the facts.
- **"the DECIDE dose-response is a gradient"** — preregistered, apparatus proven able to register it,
  **not observed**. The response is a step. Preserved as a null, not repaired.
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

1. **Ablate `CONSTRAIN`, offline.** The ordering ablation cost nothing and produced the largest
   separation in the project. `CONSTRAIN`'s value has only ever been shown by accident — an envelope
   defect that suppressed yield. The direct question is whether it is REDUNDANT with `PROVE`: take
   every refused raw output already on disk, force-assemble whatever can be assembled, and run the
   contract probes. Three outcomes, each meaning something different:
   refused-and-would-fail-`PROVE` (redundant but cheap), refused-and-would-PASS-`PROVE`
   (over-constraining — hazard 3e), refused-and-unassemblable (doing what `PROVE` structurally cannot).
2. **A mostly-disjoint transaction family.** The ordering ablation used nested cases, where ordering
   matters most. A family where most pairs are disjoint should show a much SMALLER ablation effect, and
   if it does not, the effect is not about ordering at all.
3. **Structural preservation in the loop.** `structure.mjs` and Narrowability V2 exist; no generation
   family verifies structure alongside behaviour.
4. **Two parameters.** `requestedBehaviour` correctly declines a generic subject unless the unit has
   exactly one parameter. Extending it is a `DECIDE` revision, not an edit.
5. **A 24GB card for 32B** — needs its own authorization; the standing grant is T4.

## Standing rules

Preregister before generation, freeze before running, never rescore, keep nulls. Quote tatte's words in
`COORD.md` for GPU authorization. AC power before any window. Stop with `--yes` and verify. Rule 3
before any generation. Write JS and prose with an editor, never a heredoc or a `-e` argument.
