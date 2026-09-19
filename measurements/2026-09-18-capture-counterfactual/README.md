# PREREGISTRATION — is CROSS-OBLIGATION CAPTURE composition reasoning, or surface copying?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Where this comes from

Capture is **relational**, not attraction to foreign content. Shown in the same paragraph, the same
sentence frame and the same position:

    relation                     shown   ADOPTED
    INSIDE, same shape            595      188     31.6%
    CONTAINS the operation        117        7      6.0%
    INSIDE, different shape       119        5      4.2%
    DISJOINT                      119        0      0.0%      p = 5.4e-18 vs INSIDE same shape

That ordering is **consistent with the model doing something defensible and getting it backwards**:
narrowing itself because it was shown a narrower bound that genuinely does constrain it. Every sibling
shown so far really is in the chain and really is inside the operation's domain, so a wrong-but-rational
precedence story is still available as an explanation.

This family removes that story while holding the text almost fixed.

## The discriminator

    ISOLATED    no sibling paragraph                                    replication control
    IN_CHAIN    "requested for the same function, added to this same    replication
                 chain of conditions"
    ELSEWHERE   "handled by a DIFFERENT function elsewhere in the       the discriminator
                 codebase; not part of this function and do not
                 affect your condition"

**`IN_CHAIN` and `ELSEWHERE` state exactly the same sibling domains**, in the same shape, at the same
narrowness, in the same position, at nearly the same length. The only thing that changes is whether the
sibling has anything to do with this function.

## Hypothesis and predictions

> If capture is composition reasoning, however wrong, it requires a sibling that could constrain the
> operation. Removing the sibling from the chain removes the reason to narrow.

    ISOLATED     capture ~0        (replication)
    IN_CHAIN     capture ~32%      (replication)
    ELSEWHERE    capture MUCH LOWER than IN_CHAIN

**Primary endpoint.** Capture rate — `ADOPTED / guards whose own domain contains a sibling's` — for
`ELSEWHERE` against `IN_CHAIN`.

**Secondary.** `P(correct | assembled)`, and the per-capacity breakdown, since the previous family found
a crossover.

**Guardrail.** `LEAKED` must remain 0. Cumulative across families it is 0 of 274.

## Falsification, and this is the interesting direction

- **If `ELSEWHERE` matches `IN_CHAIN`**, the hypothesis is false and the phenomenon is **surface
  copying**: a narrower same-shape bound in the context gets adopted regardless of whether it has any
  bearing on the operation. That would be the stronger and more uncomfortable result, and it would make
  `SEMANTIC LEAST PRIVILEGE` a much broader rule than "do not leak composition facts" — it would mean
  *any* nearby narrower bound of the same shape is hazardous, whatever its provenance.
- **If `ELSEWHERE` is much lower**, capture is tied to the operation's own composition context, and the
  rule stays scoped to composition information.
- **If `IN_CHAIN` does not replicate**, nothing here can be concluded.

## Controls, witnessed before any tokens were spent

    E0   prompts differing between conditions 3/3   derived order unchanged [fifty high micro]
    E1   prompts differing between conditions 3/3   derived order unchanged [high micro low]
    E2   prompts differing between conditions 3/3   derived order unchanged [five micro low]
    E3   prompts differing between conditions 3/3   derived order unchanged [micro low mid]

Every condition is asserted pairwise distinct for every operation. **Both naming conditions are asserted
to state every sibling domain** — if they differed in what they say the siblings *are*, the comparison
would measure content rather than relevance and the family would be void. And their rendered lengths are
asserted to differ by at most 60 characters, so "more text" cannot be a rival explanation.

The plan is asserted unchanged across conditions. The ablation instrument still registers PASS at 0
violated edges and FAIL at 1, 2 and 3 on perfect fragments, and the rescue path is still proven to exist
at all three doses.

## Reporting

Per the rule promoted from the previous run: **`RESULT.json` is authoritative, console output is
non-evidentiary.** Every number in the result section is generated from the artifact by
`report-ladder.mjs` and `capture-relation.mjs`.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    conditions   ISOLATED, IN_CHAIN, ELSEWHERE
    samples      20 transactions per case per condition per model
    temperature  0.6
    cases        E0, E1, E2, E3 generate; UND refuses

---

# RESULT — the prediction holds at 14B, fails at 1.5B, and the phenomenon splits in two

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**
**Every number below is generated from `RESULT.json`. No number here was read off a console.**

