# BIND-2 — From mutants to support: preregistration (frozen 2026-09-20 22:05, before any replay)

Continues from the frozen BIND-1 result (legasus/out/segments/, commit 91c4f41). BIND-1_RESULT.md
and its raw artifacts are EVIDENCE here, not instructions about what they ought to mean.

## The question

Can mechanically observed mutant -> witness discrimination be converted into a provenance-bearing
support representation for an ordinary legacy region (approvalPolicy.js::segments) WITHOUT a
human naming any semantic obligation? The subject, its witnesses, and every BIND-1 artifact are
immutable in this experiment. Nothing is repaired, refactored, tested-into-coverage, or superseded.

## Disclosure (contamination, stated before anything else)

While scoring BIND-1's P4 (before this document) I printed ~60 characters of source around
offsets 6962, 6997, 7089, 7146, 7250, 7332, 7280 and 7307. That includes the sites of dark
mutants M025 (7280) and M028 (7307). I did NOT print 7238 (M022/M023) and have not opened any
mutant file. Predictions about M022/M023 below are blind; predictions about M025/M028 are not,
and are marked.

## The one additional evidence source BIND-2 adds

BIND-1 observed only PASS/FAIL per (mutant, case). BIND-2 adds the subject's OBSERVED
INPUT->OUTPUT BEHAVIOUR under each perturbation, on exactly the inputs the witnesses actually
pass to it - no invented inputs, no semantic inputs.

    input record   (case c, ordinal k, argument string x)      captured at BASELINE by an
                   instrumented copy R000 of the subject that records every call to segments
                   and its raw return value / thrown error, interleaved in the tracer's
                   PASS|FAIL stream so calls are attributed to the case whose line follows them
                   (the same attribution rule the BIND-1 tracer already uses for coverage).
    O_m(x)         for mutant m and recorded input x: JSON(return) | THROW(name: message) |
                   APPARATUS_FAILURE(reason). Replayed in a FRESH process that imports the
                   mutant file directly and calls segments(x) for every recorded input, in
                   recorded order. This is a different executable identity from BIND-1's witness
                   run and is recorded as such on every record.
    Delta(m, x)    O_m(x) != O_0(x), compared RAW.
    DeltaTrim(m,x) same comparison after the witnesses' own normalisation (trim each element,
                   for array results). Recorded separately. NEVER merged with Delta.
    Delta(m, c)    OR over the inputs recorded under case c. A case with no recorded input is
                   NO_INPUT - a distinct state, not false.

## What counts as evidence (frozen before looking)

1. SAME support requirement, as observable by this witness set: mutants m1, m2 are
   OBSERVATIONALLY EQUIVALENT UNDER W iff O_m1(x) = O_m2(x) (raw) for EVERY recorded input x.
   The classes so formed are the support coordinates S_k; the baseline's class is S_0. This is
   the only sameness this experiment can license. It is relative to the recorded input set and
   asserts nothing about unrecorded inputs. It carries no meaning.
2. DISTINCT: one recorded input x with O_m1(x) != O_m2(x). Distinctness is licensed by a single
   input; sameness is only ever "no distinguishing input was recorded". The asymmetry is
   deliberate and is carried into every report.
3. Derivable from discrimination ALONE (BIND-1): which (mutant, case) pairs changed outcome, and
   nothing else. In particular NOT derivable: whether two mutants with identical discriminator
   sets behave identically (H1 tests exactly this), or why any case failed.
4. Must remain UNKNOWN without independent evidence: the meaning of any S_k; whether an S_k is one
   requirement or several; whether an output change no witness asserts on is a defect or intended;
   anything about inputs never recorded; whether a dark mutant is equivalent beyond the recorded
   inputs; whether a "support" edge would survive inputs the witnesses never pass.

## The proposed support representation

An edge  (witness case c) --supports--> S_k  is LICENSED iff for EVERY mutant m in S_k:
  BIND-1 klass(m, c) is DISCRIMINATED_*   AND   Delta(m, c) = true.
Provenance carried on every edge: the mutants of S_k; the inputs recorded under c; O_0(x) and
O_m(x) for each; the BIND-1 record (baseline outcome, perturbed outcome, klass, executedSite);
the executable identity of both runs (witness run vs replay process).

Refusals, each a typed state that never collapses to false/0/empty:
  INCIDENTAL        DISCRIMINATED but Delta(m, c) = false - the case failed for a reason the
                    observed return values do not explain (side channel, apparatus, or a
                    thrown error path). Named and listed; not repaired.
  UNASSERTED        EXECUTED_NOT_DISCRIMINATED and Delta(m, c) = true - behaviour changed in this
                    case's view and the case did not look. NOT an obligation; NOT absence of one.
  NO_DIFFERENCE     Delta(m, c) = false and not discriminated - indistinguishable from baseline
                    on this case's inputs. Says nothing about other inputs.
  NO_INPUT          the case recorded no call to segments (must coincide with NOT_EXECUTED; C4).
  CLASS_INCONSISTENT members of one S_k differ in BIND-1 klass on the same case. Blocks every
                    edge into that class; indicts apparatus or nondeterminism, not the subject.
  UNOBSERVABLE / APPARATUS_FAILURE  carried through from BIND-1 / replay unchanged.

