"""
modalOllama.py - serve the SAME ollama model on a Modal GPU, so the only thing that changes
between arms is the hardware.

    python -m modal serve server/modalOllama.py        # ephemeral, dies when the command stops
    python -m modal deploy server/modalOllama.py       # persistent (remember to stop it)

WHY THIS SHAPE. MODEL-CMP-1 arm A ran qwen2.5-coder:1.5b through ollama on this laptop's CPU. Arm C
asks what the SAME model does on a GPU. If the server, the weights, the quantization and the
request rendering all change at once, a difference means nothing - so this container runs the same
ollama, pulls the same model TAG (its digest is compared against the local one before any attempt),
and exposes ollama's own HTTP API unchanged. The harness talks to it with `--model-url` and cannot
tell the difference apart from latency.

COST. A10G is billed by the second (verified unit price $0.000306/s, about $1.10/h). Nothing is
kept warm: min_containers is 0, the scaledown window is short, and the model is baked into the
image so a cold start does not pay to download it again. The $2 cap authorized for this comparison
covers startup, idle and shutdown, which is why the runner stops the app explicitly at the end.
"""
import subprocess
import time

import modal

MODEL = "qwen2.5-coder:1.5b"
# Must match the local server every other arm was measured on (`curl localhost:11434/api/version`).
OLLAMA_VERSION = "0.33.3"

image = (
    modal.Image.debian_slim(python_version="3.11")
    # zstd: ollama's installer extracts a zstd archive and fails with a bare "install zstd" error
    .apt_install("curl", "zstd")
    .run_commands(
        # PIN the server version. Arm C shipped 0.34.4 against 0.33.3 locally, which moved the
        # serving version together with the hardware and made a "hardware-only" reading impossible.
        # Pinning to the version every local record was produced with keeps the arms aligned.
        f"curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION={OLLAMA_VERSION} sh",
        # Bake the weights into the image: a cold start then loads from local disk instead of
        # paying GPU seconds to download a gigabyte.
        f"(ollama serve &) && sleep 8 && ollama pull {MODEL} && sleep 2",
    )
    .pip_install("fastapi[standard]==0.115.*", "httpx==0.27.*")
    .env({"OLLAMA_HOST": "127.0.0.1:11434", "OLLAMA_KEEP_ALIVE": "10m"})
)

app = modal.App("legasus-ollama-1p5b", image=image)


@app.function(
    gpu="A10G",
    min_containers=0,          # never pay for an idle container between sessions
    scaledown_window=300,      # but stay warm across one run's verification gaps
    timeout=1800,
    max_containers=1,
)
@modal.concurrent(max_inputs=4)
@modal.asgi_app()
def api():
    """ollama's own API, proxied verbatim - including streaming NDJSON."""
    from fastapi import FastAPI, Request
    from fastapi.responses import StreamingResponse, JSONResponse
    import httpx

    subprocess.Popen(["ollama", "serve"])
    base = "http://127.0.0.1:11434"

    # Wait for the server, then warm the weights into VRAM so the first attempt is not the one
    # that pays for the load.
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            if httpx.get(f"{base}/api/tags", timeout=2).status_code == 200:
                break
        except Exception:
            time.sleep(1)
    try:
        httpx.post(f"{base}/api/generate", json={"model": MODEL, "prompt": "x", "stream": False,
                                                 "options": {"num_predict": 1}}, timeout=300)
    except Exception:
        pass

    web = FastAPI()

    @web.get("/api/tags")
    async def tags():
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.get(f"{base}/api/tags")
            return JSONResponse(status_code=r.status_code, content=r.json())

    @web.post("/api/show")
    async def show(request: Request):
        body = await request.body()
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"{base}/api/show", content=body, headers={"content-type": "application/json"})
            return JSONResponse(status_code=r.status_code, content=r.json())

    async def _proxy_stream(path: str, request: Request):
        body = await request.body()

        async def gen():
            async with httpx.AsyncClient(timeout=1800) as c:
                async with c.stream("POST", f"{base}{path}", content=body,
                                    headers={"content-type": "application/json"}) as r:
                    async for chunk in r.aiter_raw():
                        yield chunk

        return StreamingResponse(gen(), media_type="application/x-ndjson")

    @web.post("/api/generate")
    async def generate(request: Request):
        return await _proxy_stream("/api/generate", request)

    @web.post("/api/chat")
    async def chat(request: Request):
        return await _proxy_stream("/api/chat", request)

    @web.get("/health")
    async def health():
        return {"ok": True, "model": MODEL}

    return web
