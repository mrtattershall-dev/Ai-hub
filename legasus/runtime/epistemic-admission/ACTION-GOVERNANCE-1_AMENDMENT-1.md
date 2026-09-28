# ACTION-GOVERNANCE-1 — AMENDMENT 1: the delegation must bind, and what it binds today

**Frozen 2026-09-28, BEFORE any build and before any result exists.** Nothing in ACTION-GOVERNANCE-1 has
been implemented or run. This is an amendment to a preregistration, not a revision after an outcome.

## Measured baseline: what `delegate()` binds today

Read from `legasus/legaknow/calculus.mjs` at this commit, not recalled.

| required binding | status today | evidence |
|---|---|---|
| **principal / root** | **ENFORCED** | `from !== 'OWNER' && !isAuthority(from)` refuses. A component cannot delegate authority it was never given. |
| **action type** | **ENFORCED** | `grant` must be non-empty; `tracesToIndependentRoot(t, need)` refuses when `need` is not covered by `t.grant`. |
| target scope | **ABSENT** | `context: context || {}` — optional, accepted unvalidated, never compared to the action. |
| evidence preconditions | **ABSENT** | no link exists from an admitted certificate to a grant. |
| time / run binding | **ABSENT** | zero occurrences of expiry/issuedAt/ttl in the calculus. |
| budget / blast-radius cap | **ABSENT** | zero occurrences of budget. |
| validation requirement | **ABSENT** at the calculus level | `commit()` checks authority, not test outcomes. |
| revocation / expiry | **ABSENT** | zero occurrences of revoke. |

**Two of eight are already enforced. Six are absent.**

## THE ASYMMETRY, which is the actual finding

The calculus applies a **strict context discipline to its epistemic constructors and none to the one that
creates permission**:

    OBSERVE     REFUSES without a context            "OBSERVE requires the context the observation was made in"
    DERIVE      INTERSECTS premise contexts          the output context can only SHRINK, never exceed a premise
    DELEGATE    context || {}                        optional, unvalidated, never checked against the action

So the constructor that mints normative authority is the **only** one permitted to carry an empty or
arbitrary context. A grant is currently scoped by *what* may be done (`grant[]`) and not by *where*, *to
what*, *for how long*, or *on what evidence*. That is the gap ACTION-GOVERNANCE-1 has to close, and it is
narrower and more specific than "delegation needs constraints."

## The caution is ALREADY STRUCTURALLY HELD — recorded so it is not re-solved

> *the controller itself must not be able to create a token that traces to the independent root*

Already enforced, two ways, and neither is advisory:

1. `delegate()` refuses unless `from` is literally `OWNER` or an existing authority token.
2. `from.kind !== KIND.NORMATIVE` refuses with: *"Evidence establishes what may be BELIEVED; it does not
   originate permission."*

An epistemic certificate therefore **cannot** be laundered into permission by re-delegation. The separation
of request / issue / verify / consume is the design already; ACTION-GOVERNANCE-1 must not weaken it while
adding the six missing bindings. **Any change that lets a controller-held token satisfy `from` is a
regression, and A5 exists to catch it.**

## Additional frozen predictions

A1–A7 stand. These extend them; each is a REFUSAL condition and each is a first-class success.

| | prediction |
|---|---|
| **A8** | a grant whose `context` does not cover the action's target is REFUSED — scope mismatch, named as such |
| **A9** | a grant reused after its declared run/window has ended is REFUSED — replay, named as such |
| **A10** | a grant exceeding its declared change budget is REFUSED before the change, not after |
| **A11** | a revoked grant is REFUSED even though it was valid when issued |
| **A12** | a grant issued by the wrong root is REFUSED — distinct from "no grant" |
| **A13** | commit is REFUSED when prescribed validation failed, even with a valid in-scope grant |
| **A14** | **CONTEXT MONOTONICITY, the asymmetry closed:** a delegated context may only NARROW relative to its grantor, mirroring DERIVE's intersection. A delegation that widens context is REFUSED. |

A14 is the one I would most expect to require real design rather than a check, and it is the one whose
absence would leave the other six defeatable by re-delegation with a wider context.

## Outcome taxonomy — every run reports one of these, not "did it repair the code"

    ACTION_PERMITTED
    ACTION_DENIED_NO_NORMATIVE_AUTHORITY
    ACTION_DENIED_SCOPE_MISMATCH
    ACTION_DENIED_EXPIRED_OR_REPLAYED
    ACTION_DENIED_REVOKED
    ACTION_DENIED_WRONG_ROOT
    ACTION_DENIED_BUDGET_EXCEEDED
    ACTION_DENIED_UNADMITTED_EVIDENCE
    ACTION_DENIED_VALIDATION_FAILURE
    AUTHORITY_CHAIN_VERIFIED
    BYPASS_ATTEMPT_DETECTED
    COMMIT_RETAINED
    RESTORE_REQUIRED

A run that retains **zero** repairs is still interpretable, and a run whose only outcome is
`ACTION_PERMITTED` is **not** a success — A1's positive control must be accompanied by at least one
denial of each declared class, or the suite proves only that the gate says yes.

## Non-vacuity, restated for this experiment

Every denial class above must be shown to fire **for its own reason**, with a deliberately injected fault.
A refusal whose cause is a missing import, an absent fixture, or a wrong working directory is not a
governance result — this project has produced all three of those and mistaken them for findings.

## Still not claimed

Generalisation beyond `controller-bridge-input` (cccb6a1). The cross-language seam. Any physical-action
governance: a rollback cannot undo a collision, and nothing here changes that.
