# r4 — AUTHORITY UNDER COMPOSITION. Predictions frozen BEFORE any attack is run.

Start state: `aa03ab9`, clean tree, 464 tests pass (462 under `legasus/*/*.test.mjs` + 2 under
`legasus/legalabs/substrate/`). QUIESCENT_CONTEST re-run at this commit and reproduced.

## The hypothesis under attack — held at ZERO authority

> Individually justified inputs plus an authorized operation relating them may produce an output
> claim whose authority is not supported by the joint evidence, even though no individual input
> artifact is wrong.

It enters as a handoff hypothesis, not a ledger law. The motivating observation is the pytest result
(Entry 11): two faithful records became falsely compatible only when related. This preregistration
searches for the GENERAL mechanism across every relation-producing operation, and it names the
existing invariant each case is expected to be covered by, so that a repair lands in an
implementation rather than in a new law.

Every hypothesis below was derived from READING the implementations. None has been executed. The
predicted outcome is stated for each; a prediction that fails is recorded as failed and is not
smoothed into a smaller finding.

## What "defect" means here

A case is a defect only if ALL of:

1. every input is individually entitled (or individually well-formed) under the current code;
2. the relation-producing operation ADMITS the composition (returns ok / minted / promoted / a value);
3. the joint evidence does not support the output — stated against the invariant the code itself
   claims (Law 1, Law 2, Law 5, the constructor calculus, or the UNADMITTED contract);
4. a CONTROL exists in the same test showing the operation CAN refuse a neighbouring case, so a
   refusal machine could not pass and a vacuous attack could not pass.

## C1 — a never-established intermediate launders a CONTEXT dimension (justification.entitled)

`joinConflicts` skips a dimension that either side leaves `null`. The comment says covers() handles
that. covers() is driven by what the CONSUMER asks for. So:

    A  @ {repository: S1}
    D1 @ {repository: null}   supports A         (a restriction; legal on its own)
    D2 @ {repository: S2}     supports D1        (concrete, and NOT derivable from A)

Prediction C1-a: `entitled(D2, scope({}))` returns **ok: true**. DEFECT: D2 states S2 on the strength
of evidence established only at S1, and no bridge exists. A locally legal edge (A->D1 narrows; D1->D2
has one side null) composes into a globally illegal path.

Prediction C1-b (control): the direct edge A@S1 -> D2@S2 with the same consumer is **refused** with
INVALID DERIVATION. The three-node chain is admitted where the two-node chain is refused.

Prediction C1-c (non-vacuity): the same chain with D1 @ S1 instead of null is **refused** (D1 vs D2
concrete conflict), so the null is the laundering agent and not chain length.

Covered by: Law 5 text ("premises may not differ in the world they were established in") - the
implementation admits it. Expected repair: on every CONTEXT dimension, a conjunctive premise must
COVER the conclusion (ANY, equal, or conclusion-null), bridges exempting. This subsumes the existing
concrete-vs-concrete check. No new law.

## C2 — calculus and justification disagree about what ABSENCE means (calculus.derive)

justification: `null` = never established = licenses nothing. calculus.derive: a dimension absent
from a premise's context is simply not in the intersection, so the output takes the OTHER premise's
value.

Prediction C2-a: `derive({premises: [tok({}), tok({repository: S1})], rule: {requires: []}})`
**mints**, with `context.repository === S1`. Under the module's own header ("output context cannot
exceed any premise") and justification's semantics for absence, that is inflation.

Prediction C2-b (control): S1 vs S2 is refused (existing behaviour, re-asserted in the same test).

