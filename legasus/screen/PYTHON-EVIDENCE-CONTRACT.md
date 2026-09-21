# The Python evidence contract (frozen 2026-09-21 12:00)

Governs every Python detector Legasus builds. Written after CONTROL-1 falsified SCREEN-1, and
before INV-A2 / INV-B2 exist.

## The governing rule

> A syntactic property may generate a **candidate**. It may not, by itself, establish the
> **semantic proposition** for which the candidate is being evaluated. Where the semantic
> proposition cannot be established, the detector must preserve **UNKNOWN**.

## The single mistake behind all three SCREEN-1 failures

SCREEN-1 failed in three visibly different ways that are one error — *syntax silently promoted
into semantic evidence*:

    INV-A false positive   polarity could not be established, so it classified from a literal
                           `True` anyway
    INV-B false positive   whether a computed result can be false could not be established, so
                           it treated the absence of a literal `False` as inability to fail
    INV-A false negative   with no literal failure return, it could not even construct a
                           candidate

Two opposite over-classifications and one under-construction, all from the same promotion. The
rule above is what each of them violated.

## Forbidden: name-based polarity

`is_missing`, `has_error`, `needs_auth`, `disabled`, `can_send` — a detector **may not** infer
that truthy means failure from a function's name. That would replace one invisible
evidence-production assumption with another. Names may select *candidates*; they may never
establish *polarity*.

## INV-A2 — and the reformulation that removes the need for polarity entirely

INV-A's real content is:

> an exceptional path is admitted as satisfying the same postcondition that represents
> successful completion.

Which is decidable **without knowing which value means success**:

    VIOLATION    an `except` handler returns a value IDENTICAL to a value returned by a
                 non-exceptional completion path of the same function. The handler is then
                 indistinguishable from success, whatever "success" means here.
    DISTINGUISHABLE  every value returned by an exceptional path differs from every value
                 returned on a non-exceptional path. (See the precision section: this is NOT
                 "SAFE" and NOT "correct" - it is only "no violation of this invariant".)
    UNKNOWN      the returned values are not statically comparable (computed expressions,
                 calls, names), so identity can neither be established nor refused.

This is why it is better than polarity-awareness: it never asks what the value *means*. It asks
whether the error path and the success path are **distinguishable to the caller**, which is the
property that actually matters and is structurally decidable.

It also fixes the false negative: `upload_ok` — `try: return True` / `except: return True` —
needs no literal failure return anywhere to be a VIOLATION.

## INV-A2 precision: what "identical" means, and what SAFE does not mean

**Identical means observationally identical under a narrowly defined comparison rule, not
AST-text-identical.** `return True` and `return bool(1)` are syntactically different and
indistinguishable to a caller; `Result(True, source="normal")` and `Result(True, source="error")`
share an apparent success bit while remaining distinguishable. A2 does not attempt sophisticated
evaluation. It defines a **supported equivalence relation** - literal constants compared by
value, after folding the handful of trivially foldable forms - and pushes **everything outside
that relation to UNKNOWN**. The contract states exactly what has been established and no more.

**The second state is DISTINGUISHABLE, not SAFE.** Formally it means *no violation of this
invariant was established* - the exceptional path is distinguishable from the compared ordinary
path. It does **not** mean the function is correct. `try: return 1 / except: return 2` is
DISTINGUISHABLE while possibly being terrible design. `SAFE` may be used as external vocabulary
only with that definition attached, because "SAFE" quietly becoming "good code" is the same
entitlement expansion this contract exists to prevent.

## INV-B2 — three states, with computed returns moving to UNKNOWN

    PROVEN_FAILURE_UNREACHABLE   every return is a truthy literal, and no `raise` — the
                                 predicate provably cannot report failure. This is the finding.
    PROVEN_FAILURE_REACHABLE     at least one return is a literal falsey value, or the function
                                 raises.
    UNKNOWN                      at least one return is a computed expression whose falsity
                                 cannot be established structurally.

`return host not in _SOTA_HOSTS` and `return bool(RE.search(m))` become **UNKNOWN**, not
violations. Insufficient evidence reduces entitlement rather than forcing a verdict.

## The test-suite baseline taxonomy, frozen before it is used

Odysseus's suite is **not a clean binary oracle** in this environment: 4401 passed, 116 failed,
21 errors, 20 skipped. Before any dynamic confirmation uses it, each failure is classified:

    BASELINE           present before any candidate or repair
    ENVIRONMENTAL      a required dependency or resource is mechanically shown unavailable
    TARGET_RELATED     causally connected to the candidate behaviour
    NOVEL_REGRESSION   introduced by the intervention
    UNATTRIBUTED       not enough evidence to classify

**UNATTRIBUTED is mandatory and load-bearing.** The `FileNotFoundError` cases *suggest* missing
tooling, but until the missing dependency is established mechanically they are UNATTRIBUTED —
not ENVIRONMENTAL. Suggestive is not established, and keeping them out of any defect count is
the same rule as everything above.

## Honest limitation of using CONTROL-1 as A2/B2's acceptance gate

CONTROL-1's cases were written by me, and A2/B2 are being designed with those cases and
Odysseus's counterexamples in view. **Passing CONTROL-1 will therefore establish that the
implementation matches this specification — not that the detectors have capability.** Its
scientific value was falsifying SCREEN-1; as a gate for its own successors it is weak by
construction, and saying so is part of the gate.

Capability can only be claimed after the detectors are frozen (bytes hashed, predictions
recorded) and pointed at a **fresh external Python target** that played no part in their design.

## Odysseus's standing role

Not a failed trophy attempt. **Odysseus is the external corpus that falsified the first Python
evidence producer** — it proved the detector wrong before the detector proved anything about it,
which is what an external target is for. It is a detector-development corpus from here on, and
cannot serve as a blind prospective test for detectors it helped shape.
