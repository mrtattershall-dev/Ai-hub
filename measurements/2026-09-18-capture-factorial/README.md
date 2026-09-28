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

---

# RESULT — the comprehension gate fired, and one of my own falsification conditions triggered

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**
**Every number below is generated from `RESULT.json` by `report-factorial.mjs`.**

## The comprehension gate, reported first because it decides what counts

    model    ISOLATED        OWN_DISSIMILAR       p
    1.5B     1.000  37/37    0.794  27/34      4.1e-3    DEGRADED
    7B       1.000  60/60    0.797  47/59      1.2e-4    DEGRADED
    14B      1.000  60/60    1.000  60/60      1.0       clean

**The `DISSIMILAR` column is VOID at 1.5B and at 7B**, exactly as preregistered. The alternative wording
is not reliably understood at those capacities, so a fall in capture there cannot be attributed to surface
similarity — the model may never have extracted the sibling's domain at all, which changes the semantic
content of the manipulation and not just its surface.

That matters because the void numbers are *suggestive*: at 1.5B, `ELSEWHERE_SIMILAR` 41/80 against
`ELSEWHERE_DISSIMILAR` 17/75, `p = 2.6e-4`. **That is not reported as a surface effect.** It is exactly
what an uninterpretable cell looks like when you want it to say something, and the gate exists so that
wanting it is not enough.

At **14B** comprehension is perfect — 60/60 — so the `DISSIMILAR` sibling conveys the same fact and the
column is interpretable.

## 14B, the interpretable cell: BOTH factors matter

                    SIMILAR       DISSIMILAR
      IN_CHAIN       61/80          21/80
      ELSEWHERE       0/80           0/80
      ISOLATED        0/80

    RELATIONSHIP   in-chain 82/160  vs elsewhere 0/160   p = 2.8e-31
    SURFACE        similar  61/160  vs dissimilar 21/160  p = 4.0e-7
    SURFACE within ELSEWHERE   0/80 vs 0/80              p = 1.0

Two things, and they compose rather than compete:

- **The relationship is necessary.** `ELSEWHERE` is `0/160` under *both* surfaces. Nothing about surface
  form produces capture when the sibling is declared to belong to another function.
- **Given the relationship, surface similarity strongly modulates the rate.** `61/80` to `21/80` with the
  same semantic content, the same relationship, and only the wording changed.

## Against my own preregistration

I listed this as a falsification condition:

> **If 14B capture falls under `IN_CHAIN_DISSIMILAR`**, the 14B story is not purely relational and the
> clean `p = 8.2e-29` reading needs qualifying.

**It fell.** 61/80 to 21/80, `p = 4.0e-7`. So the qualification is owed, and here it is: the previous
family's conclusion — "14B capture is relationship-sensitive" — is **correct but incomplete**. The
relationship is a *precondition*, not the whole driver. Same relationship, same meaning, different
wording, and capture drops by two thirds.

The earlier `p = 8.2e-29` is not wrong; it measured a real and total effect of removing the relationship.
It simply could not see that surface form also matters, because surface was held constant at `SIMILAR`
throughout.

## 7B is essentially immune, and remains unexplained

    IN_CHAIN_SIMILAR 1/80   IN_CHAIN_DISSIMILAR 0/80   ELSEWHERE both 0/80

**1 capture in 320 eligible guards.** Consistent with the 5/80 and 6% seen in the two previous families.
Three families now show the same non-monotonicity — 1.5B and 14B susceptible, 7B not — and it is still
recorded as observed and **not explained**. One model in one family is an anomaly; the same model in three
families is a fact that needs its own experiment, not a sentence of speculation.

## Correctness, and the dominance result for the fourth time

    condition             1.5B      7B        14B
    ISOLATED              1.000     1.000     1.000
    OWN_DISSIMILAR        0.794     0.797     1.000
    IN_CHAIN_SIMILAR      0.000     0.983     0.183
    IN_CHAIN_DISSIMILAR   0.667     0.983     0.617
    ELSEWHERE_SIMILAR     0.111     0.967     1.000
    ELSEWHERE_DISSIMILAR  0.615     0.983     1.000

**`ISOLATED` is 1.000 at every capacity, and not one of the five other conditions beats it anywhere.**
Fourth independent family, same dominance. `SEMANTIC LEAST PRIVILEGE` does not depend on knowing which
mechanism is operating — which is precisely why it is the rule the architecture can rely on while the
mechanism question stays open.

Note also what `OWN_DISSIMILAR` costs: **0.794 and 0.797**. Rewording an operation's *own* obligation,
with no siblings anywhere, degraded correctness at two of three capacities. That is a `RENDER` finding in
its own right and it was obtained as a control rather than as a target.

## The guardrail, a fourth time

    condition               carrying a captured contract   CONSTRAIN   PROVE   LEAKED
    ISOLATED                              0                   0          0       0
    OWN_DISSIMILAR                        0                   0          0       0
    IN_CHAIN_SIMILAR                    101                  16         85       0
    IN_CHAIN_DISSIMILAR                  39                   5         34       0
    ELSEWHERE_SIMILAR                    41                  25         16       0
    ELSEWHERE_DISSIMILAR                 17                  12          5       0

**Zero leaks.** Cumulative across four families: **619 transactions carrying the wrong semantic contract,
and none reached commit.**
