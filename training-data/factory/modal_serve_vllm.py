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
import threading

import modal

MODEL = os.environ.get("MYCODER_BASE", "Qwen/Qwen3-Coder-30B-A3B-Instruct")
GPU = os.environ.get("MYCODER_GPU", "H100")
MODEL_NAME = os.environ.get("MYCODER_NAME", "mycoder")
MAX_LEN = int(os.environ.get("MYCODER_MAXLEN", "16384"))
# A MoE keeps all experts resident even though few are active, so headroom matters more
# than the "active parameters" figure suggests.
GPU_FRAC = float(os.environ.get("MYCODER_GPU_FRAC", "0.90"))
DEFAULT_MAX_NEW = int(os.environ.get("MYCODER_MAX_NEW", "3072"))
# Cadence of the keep-alive chunk emitted while a blocking generation runs. Must stay
# comfortably under the hub's MODEL_STALL_S (default 90).
HEARTBEAT_S = float(os.environ.get("MYCODER_HEARTBEAT_S", "5"))
# Scaling. min_containers=1 keeps one warm so a test never pays a cold start; max_containers
# bounds what several agents hammering this at once can cost. Both are env-tunable so the
# expensive setting is a deliberate act, not a default.
MIN_CONTAINERS = int(os.environ.get("MYCODER_MIN_CONTAINERS", "0"))
MAX_CONTAINERS = int(os.environ.get("MYCODER_MAX_CONTAINERS", "4"))
SCALEDOWN_S = int(os.environ.get("MYCODER_SCALEDOWN_S", "600"))

if any(k in MODEL.upper() for k in ("30B", "32B", "70B", "72B")) and GPU in ("A10", "A10G", "L4", "T4", "A100"):
    raise SystemExit(
        f"refusing to start: MYCODER_BASE is {MODEL} but MYCODER_GPU={GPU}. "
        f"A model this size needs 80GB - set MYCODER_GPU=H100 (or H200/A100-80GB)."
    )

