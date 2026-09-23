# ISOLATED EXECUTION ENVIRONMENT — capability survey and requirement

Date: 2026-09-23
Status of step 3: **BLOCKED ON THIS LAPTOP.** Same-user ACLs are abandoned; the bypass is
demonstrated and preserved (`server/d2Revoke.test.mjs`, red by design).

## The arrangement being implemented

    host controller   owns audit captures, restoration decisions, experiment records
    agent worker      receives ONLY its workspace and the tools it needs
    audit storage     not reachable from the worker, including via credentials or APIs
    other runs        not reachable from the worker

No environment earns this status by its name. `server/worker.js` implements it as a container
worker; `server/workerIsolation.test.mjs` is the qualification and currently cannot run.

## What this host actually has — surveyed, not assumed

| capability | state | usable? |
|---|---|---|
| WSL 2 | kernel 6.18.33.2, WSLg present, **no distribution installed** | not yet |
| Docker Desktop | **installed**, 4.81.0, CLI 29.6.1 | engine not up |
| Windows Sandbox | Windows 11 **Home** — Pro/Enterprise only | no |
| Hyper-V (native) | Windows 11 **Home** | no |
| Virtualization | `HypervisorPresent=True`; WSL2 kernel loaded | **yes** |
| Modal (remote) | python package present, CLI not on PATH | possible, unqualified |

Virtualization is **not** the blocker.

## The two blockers found, in order

**1. Docker Desktop crashed at startup — identified and fixed.**

    starting services: initializing Inference manager:
    listening on unix://C:/Users/.../Docker/run/dockerInference:
    The filename, directory name, or volume label syntax is incorrect.

The Docker AI inference manager could not create its socket. `EnableDockerAI` was set to false
in `settings-store.json` (backed up alongside as `.bak-legasus`). The crash no longer appears in
the host log.

**2. The Linux backend has never booted — still blocking.** There is no WSL distribution, and
`log/vm/` contains no logs at all, so the VM has not started once. Docker Desktop must provision
its own `docker-desktop` WSL distro, and that has not happened unattended.

## Concrete setup needed

Rather than substituting another cosmetic restriction, the requirement is stated plainly. Any
**one** of these unblocks step 3:

1. **Finish Docker Desktop's backend provisioning** — open the Docker Desktop window and
   complete whatever it is waiting on (sign-in, onboarding, or an engine-start prompt), and let
   it install its WSL distro. A reboot may be required. This is a GUI interaction and an
   acceptance of terms, so it is the operator's action, not mine.
   Then: `node server/workerIsolation.test.mjs`.
2. **Install a WSL distribution** (`wsl --install -d Ubuntu`) and run the worker there instead.
   Requires creating a Linux user account inside the distro — again the operator's action.
   `/mnt/c` automount must be disabled in `/etc/wsl.conf`, or the host drive is visible and the
   isolation claim fails exactly as the ACL one did.
3. **A remote worker** (Modal or equivalent) holding only the workspace, with audit storage and
   other runs on the host it cannot reach. Costs GPU-account spend and needs its own
   qualification; the credential the worker holds must not grant read access to audit storage.

## Why off-host append-only storage was rejected

Append-only restricts **modification, not reading**, and says nothing about other repositories.
It does not satisfy "audit storage inaccessible to the worker". Encryption likewise only helps
if the worker cannot obtain the key, and "never written to disk" does not establish that against
a worker running as the same principal.

## The qualification that will run, once an environment exists

Small and decisive, through the actual agent command route:

    permitted workspace operations               SUCCEED   (read, write, run tools)
    known-path audit reads                       FAIL
    cross-run reads                              FAIL
    attempts to REMOVE those restrictions        FAIL      (mount, docker socket, root, network)

**The negative control is the demonstrated bypass.** The same-user ACL revoke that *worked* is
re-run on the host and must still work. Without it, "the worker could not read the audit store"
is indistinguishable from "this probe cannot read anything" — the failure that once printed
*"a real permission boundary exists"* over a mangled command.

### One rule inverts, deliberately

`d2Access` had to reject `ENOENT` as a denial signal, because it was denying reads of a path that
existed. Here the audit store is **not present in the worker's filesystem namespace at all**, so
absence *is* the isolation and `ENOENT` is the correct, stronger signal. That only holds because
the qualification also shows the worker cannot **make** the path appear. Absence plus inability
to obtain is the claim; absence alone would not be.

## Scope

Not claimed: container escape resistance against a kernel-level attack. The claim is scoped to
what the campaign needs — an agent command route that cannot reach host audit storage, other
runs, or credentials. Both arms run through the same worker, image, mounts, limits and network
policy: isolation is apparatus, never treatment.

## What this does not affect

The paired prevention result stands. The failed ACL experiment limits the **campaign
environment**, not that completed local result.
