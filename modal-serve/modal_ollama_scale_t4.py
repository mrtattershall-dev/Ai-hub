"""
Serve several Qwen2.5-Coder sizes from ONE T4, for the scale experiment.

WHY ONE APP AND ONE CONTAINER rather than a window per size: the whole point is that
everything except model capacity is frozen. Same card, same runtime, same daemon, same
volume, same request path. Two containers on two cards would add a second variable for
free, and this project has paid for that kind of confound repeatedly.

WHY T4 STOPS AT 14B. A T4 is 16GB. At q4 the weights are roughly 1GB / 4.7GB / 9GB for
1.5B / 7B / 14B, so all three fit with room for context. A 32B at q4 is ~19GB and does NOT
fit - it needs a 24GB card, which is a different GPU at a different price, and therefore
NEEDS ITS OWN AUTHORIZATION rather than being smuggled in under a T4 grant.

SERIAL, NOT CONCURRENT. max_inputs=1 and a single container: the models share VRAM and the
runner walks them one at a time, so a size never competes with another size for memory.
Seconds-per-verified-change is recorded by the runner and is only meaningful if nothing else
is running on the card.

FIRST BOOT DOWNLOADS ~15GB across the three tags and commits them to the volume; later
boots find them and return at once. Budget for that on the first window and not after.

RULE 3: the runner checks /api/tags names EVERY model it is about to use, before any
generation. A run against an unverified model measures nothing.

DEPLOY
    python -m modal deploy modal-serve/modal_ollama_scale_t4.py

STOP - must be --yes, the command prompts and aborts non-interactively without it:
    python -m modal app stop legasus-scale --yes
    python -m modal app list
"""

import subprocess
import time

import modal

# Ordered small to large: the runner may be stopped partway and still leave a usable ladder.
MODELS = ["qwen2.5-coder:1.5b", "qwen2.5-coder:7b", "qwen2.5-coder:14b"]
VOLUME_NAME = "hub-ollama-models"
MINUTES = 60

app = modal.App("legasus-scale")

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.from_registry("ollama/ollama:latest", add_python="3.11")
    .entrypoint([])
    .apt_install("curl")
)


@app.function(
    image=image,
    gpu="T4",                        # 16GB - holds 1.5B, 7B and 14B at q4, not 32B
    volumes={"/root/.ollama": volume},
    scaledown_window=5 * MINUTES,
    timeout=60 * MINUTES,            # a 14B on a T4 is slow; the runner enforces its own cap
    min_containers=0,
)
@modal.concurrent(max_inputs=1)
@modal.web_server(11434, startup_timeout=30 * MINUTES)
def serve():
    subprocess.Popen(
        ["ollama", "serve"],
        env={
            "OLLAMA_HOST": "0.0.0.0:11434",
            "HOME": "/root",
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            # One model resident at a time. Three loaded at once would not fit, and an evicted
            # model reloading mid-run would show up as latency that looks like capacity.
            "OLLAMA_MAX_LOADED_MODELS": "1",
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

    for m in MODELS:
        print(f"[legasus-scale] pulling {m} (no-op if the volume already has it)")
        subprocess.run(["ollama", "pull", m], check=True)
    volume.commit()
    print(f"[legasus-scale] ready: {', '.join(MODELS)}")
