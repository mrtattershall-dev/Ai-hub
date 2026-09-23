# ACCESS BOUNDARY — QUALIFICATION RECORD

Status: **FALSIFIED AS STATED — NARROWED TO READS ONLY** (2026-09-22)
Reads: 20/20 `server/d2Access.test.mjs`. Revocability: **2 BYPASSES** `server/d2Revoke.test.mjs`.

> **This record overclaimed and is corrected below, not rewritten.** Everything in it about
> DENIED READS is accurate and reproduced. The claim it did not test, and therefore was not
> entitled to make, is who may REVOKE the restriction. See the correction at the end.
Date: 2026-09-22
Answers step 1 of the four-step gate: *permitted workspace reads succeed; known-path reads of
audit storage and other runs' repositories fail for access reasons.*

## What was NOT established before this

`d2Visibility.test.mjs` established **discoverability**: the audit store lives outside the
workspace, no workspace ref points at it, and its path is stripped from the model's environment.
That is a real property and it is not access control. The model's commands run as the **same OS
user** as the hub, in no container. Section 2 of the new test demonstrates the gap directly: a
model-issued `node -e readFileSync(<known path>)` reads the audit bundle **successfully** before
the lock. Hiding is not denying.

## The mechanism

Deny **read only** to the run user on the per-run audit directory
(`icacls <dir> /deny <user>:(OI)(CI)(R) /T`; `chmod -R a-r` on POSIX).

Writes still succeed, so the hub keeps capturing while nothing on this host can read any capture
back — **including the hub**. That is the correct shape for an audit artifact: recovery is an
offline act by someone with different access, not something the campaign's own machinery can
reach. The store is deliberately **not** a recovery resource for either arm.

`lockAuditDir()` never claims a boundary it did not establish. `icacls` reports failures
per-object and still applies others, so the exit code is not the answer; the function **proves**
the lock by attempting a read and requiring `EPERM`/`EACCES`. Anything else — including success —
returns `ok:false`.

## Required ordering

    capture  ->  VERIFY  ->  LOCK

Verification (`git bundle verify`, `list-heads`) needs read, so it must precede the lock.

## Why one directory per run

A single shared audit directory would have denied the **next** run's `bundle verify` too, and the
only way to capture again would be to unlock — re-exposing every earlier artifact for the
duration of that capture. `quarantine()` now writes to `<root>/<runId>/candidate.bundle` and each
capture is sealed the moment it is verified. Section 5 exercises exactly this: a second capture
succeeds and self-verifies **while the first stays denied**.

## Evidence discipline

Every probe runs through the **model's actual command path** — `exec` + shell + workspace cwd +
`modelEnv()` — because probing through any other path measures a different thing than the one at
risk. Every probe carries a **positive control** (a permitted workspace read) in *every* state.

This is not decoration. An earlier version of this probe ran reads through
`execFileSync('cmd', ['/c', ...])`, which mangled quoted Windows paths; an existing file reported
MISSING, every probe returned DENIED, and the run printed *"a real permission boundary exists."*
**A broken probe denies everything.** The control is what separates "denied" from "this probe
cannot read anything". If the control line fails, every line below it is void.

Denial is judged on `EPERM`/`EACCES` only. `ENOENT` is *absence*, a different claim, and is
asserted against explicitly so it cannot pass as denial.

## What is qualified, and what is not

QUALIFIED
- Permitted workspace reads succeed under the lock (positive control, every state).
- Known-path reads of the audit bundle and directory listing fail with `EPERM`.
- A model-issued `git clone` of the bundle fails; no workspace ref points at the audit branch.
- Another run's repository is denied by the same procedure, with the control still green.
- A later run can still capture and self-verify while an earlier capture stays locked.

NOT QUALIFIED — and not claimed
- This is a **same-user ACL boundary on Windows**, not isolation. It denies the run user. It is
  not a defence against privilege escalation, and nothing here is a containment claim.
- There is a window between `mkdir`/write and `lockAuditDir()` in which the *current* run's own
  fresh capture is readable. Per-run directories bound that window to the run being captured;
  **no already-locked artifact is ever unlocked again.**
- Coverage of execution paths is a separate gate (step 2): sites 2690 (subtask) and 4590
  (approved-pending) are still outside the tested route and must be unavailable in both arms or
  qualified on their own before the protocol comparison runs.

---

# CORRECTION — the lock is revocable by the model (2026-09-22)

`server/d2Revoke.test.mjs`, **2 bypasses**. Preserved as a failing test, not patched away: it is
the gate on step 3 and stays red until a chosen isolation contract actually holds.

## What was asked, and what came back

The decisive question was not whether reads are denied but **who may revoke the denial**. The
cleanup procedure raised it: `unlockAuditDir()` runs as the same OS user the model's commands run
as. So the exact unlock sequence was issued **from the model's execution environment** against a
disposable sealed artifact.

    the model revoked its own lock and READ the sealed capture          BYPASS
    the model revoked the lock on ANOTHER run's repository and read it  BYPASS

## Why, at the mechanism level

    C:\...\Temp\...  NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                     BUILTIN\Administrators:(I)(OI)(CI)(F)
                     GRACE\tatte:(I)(OI)(CI)(F)

The run user **owns** the directory and holds Full Control, which includes `WRITE_DAC`. On
Windows an owner can always rewrite the DACL, so a deny ACE aimed at the owner is **advisory
against that owner**. The shell is not even needed for cleverness: two `icacls` calls, the same
two the hub uses. No elevation is available on this host to change the owner.

**A same-user ACL cannot produce a boundary the model cannot lift.** That is a property of the
mechanism, not a tuning failure, and no amount of redesigning quarantine changes it.

## The claim, restated honestly

    WAS   known-path reads of audit storage fail for access reasons
    IS    reads are denied UNTIL THE CALLER CHANGES THE ACL

Per-run directories still do their job — one capture cannot inadvertently expose another — but
they were never about **who may revoke**, and that was the conflation.

## What the test kept honest

Section 4 is the control that makes the negative result mean something: the hub's own
`unlockAuditDir()` **does** release the lock. Without it, "the model failed to unlock" would be
indistinguishable from "the unlock sequence is inert for everyone" — the probe-artifact failure
already recorded once on this exact boundary.

Other runs' repositories were checked **separately**, not inferred from the audit-store result.
Both failed, independently.

## Consequences

Step 3 (clean-snapshot protocol runs) is **blocked**. The options are a decision about the
experiment, not a code change to make quietly:

1. **A separate OS principal** for the agent's commands — the sound fix. The run user is then not
   the owner and holds no `WRITE_DAC` over the audit store. Requires creating an account, which
   is the operator's action, not mine.
2. **Audit storage off this host** — an append-only sink the run user has no credential for.
3. **Encrypt each capture** with a per-run key never written to disk. The model can read
   ciphertext and not content. A practical boundary, weaker than (1): same-user process memory is
   still in principle reachable.
4. **Narrow the published claim** and run anyway — audit storage is *discoverable-but-not-read-by-
   default*, with no isolation claim. Honest, and it means nothing in the campaign may be
   attributed to audit isolation.

Whichever is chosen, the campaign may not describe its audit store as inaccessible.
