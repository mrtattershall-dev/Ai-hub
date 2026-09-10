"""
modal_serve.py — host the trained model on Modal as an Ollama-compatible endpoint.

   python -m modal deploy factory/modal_serve.py      # stable public URL, scales to zero when idle
   python -m modal serve  factory/modal_serve.py      # dev mode (live-reload, dies when you ctrl-C)

Serves base 14B + the v2 adapter on an A10G (cheapest GPU that fits a 14B-4bit and stays fast).
Exposes the same routes your Kaggle shim did, so the hub can point at it unchanged:
  GET  /api/tags       — model list
  POST /api/generate   — {prompt, stream?} Ollama generate
  POST /api/chat       — {messages, stream?} Ollama chat
  GET  /               — a tiny browser test form
Modal gives a public HTTPS URL (no cloudflared needed) and stops the container after idle.
"""
import json
import os
import modal

# Which trained adapter to serve. Override without editing:
#   MYCODER_ADAPTER=/adapters/run4 python -m modal deploy factory/modal_serve.py
# The qwen-adapters volume is the same one modal_train.py writes to, so a finished
# run is servable immediately - no merge, no GGUF conversion, no upload.
ADAPTER = os.environ.get("MYCODER_ADAPTER", "/adapters/run3")
# Serve the BASE model with no adapter at all: MYCODER_ADAPTER=none.
#
# Measured 2026-09-09, the untuned 32B beat every fine-tune on the shared eval subset
# (12/18 vs run5's 9/18) and scores 19/20 on code, so "no adapter" is a real configuration
# and not a fallback. The base model is configurable for the same reason the trainer's is:
# a 32B is a different model, not a flag on the 14B.
BASE_MODEL = os.environ.get("MYCODER_BASE", "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit")
SERVE_BASE_ONLY = ADAPTER.strip().lower() in ("", "none", "base", "off")
# GPU is env-configurable too: A10G is the cheap default, H100 is ~3-4x faster on
# single-stream decode (14B decode is memory-bandwidth bound) at ~3.6x the hourly
# rate - roughly cost-neutral, materially faster wall-clock.
GPU = os.environ.get("MYCODER_GPU", "A10G")

# A 32B in 4-bit is ~19GB of weights plus a KV cache that grows with context. On a 24GB
# A10G it loads and then dies partway through a long generation - after the load is billed.
# Same guard as modal_train.py and modal_evalset.py, for the same reason.
if any(k in BASE_MODEL.upper() for k in ("32B", "30B", "70B", "72B")) and GPU in ("A10", "A10G", "L4", "T4", "A100"):
    raise SystemExit(
        f"refusing to start: MYCODER_BASE is {BASE_MODEL} but MYCODER_GPU={GPU}. "
        f"Serving a model this size needs 80GB - set MYCODER_GPU=H100 (or H200/A100-80GB)."
    )
MODEL_NAME = "mycoder"
SYSTEM = ("You are a senior engineer who writes complete, self-contained, runnable code. "
          "Every identifier you reference must be declared or imported, declarations must "
          "precede use, and you only call methods/APIs that actually exist. Return code that "
          "runs as given.")
# run3 is mode-selected by system prompt — Phaser prompt -> Phaser code, vanilla prompt ->
# vanilla. Auto-pick the mode from the request so the hub "just works" for both.
PHASER_SYSTEM = ("You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 "
                 "programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, "
                 "this.tweens, this.input, this.load, etc.). Return code that runs as given against Phaser 3.")

def pick_system(text):
    return PHASER_SYSTEM if "phaser" in (text or "").lower() else SYSTEM

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
adapters = modal.Volume.from_name("qwen-adapters", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.11").apt_install("git")
    .env({"MYCODER_BASE": BASE_MODEL, "MYCODER_ADAPTER": ADAPTER, "MYCODER_GPU": GPU})
    .pip_install("unsloth", "trl", "peft", "transformers", "datasets",
                 "accelerate", "bitsandbytes", "huggingface_hub", "hf_transfer")
    .pip_install("fastapi[standard]")                 # extra layer on top of the cached train image
    # ADAPTER is resolved LOCALLY at deploy time; bake it into the image so the
    # container sees the same value. Without this the container re-imports this
    # module, finds no MYCODER_ADAPTER, and silently falls back to the default -
    # i.e. you deploy "run4" and quietly serve run3.
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "MYCODER_ADAPTER": ADAPTER})
)
app = modal.App("qwen-serve")

