# TRANSFER-BIND result — CANNOT_ATTACH: UNSUPPORTED_MODULE_INTERCEPTION (2026-09-21 01:35)

Contract: `legasus/TRANSFER-BIND_CONTRACT.md`, frozen at 7ba9c9e BEFORE any transport existed.
Foreign subject: `C:\Users\tatte\OneDrive\Documents\ai-native-engine` (step-1 shape, b822ed6).
Denominator: **one foreign-codebase transfer attempt.**

## Outcome, from the frozen result space

    CANNOT_ATTACH — a required mechanism is unsupported by the foreign shape.

BIND's mutant substitution (R8) is `module.register` with an ESM `resolve` hook. The foreign
codebase is 33/33 CommonJS with zero ESM exports. The hook does not answer a CommonJS `require`
on this Node (v24.15.0, win32). Requirement R8 cannot be satisfied by permitted evidence, so
R9 and R11 are unreachable and the transfer stops. **T1, frozen before the probe, CONFIRMED.**

## The probe (four arms, one question, mechanism unmodified)

| arm | requested identity | executed identity | intercepted | witness exit | cases |
|---|---|---|---|---|---|
| C | (none) | SUBJECT | n/a | 0 | PASS, PASS |
| A | BASELINE (identity copy) | **SUBJECT** | **false** | 0 | PASS, PASS |
| B | MUTANT (`return []`) | **SUBJECT** | **false** | **0** | **PASS, PASS** |
| D | ESM_MUTANT | ESM_MUTANT | true | 1 | FAIL, FAIL |

Arm C proves the marker is observable. Arm D proves the hook was armed and works on its home
ground — without it, "did not substitute" would be indistinguishable from "was never armed",
and the CJS arms would have been evidence about the probe rather than about CommonJS.

## The false success occurred, and was caught by mechanism rather than by outcome

**Arm B is the result that matters.** A `RETURN_EMPTY` mutant was requested — the same family
member BIND-1 used as its must-fire control, discriminated there by 71 of 93 cases. It was
never served. The witness ran against the original module and reported **2 PASS, exit 0.**

Read from the witness outcome alone, that is:

    mutant ran -> no case discriminated -> no difference -> equivalent -> preserved

Every step of which is false. Failure to attach would have been recorded as evidence of
preservation — the strongest possible false positive this apparatus can produce, and the
inversion the contract's R11 was written to make unscorable. It was caught by the served file's
own load-time self-identification, which reported `SUBJECT` where `MUTANT` was requested.

This is not a hypothetical trap that was avoided. It is an occurrence, observed, in the first
run after the contract was frozen. Had R11 been written after this probe instead of before it,
the result would have been indistinguishable from tuning.

## What this establishes

1. BIND's transport does not reach CommonJS by `require` on this Node. The environmental
   assumption BIND was born with — ESM module resolution — is real, load-bearing, and now
   measured rather than suspected.
2. The evidence contract worked as designed: the one requirement deliberately left UNKNOWN at
   step 1 is exactly the one that failed, and it failed into a typed state rather than into a
   plausible number.
3. Steps 1–2 were not wasted by the failure. The foreign shape is recorded (33 witnesses, 776
   uniquely identified cases, coverage emits for CJS, zero side effects on the foreign tree),
   so everything except R8 is known to be available. A future BIND-CJS transport would inherit
   a measured target rather than a fresh survey.

## What this explicitly does NOT establish

- Nothing about the engine's correctness, behaviour, or defects. No mutation matrix ran.
- Not that CommonJS is unreachable in principle — only that **this** mechanism does not reach
  it. `module.registerHooks`, a `Module._load` patch, or a require hook might; all three are
  prohibited by this contract (prohibition 2) and none was tried.
- Not that BIND fails to transfer in general. One foreign codebase, one mechanism, one attempt.

## What is NOT being done, deliberately

No new transport. A CJS interception mechanism can be built later as **BIND-CJS**, under its own
preregistration, and it would be a new experiment with a new question. It cannot retroactively
make this transfer succeed, and building one tonight would convert a clean negative into an
apparatus tuned until it passed.

## Apparatus failures

One, in the write-up path rather than the measurement: a `sed` patch interpolated a literal
`'+D.executedIdentity+'` into the verdict template, so the first generated artifact carried a
malformed sentence. The numbers were unaffected; the file was regenerated after an Edit-tool
fix. This is the recorded "never pass prose through a shell argument" hazard, occurrence N+1,
committed inside the write-up of a result about not trusting representations.

## The single strongest next falsification

Ask whether R8 is the ONLY unmet requirement, by attempting the same transfer against a foreign
ESM codebase with no manifest — isolating "CommonJS" from "no documented invocation" as causes.
This experiment cannot separate them: R4 was already UNESTABLISHED before R8 failed.

## Artifacts

`cjs-interception-probe.json` (four arms, full records), `cjs-probe.{A,B,C,D}.jsonl` (load-time
self-identifications), `legasus/transfer/cjs-probe/*` (fixture), `engine-shape.json`,
`STEP1-NATIVE-SHAPE.md`, `step1.log`. Commits: b822ed6 (step 1), 7ba9c9e (contract), and this
result's commit.
