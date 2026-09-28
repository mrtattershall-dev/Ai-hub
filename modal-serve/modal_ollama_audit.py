"""
AUDIT-1 — serve qwen2.5-coder:7b on Modal as a plain Ollama endpoint, for one bounded audit.

    python -m modal deploy modal-serve/modal_ollama_audit.py
    ... run the audit against the printed URL ...
    python -m modal app stop legasus-audit --yes        # REQUIRED, see below
    python -m modal app list                            # verify it actually stopped

WHY A SEPARATE FILE rather than a parameter on modal_ollama_qwen.py: that app is the hub's
coder and may be deployed. An audit with a $5 cap should not be able to redeploy, restart or
scale the thing the hub talks to. Different app name, different lifetime, different owner.

AUTHORIZATION
-------------
$5, for this audit only, from Micheal, recorded in AUDIT-1_DEFINITION.md BEFORE this file was
deployed. Not standing. Not extendable without a new one. Nothing else is authorized to spend.

COST SHAPE, and what is actually enforced
-----------------------------------------
A dollar cap cannot be enforced from inside this file. What can be:

  min_containers=0      $0 while idle - the container is not kept alive between audits
  scaledown_window      2 MINUTES, not the hub's 15. This audit is a burst of calls; every
                        minute of idle-warm afterwards is paid for and buys nothing.
  timeout               5 minutes. A single infill call that runs longer than that has gone
                        wrong, and paying for twenty minutes of it is not a diagnosis.
  bounded work          the caller makes at most 48 requests (4 pages x 12 calls)

The real enforcement is `modal app stop --yes` afterwards. `app stop` PROMPTS, and a prompt
in a non-interactive shell aborts the stop while reporting nothing useful - so the flag is
not optional, and the stop is verified with `app list` rather than assumed.

THE GPU GOTCHA, inherited from modal_ollama_qwen.py and worth restating because it is silent:
start from ollama's own image. `curl install.sh | sh` runs at IMAGE BUILD time where Modal
attaches no GPU, so the installer lays down the CPU-only build and the A10G sits idle while
being billed. Measured before that fix: 3.6 tok/s on a GPU we were paying for.
"""

import subprocess
import time

import modal

# The size Micheal specified. A 7B q4 is ~4.7GB and fits an A10G with room for context - the
# 14B the hub serves would also fit, but this audit asks about the 7B and substituting a
# different model to answer a question about this one would answer a different question.
MODEL = "qwen2.5-coder:7b"

# The same volume the hub's coder uses: weights already pulled there are not re-downloaded,
# and a 7B pulled here stays for later. Modal's network does the download, not this laptop.
VOLUME_NAME = "hub-ollama-models"
MINUTES = 60

app = modal.App("legasus-audit")

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.from_registry("ollama/ollama:latest", add_python="3.11")
    .entrypoint([])
    .apt_install("curl")
)


@app.function(
    image=image,
    gpu="A10G",
    volumes={"/root/.ollama": volume},
    scaledown_window=2 * MINUTES,    # a burst, not a service
    timeout=5 * MINUTES,             # one infill call; longer than this is a fault, not a wait
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

    print(f"[legasus-audit] pulling {MODEL} (no-op if the volume already has it)")
    subprocess.run(["ollama", "pull", MODEL], check=True)
    volume.commit()
    print(f"[legasus-audit] {MODEL} ready")
