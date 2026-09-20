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
## Entry 2 — Repo C stage 4, CAPABILITY and COMMIT PRECISION

    objective    complete the frozen Repo C measurement
    authority    frozen protocol; local qwen2.5-coder:1.5b, no paid service
    start hash   bb4ba36
    evidence     repoC/tasks.json (oracle), repoC/arms.json (arms)
    controls     oracle established BEFORE inference - a mutation the external verifier cannot detect
                 gives a free pass to any candidate, so 6 of 10 admissible callables are UNSCORABLE

    RESULT
      distinct scorable tasks                3   (0.67% of 450 callables)
      baseline                               73 failed / 182 attempted
      CAPABILITY                             0 / 3
      COMMIT PRECISION                       UNDEFINED - 0 commits, NOT 100%
      SAFETY                                 3 / 3 destructive candidates refused
      RAW arm                                3 / 3 committed, 0 / 3 satisfied the target

    APPARATUS DEFECT FOUND AND REPAIRED, RECORDED
      The first scorer compared `failed` alone. Two RAW candidates scored failed=47 against baseline 73
      and looked like improvements; they had mangled core.py so doctest discovered 52 examples instead of
      182. Confirmed by truncating core.py, which reproduces failed=47/attempted=52 exactly.
      A state now satisfies the target only if it PRESERVES THE DISCOVERABLE SURFACE. The invalid run is
      preserved at repoC/arms.INVALID-failed-only-scorer.json. The repair moved the result AGAINST the
      RAW arm.

    AGGREGATION ERROR CAUGHT BEFORE SCORING
      4 scorable callables were 3 distinct mutations - count_field_parse_action is nested inside
      counted_array and both share line 87. Deduplicated before any inference was spent.

    CONCLUSION. r3 is SAFE and CANNOT DO THE JOB on this target. It refused three candidates that would
    have damaged the repository, including one that would have deleted 130 discoverable tests, and it
    repaired nothing. Its commit precision is undefined because it committed nothing - exactly the
    outcome the frozen protocol was written to stop being reported as perfection.

    next         Repo C measurement under the frozen protocol is COMPLETE. Move to r4 development from
                 the demonstrated violated invariants V1 and V2.

---
## Entry 3 — r4 / V1 repair: observer-subject channel isolation

    objective    repair the violated invariant V1, tested against the INVARIANT not the manifestation
    authority    delegated r4 development surface
    start hash   a52c26f
    hypothesis   the subject and the observer share an untyped transport; giving the protocol a private
                 channel should recover the lost observations without losing any

    INTERVENTION
      legasus/legaexercise/channel.mjs   FD-LEVEL isolation via os.dup2, protocol to a private file.
                                         NOT contextlib.redirect_stdout, which misses os.write(1,...),
                                         C extensions, inherited child descriptors and late threads.
      legasus/legaexercise/observe-r4.mjs  the witness rebuilt on that channel; r3's observe() is left
                                         intact and importable so the two can be A/B compared.

    CONTROLS  16 attacks on the boundary, all surviving: plain print, PROTOCOL-SHAPED JSON (forgery),
      multiple JSON objects, partial JSON, no trailing newline, embedded newlines, 2 MB and 5 MB output,
      ANSI and control bytes, raw os.write to fd 1 and fd 2, all 256 byte values, stderr, subprocess
      stdout, subprocess stderr, a thread writing after the call returns, and flush abuse.
      Plus: an absent protocol stays distinguishable from an emitted empty payload; a crashing subject
      still leaves its output as evidence; and the KNOWN TRANSPARENCY COST is asserted rather than hidden
      (isatty() is False under capture, so subjects branching on it are judged in that world).

    RESULT (r4 development evidence, NOT a prospective result)
                          r3 shared channel    r4 isolated
      OBSERVED_OK                  60              106
      OBSERVED_RAISED              15               18
      SETUP_FAILED                 57               58
      UNOBSERVABLE                 50                0
      OBSERVED total          75 (41.2%)      124 (68.1%)
      observations LOST by the repair            0
      flipped examples emitting subject bytes   50 / 50

    CONFOUND RECORDED. observe-r4 is not a single-variable change: it also restructured setup handling.
    The A/B therefore cannot attribute the whole difference to the channel by itself. Partial attribution
    is reported instead - all 50 flipped examples emitted subject bytes, which is the precondition for
    the channel explanation, so the channel is a SUFFICIENT explanation for every one of them.

    LIMIT. Threat model is cooperative-but-noisy code. The subject may emit anything, including exact
    protocol bytes, but is not assumed to hunt for and write to the observer's private file.

    next         V2 - the execution-model entailment error
