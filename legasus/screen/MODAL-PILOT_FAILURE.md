# MODAL DID NOT SERVE THE PILOT — 2026-09-23

Requested: run the pilot on Modal ("faster and better for the tests").
Outcome: **the app deployed but never served a request.** The pilot ran on the local
`qwen2.5-coder:1.5b` instead.

## What was deployed

    MYCODER_BASE=Qwen/Qwen2.5-Coder-7B-Instruct
    MYCODER_GPU=A10G          # the 30B default is refused on A10G by the script's own guard
    MYCODER_APP=legasus-pilot
    MYCODER_MIN_CONTAINERS=1

`modal deploy` succeeded and printed a web URL.

## What actually happened

    modal app list     ->  deployed, Tasks 0
    modal app logs     ->  EMPTY (0 bytes) - no container ever logged anything
    curl /api/tags     ->  HTTP 303 after 150s, then hangs; -L follows into a hang
    the waiter's error ->  modal-http: invalid function call

`Tasks 0` with **no logs at all** means no container started, so this is not a slow model load.
The `modal-http: invalid function call` line points at the web endpoint's binding rather than at
vLLM: the ASGI/web function is not being invoked at all. `min_containers=1` did not produce a
task either, which is consistent with the same fault.

## Not diagnosed

Why the web function is not invocable under this modal client (1.5.0) / server pairing. It is a
real question but it is **infrastructure, not Legasus**, and chasing it would have consumed the
pilot window it was meant to serve.

## What was done

The app was **stopped** (`modal app stop --yes`, confirmed `stopped`) so it cannot bill. Nothing
was charged for a served request because nothing was served.

## Why the pilot still ran

The pilot's question is **unattended execution and trustworthy accounting**, which the model
choice does not decide. A 1.5B is if anything a harsher test of the accounting paths, because it
stalls and fails more, which is what exercises FAILED / timeout / partial-state handling.

It does mean **this pilot says nothing new about productivity** beyond the already-recorded
12-19s stall. That was never its purpose, and the two must not be conflated in the report.
