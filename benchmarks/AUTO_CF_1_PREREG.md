# PREREGISTRATION — AUTO-CF-1, counterfactual execution over a recorded witness

Frozen before the mechanism exists. Nothing else is in this commit. Builds on `276d90b`.

## The milestone, in the owner's words

> From that witness, mutate one eligible leaf fact, reconstruct through the real production path,
> prove the perturbation occurred, execute the same target, and produce a typed outcome.
> **Only then add semantic judgment.**

So: no judgment, no support formula, no contract source, no discovery. Outcomes and observations.

## The number this slice is for

The owner set the target metric, and set it against the tempting one:

    hand-authored counterfactual drivers   0
    authority transforms witnessed         N
    authority transforms replayed          M
    authority transforms perturbed         K

Small N, M, K beat a hand-driven 100. If K comes out at 3, the honest report is 3.

## PREDICTIONS

**C-1 (DECISIVE). K > 0 with zero hand-authored counterfactual drivers.** Starting from witnesses
captured by AUTO-WITNESS-1 from existing test files, the system perturbs leaf facts, reconstructs
through the real production constructors, runs the same target, and reports typed outcomes. No file
supplies `facts`, `construct` or `operate`.
*Falsified if* K is 0, or if reaching K > 0 requires authoring a fact set.

**C-2. A perturbation is proven at the rebuilt ARGUMENT, not at the template.** A leaf deletion that
leaves the reconstructed argument semantically identical - because the constructor re-supplies a
default, say - is `PERTURBATION_NO_EFFECT` and cannot be scored.

**C-3 (THE DISTINCTION SLICE 1 GOT WRONG). "The intervention did not happen" and "the intervention
happened and did not matter" are different outcomes.**

    PERTURBATION_NO_EFFECT   the rebuilt INPUT was identical           -> VACUOUS, scores nothing
    OBSERVED with no delta   the input really changed, the OUTPUT did not   -> a real observation

*Control C-3b (must fire):* a leaf the subject provably ignores must land in the second, not the
first. Conflating them is how a matrix where everything depends on everything gets produced.

**C-4. Refusals are typed, separated, and decided by the SUBJECT'S OWN brand predicate.**

    RECONSTRUCTION_FAILED   a premise constructor refused the mutated facts
    AUTHORITY_REFUSED       the target refused a legitimately constructed input
    TARGET_NOT_REACHED      a premise threw, so the target never ran

None is scored, and none is evidence about the subject. The discriminator is `isAuthority` - what
production asks - never a refusal convention I invent for the screen.

**C-5. Still no backdoor.** Mutation is applied to LEAF FACT templates before reconstruction. No
authority object is copied, modified, or constructed by the screen. Exports pinned by a test.

**C-6. NO JUDGMENT IS ISSUED.** This slice produces no `INVARIANT_HELD` and no `INVARIANT_VIOLATED`.
Output deltas are observations. If a verdict appears, the slice has exceeded its scope.

## CONTROLS THAT MUST FIRE

    C-2b   a leaf whose removal the constructor repairs   -> PERTURBATION_NO_EFFECT
    C-3b   a leaf the subject ignores                     -> OBSERVED, delta empty
    C-4b   a constructor that refuses the mutated facts   -> RECONSTRUCTION_FAILED, never a delta
    C-4c   a target that refuses a valid rebuilt premise  -> AUTHORITY_REFUSED, never a dependency
    C-5b   exported surface contains no mint/forge

## WHAT THIS SLICE DOES NOT ESTABLISH

- No support formula. ALL_OF / ANY_OF come after this works, and only over complete truth tables.
- No contract source; `declared` is still human testimony and is not consulted.
- No discovery of the authority surface, and therefore **still no coverage fraction**.
- Nothing about transformations that do not execute during an existing test.
- The five prototypes remain unmerged.
