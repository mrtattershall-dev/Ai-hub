---
name: sufficiency-is-not-completeness
description: A correct result can rest on an incomplete proof — h07 derived the right region while silently dropping a requirement, because another constraint happened to imply it
metadata:
  type: feedback
---

2026-09-18, Legasus/LegaCore. A task built to test the UNRESOLVED-requirement path recovered fully and
looked like a pass. It wasn't: the operation required `_round2` and `math`, only `_round2` resolved,
`math` was silently dropped — and `_round2` sat after the import, so its constraint already implied the
one that was missing.

> **Constraint sufficiency and requirement completeness are separate properties. A correct patch is not
> equivalent to a complete justification for the authority granted to produce it.**

**Why it matters:** behavioural success concealed an incomplete proof, and nothing in the output could
say so. The fix was not better derivation — it was making the omission representable:

    requirement_resolution.resolved     [{symbol, provider: existing_definition | planned_operation}]
    requirement_resolution.unresolved   [{symbol, reason}]
    constraint_status.requirement_complete

so that "I derived no dependency" is separable from "I could not resolve a dependency I know exists".

**How to apply:** whenever a component can reach the right answer through more than one path, record
WHICH path produced it, not just the answer. And for any test of fallback, refusal, unresolved or
negative behaviour, prove BEFOREHAND that the target mechanism is NECESSARY to obtain the expected
outcome — a co-occurring mechanism that reaches the same answer first makes the control vacuous no
matter how good the number looks. This is the third instance: see
[[dev-set-win-on-unexercised-mechanism]] for the first two (an absent rival, an absent false relation).
Related: [[localization-is-participants-not-lines]], [[silent-failures-are-the-class]].

The working discriminator: build two inputs with IDENTICAL executable ground truth that differ in one
variable. If both succeed, the control is masked; if they diverge, the gap is attributable to that one
variable and nothing else.
