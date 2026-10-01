# D-ID-1 — cid1: identity construction repaired, and nothing else

Contract: `D-ID-1_PREREG.md` @ 1c3a2b1c + A1 3e14f827 + A2 a69aaddd (A2's `\\?\` restored at 9562cf74).
Implementation: `server/cid1.mjs`. Unit tests: `server/cid1.test.mjs` (24). Mutants: `server/cid1.mutants.mjs`.
Suite: `DID1_IDENTITY=cid1 node server/did1.regression.mjs`.

    EH1 53222095  old HEAD^{tree} identity, the violations preserved            (88e831f1)
    EH1 ac3dfe9e  cid1 run 1 - M15c precondition never established (apparatus), preserved
    EH1 236ef75c  cid1 run 2 - VALID; the result below

## The state this commit establishes

    property            boundary                 old HEAD^{tree}             cid1
    AVAILABILITY        identity construction    VIOLATED  M3, M4            holds
    INVARIANCE          identity construction    VIOLATED  M1, M5, M16       holds (M2, M6 no longer vacuous)
    FIDELITY            identity construction    VIOLATED  M7-M11            holds, every shape, incl. ignored+committed
    REPRESENTABILITY    identity construction    (re-read under A2)          holds  M15a, M15b, M15c
    PRESERVATION        WORKSPACE construction   VIOLATED  M17               STILL VIOLATED   <- D-COPY
    CONSISTENCY         evaluation consistency   VIOLATED  M18               STILL VIOLATED   <- D-CONS
    BINDING             receipt binding          VIOLATED  M19               STILL VIOLATED   <- D-BIND
    not measured        M13 symlinks             UNMEASURED ON WINDOWS - requires a symlink-capable environment
                        M14 exec bit             Windows has no exec bit (declared blind spot)

21 of 21 frozen predictions correct (A2). The three red rows are red ON PURPOSE: cid1 is a pure
observer wired into nothing (no file imports it but its own tests and the suite), so it could not
have repaired them - and it did not. That is what proves it repaired identity construction only.

Two of the red rows now carry the signal their owner will need, unconsumed:
- M17: cid1(candidate) `05983b2c…` vs cid1(baseline) `ed44d721…` - DIFFERENT. The identity reports
  the copy defect instead of hiding it; cid1 was not weakened to absorb it.
- M18: cid1 before vs after the evaluation - DIFFER. The before/after binding D-CONS needs exists;
  nothing consumes it yet.

## M15, under tatte's reinterpretation (refuse what cannot be faithfully named)

    M15a  odd. (trailing dot) is NAMED, and the WORKER's own `find` of /candidate lists exactly the
          host's entries: [keep.txt, lib/util.js, odd., subject.js] on both sides. Availability is
          correct here - nothing the evaluator observes goes unnamed.
    M15b  {odd} vs {odd, odd.} with different bytes -> different identities. No collapse. (The
          ordinary Windows path form would have read `odd.` as `odd` - another file's bytes.)
          CORRECTED by D-ID-1 RECONCILE R3: that parenthetical was ASSUMED and is FALSE for
          absolute paths through Node - an ordinary read of `odd.` returned odd.'s own bytes.
    M15c  a REAL lone-surrogate name -> refused (lstat ENOENT); alongside its U+FFFD lookalike ->
          refused (two entries share one path encoding).

**Finding about my own design:** on Windows Node's readdir never yields a lone surrogate - it decodes
one to U+FFFD - so cid1's `isWellFormed()` checks never fire there. Fail-closed is real but arrives
by a different route: lstat on the decoded name, and the duplicate-path check. Recorded in cid1.mjs;
the well-formedness checks stay as defence for `identityOf` callers and other platforms.

**Apparatus fault, mine (run ac3dfe9e):** M15c created its file with Node, which writes U+FFFD in
place of a lone surrogate - a WELL-FORMED name. cid1 named it correctly and the row printed
VIOLATED for a precondition that was never established. Run 236ef75c creates the names with .NET and
proves the D800 on disk from PowerShell's code points before asking cid1.

## The tests were tested

Unit tests: 24 passed. Mutants, each breaking one frozen guarantee:

    CAUGHT   tab/newline text framing (the real delimiter ambiguity)
    CAUGHT   prefix exclusion of .git (batch.js's bug, transplanted)
    CAUGHT   version domain dropped from the digest
    CAUGHT   entries left unsorted
    ESCAPED  path NUL-terminated instead of length-prefixed - an EQUIVALENT mutant: filesystem paths
             cannot contain NUL, and a forgery would need a path whose UTF-8 reproduces a raw sha256

**Weak test caught by a mutant:** the first framing test compared entry sets of DIFFERENT size, which
differ under any framing because the count is hashed. Replaced by a genuine equal-count forgery that
provably collides under delimiter framing (asserted inside the test) and is separated by cid1.

## Acceptance criteria (A1) - where cid1 stands

    1 every readable, representable candidate receives an identity      MET (M3, M4, M15a)
    2 identical snapshots -> identical identities, any context          MET (M1, M2, M5, M6, M16)
    3 every included content or path mutation changes the identity      MET on Windows; symlinks unmeasured
    4 a snapshot changed during evaluation -> EVALUATION_ERROR           NOT MET - D-CONS
    5 the receipt identifies the snapshot actually checked               NOT MET - D-BIND
    6 the baseline copy preserves the included snapshot                  NOT MET - D-COPY
    7 existing consumers remain green                                    trivially: nothing consumes cid1 yet
    8 D-PROP-1 and D'-1 counterexamples reverse, inputs unchanged        NOT YET - needs D-BIND (the receipt)

## Not established

Windows only - M13 must run under Linux before the cross-platform contract is declared. One
instance per row. No atomic snapshot: one traversal can straddle a concurrent write (A1's stated
limit). cid1 reads whole files into memory - fine for workspaces, untested on very large files.
