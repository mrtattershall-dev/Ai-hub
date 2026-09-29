"""
RD-B3 behavior-authoring capability curve on GPU (Modal). Serves each model via
the same minimal OpenAI-compatible transformers shim proven in experiment 023,
and runs the ACTUAL Node behavior harness (real engine.js + behavior.js gate +
running simulation check) against it. Two arms (CONTROL vs FEEDBACK), success =
the sim OBSERVABLY does the authored behavior after N ticks.

Models (user-requested, 2026-07-14):
  - Qwen/Qwen2.5-Coder-32B-Instruct   (dense 32B — the "strong coder" point)
  - Qwen/Qwen3-Coder-30B-A3B-Instruct (MoE, 3B active — the current-gen coder)
Both fit H100-80GB in bf16; weights cached in the shared hf-cache Volume.

Run: python -m modal run experiments/028_behavior_model_curve/modal_behavior_curve.py
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-behavior-curve")

MODELS = [
    ("Qwen/Qwen2.5-Coder-32B-Instruct", "curve_qwen25_32b.txt"),
    ("Qwen/Qwen3-Coder-30B-A3B-Instruct", "curve_qwen3_coder_30b.txt"),
]
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

# local-only paths (image-build time runs locally; guard the remote re-import —
# the exp-023 lesson: __file__ has no parents[2] inside the container).
try:
    ROOT = pathlib.Path(__file__).resolve().parents[2]
    LOCAL_CORE = str(ROOT / "core")
    LOCAL_027 = str(ROOT / "experiments" / "027_behavior_live")
except IndexError:
    LOCAL_CORE = "/root/core"; LOCAL_027 = "/root/experiments/027_behavior_live"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("nodejs")
    # transformers >=4.51 needed for the qwen3_moe architecture (32B dense is fine on anything recent)
    .pip_install("transformers==4.55.0", "torch==2.5.1", "accelerate==1.1.1")
    .add_local_dir(LOCAL_CORE, "/root/core")
    # harness resolves ../../core from its __dirname, so keep the repo shape:
    .add_local_dir(LOCAL_027, "/root/experiments/027_behavior_live")
)


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=5400)
def run_curve(model_id: str, trials: int, max_attempts: int, fb_style: str = "echo", only_goal: str = "") -> dict:
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
            out = model.generate(**inp, max_new_tokens=600, do_sample=True, temperature=0.7, top_p=0.9,
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
        "FB_STYLE": fb_style,
        "ONLY_GOAL": only_goal,
    }
    out = subprocess.run(["node", "/root/experiments/027_behavior_live/behavior_live.js"],
                         capture_output=True, text=True, env=env,
                         cwd="/root/experiments/027_behavior_live", timeout=5000)
    res = {"model": model_id, "stdout": out.stdout, "stderr": out.stderr[-3000:], "rc": out.returncode}
    # crash-resilience (learned the hard way: a laptop crash killed the client
    # and took the un-detached app with it): persist the result INSIDE the
    # Volume too. Fetch later with: modal volume get hf-cache results/<file>
    safe = model_id.split("/")[-1].replace(".", "_")
    tag = f"{safe}_t{trials}_{fb_style}" + (f"_{only_goal}" if only_goal else "")
    p = pathlib.Path(f"/cache/results/{tag}.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res), encoding="utf-8")
    hf_cache.commit()
    return res


@app.local_entrypoint()
def main(only: str = "", trials: int = 2, fb_style: str = "echo", only_goal: str = ""):
    # both models in parallel (separate containers); weights cache into the Volume.
    # --only <substr> reruns one model; --trials N tightens; --fb-style errors
    # drops the prior-attempt echo from the FEEDBACK re-prompt (echo-trap probe).
    models = [m for m in MODELS if only.lower() in m[0].lower()] if only else MODELS
    calls = [(run_curve.spawn(mid, trials, 3, fb_style, only_goal), mid, fname) for mid, fname in models]
    for call, mid, fname in calls:
        r = call.get()
        print(f"\n=== {r['model']}  (rc={r['rc']}) ===")
        print(r["stdout"])
        if r["stderr"].strip():
            print("--- STDERR (tail) ---\n" + r["stderr"])
        suffix = (f"_t{trials}" if trials != 2 else "") + (f"_{fb_style}" if fb_style != "echo" else "") + (f"_{only_goal}" if only_goal else "")
        (pathlib.Path(__file__).parent / fname.replace(".txt", f"{suffix}.txt")).write_text(
            r["stdout"] + "\n--- STDERR ---\n" + r["stderr"], encoding="utf-8")
