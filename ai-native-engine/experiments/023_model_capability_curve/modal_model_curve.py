"""
RD-018.1 capability curve on GPU (Modal). Serves an open model via a minimal
OpenAI-compatible endpoint (transformers) on one GPU, and runs the ACTUAL Node
harness (real engine.js + protocol.js validator + live_loop) against it — full
fidelity, just a different model backend. Firms up the noisy n=1 7B point from
RD-018.1 with proper trials on clean hardware.

Run: python -m modal run experiments/023_model_capability_curve/modal_model_curve.py
Cost: one GPU (L4) for ~10-20 min; model weights cached in a Volume after run 1.
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-model-curve")

MODEL_ID = "Qwen/Qwen2.5-Coder-7B-Instruct"  # same family as the user's local 7B
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

# local-only path (used at image-build time, which runs locally). Guard it so
# the remote re-import of this module inside the container doesn't crash.
try:
    LOCAL_CORE = str(pathlib.Path(__file__).resolve().parents[2] / "core")
except IndexError:
    LOCAL_CORE = "/root/core"  # remote: image already built, value unused

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("nodejs")
    .pip_install("transformers==4.46.3", "torch==2.5.1", "accelerate==1.1.1")
    .add_local_dir(LOCAL_CORE, "/root/core")  # the REAL engine + harness
)


@app.function(image=image, gpu="L4", volumes={"/cache": hf_cache}, timeout=3600)
def run_curve(model_id: str, trials: int, max_attempts: int) -> dict:
    import os
    os.environ["HF_HOME"] = "/cache/hf"
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from http.server import BaseHTTPRequestHandler, HTTPServer

    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.bfloat16, device_map="cuda")
    hf_cache.commit()

    def generate(messages):
        text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inp = tok(text, return_tensors="pt").to("cuda")
        with torch.no_grad():
            out = model.generate(**inp, max_new_tokens=400, do_sample=True, temperature=0.7, top_p=0.9,
                                 pad_token_id=tok.eos_token_id)
        return tok.decode(out[0][inp.input_ids.shape[1]:], skip_special_tokens=True)

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass
        def do_POST(self):
            n = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(n))
            try:
                content = generate(body["messages"])
            except Exception as e:
                content = f"ERROR {e}"
            resp = json.dumps({"choices": [{"message": {"content": content}}]}).encode()
            self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers()
            self.wfile.write(resp)

    srv = HTTPServer(("127.0.0.1", 8000), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    env = {
        **os.environ,
        "OPENAI_BASE": "http://127.0.0.1:8000/v1",
        "OPENROUTER_MODEL": model_id,
        "TRIALS": str(trials), "MAX_ATTEMPTS": str(max_attempts), "LOOP_TEMP": "0.7",
    }
    out = subprocess.run(["node", "/root/core/live_loop_real.js"],
                         capture_output=True, text=True, env=env, cwd="/root/core", timeout=3200)
    return {"model": model_id, "stdout": out.stdout, "stderr": out.stderr[-3000:], "rc": out.returncode}


@app.local_entrypoint()
def main():
    r = run_curve.remote(MODEL_ID, 4, 5)
    print(f"=== {r['model']}  (rc={r['rc']}) ===")
    print(r["stdout"])
    if r["stderr"].strip():
        print("--- STDERR (tail) ---\n" + r["stderr"])
    (pathlib.Path(__file__).parent / "curve_qwen7b.txt").write_text(r["stdout"])
