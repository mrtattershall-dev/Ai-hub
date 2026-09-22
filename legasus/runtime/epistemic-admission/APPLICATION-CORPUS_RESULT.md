# Application-corpus refusal search — result. H1..H6 against `APPLICATION-CORPUS_PREREG.md`.

    Selection frozen and committed at 9a48009, BEFORE any repository was fetched.
    3 repositories, 3,882 eligible files at the recorded revisions, 3,437 evaluated,
    1 candidate finding, 0 consequential external refusals.

## The headline

> **No consequential external refusal was found. The question stays open.**

One candidate finding surfaced, and independent examination disqualifies it: it is in a **3.5 MB
bundled, minified vendor distribution**, not application code anyone wrote or would act on. The
corpus and budget are **not changed** — the frozen clause forbids searching until success.

## The corpus, at the recorded revisions

| repository | revision | committed |
|---|---|---|
| etherpad-lite | `957efb6e54edbb8dcf19252cba5819769a418502` | 2026-09-21T19:55:09+01:00 |
| Ghost | `a2c06fe5ff60425ece6974fbe6eb1fb70ed38151` | 2026-09-21T16:25:57Z |
| NodeBB | `3f479e8d650d94d64fbfc5a7156f3ebe2e0a68fc` | 2026-09-21T17:27:39-04:00 |

All three clones succeeded; no repository was replaced.

## Both denominators, as frozen

| | etherpad-lite | Ghost | NodeBB | **total** |
|---|---|---|---|---|
| eligible at the revision | 41 | 2,896 | 945 | **3,882** |
| **absent from disk** (checkout failed) | 0 | **175** | 0 | **175** |
| eligible on disk = scanned | 41 | 2,721 | 945 | **3,707** |
| **EVALUATED** | 37 | 2,462 | 938 | **3,437** |
| **INCOMPLETE** | 3 | 259 | 7 | **269** |
| **EXCLUDED** | 0 | 0 | 0 | **0** |
| **VIOLATION (candidate)** | **1** | 0 | 0 | **1** |

**3,437 of 3,882 eligible files were actually evaluated — 88.5%.** The gap is 269 incomplete and 175
that never reached disk. Reporting only the evaluated subset would have shown a clean sweep and
hidden both.

`INCOMPLETE` breaks down as **249 `analysisIncomplete`** (parse failures — JSX, Flow, and files
written for parsers other than the default one, as predicted) and **26 `coverageIncomplete`**
(suppression directives). **None** was silently converted into acceptance.

### Two integrity facts about the corpus, recorded

**Ghost's checkout is incomplete and its git index is empty.** The clone reported an error; 175
eligible files never reached disk, all under deep `ghost/core/core/server/data/migrations/...`
paths — consistent with Windows path limits. They are in the denominator as **absent**, not as
passes.

**The working trees are CRLF-normalised relative to the revisions.** `core.autocrlf=true`. A
12-file digest sample against `HEAD` gave 10 exact matches and 2 differing **only** in line endings
(verified: identical after stripping `\r`). Line endings are irrelevant to this rule, but the
analysed bytes are not the repositories' bytes, and that is stated rather than assumed away.

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

**3. Whether the behaviour is intentional — and the honest limit.** This is **generated bundler
output**. The diagnostic is an artefact of minification, not a decision by etherpad's authors, and
nobody would act on it in this file. **I cannot determine intentionality in the original sources
from the minified bundle** — there is no source map — so what I can establish is provenance and
generation, not intent. On provenance alone this **does not qualify as a consequential finding**.

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

**No consequential external refusal.** The single candidate is generated vendor output. **The result
stays open.** The corpus selection and the scan budget are unchanged; no fourth repository was added
and no filter was widened after seeing the outcome.

## Predictions

- **"I expect at least one candidate finding" — held, weakly.** One appeared, and it does not
  survive examination as consequential. I recorded that I had no evidence for this beyond the
  libraries result, and that stands.
- **"I expect the INCOMPLETE bucket to be non-trivial, mostly parse failures" — held.** 269, of
  which 249 are parse failures.
- **"I expect the evaluated subset to be substantially smaller than the eligible denominator" —
  held.** 3,437 of 3,882, and the 175-file checkout gap was not something I anticipated.

## Untouched

Registry still **3 authored rules, 0/15**. **S6, F2, `COMPLETE`, `INVALIDATE`** untouched. The
preserved specimen adapter is unmodified; the repaired adapter ran **as committed**.
