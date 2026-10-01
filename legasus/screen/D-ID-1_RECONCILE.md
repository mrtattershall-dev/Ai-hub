# D-ID-1 RECONCILE — two cid1 implementations, one oracle

Frozen 2026-10-01 05:4x CDT, BEFORE the reconcile probe exists. Decided by tatte: reconcile before
D-COPY, because D-COPY's acceptance test is `cid1(candidate) === cid1(baseline)` and the two
implementations may answer differently on exactly the entries that test uses.

## The two implementations, both on candidate-0

    server/candidateIdentity.mjs   3e7db019 05:00, 0c1e8571 05:07   (session "C-I")
    server/cid1.mjs                8a062953 05:09                    (session "cid1")

Neither checked for the other before committing. COORD-1.md (written by C-I) says "only one
implementation of cid1 exists" - true when written, false after 8a062953.

## The contradiction to settle BY MEASUREMENT

    C-I    "lstatSync('\\\\?\\' + p) throws ENOENT through node EVEN FOR AN ORDINARY FILE on this
            platform" -> extended-length prefix REJECTED; addressability via realpath round-trip.
    cid1   traverses EVERY entry through the \\?\ form (lstat, readdir, read, readlink) and passes
            24 unit tests + every identity row on the same machine.

Both cannot be true of the same call. HYPOTHESIS (cid1 session, untested): the prefix disables
Win32 path normalization, so a prefixed path containing FORWARD slashes, or a relative path, fails
with ENOENT while a prefixed absolute BACKSLASH path succeeds. If so, C-I's rejection measured its
path construction, not the prefix - and C-I's M15 premise check (which writes through the prefix)
may never have created a trailing-dot entry at all.

## Probe rows (each recorded whatever it shows)

    R1  lstat through \\?\ on an ORDINARY file, three constructions: absolute+backslashes,
        absolute+forward slashes, relative. Which succeed?
    R2  create `odd.` through a correct prefix; prove it exists from an independent lister
        (PowerShell -LiteralPath on the \\?\ form AND the worker's `find` inside /candidate).
    R3  MISREAD: a directory holding `odd` (bytes A) and `odd.` (bytes B). Ordinary-path read of
        `odd.` vs prefixed read of `odd.` - which bytes does each return?
    R4  both implementations over every identity row of the frozen suite (did1.regression.mjs,
        identity rows only), compared by OUTCOME - same/different/unavailable - never by digest
        (their encodings differ by design, so digests are not comparable).

## Decision rule (frozen now)

The survivor is the implementation that, on this machine:
    1  holds every runnable frozen identity row (A1/A2 rows incl. M15a/b/c as amended)
    2  is AVAILABLE where the worker can see an entry AND the traversal reads its exact bytes
       (tatte, A2: "fail closed on what cid1 cannot faithfully name, not on names that look odd")
    3  never returns an identity built from MISREAD bytes (R3)
If both satisfy 1-3, the survivor is the one whose recorded measurements REPRODUCE under R1-R3.
If neither, both stay unaccepted and D-COPY does not start.

The non-survivor is NOT deleted: it is marked SUPERSEDED in its header, with a pointer here, and
removed from any import path. Its tests and records stay.

## What this does not decide

Encoding choice (length-prefixed vs NUL-terminated fixed-width) is not a correctness question
here - both are unambiguous for filesystem input. The survivor's encoding is kept as-is.
