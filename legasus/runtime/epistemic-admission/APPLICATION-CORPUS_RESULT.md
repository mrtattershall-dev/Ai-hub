# Application-corpus refusal search — result. H1..H6 against `APPLICATION-CORPUS_PREREG.md`.

    Selection frozen and committed at 9a48009, BEFORE any repository was fetched.
    3 repositories, 3,882 eligible files at the recorded revisions, 3,438 evaluated,
    1 rule violation found, 0 established as consequential.
    ACCOUNTING CORRECTED after review; every count below reconciles exactly.

## The headline

> **One external rule violation was found. Its consequence is unestablished, so no consequential
> external refusal is established. The question stays open.**

The violation is in a **3.5 MB bundled, minified vendor distribution** — outside the intended target
of *authored application code*, though inside the frozen eligibility filter. **Generated provenance
is not evidence that the finding is inconsequential**; consequence and intent are simply not
established either way. The corpus and budget are **not changed** — the frozen clause forbids
searching until success.

## The corpus, at the recorded revisions

| repository | revision | committed |
|---|---|---|
| etherpad-lite | `957efb6e54edbb8dcf19252cba5819769a418502` | 2026-09-21T19:55:09+01:00 |
| Ghost | `a2c06fe5ff60425ece6974fbe6eb1fb70ed38151` | 2026-09-21T16:25:57Z |
| NodeBB | `3f479e8d650d94d64fbfc5a7156f3ebe2e0a68fc` | 2026-09-21T17:27:39-04:00 |

All three clones succeeded; no repository was replaced.

## Both denominators, as frozen — accounting corrected

**The first version of this table labelled a column "EVALUATED" that in fact counted *evaluated
without a violation*.** That made the candidate look like it sat outside the evaluated set. It did
not: the file was evaluated, and a violation was the outcome. Corrected:

| | etherpad-lite | Ghost | NodeBB | **total** |
|---|---|---|---|---|
| eligible at the revision | 41 | 2,896 | 945 | **3,882** |
| **absent from disk** (checkout failed) | 0 | **175** | 0 | **175** |
| eligible on disk = scanned | 41 | 2,721 | 945 | **3,707** |
| evaluated, **no violation** | 37 | 2,462 | 938 | **3,437** |
| evaluated, **violation found** | **1** | 0 | 0 | **1** |
| **TOTAL EVALUATED** | **38** | **2,462** | **938** | **3,438** |
| INCOMPLETE | 3 | 259 | 7 | **269** |
| EXCLUDED | 0 | 0 | 0 | **0** |

Each repository reconciles: `evaluated + violation + incomplete + excluded = eligible on disk`
(41, 2,721, 945). Corpus-wide: **3,438 + 269 = 3,707 on disk**, and **3,707 + 175 absent = 3,882
eligible at the revisions**.

**3,438 of 3,882 eligible files were actually evaluated — 88.6%.** The gap is 269 incomplete and 175
that never reached disk. Reporting only the evaluated subset would have shown a clean sweep and
hidden both.

### The INCOMPLETE breakdown — corrected, and its overlap limit stated

    analysisIncomplete   243     parse failures: JSX, Flow, files for other parsers
    coverageIncomplete    26     suppression directives
    ruleNotRun             0
                         ---
                         269     exactly the INCOMPLETE bucket

**The first version said 249 parse failures. That was an arithmetic error on my part** — the figure
is **243** (3 + 239 + 1), and 243 + 26 = 269 with nothing left over.

**Overlap is not measured, and cannot be read off these numbers.** The scanner assigns each file
**one** reason by priority — `analysisIncomplete`, else `coverageIncomplete`, else `ruleNotRun` —
so a file that both fails to parse *and* carries a suppression is counted once, under the first.
The reasons therefore sum to the bucket **by construction**, not because they are disjoint. What is
established is the bucket total; the joint distribution is not.

**None** of the 269 was silently converted into acceptance.

### Two integrity facts about the corpus, recorded

**Ghost's checkout is incomplete and its git index is empty.** The clone reported an error; 175
eligible files never reached disk, all under deep `ghost/core/core/server/data/migrations/...`
paths — consistent with Windows path limits. They are in the denominator as **absent**, not as
passes.

**The experiment ran on working-tree bytes associated with the frozen revisions, not on the
repositories' bytes.** `core.autocrlf=true`, so checkout rewrote line endings.

**Scope of what was checked, stated precisely:** a **12-file sample** from Ghost was digested against
`HEAD` — 10 exact matches, 2 differing **only** in line endings (verified identical after stripping
`\r`). **That establishes line-ending equivalence for those twelve files. It does not establish it
for the corpus.** The other 3,695 files were not digested against their revisions at all.

## The candidate finding, examined independently

**File:** `etherpad-lite/src/static/vendor/scalar/standalone.js` — tracked at the recorded revision.

**1. What the source does.** It is the vendored Scalar API-reference distribution: **3,506,377 bytes
across 2,363 lines** — an average of **1,483 bytes per line**, with a longest line of **567,474
characters**. The cited sites are minified bundle output (`(function(e,t){typeof exports===...`).
It is not hand-written source.

