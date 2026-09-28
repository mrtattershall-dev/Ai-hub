# Multiplicity and candidate-set completeness — S1..S8. Frozen 2026-09-21, before any code changes.

## What M10 actually exposed

M10 refuses when several records establish the needed claim. That refusal is defensible as a
temporary boundary, but **its meaning was wrong**: it reads as *the evidence disagrees* when what it
knows is only *multiple suppliers; composition undefined*. The wording is corrected as part of this
run, and the correction is a wording change with no behavioural effect — asserted, not assumed (S0).

## Three questions that M10 conflated

| question | what agreement establishes |
|---|---|
| does sufficient support exist? | **either** independently admissible, correctly scoped witness might suffice |
| which evidence supports this admission? | **both** sources must stay distinguishable in the provenance |
| is the claim better corroborated? | **separate histories alone establish nothing of the kind** |

Two runs can replay the same underlying observation. That is two histories and **one reason**.
Counting tokens or origins as corroboration would be authority amplification by bookkeeping — the
exact defect every step of this sequence has been removing.

## The proposed rule, tested here rather than assumed

> **Multiple eligible supports may justify the same claim without increasing its scope, currency, or
> strength. Their provenance remains explicit; multiplicity itself contributes no additional
> authority.**

This is a **proposed extension**. Nothing established so far entails it. S7 is its falsifier.

## The completeness question, which is the real frontier

> **When is the available support set complete enough to authorize a decision about agreement,
> ambiguity, or disagreement?**

"Already replayed" is sufficient for *using* a witness. It is **not** sufficient for concluding that
the candidate set is *complete*. Today `replayMerged` defers a consumer while any still-pending
record **declares** the needed claim — and a declared claim is a record, which this whole sequence
has held is a hint and never an authority. Using it for ordering is defensible; **relying on it for
completeness is not**, and S6 attacks exactly that gap.

## The four kinds of agreement, separated

| kind | construction |
|---|---|
| **duplicate support** | the same underlying evidence reaching the consumer through two histories |
| **distinct agreeing support** | different evidence independently licensing the same fully scoped proposition |
| **apparent agreement** | matching claim identity, incompatible world or other binding condition |
| **actual disagreement** | admissible support for incompatible propositions — *if the claim language can express that at all* |

## The arms

| arm | required observation |
|---|---|
| **S0** | the reworded refusal changes wording only: outcomes, states and provenance byte-identical to the previous behaviour |
| **S1** duplicate support | two histories carrying the **same underlying observation** are reported as multiplicity, **not** corroboration, and both remain named in the provenance |
| **S2** distinct agreeing support | two **different** evidence records licensing the same fully scoped proposition are likewise preserved as alternatives, neither chosen by input order, and never combined |
| **S3** apparent agreement | matching claim identity with an incompatible world is **not** agreement: the existing binding checks still refuse, and it is not reported as multiplicity of eligible support |
| **S4** actual disagreement | probe first whether the claim language can express incompatible propositions. If it cannot, that is recorded as a **terminal limitation**, and no negation is invented to manufacture the case |
| **S5** scheduling attack | the consumer becomes ready after the first supplier while a second matching supplier sits one replay step deeper. Under **both** depth orders and **both** input orders the outcome is identical, and multiplicity is not concealed |
| **S6** completeness attack | a second supplier whose **declared** record claim is absent, or differs from what it actually establishes. The ordering hint fails. Does the system conceal the multiplicity M10 detects? |
| **S7** no amplification | with two eligible supports, the licensed claim, its scope, its extent and its currency are **identical** to the single-support case. Any difference falsifies the proposed rule |
| **S8** existential vs designated | can a consumer distinguish *an admissible support exists* from *this designated source*? If the contract cannot express the difference, record it rather than adding vocabulary |

## Predictions, committed now

- **S0, S1, S2, S3, S7** I expect to hold. S7 in particular should hold trivially, because nothing in
  the admission path reads a count — and if it does not hold trivially, that is the interesting case.
- **S5** I expect to hold, because readiness already defers on a *declared* claim regardless of depth.
- **S6 is where I expect the failure**, and I am naming it before running: a supplier whose record
  does not declare the needed claim is invisible to `couldStillEstablish`, so the consumer will
  commit to a single candidate and the second supplier will be discovered too late or not at all.
  **That is concealment of multiplicity by a hint the system was never entitled to trust.**
- **S4 and S8 I expect to be terminal limitations, not results.** The claim language is a predicate
  string plus a world; I do not believe it can express "incompatible with". The contract has one
  witness mode; I do not believe it can express "any admissible support" as distinct from "this
  one". Both will be recorded as such, with the coordinate that is missing named, rather than
  invented in this run.

## Forbidden in this run

No new registry rules (still **3 authored, 0/15**). No freshness rule. No repair of the F2 boundary.
No corroboration semantics: multiplicity may not raise scope, currency or strength, and no arm may
be made to pass by letting it. No negation vocabulary added to manufacture S4. No new witness mode
added to manufacture S8. If a needed distinction does not exist, it is recorded as missing.
