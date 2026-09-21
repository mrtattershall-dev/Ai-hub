# Multiplicity and candidate-set completeness — result. S0..S8 against `MULTIPLICITY_PREREG.md`.

    9 arms, all green after two code changes.  114 -> 123 tests in this directory.
    4 mutants run, 4 caught.

## The two findings

**1. The predicted failure arrived: completeness rests on a hint the system is not entitled to
trust.** A consumer waits while any still-pending record **declares** the claim it needs. A declared
claim is a *record* — and this sequence has held since the beginning that a record is a hint, never
an authority. S6 deletes `record.claim` from a supplier that still establishes exactly that claim,
and the consumer **commits to a single candidate and never discovers the second**. The multiplicity
M10 exists to detect is concealed. **This is recorded, not repaired.** The outcome now says out loud
what its completeness rested on — `completenessBasis: 'DECLARED_CLAIMS_OF_PENDING_RECORDS'` — which
is the only honest option while that remains the basis.

**2. The system cannot tell one reason twice from two reasons.** S1 (the same observation through
two histories) and S2 (different evidence licensing the same proposition) produce **identical**
outcomes. Both are reported as multiple eligible supports; both keep every source named. That is
correct under the proposed rule and it is also the limit of what this machinery can say: it answers
*which evidence supports this admission* and it cannot answer *is the claim better corroborated*.
Given that counting histories would be authority amplification by bookkeeping, not answering is the
right behaviour — but it is a limit, not a result.

## The prediction that failed, and what it cost

**S3 was predicted to hold and did not.** A record establishing the same claim string in **another
repository** was counted as eligible support, so *apparent* agreement was reported as multiplicity.
The cause was the merge addendum's own choice: *candidate selection by claim identity only, binding
left to `resolveEvidenceRoot`*. Claim identity is a fine way to find candidates and a bad way to
decide eligibility.

The fix keeps the reasoning that produced the addendum — **no second implementation of world
identity** — by asking the existing machinery instead of copying it: each candidate is tried by
setting the witness to it and running `adapt`, and a candidate counts only if the witness actually
**binds**. The trial token is discarded and nothing is filed. With the fix, S3 names exactly one
eligible support and the consumer mints; a mutant that restores claim-identity-only eligibility is
caught by S3 alone.

## Arm by arm

| arm | outcome |
|---|---|
| **S0** rewording | **held** — states and minting byte-identical to the captured pre-change behaviour; only the `why` text changed. The refusal now says *multiple suppliers, composition undefined*, and says explicitly that it is **not** a finding that the evidence disagrees and **not** a finding that the claim is better supported |
| **S1** duplicate support | **held** — both sources named, nothing composed, nothing chosen, and no field anywhere in any outcome carries corroboration, confidence, strength, weight or score |
| **S2** distinct agreeing support | **held** — identical semantics under both input orders; both alternatives survive. *Distinctness here is a different run of the same instrument — the strongest form these fixtures can express, and weaker than the arm's name suggests* |
| **S3** apparent agreement | **FAILED as first run**, then held after the eligibility change above |
| **S4** actual disagreement | **TERMINAL LIMITATION.** A claim is a predicate string plus a world. There is no negation, no contradiction operator, no vocabulary for *incompatible with*. The case cannot be constructed and no negation was invented to manufacture it. **Missing coordinate: a claim would need a polarity, or a declared incompatibility relation between predicates, before disagreement is sayable at all** |
| **S5** scheduling attack | **held** under four input/depth orders — a supplier one replay step deeper is still discovered before the consumer commits, because readiness defers on the declared claim regardless of depth. Note this is the *same* mechanism S6 defeats |
| **S6** completeness attack | **the predicted failure, preserved** |
| **S7** no amplification | **held** — either support alone licenses exactly the same claim with the same `why`; with both available the outcome is a refusal, never something *more* than either alone. It holds **trivially**, because nothing in the admission path reads a count. A mutant that adds one is caught |
| **S8** existential vs designated | **TERMINAL LIMITATION.** A witness roots in one designated address or in nothing; `evidence_root` is a single string and no key expresses what *kind* of support would satisfy it. **Missing coordinate: a witness would need a requirement mode — designated vs existential — before "several eligible supports" could be a satisfaction rather than an impasse** |

## Mutation table

| mutant | caught by |
|---|---|
| eligibility by claim identity only (no trial bind) | S3 |
| readiness never defers to a pending supplier | M5, M10, S0, S1, S2, S3, S5, S6, S7 |
| compose by picking the first eligible support | M10, S0, S1, S2, S5 |
| report multiplicity as corroboration | S1, S7 |

## Three apparatus defects, preserved

**1. S8's probe read a rule id.** It grepped `adapter.mjs` for `existential` and matched
`existential-from-established-member` — a *rule name*, not a witness mode. **Eighth** wrong-referent
instance. The structural question is about the witness, so the arm now asks the witness.

**2. S3's assertion read the wrong field.** `outcome.candidates` exists only in the multi-candidate
*refusal* branch; when one candidate is eligible, the set considered is recorded on the *supply*
entry. Reading the refusal field on a successful outcome gave `undefined`. **Ninth** instance, and
the second inside this one suite.

**3. S2 was over-strict, not wrong.** It compared the candidate *list*, which is input-ordered, and
failed on a purely cosmetic difference. It compares the candidate *set* now, and the list's input
ordering is disclosed rather than asserted away.

## The proposed rule, after testing

> Multiple eligible supports may justify the same claim without increasing its scope, currency or
> strength. Their provenance remains explicit; multiplicity itself contributes no authority.

**Not falsified, and not demonstrated either.** S7 shows no amplification exists — but trivially,
because no count is read anywhere. The rule's first clause, *may justify*, is **untested**: this
contract has no existential witness mode (S8), so several eligible supports are still an impasse
rather than a satisfaction. The rule remains a proposal, and the thing standing between it and a
test is a coordinate that does not exist yet.

## What the next frontier now looks like

The completeness question has a sharper shape after S6. Completeness cannot rest on what records
declare. Two candidate bases exist and neither was built here:

- **exhaustion** — no consumer resolves by claim until every record that can be replayed has been.
  Sound over a finite merged set, and it changes what a chain of claim-supplied consumers can do.
- **a requirement mode on the witness** (S8's missing coordinate) — if a consumer can say *any
  admissible support*, completeness stops mattering for that consumer, and matters only where a
  designated source is demanded.

Which of those is right is not something this run establishes, and picking one to make S6 pass would
be the retroactive repair this whole sequence exists to avoid.
