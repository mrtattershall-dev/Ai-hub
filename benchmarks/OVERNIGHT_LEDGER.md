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
## Entry 11 — r4: producer #3 (pytest). The closed dimension set REPORTED A CONTRADICTION AS AGREEMENT

    objective    the one justified investigation from Entry 10: is scope construction producer-agnostic,
                 or merely doctest-UNION-git shaped?
    authority    P3-SELECTION and predictions P3-1..P3-10, frozen ALONE in 0baca08 before any candidate
                 was named
    start hash   17edf5e (pre-repair state committed separately, before any repair existed)
    evidence     benchmarks/producer3-selection.mjs, legasus/legaexternal/pytest-producer.mjs,
                 legasus/legaexternal/producer3.test.mjs (12 tests), benchmarks/RESULT.producer3.md

    RESULT   P3-1..P3-7 HELD pre-repair; P3-8, P3-9, P3-10, P3-10b HELD post-repair.
             456 tests, 456 pass. Frozen r3 numbers re-run unchanged: 56/56, 44/44, 142/142,
             subsumption 56/56 and 51/51.

    SELECTION HALF-WORKED AND THAT IS RECORDED. The replacement ordering criterion - FOREIGN-COORDINATE
    COUNT - spread 2 / 1 / 0 where P2's saturated at 7/7 for every candidate, and the eligibility filter
    did visible work (sqlite3 scored 2 foreign coordinates and was refused for not being a fact Legasus
    has reason to consume). But three candidates tied at 2, the git tiebreak saturated at 7 among them,
    and THE LEXICOGRAPHIC TIEBREAK DECIDED A SECOND TIME.
    P3-SELECTION-ORDERING = DISCRIMINATING BUT NOT DECISIVE.
    And the ranking is MY coordinate assignment; every arguable coordinate was resolved CONSERVATIVELY,
    which biases against the hypothesis the experiment wanted to confirm.

    THE FOREIGN COORDINATE IS DEMONSTRATED, NOT ASSERTED.

        pytest test_cohort.py::test_b      test_b PASSED
        pytest test_cohort.py              test_b FAILED

    Same nodeid, same bytes, same interpreter, same criterion. Only the COLLECTION COHORT differs - a set
    test_b is not the only member of, named by none of the six.

    THE DISCOVERY, WHICH THE PREREGISTRATION DID NOT PREDICT AND WHICH IS THEREFORE NOT COUNTED AS A
    CONFIRMED PREDICTION. The prereg predicted a silent DROP and that held. This is worse:

        native results   PASSED vs FAILED      scopes  IDENTICAL on all six
        joinConflicts    []                    covers  ok: true

    THE CLOSED DIMENSION SET DID NOT MERELY LOSE INFORMATION - IT REPORTED A CONTRADICTION AS AGREEMENT.
    A dropped coordinate is a gap; this is a gap that MANUFACTURES CONSENSUS, and a ledger built on it
    would record two incompatible verdicts as mutually supporting.

    THREE APPARATUS FAILURES OF MY OWN, ALL INSIDE THE REPAIR.
      1. THE FIRST REPAIR PASSED ITS OWN TESTS WHILE THE DEFECT SURVIVED ONE LAYER UP. I fixed scope() to
         record rather than drop - and the ADAPTER discarded collectionCohort before scope() ever saw it.
         The suite went green at 452/452 with the contradiction fully intact. Found by EXECUTING the
         pipeline end to end, not by reasoning about it. Fix the DECIDING path, not the advisory one -
         a lesson already paid for here, re-learned inside the fix for that same lesson.
      2. My scope() merge FILTERED OUT the UNADMITTED key to avoid nesting, silently discarding everything
         the adapter had just carried. The same defect wearing a third face.
      3. pluginSet carried a MEMORY ADDRESS - list_name_plugin() names some entries str(id(obj)) - so the
         coordinate changed every run. A distinction manufactured out of a heap pointer, which is exactly
         the accidental difference the anti-overfitting law exists to refuse. Caught only because a
         failing test printed the value.

    THE REPAIR MAKES THE GATE THE ONLY DOOR. admissibility.mjs had always held admitDimension, registry,
    comparisonDefeat and discriminatingProjection, with the entire anti-overfitting argument behind them,
    and NOTHING CONSUMED ANY OF IT. Now scope(), covers() and joinConflicts() read the ACTIVE REGISTRY;
    an unmapped coordinate is RECORDED under UNADMITTED, never dropped; UNADMITTED is NOT READ by covers()
    or joinConflicts(), so recording a difference can never become an excuse for refusing to compare;
    admitScopeDimension() is the only way in, requires the entry to declare its CONTEXT/SUBJECT side
    because law 5 turns on that split, and REFUSES WITH A REASON while changing nothing; and admission
    PROMOTES a coordinate already being carried, with no re-observation and no rewriting of any record.

    THE PAYOFF: once collectionCohort is admitted on pytest's documented fixture semantics, the two
    verdicts STOP BEING A CONTRADICTION. They become claims about DIFFERENT SUBJECTS, refused a comparison
    for a stated, independently argued reason. That is what the architecture always claimed and had never
    implemented.

    NOT ESTABLISHED. Three producers is not "generic" - it is two bends and two repairs. The six still
    cannot explain the pytest contradiction on their own; the repair built the DOOR, it did not add a
    dimension, and nothing here argues collectionCohort should be standing. The MUTABLE MODULE-LEVEL
    REGISTRY is a real hazard, named in the source rather than hidden. win32, pytest 9.1.1.

    AND REPO D IS NOW FURTHER AWAY, NOT CLOSER. This is another architecture change, and the frozen burn
    rule says r4's prospective test cannot begin while r4 is still changing. Every repair tonight has
    extended that block. That is a cost, and it is recorded as one.

    next         re-run the QUIESCE check against the new state rather than assume the answer.

---
## Entry 12 — QUIESCENT. The system is entitled to stop, and one item is OWNER_REQUIRED

    objective    re-run the quiesce check against the post-producer-#3 state, as Entry 11 required,
                 rather than assume the answer
    authority    legasus/legaknow/stopping.mjs
    start hash   d2cda02
    evidence     benchmarks/quiesce-check.mjs, re-run

    VERDICT   QUIESCENT_CONTEST. Six open questions, ZERO justified, no objectives generated.
              THE SYSTEM IS ENTITLED TO STOP INVESTIGATING - a positive finding about entitlement, and
              not a failure to try hard enough.

      POSIX_FORK_INHERITANCE          not executable   the PLATFORM (measured: no os.fork on win32)
      REPOC_UNRESOLVED_ATTRIBUTION    not executable   INFORMATION DESTROYED AT COLLECTION TIME. 49/7/1
                                                       is permanent, not pending.
      REPO_D_PROSPECTIVE_VALIDATION   not executable   SEQUENCING under the frozen burn rule
      PRODUCER_3_SCOPE_VOCABULARY     RESOLVED         kept in the list rather than deleted: a question
                                                       that vanishes cannot be audited against what it
                                                       returned
      PRODUCER_4                      no outcome       see below
      FREEZE_R4_AND_SELECT_REPO_D     NOT AUTHORIZED   OWNER_REQUIRED, see below

    PRODUCER #4 IS THE TREADMILL, AND THE FOURTH CONDITION IS WHAT REFUSED IT. Everything about it was
    available - trace and timeit were the runners-up in the very selection that chose pytest, and an hour
    would have built one. But the producer #3 repair is GENERIC IN MECHANISM rather than per-coordinate:
    scope() carries EVERY unmapped coordinate without naming any of them, so a fourth producer takes the
    same path pytest's took, by construction. And the two questions a fourth producer COULD have raised
    were both asked directly and far more cheaply - L7 name-collision aliasing and L5 registry leakage -
    and both found REAL defects. An expensive investigation is not justified when a cheaper operation
    targets the same distinction. This is the loop the stopping law was written to stop, and tonight is
    the first time it actually stopped one.

    FREEZE_R4_AND_SELECT_REPO_D IS OWNER_REQUIRED AND IS RECORDED RATHER THAN GUESSED AT. It is the only
    remaining operation that could decisively change what may be claimed, and it is outside delegated
    authority for two independent reasons. Selecting Repo D BURNS it - once r4 has been exposed to a
    repository, that repository can never again serve as its prospective test, and no later work undoes
    that. And it is a declaration that r4 is FINISHED, which tonight repeatedly showed it is not: two
    defects were found inside a repair written hours earlier.

    THE HONEST SHAPE OF THE NIGHT. Every blocked question is blocked by the PLATFORM, by INFORMATION
    DESTROYED IN THE PAST, by SEQUENCING, by EPISTEMIC POINTLESSNESS, or by OWNER AUTHORITY. Not one is
    blocked by lack of effort, and not one is unblocked by working harder tonight.

    next         NONE. A quiescent contest generates no objective. Emitting one here is how a loop runs
                 forever.

