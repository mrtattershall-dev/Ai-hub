# r4 — AUTHORITY UNDER COMPOSITION, wave 3. Predictions frozen BEFORE any attack is run.

Waves 1 and 2 reproduced seventeen predicted defects and falsified none. A program that only ever
confirms itself is not being tested, so this wave carries TWO PREDICTIONS OF NO DEFECT - places where
the reading says the code is right. If either fails, my model of the code is falsified and that is
the result. The remaining cases are predicted defects, all in the constructor calculus, plus a
retirement analysis and the instrument-subsumption representation Entry 14 asked for.

## W3-a — PREDICTED NO DEFECT: covers() is transitive

Reading: for each active dimension, covers passes when required is null, granted is ANY, or values
are equal. If A covers B and B covers C then on every dimension where C is concrete, B is ANY or
equals C, and A is ANY or equals B; in both cases A covers C.

Prediction W3-a-1: for scopes drawn from {null, ANY, 'S1', 'S2'} on repository and criterion, no
triple (A, B, C) has covers(A,B).ok && covers(B,C).ok && !covers(A,C).ok. Exhaustive over the 64
triples of 4-valued pairs, 4096 combinations. HOLDS.
Control: a triple where A covers B but not C exists (so the enumeration is not vacuous).

## W3-b — PREDICTED NO DEFECT: the ledger does not reconcile across worlds by recency

Reading: record() marks CONTESTED when a live prior contradicts the new state; a STALE prior does
not contest. FALSIFIED@S0 then VERIFIED@S1: with the ledger reassessed against S1 first, the prior is
STALE and the new entry is recorded without contest; without reassessment, CONTESTED. Neither path
grants reliance the evidence does not support - the un-reassessed path is over-conservative, not
under.

Prediction W3-b-1: recorded-without-reassess -> CONTESTED, mayRely false. HOLDS.
Prediction W3-b-2: reassessed-then-recorded -> VERIFIED live, mayRely true, prior STALE. HOLDS.
Prediction W3-b-3 (the thing that must NOT happen): at no point is a FALSIFIED@S0 relied on at S1,
nor a VERIFIED@S1 relied on without the S1 world present. HOLDS.

## W3-c — PREDICTED DEFECT: delegation can WIDEN context (calculus.delegate)

`context: context || from.context`. Nothing checks that the grantee's context is within the
grantor's. A holder of grant [x] over {repository: S1} can delegate [x] over {} - every world.

Prediction W3-c-1: `delegate({from: A@{repository:'S1'}, grant:['x'], to:'B', context: {}})` mints
with `context` equal to {}. DEFECT: "delegation can never widen" is enforced for the GRANT and not
for the WORLD the grant applies in.
Control: delegating with the same or a narrower context still mints.
Expected repair: every dimension in the grantor's context must be present and equal in the
grantee's; the grantee may add dimensions (narrowing) and may not drop or change one.

## W3-d — PREDICTED DEFECT: narrow() moves an established world (calculus.narrow)

`narrow(t, d, v)` sets context[d] = v unconditionally. On a dimension already established at S1,
narrowing to S2 is not a restriction - it is a referent move wearing restriction's free pass.

Prediction W3-d-1: `narrow(tok({repository:'S1'}), 'repository', 'S2').context.repository === 'S2'`
and the result is authority. DEFECT (Law 2 through the free operation).
Control: narrowing an ABSENT dimension mints; narrowing to the SAME value mints.
Expected repair: narrow refuses (returns the token unchanged with a reason attached, or a refusal)
when the dimension is established at a different value.

## W3-e — PREDICTED DEFECT: commit() consumes EPISTEMIC authority (calculus.commit)