app = modal.App("qwen-serve-vllm")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    # transformers MUST stay on 4.x. vLLM 0.11.0 calls tokenizer.all_special_tokens_extended,
    # which transformers 5 removed - pip resolved 5.x on the first deploy and every container
    # crash-looped on AttributeError before the model ever loaded (measured 2026-09-10).
    .pip_install("vllm==0.11.0", "transformers>=4.55,<5", "fastapi[standard]",
                 "huggingface_hub", "hf_transfer")
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
    scaledown_window=SCALEDOWN_S,
    timeout=60 * 30,
    min_containers=MIN_CONTAINERS,
    max_containers=MAX_CONTAINERS,
)
# ONE GENERATION PER CONTAINER; SCALE OUT INSTEAD OF SHARING.
#
# vLLM's offline LLM class is not thread-safe, so generation here is serialised behind a
# lock. That makes max_inputs > 1 actively harmful: extra requests do not batch, they QUEUE
# behind the lock and each one waits for all the others. Measured 2026-09-10 when four test
# batches accidentally ran at once against one container - throughput fell from ~130 to
# 50 tok/s and runs "stopped" with zero errors, which looked exactly like a product
# deadlock and was pure starvation.
#
# So: one in-flight request per container, and let Modal add containers under load. Each
# container gets its own engine and its own GPU, which is real parallelism rather than the
# appearance of it. MAX_CONTAINERS bounds the spend - without a ceiling, N concurrent
# agents means N H100s.
#
# (The honest alternative is AsyncLLMEngine, which batches properly inside ONE container.
# That is the better answer and a bigger change; this one cannot silently under-deliver.)
@modal.concurrent(max_inputs=1)
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
        # vLLM's OFFLINE LLM class is not thread-safe, and this server calls generate()
        # from a worker thread (so the ASGI loop can emit heartbeats while it blocks).
        # With @modal.concurrent(max_inputs=16), several requests can be in flight at
        # once, so without this lock two threads could enter the same engine and corrupt
        # its scheduler state. Serialising costs throughput that the offline API never
        # actually offered - generate() blocks until its batch is done either way. Real
        # overlapping generation needs AsyncLLMEngine, which is a bigger change than I can
        # verify without a GPU, so this takes the safe side deliberately.
        self._gen_lock = threading.Lock()
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
        with self._gen_lock:
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

        # HOW THE HUB ACTUALLY SPEAKS.
        #
        # This endpoint claims to be Ollama-shaped, and the hub POSTs the Ollama body:
        #
        #     {"model", "messages", "stream", "keep_alive",
        #      "options": {"temperature", "num_ctx", "num_predict"}}
        #
        # The first version of this file read top-level b["temperature"] and
        # b["max_tokens"], which the hub never sends - so EVERY option was silently
        # dropped and every request ran at the hard-coded defaults. Silently ignoring a
        # caller's parameters is worse than rejecting them: nothing fails, and the knobs
        # simply do not work. modal_serve.py had this right; this file did not.
        def _opts(b):
            o = b.get("options") or {}
            temp = o.get("temperature", b.get("temperature", 0.2))
            # num_predict is Ollama's max-new-tokens, and -1 means "no limit".
            npred = o.get("num_predict", None)
            if npred is None:
                npred = b.get("max_tokens", DEFAULT_MAX_NEW)
            npred = int(npred)
            if npred <= 0:
                npred = MAX_LEN                      # -1 => as much as the window allows
            return temp, min(npred, MAX_LEN)

        def _run(messages, temp, max_new, stream, chat_shape):
            if not stream:
                text = self._chat(messages, temp, max_new)
                body = ({"model": MODEL_NAME, "message": {"role": "assistant", "content": text}, "done": True}
                        if chat_shape else
                        {"model": MODEL_NAME, "response": text, "done": True})
                return JSONResponse(body)

            # KEEP BYTES FLOWING WHILE GENERATING.
            #
            # vLLM's offline LLM API returns the whole completion at once, so a naive
            # implementation sends nothing until generation finishes: first-byte latency
            # equals TOTAL generation time. That is fine against a wall-clock client and
            # fatal against the hub's stall timer, which (correctly) treats a stream that
            # has been silent for MODEL_STALL_S as dead. A 3-minute generation would be
            # killed at 90 seconds having produced nothing.
            #
            # So generation runs on a worker thread and this yields an empty-content
            # keep-alive every few seconds until it finishes. The hub accumulates only
            # non-empty content, so the heartbeats are invisible to it - they exist purely
            # to prove the connection is alive.
            #
            # The honest limitation: because heartbeats never stop, the hub's stall timer
            # cannot detect a generation that has genuinely hung on THIS server. The
            # absolute ceiling (MODEL_TIMEOUT_S) is what bounds that case. Real per-token
            # streaming would need AsyncLLMEngine; this is the smaller, safer change.
            def gen():
                from concurrent.futures import ThreadPoolExecutor
                box = {}

                def work():
                    box["text"] = self._chat(messages, temp, max_new)

                with ThreadPoolExecutor(max_workers=1) as ex:
                    fut = ex.submit(work)
                    while not fut.done():
                        try:
                            fut.result(timeout=HEARTBEAT_S)
                        except Exception:
                            pass
                        if not fut.done():
                            beat = ({"model": MODEL_NAME, "message": {"role": "assistant", "content": ""}, "done": False}
                                    if chat_shape else
                                    {"model": MODEL_NAME, "response": "", "done": False})
                            yield json.dumps(beat) + "\n"
                    fut.result()                      # re-raise a real generation failure

                text = box.get("text", "")
                first = ({"model": MODEL_NAME, "message": {"role": "assistant", "content": text}, "done": False}
                         if chat_shape else
                         {"model": MODEL_NAME, "response": text, "done": False})
                yield json.dumps(first) + "\n"
                yield json.dumps({"model": MODEL_NAME, "done": True}) + "\n"
            return StreamingResponse(gen(), media_type="application/x-ndjson")

        @api.post("/api/chat")
        async def chat(req: Request):
            b = await req.json()
            temp, max_new = _opts(b)
            return _run(b.get("messages") or [], temp, max_new, bool(b.get("stream")), True)

        @api.post("/api/generate")
        async def generate(req: Request):
            b = await req.json()
            temp, max_new = _opts(b)
            msgs = [{"role": "user", "content": b.get("prompt", "")}]
            return _run(msgs, temp, max_new, bool(b.get("stream")), False)

        return api