---
## Entry 13 — the OWNER decision, and two things preserved against being summarised away

    objective    record the owner's ruling on the one OWNER_REQUIRED item, and preserve two results that
                 a final-state summary would erase
    authority    OWNER, 2026-09-20 00:43
    start hash   02c02bb

    FREEZE_R4_AND_SELECT_REPO_D — NOT AUTHORIZED. Recorded with the owner's stated reason, which is
    sharper than the one this ledger gave:

        "The reason isn't simply that two defects were found recently. It's that tonight demonstrated
         something more diagnostic: THE REPAIR SURFACE IS STILL PRODUCING NEW AUTHORITY BUGS WHEN
         EXERCISED COMPOSITIONALLY. A unit-level green suite reached 452/452 while the original
         contradiction remained alive one layer above it. Then the repaired representation itself
         produced an L2-style alias through a matching string. Those are signs that r4 is still yielding
         information under adversarial development."

    The distinction matters for WHEN the block lifts. "Two recent defects" would lift on a quiet night.
    "Still yielding information under adversarial development" lifts only when adversarial development
    STOPS producing findings - a measurable condition, not a mood.

    ALSO NOT AUTHORIZED: publishing any outward-facing page. The development record stands as the record.
    The owner's reason is the burn rule seen from the outside: a public page is only meaningful AFTER
    Repo D, because the most consequential question is deliberately still unanswered - DO THESE R4
    REPAIRS TRANSFER PROSPECTIVELY TO A REPOSITORY THAT PLAYED NO ROLE IN CREATING THEM?

    ------------------------------------------------------------------------------------------------
    PRESERVED #1 — THE 452/452 STATE. IT IS EVIDENCE, AND 464/464 MUST NOT REPLACE IT HISTORICALLY.

        452/452 GREEN, and the original contradiction SURVIVES
          -> PIPELINE-LEVEL FALSIFICATION: the repair was real and UNREACHED. scope() recorded what it
             was handed; the ADAPTER discarded the coordinate before scope() was ever handed it.
          -> repair the ACTUAL DECISION LAYER
        REPRESENTATION-LOSS DEFECT: the merge filtered out the UNADMITTED key, silently discarding
        everything the adapter had just carefully carried
          -> repair
        AUTHORITY-ALIAS DEFECT: a carried coordinate named history, meaning something else entirely,
        acquired the declared history dimension's authority because two STRINGS MATCHED. L2 inside the
        repair written to stop coordinates being mishandled.
          -> repair
        464/464

    WITHOUT THAT SEQUENCE, "464 TESTS PASS" RADICALLY UNDERSTATES WHAT THOSE TESTS NOW MEAN. A green
    suite is not evidence that a pipeline is correct; it is evidence about the propositions someone
    thought to assert. The 452/452 state is the counterexample to its own reassurance and is kept in the
    record permanently, at 8b694ad and d2cda02.

    ------------------------------------------------------------------------------------------------
    PRESERVED #2 — 49 / 7 / 1 IS A SUCCESSFUL EPISTEMIC OUTCOME, NOT UNFINISHED BOOKKEEPING.

        UNRESOLVED ATTRIBUTION is not a task waiting for a sufficiently clever agent.
        It is the MAXIMALLY JUSTIFIED TERMINAL STATE of that evidence.

    The collection procedure destroyed the distinguishing coordinate before the last-wins map ever ran.
    No amount of later intelligence recovers information that was never recorded. Mechanized rather than
    left as prose: every entry in quiesce-check.mjs now carries a BLOCK CLASS, and this one is TERMINAL -
    "UNBLOCKS NEVER. Do not re-attempt." PLATFORM unblocks on a different host, SEQUENCING when the
    sequence advances, OWNER on an owner decision. TERMINAL unblocks never, and conflating it with the
    others is how an agent spends days reconstructing information that no longer exists.

    ------------------------------------------------------------------------------------------------
    AND ONE OBSERVATION ABOUT THE PYTEST RESULT, in the owner's framing, because it names a class this
    ledger had not named. The earlier failures mostly LOST A DISTINCTION and accidentally GAINED
    AUTHORITY. This one is the dual symptom at the RELATION layer:

        AN INCOMPLETE COORDINATE SYSTEM CAN MANUFACTURE A FALSE RELATION BETWEEN OTHERWISE FAITHFULLY
        REPRESENTED EVIDENCE.

    The system did not report UNKNOWN. It POSITIVELY REPRESENTED A COMPATIBILITY THAT DID NOT EXIST. The
    resolution is the three-state split the UNADMITTED repair introduced - absent /
    observed-but-unadmitted / admitted - separating WE OBSERVED A DISTINCTION from THIS DISTINCTION IS
    AUTHORIZED TO AFFECT THIS DECISION. Preserving a difference without granting it comparison authority
    is what resolves the standing tension between information preservation and anti-explanation
    overfitting.

    next         NONE. The state is QUIESCENT and the only remaining transition is OWNER_REQUIRED and has
                 been explicitly declined. The next useful information requires a fresh world, not
                 another internal idea.

---
## Entry 14 — a DEFERRED question, recorded because preregistration only works before the experiment

    status       NOT AN OBJECTIVE. This generates no work and does not reopen the quiescent contest.
    authority    OWNER, 2026-09-20, explicitly declining to codify it now
    start hash   62c0a2e

    WHY IT IS WRITTEN AT ALL. It is a question ABOUT Repo D, stated before Repo D exists or has been
    authorized. That is the only moment at which writing it down is worth anything; written afterwards it
    would be a rationalisation of whatever happened. The conversation is not the evidence record - a
    transcript is weaker than console output, and this project already holds that console output is
    non-evidentiary.

    THE OBSERVATION. Law 7 did not behave as a brake tonight. It behaved as an EXPERIMENTAL-EFFICIENCY
    CONSTRAINT:

        expensive experiment is not justified
          -> identify the DISTINCTION it was supposed to resolve
          -> perform a CHEAPER authorized experiment capable of changing the SAME entitlement

    Producer #4 was refused, and the two questions it could have raised were asked directly instead -
    L7 name-collision aliasing and L5 registry leakage. Both found REAL defects.

    THE EMERGING SECOND CLAUSE, stated by the owner and DELIBERATELY NOT CODIFIED:

        among actions capable of resolving the distinction, why perform a more expensive one?

    It is not a law. The question for Repo D is whether Repo D INDEPENDENTLY DEMANDS it.

    AND A HAZARD IN IT THAT TONIGHT DID NOT TEST, recorded now so a later run cannot mistake tonight for
    evidence that the clause is safe. THE TWO CHEAP PROBES WERE DECISIVE BECAUSE THEY FOUND SOMETHING.
    A cheap probe that finds NOTHING is not equivalent evidence to an expensive one finding nothing:

        cheap probe FINDS a defect      -> conclusive, and the expensive experiment was unnecessary
        cheap probe finds NOTHING       -> NOT conclusive. It may simply be the weaker instrument.

    So the clause as stated is sound only in the positive direction, and tonight supplies evidence for
    exactly that direction and none for the other. A cost-minimising rule that treats a cheap null result
    as a substitute for an expensive null result would be manufacturing entitlement out of a BUDGET, which
    is the same error this architecture refuses everywhere else. If the clause is ever codified it needs a
    POWER condition, not just a cost comparison - and nothing here establishes one.

    IF AND WHEN Repo D is authorized, this belongs in its PREREGISTRATION, as a question, with the above
    asymmetry stated in advance.

    next         NONE. Still QUIESCENT. Still one OWNER_REQUIRED transition, still declined.

