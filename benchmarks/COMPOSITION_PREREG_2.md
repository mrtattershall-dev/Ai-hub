# r4 — AUTHORITY UNDER COMPOSITION, wave 2. Predictions frozen BEFORE any attack is run.

Wave 1 (`COMPOSITION_PREREG.md`, result in `RESULT.composition.md`) reproduced ten predicted
defects and repaired them in seven commits. Recomputing the frontier after those repairs - by
re-reading the relation-producing operations the repairs touched and the ones they did not - yields
the seven cases below. Same rules as wave 1: derived from reading, not executed; each names the
existing invariant it is expected to fall under; each attack sits beside a control; a prediction that
fails is recorded as a falsification of mine.

## W2-a — a refuter refutes across worlds (justification.entitled)

`entitled()` treats any ESTABLISHED refuter as refuting its target, at any scope. A counterexample
executed at S2 is not a counterexample to a claim about S1 without a bridge (Law 2; referent.mjs
carries the polarity rule).

Prediction W2-a-1: claim@S1 with an ESTABLISHED refuter@S2 -> `entitled(claim, S1)` **REFUTED**. DEFECT.
Prediction W2-a-2 (control): refuter@S1 refutes (existing test).
Prediction W2-a-3 (control): refuter@ANY refutes a claim@S1 (a for-all counterexample covers it).
Expected repair: a refuter must COVER the target on every context dimension - the derivation rule of
wave 1, with the refuter as premise and the target as conclusion. A refuter at null refutes nothing.

## W2-b — reestablish() can move a node's scope under its identity (justification.reestablish)

Since ca4d9ed scope is part of node identity. `reestablish(g, id, {scope})` still rewrites `n.scope`
in place, so the node's id no longer describes its content and dependents keep pointing at it.

Prediction W2-b-1: after `reestablish(g, P@S1.id, {scope: S2})`, `g.nodes[id].scope.repository === 'S2'`
while the id is the one computed for S1. DEFECT (C7 through a second door).
Expected repair: reestablish refuses a scope change with a reason; a claim at another scope is a
different node. Evidence may still be replaced.

## W2-c — a STALE witness still connects the region (legaprogress.frontier / region)

`connectivity(witnesses)` and `buildRegion()` read `w.entered` and `w.lines` from every witness
handed in and never look at `w.lifecycle`. bank.mjs marks a witness STALE when its source or setup
digest moved. A stale witness therefore still creates execution edges, and a subject reached only by
a stale witness is ROUTE.CONNECTED and can be scored ADVANCEMENT.

Prediction W2-c-1: with one witness marked `lifecycle: 'STALE'` reaching subject X, `supportedRegion`
reports X as CONNECTED and `assessAdvancement` reports ADVANCEMENT for X. DEFECT ("stale -> current";
Law 1 of the ledger: a stale claim may not be relied upon).
Prediction W2-c-2 (control): the same witness with lifecycle VALID connects X (positive).
Prediction W2-c-3 (control): with the stale witness removed entirely, X is UNSUPPORTED (so the
repair's effect equals removal, and nothing else changes).
Expected repair: connectivity ignores STALE and INVALID witnesses and reports them as excluded;
a boundary of kind STALE_EDGE already exists for exactly this and is now fed.

## W2-d — a candidate missing a BEHAVIORAL metric survives the Pareto frontier (legareward.dominance)

`compare()` skips a dimension either candidate lacks. A candidate with `placementRobustness`
undefined is never dominated on it.

Prediction W2-d-1: candidates A (verified, robustness undefined, descriptive metrics equal) and B
(verified, robustness 0.2): `paretoFrontier([A, B])` keeps BOTH, and `compare(A, B)` is EQUIVALENT.
DEFECT in the mild direction ("missing -> compatible"): an unmeasured candidate is not worse, it is
NOT COMPARABLE, and the frontier should say so rather than admit it.
Prediction W2-d-2 (control): `mayReplaceChampion(A, B)` is already false (promotion needs a
behavioral DOMINATES) - the safe direction holds today and must keep holding.
Expected repair: a candidate lacking a declared BEHAVIORAL metric is INCOMPARABLE in compare() and
excluded from paretoFrontier() with a record. Descriptive metrics may still be missing.

## W2-e — an absent producer version becomes the string "undefined" in criterion (legaexternal.adapt)

`criterion: id.producer + ' ' + id.producerVersion`. The producer #2 strain was exactly this shape
("undefined#undefined"). The three shipped producers always set a version; the adapter is generic
and does not.

Prediction W2-e-1: a record whose identity lacks producerVersion adapts to `criterion: 'pytest
undefined'`. DEFECT (UNKNOWN collapsing into a value, Law 4).
Prediction W2-e-2: a record whose identity lacks `producer` adapts to `criterion: 'undefined
undefined'` rather than being refused. DEFECT.
Expected repair: criterion is the producer alone when the version is absent (an unversioned
criterion is a different criterion from a versioned one, which covers() will refuse to equate);
a record with no producer is refused as malformed.

## W2-f — an IMPORT_FAILED record is given a document and an ordinal it does not have (legaexternal.producer)

`identity.document = x.testName ?? ('<' + x.module + '>')` and `ordinal: x.ordinal ?? i`. An
IMPORT_FAILED record has neither, so it receives a fabricated document and the flat index of the
record in the output array as its "ordinal". The adapter then builds `history: '<mod>#i'` - a history
coordinate for an observation that has no example.

Prediction W2-f-1: running the doctest producer over a module that raises at import yields a record
with `nativeResult: 'IMPORT_FAILED'` whose identity carries `document: '<mod>'` and a numeric
`ordinal`, and whose adaptation carries a `history` coordinate. DEFECT (the producer #2 strain,
inside producer #1).
Prediction W2-f-2 (control): a PASS record from the same run carries its real DocTest name and
ordinal.
Expected repair: document and ordinal are ABSENT on records that have none; the adapter then leaves
history absent, exactly as it does for git.

## W2-g — a mapping is applied across producers by native-vocabulary string match (legaexternal.adapt)

`adaptRecord(rec, {mapping = DOCTEST_MAPPING})` never checks which producer the record came from.
A record from another producer whose native result happens to be spelled `PASS` receives doctest's
semantics (OBSERVED / HELD).

Prediction W2-g-1: a git-shaped record with `nativeResult: 'PASS'` adapted under the default mapping
yields `observability: OBSERVED, assertion: HELD`. DEFECT (same name -> same authority, Law 2 at the
adapter).
Prediction W2-g-2 (control): the same record with `nativeResult: 'TRACKED_CLEAN'` is UNKNOWN_MAPPING
today.
Prediction W2-g-3 (control): a doctest record with `PASS` still maps.
Expected repair: a mapping declares the producer it is for; a record from another producer is
UNKNOWN_MAPPING with a reason naming the mismatch. Recorded beside it: pytest has NO declared
mapping today - every pytest verdict adapts to UNKNOWN_MAPPING. That is honest non-invention and it
means no scoped claim has ever derived from pytest evidence; it is a finding, not a defect.

## Order of work and threatened results

As wave 1: attack tests asserting the predicted defects, one run, raw result preserved, repairs in
separate commits with flipped tests and admit controls, full suite and the six rigs after each slice.
Additionally threatened by W2-c: `benchmarks/repoB/region-frontier.mjs` and `purpose-connectivity.mjs`
(consume connectivity/buildRegion) - to be baselined before the repair.
