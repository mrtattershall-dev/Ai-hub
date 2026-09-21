# BIND-CJS step 2 result — MECHANISM QUALIFIED on a synthetic fixture (2026-09-21 02:30)

Preregistration: `legasus/BIND-CJS_QUALIFICATION.md` (c45aab6), frozen before the mechanism
existed, plus amendment Q-1 (added after run 1, before any result record). Properties contract:
`legasus/BIND-CJS_PROPERTIES.md` (c6e62bf). Raw: `qualification.json`, per-condition marker and
mechanism logs.

**The foreign engine was not used and is not touched by this result.** Qualification and
transfer are separate runs with separate records.

## Candidate mechanism

`legasus/cjs-preload.mjs` — `module.registerHooks` (synchronous, in-thread). This is not the ESM
transport ported: `module.register` installs an asynchronous off-thread loader that answers ESM
resolution only, measured at TRANSFER-BIND (db4f3d9) to leave a CommonJS `require` on the
original and say nothing. **Q1 CONFIRMED**: the synchronous hooks do participate in CommonJS
resolution.

## The eight conditions

| id | requested | served (mechanism's claim) | executed (observed in-process) | state | wanted |
|---|---|---|---|---|---|
| Q-A normal | TARGET_M1 | TARGET_M1 | TARGET_M1 | VALID_INTERVENTION | ✓ |
| Q-B identity copy | TARGET_M0 | TARGET_M0 | TARGET_M0 | VALID_INTERVENTION | ✓ |
| Q-C total bypass | TARGET_M1 | *(none)* | TARGET | SUBSTITUTION_UNOBSERVED | ✓ |
| Q-D wrong mutant | TARGET_M1 | TARGET_M2 | TARGET_M2 | IDENTITY_MISMATCH | ✓ |
| Q-E scope positive | TARGET_M1 | TARGET_M1 | TARGET_M1 (decoy = DECOY) | VALID_INTERVENTION | ✓ |
| Q-F scope negative | DECOY_M | DECOY_M | DECOY_M (target = TARGET) | VALID_INTERVENTION | ✓ |
| Q-G no request | — | *(none)* | TARGET | SUBSTITUTION_UNOBSERVED | ✓ |
| Q-H live scope violation | TARGET_M1 | TARGET_M1 | TARGET_M1 (decoy = DECOY_M) | SCOPE_VIOLATION | ✓ |

Classifier must-fire checks: 6/6, including `TRANSPORT_CONTRADICTION`, which an honest mechanism
cannot produce and is therefore checked at the state function rather than through a process.
**All five states are demonstrated producible.** No frozen state is unfalsifiable.

Q-C reproduces, under a mechanism that works, the failure observed in the wild at TRANSFER-BIND
arm B: the witness PASSES (exit 0) because it ran against the original, and the state is
`SUBSTITUTION_UNOBSERVED`, never equivalence. Q-D is its adjacent sibling, predicted before any
implementation existed: the witness FAILS and looks like a successful intervention, and the
state is `IDENTITY_MISMATCH` because the served identity is not the requested one. **A mechanism
recording `intercepted: true` would pass Q-C and fail Q-D.** That is why the triple exists.

## Apparatus defect found by the amendment, run 2

Run 1 produced 7/7 preregistered states. Amendment Q-1 then added Q-H and the classifier checks,
because two of the six frozen states had never been produced by anything and so were not yet
controls. **Q-H immediately failed**, reporting `IDENTITY_MISMATCH` where `SCOPE_VIOLATION` was
expected — and the defect was in the driver, not the mechanism: `served` was selected as the
*last* substitution record in the run rather than the one for the module the condition aimed at.
Every earlier condition performed at most one substitution, so "last" was accidentally correct
in all seven. Q-H is the first condition with two, and it exposed the selector.

Repaired (`served` keyed to the aimed module's path), run 3: 8/8 plus 6/6 classifier checks.

Consequence worth stating plainly: **run 1's clean sweep was partly luck.** A control added
specifically because a state could not fire found a real attribution bug within one run, in a
driver that had already produced a perfect score. Recorded in the amendment before the repair,
not after.

## Verdict

    QUALIFIED — a CommonJS intervention mechanism exists which satisfies the frozen
    evidentiary properties on a synthetic fixture whose answers were known in advance.

## What this earns, and what it does not

Earns: exactly the sentence above. E2 (*bypass is distinguishable from substitution*) and the
scope property are now **experimentally demonstrated** for this mechanism, not read from source
— which is more than the ESM transport can claim for E2, since that distinction came from the
contract around it rather than from the transport itself.

Does not earn: anything about the foreign engine; anything about BIND's interpretation (klass
rules, refusal states and edge licensing are untouched); and **not** the Intervention interface.
That gate requires this mechanism to also transfer, after which two materially different module
systems will have independently satisfied one frozen contract. One implementation plus a diagram
is not evidence.

## Next

Step 5: point the qualified mechanism at the foreign engine, under the existing TRANSFER-BIND
contract (7ba9c9e), as a separate run with a separate record. R4 stays UNESTABLISHED there
regardless of whether R8 now succeeds — successful substitution must not be allowed to establish
canonical invocation. Not started.
