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

---

# AMENDMENT 1 — frozen 2026-09-22, still before implementation

Governor redirect. Commit `71969bb` is preserved unedited above; the clauses named here are
**superseded**, not deleted, so the defective version stays on the record.

## Why

**PR1 described a weaker baseline than the one agreed.** The BASELINE arm explicitly includes
checking identifier spelling and case, inspecting save/load wrappers, and citing the searched
scope. PR1 predicted it would falsely accept the spelling stratum — but that is the stratum the
spelling check exists to catch. I had predicted the failure of a baseline that omits its own
promised check, which is a restatement of the mistake I already made, not a test of the cheap
procedural fix. A negative result against the full baseline is useful; a win over a crippled
one answers nothing.

## A1.1 — Equal evidence and equal inspection (supersedes "Arms", "Search evidence")

The naive searcher supplies the **initial** record only. It is no longer the arms' sole input.

- **Both** arms may perform additional searches and may request human assistance.
- **Both** are charged for them, identically.
- BASELINE is *required* to perform its prescribed checks — spelling/case, wrapper inspection,
  scope citation. Failing to run them is an execution defect, not a baseline property.
- LEGASUS receives the same access to the corpus and the same right to buy evidence.

The comparison is therefore not "who decides better from a fixed record" but **"what does a
correct decision cost each arm."**

## A1.2 — Fixture labels are not outcome predictions (supersedes the strata table)

Stratum names described what an arm would get wrong. They now describe only the fixture, on
**two orthogonal axes**, both established independently of any arm:

**Axis 1 — claim status** (by exhaustive ground truth): `ABSENT_TRUE` / `ABSENT_FALSE` /
`NOT_STATICALLY_ESTABLISHABLE`.

**Axis 2 — defect in the *initial* record**: `NONE` / `CASE_MISMATCH` / `REGION_NARROW`.

A cell such as (`ABSENT_FALSE`, `CASE_MISMATCH`) states that the claim is independently false
and that the supplied record was generated by a query that cannot match. It makes **no claim
about which arm accepts it.** Either arm may catch it; catching it is the measurement.

The five strata survive as cells of this cross, with the counts unchanged.

### The undecidable stratum needs the stronger boundary

Under A1.1 an arm may buy more searches, so "unresolved from the supplied evidence" collapses —
any arm can resolve it by searching again. The stratum is therefore defined as the stronger
thing: **`NOT_STATICALLY_ESTABLISHABLE`** — no static query over this corpus settles it, because
the access is dynamic (computed property names, `eval`, runtime monkey-patching, identifiers
assembled from strings). Correct outcome is UNRESOLVED, reached *and stopped at*. An arm that
buys unbounded searches here pays for them on the effort measure.

## A1.3 — Adequacy defined independently (supersedes "S5", informs the answer key)

Adequacy is **not** either arm's judgment of its own scope. It is a relation fixed in the
answer key before any arm runs:

> Evidence is adequate for a claim iff (a) the union of scopes actually covered by the evidence
> contains the scope the claim asserts, **and** (b) the queries producing it can match the
> relevant identifier set. Both are established by exhaustive case-insensitive enumeration over
> the full corpus, by hand, recorded per claim.

The governing consequence, stated by the governor: **a narrow search supports only a
correspondingly narrow absence claim, unless additional evidence establishes completeness.**

This repairs S5, which as written was a trick. S5 is now principled: the **claim itself is
narrow** — asserted over a region — and the narrow search covers that region. ACCEPT is correct
because scope containment genuinely holds, not because the search "looks" narrow and gets away
with it. Completeness is never inferred from a search returning no hits.

## A1.4 — The non-arm checker, and what its success would license

The mechanical query-adequacy checker stays declared and separate. My earlier phrasing —
"the fix is a linter, not an epistemology" — is **withdrawn as overreach**. If it performs
best, the supported conclusion is exactly:

> the mechanical checker sufficed **on these cases**

and nothing more general about epistemology.

## A1.5 — Independence limit, recorded

