# PREREG — absence assertions and unchecked search scope

Frozen 2026-09-22, before any implementation. Governor: tatte.

## Provenance

This candidate comes from actual work, not a constructed fixture. While repairing a
jungle-debt restore defect in Dust & Harvest I wrote a report stating that
`_bondForeclosureFired` was "never saved and never restored". It is saved
(`game.html:32763`) and restored (`32778`), with the same truthy-guard defect I had just
fixed twice. The patch was correct; the explanation declared a neighbouring defect absent.
The governor caught it.

Two causes, both properties of the *search*, not of the evidence:

1. the query `foreclosureFired` is case-sensitive and cannot match the capital F in
   `_bond`**F**`oreclosureFired` — its six hits were all a different symbol;
2. the sweep counting guarded restores was scoped `NR>=25560 && NR<=25900` (the main
   loader), and its result was reported as the file total. The third site is ~7,000 lines
   lower, in a monkey-patch wrapper.

## Governor qualification, recorded as binding

> Unchecked search scope can produce an unsupported coverage premise. Its operational form
> is newly exposed here; whether it requires a new mechanism remains open.

So this is **not** pre-declared a new class. It may be the same unsupported-coverage-premise
class found in the ESLint adapter, in a new operational form. The experiment must be able to
conclude "already covered", "needs extension", or "needs no mechanism at all".

## The claim under test

> Given a search record and an absence claim, one arm decides ACCEPT / REFUSE / UNRESOLVED
> more safely or more cheaply than the other.

## Arms (frozen)

| Arm | Requirement |
|---|---|
| **BASELINE** (procedural) | Search the whole file. Check identifier spelling and case. Inspect save/load wrappers. Cite the searched scope before making an absence claim. |
| **LEGASUS** | Receive the **same** search evidence and enforce the permitted scope of the claim through an **existing** mechanism, or **disclose** any extension needed — its size, and what it changes. |

Both arms receive byte-identical inputs. Neither may consult the output of the other.

### Declared non-arm reference point

A **mechanical query-adequacy check** — case-insensitive re-run plus a cross-check of the
query against the actual identifier set of the file — is recorded now as a third
possibility. It is **not** an arm. It exists so that, if it dominates both arms, that result
is reported as such and is **not** relabelled a Legasus mechanism.

## Corpus

`game.original.html` — the pristine 7,861,887-byte / 40,926-line upload. Real code, not
authored for this test, with genuine multi-region structure (main loader plus monkey-patch
wrappers) — which is the structure that produced the failure.

## Development vs evaluation

**Development:** the one preserved false report, and only that. Both arms are built against
it and nothing else. The false report survives verbatim in the `dust-harvest-repair` history
as `REPAIR-REPORT.md` at commit `9fb3c74`.

**Evaluation:** separate claims, selected and ground-truthed **before either arm runs**, by
the procedure below. No arm may be modified after freeze (step 3).

### Order of operations (violating this invalidates the result)

1. Freeze this document.
2. Build both arms from the development case only.
3. Commit the arms. **Arms frozen.**
4. Select evaluation claims by the frozen procedure.
5. Establish ground truth for each claim by exhaustive search; record the evidence.
6. Run both arms on all claims. Record outcomes.

### Claim forms (frozen — mixing forms prevents template special-casing)

- **A — pattern extent:** "No restore of field F anywhere in the file is truthy-guarded."
- **B — persistence:** "Symbol S is never persisted, neither saved nor restored."
  *(the form of the development case)*
- **C — call absence:** "Function G is never called from outside region R."

### Strata (frozen counts, 16 claims)

| # | Stratum | Correct outcome | n |
|---|---|---|---|
| S1 | absence TRUE, evidence adequate | ACCEPT | 4 |
| S2 | absence FALSE, missed by **spelling/case** | REFUSE | 3 |
| S3 | absence FALSE, missed by **region scope** | REFUSE | 3 |
| S4 | genuinely undecidable from the record, no detectable defect | UNRESOLVED | 3 |
| S5 | absence TRUE, search **looks** narrow but is adequate | ACCEPT | 3 |