TEST_PAGE = """<!doctype html><meta charset=utf-8><title>mycoder-v2</title>
<body style="font:14px system-ui;max-width:820px;margin:40px auto;padding:0 16px">
<h2>mycoder-v2 (base 14B + v2 adapter)</h2>
<textarea id=p style="width:100%;height:90px" placeholder="Write a self-contained vanilla JS module that ..."></textarea>
<div><button onclick=go() id=b>Generate</button> <small id=s></small></div>
<pre id=o style="white-space:pre-wrap;background:#0d1117;color:#c9d1d9;padding:14px;border-radius:8px;overflow:auto"></pre>
<script>
async function go(){b.disabled=true;s.textContent='generating...';o.textContent='';
 const r=await fetch('api/generate',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({prompt:p.value,stream:false})});
 const j=await r.json();o.textContent=j.response||JSON.stringify(j);s.textContent='done';b.disabled=false;}
</script></body>"""


@app.cls(image=image, gpu=GPU, volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters},
         scaledown_window=300, timeout=60 * 10)
class Server:
    @modal.enter()
    def load(self):
        import threading, os
        from unsloth import FastLanguageModel
        # A container sees the volume as of when it mounted. An adapter committed by a
        # LATER container - which is exactly what modal_train.py does - is invisible
        # until reload(). Without this, serving a freshly trained run crash-loops with
        # "Unsloth: No config file found" even though the files are plainly on the volume.
        if SERVE_BASE_ONLY:
            ref = BASE_MODEL
            print(f"[serve] loading BASE model, no adapter: {ref}", flush=True)
        else:
            adapters.reload()
            if not os.path.isdir(ADAPTER):
                raise RuntimeError(f"adapter not found on volume after reload: {ADAPTER}")
            ref = ADAPTER
            print(f"[serve] loading adapter {ADAPTER}", flush=True)
        self.model, self.tok = FastLanguageModel.from_pretrained(
            model_name=ref, max_seq_length=8192, dtype=None, load_in_4bit=True)
        FastLanguageModel.for_inference(self.model)
        self.lock = threading.Lock()

    def _full(self, messages, temp):
        prompt = self.tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        ins = self.tok(prompt, return_tensors="pt").to("cuda")
        with self.lock:
            out = self.model.generate(**ins, max_new_tokens=3072, do_sample=temp > 0,
                                      temperature=max(temp, 1e-3), pad_token_id=self.tok.eos_token_id)
        return self.tok.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)

    def _stream(self, messages, temp):
        import threading
        from transformers import TextIteratorStreamer
        prompt = self.tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        ins = self.tok(prompt, return_tensors="pt").to("cuda")
        st = TextIteratorStreamer(self.tok, skip_prompt=True, skip_special_tokens=True)
        def run():
            with self.lock:
                self.model.generate(**ins, streamer=st, max_new_tokens=3072, do_sample=temp > 0,
                                   temperature=max(temp, 1e-3), pad_token_id=self.tok.eos_token_id)
        threading.Thread(target=run, daemon=True).start()
        return st

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI, Request
        from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse
        api = FastAPI()

        @api.get("/")
        def home(): return HTMLResponse(TEST_PAGE)

        @api.get("/api/tags")
        def tags(): return {"models": [{"name": MODEL_NAME, "model": MODEL_NAME}]}

        @api.get("/whoami")
        # Report which adapter this container ACTUALLY loaded. Without this the only
        # way to tell run3 from run4 is to compare generations and guess.
        def whoami(): return {"adapter": ADAPTER, "model": MODEL_NAME}

        @api.post("/api/generate")
        async def generate(req: Request):
            b = await req.json()
            temp = (b.get("options") or {}).get("temperature", 0.2)
            prompt = b.get("prompt", "")
            msgs = [{"role": "system", "content": pick_system(prompt)}, {"role": "user", "content": prompt}]
            if not b.get("stream", True):
                return JSONResponse({"model": MODEL_NAME, "response": self._full(msgs, temp), "done": True})
            def nd():
                for x in self._stream(msgs, temp):
                    yield json.dumps({"model": MODEL_NAME, "response": x, "done": False}) + "\n"
                yield json.dumps({"model": MODEL_NAME, "response": "", "done": True}) + "\n"
            return StreamingResponse(nd(), media_type="application/x-ndjson")

        @api.post("/api/chat")
        async def chat(req: Request):
            b = await req.json()
            temp = (b.get("options") or {}).get("temperature", 0.2)
            msgs = b.get("messages", [])
            if msgs and msgs[0].get("role") != "system":
                user_text = " ".join(m.get("content", "") for m in msgs if m.get("role") == "user")
                msgs = [{"role": "system", "content": pick_system(user_text)}] + msgs
            if not b.get("stream", False):
                return JSONResponse({"model": MODEL_NAME, "message": {"role": "assistant", "content": self._full(msgs, temp)}, "done": True})
            def nd():
                for x in self._stream(msgs, temp):
                    yield json.dumps({"model": MODEL_NAME, "message": {"role": "assistant", "content": x}, "done": False}) + "\n"
                yield json.dumps({"model": MODEL_NAME, "message": {"role": "assistant", "content": ""}, "done": True}) + "\n"
            return StreamingResponse(nd(), media_type="application/x-ndjson")

        return api