The case-generation procedure deliberately recreates the known spelling and scope failures.
This is therefore a **controlled follow-up to a naturally occurring failure, not an untouched
external evaluation.** Mechanical generation reduces discretionary placement of defects; it
does **not** make the design independent of the original defect. Any write-up says so.

## A1.6 — Revised predictions (supersede PR1, PR2, PR4)

- **PR1′** The **full** baseline has low false acceptance, and any failure it does have falls
  under A1.3 **completeness**, not spelling: searches individually sound, union not covering the
  asserted scope, completeness never established. Spelling is explicitly checked, so predicting
  spelling failures against this baseline is not a real prediction.
- **PR2′** The baseline's cost is where it pays — highest additional-search count of the three.
- **PR4a** Legasus *can* express A1.3 scope containment through the existing coverage
  obligation added after the ESLint finding. This is the sharper form of the open question the
  governor left: same class, new operational form.
- **PR4b** *(expected to decide it)* Legasus cannot **establish** the coverage — it can only
  enforce a containment between an asserted scope and a coverage figure that a searcher or a
  human must supply. If the human must supply it, decision criterion 4 fails and this closes
  NEGATIVE.
- **PR5** unchanged in substance, narrowed by A1.4.

PR3 stands. PR4b remains my expectation.

---

# AMENDMENT 2 — frozen 2026-09-22, still before implementation

Governor redirect. `71969bb` and `e8ef76d` preserved unedited.

## A2.1 — The unresolved stratum is about the analysis, not the world

**Supersedes A1.2's `NOT_STATICALLY_ESTABLISHABLE`.** Dynamic access does not by itself
establish that a claim cannot be settled statically: some dynamic expressions resolve, and
others can be bounded tightly enough to prove absence. Asserting otherwise repeats the exact
error under study — treating "the analysis I ran cannot settle it" as "it is unsettleable."

The label is **`UNRESOLVED_UNDER_FROZEN_ANALYSIS`**. The stronger label may be used only with
an independent argument, recorded per claim.

This makes the frozen capability list load-bearing, because allowing extra searches does not
remove unresolved cases — it means the **permitted analyses and their budget** must be frozen,
and each unresolved case must record **why it exceeds those specific capabilities**. No arm is
required to search without limit before stopping; stopping at the budget is a correct outcome,
not a failure.

### Permitted analyses (frozen) and budget

| Analysis | Unit cost |
|---|---|
| `grep(query, {ci, from, to})` | 1 analysis |
| `identifierSet(from, to)` — enumerate identifiers in a range | 1 analysis |
| `computedAccessSites(from, to)` — bracket access, `eval`, string-built property names | 1 analysis |
| `readRange(from, to)` — human or arm reads the code | 1 analysis |
| `askHuman(question)` | 1 analysis **and** 1 annotation |

**Budget per claim: 12 analysis units, 2 annotation units.** Identical for both arms. On
exhaustion an arm must return `UNRESOLVED_UNDER_FROZEN_ANALYSIS` with the reason recorded.

## A2.2 — Claim meaning is frozen per claim, and the answer key uses the same meaning

**Supersedes A1.3's adequacy rule as stated.** That rule establishes **lexical search
coverage**, which is not semantic absence. Exhaustive case-insensitive enumeration checks
direct identifier occurrences; computed property names, aliases, and generated strings need
different evidence.

Every claim therefore carries a frozen `meaning`:

| `meaning` | What absence asserts | What counts as adequate |
|---|---|---|
| `LITERAL` | no literal occurrence of the token | lexical enumeration over the asserted scope |
| `DIRECT_REF` | no direct syntactic reference to the binding | lexical enumeration **plus** alias check on the binding |
| `RUNTIME` | the access never occurs when the program runs | lexical evidence is **insufficient by construction**; needs computed-access bounding or execution |

The answer key is built **under the same `meaning`**. A claim may not be graded as `RUNTIME`
and answered with `LITERAL` evidence, or the reverse.

## A2.3 — Human input does not by itself decide the comparison

**Supersedes decision criterion 4 and PR4b's loss condition.** Charging Legasus for human
coverage input while the baseline gets it free would rig the comparison. Both arms are charged
equally for establishing coverage.

