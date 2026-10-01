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

## Amendment 1 - 2026-10-01 - before the regression suite exists (tatte's corrections)

### Responsibility boundaries. Every result is reported against ONE of these, never as a total.

    finding                                        boundary                  property tag
    same snapshot, different identity              identity construction     INVARIANCE
    different snapshot, same identity              identity construction     FIDELITY
    readable candidate receives no identity        identity construction     AVAILABILITY
    unrepresentable candidate receives an identity identity construction     REPRESENTABILITY
    baseline missing candidate files               WORKSPACE CONSTRUCTION    PRESERVATION
    identity changes during evaluation, undetected evaluation consistency    CONSISTENCY
    receipt names a different snapshot             receipt binding           BINDING

M17 is re-tagged PRESERVATION - a WORKSPACE-construction property. A correct cid1 reporting that
the baseline differs from the candidate is the identity working, not failing. cid1 is NEVER
weakened to absorb the copy defect; the copy is repaired on its own counterexample.

### M17 compares SNAPSHOTS, not recorded trees

M17 runs the real batch.js copy (runBatch, chain on) on a candidate holding .gitignore,
.gitattributes and .github/, then compares the evaluated workspace with .accepted-baseline - and
with the next task's starting directory - using a direct snapshot comparison oracle (below), not
git trees and not any identity under test.

### Symlinks: which object (DECIDED by this amendment)

cid1 identifies the LINK ITSELF: its stored target text as returned by readlink, never followed.
Following a link and hashing its destination identifies a different object (the destination
belongs to whatever the link points at, possibly outside the candidate). Consequences, frozen:
retargeting a link -> DIFFERENT; changing the destination's bytes while the link text is unchanged
-> SAME for the link entry (the destination, if inside the root, is its own entry); a dangling link
has an identity. On this machine creating a symlink may need privilege: if it cannot be created,
M13 is NOT_RUNNABLE, never passed.

### Two rows added, versioned by addition

    M18 CONSISTENCY  the candidate is modified from the host WHILE a check runs  -> EVALUATION_ERROR
    M19 BINDING      a check prints what it saw; the receipt's named snapshot must contain
                     exactly those bytes (uncommitted change, own repo)           -> receipt matches

### Concurrency limitation, stated like B's TOCTOU bound

The before/after comparison detects a change ACROSS the evaluation interval. It does not make the
snapshot atomic: a file that changes and changes back between the two traversals, or a write that
lands between two entries of ONE traversal, is not detected. The read-only mount prevents the CHECK
from writing; it does not prevent the host. Atomic capture (copy-then-evaluate, or a filesystem
snapshot) is a separate design question, not claimed by cid1.

### The comparison oracle (test apparatus, deliberately NOT cid1)

Pairwise comparison of two directories: the entry set (exact-.git-component exclusion, lstat type,
readlink text for links, exact bytes for files) compared directly, entry by entry, with no digest
and no canonical form. It establishes each row's PRECONDITION - that the two snapshots really are
the same, or really differ - so no row can pass or fail vacuously. Its own controls: a copy compares
SAME, a one-byte change compares DIFFERENT.

### How the CURRENT identity is measured

Through the shipped path: `evaluate(dir, trivial task).candidateTree`, null = UNAVAILABLE. Each
row runs in the shape(s) where it is meaningful: OWN (the candidate has its own committed repo, the
production shape) and BARE (no own .git, inside a parent repo). A BARE identity equal to the
enclosing repo's HEAD tree is flagged NAMES_PARENT - a row that "holds" that way holds vacuously.

### Outcomes per row and shape

    HOLDS / VIOLATED (property tag) / HOLDS_VACUOUSLY / NOT_RUNNABLE / APPARATUS_FAULT
The milestone is NOT 17/17 green: it is a preserved record of exactly where the old identity
violates the contract, sealed through EH1, compared against the predictions above.

### Acceptance criteria for the EVENTUAL repair (frozen now, judged later)

    1 every readable, representable candidate receives an identity
    2 identical snapshots -> identical identities, regardless of repository context
    3 every included content or path mutation changes the identity
    4 a snapshot changed during evaluation -> EVALUATION_ERROR
    5 the receipt identifies the snapshot actually checked
    6 the baseline copy preserves the included snapshot          (workspace construction)
    7 existing consumers remain green
    8 the D-PROP-1 and D'-1 counterexamples REVERSE with their inputs unchanged

