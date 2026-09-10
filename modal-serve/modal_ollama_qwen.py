"""
Serve a stock coder model on Modal as a plain HTTPS Ollama endpoint.

Sibling of modal_ollama_serve.py, which serves YOUR fine-tuned GGUF. This one serves an
off-the-shelf model, and it exists because the two have different setup costs:

  modal_ollama_serve.py   a GGUF you built -> upload ~9GB from this laptop to a volume
  modal_ollama_qwen.py    a published model -> `ollama pull` INSIDE the container

The second is minutes instead of hours on a home connection, because Modal's network does
the download, not yours. After the first boot the weights live in a Modal Volume, so every
later cold start reads them from disk rather than the internet.

WHY THIS EXISTS AT ALL
----------------------
The hub's agent loop defaults to `ollama` (agent.js:784), which on this laptop means
phi3:latest — 3.8B. Measured 2026-09-10 on a real queued chain: **~4.5 minutes per model
call**, and its first act on "write a function add(a, b)" was to design an Input System and
a gameplay loop. A 24/7 loop cannot be built on that. This gives the same `ollama` provider
a 14B behind it and changes nothing else in the hub.

SETUP
-----
    python -m modal deploy modal-serve/modal_ollama_qwen.py

Modal prints a URL like https://<workspace>--hub-coder-serve.modal.run — put that in the
hub's Settings as the Ollama provider's `base_url`, and set the model to MODEL below. The
hub already POSTs to {base_url}/api/generate, which is exactly what this exposes, so there
is no hub code to change.

COST
----
`min_containers=0` means $0 while idle. `scaledown_window` keeps a container warm after the
last request so a chain of queued goals does not pay a cold start per step, then stops
billing. Check https://modal.com/pricing — the rates move and nothing here should be
treated as a quote.

The tradeoff worth stating plainly: warm costs money per hour whether or not anything is
generating, and cold costs 30-60s of latency on the first request after an idle gap. For a
queue that works in bursts, warm-for-a-while-then-zero is the right shape; for a loop that
truly runs all night, raise the window and accept the hourly rate.
"""

import subprocess
import time

import modal

# Stock, not fine-tuned. The run5 adapter wins on Phaser and lost on correctness against
# its own base, and the thing being tested here is the agent loop - following a tool
# protocol - not Phaser. Swap this for the fine-tune once the spine is known to work, so a
# failure has one cause and not two.
MODEL = "qwen2.5-coder:14b"

VOLUME_NAME = "hub-ollama-models"
MINUTES = 60

app = modal.App("hub-coder")

# The weights live here, not in the image: a 9GB layer would be rebuilt and re-pushed on
# every edit to this file, and Modal images are immutable.
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# Start from ollama's own image rather than installing ollama into debian_slim.
#
# This is not a style preference, it is the difference between using the GPU and not.
# `curl install.sh | sh` runs at IMAGE BUILD time, where Modal attaches no GPU, so the
# installer prints "Unable to detect NVIDIA/AMD GPU" and lays down the CPU-only build.
# The A10G is then present at runtime with nothing able to address it. Measured before
# this change: 3.6 tok/s generate, 2 tok/s prefill - CPU numbers, on a GPU we were paying
# for. The published image ships the CUDA runtime unconditionally.
#
# `.entrypoint([])` clears the image's own ENTRYPOINT (it launches the ollama daemon),
# which would otherwise pre-empt Modal's runner.
image = (
    modal.Image.from_registry("ollama/ollama:latest", add_python="3.11")
    .entrypoint([])
    .apt_install("curl")
)


@app.function(
    image=image,
    gpu="A10G",                      # 24GB - a 14B q4 (~9GB) fits with room for context
    volumes={"/root/.ollama": volume},
    scaledown_window=15 * MINUTES,
    timeout=20 * MINUTES,            # one request may be a long agent turn
    min_containers=0,                # scale to zero -> no idle cost
)
@modal.concurrent(max_inputs=1)      # one GPU, one request at a time
@modal.web_server(11434, startup_timeout=15 * MINUTES)
def serve():
    # OLLAMA_HOST matters: the default binds loopback only, and Modal's proxy reaches the
    # container from outside it, so a loopback-only daemon looks like a dead port.
    subprocess.Popen(
        ["ollama", "serve"],
        env={"OLLAMA_HOST": "0.0.0.0:11434", "HOME": "/root", "PATH": "/usr/local/bin:/usr/bin:/bin"},
    )

    for _ in range(120):
        try:
            subprocess.run(["curl", "-sf", "http://localhost:11434"], check=True, capture_output=True)
            break
        except subprocess.CalledProcessError:
            time.sleep(1)
    else:
        raise RuntimeError("ollama serve never came up")

    # First boot downloads; every later one finds it already on the volume and returns at
    # once. `ollama pull` is idempotent, so there is no "is it there yet" check to get wrong.
    print(f"[hub-coder] pulling {MODEL} (no-op if the volume already has it)")
    subprocess.run(["ollama", "pull", MODEL], check=True)
    volume.commit()
    print(f"[hub-coder] {MODEL} ready")
