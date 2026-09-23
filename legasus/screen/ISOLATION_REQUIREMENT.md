# ISOLATED EXECUTION ENVIRONMENT — capability survey and requirement

Date: 2026-09-23 (corrected same day)
Status: **ISOLATION QUALIFIED 2026-09-23, 21/21** (`server/workerIsolation.test.mjs`).
Step 3 was blocked; the blocker is resolved and the qualification has run. Same-user ACLs are abandoned; the bypass is
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

## The blocker, corrected twice

**CORRECTION 1 — "the crash is fixed" was wrong.** Setting `EnableDockerAI: false` did **not**
stop it. I checked `docker-desktop.exe.log` (the GUI log) and reported the crash gone; the
backend log `com.docker.backend.exe.log` shows it recurring on every launch since:

    [04:59:46] backend crashed ... starting services: initializing Inference manager:
    listening on unix://C:/Users/.../Docker/run/dockerInference:
    remove ...: The file cannot be accessed by the system.

**CORRECTION 2 — the cause is not terms acceptance.** The earlier record said provisioning
"needs GUI interaction and acceptance of terms". **Nothing in the UI or the logs said that.** It
was inferred from "no distro + empty VM logs", which establish only that the backend never
booted. Retracted.

**The actual cause, from Docker's own log.** Three orphaned entries in
`%LOCALAPPDATA%\Docker\run\` cannot be stat'd or deleted at all:

    -????????? ? ? ? ? dockerEthernetVfkit
    -????????? ? ? ? ? dockerInference
    -????????? ? ? ? ? userAnalyticsOtlpHttp.sock

Docker `remove`s that path before listening on it, the remove fails, and the backend dies before
any engine starts. That is why there is no distro and no VM log — those are **downstream** of the
crash, not independent evidence of a setup requirement.

(An earlier `rm -f` on that path appeared to succeed only because its stderr was discarded —
the same class of mistake as reading the wrong log.)

**Attempted fix:** the entries resist `rm`, `Remove-Item -Force` and `File.Delete` alike
("The file cannot be accessed by the system"), so the **directory was renamed aside**
(`run.broken-<timestamp>`) for Docker to recreate. Non-destructive and reversible. Whether it
works is an empirical question answered by the engine starting, not by this paragraph.

## Concrete setup needed

Rather than substituting another cosmetic restriction, the requirement is stated plainly. Any
**one** of these unblocks step 3:

1. **Docker Desktop starts after the orphaned-socket fix.** The crash cause is identified and
   a non-destructive fix is applied. No user action is known to be required — the earlier
   "acceptance of terms" claim is retracted, and nothing should be treated as needing your
   attention unless a prompt is actually observed and shown to you.
   Then: `node server/workerIsolation.test.mjs`.
2. **Install a WSL distribution** (`wsl --install -d Ubuntu`) and run the worker there.
   **RETRACTED: disabling `/mnt/c` automount is NOT sufficient.** An ordinary WSL distro needs
   its own full qualification — Windows interoperability (`/init`, launching `.exe`s, which
   reaches the host as the host user), any ability to mount host filesystems from inside, and
   `\\wsl.localhost` paths in the other direction. Turning off one automount addresses one
   route out of several. Do not treat a WSL distro as isolated without qualifying it.
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

### What ENOENT does and does not show

`d2Access` had to reject `ENOENT` as a denial signal, because it was denying reads of a path
that existed. Under namespace isolation the audit store is simply **not present** in the worker's
filesystem, so `ENOENT` is the expected result.

**It is not inherently stronger evidence.** A mistyped path produces exactly the same `ENOENT`.
The result means something only because of what surrounds it: the **positive controls** (the
worker reads, writes and runs tools in its workspace, and the write lands on the host) show the
probe works, and the **escape probes** (no mount, no docker socket, non-root, no network) show
the worker cannot make the path appear. `ENOENT` is consistent with isolation; the controls and
escape probes are what give it meaning.

## Scope

Not claimed: container escape resistance against a kernel-level attack. The claim is scoped to
what the campaign needs — an agent command route that cannot reach host audit storage, other
runs, or credentials. Both arms run through the same worker, image, mounts, limits and network
policy: isolation is apparatus, never treatment.

## What this does not affect

The paired prevention result stands. The failed ACL experiment limits the **campaign
environment**, not that completed local result.

---

# RESOLVED — 2026-09-23, 21/21

## The blocker, finally

Not terms acceptance, not provisioning, not virtualization. Socket files Docker must remove
before listening on them could not be accessed at all, in two directories:

    %LOCALAPPDATA%\Docker\run\                       (Inference manager)
    %LOCALAPPDATA%\docker-secrets-engine\engine.sock (Secrets Engine)

Each launch died at the first such socket, so the engine never started, so there was no WSL
distro and no VM log. Renaming both directories aside — non-destructive, originals kept as
`*.broken-*` — let Docker recreate them. Engine up: `server=29.6.1 os=linux`.

Nothing here needed the operator, and nothing needed a reboot.

## The image is pinned by digest

    node@sha256:b6f26b36c8ff49624cfdac716b8ea1138d606df02586a77d364bb5536a634f85   # node:22-alpine

A tag is a moving pointer. `node:22-alpine` resolving to a different build between ARM A and
ARM B would make the arms differ in their toolchain while every record still said they matched.
Both arms run the same digest, the same mounts, the same limits, the same `--network none`.

## A probe artifact caught by the failing assertion

The first run reported **the host filesystem is visible** — and it was wrong. On a non-zero exit
`runInWorker` fell back to `e.message`, which execFile fills with the **entire argv**, including
`-v C:\Users\tatte\...`. The probe matched `Users` in its own harness output, not in the
container.

Two things follow, and the second matters more:

1. The isolation was fine all along — `/mnt` is empty, `/host_mnt` and `/c` do not exist.
2. **That fallback was a real leak.** Any failing command would have handed the model the host
   workspace path and every isolation flag. Removed: worker output is now stdout+stderr only.

## What is qualified

    permitted workspace operations   READ, WRITE (landing on the host), run tools    PASS
    known-path audit read            nothing returned                                PASS
    cross-run repository read        nothing returned                                PASS
    host filesystem visible          no                                              PASS
    mount from inside                permission denied                               PASS
    docker CLI / socket              absent                                          PASS
    root inside                      no (uid 1000)                                   PASS
    network                          none                                            PASS
    NEGATIVE CONTROL: same-user ACL revoke on the host                    STILL WORKS PASS

The last line is what makes the rest mean anything: the probe can still detect success where
success exists.

## Still not claimed

Container escape resistance against a kernel-level attack. The claim is scoped to the campaign's
need — an agent command route that cannot reach host audit storage, other runs, or credentials.
