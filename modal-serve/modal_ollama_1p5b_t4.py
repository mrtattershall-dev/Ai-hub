"""
Serve Qwen2.5-Coder-1.5B on a Modal T4, for the contract-vs-baseline experiment.

WHY A SEPARATE FILE rather than a parameter on modal_ollama_qwen.py: that app is
"hub-coder" serving a 14B on an A10G, and a running window must not be disturbed to run an
experiment. This is its own app name, its own GPU, its own scaledown - so stopping this one
cannot stop that one.

WHY T4: a 1.5B at q4 is roughly 1GB. The 16GB T4 is the cheapest card that comfortably
holds it with context, and the experiment is about the APPARATUS, not about throughput.

THE MODEL IS THE CONSTANT. Every earlier measurement of this model predates the structural,
transaction and semantic contracts. It is byte-identical to the one that scored badly, so
any difference between the two arms belongs to the framing and not to the weights.

RULE 3: /api/health must name the exact model before any generation runs. The endpoint is
exposed below and the runner checks it first - a run against an unverified model measures
nothing, which this project has paid for before.

DEPLOY
    python -m modal deploy modal-serve/modal_ollama_1p5b_t4.py

STOP - and it must be --yes, the command prompts and aborts non-interactively without it,
which cost five over-cap minutes on 2026-09-10:
    python -m modal app stop legasus-1p5b --yes
    python -m modal app list
"""

import subprocess
import time

import modal

MODEL = "qwen2.5-coder:1.5b"
VOLUME_NAME = "hub-ollama-models"
MINUTES = 60

app = modal.App("legasus-1p5b")

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# The published ollama image, not debian_slim + install script: the installer runs at image
# BUILD time where Modal attaches no GPU, detects none, and lays down the CPU-only build -
# which then runs on a GPU you are paying for. Measured before that was understood: 3.6
# tok/s. The published image ships the CUDA runtime unconditionally.
image = (
    modal.Image.from_registry("ollama/ollama:latest", add_python="3.11")
    .entrypoint([])
    .apt_install("curl")
)


@app.function(
    image=image,
    gpu="T4",                        # 16GB - a 1.5B q4 (~1GB) fits with very large context
    volumes={"/root/.ollama": volume},
    scaledown_window=5 * MINUTES,    # short: this is a bounded experiment, not a service
    timeout=20 * MINUTES,
    min_containers=0,                # scale to zero -> no idle cost
)
@modal.concurrent(max_inputs=1)
@modal.web_server(11434, startup_timeout=15 * MINUTES)
def serve():
    # OLLAMA_HOST matters: the default binds loopback only, and Modal's proxy reaches the
    # container from outside, so a loopback-only daemon looks like a dead port.
    subprocess.Popen(
        ["ollama", "serve"],
        env={
            "OLLAMA_HOST": "0.0.0.0:11434",
            "HOME": "/root",
            "PATH": "/usr/local/bin:/usr/bin:/bin",
        },
    )

    for _ in range(120):
        try:
            subprocess.run(["curl", "-sf", "http://localhost:11434"], check=True, capture_output=True)
            break
        except subprocess.CalledProcessError:
            time.sleep(1)
    else:
        raise RuntimeError("ollama serve never came up")

    # Idempotent: first boot downloads, later boots find it on the volume and return at once.
    print(f"[legasus-1p5b] pulling {MODEL} (no-op if the volume already has it)")
    subprocess.run(["ollama", "pull", MODEL], check=True)
    volume.commit()
    print(f"[legasus-1p5b] {MODEL} ready")
