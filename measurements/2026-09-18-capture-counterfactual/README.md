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
