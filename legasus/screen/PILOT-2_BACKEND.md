# PILOT-2 BACKEND — recorded BEFORE the run

Recorded 2026-09-23, before any PILOT-2 generation, so the configuration cannot be described
after the fact to match whatever happened.

| item | value |
|---|---|
| serving | Modal, app `legasus-7b` (`ap-ryhDxnQYgeY1hcXwMKk3Y8`) |
| model | `Qwen/Qwen2.5-Coder-7B-Instruct` |
| GPU | A10G |
| context | 16384 |
| endpoint | `https://mr-tattershall--legasus-7b-server-web.modal.run` (Ollama-compatible) |
| model name to the hub | `mycoder` |
| min containers | 1 (kept warm; scaledown 900s) |
| worker image | `sha256:fa49b576430b1288a585522bbf011fbd218cedcb379eb7bb57e3a69fec08a8c3` |
| measured latency | **1s** for a trivial completion, warm |

## Why the earlier attempt failed

The first app (`legasus-pilot`) deployed but reported `Tasks 0` with **zero log bytes** and the
waiter's error was `modal-http: invalid function call`. No container ever started. Redeploying
under a fresh name produced `Tasks 1` immediately and then served normally, so the fault was the
app's state rather than the script, the decorators, or the GPU. The dead app was stopped.

## Unchanged from PILOT-1

Same five frozen tasks and checks, same seeds (19/19), same identical testing guidance, same
tool set, same per-task 300s / total 30min / 120s reserve, no retries, enforced configuration,
same qualified worker.

**The model is the only intended difference**: 1.5B local → 7B on A10G.

## What PILOT-2 can and cannot settle

CAN
- Whether the repaired report generator produces its required fields automatically, end to end.
- Whether the evaluator's live PASS path is ever exercised (PILOT-1 never reached it).
- Whether a faster, larger model changes verified completions under the same frozen conditions.

CANNOT
- Anything about PROTOCOL-1. Still one arm, still no causal comparison.
- Attribution of any change to model SIZE alone: latency, serving stack and hardware all changed
  together with the parameter count. This is a configuration comparison, not a controlled one.
