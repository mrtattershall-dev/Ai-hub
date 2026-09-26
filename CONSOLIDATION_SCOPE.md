# CONSOLIDATION — scope, frozen before any merge

**Branch** `consolidation/connect-components`
**Base** `f7df108e97de7f3a7b79b52de02be75554c098e6` — the controller branch's recorded current commit
at the time this worktree was created (`phase2-d2-intervention`, clean tree).

## What this is, and the one claim it may eventually make

> **Do the separately tested components work together?**

That is the third of three claims, and it is not the other two:

| claim | status at the time of writing | where its evidence lives |
|---|---|---|
| the controller improves repair economics | **has live evidence** — 30/30 replay, PILOT-1, OVERNIGHT-1 | `phase2-d2-intervention`, tagged `controller-v1` |
| frozen r4 transfers to an untouched repository | **unstarted** — no freeze, no Repo D | `integration/epistemic-admission` |
| **the components work together (this branch)** | **unstarted** | nowhere yet |

**Nothing here transfers the controller's validation to the combined version.** Basing on the controller
branch preserves a live-tested starting point whose behaviour can be checked as integration proceeds. It
does not carry its results forward, and it does not by itself place behavioural risk on the other side.

## Base provenance

    controller-v1        d1449a06   annotated tag — replay 30/30, PILOT-1, OVERNIGHT-1
                                    policy maxAttempts 2 / maxRepeats 2 / maxProvisional 3
                                    DISCARD restores the verified checkpoint
    + b08f06e            freeze controller-v1; crash-diagnosable/resumable/sleep-proof campaigns;
                         cost per repair; EVAL-1 frozen (not launched)
    + f7df108            EVAL-1 authorization recorded, frozen before deploy   <- THIS BASE

The base is **two commits past** the validated tag. `controller-v1` remains an ancestor and is not
modified, moved, or recreated by anything on this branch.

## Trial-merge assessment (reversible; `git merge-tree`, no worktree, index or ref touched)

    integration + indent          CLEAN, zero conflicts        42 vs   6 commits
    integration + phase2          4 conflicted paths          471 vs 199 commits
    indent      + phase2          3 conflicted paths          435 vs 199 commits

670 commits of divergence, four conflicted paths. **Commit counts established nothing about difficulty
and should not be cited as if they had.**

| path | kind | reconciliation |
|---|---|---|
| `.gitignore` | content | mechanical |
| `COORD.md` | content | mechanical — append-only, both sides appended |
| `legasus/contracts/ENTITLEMENT-CERTIFICATE.md` | add/add | **strict superset** — byte-identical through line 120; phase2 appends v1.2 and states v1.0.0/v1.1 are preserved unmodified. Take phase2. |
| `server/agent.js` | content | **4 hunks in 6,321 lines, all on `_toolGoal`/`_activeRun` staleness** — both branches independently attacked the same defect |

**CLEAN MERGE MEANS NO TEXTUAL CONFLICTS, NOT ZERO RISK.** Changes that combine cleanly can still
disagree at runtime, and the `integration + indent` result is therefore unvalidated until exercised, not
safe because git was quiet.

## The consequential finding: consumer-owned obligations

v1.2 of the certificate contract exists because of a vacuous-pass defect on the exact seam this branch
has to cross:

    derive() computes missing witnesses from rule.requires
    the adapter wrote requires: [] itself
    -> the witness check passed VACUOUSLY: the calculus enforcing correctly against a rule that
       asked for nothing

v1.2 splits ownership — certificate carries `rule_id`, `rule_digest`, `relation_witnesses[]` (identity
and established facts); the **consumer** owns `ADMITTED_RULES[rule_id] -> { name, requires }` (the
obligation); `derive()` refuses against the **local** requires.

**Keeping v1.2's text does not establish that the adapter and consumer enforce it.** Implementation
compatibility is a separate check and is part of this branch's work.

## The end-to-end test — definition, before any merge

Coexistence is not connection. **Green component tests in one tree show those tests pass together** —
not that every interaction is safe. An end-to-end test establishes only the particular connected path it
exercises, including its rejection and restoration legs.

**Path:** proposed edit -> certificate constructed -> adapter -> `legaknow` constructor -> admission ->
controller handling -> accept, **or** DISCARD restoring the verified checkpoint.

**Four required legs.** Two of them are where this can pass vacuously, which is why they are legs and
not assertions bolted on afterwards:

1. **ACCEPT** — a legitimate edit transits and is admitted.
2. **REJECT** — admission refuses, and the refusal **names the constructor that failed**, not merely
   that something did.
3. **RESTORE** — DISCARD returns the tree to the verified checkpoint, asserted by **content digest**,
   not by absence of error.
4. **NON-BYPASS (the one the v1.2 defect demands)** — an **empty adapter-supplied requirement list must
   not bypass a nonempty consumer requirement**. The test constructs exactly that: a certificate
   offering `requires: []` against an `ADMITTED_RULES` entry whose `requires` is nonempty, and asserts
   admission is REFUSED. Without this leg, legs 1-3 can all pass while admission means nothing.

## COMMIT AUTHORIZATION IS BLOCKED ON THIS BRANCH

    a legitimate KNOWLEDGE certificate is NOT permission to COMMIT

`admission.mjs` admits knowledge only; `commit()` consumes normative authority and explicitly refuses
epistemic tokens. **That refusal stays.** Nothing on this branch may connect an admitted certificate to
commit authority. The epistemic x normative join requires a separately defined normative obligation and
its own validation, and it is **out of scope here by construction** — so that "combine existing work"
cannot quietly become "invent and validate the missing authority model."

The end-to-end path therefore terminates at admission plus controller handling. Where the connected path
ends is **reported honestly as ending there**, not extended to make the demonstration look complete.

## Out of scope

- The R4 freeze and Repo D. Separate claim, separate branch, separate readiness criteria.
- New authority design of any kind, including the normative obligation named above.
- Any change to `controller-v1`, its record, or the corrected cost account that belongs beside it.

## On the cost account, for anyone reading results from the base

The historical **"half the task time"** headline does **not** replace the later sleep-adjusted finding of
roughly **45% lower cost per accepted repair**. Both stay in the record, the corrected account alongside
the original. And the regression result is **earlier containment, not damaged deliveries prevented**:

    regressions produced during execution    controller on 0    off 11
    regressions surviving final acceptance   controller on 0    off  0

Both arms protected final delivery.