---
## Entry 4 — r4 / V2: the execution model made explicit

    objective    repair V2 - r3's entailment "a failed prefix means this cannot be an experiment"
    authority    delegated r4 development surface
    start hash   60323a5
    hypothesis   the entailment is a property of r3's MODEL, not of the subject. Making the model an
                 explicit recorded coordinate (RECONSTRUCTED_PREFIX vs SEQUENTIAL_SHARED) should recover
                 the 8 wrong entailments without rescuing genuine failures.

    RESULT (preregistered in the commit before the run)
      W1  8 cases r3 called SETUP_FAILED while external PASSED
          now OBSERVED under SEQUENTIAL_SHARED: 8 / 8, all with status OK          HELD
      W2  49 cases where BOTH reported failure
          still failing under SEQUENTIAL_SHARED: 47 / 49                           FAILED
      W3  75 observable under RECONSTRUCTED_PREFIX, still observable: 75 / 75      HELD

    W2 IS THE INFORMATIVE ONE AND IT FAILED. The control existed precisely to catch a model that is more
    permissive rather than more faithful, and it caught one.

    DIAGNOSIS, not a rewritten hypothesis. The w2 cohort contains 44 UNEXPECTED_EXCEPTION and 5
    OUTPUT_MISMATCH. My SEQUENTIAL_SHARED model observes EXECUTION ONLY - it records whether an example
    raised and never compares its result against the documented output. It therefore CANNOT detect an
    output mismatch, and 2 of those 5 slipped through as successes.

    This is a genuine incompleteness in the r4 repair, not a flaw in the test. The prediction stands as
    FAILED.

    NEXT OBJECTIVE, derived from the failure. Add assertion evaluation to the sequential model - and
    delegate the comparison to doctest.OutputChecker rather than reimplementing it. Reimplementing
    CPython's comparison rules is exactly what produced the 86% agreement ceiling on packaging; the
    authority that DEFINES the comparison should perform it.

---
## Entry 5 — r4 / V2b: delegated assertion evaluation

    objective    close the W2 gap by giving the sequential model a failure vocabulary
    start hash   4eda10d
    hypothesis   X1 W2 rises to 49/49; X2 W1 stays 8/8; X3 W3 stays 75/75

    RESULT
      X1  both reported failure, now detected      49 / 49    HELD
          of which OUTPUT_MISMATCH correctly named  2 / 5     IMPRECISE, recorded
      X2  W1 recoveries retained                    8 / 8     HELD, but only after a defect of MINE
      X3  nothing became unobservable              75 / 75    HELD

    X2 FAILED ON THE FIRST RUN AT 6/8, AND THE CAUSE WAS MINE, NOT THE MODEL'S
      1. mine.mjs strips the trailing newline from `want`. doctest's example.want ALWAYS ends in one, so
         a stripped want was compared against a newline-terminated got and "integer" failed against
         "integer\n". DELEGATING A COMPARISON WHILE MANGLING ITS INPUT IS NOT DELEGATION. The contract is
         now restored at the point of use.
      2. The other case was a KEY COLLISION, not a model failure - see below.

    A CORRECTION TO A PUBLISHED REPO C NUMBER, and it goes slightly in r3's FAVOUR
      3 external keys are AMBIGUOUS: the same (module|source) appears in two docstrings with DIFFERENT
      outcomes, and a last-wins map silently picked one.
          PASS / OUTPUT_MISMATCH        core|print(real.parse_string('3. 1416'))
          PASS / OUTPUT_MISMATCH        core|print(patt.parse_string('ablaj /* comment */ lskjd'))
          UNEXPECTED_EXCEPTION / PASS   helpers|print(result.dump())
      ONE of the 8 SETUP_FAILED|PASS cohort sits on the third of those. So Repo C's CONSEQUENCE
      calibration of 49/57 carries +/-1 uncertainty: it is between 49/57 and 50/57, and one alleged wrong
      entailment may be correctly classified. Stated plainly because it favours r3.

    REMAINING GAP, NOT HIDDEN. OUTPUT_MISMATCH is correctly NAMED in only 2 of 5 cases; the other 3 are
    detected as failures but attributed to the wrong kind. Detection is right, reason topology is not.

    ARCHITECTURAL INSIGHT DERIVED FROM THIS, for the next objective. r3 mined doctests and replayed them,
    which is Legasus REIMPLEMENTING AN EVIDENCE PRODUCER IT COULD SIMPLY RUN. Every disagreement in this
    entry came from that reimplementation - stripped wants, collided keys, a missing failure vocabulary.
    The cleaner design treats doctest as an EXTERNAL PRODUCER and adapts its output under Law 4 rather
    than rebuilding it.

