---
name: gpu-same-failures-11x-faster
description: MODEL-CMP-1 arm C 2026-09-27 - the same 1.5B on a Modal A10G generated 11.9x faster (114 vs 10.6 tok/s) and produced the same failures, 0/5 accepted both arms; under $0.10 of a $2 cap
metadata:
  type: project
---

2026-09-27, MODEL-CMP-1 arm C (authorized $2, spent under $0.10): the SAME
qwen2.5-coder:1.5b served by ollama on a Modal A10G, same five seeds, same weights and
quantization (digest d7372fd828518a…, Q4_K_M - verified identical), same prompt, suffix,
decoding, output processing and acceptance gate.

    generation   16.4 s -> 1.4 s mean, 10.6 -> 114.4 tok/s   (11.9x)
    accepted     0/5 -> 0/5      planting clause 0/5 -> 0/5      movement 4/5 -> 4/5

**A speed result that does not touch the coding problem.** Two jobs separate here: GPU
acceleration buys RESPONSIVENESS; feature building still needs a GENERATION improvement.
It does NOT show an inherent 1.5B limit - interface questions stay open and this is one
exploratory configuration at five seeds per cell.

**Arm C2 removed the version confound** (same $2 authorization, +$0.075): the container
pinned to ollama 0.33.3, matching local, verified in the build log and the server's startup
line. Outcomes unchanged (0/5 accepted), and it added two facts:

- arms C and C2 produced **byte-identical candidates on all five seeds**, so the ollama
  version was NOT what made CPU and GPU text differ;
- with version, digest, quantization and options identical, **CPU and GPU still disagree on
  3 of 5 seeds** - the hardware alone changes the sampled text.

Differing text under matching seeds removes the PAIRING, not the comparison: aggregate
outcomes on the same task and gate stand; differencing seed N against seed N does not.

Serving recipe that worked: `server/modalOllama.py` - debian_slim + apt zstd (ollama's
installer extracts a zstd archive), install ollama, `ollama pull` at BUILD time so a cold
start does not re-download, FastAPI proxying ollama's own /api/generate and /api/chat
verbatim including streaming, A10G, min_containers=0, scaledown_window=300,
max_containers=1. Cold start 62 s. Container window 235 s total = $0.072 at $0.000306/s.
Stop with `modal app stop <name> --yes` and verify 0 tasks.

**Windows gotcha:** Modal's progress spinner crashes the cp1252 console -
`'charmap' codec can't encode character '\u280b'`. Run the CLI with PYTHONUTF8=1 and
PYTHONIOENCODING=utf-8 or the client aborts while the build itself is fine.

**How to apply:** for a backend comparison, verify the model DIGEST and the wire rendering
before spending attempts, and record the server version - it is a confound you cannot
remove afterwards. See [[verifying-costs-more-than-generating]],
[[one-handler-task-still-unbuilt]], [[modal-stop-needs-yes]], [[modal-spend-policy]].