---
## Entry 15 — r4 development under composition attack: 21 predicted defects reproduced, 2 predicted non-defects held, 0 falsified

    objective    attack the hypothesis that individually justified inputs plus an authorized relation
                 can produce output authority the joint evidence does not support; repair only what a
                 preregistered attack reproduced; recompute the frontier after each slice
    authority    OWNER, 2026-09-20: active r4 development. r3 immutable, Repo D unselected and
                 uninspected, nothing published. Every boundary held.
    start hash   aa03ab9 (clean, 464 pass, QUIESCENT_CONTEST reproduced by execution before any change)
    end hash     the commit carrying this entry; 25 commits; clean tree; 553 pass; QUIESCENT_CONTEST
    evidence     COMPOSITION_PREREG.md / RESULT.composition.md (wave 1, a62b1c4 / b11e51f)
                 COMPOSITION_PREREG_2.md / RESULT.composition-2.md (wave 2, 80724ba / b0673cd)
                 COMPOSITION_PREREG_3.md / RESULT.composition-3.md (wave 3, 7c49fae / 32b0207)
                 PYTEST_MAPPING_PREREG.md (9704145), retirement-constraints.mjs (a0b48e6)
                 every attack file at the commit that ran it asserts the DEFECT; the same file after the
                 repair asserts the REPAIR and keeps every control

    THE METHOD, so it can be judged. Each wave: read the relation-producing operations, derive
    predictions, freeze them in a commit that contains nothing else, write attacks asserting the
    predicted defect beside a control that refuses the neighbouring case, run once, preserve the raw
    run before touching any implementation, repair in separate commits with the attack flipped to a
    regression plus an admit control, run the focused tests, the whole suite, and every historical
    rig that consumes the changed module against a baseline captured before the change.

    THE RESULT, in the hypothesis's own terms. The class is REAL and it is GENERAL: twenty-one
    instances in deciding paths, beyond the pytest case that motivated it, and none needed a new law.
    Every one was an implementation admitting what a stated invariant already forbade:

      LAW 5 (compose only over a compatible world)
        C1   a never-established intermediate laundered S1 into S2 through entitled(); the direct
             edge was refused, the three-node chain admitted. Repaired: a premise must COVER its
             conclusion on every context dimension; ANY_OF alternatives too.
        C2   the calculus read absence as "for all", the graph as "never established". One meaning now.
        W3-c a grant over S1 was delegated over every world. Context now narrows like the grant.
      LAW 2 (authority does not transfer by changing the referent)
        C7   node identity excluded scope, so add() moved the referent under existing dependents
        C4   an admission keyed by NAME let a pytest-argued dimension govern git records
        W2-a a refuter at S2 refuted a claim about S1
        W2-b reestablish() rewrote a scope the identity now encodes
        W2-g the adapter granted doctest's semantics to any producer whose word matched
        W3-d narrow() moved an established world under restriction's free pass
      LAW 3 / L6 (evidence is not permission; permission roots at OWNER)
        W3-e commit() consumed an OBSERVE token - evidence acted; tracesToIndependentRoot existed
             and nothing called it
        W3-f derive() minted NORMATIVE-with-grant or not, by argument ORDER
      LAW 1 / LAW 4 (nothing from information loss; adapters do not invent)
        C8-a the provenance ledger kept the LAST binding per digest - Entry 5's map, inside the
             module written to fix it     C8-b the seal covered digests, not attributions
        W2-e "pytest undefined" and "undefined undefined" as criteria
        W2-f producer #1 gave IMPORT_FAILED records a document and an ARRAY INDEX as ordinal, and so
             a history for no experiment - the producer #2 strain, in producer #1 all along
        C3   the authority brand was a Symbol readable off any real token; a forgery traced to OWNER
      THE UNADMITTED CONTRACT (Entry 11)
        C5   the reserved key was admissible and then manufactured NOT_COMPARABLE
        C6   a shadowed carried value vanished
      THE STOPPING LAW
        C9-a an irrelevant pending string held the contest OPEN with zero objectives, forever
        C9-b TERMINAL was measured by PATH: a regenerated external.json would have flipped it and
             silently replaced the evidence. Now pinned to the recorded digest.
      THE RATCHET / PREFERENCE
        W2-c a STALE witness was still an execution edge and scored ADVANCEMENT
        W2-d an unmeasured behavioural metric read as EQUIVALENT on the Pareto frontier
      VOCABULARY
        C10  OBSERVATION_DIMENSIONS listed history twice; removed

    FALSIFICATIONS, kept. Zero of 21 defect predictions failed and both no-defect predictions held
    (covers() transitive over 4,096 triples; the ledger not reconciling across worlds by recency).
    Stated plainly: read-derived predictions reproducing is what accurate reading yields and is not
    evidence the reading is complete; two no-defect probes on simple mechanisms are a favourable and
    THIN calibration. The program has not yet falsified my model of the code. What DID fail:
      - the first flip of W2-d: repairing compare() alone left the unmeasured candidate on the
        frontier, because INCOMPARABLE is not DOMINATED. Kept in the test; paretoFrontierReport()
        excludes with a record.
      - my own wave-1 control C3-b asserted that narrowing repository S1 to S2 mints - it enshrined
        W3-d as a positive control. A positive control that enshrines a defect is how a defect
        survives a repair. Kept in the test as a comment.
      - the first retirement scanner reported all six candidates retirable; score-constraints.mjs
        loads './constraints.mjs' from an argv DEFAULT, a dynamic path no import scan sees. Found by
        hand after a disagreement with a plain grep. R4 is now a string scan. Two candidates stayed.
      - two existing tests asserted defects as behaviour and were changed with the reason beside
        them: calculus.test's PROPOSE/COMMIT (committed on evidence) and HONEST RESIDUE (same);
        external.test's NON-INVENTION pair used a placeholder producer under doctest's mapping,
        which IS W2-g.
      - apparatus: hazard 1 occurred three times in one hour while recording the previous one - a
        commit message line wrapped onto a leading hash (git drops it as a comment; the guard fired
        and blamed the shell, and now names the cause), a probe regex collapsed in node -e, and five
        heredocs in one shell call failed to parse. HAZARDS.md 14-16. The mechanism, not the rule.
      - the m42 commit swallowed four staged deletions from the index; caught on the next status,
        soft-reset and recommitted with only its own files before anything was built on it.

    AUTHORITY WITHOUT CONSTRUCTOR ANCESTRY. The calculus has NO production consumer (measured; the
    Entry 10 scan's hit on quiesce-check is the string in its own file list). Its brand was
    recoverable (C3, now a WeakSet); commit() consumed evidence (W3-e); delegate() widened worlds
    (W3-c). All closed as representation; none protects a path that does not ask, and no path asks.
    delegate({from: 'OWNER'}) remains callable by any code: OWNER_REQUIRED is enforced by procedure,
    not by the runtime, which is the axiom of REPO_C_PROTOCOL §unresolved 1 seen from inside.

    DELETED. constraints2.mjs, constraints4.mjs, constraints5.mjs, opcontext2.mjs (1,097 lines):
    no importer, no code reference, each named once by the frozen record of its own revision, which
    stays interpretable as text with the code at 7c49fae. R6 control: constraints6 and opfacts read
    LIVE. constraints.mjs and score-constraints.mjs stay together: the latter is the argv-default
    consumer of the former and the instrument behind a measurement README the sidecar does not
    cover. OBSERVATION_DIMENSIONS removed. Net legasus source 28,243 -> 27,654 lines with eight new
    modules and test files added.

    EVIDENCE THREATENED AND REVALIDATED. Eight rigs baselined before the first change and re-run
    after every slice, byte-identical throughout: shadow-graph 56/56 44/44 142/142;
    graph-subsumption 56/56 51/51; shadow-perturbation table; r2-subsumption 7/7;
    intervention-tracking 70/70; obligation-topology S1 58/59 (pre-existing) S2 60/60 S3 119/119;
    region-frontier 512/779; purpose-connectivity P1-P3 HELD. FREEZE-GATE ten refusals, nine
    admissions, unchanged. Conformance audit on revision 6: its one FAIL is the recorded
    scopecont/j01:op3. PROVENANCE.json regenerated once (58b62aa): every record byte-identical, only
    the seal formula changed, old seal in history. The frozen r3 numbers are untouched.

    OPENED AND RESOLVED. PYTEST_MAPPING: pytest evidence had never derived a claim (W2-g's finding).
    Preregistered, six predictions held, mapping declared for its producer. The Entry 11 payoff now
    has assertions: the cohort's two verdicts are comparable and CONTRADICTORY before admission and
    incomparable after. E6 holds for producer #3.

    ENTRY 14, REPRESENTED. instruments.mjs: SUBSUMES only when every class the weaker detects, the
    stronger detects WITH A WITNESS; UNKNOWN on any missing witness; a cheap finding stands on its
    own. Applied once where classes come from executed refusals: the freeze gate and the composition
    suite subsume neither the other - the historical fact that 464/464 was green with twenty-one
    defects live, said by the representation. The classes for the rigs are UNKNOWN (below).

    REMAINING, by class (quiesce-check.mjs, re-run at this commit)
      TERMINAL        REPOC_UNRESOLVED_ATTRIBUTION - now pinned to the recorded bytes
      PLATFORM        POSIX_FORK_INHERITANCE
      SEQUENCING      REPO_D_PROSPECTIVE_VALIDATION
      EPISTEMIC       PRODUCER_4
      UNKNOWN         INSTRUMENT_CLASSES_FOR_THE_RIGS - new class, added rather than forced into
                      BLOCKED or TERMINAL; generates no work
      OWNER_REQUIRED  FREEZE_R4_AND_SELECT_REPO_D - unchanged, and this session's answer to the
                      owner's own criterion ("still yielding information under adversarial
                      development") is YES: every wave found new authority defects in deciding paths.
                      r4 is not finished by that test.
      RESOLVED        PRODUCER_3_SCOPE_VOCABULARY, PYTEST_MAPPING (kept in the list)

    QUIESCENCE. Re-run after the last repair: QUIESCENT_CONTEST, zero objectives. Attacked as asked:
    an irrelevant pending item can no longer stall it (C9-a); a regenerated artifact can no longer
    flip TERMINAL (C9-b); an UNKNOWN question now has a place that is neither. Work stops because the
    remaining questions are terminal, platform-bound, sequenced behind the owner's decision,
    epistemically pointless, unknown, or owner-required - not because the attacks ran dry: the
    frontier recomputed after wave 3 yields no case I can name against a stated invariant, which is
    the honest reason and also the weakest one, since three waves in a row found cases the previous
    wave had not.

    REPO D READINESS, prerequisites only, no repository named or inspected. (1) The owner's
    criterion is measurable and currently says NOT READY. (2) A prospective run needs the four
    measurements separate, an undefined precision reported as undefined, unresolved attribution
    reported as its own count, and apparatus-invalid as an outcome. (3) It needs the pytest mapping
    and the UNADMITTED admission of collectionCohort argued in the preregistration, not at run time.
    (4) It needs the instrument-subsumption question stated as a question (Entry 14) with the
    asymmetry in advance. (5) Every wave's attack suite runs green at the freeze, and the freeze gate
    is known NOT to subsume it.

    next         NONE. QUIESCENT. One OWNER_REQUIRED transition, and this session's evidence argues
                 against taking it yet.

---
## Entry 16 — the owner reviews Entry 15, and two standing claims are narrowed

    objective    record the owner's review of the composition session, and correct what it showed to
                 be overstated - in the code where the claims are made, not only in prose
    authority    OWNER, 2026-09-20, reviewing Entry 15
    start hash   4f93a79
    evidence     PROVENANCE_RELATION_PREREG.md / RESULT.provenance-relation.md (554440f / fefb29d),
                 legaknow/stopping-scope.test.mjs, quiesce-check.mjs

    THE STOPPING LAW'S CLAIM WAS NARROWER THAN ITS NAME, and the owner named the gap:

        ESTABLISHES        no objective FORMULATED in the frontier is justified
        DOES NOT ESTABLISH that no justified objective exists

    The frontier can be perfectly correct over the questions it holds while being incomplete over the
    questions that could be asked. There may be no complete solution to the second problem; the
    defect was never having said which one law 7 reaches. Entry 15's own closing sentence had found
    it - "no more cases I can name is the honest stopping reason and also the weakest one" - and left
    it as prose in a report rather than as a bound on the verdict.

    MECHANIZED, because a bounded claim quoted without its bound is an unbounded claim. Every
    contestState() result now carries `establishes` and `doesNotEstablish`; quiesce-check prints both
    beside the verdict, with this project's own evidence that the gap is not pedantic: on 2026-09-20
    the check said QUIESCENT with zero objectives, and three preregistered waves then found
    twenty-one authority defects in deciding paths, each after the previous had gone green. The
    verdict was correct every time over the questions it held. It was silent about the rest.

    It adds NO objective. "Is the frontier complete?" is not an investigation with an outcome, and a
    stopping law that emitted one there would be the loop it forbids. A test asserts that the
    qualification changed no state and no objective it qualifies.

    PROVENANCE IS A RELATION, NOT A FUNCTION OF CONTENT, and the C8-a repair said otherwise. bind()
    asserts "this content was produced by this implementation" and the module decided that identical
    bytes at another path retain provenance; the repair inherited that and declared two attributions
    for one digest to be CONTESTED. But identical bytes can legitimately arise through several
    histories - three pyparsing files in repoC/IDENTITY.json already share the empty-file digest - so
    "A produced these bytes" and "B produced these bytes" can BOTH BE TRUE.

    AND THE WORD CARRIED AN OBLIGATION IT COULD NOT DISCHARGE. ledger.mjs LAW 3 defines CONTESTED as
    contradicting live claims that block reliance AND OWE AN EXPERIMENT. No experiment separates two
    tools that each emitted an empty file. That is composition attack C4 - a state acquiring a
    declared word's authority because the strings matched - committed by me inside the repair for C8,
    and found by the owner reviewing the repair rather than by its author. The session's own finding,
    applied to the session's own work, from outside it.

    Bounded by its own controls: PR-4 showed the ENTITLEMENT was already right - neither state ever
    attributed to one producer - so only the relation's description moved. MULTIPLY_BOUND states what
    is known and why nothing stronger is available: the digest is the only identity here, so this
    ledger cannot tell two legitimate histories from one damaged record. CONTESTED is removed from the
    module rather than renamed into it; a conflict claim needs evidence the content had ONE history,
    and where that check belongs is recorded as UNKNOWN rather than invented. LATENT, not live: 21
    artifacts, 21 distinct digests, and the sidecar regenerates to a byte-identical seal.

    THE 21/21 READING, corrected to the owner's framing. Entry 15 called the calibration "favourable
    and thin". Sharper: the hypotheses were formed AFTER inspecting the implementations, so these are
    not 21 independent tests of the architecture. The defensible statement is

        given architectural inspection, the current invariants were powerful enough to predict
        numerous concrete implementation violations, and those predictions survived execution

    and NOT "21 prospective tests independently validated the architecture". Prospective pressure
    begins at Repo D and nowhere earlier.

    THE CALCULUS IS AN EXECUTABLE SPECIFICATION, NOT AN ENFORCEMENT BOUNDARY. Entry 15 recorded that
    it has no production consumer; the owner's framing is the consequence. commit-requires-rooted-
    permission, delegation-cannot-widen, derive-is-epistemic and narrow-cannot-move are properties OF
    THE CALCULUS, not of every production path, until production decisions consume those objects.
    Nothing stops other code from deciding and writing. And OWNER is a semantic convention while
    delegate({from: 'OWNER'}) is callable by anyone. Recorded as the edge of the evidence, not
    repaired: wiring the calculus into a deciding path is architecture work that would want its own
    preregistration, and is not started.

    INSTRUMENT CLASS BOUNDARIES. The owner names the remaining danger correctly: one witnessed member
    of a broadly named class must not establish power over the whole class. instruments.mjs requires a
    witness per class and says UNKNOWN without one, which is the guard; it does not police how broadly
    a class is named. That is why the rigs' classes are left UNKNOWN rather than enumerated.

    REPO D REMAINS OWNER_REQUIRED AND NOT YET, on the owner's sharpened criterion: not "recent repairs
    found defects" but "three newly preregistered adversarial waves each exposed additional authority
    defects after the previous wave went green" - measurable evidence that the repair surface has not
    exhausted its defect yield. The stopping law having no justified objective does not make the
    architecture ready; those are different authorities, and only one of them is the owner's.

    WHAT WOULD EVENTUALLY LIFT IT, recorded as a shape and not started: a precommitted adversarial
    challenge procedure, bounded in budget, that itself stops producing authority violations - and,
    per Entry 14, a null from that procedure means something only to the extent its coverage or power
    is independently established. Otherwise the budget becomes the entitlement again. That recursion
    is real and is recorded as real.

    next         NONE. QUIESCENT, now with its bound printed beside it.

---
## Entry 17 — a named defect class, and Entry 16's own repair leaking one function downstream

    objective    test the owner's claim that the Entry 16 bound must survive consumption, and name the
                 class both of the last two findings belong to
    authority    OWNER, 2026-09-20, reviewing Entry 16
    start hash   d188998
    evidence     STOPPING_SCOPE_PREREG.md / RESULT.stopping-scope.md (0018592 / 77fd921)
                 legaknow/stopping-consumption-attack.test.mjs

    THE CLASS, in the owner's words and worth a name:

        CORRECT OPERATIONAL BEHAVIOUR, INCORRECT OR ABSENT ACCOUNT OF WHY IT IS JUSTIFIED

    Not "the system believed something false" and not "the system did something wrong". The decision
    was conservative and right; the REASON TOPOLOGY attached to it was wrong. That is dangerous on a
    delay, because explanations are inputs to later machinery. The provenance case shows the shape
    exactly: the module already refused to attribute to one producer, and a consumer meeting
    CONTESTED could legitimately conclude "experiment owed, block reliance, generate a resolution
    objective" - a future behavioural bug born from a present-day safe verdict with a wrong reason.
    This is why the project has measured reason topology and not PASS/FAIL since Repo C, and it is
    now a class with two members rather than an instinct.

    AND ENTRY 16'S REPAIR WAS ITSELF A MEMBER. The bound was attached to the verdict and followed no
    further. Three sites, measured:

        objectivesFromContest   the artifact PURPOSE consumes - dropped both fields
        nextAction              the same shape of claim, over a CALLER-SUPPLIED candidate list,
                                with no bound it had ever had
        evidenceFrontier        CLOSED means every producer on a DECLARED list was attempted, and
                                said "every required producer was attempted"

    SC-2 IS THE RESULT, AND IT IS THIS PROJECT'S OWN INSTRUMENT FIRING ON THIS PROJECT'S OWN API ONE
    COMMIT AFTER IT WAS WRITTEN. informationMonotonicity, rich = the bounded verdict, erase =
    objectivesFromContest, consumer = concludes no justified investigation exists:

        ok false   gained ['concludes no justified investigation exists']
        FORBIDDEN TRANSITION ... Authority was manufactured out of information loss.

    Law 1, at an API boundary, against a repair for a Law-7 overclaim. Non-vacuity asserted in the
    same test - the consumer is refused on the rich state and granted on an unbounded artifact - and
    the regression additionally proves the instrument still FAILS against an erasure that really
    drops the bound, so a green result means the permission was withheld rather than never available.

    SC-4 IS THE DEEPER HALF AND THE OWNER DID NOT NAME IT. The completeness gap Entry 16 found at the
    CONTEST layer already existed at the FRONTIER layer and was inherited upward: `requiredProducers`
    is an INPUT, and in quiesce-check it is three hand-written strings. Entry 16 said the frontier is
    a set of questions someone wrote down. The evidence requirement is a set someone wrote down too,
    and the check now prints that second bound beside the first with the list this run declared.

    REPAIRED: each artifact carries the bound belonging to ITS OWN claim - the objectives list
    inherits the verdict's verbatim (a projection does not restate), nextAction states one about its
    candidates, the frontier states that its requirement list is an input. No verdict changed; SC-5
    asserts every state and objective list is what it was.

    THE RESIDUAL IS ASSERTED RATHER THAN PROMISED. A test pins that `state` is still a bare string, is
    still readable alone, and that a consumer comparing only it regains the inference. The pipeline no
    longer erases the bound; a reader still can. Making the state unreadable without its bound would
    change every comparison in the freeze gate and is not started.

    ON FREEZING r4, the owner's formulation is adopted as the shape, including its limit: no finite
    procedure establishes that no important failure class was left unimagined, so the decision cannot
    become PROVEN SAFE. What it can become is a predeclared challenge procedure with independently
    established coverage over NAMED failure classes, completed under a fixed budget without finding
    another defect, with the residual outside that coverage recorded as explicit UNKNOWN - and the
    owner deciding whether that residual is acceptable for burning Repo D. That is more rigorous than
    treating test exhaustion as completeness, and it is recorded as a shape, not started.

    next         NONE. QUIESCENT. The two findings since Entry 15 both came from the owner reading
                 the record rather than from the frontier, which is the completeness gap
                 demonstrating itself twice more.

---
## Entry 18 — TWO completeness gaps, the level actually earned, and a counterexample to this project's own compounding claim

    objective    answer two questions from the owner's review of Entry 17 by computation rather than
                 by agreement
    authority    OWNER, 2026-09-20
    start hash   543629e
    evidence     ATTAINMENT_PREREG.md (04d94f3), legaknow/attainment.test.mjs,
                 legaknow/vocabulary-collision.test.mjs, quiesce-check.mjs

    CORRECTION TO ENTRY 17. It called the frontier gap "the same gap one layer down". It is not. There
    are TWO gaps on different axes, and neither implies the other:

        QUESTION COMPLETENESS   what investigations have we FORMULATED?   (contestState)
        EVIDENCE COMPLETENESS   what producers have we DECLARED required? (evidenceFrontier)

    A frontier can be perfectly correct over questions [Q1,Q2,Q3] and producers [P1,P2,P3] while
    reality contains Q4 and P4, and nothing inside that computation can know either is missing. So
    CLOSED means closed over the DECLARED evidence requirements, never that the evidence space is
    complete. An open-world boundary, and now two of them.

    THE LEVEL ACTUALLY EARNED, computed against the real entries and weaker than QUIESCENT sounded:

        LEVEL EARNED : NO_CURRENT_OBJECTIVE
            YES               NO_CURRENT_OBJECTIVE
            no                FRONTIER_EXHAUSTED
            no                NAMED_COVERAGE_EXHAUSTED
            NOT_REPRESENTABLE COMPLETE

    Level 2 fails on exactly one of eight questions: INSTRUMENT_CLASSES_FOR_THE_RIGS is UNKNOWN-
    classed, which is NEITHER resolved NOR blocked - "nothing to do now" is not "nothing left open",
    and the UNKNOWN class added in Entry 15 is what makes the difference visible instead of hiding it
    in a block list. Level 3 fails because coverage needs an OUTSIDE witness and instruments.mjs
    reports the rigs' classes as UNKNOWN; `coverageEstablished` is passed null and UNKNOWN is never a
    quiet yes. Level 4 is NOT_REPRESENTABLE rather than false, because returning false would imply
    the question had been evaluated. AT-1 reads the live entries out of quiesce-check rather than a
    fixture, so the test measures the system and not my model of it.

    THE COMPOUNDING CLAIM IS FALSIFIED IN ITS STRONG FORM, BY THIS SESSION. C4 - authority
    transferred because two strings matched - was found and repaired at `a31046c`. FOUR COMMITS LATER,
    at `58b62aa`, the C8 repair exported `CONTESTED` from provenance.mjs against ledger.mjs's
    STATE.CONTESTED, whose LAW 3 meaning carries an obligation, and the obligation travelled. Same
    class, already called mechanized, recurred - and it took the owner's review two entries later to
    find it.

    THE REASON IS VISIBLE IN THE REPAIR: C4's guard is producer-keyed promotion INSIDE
    justification.mjs. It guards one mechanism. The ledger called it a class.

        MECHANIZING AN INSTANCE DOES NOT MECHANIZE ITS CLASS, and recording an instance repair as a
        class repair is how the next instance gets four commits of cover.

    THE WEAK FORM, WHICH IS ACHIEVABLE AND IS WHAT WAS BUILT. The cross-module state-word inventory is
    frozen at its measured seven, and AT-7 proves BY RECONSTRUCTION - not by argument - that adding
    `CONTESTED` back makes it the eighth: the guard would have fired at the moment the real defect was
    introduced. It classifies nothing. None of the seven standing collisions is a demonstrated defect;
    they are namespaced by their enum, and what made CONTESTED dangerous was that the word carried an
    OBLIGATION, which is not mechanically derivable - the same hand-authored boundary instruments.mjs
    already records. A new collision is surfaced FOR ARGUMENT. That is the owner's compounding
    property in the only form this session's evidence supports: not "the class cannot recur", but
    "the next instance is visible at introduction instead of in someone else's review".

    AT-8 FAILED ON ITS FIRST RUN AND IS KEPT. The innocuous-addition control used `HELD`, which is not
    in the scanned inventory at all - it lives in legaexternal/adapt.mjs, nested deeper than the scan
    reaches - so it asserted a collision that could not occur and failed for a reason unrelated to the
    guard. A control must be shown able to pass. Replaced with `ESTABLISHED`, measured as owned by
    exactly one module; and the failure produced AT-8b, which asserts the scan's blast radius is one
    directory and one nesting depth so a green inventory is never read as "no collisions anywhere".

    WHAT THIS DOES NOT CHANGE. No verdict moved: AT-5 asserts it, and the contest, the objectives and
    every block class are what they were. The frontier still holds one UNKNOWN question, Repo D is
    still OWNER_REQUIRED, and the level earned is still the weakest of the three establishable ones.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE, which is now the reported claim rather than
                 the implied one.

---
## Entry 19 — the ledger's own vocabulary was overclaiming, and the compounding thesis is narrowed to what survived

    objective    stop this ledger's taxonomy from impersonating a verification system, and state the
                 compounding claim at the strength the evidence supports
    authority    OWNER, 2026-09-20, reviewing Entry 18
    start hash   4cadc5e
    evidence     PROTECTION_PREREG.md (d0d307c), legaknow/protection.mjs, protection.test.mjs

    THE CONFLATION, in the owner's three terms:

        FAILURE PATTERN     conceptual similarity across incidents
        MECHANIZED REGION   the exact area in which a detector has DEMONSTRATED reach
        COVERED CLASS       a generalized class with INDEPENDENTLY JUSTIFIED coverage

    This ledger has been writing "mechanized" for the second and reading it as the third. That is
    precisely how C4 got four commits of cover, and at scale it is how a catalogue of named failures
    starts to read as a guarantee. The three are now representable, and the first thing represented
    was this project's own case.

    C4, WITH ITS REAL EVIDENCE, EARNS MECHANIZED_REGION AND NOT COVERED_CLASS:

        incidents     C4        an UNADMITTED runtime key took an admitted dimension's authority
                      C8-word   an exported state word took ledger.mjs LAW 3's obligation
        detectors     producer-keyed promotion   covers C4 only       (unadmitted-attack C4-a/C4-b)
                      frozen collision inventory covers C8-word only  (vocabulary-collision AT-7)
        observed      2/2        <- a RATIO beside the verdict, never the verdict
        disjoint      true       <- NO SINGLE detector reaches both
        class         UNKNOWN

    PT-1 IS THE FACT THAT HID THE OVERCLAIM. The two detectors are disjoint. The inventory guard
    cannot see the original C4 at all, because `collectionCohort` was a RUNTIME DATA KEY, not an
    exported state word - measured, not assumed. So the pattern is covered only as a UNION OF
    DISJOINT REGIONS, which is not a claim about the pattern, and the module prints that sentence
    rather than a ratio that flatters it.

    MEASURED, AND IT IS THE 452/452 SHAPE AT SMALL SCALE: twenty commits from introducing the
    CONTESTED defect to recording it, with SEVEN PASSING FULL SUITES in between.

    THE COMPOUNDING THESIS, RESTATED AT THE STRENGTH THAT SURVIVED. Not:

        every failure makes the system unable to make that failure again

    which this session falsified in four commits. Instead:

        every discovery should leave behind reusable protection WHOSE EXACT COVERAGE IS KNOWN, so
        repetitions INSIDE that coverage become cheaper to detect, diagnose or prevent

    A recurrence is therefore not automatically a failure of compounding - the question is whether
    the earlier discovery lowered the cost of the later one. For C4 the answer is honestly mixed: the
    first repair did not cover the provenance route, so the class was not eliminated; the accumulated
    machinery did make the recurrence RECOGNIZABLE as the same authority pattern when a reader met
    it; and there is now a detector that would have surfaced that specific cross-module form at
    introduction. Incremental, bounded, and stated with its bound.

    ONE DATA POINT IS REPORTED AS ONE DATA POINT. Detection distance for incident 2 was 20 commits
    and 7 green suites, and the inventory guard would make it 0 - for that incident only, and it says
    nothing about incident 1, which that guard cannot see. The owner named a family of long-run
    metrics (time-to-detection, compute, human analysis, distance from introduction, verified
    coverage, repeat escapes). NO FRAMEWORK IS BUILT OVER n=1: that would be the
    budget-becomes-entitlement error in a new costume, and the metrics are recorded as a shape.

    HISTORY IS NOT REWRITTEN. Entries 15-18 keep the word "mechanized" where they used it. The
    project's rule is that a record is not edited to match a later understanding; the distinction
    governs what is claimed from here, and this entry is the correction.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. Every finding since Entry 15 has come from
                 the owner reading the record rather than from the frontier, which is now four
                 demonstrations of the completeness gap rather than an argument about it.

---
## Entry 20 — LegaScreen v0 rediscovers a defect it was never told about, and COMPLETE gets its subject back

    objective    test the one premise the owner's screening proposal rests on, and correct an
                 overclaim of mine that the owner's own correction exposed
    authority    OWNER, 2026-09-20
    start hash   e977487
    evidence     LEGASCREEN_V0_PREREG.md / RESULT.legascreen-v0.md (8a4c1df / daf38b2)
                 legasus/legascreen/erasure.mjs, benchmarks/run-legascreen.mjs

    THE PROPOSAL AND WHAT WAS BUILT. The owner proposed LegaScreen: a high-sensitivity screen over
    authority-bearing transformations that tolerates false positives and feeds narrow diagnostics -
    screening, not diagnosis. Building that from the design downward would be machinery whose
    coverage is asserted rather than demonstrated, which Entry 19 had just finished naming. So v0
    tested the single premise underneath it:

        a screen given only the module surface and a DECLARED invariant, told nothing about any
        specific defect, flags a transformation this session found by hand

    LS-1 HELD, AND IT IS THE RESULT:

        at 77fd921   stopping.objectivesFromContest   lost: establishes, doesNotEstablish, state
        at HEAD      stopping.objectivesFromContest   lost: state

    The screen has no knowledge of SC-1; its driver composes the module the way quiesce-check does.
    It found, mechanically, the erasure that had cost twenty commits, seven green suites and an
    owner's review. AND THE SHARPEST FORM WAS NOT PREREGISTERED - it came out of running the thing:
    THE DELTA BETWEEN TWO COMMITS' POSITIVES IS THE REGRESSION. A standing false-positive set is
    tolerable; a NEW lost field is a signal.

    THE HONEST TALLY, because counting the flattering version would be this project's own metric
    defect. Six positives at 77fd921: ONE principled true positive and FIVE ARTIFACTS. The artifact
    has a single cause worth naming - JavaScript lets a function be called with the wrong shape
    without throwing, so feeding a contest to evidenceFrontier returns a plausible object that "lost"
    fields the input happened to carry. Two of those artifacts point at nextAction and
    evidenceFrontier, which really did have SC-3 and SC-4 defects. THOSE TWO ARE COINCIDENCES, NOT
    DETECTIONS, and are not counted. Demonstrated sensitivity: one defect.

    Specificity is limited BY THE LANGUAGE, not by the invariant. A declared signature per export
    would fix it and does not exist here.

    UNSCREENED IS REPORTED, which is the whole point: of six exported functions, one - `attainment` -
    was never called, so the run says nothing whatever about it. A clean positives list without that
    line would be the 452/452 defect wearing a lab coat.

    THE REGION, per protection.mjs: field-level erasure, object to object, over one module's
    reachable exports, witnessed by this run, covering SC-1 and nothing else. NOT covered: value-level
    loss inside a retained field (C6), array- and Map-shaped transformations (C8-a), every other
    module, every other pathology the owner listed. v0 earns one more slice on evidence, not on
    enthusiasm.

    ------------------------------------------------------------------------------------------------
    AND A CORRECTION TO ENTRY 18, FROM THE OWNER WITHDRAWING THEIR OWN EARLIER OVERSTATEMENT.

    `attainment()` reported COMPLETE as NOT_REPRESENTABLE with the gloss "no important failure exists
    anywhere". That is right about ITS subject - the failure-class space of arbitrary unconstrained
    software, an open-world claim over an unenumerated space - and WRONG if read as "completeness is
    unreachable". It is reachable over a BOUNDED CONTRACT: a finite input domain, a fully specified
    required behaviour, no side effects, a fixed environment. Sixteen states can be checked. There is
    no philosophical mystery left in that case.

    AND THIS REPOSITORY ALREADY HELD THE AUTHORITY FOR IT. `GENERALIZATION.EXHAUSTIVE` in
    justification.mjs is exactly "the domain was enumerated and all of it was checked", and `widen()`
    already REFUSES it without the enumeration carried as evidence - asserted now by AT-3b, which
    shows the refusal and then the grant. `domain-algebra.mjs` decides relations on witnesses for the
    same reason. The machinery for a PROVE mode is older than the proposal for one.

    So the refusal now names its subject, in the code and in the printed verdict. PERFECTION IS
    RELATIVE TO A CRITERION - Perfect(P, C) - and is not a mystical property of source; several
    implementations can be equally perfect under one contract, and adding a clause to C changes the
    admissible set. That is why `legareward/dominance.mjs` keeps a Pareto FRONTIER rather than
    electing a winner, and it has always been the same claim in a different layer.

    NOT DONE, and not started: the PROVE mode as a component, the authority-flow graph, the mutation
    battery, the static/dynamic cross-check, the unscreened-region map over the whole repository, and
    the classification of regions as BROKEN / UNVERIFIED / SCREENED / VERIFIED / COMPLETE / OPTIMAL.
    Those are a design, and this entry records exactly one measurement toward it.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE, with one screen that has a witness and a
                 stated region.

---
## Entry 21 — LegaScreen v1 meets the owner's three-case bar, and a generated space beats hand enumeration

    objective    meet the owner's success criterion for the screening proposal, or record that it was
                 not met
    authority    OWNER, 2026-09-20
    start hash   3eec93f
    evidence     LEGASCREEN_V1_PREREG.md / RESULT.legascreen-v1.md (6534588 / and this commit)
                 legasus/legascreen/probes.mjs, probes.test.mjs, benchmarks/run-legascreen-v1.mjs

    THE BAR, in the owner's words and frozen before any probe was written: surface three historical
    defects at the commits where each was live, from a commit before each was known, with the SAME
    machinery rather than three special cases, while preserving explicit UNSCREENED for what cannot
    be evaluated. "Same machinery" was defined in the preregistration so it could not be argued
    afterwards: one harness - enumeration, exercise, coverage, unscreened reporting - with pluggable
    probes, and a probe that needs the defect's file, function, field or commit named in it FAILS.

    MET, on all three:

        77fd921   P-ERASURE      objectivesFromContest lost establishes, doesNotEstablish
        58b62aa   P-ALIAS        CONTESTED owned by ledger.mjs and provenance.mjs
        b11e51f   P-COMPOSITION  A=S1 -> M=null -> C=S2, and three more
        HEAD      all three silent on those findings, over the same spaces

    V1-3 WAS THE DECISIVE PREDICTION AND IT IS WHY THIS IS NOT THREE SCANS. P-COMPOSITION is the only
    probe written as a METAMORPHIC PROPERTY over a generated space:

        LENGTHENING A JUSTIFICATION PATH MUST NOT GRANT WHAT THE DIRECT PATH REFUSES

    It enumerates 64 three-node chains over {null, ANY, S1, S2}, builds the two-node graph with the
    same endpoints, and compares entitlement. It contains no mention of null, of C1, of which
    dimension matters, or of what laundering looks like. The erasure result could have been a scan
    finding a scan-shaped defect; this one could not.

    AND IT FOUND A ROUTE THIS PROJECT NEVER ENUMERATED:

        A=S1 -> M=null -> C=S2     C1 as recorded, predicted and tested in wave 1
        A=S1 -> M=ANY  -> C=S2     NEVER PREDICTED, NEVER TESTED, NEVER WRITTEN DOWN

    An intermediate at ANY launders identically to one at null. The wave-1 preregistration predicted
    the null case and tested exactly it. The C1 repair happens to close the ANY route - which is why
    HEAD is silent - but THE REPAIR COVERING IT WAS LUCK OF CONSTRUCTION, NOT COVERAGE I HAD
    DEMONSTRATED, and Entry 19 exists precisely to keep that distinction. This is the first evidence
    in this project that a generated space reaches a member of a class that preregistered hand
    enumeration missed.

    FALSE POSITIVES REPORTED, NOT TUNED. P-ALIAS carries its standing collisions everywhere - seven
    at HEAD and a DIFFERENT seven at 77fd921, since pin.mjs exists there and instruments.mjs does
    not, which is exactly why the count is not the signal and the DELTA ACROSS COMMITS is. P-ERASURE
    carries the wrong-shape artifacts whose cause v0 named: JavaScript does not throw when a function
    is handed the wrong shape, so specificity is limited by the language and not by the invariant.

    THE SCREEN IS ITSELF SCREENED, which this project's history makes mandatory. Every probe is shown
    to FIRE on a synthetic defective module and to be SILENT on a sound one over the same space, and
    to report an unusable target as UNSCREENED with `examined: 0` so silence can never be read as
    clean. The composition probe's fixtures are written in the test, not imported, so it cannot pass
    by accident of the real module's state.

    THE REGION, per protection.mjs: field erasure over one module's reachable exports; state-word
    collisions in one directory at one nesting depth; three-node chains over one dimension and four
    scope values. Covers SC-1, the C8 alias, C1 and one unrecorded C1 variant. classCoverage stays
    UNKNOWN. NOT covered and restated: value-level loss inside a retained field, array- and
    Map-shaped transformations, every other module, chains longer than three, more than one dimension
    at a time, and every other pathology the owner listed.

    NOT BUILT, named so the slice is not mistaken for the cathedral: the repository-wide authority
    graph, runtime instrumentation of the authority APIs, a static parser, the mutation battery,
    shrinking, finding IDs with repair packets, severity dimensions, historical bisection beyond the
    three named commits, and per-model rendering.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. The bar is met for three cases, which
                 licenses one more slice on evidence - not the remaining design on enthusiasm.

---
## Entry 22 — the holdout: the screen did NOT transfer, and that is the most useful result of the series

    objective    run the owner's holdout - one historical defect chosen mechanically from a pool no
                 probe was designed around, with the probes untouched after selection
    authority    OWNER, 2026-09-20
    start hash   27ade4a
    evidence     LEGASCREEN_HOLDOUT_PREREG.md / RESULT.legascreen-holdout.md (040d95e / this commit)
                 benchmarks/run-legascreen-holdout.mjs

    THE DESIGN, and its point. v1 met a three-case bar in which EACH PROBE WAS BUILT AROUND THE CASE
    IT LATER FOUND. That shows the probes were faithfully built; it does not show they transfer. The
    selection rule, the two readings and the four outcomes were frozen in a commit containing nothing
    else, before any candidate was named, with the consequence of each outcome decided in advance so
    the result could not choose its own.

    SELECTED MECHANICALLY: C2 - derive()'s output context gains a dimension NO PREMISE ESTABLISHED -
    the first eligible identifier in canonical order once C1 (composition family) and C4 (alias
    family) were excluded. Verified LIVE in the target tree by direct evaluation, so silence could
    not be misread as absence:

        derive({}, {repository: S1}).context = {"repository": "S1"}    minted = true

    RESULT

        STRICT   the three probes as shipped, at b11e51f: 12 positives, NONE relating to calculus,
                 to derive, or to C2.                                              SILENT
        POINTED  the same probe code aimed at calculus.mjs, driver committed verbatim: 7 positives
                 over 8 functions, one naming the right function and field.        PARTIAL

    AND PARTIAL IS NOT ROUNDED UP. `calculus.derive lost: context` names the right place for three
    wrong reasons: the seeds are tokens so the call is wrong-shaped and the refusal object naturally
    lacks context; C2 is a GAIN and the probe detects LOSS, which no driver or target can repair; and
    a reader following it asks why derive drops context, finds it was called wrongly, and stops.
    Three other functions carry an identical flag.

    WHAT THIS ESTABLISHES, and it is worth more than the three v1 positives:

        the screen detects   LOSS of a field           (P-ERASURE)
                             COLLISION of a name       (P-ALIAS)
                             GAIN along a lengthened path (P-COMPOSITION)
        C2 is               GAIN FROM ABSENCE IN A SINGLE TRANSFORMATION - a fourth shape

    The first defect none of the probes was designed around is not reached. The microscope's
    narrowness is now MEASURED rather than assumed, which is the thing this series has been trying to
    buy.

    ALSO MEASURED, AND UNFLATTERING. Aimed at a module whose functions take structured arguments
    rather than each other's outputs, P-ERASURE produced SEVEN POSITIVES OVER EIGHT FUNCTIONS,
    essentially all the wrong-shape artifact. v0 named the cause - JavaScript does not throw on a
    wrong-shape call - and this quantifies it: specificity collapses off the composition path.

    THE FOURTH PROBE IS NAMED BY THE EVIDENCE AND IS NOT BUILT:

        A DERIVED CONTEXT MUST NOT ESTABLISH A DIMENSION THAT NO PREMISE ESTABLISHED

    the dual of the erasure invariant, metamorphic and target-independent. The preregistration fixed
    that a SILENT or PARTIAL outcome makes the missing property define the next probe, that the probe
    must then rescan ALL prior history rather than its motivating defect alone, and that no probe is
    written in this slice. None is.

    CARRIED FORWARD, unstrengthened: because the C1 repair already closed the ANY route, v1's ANY
    discovery does not show the screen would have prevented a defect prospectively. It shows the
    repair's protected region was larger than the demonstrated one and that the screen could expose
    that afterwards. Recorded before this run, and this run does not improve it.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. A fourth probe is now justified BY EVIDENCE
                 rather than by imagination, and is deliberately left unwritten so that the
                 preregistration governing it can be written first.

---
## Entry 23 — v2: the witness architecture works, the no-detection prediction held, and the rescan found nothing

    objective    write the probe the holdout justified, on the architecture the holdout forced, and
                 answer the only question worth asking of it: what does it find BESIDES its
                 motivating defect
    authority    OWNER, 2026-09-20
    start hash   64ef716
    evidence     LEGASCREEN_V2_PREREG.md / RESULT.legascreen-v2.md (9079e38 / this commit)
                 legasus/legascreen/minting.mjs, minting.test.mjs

    A FINDING BEFORE ANY CODE, recorded in the preregistration so it could not look convenient
    afterwards. The owner's general formulation -

        Authority(output) is a subset of AuthorizedClosure(inputs)

    - DOES NOT CATCH THE HOLDOUT. C2 was derive({}, {repository: S1}) yielding {repository: S1}, and
    S1 IS in the closure of the inputs: premise two established it. Nothing was minted from nothing.
    The defect is that DERIVE IS CONJUNCTIVE - its own source says "the output context is the
    INTERSECTION" - and it took a dimension only ONE premise established. So v2 carries TWO
    invariants, and the owner's instruction not to collapse single-edge minting with multi-edge
    laundering is obeyed: the data has not earned that reduction.

        I-ANCESTRY   strip D from EVERY input -> the output must not establish D. Universal.
        I-WEAKENING  strip D from ONE input -> the output must not establish D. Only for operations
                     whose own source declares conjunction. THE HAND-AUTHORED PART, named as such.

    V2-1 WAS A PREDICTION OF NO DETECTION AND IT HELD. I-ANCESTRY does not flag C2; only I-WEAKENING
    does. The probe is not credited with a catch its universal invariant cannot make, and the
    insufficiency of the general formulation is now EXECUTED rather than argued.

    THE ARCHITECTURE RESULT, V2-4, and it is the strongest thing here. The holdout showed v1's
    erasure probe producing 7 positives over 8 functions on calculus.mjs, nearly all because a
    wrong-shape call returns a plausible object. v2 requires a WITNESSED call - a legitimate
    invocation that actually succeeded - before anything is concluded from an output:

        v1 P-ERASURE on calculus.mjs   7 positives / 8 functions, nearly all artifact
        v2 minting  on calculus.mjs    0 at HEAD, 2 real at b11e51f

    The artifact class is gone. AND THE RULE THAT REMOVED IT WAS ALREADY IN THIS REPOSITORY:
    legaexercise/witness.mjs has said since r2 that there is NO OBSERVATION WITHOUT EXECUTION. The
    screening layer ignored its own project's oldest discipline and paid the ordinary price.

    V2-5 FAILED, AND THE PREREGISTRATION FIXED THE READING IN ADVANCE.

        findings meeting all four frozen conditions for "new": 0

    The rescan over four trees surfaced C2 and nothing else. Two positives, both on calculus.derive
    in the motivating module, differing only in which dimension exhibits the same defect - not new.
    So: V2 IS A REGRESSION TEST WEARING A SCREEN'S CLOTHES, the ANY moment did not repeat, and no
    probe is added to chase a better result. The honest bound on that negative is that the rescan
    surface was SEVEN TRANSFORMS across four modules: a null there is weak evidence about the
    repository and strong evidence about the probe's REACH.

    AND THE RUN FOUND A DEFECT IN THE SCREEN ITSELF. The first minting.mjs reported adapt.adaptRecord
    minting `criterion` and `history` at HEAD. Both false: the input identity is keyed
    {producer, document, ordinal} while the output scope is keyed {criterion, history}, so stripping
    `criterion` from an input that never had it CHANGED NOTHING and the invariant failed without any
    perturbation having occurred. That is HAZARD 3 - a control that could not fire - committed inside
    a screen built to catch that class, and found by running it rather than by reading it. Repaired
    with a non-vacuity check; three dimensions at HEAD are now honestly UNSCREENED for that reason,
    because they are derived from differently-named inputs and this probe cannot perturb them by name.

    THE COVERAGE MAP, which is the accumulated product of Entries 20-23:

        ERASURE                        yes, under compatible object shapes; specificity collapses off
        ALIAS                          yes, for the scanned exported-name region
        COMPOSITION LAUNDERING         yes, over the generated 64-chain region; found null AND ANY
        SINGLE-TRANSFORMATION MINTING  I-ANCESTRY found no instance in 7 transforms;
                                       I-WEAKENING yes, for operations that DECLARE conjunction
        DERIVED-BY-ANOTHER-NAME        UNSCREENED - named, and outside every probe's reach

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. The screen has four demonstrated lenses,
                 one measured blind spot, and one failed attempt at discovery - which is a more
                 honest inventory than it had before this entry.

---
## Entry 24 — lineage: support discovered without names, C2 generalized, and the architecture's own unforgeability defeating the screen

    objective    build the ONE part of the owner's v3 design that the v2 blind spot justified -
                 semantic lineage - and nothing else
    authority    OWNER, 2026-09-20
    start hash   4677039
    evidence     LEGASCREEN_V2_BASELINE.md (907ca86), LEGASCREEN_V3_PREREG.md (3d51b6c),
                 RESULT.legascreen-v3-lineage.md, legasus/legascreen/lineage.mjs

    V2 WAS FROZEN FIRST, in its own commit, with its five measured blind spots written down before
    anything that might make it look broader in retrospect. Four demonstrated lenses, MECHANIZED_
    REGION for each and COVERED_CLASS for none.

    L-1 HELD. v2 perturbs by NAME, so where an output coordinate is derived from a differently-named
    input it reported UNSCREENED. Lineage discovers the support by execution instead:

        identity.producer  -> scope.criterion      identity.document -> scope.history
        identity.version   -> scope.criterion      identity.ordinal  -> scope.history

    No name matching anywhere. The blind spot is closed FOR THIS CASE.

    L-3 HELD, AND IT IS THE GENERALIZATION. Aggregation is observable by the same means: remove one
    of several inputs and see whether the output coordinate survives.

        b11e51f   context.repository   declared ALL_OF   OBSERVED ANY_OF   MISMATCH
                  context.criterion    declared ALL_OF   OBSERVED ANY_OF   MISMATCH

    C2 is now a mismatch between OBSERVED and DECLARED aggregation. v2's I-WEAKENING needed a human
    to encode "derive is conjunctive" as a probe input; this needs only the operation's own contract,
    and the observation is mechanical.

    L-2 IS NOT MEASURABLE AT HEAD, AND THAT IS THE FINDING OF THE ENTRY.

        HEAD   calculus.derive   observed 0   vacuous 0   unobservable 4   aggregation UNKNOWN

    The perturbation builds a modified COPY of a token. Since the C3 repair a token is branded by
    membership in a module-private WeakSet, so a copy IS NOT AN AUTHORITY TOKEN and derive correctly
    refuses it. Verified at both commits rather than inferred: at HEAD the copy carries zero own
    symbols and is refused; at b11e51f it carries one and is accepted.

        THE ARCHITECTURE'S OWN UNFORGEABILITY DEFEATS EXTERNAL PERTURBATION.

    The C3 repair made tokens harder to forge and, by the same property, harder to SCREEN. A real
    tension between defensibility and screenability, found by the screen failing rather than by
    anyone reasoning about it. The fix is named and NOT built: perturbation must go through the
    CONSTRUCTORS - rebuild the premise via observe() at a perturbed context - because a screen that
    mutates objects from outside can only screen objects that permit outside mutation.

    THREE DEFECTS IN THE PROBE, every one found by running it rather than reading it:

      1 A REFUSED INPUT WAS READ AS A DEPENDENCY. `{minted: false}` has no context, so every output
        coordinate "changed" - producing a confident ALL_OF at HEAD where NOTHING had been observed.
        L-5's non-vacuity requirement is what exposed it: a matrix where everything depends on
        everything has discovered nothing.
      2 UNSUPPORTED AND ANY_OF WERE CONFLATED. "No single input affects it" means either it came from
        outside the inputs or it survived the loss of every one - opposite findings. Only the
        all-inputs-stripped run separates them, and before the fix the probe reported UNKNOWN at
        b11e51f where the answer was the defect.
      3 "COULD NOT MEASURE" AND "WAS REMOVED" SHARED ONE REPRESENTATION - a bare `undefined`. THAT IS
        THIS PROJECT'S OLDEST DEFECT CLASS, UNKNOWN COLLAPSING INTO A VALUE, THE ONE LAW 1 WAS
        WRITTEN FOR, COMMITTED INSIDE THE LAYER BUILT TO DETECT IT.

    Defect 3 is the most instructive thing in this entry. The layer whose purpose is to notice
    information loss lost the distinction between an unmeasured probe and a measured absence, in its
    own return value, at the first attempt.

    NOT ESTABLISHED, and named: anything about HEAD's calculus, which is unscreenable by this method
    until perturbation goes through constructors; anything beyond two transforms; the support FORMULA
    representation; the shared mutation engine; AST discovery; the 143-transform surface; path
    invariants; and the readiness gate A-J, of which this slice satisfies C and D only.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. Slice 1 earns the right to attempt slice 2 -
                 constructor-based perturbation, which the HEAD result makes a prerequisite rather
                 than an improvement.

---

## Entry 25 — slice 2: the counterfactual is minted upstream, HEAD becomes measurable, and the control finds the defect again

    objective    build the instrument the owner asked for - lawful counterfactual execution through
                 the production constructor - and stop
    authority    OWNER, 2026-09-20, "Stop doing holdouts now. Build the instrument."
    start hash   49cb644 (preregistration alone)
    evidence     LEGASCREEN_V3_SLICE2_PREREG.md (49cb644), RESULT.legascreen-cf.md,
                 legasus/legascreen/counterfactual.mjs, run-legascreen-cf.mjs

    CF-1 HELD, AND IT WAS THE DECISIVE PREDICTION. Entry 24 ended with HEAD unscreenable: the probe
    perturbed by copying a token, the C3 repair brands tokens by membership in a module-private
    WeakSet, so the copy was not a token and derive correctly refused it.

        slice 1 (copy the token)            HEAD   observed 0   unobservable 4   aggregation UNKNOWN
        slice 2 (mint from mutated facts)   HEAD   OBSERVED=4                    aggregation ALL_OF

    The intervention moved UPSTREAM OF AUTHORITY ISSUANCE. The screen mutates pre-authority FACTS and
    calls observe() - the same constructor production calls - to obtain a second, genuinely valid
    token. So the tension Entry 24 named is not a trade-off to be managed: unforgeability stops being
    an obstacle and becomes part of EXPERIMENTAL VALIDITY, because the counterfactual is legitimate
    precisely in virtue of having been minted the way production mints.

    CF-2 HELD. b11e51f is still convicted, and the conviction now carries its warrant:

        context.repository   declared ALL_OF   observed ANY_OF   MISMATCH
        context.criterion    declared ALL_OF   observed ANY_OF   MISMATCH
        ...on the authority of calculus.mjs, DERIVE: "The output context is the INTERSECTION"

    CF-4 HELD AND IS ASSERTED, NOT INTENDED. The owner's constraint was that the screen must not get a
    backdoor constructor, since a forgeTokenForTesting() would weaken the exact property being
    screened. The substrate exports AGGREGATION, OUTCOME, SCORES, counterfactual, mismatches - no
    mint, no forge, no test-only path - and a test pins that list so one cannot be added quietly.

    NON-VACUITY NOW LIVES IN THE SUBSTRATE RATHER THAN IN PROBE AUTHORS' MEMORIES. Eight tagged
    outcomes replace every epistemic use of null and undefined in the control flow, and only OBSERVED
    may be scored. The three slice-1 defects are therefore not repaired - they are UNREPRESENTABLE:

        a refused input read as a dependency     ->  AUTHORITY_REFUSED, and never an edge
        "could not measure" vs "was removed"     ->  distinct tagged outcomes
        a perturbation that did not perturb      ->  NO_CHANGE, proven by the ENGINE

    Baseline replay is a precondition: a construction path that cannot reproduce its own observation
    returns BASELINE_UNSTABLE and scores nothing, so no difference can be attributed to an
    intervention that was never isolated.

    CF-6 IN ITS MINIMAL FORM ONLY. A declared aggregation with no stated AUTHORITY returns
    UNCOMPARABLE rather than agreement, so a criterion and an implementation cannot be moved together
    and pass silently. The owner's fuller requirement - pinning the declaration to the state it is
    valid against - IS NOT BUILT.

    AND THE CONTROL FOUND A RESIDUAL NAME ASSUMPTION INSIDE THE SUBSTRATE. CF-5's vacuity case failed
    on the first run: UNKNOWN where the answer is UNSUPPORTED. The all-facts strip was deleting a
    fact key NAMED AFTER THE OUTPUT COORDINATE - the same-name assumption slice 1 existed to
    eliminate, surviving in the one place nobody had looked. With an output named context.fixed and
    facts named a, it stripped nothing. Repaired by emptying the facts.

        FOURTH CONSECUTIVE SLICE IN WHICH A CONTROL WRITTEN AGAINST THE PREREGISTRATION FOUND A
        DEFECT IN THE INSTRUMENT RATHER THAN IN THE SUBJECT.

    That rate is itself a measurement, and it is not comfortable: the layer built to detect an
    assumption keeps committing that assumption. The controls are catching it every time so far, which
    is the only reason the rate is knowable at all.

    Focused 7/7. Suite 612/612.

    NOT ESTABLISHED, and named: anything beyond two transforms and two trees; the support FORMULA
    representation; the shared mutation engine; AST discovery; the 143-transform surface; path and
    graph invariants; the coverage report; fault injection of the screen itself; legitimate-neighbour
    controls at scale; and pinning declared semantics to a state. Readiness gate A' B' C D met,
    E-J NOT STARTED. This is not a repository screen and nothing in the slice says it is.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. The owner's instruction is to stop and
                 inspect the instrument before the 143-transform scanner, and that boundary is the
                 stopping condition, not a pause in work.

---

## Entry 26 — AUTO-WITNESS-1: the recipe is recorded rather than authored, and the driver is gone

    objective    the owner's named milestone - capture enough upstream construction history from a
                 transformation that runs during an EXISTING test to reproduce the same legitimate
                 invocation without a hand-written driver
    authority    OWNER, 2026-09-20, after the slice-2 inspection
    start hash   c3cec92 (preregistration alone)
    evidence     AUTO_WITNESS_1_PREREG.md (c3cec92), RESULT.auto-witness.md,
                 legasus/legascreen/{outcome,witness,witness-store,witness-loader,witness-register}.mjs

    THE INSPECTION FOUND THE BOTTLENECK AND THE OWNER NAMED IT: the screen is not limited by its
    invariants, it is limited by its ability to automatically construct a legitimate experiment.
    Slice 2's driver was twelve lines of my own judgment about what derive's pre-authority facts ARE,
    and writing 250 more would not have been progress - it would have been 250 more chances for the
    screen author to decide what the subject means.

    W-1 HELD. Two existing test files ran unmodified under a module loader hook; 18 of their own
    tests passed under instrumentation, so the shim is transparent to the subject.

        calls recorded 55       op                  ROOT  UPSTREAM  REPLAYED
                                calculus.observe      29         0        29
                                calculus.derive       13        12        13
                                calculus.delegate     13         7        13

        NO-DRIVER CHECK: 5 files on the capture path -> none supplies facts/construct/operate

    One captured recipe names 24 LEAF FACTS. The hand-written driver declared four, and I chose those
    four. Here I chose none of them.

    An ES module namespace is immutable from outside, so an already-written test cannot be intercepted
    by assignment - but substituting the MODULE can be. The loader returns a shim that re-exports the
    real module and wraps the named exports, and the shim ADDS NO CAPABILITY: every wrapper calls the
    real function and returns the real value.

    CLASSIFICATION IS BY IDENTITY, NEVER BY NAME OR SHAPE.

        DERIVED   this object IS a recorded call's return value
        FOREIGN   the SUBJECT'S OWN brand says it is authority, but no recorded call produced it
        OPAQUE    cannot be rebuilt, held by reference
        LEAF      plain data - the only mutable surface

    FOREIGN exists because a frozen token is a plain object. Calling it a leaf would hand the screen
    mutable raw data exactly where the architecture keeps an authority object.

    W-3 WAS THE PREDICTION MOST LIKELY TO KILL THE SLICE, and it held where it counts:

        witnesses whose ORIGINAL result was a minted token : 6 / 12
        of those, REPLAYED to a token the subject accepts  : 6 / 6

    Asked of calculus.isAuthority itself. A recorder that deep-cloned anything it touched would score
    zero, because a clone is not in the module-private WeakSet. The other six replayed a REFUSAL,
    which proves nothing about branding, so they are counted separately rather than folded into a
    comfortable 12 of 12.

    W-5: A JUDGMENT IS NOW STRUCTURALLY UNREACHABLE WITHOUT THE EXPERIMENT. Eleven states, three
    verdicts, and a verdict is not something a probe returns but something a journey earns over
    DISCOVERED -> BASELINE_REPLAYED -> PERTURBATION_APPLIED -> OBSERVED. A real witness that reached
    BASELINE_REPLAYED and asked for a verdict got INVARIANT_UNKNOWN naming the two stages it never
    reached. HELD IS GATED EXACTLY AS HARD AS VIOLATED, because a pass asserted over an experiment
    that never ran is the same error with a comfortable sign. The honest limit is written into the
    file: nobody can stop a probe returning its own object, but such an object is not a verdict.

    AND THE FIRST VERSION OF CONTROL W-2b COULD NOT FIRE. It varied a field derive does not read, so
    the output was identical every time and the control passed while proving nothing - a vacuous
    control written inside the slice whose subject is vacuity. Found by running it. FIFTH CONSECUTIVE
    SLICE IN WHICH A CONTROL FOUND A DEFECT IN THE INSTRUMENT RATHER THAN IN THE SUBJECT, and the
    first in which the defect was in the control itself.

    W-8 was a prediction of NO detection and held: no judgment here, so no finding about the
    repository. Two test files never used during development gave 30/30 replayed and produced a mixed
    two-constructor recipe unprompted - a derive whose premises were a delegate and an observe.

    NO COVERAGE FRACTION IS REPORTED. The owner's correction stands: 1/251 exported functions was a
    fraction over a surface never established, and a better-looking fraction over the same
    unestablished surface would be the same error. Counts only until discovery exists.

    NOT BUILT, and named: perturbation, counterfactual, support formulas; declared remains human
    testimony and is not consulted; no static discovery of the authority surface; nothing about
    transformations that do not execute during an existing test, and that population is UNMEASURED,
    not empty. The five prototypes are NOT merged - the correct common abstraction is still unknown,
    and merging on accidental similarity would freeze it.

    Focused 17/17. Suite 629/629.

    next         AUTO-CF-1, which the owner sequenced immediately after this one: mutate one eligible
                 leaf fact, reconstruct through the real production path, prove the perturbation
                 occurred, execute the same target, produce a typed outcome. No semantic judgment
                 until that works.

---

## Entry 27 — AUTO-CF-1: K is 140 with zero drivers, a preregistered control could not fire, and a check was being silently skipped

    objective    the owner's next milestone - from a recorded witness, mutate one eligible leaf fact,
                 reconstruct through the real production path, prove the perturbation occurred,
                 execute the same target, produce a typed outcome. No semantic judgment.
    authority    OWNER, 2026-09-20
    start hash   45403a1 (preregistration alone)
    evidence     AUTO_CF_1_PREREG.md (45403a1), RESULT.auto-cf.md,
                 legasus/legascreen/intervene.mjs, benchmarks/run-auto-cf.mjs

    C-1 HELD, AND THE OWNER'S METRIC IS THE ONE REPORTED.

        hand-authored counterfactual drivers  : 0
        authority transforms WITNESSED    (N) : 55
        authority transforms REPLAYED     (M) : 55
        authority transforms PERTURBED    (K) : 140   of 667 leaf facts tried

        op                     N    M    K   leaves
        calculus.observe      29   29   79      297
        calculus.derive       13   13   61      291
        calculus.delegate     13   13    0       79

    CALCULUS.DELEGATE IS K = 0 OVER 79 LEAF FACTS. Every delegation counterfactual was refused or
    unreadable and not one produced a scorable observation. Reported, not smoothed.

        RECONSTRUCTION_FAILED  199    AUTHORITY_REFUSED  187    OBSERVED  140
        OUTPUT_UNOBSERVABLE    114    PERTURBATION_NOT_APPLICABLE  27

    79% of attempts produced NO MEASUREMENT, and each says why in its own state. Under the old
    representation most of those would have been an undefined somewhere.

    A REAL OBSERVATION ABOUT THE SUBJECT, FOUND MECHANICALLY AND WITHOUT A PROBE WRITTEN FOR IT:

        derive#7   #5 arg[0].context.criterion  ->  context.repository ADDED
                   #6 arg[0].context.criterion  ->  context.repository ADDED

    Removing one fact from one premise turns a REFUSAL into a CONCLUSION. derive refuses when
    premises conflict on a dimension with no bridge witness, and DROPS a dimension some premise never
    established - so deleting the conflicting criterion removes the conflict and the derivation
    proceeds at repository S1. Both halves are documented in calculus.mjs; nobody had put them next
    to each other. Not a defect, and this slice issues no judgment about it.

    C-2b DID NOT FIRE, AND THE PREDICTION WAS WRONG. The preregistration said a constructor
    re-supplying a default would make an intervention vacuous. It does not: a default lands in the
    constructor's OUTPUT, while the proof is taken on the rebuilt ARGUMENT, and once an object key is
    gone the argument always differs. PERTURBATION_NO_EFFECT is therefore UNREACHABLE under
    removal-perturbation - 0 of 667. The state is kept because the proof is the right one and value
    substitution will reach it, and it is recorded as NEVER SHOWN TO FIRE, which is not the same as
    safe.

    THREE DEFECTS IN MY OWN LAYER, ALL FOUND BY RUNNING IT.

      1 A REFUSED BASELINE WAS SCORED AS A MEASUREMENT. K was 254 on the first run: a witness whose
        baseline was already a refusal compared two refusals, found them equal, and reported OBSERVED
        with no delta six times over a call that never produced anything to read. False confidence
        manufactured out of an absence - slice 1's defect wearing the new architecture. K fell to
        140. The repair is deliberately NOT "the baseline must be observable", because the
        baseline-refusal case above is the most informative result in the run.
      2 A WORLD THAT COULD NOT BE BUILT WAS REPORTED AS A WORLD IN WHICH NOTHING CHANGED. When
        reconstruction threw, the first version returned PERTURBATION_NO_EFFECT. Could-not-measure
        collapsing into a measured absence: THE OLDEST DEFECT CLASS IN THIS PROJECT, committed once
        more inside the layer built to prevent it.
      3 A VALIDATING WRAPPER WAS SILENTLY SKIPPED ON REPLAY. When a recorded function returned
        another recorded call's value unchanged, the recorder kept the INNER producer, so replay
        rebuilt the value by calling the inner function directly and the wrapper's own refusal left
        the replayed path. A perturbation it would have rejected sailed through and was scored. Calls
        complete inner-first, so the OUTERMOST producer - the one the consumer actually got the value
        from - now wins. THIS IS THE DANGEROUS ONE: it did not fail, it quietly removed a check.

    A fourth, smaller: the C-6 checker matched its own report text, because the line that PRINTS the
    result mentions the method names inside a string. The smallest possible instance of reading your
    own output back as evidence.

    C-6 HELD and is asserted over the source and all 667 records rather than intended - nothing calls
    held() or violated(), and no result carries a verdict. A completed journey CAN judge, and 140 of
    them correctly could; the claim is that nothing here asks.

    ENTRY 26'S PUBLISHED NUMBERS WERE RE-RUN because defect 3 threatened them, and are unchanged:
    29/13/13 root witnesses, 12 with upstream history, 12/12 replayed, 6/6 branded.

    Two test files never used in development: N 30, M 30, K 58 of 288 leaves.

    NO COVERAGE FRACTION. Still an undiscovered surface, still no denominator.

    NOT BUILT: support formulas (ALL_OF/ANY_OF need complete truth tables), the contract source
    (declared is still human testimony and is not consulted), discovery of the authority surface, and
    anything about transformations that do not execute during an existing test. The five prototypes
    remain unmerged.

    Focused 27/27. Suite 639/639.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. The owner's sequence puts support formulas
                 after this, over the truth table that K now makes available - but the instrument has
                 produced four defects in itself in one slice, and that rate is the thing to weigh
                 before adding a layer that draws conclusions from it.

---

## Entry 28 — SURFACE-1: the denominator is discovered, it is 15, and level 1 is empty

    objective    the owner's correction - discover the repository's AUTHORITY SURFACE rather than
                 assume "every export" as a denominator
    authority    OWNER, 2026-09-20
    start hash   2dafbf3 (preregistration alone)
    evidence     SURFACE_1_PREREG.md (2dafbf3), RESULT.surface.md,
                 legasus/legascreen/surface.mjs, benchmarks/run-surface.mjs

        STATIC AUTHORITY CANDIDATES      15          modules parsed 156
        DYNAMICALLY OBSERVED             13          brand sites found BY SHAPE: calculus, outcome
        CONFIRMED AUTHORITY TRANSFORMS   11          10 in the SUBJECT, 5 in LegaScreen itself
        SCREENABLE                        5          by level: L0=14  L1=1
        UNSCREENABLE                     10

    THE SEED PROBLEM WAS STATED BEFORE IT WAS SOLVED, because a hand-authored list of authority
    functions would be the driver problem wearing a new hat - deciding the answer and then measuring
    it. The only root set used is one the repository's own SHAPE yields: a module-private WeakSet
    used as an identity brand, found by PARSING with acorn. Nothing names a module or a function.

    THE HEADLINE IS THE LEVEL COUNT, NOT THE SURFACE COUNT. L1 = 1, and that one is LegaScreen's own
    intervene calling journey. NO PRODUCTION MODULE UNDER legasus/ IMPORTS THE AUTHORITY CALCULUS AT
    ALL. This ledger has asserted since Entry 15 that the calculus has no production consumer; it now
    falls out of a mechanical scan rather than being asserted. The surface is small because the
    architecture's unforgeable core is UNCONSUMED, and that is the real content of the number 15.

    A STRUCTURAL LIMIT OF THE METHOD IS VISIBLE IN THE TABLE. isAuthority, commit, restrictGrant and
    tracesToIndependentRoot are UNSCREENABLE for one reason: the counterfactual method reads
    authority COORDINATES off an output, and a predicate returns a boolean.

        THE SCREEN CAN MEASURE PRODUCERS OF AUTHORITY. IT CANNOT MEASURE CONSUMERS OF IT.

    Four of the calculus's ten exports are consumers. That is not coverage to be closed by running
    more tests; it is an invariant shape this method does not have. outcome.mjs::finding is
    UNSCREENABLE as NOT_REPLAYABLE for a different and correct reason - its argument is a verdict
    sealed by a method rather than by a recorded call, so it is FOREIGN and no lawful rebuild exists.
    W-4 firing on real code.

    AND DELEGATE'S K=0 WAS THE SAMPLE, NOT THE SUBJECT. Entry 27 reported calculus.delegate at K=0
    over 79 leaf facts and said I could not tell instrument from transformation. Over the whole suite
    delegate has 25 witnesses instead of 13 and 5 counterfactuals reach OBSERVED. One run's K of 0 is
    a statement about which tests were run, and I should not have needed a second run to know that.

    CONTROLS. S-2b FIRED: a fixture carrying every authority-sounding name in the vocabulary and no
    brand yields ZERO candidates, so the mechanism does not fall back to names. S-3b FIRED: private
    brand-touchers are discovered and returned as unwrappable rather than dropped, which is why token
    and seal appear at all. S-4 held precisely - the whole suite ran with every discovered export
    wrapped and 639/639 passed, so the shims are TRANSPARENT to the subject rather than merely
    non-crashing.

    WHAT THE INSTRUMENT CANNOT SEE, PROVEN BY ITS OWN TESTS: a consumer reached only through
    `await import(...)` does not appear on the surface. With the brand-shape seed that is the content
    of CAVEAT, which is EXPORTED so a report cannot omit it by forgetting. Concretely justification,
    stopping, provenance and ledger are authority-bearing by any reading and are NOT on this surface,
    because they use no identity brand. ONE SEED IS NOT A SURFACE.

    SCREENABLE IS NOT SCREENED. Nothing here compares an observation to a declaration.

        sound transforms actually SCREENED     1   (hand-driven, slice 2)
        previously unknown repository defects  0

    Focused 7/7. Suite 646/646.

    next         NONE. QUIESCENT at NO_CURRENT_OBJECTIVE. The remaining gap to the owner's stated
                 next win is the semantic relationship check: support formulas over the truth table
                 K now makes available, judged against a contract carrying its own provenance. The
                 producer/consumer limit found here bounds what that can cover, and should be
                 carried into its preregistration rather than discovered again afterwards.

---
