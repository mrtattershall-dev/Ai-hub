# ATTRIBUTION-1 — who did what, 2026-09-29

This exists because the core Legasus question is *what did the system do by itself, versus what did the
research team supply* — and a night of work that blurs those two makes the question unanswerable later.
It applies the levels proposed by tatte:

| level | meaning |
|---|---|
| 0 | brainstorming that changed no code or experiment |
| 1 | hypothesis / design influence |
| 2 | a specific mechanism or patch suggested |
| 3 | code, test, or interpretation materially authored |

**"Claude" below means me, this session.** Two `Explore` subagents I dispatched are counted as mine —
they are the same system under my direction, and their findings are marked where they were material.

## First, the check that prompted this — and it came back clean

Searched every record and every commit message from this session for autonomy language (`autonomous`,
`by itself`, `the system found/discovered`, `without human`, `unaided`). **Zero hits in tonight's
records and zero in tonight's commits.** No claim needs withdrawing.

But that is the smaller half. The real gap is the opposite one: the records say *what* was built and
mostly not *where the design came from*. `INTEGRATION-1_DEFINITION.md` carried exactly one attribution
line — "the user's own framing" for the three bars — while its **entire schema** was supplied. That is
corrected below and cross-referenced from the records themselves.

## Level 2–3 supplied by tatte (relayed research; authorship of that framing not established by me)

These are not influence. They are the design.

- **The Change Record in full**: the section/owner table, the four-way `FACT ≠ CLAIM ≠ PERMISSION ≠
  EFFECT` split, the seven integration laws, and the five-step build order. `INTEGRATION-1` presents
  this as motivated by *our* handoff failures, which is true of the **motivation** and not of the
  **design**. I implemented it and wrote the validations; I did not devise it.
- **The three bars** (recompute / causal evidence / predict a configuration), including the line that
  decides the whole thing — *if it cannot do those, it is just elaborate bookkeeping*.
- **The re-exercise rule correction.** The four-part behavioural criterion and the three named controls
  (`type → clear → type` must create an edge; an identical assertion with no intervening state change
  must not; g2 reset/reset must remain unobservable) were stated explicitly before I implemented them.
  My contribution was implementing them, and discovering that my *first two* versions were both wrong.
- **`OBSERVED / ASSUMED / ESCAPED` edge status** — the exact triple, including the reading that an
  escaped mutant is evidence the dependency map is incomplete rather than merely a failed test.
- **Welded sampling** — the mechanism came from an archive tatte supplied and characterised.
- **The in-toto warning** that link metadata records artifacts a *caller declares* — which is what sent
  me to look at `bytesAfter` and find it describing an intention.
- **The effect-mismatch invariant** (a mismatch may never be retained, published, or used as a base
  revision) — stated by tatte, implemented by me.
- **Temporal's current-pointer / state-reconciliation idea** — supplied, not yet built.

## Level 1 supplied by tatte

Construct vs internal vs external validity, and the closed-world caution that the emitter defines both
the task and what counts as solving it. "Asynchronous cognition, synchronous consequence." The
claim-dependency-ledger framing, which I implemented as `STALE_CLAIM`. The innovational-complementarities
and assurance-case framings, which shaped how records are worded and changed no mechanism.

## Level 0

The World Avatar architecture mapping, AlphaEvolve, the blackboard / truth-maintenance synthesis, and
most of the thirteen-archive survey. Real intellectual work; **no code changed as a result**, except
where it is listed at level 2 above.

## Level 3, Claude — implementation

`graphNodeMutants.mjs` (mutant family, sensitivity-before-specificity structure, sentinel/collateral
arithmetic, edge-status ledger) · `behaviorModel.mjs` · the two-tier criterion's implementation ·
`reExerciseRule.test.mjs` · `changeRecord.mjs` / `changeRecordReplay.mjs` / their tests and the
contradiction detectors · `changeRecordRecompute.mjs` and content-addressed blobs ·
`presentationConfoundCheck.mjs` · `decodingConsistencyCheck.mjs` · `lockedDecoding.mjs` and its hostile
test · the effect read-back in `governed-edit.mjs` and its seven tests · the `evidenceTokens` fix and
tests `7c`/`7d` in `workspace.mjs`.

## Level 3, Claude — findings nobody pointed at

The distinction that matters most, because these are the only places where the apparatus found something
rather than being told where to look:

| finding | how |
|---|---|
| **SUPPRESSION-1 ran at unequal token budgets** while its frozen definition claims "same token budget" twice, and the two small-budget arms are the only ones that hit their cap | chasing the weld into the records |
| the four graph derivation defects (positional effect pairing, `U`/`P1` one measurement, the repeat rule wrong twice, prior-lookup over nodes) | mutants I wrote, failing |
| `evidenceTokens` read and never assigned — the coordination layer could never satisfy an evidence obligation, and its test could not fail | subagent audit, verified by me |
| `presentationAudit.mjs` is a tautology over its own locals | subagent sweep, verified by me |
| the change record's digest used the replacer-array form and never hashed event bodies | its own test, which I wrote |
| `governedEdit` is doubly dead — env flag set nowhere, `setRunAuthority` called only by a test child | subagent audit, verified by me twice |

**Three of six came from subagents.** Counting them as "the system found it" would be the exact
inflation this file exists to prevent: I dispatched them, chose their questions, and verified every
load-bearing claim by hand before acting.

## What this means for the standing claims

- **No result is restated.** AUDIT-1, AUDIT-2, FALSIFICATION-1, PRESENTATION-1, SUPPRESSION-1 and the
  graph work are unchanged by this file, except where `SUPPRESSION-1_BUDGET-CORRECTION.md` narrows one.
- **No autonomy was claimed and none is claimed now.** Tonight was human-plus-model research with a
  human integrating. The hostile tests passing still count; a refused stale write would still count. What
  cannot be claimed is that any of it was found or designed unaided.
- **The design debt is on the record.** If the Change Record ever clears bar 3, the credit for its
  design belongs to the framing that arrived through tatte, not to this session.

## The honest observation about tonight's shape

Thirteen archives produced **two** defects in this project's own code — the decoding hole and the
receipt describing an intention. Both were worth having. Both came from taking **one specific claim and
testing it here**, never from reading more architecture. The ratio is the finding: reading produced
framing, and only testing produced defects.
