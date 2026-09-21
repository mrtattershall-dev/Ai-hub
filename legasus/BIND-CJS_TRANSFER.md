# BIND-CJS step 5 — foreign transfer preregistration (frozen 2026-09-21 02:45, before the engine is touched)

Qualified mechanism: `legasus/cjs-preload.mjs` at **e41c1e3, which is immutable for this step.**
No engine-specific change may be made to it, or to the qualification driver, during the
transfer. A repair derived from a foreign outcome ends the transfer; it does not improve it.

## The question

**Can the qualified CJS mechanism preserve its frozen evidentiary properties when moved
UNCHANGED into the previously measured foreign engine?** Not "does registerHooks work there" —
that is already answered synthetically.

Foreign target: `C:\Users\tatte\OneDrive\Documents\ai-native-engine`, shape measured read-only at
step 1 (b822ed6). Nothing in its tree is modified; step 1 measured 0 files touched and that
stands.

## Evidence chain required, unchanged from qualification

    REQUEST -> transport claim -> exact served identity -> executed identity observed in the
    subject process -> scope evidence across ALL loaded modules -> witness result

## The scope universe may not shrink because the target is bigger

Q-H established that a correct intervention at the target can coexist with an unauthorized one
elsewhere: `requested == served == executed` is **necessary but not sufficient**. In the
fixture, scope was three modules. The engine loads many more, so scope evidence here comes from
a channel that does not depend on marking foreign files (which is prohibited):

    SCOPE UNIVERSE = every script URL appearing in V8 coverage for the run.
    AUTHORIZED     = exactly one Legasus-generated file, the one this condition requested.
    VIOLATION      = any OTHER Legasus-generated file in the executed set.

If the recorder considered only the requested module, the attribution defect Q-H exposed would
be recreated at larger scale. It is recorded as the whole executed set, every run.

## Predictions

**P-F1.** A foreign intervention may correctly substitute the requested target *while also*
producing an unexpected intervention or identity event elsewhere; therefore target-triple
validity alone may not establish `VALID_INTERVENTION`.
This does not predict that a scope violation will occur. It fixes what the classifier must do
if one does: scope is evaluated over the whole event, and a violation anywhere denies
`VALID_INTERVENTION` for the run even when the target triple is perfect.
FALSIFIER: a run reported `VALID_INTERVENTION` while an unauthorized Legasus-generated file
appears in the executed set.

**P-F2.** Multiple loads of the same requested executable must NOT be collapsed into one
intervention merely because their path identity matches.
The engine spawns processes, uses the network, and may load a module more than once — and
`--import` is **not** inherited by spawned children, so a child can load the ORIGINAL subject
while the parent runs the mutant. Path is not execution.
Frozen handling: if the subject path is served more than once, or if BOTH the subject and its
substitute appear in the executed set, the state is `INTERVENTION_MULTIPLICITY` — **refused, not
deduplicated into a clean event.** Coarse executable identity has cost this project before.
FALSIFIER: multiplicity observed and reported as a single clean intervention.

**P-F3.** The mechanism transfers unchanged: at least the `VALID_INTERVENTION`,
`SUBSTITUTION_UNOBSERVED` and scope states behave on the foreign subject as they did on the
fixture.
FALSIFIER: any state that behaved on the fixture fails to behave here. That is a transfer
failure and is preserved, not repaired.

## Mechanical selection of (subject, witness) — the rule, applied by code, not by browsing

From step 1's recorded `engine-shape.json` only:

1. Candidate subjects: non-test files with >= 1 exported name **and zero relative `require`s**.
   The second clause is a stated transport limitation, not a convenience: a mutant is written
   outside the foreign tree, so a subject with relative dependencies would fail to resolve them
   from the mutant's location — and placing mutants inside the foreign tree is prohibited.
   **This limitation is recorded as a finding about the transport whatever the outcome.**
2. Candidate witnesses: test files whose recorded `requires` resolve to that subject.
3. Choose the pair maximising the witness's step-1 per-case line count; tie-break by subject
   path, lexicographic.
4. Perturb the first exported function in source order, using the existing frozen family
   (`legasus/mutate.mjs`), taking the first valid mutant it produces.

The code reports what the rule selected. The witness's outcome is **recorded, not predicted**:
if the perturbed function is never called, the mutant is behaviourally inert, the witness still
passes, and the site is `SITE_UNOBSERVED` — which is an honest observation about the witness,
not a failure of the transport.

## Conditions (mirroring qualification, on the foreign subject)

    F-A  mutant requested            expect VALID_INTERVENTION (scope clean)
    F-B  identity copy requested     expect VALID_INTERVENTION (scope clean)
    F-C  total bypass                expect SUBSTITUTION_UNOBSERVED
    F-G  no request                  expect SUBSTITUTION_UNOBSERVED

## R4 stays UNESTABLISHED, whatever happens to R8

A successful transfer would read:

    R8 substitution   ESTABLISHED for this foreign subject
    R4 invocation     UNESTABLISHED

meaning *we can intervene faithfully in this foreign program when given an invocation* — and
NOT *Legasus knows the authoritative way this program should be exercised*. The engine still has
no manifest, no test script and no VCS. Success in one dimension may not leak authority into the
other, and the transfer record must state both lines together.

## Failure handling

A transfer failure is preserved as a transfer failure. No repair using engine outcomes; no
second candidate mechanism; no adjustment of the classifier after seeing a foreign state. If the
mechanism needs to change, that is BIND-CJS v2 under a new preregistration, and this result
stands as the reason.

## What a successful transfer would earn

Two mechanisms with genuinely different implementation topology (async off-thread ESM loader;
synchronous in-thread hooks) satisfying one contract **frozen before the second mechanism
existed**. That is evidence for extracting an Intervention interface — to be granted only after
attacking the raw identities, multiplicity, scope records, non-vacuity and R4 separation, not on
the strength of a green line.
