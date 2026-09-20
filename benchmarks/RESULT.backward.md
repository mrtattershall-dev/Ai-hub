# r4 — BACKWARD-1 on Legasus. RESULT: the two surfaces are DISJOINT. The hub was not run.

Predictions frozen in `e970b61`. Substrate: `legasus/legascreen/{sink,ancestry}.mjs` plus a loader
`resolve` hook. Run: `node benchmarks/run-backward.mjs` over Legasus's own 93 test files.

**THE PROSPECTIVE SUBJECT WAS NOT TOUCHED.** The preregistration says the hub is run ONCE, after the
mechanism is frozen. The mechanism took three repairs during this slice, so it is not frozen, and
running it now would have burned the only unspoiled transfer test for nothing.

## The result that matters

    EFFECT_WITNESSED            4132      FILESYSTEM_MUTATION 3415   PROCESS_EXECUTION 717
    PRODUCTION_REACHED          2245
    TEST_ONLY                   1889

    BK-4 THE TWO SURFACES
        forward only (brand-seeded)       10
        backward only (sink-seeded)       42
        INTERSECTION                       0

**Zero.** On this repository the brand-seeded surface and the sink-seeded surface do not overlap at
all. Forward discovery finds the authority calculus, which nothing in production consumes. Backward
discovery finds the code that actually causes effects, which never touches the brand. Both directions
find real things and they are disjoint sets.

That is stronger than "neither direction is sufficient". On Legasus, **forward discovery has zero
overlap with everything that actually happens.**

    legareward/robustness.mjs::runProgram      FILESYSTEM_MUTATION, PROCESS_EXECUTION
    legacommit/transactional.mjs::snapshot     FILESYSTEM_MUTATION
    legacommit/transactional.mjs::restore      FILESYSTEM_MUTATION
    legaexternal/git-producer.mjs::git         PROCESS_EXECUTION

Snapshot, restore, run-a-program, run-git. Authority-bearing by any reading, and **not one of them is
on the forward surface.**

## Nothing names the subject

The only inputs are six sink CLASSES and twelve runtime module boundaries - fs, child_process, http,
net - which are properties of the Node platform. No file, function or API of the subject is named
anywhere in the mechanism, and the sink shim wraps EVERY export of a boundary module, discovered at
load time, so nothing picks the interesting functions.

## THREE DEFECTS IN MY OWN LAYER, AND TWO WERE SILENT

**1. A silent death.** The first `resolve` hook redirected fs for every importer, including Node's
own module machinery. The child process produced **no output at all and exited 0** - the failure
class this project hunts, committed in the loader built to hunt it. Repaired by scoping redirection
to the subject tree and excluding the instrument.

**2. An unparsed representation became a measured absence.** The stack-frame pattern recognised a
path by its prefix and stopped at the first colon, so every ESM frame on Windows - file:///C:/... -
failed to match and was dropped. The run then reported **PRODUCTION_REACHED 0 with complete
confidence.** A regression test pins four frame shapes.

**3. A consumer count masquerading as a structure.** The first backdoor rule called any export
"test-only" when every file mentioning it outside its own module was a test. On Legasus that flagged
**192 exports**, including a plain function and a constant, and drove PRODUCTION_REACHED to zero. It
had conflated two different facts:

    NO_PRODUCTION_CONSUMER   nobody but the tests happens to call it in THIS repository
    TEST_BACKDOOR            it exists in order to reach module internals from outside

The first is a property of the repository; the second is a property of the export. **Letting who
happens to reference something decide what it IS** is precisely the representation-leakage mistake
this line of work exists to detect. Both are now reported, and only the structural one decides
reachability.

## The reachability rule, after a control corrected it

A control corrected the rule itself. The signal is not an aggregate handle appearing in a stack - it
never would. It is that **production code cannot call a module-private binding from outside that
module**, so if control entered production at a PRIVATE function, the path required test-only
accessibility, whatever shape the backdoor took. A nested arrow inside an exported function is not
itself exported, so every enclosing function is consulted, not the innermost.

    TEST BACKDOORS DISCOVERED BY STRUCTURE: 0 on this repository

Zero, so the detector is UNFIRED here and would be untrustworthy on that basis alone. A fixture
forces it: an aggregate of private bindings is caught, a literal-valued config object is not, and a
re-export of already-public functions is not.

## Predictions

    BK-1  backward reaches private production code forward cannot   SHAPE CONFIRMED on Legasus,
                                                                    NOT YET TESTED on the hub
    BK-2  the dangerous null (needs backdoors/names to work)        not triggered: 0 names used
    BK-3  a private function reaches SUPPORT_CHARACTERIZED          **NOT TESTED**
    BK-4  the intersection is measurable                            HELD, and it is 0
    BK-5  no hub modification                                       HELD - the hub was not run
    BK-6  no hub defect found                                       vacuously held

**BK-3 IS THE SUBSTANTIVE CLAIM AND IT IS NOT TESTED.** Four private functions are on witnessed
effect paths, but appearing on a path is PARTICIPATION, not RELEVANCE. Establishing relevance needs
perturbation, which needs the sink recorder joined to the witness recorder, and that is not built.
Reporting these four as "discovered" would be exactly the overclaim the stage ontology exists to
prevent.

    EFFECT_DISCOVERED / EFFECT_WITNESSED / ANCESTRY_OBSERVED       reached
    SUPPORT_CHARACTERIZED / JUSTIFICATION_ESTABLISHED / SCREENED   not reached

Focused 6/6. Suite 684/684.
