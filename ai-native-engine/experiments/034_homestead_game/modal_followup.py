"""
FOLLOW-UPS B + C on Modal H100, one invocation:
  B (purer H2)  — Qwen2.5-Coder-32B runs b3_rescue in 3 configs: control,
                  feedback/full (names + target restated), feedback/names
                  (clause NAMES only). If names-only still rescues, the
                  observable teaches without goal re-specification.
  C (RD-B8 A/B) — b8_ab (single-rule authoring, control/echo/auto repair modes)
                  on the Qwen3-MoE (collapse case: does auto beat echo?) AND on
                  the 32B (non-collapse control: auto should TIE echo — no harm).

Per model, one container (one load). Run detached:
  PYTHONUTF8=1 python -m modal run --detach \
    experiments/034_homestead_game/modal_followup.py
Fetch: modal volume get hf-cache results/followup_*.json
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-followup")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

DENSE = "Qwen/Qwen2.5-Coder-32B-Instruct"
MOE = "Qwen/Qwen3-Coder-30B-A3B-Instruct"

try:
    ROOT = pathlib.Path(__file__).resolve().parents[2]
    LOCAL_CORE = str(ROOT / "core"); LOCAL_034 = str(ROOT / "experiments" / "034_homestead_game")
except IndexError:
    LOCAL_CORE = "/root/core"; LOCAL_034 = "/root/experiments/034_homestead_game"

image = (
    modal.Image.debian_slim(python_version="3.11").apt_install("nodejs")
    .pip_install("transformers==4.55.0", "torch==2.5.1", "accelerate==1.1.1")
    .add_local_dir(LOCAL_CORE, "/root/core")
    .add_local_dir(LOCAL_034, "/root/experiments/034_homestead_game")
)


def _serve(model_id):
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
                                 temperature=max(0.1, float(temperature)), top_p=0.9, pad_token_id=tok.eos_token_id)
        return tok.decode(out[0][inp.input_ids.shape[1]:], skip_special_tokens=True)

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass
        def do_POST(self):
            n = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(n))
            try:
                content = generate(body["messages"], body.get("temperature", 0.3))
            except Exception as e:
                content = f"ERROR {e}"
            self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"choices": [{"message": {"content": content}}]}).encode())

    srv = HTTPServer(("127.0.0.1", 8000), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()


def _run(script, extra_env):
    import os
    env = {**os.environ, "OPENAI_BASE": "http://127.0.0.1:8000/v1", **extra_env}
    r = subprocess.run(["node", f"/root/experiments/034_homestead_game/{script}"],
                       capture_output=True, text=True, env=env,
                       cwd="/root/experiments/034_homestead_game", timeout=2600)
    return {"stdout": r.stdout, "stderr": r.stderr[-1500:], "rc": r.returncode}


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=6000)
def dense_jobs() -> dict:
    _serve(DENSE)
    base = {"OPENROUTER_MODEL": DENSE, "SESSIONS": "3", "ROUNDS": "2"}
    out = {
        "rescue_control": _run("b3_rescue.js", {**base, "ARM": "control"}),
        "rescue_full": _run("b3_rescue.js", {**base, "ARM": "feedback", "FB_MODE": "full"}),
        "rescue_names": _run("b3_rescue.js", {**base, "ARM": "feedback", "FB_MODE": "names"}),
        "ab_dense": _run("b8_ab.js", {"OPENROUTER_MODEL": DENSE, "TRIALS": "8"}),
    }
    _persist("followup_dense", out)
    return out


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=6000)
def moe_jobs() -> dict:
    _serve(MOE)
    out = {"ab_moe": _run("b8_ab.js", {"OPENROUTER_MODEL": MOE, "TRIALS": "8"})}
    _persist("followup_moe", out)
    return out


def _persist(tag, out):
    p = pathlib.Path(f"/cache/results/{tag}.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out), encoding="utf-8")
    hf_cache.commit()


@app.local_entrypoint()
def main():
    d = dense_jobs.spawn(); m = moe_jobs.spawn()
    for name, call in [("DENSE", d), ("MOE", m)]:
        r = call.get()
        print(f"\n===== {name} =====")
        for job, res in r.items():
            print(f"\n--- {job} (rc={res['rc']}) ---\n{res['stdout']}")
            if res["stderr"].strip():
                print("STDERR:", res["stderr"])
    (pathlib.Path(__file__).parent / "followup_results.txt").write_text(
        json.dumps({"dense": d.get(), "moe": m.get()}, indent=1), encoding="utf-8")
