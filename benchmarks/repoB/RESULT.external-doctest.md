# External generalization — against CPython `doctest`

The first test of the claim that actually matters:

> **The entitlement algebra reproduces the accept/reject and reason topology of verifiers it did not
> author.**

Everything before this compared the algebra against decision procedures I wrote, over one shared
`describe()` primitive. `doctest` is written by other people, has its own comparison semantics, and is not
a reimplementation of anything here.

## Result (run 2, after two corrections derived from run 1)

    X1   CONTROL, pristine corpus            HELD, non-vacuously (163 examples ran, 0 failures both sides)
    X2   identical failing sets              48/56      8 disagreements
    X2b  same failure KIND on shared fails   25/25      HELD
    X3   distinct failing-set signatures     16         the mutations really move the answer
    X4   diagnosis: doctest execution model  52/56      explains 4 of the 8, not all

## The claim this supports, stated no more strongly than the evidence allows

**The entitlement algebra was never the locus of disagreement.** Every disagreement found is in the
EVIDENCE-PRODUCTION layer — what counts as an assertion, and how examples are executed. Where the
algebra's reason topology is actually tested, on examples both sides call failing, agreement is **25/25**.

Failing-set agreement is **86%**, not 100%, and the residual is partly unexplained. This is external
evidence of a real but partial correspondence. It is not a clean generalization result.

## Causes, classified before anything was changed

Per the disposition rule frozen in advance.

### Cause A — INCOMPATIBLE SEMANTICS (6 cases, all ONLY-CPYTHON, all `wants == ""`)

    name, ver = parse_sdist_filename("foo-1.0.tar.gz")   wants ""   cpython UNEXPECTED_EXCEPTION
    Specifier(">= 2.2.3").contains("1.2.3")              wants ""   cpython OUTPUT_MISMATCH

My classifier mapped empty expected output to `NO_ASSERTION` and could never fail it. doctest treats it as
a real assertion: **the example must complete silently and without raising.** My model of what a doctest
asserts was strictly weaker than doctest's. Only an external verifier could have shown this — every
internal experiment shared the assumption.

### Cause B — ADAPTER ERROR, MISATTRIBUTION (2 cases + the single differing KIND)

A doctest's "setup" is the examples preceding it in the same docstring. When one raised under mutation, my
harness caught it in the outer `try` and charged the exception to the CURRENT example. Same family as
every identity defect in this project: **evidence attributed to the wrong thing.**

Key collision was RULED OUT rather than assumed — the only-mine example is unique. (4 of 159 example keys
are non-unique: a latent weakness now on record, not a cause here.)

### Cause C — INCOMPATIBLE EXECUTION MODEL (explains 4 of the remaining 8)

doctest has no notion of setup: a docstring is ONE test whose examples run in sequence over SHARED
globals. An earlier failure leaves names unbound, later examples raise `NameError`, and doctest reports
them. My classifier treats each example as independently replayable with reconstructed setup.

That is not a bug. **Per-example replayability is exactly what the witness bank requires**, and it is
precisely what makes it differ from doctest. `MINE_SEQ` — same comparison rules, doctest's execution model
— reaches 52/56, confirming the diagnosis accounts for 4 more.

Note on what `MINE_SEQ` can and cannot show: as the classifier is made more like doctest, agreement stops
being evidence of anything. It exists to test the diagnosis, not to claim a better score.

### Cause D — DISCOVERY: RULED OUT

Both discover exactly **159** examples, with zero difference in either direction. A source-AST miner and a
runtime-object traversal agree completely on this corpus.

### Residual: 4 disagreements, UNEXPLAINED

Not attributed, not repaired, not hidden.

## Run 0 was invalid and is recorded as such

The first execution reported 41/56 and an X2b of 0/0 marked HELD. Both were artefacts: the `MINE` harness
never produced JSON — doctest example stdout corrupted the channel — so `runMine` returned `null` and
`failSet(null)` scored it as ZERO FAILURES.

> **UNOBSERVABLE IS NEVER AN ADMISSION** — a law this project enforces in `legaverify`, broken here by the
> comparison harness itself.

The harness now REFUSES to score an unobservable side. The comparison semantics were not touched at that
point: tuning the classifier toward doctest before measuring would have been fitting, not testing.

## Predictions, as recorded

    Y1  X2 rises to 56/56                          FAILED  — 48/56
    Y2  X2b differing kinds falls to 0             HELD    — 1 -> 0
    Y3  X1 control still HELD                      HELD
    Y4  the 47 already-agreeing mutations agree    HELD    — no regression, onlyMine now 0 everywhere
