# PREREGISTRATION — separating SEMANTIC RELATIONSHIP from SURFACE SIMILARITY

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Where this comes from

The counterfactual family showed that the same observable error has different drivers at different
capacities. Stating the same sibling domains and changing only their relevance:

    capture              1.5B       7B        14B
    IN_CHAIN           51/78       5/80     63/80
    ELSEWHERE          40/79       0/80      0/80

    14B    63/80 -> 0/80     p = 8.2e-29    eliminated entirely
    1.5B   51/78 -> 40/79    p = 0.076      persists

The 14B failure is **relationship-sensitive**. The 1.5B failure is characterized only by what it is
**not** sensitive to. Surface attraction, copying, semantic anchoring and pattern interference all
predict that equally well, and naming one would be inventing a mechanism from a single contrast.

## The 2x2

`RELATIONSHIP` and `SURFACE` are manipulated independently, with the local obligation held fixed.

                         SIMILAR surface        DISSIMILAR surface
    in the chain         replication (50.0%)           A
    elsewhere            replication (16.7%)           B

**The operational definition of surface similarity, fixed before the run.** The `SIMILAR` form presents a
**digit numeral** in the same `below <digit>` / `above <digit>` construction the local obligation itself
uses. The `DISSIMILAR` form denotes **the same set** with no digit numeral and no construction matching
the local obligation's own.

    local obligation      "For every value below 10, however small"
    SIMILAR sibling       "For every value below 0, however small"     below + digit, matching
    DISSIMILAR sibling    "For every negative value"                   no digit, no match

The plan is **never** derived from the alternative wording. `delta` stays canonical for `DECIDE`;
`deltaAlt` is used only for rendering. That is the architecture's own division, and it is also what keeps
this manipulation clean.

The exclusion `where n is not 3` stays in digit form in both, because it concerns the preserved behaviour
rather than the sibling domain under test — rendering it as a word would invite `n != three` and a
`CONSTRAIN` refusal, which would be a confound rather than a manipulation.

## The condition that decides whether a null means anything

`OWN_DISSIMILAR` renders the operation's **own** obligation in the alternative wording, with no siblings
at all.

If capture falls under `DISSIMILAR`, there are two explanations: surface similarity drove the capture, or
**the alternative wording was simply not understood**. Those are different findings, and the second would
make the whole column uninterpretable — the `W0` defect in a new place. If the model still produces the
right domain under `OWN_DISSIMILAR`, the wording is comprehensible and a fall is about similarity.

## Hypotheses

> If 1.5B capture is driven by surface form, it tracks the **columns** — it should fall under
> `DISSIMILAR` even in `ELSEWHERE`, where no relationship story exists.

> If 14B capture is driven by the relationship, it tracks the **rows** — it should stay high under
> `IN_CHAIN_DISSIMILAR` and near zero in both `ELSEWHERE` cells, whatever the surface.

**Primary endpoint.** Capture rate per cell, and the `RELATIONSHIP x SURFACE` interaction, per model.

**Secondary.** `P(correct | assembled)` per cell. **Comprehension gate.** `OWN_DISSIMILAR` must produce
the correct domain at a rate comparable to `ISOLATED`, or the `DISSIMILAR` column is void and will be
reported as void rather than as a result.

**Guardrail.** `LEAKED` must stay 0. Cumulative it is 0 of 421.

## Falsification

- **If 1.5B capture is as high under `ELSEWHERE_DISSIMILAR` as under `ELSEWHERE_SIMILAR`**, surface
  similarity is not the driver either, and the 1.5B mechanism is something neither relationship nor
  surface form — a genuinely open question rather than a choice between two named options.
- **If 14B capture falls under `IN_CHAIN_DISSIMILAR`**, the 14B story is not purely relational and the
  clean `p = 8.2e-29` reading needs qualifying.
- **If `OWN_DISSIMILAR` degrades correctness**, the `DISSIMILAR` column is uninterpretable and the family
  reports a void rung rather than a finding.
- **If the `SIMILAR` cells do not replicate** their measured values, nothing here can be concluded.

## Controls, witnessed before any tokens were spent

    E1   prompts differing between conditions 3/3   derived order unchanged [high micro low]
    E2   prompts differing between conditions 3/3   derived order unchanged [five micro low]
    E3   prompts differing between conditions 3/3   derived order unchanged [micro low mid]

**The factors are asserted crossed, not confounded.** Within a surface, both relationships state the same
sibling text; within a relationship, both surfaces carry the same framing lines. The surface definition is
asserted to actually hold — each `DISSIMILAR` wording is checked to contain **none** of the digits of the
sibling's own bound, so the manipulation cannot silently fail to happen. And the four cells are asserted
to span at most 90 characters in length, so "more text" cannot be a rival explanation for any of them.

`E0` is dropped: it has no operation whose domain contains a sibling, so it contributes zero eligible
guards. Its disjoint null is already established three times over.

## Reporting

`RESULT.json` is authoritative; console output is non-evidentiary. Every number in the result section is
generated from the artifact.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    conditions   ISOLATED, OWN_DISSIMILAR,
                 IN_CHAIN_SIMILAR, IN_CHAIN_DISSIMILAR, ELSEWHERE_SIMILAR, ELSEWHERE_DISSIMILAR
    samples      20 transactions per case per condition per model
    temperature  0.6
    cases        E1, E2, E3
