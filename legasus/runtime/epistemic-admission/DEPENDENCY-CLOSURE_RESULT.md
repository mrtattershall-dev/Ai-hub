# Semantic rule drift — D1..D4 hold, F-2 repairs R-W4, F-4 fails as predicted
2026-09-21. Preregistration `DEPENDENCY-CLOSURE_PREREG.md`, frozen before any implementation.
`fingerprint.test.mjs` 10/10. **No hand-maintained dependency list exists.**

## The result

    D1  change the matcher body                            MOVES
    D2  matcher unchanged, change a direct helper          MOVES
    D3  matcher + direct helper unchanged, change a
        helper-of-a-helper                                 MOVES
    D4  change unrelated code in the same module           DOES NOT MOVE   <- anti-refusal

    F-2  on the REAL registry, changing `extent >= required` to `===` now MOVES the fingerprint,
         with every declaration string unchanged.                          **R-W4 REPAIRED**
    F-3  an unresolvable dependency yields FINGERPRINT_UNRESOLVED and no hash
    F-4  an irrelevant dependency DOES churn the fingerprint               **FAILS, as predicted**

The real closure covers `__matcher_COVERAGE -> present, relationClaim, resolveEvidenceRoot,
isAuthority` — including the function the old digest could not see.

## The closure is derived, not declared

`dependencies: ['resolveEvidenceRoot']` would have meant *the rule means whatever the author
remembered*, which is the same defect one level out. The builder reads the matcher's own source,
finds what it calls, resolves each callee against the analysed modules, and recurses.

**The kernel is inside the closure.** What `isAuthority` means is part of what the rule means, and
treating `legaknow` as unexaminable ground would be admitted ground that can change silently.
Reading it is not modifying it; it remains byte-unchanged.

## Partiality is an outcome, three times over

    imported from a package the builder cannot see into   FINGERPRINT_UNRESOLVED
    a name resolving to no definition, import or global   FINGERPRINT_UNRESOLVED
    a template literal, whose ${} may contain calls       FINGERPRINT_UNRESOLVED
    comment syntax inside a string literal                FINGERPRINT_UNRESOLVED

No hash is produced over a closure known to be incomplete. The template-literal and interleaving
refusals both guard the **under-count** direction specifically, because an under-count is silent
false stability, which is worse than refusing.

## Three ways the scanner read something that was not a call

All three were found by running it, and all three are the same species as the five earlier
apparatus defects in this sequence:

    `function name(`               a function's own header, read as a call to itself
    'this derivation ('            a PROSE FRAGMENT in an error message, read as a call
    // ... COVERAGE(subject, ...)  a COMMENT explaining the code, read as a call

The third is the sixth instance overall, and it needed `\r` stripped first — a line-comment pattern
anchored to `$` cannot reach end-of-string on a CRLF file, which is the identical bug found earlier
in the comment-stripping test helper.

**The hashed form is comment-free**, so editing prose cannot move a fingerprint either. That is D4's
requirement applied inside a function rather than across a module.

## F-4 failed and is NOT being solved

A logging helper cannot affect a decision, and a call-closure builder includes it anyway, so the
fingerprint churns on a change that cannot matter. Predicted in the preregistration and left alone:
whether "transitively called" is too broad should be established by **observing needless churn**,
not by designing a narrower notion in advance. No architecture by elegance.

## Not installed

`fingerprint.mjs` is a separate module. `rules.mjs` still computes `DIGESTS` the old way, and the
adapter still pins against those. **Swapping the registry onto closure fingerprints is a further
step**: every rule identity changes, so the producer must re-pin, and that deserves its own frozen
prediction rather than riding along on this one.

## Open

1. Install closure fingerprints in the registry, with the re-pin as a predicted consequence.
2. The producer still has no path that naturally emits relation authority.
3. The store is process-local; nothing re-executes an admission record to regain authority.
4. Rule selection stays at zero correspondence over fifteen spent declarations.
