"""
modal_serve_vllm.py - the same Ollama-shaped endpoint, served by vLLM instead of HF generate.

    MYCODER_BASE=unsloth/Qwen3-Coder-30B-A3B-Instruct MYCODER_GPU=H100 \
      python -m modal deploy factory/modal_serve_vllm.py

WHY THIS EXISTS ALONGSIDE modal_serve.py
----------------------------------------
modal_serve.py calls `model.generate()` from HuggingFace, one request at a time. Measured
2026-09-10 while serving Qwen3-Coder-30B-A3B, the container reported:

    Unsloth: Xformers was not installed correctly.
    Switching to PyTorch attention since your Xformers is broken.
    FA [Xformers = None. FA2 = False]

So attention was running the slow fallback path, with no FlashAttention and no paged KV
cache. The symptom was an agent loop managing two model calls in five minutes - from a
Mixture-of-Experts model with only 3B ACTIVE parameters, which should be faster than the
dense 32B it was being compared against, not slower.

The hardware was never the limit. The model occupies ~17GB of an 80GB H100 - about 21%
utilisation - so more VRAM would have bought nothing, and decode is memory-bandwidth bound
so a bigger CPU buys nothing either. vLLM fixes the actual problem: PagedAttention, a real
KV cache, continuous batching, and FlashAttention that is actually installed.

modal_serve.py is kept because it can serve a LoRA ADAPTER straight off the qwen-adapters
volume, which is how a freshly trained run gets tried without a merge step. This file is for
serving a whole model fast. Same routes, so the hub points at either unchanged.
"""
import os
import modal

MODEL = os.environ.get("MYCODER_BASE", "Qwen/Qwen3-Coder-30B-A3B-Instruct")
GPU = os.environ.get("MYCODER_GPU", "H100")
MODEL_NAME = os.environ.get("MYCODER_NAME", "mycoder")
MAX_LEN = int(os.environ.get("MYCODER_MAXLEN", "16384"))
# A MoE keeps all experts resident even though few are active, so headroom matters more
# than the "active parameters" figure suggests.
GPU_FRAC = float(os.environ.get("MYCODER_GPU_FRAC", "0.90"))

if any(k in MODEL.upper() for k in ("30B", "32B", "70B", "72B")) and GPU in ("A10", "A10G", "L4", "T4", "A100"):
    raise SystemExit(
        f"refusing to start: MYCODER_BASE is {MODEL} but MYCODER_GPU={GPU}. "
        f"A model this size needs 80GB - set MYCODER_GPU=H100 (or H200/A100-80GB)."
    )

app = modal.App("qwen-serve-vllm")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm==0.11.0", "fastapi[standard]", "huggingface_hub", "hf_transfer")
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_WORKER_MULTIPROC_METHOD": "spawn",
        # Baked in for the same reason the trainer bakes its config: this module is
        # re-imported INSIDE the container, where these env vars do not exist, and it would
        # silently fall back to the defaults.
        "MYCODER_BASE": MODEL, "MYCODER_GPU": GPU, "MYCODER_NAME": MODEL_NAME,
        "MYCODER_MAXLEN": str(MAX_LEN), "MYCODER_GPU_FRAC": str(GPU_FRAC),
    })
)


@app.cls(
    image=image,
    gpu=GPU,
    volumes={"/root/.cache/huggingface": hf_cache},
    scaledown_window=600,
    timeout=60 * 30,
)
@modal.concurrent(max_inputs=16)     # continuous batching is the point; let requests overlap
class Server:
    @modal.enter()
    def load(self):
        from vllm import LLM
        print(f"[vllm] loading {MODEL} on {GPU}", flush=True)
        self.llm = LLM(
            model=MODEL,
            max_model_len=MAX_LEN,
            gpu_memory_utilization=GPU_FRAC,
            quantization=os.environ.get("MYCODER_QUANT") or None,
            trust_remote_code=True,
            enforce_eager=False,
        )
        self.tok = self.llm.get_tokenizer()
        print("[vllm] ready", flush=True)

    def _params(self, temp, max_new):
        from vllm import SamplingParams
        return SamplingParams(
            temperature=max(float(temp), 0.0),
            top_p=0.95 if float(temp) > 0 else 1.0,
            max_tokens=int(max_new),
        )

    def _chat(self, messages, temp, max_new):
        prompt = self.tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        out = self.llm.generate([prompt], self._params(temp, max_new))
        return out[0].outputs[0].text

    @modal.asgi_app()
    def web(self):
        from fastapi import FastAPI, Request
        from fastapi.responses import JSONResponse, StreamingResponse
        import json

        api = FastAPI()

        @api.get("/api/tags")
        def tags():
            return {"models": [{"name": MODEL_NAME, "model": MODEL_NAME}]}

        @api.get("/api/health")
        def health():
            return {"ok": True, "engine": "vllm", "model": MODEL, "gpu": GPU, "max_len": MAX_LEN}

        def _run(messages, temp, max_new, stream, chat_shape):
            if not stream:
                text = self._chat(messages, temp, max_new)
                body = ({"model": MODEL_NAME, "message": {"role": "assistant", "content": text}, "done": True}
                        if chat_shape else
                        {"model": MODEL_NAME, "response": text, "done": True})
                return JSONResponse(body)

            # The hub reads Ollama's NDJSON stream. vLLM's offline LLM API returns the whole
            # completion, so this emits one chunk then the terminator - correct for the
            # client, and honest about not being token-by-token.
            def gen():
                text = self._chat(messages, temp, max_new)
                first = ({"model": MODEL_NAME, "message": {"role": "assistant", "content": text}, "done": False}
                         if chat_shape else
                         {"model": MODEL_NAME, "response": text, "done": False})
                yield json.dumps(first) + "\n"
                yield json.dumps({"model": MODEL_NAME, "done": True}) + "\n"
            return StreamingResponse(gen(), media_type="application/x-ndjson")

        @api.post("/api/chat")
        async def chat(req: Request):
            b = await req.json()
            return _run(b.get("messages") or [], b.get("temperature", 0.2),
                        b.get("max_tokens", 3072), bool(b.get("stream")), True)

        @api.post("/api/generate")
        async def generate(req: Request):
            b = await req.json()
            msgs = [{"role": "user", "content": b.get("prompt", "")}]
            return _run(msgs, b.get("temperature", 0.2),
                        b.get("max_tokens", 3072), bool(b.get("stream")), False)

        return api