---
## Entry 6 — r4: the external-producer boundary

    objective    stop reenacting an authority Legasus can simply run
    authority    delegated r4 development surface
    start hash   0ea782e

    THE ROOT OF THREE SEPARATE DEFECTS, and it was not "the doctest replay has bugs":

        doctest truth              Legasus reconstruction
        want = "integer\n"    ->   "integer"              information destroyed
        example identity      ->   module|source          identity destroyed
        failure semantics     ->   a local vocabulary     semantics approximated

    LEGASUS HAD PLACED ITSELF INSIDE THE TRUTH-PRODUCING MECHANISM WHEN IT ONLY NEEDED TO BE AN EVIDENCE
    CONSUMER.

    INTERVENTION
      legaexternal/producer.mjs   runs CPython doctest and records what it said. Identity is producer +
                                  document + ordinal; SOURCE TEXT IS DESCRIPTION, NOT IDENTITY. No hash
                                  is used as identity either - a hash faithfully identifies only the
                                  fields chosen to hash, so hashing a coarse tuple would merely make the
                                  coarseness look authoritative.
      legaexternal/adapt.mjs      the Law-4 adapter. Declared mapping only; an unmapped native result
                                  becomes UNKNOWN_MAPPING rather than the nearest familiar label.

    NINE CONTROLS, ALL HOLDING
      IDENTITY          identical source text in two docstrings stays two experiments, and the OLD key is
                        asserted to collide, so the test demonstrates the defect it replaces
      FIDELITY          native results and unstripped wants survive adaptation
      NON-INVENTION     unmapped native -> UNKNOWN_MAPPING, with a positive control that mapped ones map
      NON-INVENTION     mechanically, via illegalRefinement: the adapter cannot distinguish what the
                        producer did not
      NON-VACUITY       producer failure carries NO evidential force about the subject
      RAW PRESERVATION  re-adaptation is deterministic AFTER THE SUBJECT IS DELETED, and a later
                        vocabulary re-adapts the same observation without rerunning anything
      CHANNEL ISOLATION a subject writing at import time cannot corrupt the producer report
      VERSION/SCOPE     every claim records the producer semantics that established it
      ADMIT CONTROL     collapsing OUTPUT_MISMATCH and UNEXPECTED_EXCEPTION into REFUTED is LEGAL because
                        no consumer distinguishes them - and becomes ILLEGAL the moment one does

    A VACUOUS TEST OF MY OWN, CAUGHT AND FIXED. The first channel test used a doctest example that
    prints - but doctest CAPTURES example output itself, so the subject never touched fd 1 and the test
    proved nothing (subjectBytes was 0). The corpus now writes at MODULE IMPORT time, which escapes
    doctest's per-example capture, and the test asserts subjectBytes > 0 so it cannot silently go vacuous
    again.

    DOCTEST IS NOT AN ORACLE. A PASS establishes satisfaction of that example under that producer's
    semantics - not general correctness, preservation, or project advancement. The scope recorded on each
    claim is what bounds it.

    NEXT OBJECTIVE comes from the ledger, not from another pyparsing discrepancy.

