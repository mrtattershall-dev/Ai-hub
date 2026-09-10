"""
Serve your fine-tuned GGUF model on Modal, exposed as a plain HTTPS Ollama
endpoint — no cloudflared tunnel needed, Modal gives you the public URL.

ONE-TIME SETUP
--------------
1. pip install modal
2. modal setup                     # authenticate (opens a browser once)

3. Create a volume and upload your GGUF + Modelfile (from Kaggle Cell 6):
     modal volume create mycoder-gguf
     modal volume put mycoder-gguf ./mycoder-tuned-14b.Q4_K_M.gguf /mycoder-tuned-14b.Q4_K_M.gguf
     modal volume put mycoder-gguf ./Modelfile /Modelfile

   IMPORTANT: edit the Modelfile's FROM line first so it points at the path
   the file will have INSIDE the container, not your local path:
     FROM /vol/mycoder-tuned-14b.Q4_K_M.gguf

4. Deploy:
     modal deploy modal_ollama_serve.py

   Modal prints a URL like:
     https://<your-workspace>--mycoder-ollama-serve.modal.run

5. In the hub's Settings tab, set the Ollama provider's base_url to that URL
   (no trailing slash needed — the hub strips it) and model to MODEL_NAME
   below. The hub already POSTs to {base_url}/api/generate, which is exactly
   what this exposes.

COST NOTES
----------
- min_containers=0 means you pay $0 while nobody's using it.
- scaledown_window=600 keeps a container warm for 10 min after your last
  request, so a back-and-forth coding session doesn't eat a cold start on
  every message — but it scales to zero (stops billing) after 10 idle min.
- T4 is enough VRAM (16GB) for a 14B q4_k_m GGUF (~9GB). Check current
  per-second GPU rates at https://modal.com/pricing before relying on any
  number here — they do change.
- First request after a cold start will be slow (~20-40s: container boot +
  model load into VRAM). That's the tradeoff for not paying to stay warm
  indefinitely.
"""

import subprocess
import time

import modal

MODEL_NAME = "mycoder-tuned-14b"   # must match the name in your Modelfile
VOLUME_NAME = "mycoder-gguf"
MINUTES = 60

app = modal.App("mycoder-ollama")

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl")
    .run_commands("curl -fsSL https://ollama.com/install.sh | sh")
)


@app.function(
    image=image,
    gpu="T4",
    volumes={"/vol": volume},
    scaledown_window=10 * MINUTES,   # stay warm 10 min after last request
    timeout=10 * MINUTES,            # max time for a single request / cold start
    min_containers=0,                # scale to zero -> no idle cost
)
@modal.concurrent(max_inputs=1)      # one GPU, serve one request at a time
@modal.web_server(11434, startup_timeout=5 * MINUTES)
def serve():
    # start the ollama daemon in the background
    subprocess.Popen(["ollama", "serve"])

    # wait until it's actually accepting connections
    for _ in range(60):
        try:
            subprocess.run(
                ["curl", "-sf", "http://localhost:11434"],
                check=True, capture_output=True,
            )
            break
        except subprocess.CalledProcessError:
            time.sleep(1)
    else:
        raise RuntimeError("ollama serve never came up")

    # register the model from the volume (fast — it's already quantized,
    # this just points Ollama at the existing gguf + Modelfile)
    subprocess.run(
        ["ollama", "create", MODEL_NAME, "-f", "/vol/Modelfile"],
        check=True,
    )
