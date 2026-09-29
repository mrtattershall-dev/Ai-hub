"""
RD-B5 live multi-rule authoring session on GPU (Modal). Same transformers shim
as experiments 023/028; runs the ACTUAL Node session driver (real engine.js +
behavior.js gate + running multi-rule simulation + temporal observable) against
each served model. Two arms (CONTROL blind-retry vs FEEDBACK), success = the
farming loop OBSERVABLY SUSTAINS over TICKS ticks (checkFarmObservable).

The pre-registered question (decisions/RD-B5_multirule_session_spec.md): does
composition need a temporal/multi-rule contract form (H2), or do per-rule gate
+ fold/defer + invariants already cover it (H1)? The temporal observable is fed
back as the teaching signal, so H2's contract form is measured on whether it
earns its keep.

Models (RD-B5 spec):
  - Qwen/Qwen2.5-Coder-32B-Instruct    (dense 32B, known-good — FB_STYLE echo)
  - Qwen/Qwen3-Coder-30B-A3B-Instruct  (MoE, repair-mode-collapse case, RD-B3 —
                                         FB_STYLE errors, no prior-attempt echo)
Both fit H100-80GB in bf16; weights cached in the shared hf-cache Volume.

COST NOTE (the conscious spend this launcher represents): 2 models x 2 arms x
SESSIONS sessions x up to MAX_ATTEMPTS attempts x (1 generation each) — at the
defaults below ~= 2*2*4*4 = up to 64 generations/model, ~128 total, each a
600-1200 token completion on an H100. Launch is a deliberate user decision.

Run (detached so a client death can't orphan the GPU — the RD-B3 lesson):
  PYTHONUTF8=1 python -m modal run --detach \
    experiments/029_multirule_session/modal_multirule.py
  # one model:      --only qwen2.5     (substring match)
  # tighten:        --sessions 6 --max-attempts 5
  # override style: --fb-style errors  (else per-model default below)
  # enforcement on: --tick-budget 24   (item-0 column; off by default)
Fetch in-volume results later:  modal volume get hf-cache results/<file>.json
"""
import json
import pathlib
import subprocess
import threading
import modal

app = modal.App("engine-multirule-session")

# per-model default FB_STYLE encodes the RD-B3 repair-mode-collapse finding:
# echo (prior attempt + signals) for the dense model, errors-only for the MoE.
MODELS = [
    ("Qwen/Qwen2.5-Coder-32B-Instruct", "session_qwen25_32b.txt", "echo"),
    ("Qwen/Qwen3-Coder-30B-A3B-Instruct", "session_qwen3_coder_30b.txt", "errors"),
]
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

# local-only paths (image-build runs locally; guard the remote re-import — the
# exp-023/028 lesson: __file__ has no parents[2] inside the container).
try:
    ROOT = pathlib.Path(__file__).resolve().parents[2]
    LOCAL_CORE = str(ROOT / "core")
    LOCAL_029 = str(ROOT / "experiments" / "029_multirule_session")
except IndexError:
    LOCAL_CORE = "/root/core"
    LOCAL_029 = "/root/experiments/029_multirule_session"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("nodejs")
    # transformers >=4.51 for the qwen3_moe architecture (32B dense is fine on any recent)
    .pip_install("transformers==4.55.0", "torch==2.5.1", "accelerate==1.1.1")
    .add_local_dir(LOCAL_CORE, "/root/core")
    # the driver resolves ../../core from its __dirname AND ./multirule_session.js
    # from its own dir, so keep the repo shape exactly:
    .add_local_dir(LOCAL_029, "/root/experiments/029_multirule_session")
)


@app.function(image=image, gpu="H100", volumes={"/cache": hf_cache}, timeout=7200)
def run_session(model_id: str, sessions: int, max_attempts: int, ticks: int,
                fb_style: str, tick_budget: str) -> dict:
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
            out = model.generate(**inp, max_new_tokens=1200, do_sample=True, temperature=0.7, top_p=0.9,
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
        "SESSIONS": str(sessions), "MAX_ATTEMPTS": str(max_attempts),
        "TICKS": str(ticks), "LOOP_TEMP": "0.7", "FB_STYLE": fb_style,
    }
    if tick_budget:
        env["TICK_BUDGET"] = str(tick_budget)
    out = subprocess.run(["node", "/root/experiments/029_multirule_session/multirule_live.js"],
                         capture_output=True, text=True, env=env,
                         cwd="/root/experiments/029_multirule_session", timeout=6800)
    res = {"model": model_id, "fb_style": fb_style, "stdout": out.stdout,
           "stderr": out.stderr[-4000:], "rc": out.returncode}
    # crash-resilience (RD-B3: a client death orphaned an un-detached app):
    # persist the result INSIDE the Volume too.
    safe = model_id.split("/")[-1].replace(".", "_")
    tag = f"{safe}_s{sessions}_{fb_style}" + (f"_b{tick_budget}" if tick_budget else "")
    p = pathlib.Path(f"/cache/results/rdb5_{tag}.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res), encoding="utf-8")
    hf_cache.commit()
    return res


@app.local_entrypoint()
def main(only: str = "", sessions: int = 4, max_attempts: int = 4, ticks: int = 40,
         fb_style: str = "", tick_budget: str = ""):
    # both models in parallel (separate containers); weights cache into the Volume.
    # fb_style "" -> per-model default (echo dense / errors MoE). An explicit
    # --fb-style overrides both (e.g. to run the MoE under echo as a collapse probe).
    models = [m for m in MODELS if only.lower() in m[0].lower()] if only else MODELS
    calls = [(run_session.spawn(mid, sessions, max_attempts, ticks,
                                fb_style or dflt, tick_budget), mid, fname)
             for mid, fname, dflt in models]
    for call, mid, fname in calls:
        r = call.get()
        print(f"\n=== {r['model']}  fb={r['fb_style']}  (rc={r['rc']}) ===")
        print(r["stdout"])
        if r["stderr"].strip():
            print("--- STDERR (tail) ---\n" + r["stderr"])
        suffix = (f"_s{sessions}" if sessions != 4 else "") + \
                 (f"_{r['fb_style']}") + (f"_b{tick_budget}" if tick_budget else "")
        (pathlib.Path(__file__).parent / fname.replace(".txt", f"{suffix}.txt")).write_text(
            r["stdout"] + "\n--- STDERR ---\n" + r["stderr"], encoding="utf-8")
