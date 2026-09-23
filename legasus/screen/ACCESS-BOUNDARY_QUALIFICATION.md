# ACCESS BOUNDARY — QUALIFICATION RECORD

Status: **QUALIFIED** (20/20, `server/d2Access.test.mjs`)
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
