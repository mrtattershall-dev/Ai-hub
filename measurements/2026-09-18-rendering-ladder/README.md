# PREREGISTRATION — which part of the sibling information causes DOMAIN COLLAPSE?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Where this comes from

Naming a sibling operation's domain made the wider operation **replace its own domain with the
sibling's**: 0/232 to 127/239, `p = 4.0e-48`, confined to operations that actually contain a sibling
(0/479 elsewhere). `P(correct | assembled)` fell from 1.000 to as low as 0.050.

That result says a rendering can be actively harmful. It does not say **what about it** is harmful, and
the two candidate answers imply opposite design rules:

    the AMBIGUITY is harmful    -> RENDER must never state a fact without stating its resolution
    the INFORMATION is harmful  -> RENDER must state each operation in isolation, full stop

## The ladder

One axis, four levels, increasing in what is said about the siblings:

    ISOLATED           nothing about siblings                    replication control
    SIBLING_EXISTS     they exist; NO domains named              separates existence from domain
    SIBLING_NAMED      their domains named; no resolution        replication of the collapse
    SIBLING_RESOLVED   their domains named AND resolved          the repair test

`SIBLING_EXISTS` is the control that makes the diagnosis possible. If the collapse needs a specific
domain to copy, this level cannot produce it. If it collapses anyway, then merely mentioning that other
work exists destabilizes an operation's contract, which would be a larger and more uncomfortable finding
than the original.

`SIBLING_RESOLVED` deliberately hands over `DECIDE`'s **conclusion**, which the previous family withheld.
That is not a repeat of the substitutability question — that question was asked and answered badly. It
asks a different one: **is the damage repairable by rendering at all?**

## Hypothesis

> `DOMAIN COLLAPSE` is caused by an unresolved ambiguity, not by the presence of sibling information. An
> operation told that a narrower behaviour overlaps its own domain, and not told how that is resolved,
> has no way to choose between narrowing itself, excluding the other, and doing nothing — and resolves it
> by copying its neighbour.

## Predictions

    level               collapse rate        P(correct | assembled)
    ISOLATED                 ~0                    ~1.000
    SIBLING_EXISTS           ~0                    ~1.000
    SIBLING_NAMED         ~50% (replicates)     degraded, as low as ~0.05
    SIBLING_RESOLVED      substantially below SIBLING_NAMED, correctness restored toward 1.000

**Primary endpoint.** Collapse rate — `ADOPTED / guards whose own domain contains a sibling` — across the
four levels, with `ISOLATED` and `SIBLING_NAMED` replicating the previous family within this run.

**Secondary.** `P(correct | assembled)` under `DECIDE ON` across the four levels.

**Guardrail, and it is a hard one.** `LEAKED` must remain **0** in every condition. The previous family
found 110 wrong contracts and leaked none; if a rendering ever produces a wrong contract that passes
verification, that is the most important line in the table regardless of what the collapse rates do.

## Falsification

- **If `SIBLING_RESOLVED` collapses at a rate similar to `SIBLING_NAMED`**, the ambiguity hypothesis is
  false: sibling information is harmful in itself and cannot be repaired by resolving it. The rendering
  rule becomes the stricter one.
- **If `SIBLING_EXISTS` collapses**, the effect does not require a domain to copy, and the mechanism I
  named is wrong.
- **If `SIBLING_NAMED` does not replicate**, the effect is not stable and nothing here can be concluded.
- **If any condition leaks**, the architecture's central separation has a hole and that supersedes this
  family's question entirely.

## What each outcome licenses

This family exists to produce a **measured rendering rule**, in the same form as `EXTENT` vs `SILENT`.
Both outcomes give one, and they are incompatible, which is what makes it worth running.

## Controls, witnessed before any tokens were spent

    E0   prompts differing between conditions 3/3   derived order unchanged [fifty high micro]
    E1   prompts differing between conditions 3/3   derived order unchanged [high micro low]
    E2   prompts differing between conditions 3/3   derived order unchanged [five micro low]
    E3   prompts differing between conditions 3/3   derived order unchanged [micro low mid]

All **four** levels are asserted pairwise distinct for every operation — checking only two would let a
level that silently renders the same text as its neighbour be counted as a separate condition. Both
naming levels are asserted to name every sibling, and `SIBLING_EXISTS` is asserted to name **none** of
them, or it cannot separate existence from domain. The plan is asserted unchanged across levels, so the
family varies one thing.

The ablation instrument still registers PASS at 0 violated edges and FAIL at 1, 2 and 3 on perfect
fragments, and the rescue path is still proven to exist at all three doses.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    conditions   ISOLATED, SIBLING_EXISTS, SIBLING_NAMED, SIBLING_RESOLVED
    samples      20 transactions per case per condition per model
    temperature  0.6
    cases        E0, E1, E2, E3 generate; UND refuses

---

# RESULT — CROSS-OBLIGATION CAPTURE, and a rendering rule that does not depend on any capacity claim

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**
**Every number below is generated from `RESULT.json` by `report-ladder.mjs`. No number here was read off a
console.**

## The ladder

    condition          P(correct|assembled)   guards containing a sibling   ADOPTED     EXCLUDED
    ISOLATED                 1.000                     237                   0   0.0%      0
    SIBLING_EXISTS           0.996                     240                   0   0.0%      0
    SIBLING_NAMED            0.550                     236                 125  53.0%      1
    SIBLING_RESOLVED         0.772                     239                  68  28.5%      0

`SIBLING_NAMED` replicated the previous family almost exactly — **53.0% against 53.1%**.

