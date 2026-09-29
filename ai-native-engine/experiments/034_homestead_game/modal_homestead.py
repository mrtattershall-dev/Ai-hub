"""
B2-LIVE on GPU (Modal): a CAPABLE model authors the HOMESTEAD game through the
editor's real gate + repair loop, then the authored game is played and
adjudicated against the pre-registered observable. Closes the honest caveat on
the Phase-B milestone (B2's proposer was deterministic; here it is a live model).

Same transformers shim as experiments 023/028/029. Serves the model on an H100,
runs the ACTUAL Node harness (real editor.js + engine.js + behavior.js gate +
homestead.js observable) against it.

Model: Qwen/Qwen2.5-Coder-32B-Instruct — the RD-B5 known-good authorer (one-shot
most single rules; the novel count/score grammar is rescued by the repair loop).

COST: model load ~2-3 min + ~30 generations (3 sessions x 5 rules x ~1-2
attempts) of ~700 tokens each ~= ~5-7 min H100 total, well under $1.

Run (detached so a client drop can't orphan the GPU — the RD-B3 lesson):
  PYTHONUTF8=1 python -m modal run --detach \
    experiments/034_homestead_game/modal_homestead.py
  # --sessions N   --model <hf id>
Fetch in-volume result later: modal volume get hf-cache results/homestead_*.json
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-homestead-live")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

try:
    ROOT = pathlib.Path(__file__).resolve().parents[2]
    LOCAL_CORE = str(ROOT / "core")
    LOCAL_034 = str(ROOT / "experiments" / "034_homestead_game")
except IndexError:
    LOCAL_CORE = "/root/core"
    LOCAL_034 = "/root/experiments/034_homestead_game"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("nodejs")
    .pip_install("transformers==4.55.0", "torch==2.5.1", "accelerate==1.1.1")
    .add_local_dir(LOCAL_CORE, "/root/core")
    .add_local_dir(LOCAL_034, "/root/experiments/034_homestead_game")
)


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=3600)
def run_homestead(model_id: str, sessions: int) -> dict:
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
            out = model.generate(**inp, max_new_tokens=700, do_sample=True, temperature=0.4, top_p=0.9,
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
        "SESSIONS": str(sessions), "MAX_ATTEMPTS": "4", "LOOP_TEMP": "0.4",
    }
    out = subprocess.run(["node", "/root/experiments/034_homestead_game/b2_live.js"],
                         capture_output=True, text=True, env=env,
                         cwd="/root/experiments/034_homestead_game", timeout=3000)
    res = {"model": model_id, "sessions": sessions, "stdout": out.stdout,
           "stderr": out.stderr[-3000:], "rc": out.returncode}
    safe = model_id.split("/")[-1].replace(".", "_")
    p = pathlib.Path(f"/cache/results/homestead_{safe}_s{sessions}.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res), encoding="utf-8")
    hf_cache.commit()
    return res


@app.local_entrypoint()
def main(model: str = "Qwen/Qwen2.5-Coder-32B-Instruct", sessions: int = 3):
    r = run_homestead.remote(model, sessions)
    print(f"\n=== {r['model']}  (rc={r['rc']}) ===")
    print(r["stdout"])
    if r["stderr"].strip():
        print("--- STDERR (tail) ---\n" + r["stderr"])
    safe = model.split("/")[-1].replace(".", "_")
    (pathlib.Path(__file__).parent / f"b2_live_{safe}.txt").write_text(
        r["stdout"] + "\n--- STDERR ---\n" + r["stderr"], encoding="utf-8")
