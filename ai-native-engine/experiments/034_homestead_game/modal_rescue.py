"""
TRACK 3 (RD-B5 harder-goal rescue) + RD-B8 live, on Modal H100. Does the
temporal OBSERVABLE-as-feedback measurably rescue a capable model on a goal hard
enough to be off ceiling (the score rule requires the RD-B7 scoped SUM)?

Per model, one container (one model load) runs BOTH arms of b3_rescue.js:
  control  — on a lost session, re-author blind
  feedback — on a lost session, re-author with the failing observable clauses
Per-rule authoring runs through the RD-B8 collapse-aware repair loop.

Models:
  Qwen/Qwen2.5-Coder-32B-Instruct    — the H1/H2 rescue (dense, off-ceiling goal)
  Qwen/Qwen3-Coder-30B-A3B-Instruct  — the collapse case (RD-B8 in the loop)

COST: 2 models x (2 arms x 3 sessions x <=2 rounds x 5 rules x ~1.5 attempts)
~= ~180 generations total across 2 parallel containers, ~20-30 min, ~$2-3.

Run detached:
  PYTHONUTF8=1 python -m modal run --detach \
    experiments/034_homestead_game/modal_rescue.py
Fetch: modal volume get hf-cache results/rescue_*.json
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-rescue")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

MODELS = ["Qwen/Qwen2.5-Coder-32B-Instruct", "Qwen/Qwen3-Coder-30B-A3B-Instruct"]

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


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=5400)
def run_rescue(model_id: str, sessions: int, rounds: int) -> dict:
    import os
    os.environ["HF_HOME"] = "/cache/hf"
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from http.server import BaseHTTPRequestHandler, HTTPServer

    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.bfloat16, device_map="cuda")
    hf_cache.commit()

    def generate(messages, temperature):
        text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inp = tok(text, return_tensors="pt").to("cuda")
        with torch.no_grad():
            out = model.generate(**inp, max_new_tokens=700, do_sample=True,
                                 temperature=max(0.1, float(temperature)), top_p=0.9,
                                 pad_token_id=tok.eos_token_id)
        return tok.decode(out[0][inp.input_ids.shape[1]:], skip_special_tokens=True)

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass
        def do_POST(self):
            n = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(n))
            # honor the per-request temperature (RD-B8 raises it on collapse)
            temp = body.get("temperature", 0.3)
            try:
                content = generate(body["messages"], temp)
            except Exception as e:
                content = f"ERROR {e}"
            resp = json.dumps({"choices": [{"message": {"content": content}}]}).encode()
            self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers()
            self.wfile.write(resp)

    srv = HTTPServer(("127.0.0.1", 8000), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    out = {}
    for arm in ("control", "feedback"):
        env = {**os.environ, "OPENAI_BASE": "http://127.0.0.1:8000/v1", "OPENROUTER_MODEL": model_id,
               "SESSIONS": str(sessions), "ROUNDS": str(rounds), "ARM": arm}
        r = subprocess.run(["node", "/root/experiments/034_homestead_game/b3_rescue.js"],
                           capture_output=True, text=True, env=env,
                           cwd="/root/experiments/034_homestead_game", timeout=2400)
        out[arm] = {"stdout": r.stdout, "stderr": r.stderr[-2000:], "rc": r.returncode}

    res = {"model": model_id, **out}
    safe = model_id.split("/")[-1].replace(".", "_")
    p = pathlib.Path(f"/cache/results/rescue_{safe}.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res), encoding="utf-8")
    hf_cache.commit()
    return res


@app.local_entrypoint()
def main(sessions: int = 3, rounds: int = 2, only: str = ""):
    models = [m for m in MODELS if only.lower() in m.lower()] if only else MODELS
    calls = [(run_rescue.spawn(m, sessions, rounds), m) for m in models]
    for call, m in calls:
        r = call.get()
        safe = m.split("/")[-1].replace(".", "_")
        print(f"\n===== {m} =====")
        for arm in ("control", "feedback"):
            print(f"\n--- {arm} (rc={r[arm]['rc']}) ---\n{r[arm]['stdout']}")
            if r[arm]["stderr"].strip():
                print("STDERR:", r[arm]["stderr"])
        (pathlib.Path(__file__).parent / f"rescue_{safe}.txt").write_text(
            json.dumps(r, indent=1), encoding="utf-8")
