# TRANSFER-BIND — the foreign evidence contract (frozen 2026-09-21 01:20, step 2, before any transport)

## The frozen question

Can the existing BIND observation pipeline acquire its required evidence from a foreign
CommonJS codebase **without the adapter inventing, repairing, or semantically interpreting that
evidence**? Failure to attach is a valid outcome and does not need rescuing.

Foreign subject: `C:\Users\tatte\OneDrive\Documents\ai-native-engine`, native shape recorded
read-only at step 1 (`legasus/out/transfer-engine/STEP1-NATIVE-SHAPE.md`, commit b822ed6).
This contract is written against that record and is frozen before any adapter exists.

## Scientific denominator

**One foreign-codebase transfer attempt.** Regions, witnesses, cases, mutants and records are
reported at their own units inside it. 776 case lines are not 776 transfer replications, and a
matrix of any size does not multiply the attempt count.

## Requirement -> permitted foreign evidence -> failure state

Each row: what BIND requires; the ONLY native observations allowed to satisfy it; the typed
state recorded when they are absent. No row may be satisfied by inference from another row.

| # | BIND requires | Permitted foreign evidence (exclusive) | Absent / unsatisfiable |
|---|---|---|---|
| R1 | Subject root | The exact path frozen at step 1; no discovery, no search | `ROOT_UNESTABLISHED` |
| R2 | Witness membership | The frozen step-1 discovered set (33 files), carried by explicit provenance to that record | `MEMBERSHIP_UNESTABLISHED` |
| R3 | Witness identity | Exact file path + a native per-case identifier unique within that file, as emitted by the witness itself | `AMBIGUOUS_WITNESS` |
| R4 | **Invocation** | Native or documented evidence of the procedure: a manifest, a script, a runner config, a README instruction | `INVOCATION_UNESTABLISHED` |
| R5 | Execution of the witness | Direct process observation (exit status, emitted output) | `NOT_EXECUTED` |
| R6 | Site execution | V8 coverage tied to the executed file identity | `SITE_UNOBSERVED` |
| R7 | Baseline outcome | The witness's own native per-case output line | `OUTCOME_UNOBSERVABLE` |
| R8 | Mutant substitution | BIND's existing interception mechanism (ESM `resolve` hook via `module.register`), evidenced per R11 | `CANNOT_ATTACH: UNSUPPORTED_MODULE_INTERCEPTION` |
| R9 | Perturbed outcome | The SAME observation path as R7, unchanged | `TRANSPORT_MISMATCH` |
| R10 | Provenance | Every authority-bearing field links to one native observation that produced it | `UNATTRIBUTABLE` |
| R11 | **Proof that mutation occurred** | A load-time self-identification from the served file, plus R6 site opportunity | `SUBSTITUTION_UNOBSERVED` |

### R4 is UNESTABLISHED for this subject, decided now, before it can become convenient

Step 1 found no `package.json`, no test script, no `.git`, no README instruction. The step-1
probe executed witnesses as `node <file>`, and that **must not become "the documented
invocation" merely because the probe successfully used it**. It is the probe's choice, not the
codebase's statement. There may be no native concept of canonical invocation here at all.

Consequence, carried on every record this experiment produces rather than resolved:

    witness membership   OBSERVED       (33 files, step-1 record)
    witness execution    OBSERVED       under a STATED invocation: `node <file>`, cwd = root
    invocation provenance UNESTABLISHED  no native evidence exists

Execution evidence is not voided by this. Its authority is bounded: nothing in this experiment
may claim "the witness was run the way this codebase runs it."

### R11 is the trap this contract exists to close

The most dangerous possible false success on CJS:

    baseline  -> the original module
    mutant    -> the original module (interception silently bypassed)
    witness   -> PASS
    BIND      -> "no difference" -> "equivalent" -> preservation

That converts *failure to attach* into *evidence of preservation*. It is the exact inversion of
tonight's repeated disease, and it must be structurally unscorable, not merely watched for.

Mechanism, frozen: **every served file self-identifies at load.** Both arms carry the marker -
the baseline arm is served an identity copy bearing it, the mutant arm a mutant bearing it - so
the two arms differ only by the mutation, and the marker is apparatus, never subject semantics.
A record is scorable only if all four hold:

    requested identity        M                       (what the driver asked to serve)
    executed identity         observed = M            (what the loaded file said it was)
    interception observed     YES                     (a self-identification arrived at all)
    site opportunity          R6 coverage on the served identity

Any record missing any of these is `SUBSTITUTION_UNOBSERVED` or `SITE_UNOBSERVED`. Such a record
**may never be scored as NO_DIFFERENCE, equivalence, preservation, or support.** Absence of
observed substitution is absence of evidence and is represented as such.

## Adapter prohibitions (the adapter is where the experiment can be made to pass)

The adapter MAY: pass the frozen root and the frozen witness set; spawn a witness under the
stated invocation; normalize the *representation* of an observation that actually occurred
(e.g. a path separator, a JSON shape).

The adapter MAY NOT:

1. Synthesize invocation, or promote the probe's `node <file>` into documented invocation.
2. Introduce a new interception mechanism - no `Module._load` patch, no `require` hook, no
   `registerHooks`, no rewriting the subject to ESM, no transpilation. R8 names ONE mechanism.
3. Reconstruct a missing field from what "must have happened". Missing stays missing.
4. Collapse two distinct native observations into one field, or split one into two.
5. Retry with a different mechanism after a failure and report the retry as the result.
6. Treat absence of evidence as negative evidence (no `false`, `0`, `[]`, or `PASS` for
   anything unobserved).
7. Modify anything under the foreign root. Step 1 measured 0 files touched; that stands.
8. Infer any semantic meaning of the foreign code, or name any obligation.

## Prediction, frozen before the probe

**T1.** BIND's existing mechanism (`module.register` with an ESM `resolve` hook) will NOT
intercept a CommonJS `require`, and the transfer will end `CANNOT_ATTACH:
UNSUPPORTED_MODULE_INTERCEPTION`.
FALSIFIER: a CJS witness, run under the unmodified preload with a mutant requested, loads and
self-identifies as the mutant. If that happens, the transfer proceeds - but only within what is
frozen here, with the provenance of the interception recorded exactly.

**T2 (the positive control's own control).** In the same probe, a run with NO mutant requested
must self-identify as the identity copy. A probe that cannot tell "served the mutant" from
"served the original" is an apparatus failure, not a result.

## Result space (exclusive; one of these is the outcome of the attempt)

    ATTACHES + EVIDENCE PRESERVED    every required row satisfied by permitted evidence, all
                                     provenance intact -> transfer demonstrated for this subject
    ATTACHES + REPRESENTATION LOSS   transport reached the subject but some authority-bearing
                                     field lost its link -> BIND transfer NOT established
    CANNOT_ATTACH                    a required mechanism is unsupported by the foreign shape
    AMBIGUOUS / UNOBSERVABLE         no evidential conclusion
    APPARATUS_FAILURE                burn the run; repair under a new contract version

A successful result earns exactly this and no more: *BIND can experimentally characterize
behavioral support in at least one codebase outside the environment its transport was built
for.* It earns nothing about defects, obligations, supersession, or the scanner.

Next step after this commit: ONE tiny CJS positive control against the existing mechanism,
before any mutation matrix.
