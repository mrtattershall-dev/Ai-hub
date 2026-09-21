# Semantic rule drift — the fingerprint must cover the dependency closure. Frozen 2026-09-21.
Settles R-W4. **No implementation is chosen until D1–D4 are frozen.**

## The defect, stated at the right level

The rule identity currently covers `rule metadata + matcher source`. But the matcher **means**

    matcher source
      + the behaviour of the functions it calls
        + the behaviour those depend on
          ...

R-W4 demonstrated the consequence: the world check went from one undefined-tolerant comparison to
two equality checks and an ordering, and the fingerprints were **byte-identical**.

> **Same fingerprint ≠ same rule semantics.** That defeats the entire purpose of pinning.

## The repair that would not be a repair

    dependencies: ['resolveEvidenceRoot']   // the ones the author remembered

That is "the rule means whatever dependencies someone listed", which is the same defect one level
out. The closure must be **mechanically derived from the matcher itself**.

## The arms

    D1  change the matcher body                                    fingerprint MUST move
    D2  matcher unchanged, change a directly-called helper         MUST move
    D3  matcher and direct helper unchanged, change a
        helper-of-a-helper                                         MUST move
    D4  change unrelated code in the same module                   MUST NOT move   <- anti-refusal

**D4 is essential.** Without it the trivially "safe" repair is `fingerprint = hash(whole
repository)`, which notices everything and makes every certificate stale when a comment moves three
directories away. The target is **semantic dependency closure, not textual blast radius.**

## Partiality is a first-class outcome

If the builder meets something it cannot faithfully resolve — dynamic property access, a
runtime-generated function, an opaque external binding, an ambiguous name — the answer is

    FINGERPRINT_UNRESOLVED

not "hash what we happened to find". A fingerprint over a closure known to be incomplete is a
fingerprint that lies about what it covers. This is the same discipline as `UNRESOLVED`,
`unmeasured`, and `UNKNOWN(reason)`.

## Predictions

**F-1.** D1, D2 and D3 all move the fingerprint; D4 does not.
FALSIFIER: any of them behaves the other way.

**F-2.** Applied to the real registry, the closure reaches `resolveEvidenceRoot` and the world-check
comparisons inside it, so changing `extent >= required` to `extent === required` **moves the
fingerprint even though every declaration string is unchanged**. That is exactly what R-W4 showed
the current system cannot see.
FALSIFIER: it does not move.

**F-3.** An unresolvable dependency yields `FINGERPRINT_UNRESOLVED`, and a rule whose fingerprint is
unresolved **cannot be pinned** — `resolveRule` must refuse it rather than fall back.
FALSIFIER: an unresolved closure still produces a hash.

**F-4.** A source dependency that cannot affect the decision — the classic being a logging helper —
is still included by a call-closure builder, so the fingerprint churns on an irrelevant change. I
predict this and am **not** solving it: "transitively called" may later prove too broad, and that
should be established by observing needless churn rather than designed around in advance.

## Rules

`legaknow` untouched. The registry stays at three rules. Rule selection stays frozen at 0/15. If the
mechanically derived closure cannot satisfy D1–D4, the result is reported and no hand-maintained
dependency list is introduced as a consolation.
