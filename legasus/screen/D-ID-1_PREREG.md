# D-ID-1 — candidate identity, defined independently of Git

Frozen 2026-10-01, BEFORE any digest is implemented. Follows D-CONSUME-1 (80f0317b), which scoped
D's repair to identity/provenance and added one obligation: the identity must exist for every
candidate. Object and edge-rule choices made by tatte, 2026-10-01.

## The contract

> `candidateIdentity(C)` is a deterministic, content-addressed identifier of the candidate state
> supplied to evaluation. It depends only on that defined state and is invariant to the enclosing
> repository, absolute location, invocation context, and unrelated filesystem state.

## What object it names (DECIDED: the mounted snapshot)

The worker mounts the WHOLE evaluated directory read-only at `/candidate` (evaluator.js runCheck).
The identity names what a check can observe there:

    INCLUDED  every regular file and every symlink under the evaluated root
    EXCLUDED  any entry whose path has a component named EXACTLY `.git` (file or directory)
              - exact component match, never a substring: `.gitignore`, `.gitattributes`,
                `.github/` are INCLUDED. batch.js's `includes(sep+'.git')` is the counterexample.

Ignored and untracked files are included: a check can read them, so the identity must name them.

## Canonical form (frozen as version `cid1`; later changes are versioned by addition)

    per entry   <type> \0 <path> \0 <sha256 of content>   type: F file, L symlink
                path: relative to the root, '/' separators, the name's UTF-8 bytes as-is -
                      no Unicode or case normalization (normalizing could merge distinct names)
                F: exact bytes, no line-ending translation (CRLF and LF are DIFFERENT content)
                L: the link TARGET string, never followed
    ordering    entries sorted by the UTF-8 byte order of <path>
    identity    "cid1:" + sha256(manifest)

## Edge rules (DECIDED: fail closed, bytes exact)

    unreadable or unrepresentable entry (e.g. a name ending in "." on Windows)
                -> identity UNAVAILABLE, never a skip. A skipped entry would name a different object.
    read error, permission error -> UNAVAILABLE
    declared OUT, listed as KNOWN BLIND SPOTS (identical identity, may differ observably):
        executable bit / file mode
        empty directories
        contents of excluded `.git` entries - a check CAN read /candidate/.git
        timestamps, ownership

## Binding to the verdict

The identity is computed on the evaluated root immediately BEFORE the checks and again immediately
AFTER. If they differ, the verdict is EVALUATION_ERROR: the subject changed while being judged.
Availability: for any readable directory the identity EXISTS - enclosing repository, commit state
and location play no part. (D-CONSUME-1 arm E: the current identity makes PASS vs EVALUATION_ERROR
depend on context.)

## Metamorphic tests (frozen; written BEFORE the implementation)

    #   transformation                                   expected
    M1  same candidate, different parent repo            SAME
    M2  same candidate, different absolute path          SAME
    M3  same candidate, no enclosing repo                SAME   (and AVAILABLE)
    M4  same candidate, commitless enclosing repo        SAME   (and AVAILABLE)
    M5  change unrelated parent-repo HEAD                SAME
    M6  modify an unrelated sibling directory            SAME
    M7  change an included file's contents, uncommitted  DIFFERENT
    M8  add / remove an included file                    DIFFERENT
    M9  rename an included path                          DIFFERENT
    M10 CRLF <-> LF in an included file                  DIFFERENT
    M11 add/change .gitignore, .gitattributes, .github/x DIFFERENT
    M12 change contents under the candidate's own .git   SAME   (declared exclusion)
    M13 change a symlink's target                        DIFFERENT
    M14 add an empty directory / flip the exec bit       SAME   (declared blind spot)
    M15 entry with a name Windows cannot represent       UNAVAILABLE, never an identity
    M16 candidate with its own .git vs the same bytes without one   SAME
    M17 ADVANCE PRESERVES IDENTITY: identity(baseline after batch.js's copy)
        == identity(the candidate that was evaluated)    EQUAL

## Run against the CURRENT identity first (the must-fire baseline)

Before any new code, the suite runs against the shipped `candidateTree()` (HEAD^{tree}). A suite
that the current, known-defective identity passes cannot distinguish a repair. Predicted current
failures, recorded so they can be wrong:

    M1, M5          fail in the no-.git shape (reports the parent's tree)
    M3, M4          fail - UNAVAILABLE (EVALUATION_ERROR), not SAME
    M7, M8, M9, M10, M13   fail when uncommitted - HEAD^{tree} does not see the working bytes (D-PROP-1)
    M17             fails for a candidate containing .gitignore/.gitattributes/.github (batch.js filter)
    M2, M6, M12, M16 expected to pass in their own-repo forms

The new identity is accepted only when it passes all seventeen AND the current identity is shown
to fail the rows above (or the prediction is corrected with the observed result).

## Scope

This is the definition and its tests. Wiring the identity into evaluator.js, acceptance.js and the
journal, and repairing the batch.js copy filter, are separate steps, each with its own controls.
The receipt fields keep their old names until a migration is designed; D stays unrepaired until
D-ID-1 passes.