The experiment now reports **two separated answers**, per the governor:

**Q1 — who establishes adequacy?** Can the arm establish coverage itself, without supplied
fact? Reported for each arm. Legasus failing this loses only the **stronger claim** of
independently establishing coverage. It is **not** a verdict on the comparison.

**Q2 — does Legasus reduce the cost or the mistakes of using that evidence?** Given the *same*
supplied coverage fact, measured.

### Revised decision rule

Legasus wins **Q2** iff all hold:

1. false acceptance strictly lower than BASELINE; **and**
2. unnecessary refusal not higher; **and**
3. total cost (analysis units + annotation units) not higher.

Q1 is reported separately and never substitutes for Q2. A tie on Q2 still closes the candidate
negative — no advantage demonstrated — but is reported as a tie, not as a failure to establish
coverage.

**PR4b′** Legasus will not establish coverage independently (Q1 negative). Whether it enforces
containment more cheaply once coverage is supplied (Q2) is **genuinely open, and is the
measurement.** I no longer predict a Q2 outcome; recording that I have no prediction is more
honest than manufacturing one.

## The question, as now formed

> Who establishes the adequacy of the search, and does Legasus reduce the cost or the mistakes
> of *using* that evidence? Keep the answer about **establishing** coverage separate from the
> answer about **enforcing** it.

## Sequence (frozen)

1. Build both arms from the preserved development case.
2. Freeze implementations, permitted inspections, budgets, and claim meanings.
3. Select and seal evaluation cases independently of arm outputs.
4. Run once; report correctness alongside effort.

---

# AMENDMENT 3 — after the development run, before any evaluation case exists

Not a redirect. A defect in the frozen naive generator, found by running the development case,
recorded here rather than patched quietly.

## A3.1 — The generator reproduced only one of the two defects

Frozen rule: *query = the longest alphabetic run of the subject, in its original case.* On the
development subject `_bondForeclosureFired` that yields **`bondForeclosureFired`** — the whole
name, which is perfectly adequate. The rule reproduced the **region** defect exactly
(25560–25900, zero hits, the naive reading being "never saved and never restored") but produced
the spelling defect only incidentally, through the `jg`-prefixed variant.

That is a real underpowering. What I actually searched was `foreclosureFired` — the *concept
word*, a suffix of the identifier with the leading segment dropped. A camelCase symbol never
produces that under the frozen rule, so the `CASE_MISMATCH` axis-2 value would be
under-represented in evaluation and the spelling stratum would test almost nothing.

## A3.2 — A second frozen generator, declared before evaluation cases exist

| Generator | Rule | Reproduces |
|---|---|---|
| **G1** *(existing)* | longest alphabetic run of the subject, original case | region-narrow records |
| **G2** *(added)* | the subject with its **leading camelCase segment removed**, original case — `_bondForeclosureFired` → `foreclosureFired` | case/spelling-mismatch records |

G2 is exactly what I did, stated as a rule. Assignment is **by the case's axis-2 value**, which
is fixed by the fixture before any arm runs — not by me choosing per case. Both generators are
mechanical; neither is hand-tuned to a claim.

This does not make the design independent of the original defect. A1.5 already records that,
and A3.2 deepens it: the second generator is derived *directly* from the failure under study.
Any write-up states that the spelling stratum is **modelled on** the observed failure, not
sampled from an unrelated population.

## A3.3 — Development-case result (carries no comparative evidence)

All three reach the correct answer, REFUSE, via `jgBondForeclosureFired` at line 32705.
BASELINE and LEGASUS cost 4 analysis units each; the non-arm checker costs 3. LEGASUS reached
it with `coverage ESTABLISHED`, `FRONTIER_OPEN` on the absence certificate, and **no new rule**
— `universal-from-exhaustive-coverage` sufficed, which is early support for **PR4a**.

This is what the arms were built to do. It is reported for completeness and is **not** evidence
about the comparison.

## Standing context

This runs **after** the consumer search closed negative, and does not reopen it. Whatever the
outcome, the larger finding stands: **no production advantage has yet been demonstrated for
Legasus in any workflow examined.**