**2. Why the rule applies.** Three sites where a callback passed to `map`/`reduce` has a path that
returns nothing. Under the frozen eligibility filter this file **is** eligible: I excluded
`dist/`, `build/`, `out/`, `coverage/` and `*.min.js`, and **not** `vendor/`. The filter was frozen
before the corpus was fetched and **is not being changed now**.

**3. Whether the behaviour is intentional — and what provenance does NOT settle.** This is
**generated bundler output**, and there is no source map, so I cannot reach the original sources to
ask what the callbacks were meant to do.

**Corrected after review: generated provenance does not establish that a finding is inconsequential.**
Bundled code executes, and a callback that fails to return in a bundle can carry consequence exactly
as one in hand-written source can. The first version of this document slid from *"generated"* to
*"nobody would act on it"* — that is turning **inability to establish consequence** into **evidence
of no consequence**, and it is withdrawn.

What the evidence supports, exactly:

> **One external rule violation, in generated vendor code. Behavioural consequence: unestablished.
> Intentionality: unestablished.**

**The target and the eligibility filter are different things, and the difference is mine.** The
experiment was aimed at *authored application code*; the frozen filter admitted any `.js`/`.mjs`/
`.cjs` outside `dist/`, `build/`, `out/`, `coverage/` and `*.min.js`, which lets vendored bundles
through. The filter was frozen before the corpus was fetched and **is not being changed now** — but
the finding lands outside the intended target, and that is a property of my filter, not a verdict on
the finding.

**4. The adapter preserves the diagnostic.** All three messages verbatim, with line numbers.

**5. Production admission refuses.** `coverage: ESTABLISHED`, `coverageFiled: true`, decision
**`FRONTIER_OPEN`** — *"no closed alternative in the certificate; array-callback-return at line 16:
… line 276: … line 516: …"*. Coverage **was** established, so the refusal is the violation itself,
not a coverage gap. Two clean etherpad files (`index.js`, `pad.js`) through the same path both
`ESTABLISHED` with coverage filed, so the refusal is discriminating rather than universal.

## A harness defect, found by the three-outcome split

The first scan classified **41 of 41 etherpad files as `EXCLUDED`**. Cause: eslint's flat config
treats files outside the base path as ignored, and the scanner ran with its working directory in the
adapter's own folder. Re-run with the working directory at each repository root: 37 evaluated, 3
incomplete, 1 violation.

**The `EXCLUDED` bucket caught a harness defect that a two-way pass/fail split would have reported as
41 clean files.** That is the clearest evidence in this run that keeping the three outcomes separate
was worth the cost. **The adapter was not modified** — only the harness's working directory, exactly
as the preregistration requires.

## What this establishes

**External applicability, demonstrated end to end on foreign code:** an externally selected,
rule-identified obligation ran over 3,437 files from three repositories I did not write, produced
one true diagnostic, and production admission refused the corresponding claim with the external
tool's own reason preserved — while clean files from the same repository established.

**It does NOT demonstrate detection beyond eslint.** Every finding here is eslint's. Legasus found
none of them and added no finding of its own. That sentence was frozen into the preregistration
before the run and stands unchanged.

**No consequential external refusal is ESTABLISHED** — not because the finding was shown harmless,
but because its consequence was never determined. **The result stays open.** The corpus selection and
the scan budget are unchanged; no fourth repository was added and no filter was widened after seeing
the outcome.

**The strongest practical finding in this run is the harness defect above.** The repaired coverage
interface made a real mistake *visible* — 41 files that a pass/fail interface would have reported as
clean admissions — instead of converting it into acceptance. That is a demonstrated benefit of
representing incomplete analysis explicitly. **The coverage checks that produced it remain the
adapter's**, not Legasus's: Legasus enforced the account it was given, and still does not
independently establish that account's truth.

## Predictions

- **"I expect at least one candidate finding" — held.** One appeared. Whether it is consequential is
  unestablished, so the prediction is confirmed at the level it was made and no further.
- **"I expect the INCOMPLETE bucket to be non-trivial, mostly parse failures" — held.** 269, of
  which **243** are parse failures.
- **"I expect the evaluated subset to be substantially smaller than the eligible denominator" —
  held.** 3,438 of 3,882, and the 175-file checkout gap was not something I anticipated.

## Closed

**This experiment is closed.** No repository is added. The next useful step is **independent
reproduction of this pipeline and its candidate** — not another search chosen to produce a positive
headline.

**The 0/15 registry result is preserved alongside this.** It is a historical result about fifteen
declarations from this project's own past; this is a separate, successful **external mapping** of one
obligation. Neither is added to the other's denominator.

## Untouched

Registry still **3 authored rules, 0/15**. **S6, F2, `COMPLETE`, `INVALIDATE`** untouched. The
preserved specimen adapter is unmodified; the repaired adapter ran **as committed**.