## Predictions, each with its falsifier

H1 (identical bit-vectors manufacture semantics). BIND-1's identical-discriminator-set clusters,
   computed mechanically from matrix.json before any replay (listed below): at least one
   multi-member cluster splits into >= 2 S-classes under rule 1.
   FALSIFIER: every multi-member cluster is a single S-class. (Then bit-vector clustering was
   not wrong on this subject - still not a licence to use it elsewhere.)
H2 (dark mutants as held-out pressure). Of M022, M023, M025, M028: at least one is
   NO_DIFFERENCE on every recorded input (equivalent under W) AND at least one has Delta = true
   on some recorded input (UNASSERTED somewhere).
   FALSIFIER: all four are the same kind. Blind for M022/M023; NOT blind for M025/M028.
H3 (no incidental discrimination). Zero records with klass DISCRIMINATED and Delta(m, c) = false,
   excluding DISCRIMINATED_BY_ERROR (a throw is an output change by definition here).
   FALSIFIER: >= 1 INCIDENTAL record. It is reported by (mutant, case), not explained.
H4 (class consistency). Every S_k with >= 2 members has identical BIND-1 klass across its members
   on every case.  FALSIFIER: any CLASS_INCONSISTENT class.
H5 (normalisation gap). At least one (m, x) with Delta = true and DeltaTrim = false.
   FALSIFIER: none. (Weakly held; recorded so the outcome is a result either way.)
H6 (never-executed mutants). Every mutant BIND-1 marked NOT_EXECUTED on ALL 93 cases (M010-M014)
   has Delta = false on every recorded input.  FALSIFIER: any Delta = true - which would mean
   BIND-1's site-level "not executed" was wrong, and is an APPARATUS finding against BIND-1.

Frozen H1 objects - BIND-1 clusters by exact discriminator set (membership only):
  {M001, M024, M029, M033}  {M003, M004}  {M006, M018}  {M030, M032}  {M007, M019, M020}
  {M016, M017}  {M008, M021}  and the 0-discriminator set {M010, M011, M012, M013, M014,
  M022, M023, M025, M028}, of which M010-M014 are NOT_EXECUTED everywhere and the other four
  are the dark mutants. Singletons: M034, M005, M015, M009, M027, M031, M026, M002.

## Controls (must all hold or the run is burned, not interpreted)

C1 recorder validity (positive/apparatus): R000 reproduces BIND-1's baseline exactly (93 PASS,
   exit 0) and O_0(x) from the R000 run equals, byte for byte, segments(x) from the PRISTINE
   subject replayed in a fresh process, for every recorded x.
C2 negative: M000, a byte-identical copy of the subject, replays with Delta = false on every input
   and lands in S_0.
C3 must-fire: M001 (RETURN_EMPTY) has Delta(M001, c) = true for EVERY case BIND-1 marked
   DISCRIMINATED. One miss = attribution broken = burn.
C4 attribution: every case with BIND-1 executedFn = true has >= 1 recorded input; every
   NOT_EXECUTED case has exactly 0 (NO_INPUT). Mismatch = burn.
C5 load: A2 rules (count <= 40; calibration <= 105 ms) sampled at start and end of the recorder
   run and of the replay; any breach = burn.

## Attacks the design must survive (from the task; how each is met or left open)

- same signature, unrelated reasons ......... H1 (finer instrument challenges the coarse one)
- one requirement, multiple signatures ..... NOT resolvable here; two S-classes may be one
                                              requirement. Left UNKNOWN by rule 4.
- failure from incidental structure ........ H3 / INCIDENTAL
- impossible states from generic operators . M002 (throws) is kept as THROW, never as a value
- behaviour change outside the relation .... only recorded inputs are observed; stated as a bound
- clustering manufactures semantics ........ classes are anonymous, relative to W, and H1 is
                                              itself a test that the coarser clustering lies
- absence of discrimination = absence ...... UNASSERTED / NO_DIFFERENCE are typed; neither is
                                              "no obligation"

## Success and legitimate failure

SUCCESS: >= 1 licensed edge whose class survives H3 and H4, plus H1's outcome reported either way.
LEGITIMATE NEGATIVE: every S-class a singleton and every edge a restatement of the matrix -
then the output instrument added nothing and discrimination + outputs is still insufficient
to derive support; preserved as the result. If any control fails, the run is burned and the
repair gets a new prereg version (BIND-2.1), never a reinterpretation.

Run once. Preserve ugly results. Do not continue into SUPERSEDE.
