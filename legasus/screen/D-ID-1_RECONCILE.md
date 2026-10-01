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

## RESULT - measured 2026-10-01 after the freeze above

Evidence (EH1, all SEALED): R1-R3 `1f764685`; R4 cid1.mjs `236ef75c` (existing), R4 candidateIdentity
`30dea105`; R5 POST HOC `d4b733e5`.

    R1  lstat through the prefix, ordinary file:
          absolute + backslashes      OK
          absolute + forward slashes  OK      <- my hypothesis was HALF WRONG: slashes are fine
          join(prefix + root, name)   OK
          RELATIVE prefixed path      ENOENT  <- the only construction that fails
        The C-I rejection ("ENOENT even for an ordinary file") does NOT reproduce for any absolute
        construction. It reproduces for a relative one; C-I's probe code was not preserved, so the
        cause of C-I's measurement stays UNCONFIRMED - only the general claim is refuted.
    R2  `odd.` created through a correct prefix EXISTS: node readdir, PowerShell -LiteralPath and the
        worker's own `ls -A /candidate` all list it. C-I's premise check never created one.
    R3  {odd = A, odd. = B}: the ORDINARY read of `odd.` returns B - its own bytes. Node namespaces
        absolute paths itself, so no trailing-dot stripping occurs. This REFUTES two records:
          cid1 session  "the ordinary form would have read odd. as odd"  (assumed, never measured)
          C-I session   "readFileSync SUCCEEDED while reading a different object" (3e7db019)
        Both implementations return an identity and both distinguish {odd, odd.} from {odd}.
    R4  every identity row, both implementations, same machine. IDENTICAL outcomes on every row
        except one:
          M15c lone surrogate + its U+FFFD lookalike   cid1.mjs REFUSES   candidateIdentity RETURNS
    R5  (POST HOC - not in the frozen plan, reported as such) the consequence R4 predicts: two
        directories distinguishable on disk (the lone-surrogate file holds VERSION ONE vs VERSION
        TWO) -> candidateIdentity gives BOTH cid1:f0e26b45f15ad2c9..., a COLLAPSE. Node decodes the
        lone surrogate to the lookalike's name, both entries read the lookalike's bytes, and no
        duplicate-path check stops it. cid1.mjs refuses both ("two entries share one path encoding").

## DECISION (by the frozen rule)

    criterion 1  every runnable identity row        cid1.mjs YES   candidateIdentity NO (M15c)
    criterion 2  available where worker + exact read cid1.mjs YES   candidateIdentity YES
    criterion 3  never an identity from misread bytes cid1.mjs YES   candidateIdentity NO (R4/R5)

**SURVIVOR: server/cid1.mjs.** candidateIdentity.mjs and its test are marked SUPERSEDED in their
headers, kept with their records, and imported by nothing new. COORD-1.md's "only one
implementation of cid1 exists" was true when written and is now historical.

What the superseded implementation got RIGHT and the survivor should consider, not adopted here:
reserved Windows device names (CON, NUL, COM1..) are rejected by shape there and untested in
cid1.mjs - an OPEN row, not a known defect.

Corrections made to the survivor's own record: cid1.mjs's comment and D-ID-1_CID1_RESULT.md carried
the refuted R3 claim; both now say it was assumed and false.
