# ACTION-GOVERNANCE-1 — AMENDMENT 3: what the baseline does and does not establish

**Frozen 2026-09-28, still before implementation.** Four corrections to Amendment 2's interpretation. The
measurements stand; three of the readings do not.

## CORRECTION 1 — the evidential boundary of G3

Amendment 2 reported *"context pins fixture.js — commit `edit OTHER.js` — COMMITTED."* What was actually
observed: **an in-process call to `commit()` returned `committed: true` for a mismatched action
description.** `commit()` is a pure authorization function; it writes nothing.

    ESTABLISHED      a calculus-level authorization failure: the authority's context is never
                     compared to the action it authorizes
    NOT ESTABLISHED  that a real write to OTHER.js occurred, or could

**The execution test must connect those two.** Until it does, G3 is a governance hole, not a demonstrated
unauthorized write. Reporting it as the latter would be the same overreach this project keeps catching.

## CORRECTION 2 — G3 is an unchecked target binding, not time-of-check-to-time-of-use

Amendment 2 called G3 "TOCTOU." Wrong mechanism. Two distinct failures, both needing tests:

| | failure |
|---|---|
| **unchecked target binding** (G3, measured) | the target is **never** compared to the authority's context, at any time |
| **time-of-check to time-of-use** (not yet probed) | the target or revision **is** checked, and then **changes** before execution |

The first is a missing check. The second is a race. Fixing the first does not address the second, and
conflating them would let a correct fix for G3 be reported as covering a case never tested.

## CORRECTION 3 — G1 and G2 are gaps only against a DECLARED policy

**G1 demonstrates duplicated grants, not doubled spending authority.** Ordinary permissions are shareable
without being consumed — two components holding "may edit fixture.js" is normal and not a violation. It
becomes a budget violation only where **the parent holds a finite allowance and descendants collectively
exceed it**. Absent a declared allowance, G1 is correct behaviour.

**G2 is a defect only under a declared single-use policy.** Reusable authority is otherwise legitimate;
most permissions are not tickets.

So E4 and E5 are conditional on ACTION-GOVERNANCE-1 **declaring** a single-use and an allowance policy for
the operation under test. Amendment 2 treated both as defects on their face; that was wrong. Whether a
grant is single-use or allowance-bounded is a **policy** the experiment must state, then enforce, then
test.

## CORRECTION 4 — the enforcement point must own a STRUCTURED action and the ACTUAL effect

This is the implementation constraint, and the baseline probe illustrates the trap it prevents: the probe
passed `action: 'edit OTHER.js'` **as a string**. An enforcement point that validates a string while a
different argument determines the file **recreates the hole with a check in front of it**.

Therefore the enforcement point must, **immediately before invoking the bounded operation**, own and check:

    resolved target        the actual path/entity the operation will affect, resolved — not a label
    revision               the revision the evidence was admitted about, vs the one being modified
    evidence obligations   those the OPERATION CONTRACT declares, not a universal rule
    grant status           current: not expired, not revoked
    remaining allowance    where an allowance is declared

and the same structure must be what the operation actually consumes. A check whose subject differs from
the effect's subject is decoration.

## CORRECTION 5 — G4 is scoped to the operation contract

Evidence must not become a universal precondition for every conceivable authorized action. The correct
form: **if this repair operation's contract requires admitted evidence, execution without it must fail.**
Operations declaring no evidence obligation are unaffected.

## E-series, restructured around real effect

**E0 — THE STRONGEST TEST, and the one to build first after the B′ regressions.**

> An owner-issued grant permits a **real change to the intended fixture**. Changing **only** the target
> causes refusal, and **both files remain byte-identical to their pre-attempt state**.

Byte-identity of both files is the assertion that makes it a real-effect test rather than a verdict test:
the intended file must be unchanged by the refused attempt, and the unintended file must never have been
touched.

Then vary **one** dimension at a time, every negative case retaining an otherwise-valid setup:

| | varied | expected at the execution path |
|---|---|---|
| **E1** | target | REFUSED, mismatch named; both files byte-identical |
| **E2** | revision (evidence about A, change to B) | REFUSED, mismatch named |
| **E3** | evidence, where the operation contract requires it | REFUSED; contract-scoped, not universal |
| **E4** | reuse, where single-use is DECLARED | REFUSED; no-op where reusability is declared |
| **E5** | allowance, where a finite allowance is DECLARED | REFUSED before the effect, across all descendants |
| **E6** | lifetime | REFUSED though valid when issued |
| **E7** | ancestor revocation | descendants REFUSED, including already-issued ones |
| **E8** | re-delegation policy | whatever is declared, stated and tested explicitly |
| **E9** | *(new)* target changes AFTER the check, before execution | REFUSED — the genuine TOCTOU case, distinct from E1 |

## Proof target, unchanged

> Valid delegated work proceeds, while changing the target, the revision, the evidence, the lifetime, or
> the remaining authority causes the **actual execution path** to refuse.

With one addition from Correction 1: **"proceeds" and "refuses" are judged by the effect on disk**, not by
a returned verdict.

## Boundary kept explicit

No validation is borrowed from the 7B fuzzer run, which was never touched and is unrelated to this claim.
Nothing here is built. The B′ regression tests come first, pinning the six already-held bindings before
anything is added near `commit()`.