Also to be recorded, MEASURED: `calculus.mjs` has ZERO production importers. (The importer scan in
Entry 10's apparatus reports quiesce-check.mjs as an importer; that is a false positive - the string
appears in quiesce-check's own file list, not in an import.) The constructor calculus is explanatory
at runtime.

Expected repair: a dimension not established by EVERY premise is DROPPED from the output context
(a free narrowing), and the drop is recorded in ancestry. Not a refusal: a conclusion may be weaker
than its premises.

## C3 — the authority brand is recoverable from any real token (calculus)

`isAuthority(t)` checks `t[MINT] === true` where MINT is a module-private Symbol. Any code holding
one real token can read that symbol back with `Object.getOwnPropertySymbols`.

Prediction C3-a: a hand-built object carrying the recovered symbol, `grant: ['edit:criterion']` and
an ancestry entry `{via: 'DELEGATE', from: 'OWNER'}` satisfies BOTH `isAuthority()` and
`tracesToIndependentRoot(..., ['edit:criterion']).ok`. FORGED.

Prediction C3-b (control): the same object without the symbol is refused (existing R4 test).

Prediction C3-c: `structuredClone` and JSON round-trip of a real token are NOT authority (symbol
keys do not survive). Fail-safe direction; expected to already hold.

Honesty clause: whatever the repair, the calculus still constrains nothing at runtime while it has
no consumer (C2). The repair closes a representational hole; it is not claimed to enforce anything a
consumer does not ask.

Expected repair: membership in a module-private WeakSet instead of a symbol brand. Positive control:
narrow/restrictGrant/delegate chains stay authority.

## C4 — an UNADMITTED coordinate is promoted by NAME across producers (justification.scope)

Admission is keyed by dimension name. Promotion in scope() is by name. The admission argument for
`collectionCohort` is about pytest's fixture semantics; a git record carrying an identity key
literally named `collectionCohort` says nothing of the kind.

Prediction C4-a: after admitting `collectionCohort` (pytest argument), `scope()` of a git-shaped
scope carrying `UNADMITTED.collectionCohort = 'x'` **promotes** it, and a join between that git scope
and a pytest scope is then blocked on collectionCohort. DEFECT under Law 2 (same name is not the
same referent); it is L7 again, one door further in.

Prediction C4-b (positive control): a pytest-shaped scope (criterion `pytest ...`) promotes.

Expected repair: an admission entry declares the PRODUCER whose semantics it was argued from;
promotion applies only to scopes whose `criterion` names that producer; other carriers stay
recorded and ignored. The base six are producer-agnostic by design and are unchanged.

## C5 — the reserved key `UNADMITTED` is admissible as a dimension (justification.admitScopeDimension)

Prediction C5-a: `admitScopeDimension({name: 'UNADMITTED', side: 'CONTEXT', ...})` is **admitted**.
Prediction C5-b: two scopes that carry identical UNADMITTED blocks then FAIL `covers()` (object
identity), i.e. NOT_COMPARABLE manufactured out of a bookkeeping key. DEFECT.

Expected repair: the gate refuses reserved and non-identifier names, with a reason.

## C6 — scope() silently drops a carried value shadowed by a top-level value (justification.scope)

`flat = {...promotable, ...partial}`: a top-level key wins over a carried key of the same name.

Prediction C6-a: `scope({foo: 'B', [UNADMITTED]: {foo: 'A'}})` (foo not admitted) yields
`UNADMITTED.foo === 'B'` and 'A' is gone with no record. Prediction C6-b: the same with foo ADMITTED
yields `foo === 'B'` and 'A' is gone. DEFECT under "nothing vanishes" (Entry 11 repair contract).

Expected repair: a shadowed carried value is recorded, never dropped.

## C7 — node identity excludes scope, so add() aliases claims across worlds (justification.node/add)

`node().id = sha(kind | proposition | supports)`. Two claims with the same proposition and supports at
DIFFERENT scopes have the same id, and `add()` overwrites.

Prediction C7-a: after `add(g, P@S1)` then `add(g, P@S2)`, `g.nodes[id].scope.repository === S2`, the
first node's validity/evidence are gone, and any dependent that was justified by P@S1 now silently
rests on P@S2. DEFECT under Law 2 (referent moved by overwrite). Whether downstream `entitled()`
catches the scope mismatch depends on what the consumer asks - the OVERWRITE itself is the defect.

Expected repair: scope participates in identity (ANY rendered explicitly; UNADMITTED excluded, since
it is recorded-not-authoritative and covers() ignores it), and `add()` refuses a duplicate id with a
reason instead of overwriting. MEASURED before repair: no JSON artifact stores node ids, and no
production caller consumes add()'s return value.

## C8 — provenance ledger: last-wins on duplicate digests, and a seal that does not cover attribution

Prediction C8-a: two `bind()`s over the SAME bytes with DIFFERENT `producedBy` -> `ledger().lookup`
returns the second, silently. DEFECT: the last-wins map (Entry 5 / 49-7-1 class) inside the module
built to fix attribution.
Prediction C8-b: `seal()` is a digest over the sorted DIGESTS only. Mutating a binding's `producedBy`
after sealing leaves `verifySeal` **ok: true**. DEFECT: the seal protects the artifact set, not the
attributions.
Controls (expected to already hold): same path/changed bytes -> NOT_ESTABLISHED; different
path/identical bytes -> retains; a removed record changes the seal; bind without producedBy refused.

Expected repair: conflicting bindings for one digest are surfaced as CONTESTED (both kept, neither
returned as the attribution); the seal covers digest + producedBy + git commit.

## C9 — the stopping machinery

C9-a: `evidenceFrontier({pending: ['x']})` with no investigation named 'x' -> OPEN_CONTEST with ZERO
objectives. A stall reported as "do not quiesce". Prediction: reproduces. Adding an irrelevant string
holds the system out of QUIESCE forever. Expected repair: a pending operation keeps the frontier open
only while it is itself a justified investigation; an unjustified pending item is discharged WITH A
RECORD. Positive control: a justified pending item still holds the frontier open.

C9-b: the TERMINAL classification of REPOC_UNRESOLVED_ATTRIBUTION is MEASURED against
`benchmarks/repoC/external.json` BY PATH. Prediction: if the file at that path were replaced by
records carrying a discriminator field, the check would flip the entry to JUSTIFIED - same path,
different referent, and the old evidence silently replaced rather than resolved (the exact thing
Entry 10 says must not happen). Expected repair: the measurement is pinned to the artifact's content
digest as recorded in PROVENANCE.json; a digest mismatch reports "the artifact changed; the verdict
is about the original bytes" and does not re-classify.

C9-c (recorded, not repaired): `delegate({from: 'OWNER'})` is callable by any code with the string.
OWNER_REQUIRED is enforced by procedure (commits, ledger), not by the runtime. That is the axiom
stated in REPO_C_PROTOCOL.md §"unresolved" 1, seen from the runtime side; nothing here can make a
repository enforce owner identity and no theater will be built to pretend otherwise.

## C10 — stale vocabulary (measured, small)

`OBSERVATION_DIMENSIONS = [...DIMENSIONS, 'history']` and DIMENSIONS already contains 'history'.
Prediction: the constant has seven entries with a duplicate. Consumers: its own test only.

## Order of work

Attacks are written as tests that ASSERT THE DEFECT (so they fail once repaired and must then be
flipped to assert the repair, in a separate commit). Sequence per case:

    attack test (asserting the predicted defect) -> run -> preserve raw output in RESULT.composition.md
    -> repair -> flip the test to a regression + keep its control -> focused run -> full suite
    -> re-run threatened historical rigs (graph-subsumption, shadow-graph, quiesce-check, FREEZE-GATE)

Threatened historical results, named in advance: the shadow-graph / graph-subsumption numbers
(56/56, 44/44, 142/142, 51/51 - all consume justification.entitled and node ids), the FREEZE-GATE
(consumes calculus and stopping), producer3.test (consumes scope/covers/joinConflicts), and the
quiesce verdict.

## What a NULL result looks like

If C1-a is REFUSED, Law 5's implementation already covers the null-intermediate case and the
"locally legal edge, globally illegal path" mechanism has no instance in the justification graph;
that is recorded as a falsified hypothesis of mine. Same for each case: a predicted defect that does
not reproduce is a falsification and is kept.
