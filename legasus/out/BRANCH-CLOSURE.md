# BIND-CJS branch closure — what this substrate establishes, for downstream consumers
2026-09-21 09:45. Covers steps 7–17 (commits 91c4f41 … 0f7d197 and this one). **These are
descriptions of experimental results. They are not a production ontology and confer no
permission to invent one.**

Scope: one mechanism (`legasus/cjs-preload.mjs` @ e41c1e3), one foreign codebase, and a family
of synthetic worlds. Every statement below is *for the worlds constructed, under the evidence
configuration named*. None is a theorem.

---

## 1. Observed facts (things a run actually recorded)

- A CommonJS `require` was answered with a Legasus-generated file; the served file self-identified
  at load; V8 coverage showed the original absent (steps 5, 14).
- A substitution held across 266 module re-evaluations in one process (step 6).
- 33 foreign test files ran with 0 files modified under their root; 776 per-case lines, 0
  duplicated ids within a file (step 1).
- 298 coverage files across 33 witnesses correspond to **33 processes**, one each (step 6).

## 2. Propositions inferred from those facts — and the inference that carried them

| Proposition | Inferred from | Status |
|---|---|---|
| the requested replacement executed | served record + in-process self-identification + coverage | held in every non-adversarial world tested |
| the intervention was uniform | last observed identity | **decider unsound** (step 7) |
| an execution belongs to this intervention | 6 successive relations | **all six rejected** (steps 7–10) |

## 3. Evidence configurations under which claims were evaluated

    C-BIND1   PASS|FAIL lines + V8 coverage                      (steps 1-6)
    C-BIND2   C-BIND1 + recorded subject inputs/outputs          (BIND-2)
    C-BND     execution markers + request records                (step 11)
    C-BND+    C-BND + operation-start records                    (step 13)

**A claim is only ever evaluated under a configuration.** Two of these differ by one record type
and give opposite identifiability results for the same proposition (§6).

## 4. Decider unsoundness (the decider affirms in a world where the proposition is false)

Demonstrated for **every decider this branch attacked**: the last-identity rule (step 7), naive
uniformity (step 8), ancestry (step 9), request-succession and window-containment (step 10),
all five step-11 deciders (step 12), the named P2 rescue in both directions (step 14), and the
`PASS` line itself (step 15).

**Decider unsoundness is not evidence insufficiency.** Steps 12–14 separated them by
construction, and four of five step-12 deaths turned out to be about deciders, not evidence.

## 5. Demonstrated non-identifiability under a configuration

True and false worlds produced **byte-identical normalized bundles**:

| Proposition | Configuration |
|---|---|
| no unobserved execution occurred | C-BND |
| the request was responsible for the execution | C-BND (twice, independently) |
| a request was issued *(who issued it)* | C-BND |
| an execution occurred outside the witness | C-BND |
| every observed execution used M | C-BND |
| **module M was supplied to an actual evaluation** | C-BND *(step 17)* |

## 6. Configuration-dependent distinguishability

*The execution followed the request*: **indistinguishable under C-BND, distinguishable under
C-BND+.** The worlds did not change; what was recorded did (step 13). This is the single result
that most constrains how any of the above may be quoted: **non-identifiability is a property of
the evidence configuration, never of the proposition alone.**

## 7. Unresolved

- Whether "self-report / channel artifact" is one mechanism or several grouped after the fact.
- What an intervention *is*. Six candidates rejected; none replaced; nothing named.
- Whether H1 — *an authority path fails when the representation it consumes can vary
  independently of the event it establishes* — generalises. It has **one** discriminating result
  (step 16) and survived one attack on its own terms (step 17, low-risk by prior statement).

---

## The qualification downstream consumers must carry

Every per-case outcome in BIND-1 and BIND-2 — 3162 records, 604 discriminations, 568 edges —
rests on witnesses printing their own `PASS|FAIL` lines, a subject-controlled representation
(step 15). Those results are **not invalidated**: the witnesses were the repository's own tests,
the mutants were Legasus-generated, and BIND-2's C1 checked recorded outputs byte-for-byte
against a pristine replay. What changes is the entitlement:

> BIND-1/BIND-2 results hold **conditional on the witnesses not misreporting their own
> outcomes**, a condition stated in none of those records and stated here instead.

**No retroactive repair has been made.** The incompleteness of those records is itself evidence
about what Legasus knew at the time, and is preserved.

## What a consumer may NOT do with this document

- Treat §5 as "unknowable". Each line means *not identifiable under that configuration*; §6 shows
  such a line can move.
- Treat §4 as "the evidence is insufficient". That conflation is the exact error steps 12–14 were
  built to separate.
- Install any of §1–§7 as types, states, or interfaces. Nothing here earned that.
