"""
AI-native editor — remote rule-authoring model as a scale-to-zero web endpoint.

Serves an OpenAI-compatible /v1/chat/completions on Modal so the editor's
propose pane has a REMOTE model (this laptop must never run local inference —
memory: no-local-models-hard-rule). Same transformers stack the project's
experiments already pin (023/028/034); no new inference deps to gamble on.

Model: Qwen/Qwen2.5-Coder-32B-Instruct — the RD-B5 known-good rule authorer,
served at native bf16 on a single A100-80GB (the "most capable uncompressed"
fit for one 80GB card; a 70B would need quantization + new deps for little
gain on this narrow JSON-DSL task). If repair rates ever degrade, the
candidates are DeepSeek-R1-Distill-Qwen-32B (reasoning; slower, <think> tax)
or a quantized Qwen2.5-72B — switch on evidence, not vibes.

COST: $0 idle (scales to zero after 4 min). Each cold propose pays ~1-3 min
model load; warm proposes are seconds. A test session of a few proposes is
low single-digit dollars (A100 ≈ 60% of H100 hourly).

Deploy:  PYTHONUTF8=1 python -m modal deploy experiments/037_ai_native_editor/modal_endpoint.py
Then:    set MODEL_ENDPOINT=https://mr-tattershall--editor-llm.modal.run
         set MODEL_NAME=Qwen/Qwen2.5-Coder-32B-Instruct
         set MODEL_KEY=<EDITOR_LLM_KEY value>
         node experiments/036_multiplayer/m1_server.js

ALWAYS SMOKE-TEST AFTER DEPLOY (learned twice, 2026-07-16 — a deploy printing
"App deployed" is NOT proof the route is live; the app was later absent from
`modal app list` and the URL answered "modal-http: invalid function call"):
  curl -s -X POST https://mr-tattershall--editor-llm.modal.run \
    -H "Content-Type: application/json" -H "Authorization: Bearer <key>" \
    -d '{"messages":[{"role":"user","content":"say OK"}],"max_tokens":5}'
Expect {"choices":[{"message":{...,"content":"OK"}}]}. Verify AFTER the change you
made, not before it.
"""
from __future__ import annotations

import os

import modal

app = modal.App("engine-editor-llm")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
MODEL_ID = os.environ.get("EDITOR_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct")
# static shared key so the endpoint isn't open to the internet; not a secret
# worth a vault — it gates GPU spend, not data.
API_KEY = os.environ.get("EDITOR_LLM_KEY", "engine-editor-2026")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("transformers==4.55.0", "torch==2.5.1", "accelerate==1.1.1", "fastapi[standard]")
)

with image.imports():  # container-only; fastapi is not installed on the laptop
    from fastapi import HTTPException, Request


@app.cls(image=image, gpu="A100-80GB", volumes={"/cache": hf_cache},
         timeout=1800, scaledown_window=240)
class Author:
    @modal.enter()
    def load(self):
        os.environ["HF_HOME"] = "/cache/hf"
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        self.tok = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID, torch_dtype=torch.bfloat16, device_map="cuda")
        hf_cache.commit()

    @modal.method()
    def generate(self, messages: list, temperature: float, max_tokens: int) -> str:
        import torch
        prompt = self.tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        ids = self.tok(prompt, return_tensors="pt").to("cuda")
        with torch.no_grad():
            out = self.model.generate(
                **ids, max_new_tokens=max_tokens,
                do_sample=temperature > 0, temperature=max(temperature, 1e-3),
                pad_token_id=self.tok.eos_token_id)
        return self.tok.decode(out[0][ids["input_ids"].shape[1]:], skip_special_tokens=True)


@app.function(image=image, timeout=600)
@modal.fastapi_endpoint(method="POST", label="editor-llm")
def chat(body: dict, request: Request):
    # OpenAI-compatible enough for the editor's makeCallModel(): accepts
    # {model, messages, temperature, max_tokens}, returns {choices:[{message:{content}}]}.
    if request.headers.get("authorization", "") != f"Bearer {API_KEY}":
        raise HTTPException(401, "bad or missing bearer key")
    msgs = body.get("messages") or []
    if not msgs:
        raise HTTPException(400, "messages required")
    text = Author().generate.remote(
        msgs, float(body.get("temperature", 0.2)), int(body.get("max_tokens", 600)))
    return {"choices": [{"message": {"role": "assistant", "content": text}}]}
