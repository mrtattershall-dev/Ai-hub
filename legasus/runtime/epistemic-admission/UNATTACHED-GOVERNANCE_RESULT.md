# Unattached governance — result. U1..U7 against `UNATTACHED-GOVERNANCE_PREREG.md`.

    7 arms, all green.  143 -> 150 tests in this directory.  5 mutants run, 5 caught.

## The gap G5 left, demonstrated before it was closed

**U1: diagnosis alone makes the failure visible without preventing it.** The governor intended
`DESIGNATED` for a consumer; the entry denoted nothing in this merged set; under a diagnose-only
policy the consumer **succeeded anyway** — `state: ESTABLISHED`, `supply[0].by: 'CLAIM'`,
`obligation.governedBy: 'DEFAULT'`, `obligation.mode: null`. It took **exactly the substitute a
designated obligation refuses**. A burden the governor intended was replaced by the unnamed default,
and the only trace was a diagnostic nobody had to read.

## Why `BLOCK` does not exist, rather than exists badly

The proportionate-looking policy — block just the affected admissions — **is not computable here**.

> An unresolved governance entry denotes **nothing in this merged set**. Which consumers it was meant
> to govern is **unknown, not merely unenumerated.**

U2 asserts it as an observation rather than an argument: the unattached entry matches none of the
three occurrences present, and there is more than one candidate it could have meant, each distinct.
So `BLOCK` **is refused, not approximated** (U5), and the refusal says why. Blocking whatever seemed
nearby would read as precision and be invention. A mutant that degrades `BLOCK` to `DIAGNOSE` dies.

## The policy, and who authorizes it

**`INVALIDATE` is the default** (U3): unresolved governance produces **no admissions at all** — not
even for the records that were fine — and the refusal names every unattached entry. Proceeding under
a weaker default is an unauthorized reduction of the burden the governor intended: the same defect
A1 refuses on the request channel, arriving through *absence* instead of through *asking*. U3
carries the control that makes it mean something: with governance that attaches, the same journals
admit normally, so the refusal is the policy doing work rather than an unsatisfiable fixture.

**`DIAGNOSE` is an authorized downgrade and is recorded as one** (U4): `governedBy: 'GOVERNOR'`, never
`'DEFAULT'`. The result says the downgrade was *chosen*, not that it is how things work.

**The policy lives in the governing channel** (U6). A requested policy is recorded and never decides:
asking for the downgrade does not obtain it, `requestAccepted: false`, and the admission projection
is identical to not asking. `requested: null` with `requestAccepted: null` stays distinct from a
refused request — *no request* is not the same value as *request refused*.

## `subjectOf`, bounded

U7 states what the helper does and does not do. It prevents **missing-subject** and
**coordinate-only** assertions. It **cannot** establish that it resolved the *right* occurrence —
testing the apparatus with the apparatus proves nothing. So the expected occurrence is constructed
**independently**, from the entry, by `occurrenceOf`, and the arm asserts both that the right one
matches and that a **neighbour does not**. Without the neighbour check the expectation would only be
"present", not "specific".

## Arm by arm

| arm | outcome |
|---|---|
| **U1** the consequence today | **the gap, demonstrated** |
| **U2** affected set not computable | **held** — asserted as an observation, and it is the reason `BLOCK` cannot exist |
| **U3** `INVALIDATE` default | **held**, with a positive control |
| **U4** `DIAGNOSE` authorized | **held** — recorded as a chosen downgrade |
| **U5** `BLOCK` refused | **held** — refuses on its own terms even when nothing is unattached, and does not silently degrade |
| **U6** governed, not requested | **held** — identical admission projection, differing only in the recorded request |
| **U7** `subjectOf` boundary | **held**, with the independent expectation and the neighbour check |

## Mutation table

| mutant | caught by |
|---|---|
| default policy becomes `DIAGNOSE` | U3, U6 |
| requested policy governs | U6 |
| `BLOCK` degrades to `DIAGNOSE` | U5 |
| `INVALIDATE` still emits outcomes | U3, U6 |
| `governedBy` always reports `GOVERNOR` | U3 |

## A disclosed consequence for three earlier arms

G1, G2 and G5 observed detection under what is now `DIAGNOSE`. They fail under the new default, and
they now **name the policy they observe under** rather than inheriting one. Their required
observations are unchanged; only the policy became explicit. This was written into the
preregistration before the change, not discovered in a diff.

## What is still not shown

- **Continuity is unsolved.** Occurrence keying detects substitution and reports non-application; it
  cannot keep an obligation attached across an origin reassignment. Journal lineage identity is the
  next preregistration, and the question there is **who may establish continuity** — a
  journal-supplied UUID would provide a *name* and would not establish entitlement to inherit an
  earlier journal's governance. The five cases to separate are already named: reordered inputs, a
  copied lineage label, changed content, forks, and identical content with separate histories.
- `INVALIDATE` refuses the **whole** run. That is fail-closed, not proportionate, and it is chosen
  only because the proportionate option is not computable. If lineage ever makes the affected set
  determinable, that choice should be revisited — deliberately, not by drift.
- **Registry ownership is still not established**; the governor is still the call site.
- `COMPLETE` remains vocabulary without a mechanism. **S6 is untouched and still stands.** The
  registry is still **3 authored rules, 0/15**. F2 untouched. H-IDENTITY-AUTHORITY stays at **NONE**.
