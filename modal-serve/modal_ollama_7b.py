"""
Serve qwen2.5-coder:7b on Modal as a plain HTTPS Ollama endpoint.

WHY THIS EXISTS. The 1.5B feasibility sequence removed six apparatus defects and still has
not produced a verified behavioural edit. This serves the SAME-FAMILY 7B so the identical
harness can be pointed at it. It is a SIDE CONTROL, not a change of objective: the project
is still about making qwen2.5-coder-1.5b agentically correct by engineering the environment.
What a 7B does here only calibrates how much of the remaining gap is size.

Same family matters. qwen2.5-coder 1.5b and 7b share the tokenizer, the FIM special tokens
and the training objective, so the identical prefix/suffix requests are valid for both and
a difference cannot be blamed on the infill format.

Copied from modal_ollama_qwen.py, with its hard-won details kept:
  * start FROM ollama's published image - installing ollama at build time lays down the
    CPU-only build, because Modal attaches no GPU during image build. That cost 3.6 tok/s
    on a GPU we were paying for.
  * .entrypoint([]) clears the image ENTRYPOINT so Modal's runner is not pre-empted.
  * OLLAMA_HOST=0.0.0.0 - the default binds loopback and Modal's proxy is outside the
    container, so a loopback daemon looks like a dead port.
  * weights on a volume, not in the image.

Nothing from this laptop is uploaded. `ollama pull` fetches the published weights inside the
container, so server/hub.json and every other local secret stays where it is.

    python -m modal deploy modal-serve/modal_ollama_7b.py
    ... run the harness against the printed URL ...
    python -m modal app stop qwen-7b-control --yes      # --yes, or it prompts and aborts
"""

import subprocess
import time

import modal

MODEL = "qwen2.5-coder:7b"

VOLUME_NAME = "hub-ollama-models"
MINUTES = 60

app = modal.App("qwen-7b-control")

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.from_registry("ollama/ollama:latest", add_python="3.11")
    .entrypoint([])
    .apt_install("curl")
)


@app.function(
    image=image,
    gpu="A10G",                      # 24GB; a 7B q4 is ~4.7GB, so context is never the constraint
    volumes={"/root/.ollama": volume},
    scaledown_window=5 * MINUTES,    # shorter than the 14B server's 15: this is one measurement,
                                     # not a service, and idle A10G time is pure waste
    timeout=20 * MINUTES,
    min_containers=0,
)
@modal.concurrent(max_inputs=1)      # one GPU, one request at a time - keeps latency interpretable
@modal.web_server(11434, startup_timeout=15 * MINUTES)
def serve():
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

    print(f"[qwen-7b-control] pulling {MODEL} (no-op if the volume already has it)")
    subprocess.run(["ollama", "pull", MODEL], check=True)
    volume.commit()

    # Rule 3: the endpoint must be able to NAME the model it is serving before any goal runs.
    # A server that answers but serves something else has produced a wrong result here before.
    shown = subprocess.run(["ollama", "list"], capture_output=True, text=True).stdout
    print(f"[qwen-7b-control] ollama list:\n{shown}")
    if MODEL.split(":")[0] not in shown:
        raise RuntimeError(f"{MODEL} is not present after pull")
    print(f"[qwen-7b-control] {MODEL} ready")