## Amendment 2 - 2026-10-01 - before cid1 is implemented (tatte: build cid1, keep D-COPY/D-CONS/D-BIND red)

### The four defects are owned separately and repaired in order

    D-ID    identity construction   -> cid1                      (this step)
    D-COPY  snapshot preservation   -> the copy mechanism         (next)
    D-CONS  evaluation consistency  -> before/after binding        (then)
    D-BIND  receipt binding         -> receipt semantics           (last)

cid1 is a PURE OBSERVER: given a directory it returns an identifier or a refusal. It copies nothing,
runs no git, commits nothing, writes nothing, decides no verdict, and is NOT wired into evaluator.js,
acceptance.js, batch.js or any receipt in this step - wiring it is D-BIND's.

### Encoding (unambiguous framing, not delimiters)

    digest = sha256( DOMAIN || u64(count) || entry_1 || ... || entry_n )
    DOMAIN = the ASCII bytes "legasus/candidate-identity/cid1" followed by one 0x00
    FILE    entry = 0x46 'F' || u64(len path) || path || u64(len bytes) || sha256(bytes)
    SYMLINK entry = 0x4C 'L' || u64(len path) || path || u64(len target) || target
    u64 = 8-byte big-endian length. path/target = UTF-8 bytes. Entries sorted by Buffer.compare
    of path bytes - independent of enumeration order. Identity string: "cid1:" + hex(digest).
Every variable-length field is length-prefixed, so no filename can forge a boundary.

### Representability, reinterpreted (tatte)

Fail closed on what cid1 CANNOT FAITHFULLY NAME - not on names that look strange. On Windows, cid1
traverses with the `\?\` path form, which addresses names exactly (no trailing-dot or
trailing-space stripping). A name that can be enumerated, read and encoded exactly is AVAILABLE.
REFUSED (UNAVAILABLE) only when:
    - a name or link target is not well-formed Unicode (a lone surrogate cannot be encoded to UTF-8
      without collapsing into U+FFFD - two distinct names would share one encoding)
    - an entry is neither file, directory nor symlink (fifo, socket, device)
    - any read, stat or readlink fails
M15 therefore becomes three measurements, replacing "a name ending in '.' -> UNAVAILABLE":
    M15a  odd. is AVAILABLE and the worker's view of /candidate lists exactly cid1's entry names
          (if the worker sees something cid1 does not name, or vice versa, M15 is VIOLATED)
    M15b  COLLAPSE: {odd, odd.} with different bytes vs {odd} alone -> DIFFERENT identities
    M15c  a name with a lone surrogate -> UNAVAILABLE (NOT_RUNNABLE if it cannot be created)
The old suite's M15 "VIOLATED" is re-read under this interpretation as: the old identity returned
an identity that omitted the entry entirely (odd. was never in HEAD) - a FIDELITY fact, not proof
that availability was wrong.

### M13

UNMEASURED ON WINDOWS - requires a symlink-capable environment. The behaviour is implemented to
the frozen semantics; the row is run under Linux before the cross-platform contract is declared.

### Predictions for the cid1 run, frozen

    identity rows (measured on cid1 directly):
      M3, M4                    HOLD (AVAILABILITY)
      M1, M2, M5, M6, M12, M14, M16   HOLD genuinely (not vacuously)
      M7-M11, every shape, incl. M11 ignored+committed   HOLD (FIDELITY)
      M15a  odd. AVAILABLE; worker listing: NO PREDICTION (Docker Desktop's handling of a trailing
            dot through a bind mount is unknown to me)
      M15b  HOLD   M15c  UNAVAILABLE or NOT_RUNNABLE
      M13   UNMEASURED ON WINDOWS
    other boundaries (shipped paths, unchanged) - must STAY RED:
      M17 PRESERVATION VIOLATED   M18 CONSISTENCY VIOLATED   M19 BINDING VIOLATED
    If any of M17-M19 turns green, cid1 has leaked into a mechanism it does not own: a FAILURE of
    this step, not a bonus.
