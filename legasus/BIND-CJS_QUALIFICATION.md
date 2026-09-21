# BIND-CJS step 2 — qualification preregistration (frozen 2026-09-21 02:05, BEFORE any mechanism exists)

Builds on `legasus/BIND-CJS_PROPERTIES.md` (c6e62bf), which froze the eleven evidentiary
properties the ESM transport demonstrably provides and named E2 (*bypass is distinguishable
from substitution*) as the one it does **not** provide by itself.

## Target

Construct the smallest CommonJS intervention mechanism that satisfies the frozen D-properties
and **experimentally earns E2 and the scope property**, without changing BIND's interpretation
rules and without modifying any subject.

## The identity triple, and the states it must never collapse

Every intervention produces three identities, from three different places:

    requested   what the driver asked for                  driver's record
    served      what the mechanism says it answered with   mechanism's own log
    executed    what actually ran, observed in-process     the loaded file's self-identification

`executed` is never taken from the mechanism's claim. A mechanism that reports success is not
evidence that success occurred; that is the whole lesson of TRANSFER-BIND arm B.

State function, frozen (evaluated in this order):

    executed is absent                          -> SUBSTITUTION_UNOBSERVED
    served is absent AND executed == SUBJECT    -> SUBSTITUTION_UNOBSERVED     (total bypass)
    requested != served                         -> IDENTITY_MISMATCH           (wrong intervention)
    served != executed                          -> TRANSPORT_CONTRADICTION     (claim vs observation)
    requested == served == executed             -> VALID_INTERVENTION
    any scope module's executed identity
      != its own identity                       -> SCOPE_VIOLATION

`TRANSPORT_CONTRADICTION` is included although no such failure has been seen: a mechanism whose
log says it served M while the process ran SUBJECT is distinct from both bypass and wrong
intervention, and the three must not collapse. Only `VALID_INTERVENTION` (with no
SCOPE_VIOLATION anywhere in the same run) may be handed to BIND as an evidentiary intervention.

## Conditions, each with its preregistered expected state

Run against a SYNTHETIC CommonJS fixture whose answers are known in advance. The foreign engine
is **not** used at this step — if the mechanism is developed against the transfer target, the
target is contaminated and the later transfer means nothing.

| # | Condition | Setup | Expected state | Expected witness |
|---|---|---|---|---|
| Q-A | Normal substitution | requested M, mechanism configured with M | `VALID_INTERVENTION` | FAIL (behaviour differs) |
| Q-B | Identity substitution | requested M0 (byte-identical copy), mechanism configured with M0 | `VALID_INTERVENTION` | PASS (behaviour identical) |
| Q-C | Total bypass | requested M, mechanism configured so it never answers the require | `SUBSTITUTION_UNOBSERVED` | PASS — and this PASS must never score as equivalence |
| Q-D | Wrong substitution | requested M1, mechanism configured with M2 | `IDENTITY_MISMATCH` | (unconstrained) |
| Q-E | Scope preservation | requested M for TARGET only; witness also requires DECOY | `VALID_INTERVENTION` and DECOY executes as DECOY | FAIL on target cases, PASS on decoy cases |
| Q-F | Scope negative | requested M for DECOY only; TARGET must be untouched | `VALID_INTERVENTION` and TARGET executes as TARGET | PASS on target cases, FAIL on decoy cases |
| Q-G | No request at all | nothing requested | `SUBSTITUTION_UNOBSERVED` (nothing to substitute) and SUBJECT executes | PASS |

Q-C and Q-D are the adversarial pair. Q-C is the failure already observed in the wild
(TRANSFER-BIND arm B). Q-D is its adjacent, unobserved sibling — *something happened, but not
the thing authorized* — predicted and controlled for **before** any implementation exists. A
mechanism that merely records `intercepted: true` passes Q-C and fails Q-D, which is exactly
why the triple is required rather than a boolean.

## Predictions

**Q1.** `module.registerHooks` (synchronous hooks, Node >= 22.15) WILL intercept a CommonJS
`require`, where `module.register` with an async ESM `resolve` hook did not.
FALSIFIER: it does not. Then this candidate mechanism is recorded `CANNOT_ATTACH` and the
attempt **stops for a decision** — it does not silently escalate to a `Module._load` patch or
any other candidate. Each candidate mechanism is named before it is tried.

**Q2.** All seven conditions produce their preregistered state on the first qualifying run.
FALSIFIER: any mismatch. A mismatch is an apparatus-development result, reported as such; the
fixture is synthetic precisely so that such a failure costs nothing and burns no foreign target.

## Constraints carried from the frozen contracts

- BIND's klass rules, refusal states and edge licensing are **not modified**. If qualification
  requires changing them, that is a different experiment.
- No subject is modified. Self-identification lives in files Legasus itself generates (mutants
  and the identity copy), never in a subject's own tree — the same design the ESM path already
  uses for its baseline arm.
- The mechanism is not pointed at the foreign engine until every condition above has produced
  its preregistered state. Qualification and transfer are separate runs with separate records.

## What qualification would and would not earn

Qualifying earns exactly: *a CommonJS intervention mechanism exists which satisfies the frozen
evidentiary properties on a synthetic fixture.* It earns nothing about the foreign engine, and
nothing about extracting an Intervention interface — that requires the mechanism to also
transfer, after which two materially different module systems will have independently satisfied
one frozen contract.
