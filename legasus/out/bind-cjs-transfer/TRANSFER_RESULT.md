# BIND-CJS step 5 result — R8 ESTABLISHED, R4 UNESTABLISHED, two properties UNEXERCISED
2026-09-21 02:58. Preregistration: `legasus/BIND-CJS_TRANSFER.md` (ef92ab1), frozen before the
engine was touched. Mechanism: `legasus/cjs-preload.mjs` @ e41c1e3, **unchanged**; no
engine-derived repair was made to it or to the classifier. Raw: `transfer.json`, per-condition
marker/mechanism logs and coverage.

## Selection, by the frozen mechanical rule

    eligible subjects       20 of 84 non-test files   (76% excluded by "no relative requires")
    eligible (subject,witness) pairs   20
    selected subject        experiments/037_ai_native_editor/intent.js :: parse
    selected witness        experiments/037_ai_native_editor/intent_test.js  (104 case lines)
    perturbation            M001-RETURN_EMPTY, `body := return []` (frozen family)

## The four conditions

| id | requested | served (claim) | executed (marker) | original also ran? (coverage) | state | wanted |
|---|---|---|---|---|---|---|
| F-A mutant | F001_MUTANT | F001_MUTANT | F001_MUTANT | **false** | VALID_INTERVENTION | ✓ |
| F-B identity | F000_IDENTITY | F000_IDENTITY | F000_IDENTITY | **false** | VALID_INTERVENTION | ✓ |
| F-C bypass | F001_MUTANT | *(none)* | *(none)* | **true** | SUBSTITUTION_UNOBSERVED | ✓ |
| F-G no request | — | *(none)* | *(none)* | **true** | SUBSTITUTION_UNOBSERVED | ✓ |

**Foreign files modified: 0** in every condition, checked by mtime over all 117 recorded files.

## Two independent channels agree, which is the strongest part of this result

`executed` comes from a marker inside a Legasus-generated file; `original also ran` comes from
V8 coverage, which knows nothing about markers. They agree in all four conditions and in
opposite directions: where substitution was observed the original did **not** execute; where it
was not, the original **did**. Neither channel is the mechanism's own claim.

## Non-vacuity

F-A: the witness emitted **2 case lines, 1 FAIL, exit 1**. F-B: **104 case lines, 0 FAIL, exit
0** — byte-identical to the engine's own step-1 baseline. So the perturbation was consequential
and the identity copy was behaviour-preserving, on a subject neither was written for. A transfer
in which the mutant changed nothing would have proved only that a file was loaded.

## Predictions, scored honestly

**P-F3 CONFIRMED.** `VALID_INTERVENTION` and `SUBSTITUTION_UNOBSERVED` behaved on the foreign
subject as they did on the fixture. One difference in *which branch* fired: on the fixture,
bypass was caught by `served absent AND executed == SUBJECT`, because the fixture's subject
carries a marker. A foreign subject cannot be marked, so bypass here is caught by `executed
absent`. Same state, different evidence path — and a weaker discriminator, because "no marker"
is also what a marker-write failure looks like. The coverage channel distinguishes them
(`subjectAlsoExecuted: true`) and is recorded, but the state function does not consult it.
**Recorded as a limitation, not repaired after the fact.**

**P-F1 UNEXERCISED.** No scope violation occurred: exactly one Legasus file executed per run and
`unauthorized` was empty in all four. The scope universe was genuinely large — 95-99 executed
scripts versus the fixture's three — so the *universe* transferred, but the *violation branch*
never fired here. It fired in qualification (Q-H), so the classifier is exercised; on the
foreign target it is not. Neither confirmed nor falsified.

**P-F2 UNEXERCISED.** `servedRecordsForSubject` was 1 in both substitution arms and the marker
set was a singleton. The selected witness does not spawn children (step 1 measured it at one
coverage process). So the multiplicity refusal is implemented and carried, and has **never had
an opportunity to fire anywhere**. Neither confirmed nor falsified.

## Verdict

    R8 substitution   ESTABLISHED for this foreign subject
    R4 invocation     UNESTABLISHED

The engine still has no manifest, no test script and no VCS. The invocation used here —
`node <witness>`, cwd = foreign root — is this probe's choice, not the codebase's statement.
*We can intervene faithfully in this foreign program when given an invocation.* Not: *Legasus
knows the authoritative way this program should be exercised.* Substitution success does not
leak into invocation authority.

## The Intervention interface is NOT earned yet, and this result is why

Two mechanisms of genuinely different topology now satisfy the contract's core chain, with the
contract frozen before the second existed. That is the evidence the gate asked for — for the
**target triple**. But Q-H established that the triple is necessary and *not sufficient*: scope
is a property of the whole intervention event. And scope, plus multiplicity, are exactly the two
properties that have **never been exercised outside the synthetic fixture**.

Granting the abstraction now would extract an interface whose two hardest guarantees rest on one
controlled process with three modules. The gate stays closed.

## The single strongest next falsification

Run the same frozen conditions against `experiments/025_behavior_corpus/harness_test.js` — the
one witness step 1 measured producing **266 coverage processes**. `--import` is not inherited by
spawned children, so a child would load the ORIGINAL subject while the parent runs the mutant:
precisely P-F2's predicted multiplicity, with a real opportunity to fire. That is a separate
preregistration, because choosing a second witness after seeing these results is post-hoc
selection; the rule that picked `intent_test.js` was frozen and must not be quietly widened.

Eligibility must be checked first: only 20 of 84 non-test files pass the "no relative requires"
rule, which is itself a recorded transport limitation — a mutant lives outside the foreign tree
and cannot resolve the subject's siblings, and placing mutants inside that tree is prohibited.
