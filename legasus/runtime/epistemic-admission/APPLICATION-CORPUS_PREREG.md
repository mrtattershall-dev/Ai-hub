# Application-corpus refusal search — H1..H6. Frozen 2026-09-21, before any repository is fetched.

## What is being searched for

A **consequential refusal on application code I did not write**: the selected external obligation
firing on a real repository, the adapter preserving the diagnostic, and production admission
refusing the corresponding claim.

Published packages have already been searched: **3,154 files, 0 findings**. That search is not
re-run and its result is not revised.

## Repository selection — named here, before any fetch

No local third-party application corpus exists (`vendor/` holds chromium and godot; there is no JS
application code on disk I did not write). So the corpus is cloned, and the repositories are
**named now**, in the frozen document, before any is fetched or linted.

**Criterion, stated rather than mechanical:** JavaScript **applications** — deployable end-user
systems, not published libraries — because the packages already scanned are libraries and libraries
are the population that lints clean. Within that criterion, **alphabetical**:

    1. etherpad-lite      https://github.com/ether/etherpad-lite
    2. Ghost              https://github.com/TryGhost/Ghost
    3. NodeBB             https://github.com/NodeBB/NodeBB

**STEERING, DISCLOSED:** I named these three from my own knowledge of the JavaScript ecosystem.
That is human selection and it is recorded as such. What it is **not** is selection by whether the
rule fires: **no repository has been fetched, and the linter has been run on none of them.** The
property that matters for this experiment is preserved.

**If a clone fails**, that repository is recorded as a fetch failure and **is not replaced**. The
corpus is these three or fewer.

## Frozen before the run

**Revisions.** Each repository is cloned `--depth 1` at its default branch, and the **commit SHA is
recorded** in the result. The analysis is against that revision and no other.

**File eligibility.** A file is eligible iff:
- extension is `.js`, `.mjs` or `.cjs`; and
- it is not under `node_modules/`, `dist/`, `build/`, `out/`, `coverage/`, `.git/`; and
- its name does not end in `.min.js`.

Eligibility is **path-based only** and is decided before any file is opened.

**Configuration.** The repaired adapter's own configuration: the selected rule at `error`,
`reportUnusedDisableDirectives: 'error'`, and **no repository configuration is loaded**. This is
declared, not discovered — the claims produced are under *this* configuration, and a repository's
own lint gate is a different question.

**Scan budget.** **Three repositories and 6,000 eligible files, whichever is reached first.** If the
budget is exhausted mid-repository, that is recorded and the denominator says so.

## The three outcomes, kept separate

| outcome | meaning |
|---|---|
| **EVALUATED** | the rule ran with every required coverage basis satisfied |
| **INCOMPLETE or EXCLUDED** | no universal conclusion is licensed — parse failure, suppression, ignored path, rule not run |
| **VIOLATION REPORTED** | a **candidate finding**, requiring independent examination before it counts as anything |

**Both denominators are reported**: the **total eligible-file count** and the **actually evaluated
subset**. Reporting only the evaluated subset would let excluded files inflate the appearance of
successful validation — the exact error F5 already made once.

## What a candidate finding must survive

For each violation, before it is called a result:

1. **what the source does** — the code quoted, and what it computes;
2. **why the rule applies** — which array method, which callback, which path returns nothing;
3. **whether the behaviour is intentional** — a callback used for side effects whose return value
   is genuinely unused is a different thing from a bug, and the distinction is stated per finding;
4. **the adapter preserves the diagnostic** verbatim;
5. **production admission refuses** the corresponding claim.

**This would demonstrate external applicability. It would NOT demonstrate detection beyond eslint** —
every finding is eslint's, and Legasus found none of them. That sentence goes in the result whatever
the outcome.

## Frozen failure handling

- **A zero result is a result**, and it stays open as *"no consequential external refusal"*.
- **The corpus selection and the scan budget are not changed if no violation appears.** No second
  list, no wider budget, no "one more repository". Searching until success and reporting that as an
  unbiased evaluation is the failure mode this clause exists to prevent.

## Predictions, committed now

- **I expect at least one candidate finding**, because application code is not the population that
  lints clean — but I have no evidence for that beyond the 0/3,154 on libraries, and I may be wrong.
- **I expect the INCOMPLETE bucket to be non-trivial**, mostly parse failures: application
  repositories contain JSX, Flow, and files written for parsers other than the default one, and
  every such file is `analysisIncomplete` rather than a violation or a pass.
- **I expect the evaluated subset to be substantially smaller than the eligible denominator**, which
  is precisely why both are reported.

## Untouched

Registry still **3 authored rules, 0/15**. **S6, F2, `COMPLETE`, `INVALIDATE`** untouched. The
preserved specimen adapter is not modified. The repaired adapter is used **as committed** — no
change to it during this run.