## The discriminator

    condition     P(correct|assembled)   guards containing a sibling   captured
    ISOLATED            1.000                      239                 0    0.0%
    IN_CHAIN            0.524                      238               119   50.0%
    ELSEWHERE           0.910                      239                40   16.7%

    POOLED   119/238 vs 40/239    p = 7.1e-15

`IN_CHAIN` replicated (50.0% here, 53.0% and 53.1% in the two previous families). Pooled, **relevance
matters**: stating the same domains as belonging to a different function cuts capture by two thirds.

## But the pooled number hides the result

    capture              1.5B       7B        14B
    ISOLATED            0/79       0/80      0/80
    IN_CHAIN           51/78       5/80     63/80
    ELSEWHERE          40/79       0/80      0/80

    14B    63/80 -> 0/80     p = 8.2e-29    eliminated entirely
    7B      5/80 -> 0/80     p = 0.059      low baseline, not significant
    1.5B   51/78 -> 40/79    p = 0.076      NOT significant - it persists

    P(correct|assembled)  1.5B       7B        14B
    ISOLATED             1.000     1.000     1.000
    IN_CHAIN             0.240     0.925     0.300
    ELSEWHERE            0.429     0.988     1.000

**These are two different phenomena wearing one signature.**

At **14B**, capture is entirely contingent on the sibling actually being in the chain. The identical
domains, reframed as belonging to a different function, remove it **completely** and restore
`P(correct|assembled)` to **1.000**. What it writes changes accordingly: 58 of 80 guards are the correct
`n < 10 and n != 3`. That is wrong composition reasoning about a relationship that genuinely exists — the
model narrows itself because it believes the sibling constrains it, and stops when told it does not.

At **1.5B**, capture survives the same disclaimer at 51%: 33 guards still wrote `n < 0` for an operation
asked for `n < 10`, after being told in the same prompt that `n < 0` is handled by a different function
and does not affect its condition. There is no composition story available. That is **surface copying** of
a narrower same-shape bound.

## Against my own preregistration

The prediction was "`ELSEWHERE` MUCH LOWER than `IN_CHAIN`". It is **confirmed pooled and at 14B**, and
**falsified at 1.5B** (`p = 0.076`). Recorded as a split rather than as a win, because the pooled number
alone would have read as clean support for a hypothesis that one of the three models contradicts.

The honest form of the finding is therefore narrower than the question asked:

> Whether `CROSS-OBLIGATION CAPTURE` is composition reasoning or surface copying **is not a property of
> the phenomenon. It is a property of the model.** The same prompt manipulation abolishes it at 14B and
> leaves it essentially intact at 1.5B.

## What this does and does not change for the architecture

It does **not** weaken `SEMANTIC LEAST PRIVILEGE`, and the reason is the same dominance argument as
before, now measured a third time:

    P(correct|assembled)  1.5B       7B        14B
    ISOLATED             1.000     1.000     1.000
    best rival           0.429     0.988     1.000

**`ISOLATED` is still optimal at every capacity.** The best that careful framing achieves is *matching* it
at 14B while remaining far worse at 1.5B. A rendering rule that only works above a capacity threshold is
not a rule the architecture can rely on, because the architecture's claim is that the proposal source is
**substitutable**.

It does sharpen what the rule is protecting against. There are two hazards, not one:

    composition-linked capture   the model misreads a real relationship   fixable by framing, at capacity
    surface capture              a narrower same-shape bound is copied    not fixable by framing

Only the first is a reasoning error. The second is closer to interference, and no amount of correct
explanation removes it.

## The hard guardrail, a third time

    condition     transactions carrying a captured contract   CONSTRAIN   PROVE   LEAKED
    ISOLATED                       0                              0         0        0
    IN_CHAIN                     107                             12        95        0
    ELSEWHERE                     40                             25        15        0

**Zero leaks.** Cumulative across the three families: **421 transactions carrying the wrong semantic
contract, and none reached commit.**

Worth noting where the work moved. Under `ELSEWHERE` at 1.5B the captured fragments were rejected by
`CONSTRAIN` more often than by `PROVE` (25 against 15), the reverse of `IN_CHAIN` (12 against 95) — the
small model's output degraded in form as well as in meaning. The total held regardless of which stage
caught it, which is what having two independent stages is for.
