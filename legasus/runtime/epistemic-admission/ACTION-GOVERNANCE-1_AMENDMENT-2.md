# ACTION-GOVERNANCE-1 — AMENDMENT 2: behavioural baseline, and three corrections to Amendment 1

**Frozen 2026-09-28, BEFORE implementation.** No governance code has been written. Probe:
`ag-baseline-probe.mjs` (read-only; calls the calculus, changes nothing).

## METHODOLOGICAL CORRECTION, and it invalidated part of Amendment 1

Amendment 1 built its baseline by **grepping** for `scope`, `budget`, `expiry`, `revoke`, finding zero, and
recording six bindings as ABSENT. **Absence of a word is search evidence, not proof of absent
enforcement** — and it was wrong: context monotonicity **is** enforced, under the names `context` and
`widened`, added after composition attack W3-c. The decisive baseline is a behavioural case showing the
undesired permission actually succeeds. Every row below is now a run probe, not a grep.

## Baseline — measured

**Already enforced. A refusal here is a binding held, and must not regress.**

| | case | result |
|---|---|---|
| B1 | widen the GRANT beyond the grantor | REFUSED |
| B2 | DROP a context dimension the grantor pins | REFUSED |
| B3 | CHANGE a pinned context dimension | REFUSED |
| B4 | delegate FROM an epistemic token | REFUSED |
| B5 | commit with a bare epistemic token | refused |
| B6 | **controller-HELD, owner-issued authority, exercised** | **PERMITTED — correct** |

**Measured gaps. A PERMITTED here is the gap.**

| | case | result |
|---|---|---|
| G1 | two children each receive the parent's FULL grant | both minted — no shared accounting |
| G2 | the same token consumed for two separate actions | both committed — no single-use |
| G3 | context pins `implementation: fixture.js`; commit `edit OTHER.js` | **COMMITTED** |
| G4 | commit with no admitted evidence at all | COMMITTED |
| G5 | token fields | `claim kind context grant ancestry constructor valid` — no expiry/revocation |

## CORRECTION 1 — controller-HELD is not controller-CREATED

Amendment 1 said *"any change that lets a controller-held token satisfy `from` is a regression."* **That was
wrong and would have prohibited the legitimate case.** B6 shows a controller exercising owner-issued
authority is permitted today, and it must stay permitted. The prohibition is on **creating, expanding, or
re-delegating beyond the grant** — not on holding or exercising.

Restated, and this replaces the A5 framing:

    PERMITTED    a controller HOLDS owner-issued authority and exercises it within its grant
    REFUSED      a controller CREATES authority, or re-delegates beyond what it holds

Whether a controller may re-delegate **at all** is a separate policy decision. It is **not** decided here;
if ACTION-GOVERNANCE-1 forbids it, that must be encoded explicitly as its own rule with its own test, not
arrived at by accident through a mis-stated regression check.

## CORRECTION 2 — A14 was already held; the real gap is at EXECUTION

Amendment 1 predicted context monotonicity would need "real design." B2/B3 show it is enforced. **A14 is
withdrawn as a build item and recorded as an existing binding with a regression test.**

The gap is one layer later, and G3 is the proof: the calculus polices how context **travels** and never
compares it to the action when the action **executes**. A grant pinned to `fixture.js` committed
`edit OTHER.js`. Checking only at issuance leaves a gap between approval and execution — time-of-check to
time-of-use, inside a system built to prevent exactly this class.

**This is the single most consequential finding of the baseline.** Verification at execution must bind:
the actual target, the relevant revision, the proposed action, the evidence, and the current authorization
state — together, at the moment of commit.

## CORRECTION 3 — narrowing is necessary and insufficient for budgets

G1 is the case: a parent permitting N actions can issue two children each permitting N. Each child
individually satisfies *child ≤ parent*; together they permit 2N. Per-token narrowing cannot express this
because the constraint is not a property of any token.

Budget therefore requires **shared accounting or explicit allocation**, with:

- **atomic consumption** — G2 shows a token is reusable today, so consumption is not even recorded;
- **ancestor revocation invalidating descendants** — G5 shows no revocation surface exists at all.

These are properties of the **delegation tree and its runtime state**, not of token fields. Amendment 1
listed budget and revocation among eight token bindings; that framing was wrong and is corrected here.

## A14 restated as five dimensions — authority cannot INCREASE through delegation

| dimension | required relationship | status |
|---|---|---|
| actions and targets | child permissions are a SUBSET | **held** (B1) |
| context / world | child context may narrow, never widen or drop | **held** (B2, B3) |
| expiry | child expires no later than parent | **absent** (G5) |
| evidence obligations | cannot be weakened by delegation | **absent** (G4) |
| budget | total consumption across ALL descendants respects ancestor limits | **absent** (G1) |
| revocation | ancestor revocation disables descendants | **absent** (G5) |

## Frozen predictions — replacing A8–A14

Each is a refusal at the **execution path**, not at issuance, and each is a first-class success.

| | prediction |
|---|---|
| **B1′–B6′** | every already-held binding still holds — regression tests, B6′ asserting legitimate exercise is still PERMITTED |
| **E1** | **target binding at execution**: an action whose target is not covered by the authority's context is REFUSED at commit, naming the mismatch |
| **E2** | **revision binding**: evidence admitted about revision A cannot authorize a change to revision B; the mismatch is named |
| **E3** | **evidence precondition at execution**: commit is REFUSED when the required admitted evidence is absent — G4 must invert |
| **E4** | **single use**: a consumed grant cannot be consumed again — G2 must invert |
| **E5** | **sibling budget**: descendants' TOTAL consumption cannot exceed an ancestor's limit, however the tree is shaped — G1 must invert |
| **E6** | **expiry**: a grant past its declared window is REFUSED even though it was valid when issued |
| **E7** | **ancestor revocation**: revoking a parent REFUSES its descendants, including ones already issued |
| **E8** | **explicit re-delegation policy**: whatever is decided, the rule is stated and tested — not inherited from a mis-framed check |

## Proof target, stated as one sentence

> Valid delegated work proceeds, while changing the **target**, the **revision**, the **evidence**, the
> **lifetime**, or the **remaining authority** causes the **actual execution path** to refuse.

Outcome taxonomy and the non-vacuity rule from Amendment 1 stand unchanged: every denial must fire for its
own reason under an injected fault, and a run whose only outcome is `ACTION_PERMITTED` is not a success.