---
## Entry 7 — r4: concurrency envelope

    objective    establish the concurrency envelope of V1 isolation - the only open ledger item that
                 threatens the authority of NEW r4 evidence
    authority    delegated r4 development surface
    start hash   c570437 (predictions frozen there, including my own prior)

    OVERLAP WITNESSED, not assumed: A saw B entered, B saw A entered, distinct pids.

    PROTOCOL INTEGRITY      HELD
    ATTRIBUTION             HELD
    NON-INTERFERENCE        HELD    solo 42, concurrent-with-hostile-A 42
    POST-FAILURE ISOLATION  HELD

    VERDICT  PARALLEL_SAFE because of PROCESS ISOLATION. THE ISOLATION UNIT IS THE PROCESS, NOT THE CALL.
             The OS boundary and the evidence boundary coincide, so the unit of isolation matches the
             unit of authority. No mutex needed - and a mutex would not have helped otherwise, since it
             schedules access to a shared resource rather than repairing a trust-boundary mismatch.

    ONE ATTACK WAS VACUOUS AND IS RECORDED AS UNTESTED. The fork/inherited-descriptor attack was guarded
    by hasattr(os, "fork"), which is False on win32, so it silently skipped. The envelope EXCLUDES it.

    SCOPE  win32, CPython 3.13, cooperative-but-noisy threat model, one OS process per observation.
           Untested: POSIX fork and descriptor inheritance, concurrent observation from multiple host
           processes, descriptor exhaustion.

    The synchronous runIsolated cannot overlap at all; an async runner was added for the experiment
    because "cannot be tested" must never be recorded as "is safe". The serialization is incidental; the
    safety is process isolation.

    next         ledger is clear of items that threaten new r4 evidence. Remaining open: retire or repair
                 the replay path (2/5 naming), which is now a RETIREMENT candidate.

---
## Entry 8 — r4: replay retirement as an authority-boundary simplification

    R1 HELD, R2 HELD (426 tests unchanged), R3 FAILED then repaired, R4 HELD, R5 HELD, R6 HELD

    R3 FAILED AND BLOCKED THE RETIREMENT. No historical artifact could say what produced it, so deleting
    the implementation would have left the records unattributable. THE LEDGER WAS NOT PRESERVING EVIDENCE
    INDEPENDENTLY OF MACHINERY. The experiment found a defect in the LEDGER, not in the replay path.
    Repaired by benchmarks/PROVENANCE.json - 21 artifacts, 0 unknown, an ANNOTATION BESIDE the artifacts
    and never inside them, with git as its own evidence.

    TWO DEFECTS IN MY OWN ANALYSIS, both caught before being recorded as findings:
      1. the R4 scanner matched COMMENTS and its own source, reporting two fallbacks that were neither.
         Both were inspected before dismissal; the crude result stands in the record.
      2. the sidecar carried a HAND-WRITTEN artifact list naming five repoB files that never existed, and
         reported R3 failing because of my list. Replaced by enumeration.

    AND ONE MISREADING OF MY OWN: I briefly believed a provenance mis-attribution existed, from reading
    TRUNCATED CONSOLE OUTPUT across a record boundary. The JSON said UNKNOWN all along. JSON ARTIFACTS ARE
    AUTHORITATIVE; CONSOLE OUTPUT IS NON-EVIDENTIARY - a rule already in this project, broken by me.

    RETIRED: assertionHeld, surveyFrontier, observeSequential, observeSequentialChecked.
    KEPT: observeIsolated (traced SITES - the producer reports verdicts and never which code objects ran),
          the r3 witness (reproducibility), mineDoctests (feeds site tracing).

    VERIFIED SUBTRACTION IS PROGRESS WHEN IT REDUCES DUPLICATED AUTHORITY WHILE PRESERVING THE
    EVIDENCE-BACKED CAPABILITY FRONTIER - and only then. First removal in this architecture; every prior
    step added.

    next         QUIESCE check - is there a justified operation whose outcome could change entitlement?

