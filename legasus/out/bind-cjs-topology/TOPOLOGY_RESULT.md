# BIND-CJS step 6 result — M1 FALSIFIED; the multiprocess challenge does not exist on this codebase, and my instrument said it did
2026-09-21 03:25. Preregistration: `legasus/BIND-CJS_TOPOLOGY.md` (c39b02f), frozen before the
run. Mechanism `legasus/cjs-preload.mjs` @ e41c1e3, unchanged. Raw: `topology.json`, per-arm
marker/mechanism logs, per-arm coverage. Foreign files modified: **0**.

## What was measured

| arm | requested | coverage files | **distinct pids** | ran ORIGINAL | ran REPLACEMENT | marker records | legacy state |
|---|---|---|---|---|---|---|---|
| T-A | T000_IDENTITY | 266 | **1** | 0 | all | **266** (one pid) | VALID_INTERVENTION |
| T-C | — | 266 | **1** | all | 0 | 0 | SUBSTITUTION_UNOBSERVED |

No valid mutant exists for either exported name of the subject (`adapters`, `EXPECTED` are not
functions), so the run proceeded on the identity copy exactly as preregistered.

## The finding, which is an apparatus finding first

**The 266 "processes" were never processes.** All 266 coverage files in every arm carry a single
pid. They are 266 coverage *snapshots* written by one process — the engine's harness calls for
coverage repeatedly. Recounting **step 1's own stored coverage by distinct pid**:

    witnesses with more than one process:   0 of 33
    total coverage files:                   298
    total distinct pids:                    33   (exactly one per witness)

**This foreign codebase contains no multiprocess witness at all.** Step 1 recorded "coverage
files per run: 266" and I inferred processes from it — in APPARATUS-NOTES 23/27/28, in the
step-5 preregistration's P-F2 rationale, and in this step's selection of the witness. The
number was right; the noun was wrong.

This is the coarse-identity error in its purest form, committed by me, in the instrument built
to catch coarse identity: *a count of artifacts was read as a count of the things that produce
them.* It cost a preregistration written around a topology that does not exist.

## Scoring

**M1 FALSIFIED**, and by the falsifier named in advance — "no descendant loads the subject at
all", because there are no descendants. The prediction that a child would run the original while
the parent ran the replacement had no object.

**M2 NOT CONFIRMED, and untestable here.** The two classifiers cannot disagree in a set that is
never mixed. The scalar reduction's weakness is nonetheless visible in the raw data: **266
marker observations were reduced to the last one.** They happened to agree (one distinct
identity across all 266) — but agreement was never *checked* by the classifier, only by me
afterwards from the raw records. A representation that reports the last of 266 observations is
correct here by luck, not by construction.

**M3 unpredicted, and the evidence now says something.** The multiplicity that exists in this
codebase is not across processes but **within one process**: the subject module was evaluated
266 times in a single pid, which means the harness clears the module cache between corpus
entries. The step-5 multiplicity check would not have fired on it — it tests `distinct marker
identities > 1`, and all 266 loads share one identity. So BIND currently has no representation
of *load count* at all, only of *identity variety*.

## What transferred anyway, and it is not nothing

The intervention held across **all 266 evaluations**: zero executions of the original in T-A,
and the mirror image in T-C (266 executions of the original, no marker). A single substitution
request survived 266 module-cache clears and re-evaluations, with the witness producing its
full 48 cases and exit 0 in both arms. That is a stronger persistence property than step 5
tested, and it was obtained by accident rather than by design.

## What this changes

1. The Intervention abstraction stays closed, on firmer ground than before: the property holding
   it closed (execution identity across a topology) has **no available experiment on this
   codebase**. It is not "more testing needed"; it is "this target cannot pose the question".
2. `legasus/out/transfer-engine/STEP1-NATIVE-SHAPE.md` and APPARATUS-NOTES 23/27/28 contain an
   inference — coverage files implying processes — that is now corrected by measurement. The
   original records are left intact; the correction is appended, because preserving the wrong
   inference is how the next reader learns it was made.
3. BIND has no representation of repeated evaluation of one identity within a process. Whether
   it needs one is open. This run does not settle it and no state is invented for it.

## The single strongest next falsification

Build the multiprocess topology **deliberately**, in a synthetic fixture, rather than hunting a
foreign codebase that may not contain one: a parent under the mechanism that spawns children
which do not inherit `--import`, with both loading the same subject. That poses M1's question
with certainty instead of hoping a target supplies it. It is a qualification-style experiment,
not a transfer, and needs its own preregistration.

Second, smaller: recount every artifact-derived count in the ledger by the thing it claims to
count. One such count was wrong tonight; the check is cheap and the class of error is proven
live.