commit checks isAuthority and valid, nothing else. An OBSERVE token - evidence - commits an action.
delegate() refuses to mint permission from evidence ("evidence establishes what may be BELIEVED; it
does not originate permission"); commit() lets the same evidence act directly.

Prediction W3-e-1: `commit({authority: observe(...), action: 'write'})` -> committed: true. DEFECT
under Law 3 at the commit gate ("individually authorized -> composition authorized": OBSERVE plus
COMMIT equals an action nobody permitted). An existing test in calculus.test.mjs ('PROPOSE creates
zero authority, and COMMIT consumes rather than produces') asserts this behaviour with an epistemic
token and will be changed to use a rooted normative token, with the reason recorded.
Control: a NORMATIVE token rooted at OWNER with a grant covering the action commits.
Expected repair: commit requires NORMATIVE authority that traces to an independent root whose grant
covers the action's requirement (tracesToIndependentRoot, already present and unused by commit).

## W3-f — PREDICTED DEFECT: derive() kind and grant depend on argument ORDER (calculus.derive)

`kind: premises[0].kind, grant: premises[0].grant`. With premises [NORMATIVE(x), EPISTEMIC] the
conclusion is NORMATIVE carrying x; with [EPISTEMIC, NORMATIVE(x)] it is EPISTEMIC carrying nothing.

Prediction W3-f-1: the two derives over the same premises in opposite order mint tokens differing in
kind and grant. DEFECT (a representation in which authority depends on argument order is a
representation that can be steered).
Expected repair: derivation is epistemic. A NORMATIVE premise is refused: permission is delegated,
not derived. Output kind EPISTEMIC, grant [].

## W3-g — retirement analysis: the unimported constraints revisions

MEASURED before this wave: constraints2.mjs, constraints4.mjs, constraints5.mjs, opcontext2.mjs and
score-constraints.mjs have no importer outside tests (constraints.mjs is imported by
score-constraints.mjs, which nothing imports; constraints3.mjs by inventory.mjs; constraints6.mjs by
gate diagnostics and conformance). RETIREMENT_PREREG.md's questions apply:

    R1  no live authority-bearing consumer requires them          predicted HELD (import scan)
    R2  removing them cannot reduce supported evidence            predicted HELD (conformance uses rev 6)
    R3  historical artifacts stay interpretable                   predicted HELD - PROVENANCE names
                                                                  implementations by NAME, not file
    R4  no dynamic import or fallback routes to them               predicted HELD (string scan)
    R6  the scanner DETECTS a real dependency                      constraints6 <- conformance.mjs
                                                                  must be reported as LIVE

If any prediction fails, the file stays and the failure is the finding. The analysis is a script so
it can be re-run.

## W3-h — instrument subsumption (Entry 14), representable or not

The asymmetry to preserve: a cheap instrument that FINDS a defect is conclusive; a cheap instrument
that finds NOTHING substitutes for a stronger null only under an independently established relation.

Representation to build: an instrument declares the failure classes it can detect, each backed by a
witness - a record that the class was injected and the instrument fired (the freeze gate's ten
refusals are of this shape). subsumes(A, B) is SUBSUMES only when every class B detects is detected
by A with a witness; DOES_NOT_SUBSUME when B detects a class A has no witness for; UNKNOWN when either
instrument's classes are undeclared or a witness is missing. nullTransfers(cheap, strong) answers the
Entry 14 question and is UNKNOWN unless subsumes(cheap, strong) is SUBSUMES.

Admit control: A with witnessed {f1, f2, f3} subsumes B with {f1, f2}. Refusal control: B with
{f1, f4} is not subsumed by A. Unknown control: a class without a witness yields UNKNOWN, never
SUBSUMES. Stated limit, in advance: the failure classes are hand-authored - what is mechanical is
the requirement of an executed witness per class and the refusal to say SUBSUMES without one. No
Legasus instrument is described with it in this wave; that would need each instrument's classes to
be argued independently, which is Repo D-adjacent work and is not started.

## Threatened results

W3-c..f change calculus.mjs: FREEZE-GATE (ten refusals, nine admissions), calculus.test. Nothing
else consumes the calculus. W3-g deletes files no rig imports; the six + two rigs are re-run anyway.