## The phenomenon has a name, and `SIBLING_EXISTS` is what earns it

**CROSS-OBLIGATION CAPTURE.** An operation with domain `D_A`, shown another operation's domain `D_B`,
begins implementing `D_B`. It is not context confusion and not "more words hurt":

    SIBLING_EXISTS   other work exists, NO semantics   0 / 240 captured   P(correct) 0.996
    SIBLING_NAMED    the sibling's actual domain       125 / 236          P(correct) 0.550

    p = 8.6e-49

Being told that other operations exist is **harmless**. Being told *what they mean* is what does the
damage. The hazard is the foreign **semantic content**, not the presence of additional text.

`EXCLUDED` — the defensive form this whole line of work originally predicted — occurred **once** in 952
eligible guards, across four conditions and three capacities.

## Resolution repairs it, but only above a capacity threshold — a crossover interaction

    capture rate              1.5B       7B       14B
    SIBLING_NAMED            54/76      6/80     65/80
    SIBLING_RESOLVED         66/80      2/79      0/80

    P(correct|assembled)      1.5B       7B       14B
    ISOLATED                 1.000     1.000     1.000
    SIBLING_EXISTS           0.986     1.000     1.000
    SIBLING_NAMED            0.328     0.925     0.338
    SIBLING_RESOLVED         0.023     0.975     0.975

    NAMED vs RESOLVED, correctness:
      1.5B   19/58 -> 1/43     p = 8.5e-5    significantly WORSE
      7B     74/80 -> 77/79    p = 0.28      unchanged
      14B    27/80 -> 78/80    p = 2.9e-19   significantly BETTER, and capture goes to ZERO

**The same rendering change significantly helps the largest model and significantly harms the smallest.**
At 14B the resolved prompt cures capture completely and the model writes the correct guard —
`n < 10 and n != 3` 57 times, and the genuinely defensive `0 < n < 10 and n != 3` twice. At 1.5B it writes
`n < 0` 55 times and degenerates further, including one guard that enumerated
`n == 0 or n == 1 or ... or n == 9`.

**A precision note against this family's own earlier reading.** From partial console output during the run
it looked as though resolution made 1.5B's capture *worse*. On the capture endpoint that is **not**
established: 54/76 to 66/80 gives `p = 0.13`. It is established on the correctness endpoint (`p = 8.5e-5`).
Two different endpoints, and only one of them supports the stronger sentence.

## The architectural conclusion, which needs no capacity claim at all

    ISOLATED       1.000   1.000   1.000
    best rival     0.986   1.000   0.975

**`ISOLATED` is optimal at every capacity tested, and no condition that exposes foreign semantics beats it
anywhere.** That is a dominance result rather than a comparison of means, so it does not rest on the
crossover, on the non-monotone capture curve, or on any claim about what scaling does.

> **SEMANTIC LEAST PRIVILEGE.** Legasus may know everything — domains, containment, precedence, ownership,
> preservation, transaction structure. Each `PROPOSE` call receives only the semantic facts required to
> discharge the authority it was granted. Composition knowledge belongs to `DECIDE`, not automatically to
> `PROPOSE`.

This reframes `R4`. Proposing each operation in isolation was adopted as a simplification; it now looks
like **necessary isolation**. `R4` may have succeeded so cleanly precisely because no model was ever given
the opportunity to confuse semantic ownership across operations.

And it gives `RENDER` a second obligation, the mirror of the one `sufficiency.mjs` already enforces:

    SUFFICIENCY      does the prompt contain every fact required for the authorized operation?
    NONINTERFERENCE  does it OMIT semantic facts belonging to other operations?

Not too little, and **not too much**.

## The hard guardrail held, again

    condition          transactions carrying a captured contract   CONSTRAIN   PROVE   LEAKED
    ISOLATED                          0                               0          0       0
    SIBLING_EXISTS                    0                               0          0       0
    SIBLING_NAMED                   108                              15         93       0
    SIBLING_RESOLVED                 56                              19         37       0

**Zero leaks in every condition.** With the previous family that is **274 transactions carrying the wrong
semantic contract, and none reached commit.**

The division of labour is visible in the same table. A guard like `if n < 0: return "low"` is correct
syntax, a legal fragment shape, the right parameter, a declared result — `CONSTRAIN` *should* admit it, and
mostly did. It is simply false. `PROVE` rejected it because the contract requires an answer of `"low"`
somewhere in `n < 10` that is not in `n < 0`, and no such answer exists.

    CONSTRAIN   is this an authorized kind of attempt?   yes
    PROVE       does this attempt mean the required thing?   no

Teaching `CONSTRAIN` to reject foreign domains would have turned it into a second semantic reasoner. It
did not need to be taught anything, and neither did `PROVE` — the contract already said what was true.

## Apparatus rule promoted, after two near-misses in one run

    JSON ARTIFACTS ARE AUTHORITATIVE. CONSOLE OUTPUT IS NON-EVIDENTIARY.

Two presentation defects in this run each produced a plausible wrong reading: `padEnd(15)` cannot pad the
16-character label `SIBLING_RESOLVED`, so it ran into its case name and an entire condition appeared to be
missing from the run; and a greedy `sed` crossed logical record boundaries and reported `0.900` for a cell
whose true value was `0.000`. Neither was a measurement error — both were **reporting** errors wearing the
shape of measurements.

`report-ladder.mjs` now generates the summary **from the finalized artifact**, so there is one reporting
path rather than two that can disagree.