S1 and S5 exist so that **refusing everything cannot win**: an arm that refuses all 16 scores
0 false acceptance and 7 unnecessary refusals, and loses.

### Selection (frozen, mechanical)

Candidates are enumerated from the corpus by regex over module-level `let`/`const` flags and
`gameState._*` / `d.jg*` fields — **not hand-picked**. Within each stratum, candidates are
ordered by a seeded shuffle, seed = first 8 hex of
`sha256("absence-assertion-2026-09-22")`, and the first n taken. Stratum membership requires
ground truth, so it is known at selection time; the protection against bias is that **the
arms are already frozen** at step 3 and the search evidence is generated mechanically rather
than authored per claim.

### Search evidence (frozen generator — this is the critical control)

The record attached to each claim is produced by a **naive searcher**, never by hand, so that
defective records arise naturally instead of being authored to trip an arm:

- query = the longest alphabetic run in the symbol, **in its original case**;
- scope = a line range chosen by the frozen rule "the enclosing function, plus or minus 170
  lines";
- output = `{query, flags, line_range, hit_count, hit_lines}`.

This reproduces both real failure modes without my choosing where they land.

## Measures

| Measure | Definition |
|---|---|
| **False acceptance** | ACCEPT on a claim whose correct outcome is REFUSE or UNRESOLVED. *Primary — this is the harm that actually occurred.* |
| **Unnecessary refusal** | REFUSE or UNRESOLVED on a claim whose correct outcome is ACCEPT. |
| **Human annotation** | Count of facts a human must supply per claim that the arm cannot derive from the search record plus the corpus. |
| **Effort** | Lines added or changed per arm; for LEGASUS, whether an extension was required, and its size. |

## Decision rule (frozen)

LEGASUS wins only if **all** of these hold:

1. false acceptance strictly lower than BASELINE; **and**
2. unnecessary refusal not higher; **and**
3. human annotation not higher; **and**
4. it does **not** require a human to identify the scope or spelling mismatch.

Otherwise — including any tie — **close this candidate as NEGATIVE**. Explicitly: do not
extend the framework merely to make this example pass. An extension is permitted only if it
is disclosed, sized, and still satisfies 1–4.

## Predictions (frozen)

- **PR1** BASELINE false acceptance is at least 1, concentrated in **S2**. "Search the whole
  file" constrains the *scope* but not the *query*; a whole-file search whose query cannot
  match the relevant spelling is exactly as blind as a region-scoped one. The governor named
  this condition, and the baseline as written does not meet it by scope alone.
- **PR2** BASELINE unnecessary refusal is at least 1, in **S5**.
- **PR3** LEGASUS cannot admit an absence claim without an extension. Nearest existing
  mechanism: the coverage obligation added after the ESLint unsupported-coverage-premise
  finding.
- **PR4** *(expected to decide it)* LEGASUS will require a human to declare the permitted
  scope of the claim, and will not itself detect the query/spelling mismatch — that mismatch
  is a relation between the query and the identifier set of the code, not a property of the
  provenance of the evidence, and provenance is what the calculus reasons about. If PR4
  holds, criterion 4 fails and this closes NEGATIVE.
- **PR5** The declared non-arm mechanical query-adequacy check dominates both arms, at
  roughly 15 lines. If so, the finding is that the fix is a linter rather than an
  epistemology, and it is reported that way.

I expect PR4 and PR5. Recording that now so that a negative result cannot later be
re-narrated as a surprise, and a positive one cannot be claimed as predicted.

## Standing context

This runs **after** the consumer search closed negative, and does not reopen it. Whatever the
outcome, the larger finding stands: **no production advantage has yet been demonstrated for
Legasus in any workflow examined.**