---
## Entry 9 — r4: producer #2 (git) attacks the external-evidence boundary

    objective    find out whether the evidence boundary is GENERIC or merely doctest-shaped, by running a
                 second, maximally unlike external authority through it
    authority    P2-SELECTION and predictions E1-E10, frozen in 087ec67 BEFORE candidates were inspected
    start hash   087ec67
    evidence     benchmarks/producer2-selection.mjs, legasus/legaexternal/git-producer.mjs,
                 legasus/legaexternal/producer2.test.mjs (11 tests), benchmarks/RESULT.producer2.md
    hypothesis   E1-E10 hold; and if the boundary must change shape to admit producer #2, THAT is the
                 result, to be recorded rather than engineered away

    RESULT   E1-E10 ALL HELD. 444 tests, 444 pass, 0 fail.

    THE BOUNDARY HAD TO BEND, AND THAT IS THE FINDING. The adapter hard-coded doctest's history shape,
    document + "#" + ordinal. Handed a git record - which has NEITHER coordinate - it emitted the literal
    string "undefined#undefined". A FABRICATED COORDINATE WHERE THE HONEST ANSWER IS THAT THE DIMENSION
    DOES NOT APPLY: UNKNOWN collapsing into a value, inside the very abstraction built to prevent exactly
    that. It survived producer #1 only because producer #1 always had both fields. Repaired so that a
    coordinate the producer cannot establish is ABSENT rather than invented; git carries its own
    (implementation = oid, repository = HEAD) and doctest's scope is byte-unchanged.
    ABSENT IS NOT UNKNOWN, AND NEITHER IS A STRING THAT LOOKS LIKE DATA.

    THE SELECTION RULE'S ORDERING CLAUSE DID NO WORK, and this is recorded as an apparatus defect rather
    than smoothed over. All five eligible candidates (git, pip-check, py_compile, symtable, unittest)
    differ from doctest on ALL SEVEN axes, so "most axes differing" tied everywhere and the LEXICOGRAPHIC
    TIEBREAK made the choice. The rule was applied as frozen rather than repaired mid-experiment. The
    eligibility filter is still a real filter; the ordering clause is recorded as
    P2-SELECTION-ORDERING = UNDISCRIMINATING on this candidate set, and must NOT be cited as evidence
    that git was the maximally distant choice. git's merits stand independently: it never executes the
    subject, its identity is content-addressed, its history is a DAG, and it has no PASS or FAIL.

    E6 IS THE PREDICTION THAT DISTINGUISHES GENERIC FROM MERELY TOLERANT. git evidence does not just
    survive storage - it DERIVES a scoped Legasus claim ("the copy measured is the copy that was
    committed") with assertion: null. git establishes IDENTITY, NOT AN ASSERTION, and forcing an assertion
    field onto it would have invented a distinction the producer never made. Law 4 in the direction that
    is easy to miss, because the invented value would have looked harmless.

    NOT ESTABLISHED. Two producers is not "generic" - it is ONE demonstrated bend plus a repair. Nothing
    here tests whether {observability, assertion} are the right two fields; both producers fit them so
    far, and git fits only by being allowed to DECLINE the second. win32, git 2.43, no POSIX run.

    next         QUIESCE check against law 7's four conditions, rather than manufacturing an objective.
                 Still open: POSIX_FORK_INHERITANCE = UNTESTED; the one UNRESOLVED ATTRIBUTION case;
                 r4's prospective validation requires Repo D, which cannot be selected while r4 is under
                 development.

---
## Entry 10 — the QUIESCE check, and what law 7 found by being asked

    objective    answer Entry 8's closing question MECHANICALLY: is there a justified operation whose
                 outcome could change entitlement, or is the system entitled to stop?
    authority    legasus/legaknow/stopping.mjs, applied to this ledger's own open questions
    start hash   ec8f035
    evidence     benchmarks/quiesce-check.mjs (runnable; prints its evidence before its verdict)
    hypothesis   none stated in advance; this is an entitlement computation, not a test

    VERDICT   OPEN_CONTEST. DO NOT QUIESCE. 1 of 4 open questions is justified.
              Stopping here would be STALLING, which is a different thing and must not be reported as
              quiescence.

    WHAT THE CHECK IS AND IS NOT. The four conditions are booleans, and a boolean I assert is my judgment
    wearing a machine's clothes. Each is tagged MEASURED or DECLARED in the output. The value is not that
    it computes the answer - it is that canChangeEntitlement becomes UNSKIPPABLE and a declared condition
    is VISIBLY declared.

    THREE ARE BLOCKED AND NONE IS BLOCKED BY LACK OF AUTHORITY.

      POSIX_FORK_INHERITANCE        not executable   MEASURED: python hasattr(os,"fork") is False on
                                                     win32. Blocked by the PLATFORM. Stays UNTESTED and
                                                     the envelope keeps EXCLUDING it.
      REPOC_UNRESOLVED_ATTRIBUTION  not executable   MEASURED: external.json records carry exactly
                                                     {module, outcome, source}. 3 keys hold CONFLICTING
                                                     outcomes and NO coordinate distinguishes them.
                                                     Blocked by INFORMATION DESTROYED AT COLLECTION TIME,
                                                     before the last-wins map. A fresh run yields
                                                     observations with NOTHING TO JOIN ON - it would not
                                                     resolve the old case, it would silently REPLACE it.
                                                     49 / 7 / 1 is therefore PERMANENT, not pending. This
                                                     is law 1 seen from the other side: information
                                                     destroyed in the past cannot be restored by
                                                     authority in the present.
      REPO_D_PROSPECTIVE_VALIDATION not executable   Blocked by SEQUENCING under the frozen burn rule.
                                                     The block lifts when r4 STOPS CHANGING - a decision
                                                     about r4, not about Repo D.

    THE ONE JUSTIFIED INVESTIGATION IS PRODUCER_3_SCOPE_VOCABULARY, and the check sharpened it while
    computing it.

    APPARATUS CORRECTION, recorded rather than quietly fixed. Measurement 3 first looked for
    SCOPE_DIMENSIONS in admissibility.mjs and printed "NOT FOUND" - true and useless. The dimensions live
    in justification.mjs; admissibility.mjs holds the GATE deciding whether a new one may exist. Repointed.

    AND THE CORRECTED MEASUREMENT FOUND A DEFECT THE HYPOTHESIS HAD NOT PREDICTED:

        declared scope dimensions            repository, environment, history, criterion, invocation,
                                             implementation   (6, a CLOSED set)
        production modules using admitDimension   NONE - imported only by its own test

    scope(), covers() and joinConflicts() all iterate the module constant DIMENSIONS. admitDimension -
    the gate built to adjudicate whether a NEW coordinate may exist, with the whole anti-overfitting
    argument behind it - HAS NO PRODUCTION CONSUMER. The set is closed in practice however the gate rules.
    THE DECIDING PATH AND THE ADVISORY PATH ARE NOT THE SAME PATH, which is a defect class this project
    has paid for before, now found inside Legasus's own authority core.

    So the producer #2 repair may have MOVED the failure rather than removed it: a coordinate the producer
    cannot establish is now absent instead of invented, but a coordinate the producer CAN establish and
    Legasus has no name for still has nowhere to go and no path to earn a name.

    next         freeze the producer #3 predictions BEFORE selecting a candidate, with a selection rule
                 that actually discriminates - the P2 ordering clause tied on all five candidates and the
                 lexicographic tiebreak made that choice.

---
