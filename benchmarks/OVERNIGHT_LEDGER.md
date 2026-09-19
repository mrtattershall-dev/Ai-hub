# Overnight ledger

Standing authorization received. `legasus-freeze-r3` is immutable; Repo C is the prospective evaluation
of it. Diagnosis allowed, rescue not. Repairs learned from Repo C belong to r4.

Null results preserved. Every entry records objective, authority, starting hash, evidence, hypothesis,
intervention, controls, raw artifact locations, conclusion, and next justified objective.

---

## Entry 0 — state at handoff

    HEAD                  89d37fc
    frozen                legasus-freeze-r3 (diff vs legasus/: 0 files)
    Repo C subject        pyparsing 3.3.2, manifest 98ebedf996d1331226865673fdc7ad9a6499b6e00992de51345c64b4801de420
    tests                 409 pass
    protocol              benchmarks/REPO_C_PROTOCOL.md (frozen before target selection)

### Repo C measurements completed under frozen r3

    COVERAGE                  74/180 observable                (raw: repoC/sweep.json)
    REASON calibration        57/57                            (raw: repoC/attribution.json)
    CONSEQUENCE calibration   49/57                            (raw: repoC/calibration.json)
    SAFETY epistemics         49/49 unavailable -> UNOBSERVABLE, never an admission

### Repo C measurements NOT completed

    CAPABILITY        requires inference
    COMMIT PRECISION  requires inference

### Demonstrated violated invariants (r4 input, evidence-backed)

    V1  OBSERVER/SUBJECT CHANNEL ALIASING. The observer's protocol and the subject's program output share
        one untyped transport. 48 of 50 unobservable runs individually attributed. This is the same
        failure shape as module:line - a representation coarser than the authority distinction it
        carries. NOT a pyparsing bug and NOT fixed by a pyparsing special case.
    V2  EXECUTION-MODEL ENTAILMENT ERROR. r3 infers "cannot become an experiment" from "a preceding
        example failed". The diagnosis is right 57/57; the entailment is wrong 8 times. Same divergence
        found on packaging, now producing a FALSE CLAIM rather than a scope mismatch.

Both are r4 work. Neither may be repaired in r3.

---
## Entry 1 — Repo C stage 3, authority surface (no inference)

    objective    measure how much of pyparsing frozen r3 can obtain authority to act on
    authority    frozen Repo C protocol, COVERAGE measurement
    start hash   89d37fc
    evidence     repoC/sweep.json (witnessed sites), frozen legacore/capability.mjs
    hypothesis   none stated in advance; this is a measurement, not a test

    RESULT
      callables in corpus                     450
      module-level functions                   66
      methods (OUT of the r3 envelope)        384   85%
      at least one witnessed site             138
      ADMISSIBLE (witnessed AND in-envelope)   10   2.2%
      witnessed but OUT of envelope           128
      in-envelope but unwitnessed              56

    raw          benchmarks/repoC/admission.json

    CONCLUSION. On a heavily object-oriented repository the CAPABILITY ENVELOPE, not observation, is the
    binding constraint. Repo B predicted this at small scale (42 of 56 candidates were methods); Repo C
    confirms it at 85% of 450 callables. The r3 decision not to support method editing - taken
    deliberately before Repo B, and reaffirmed - costs 128 witnessed callables here.

    This is a COVERAGE result, not a defect. r3 correctly refuses what it cannot represent.

    next         stage 4, CAPABILITY and COMMIT PRECISION over the 10 admissible callables using the
                 LOCAL qwen2.5-coder:1.5b (no paid service, within delegated authority)

---
