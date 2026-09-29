# Correctness measurement run (v0.2-correctness)

**Hypothesis:** training on *only verified-runnable* code + bug→fix repair pairs makes
the 14B emit code that actually runs — the self-ref-init / undefined-`dt` / fake-API
bugs from the racing-game sample should drop vs. the 632-fragment v0.1.

**Dataset:** `correctness/dataset.jsonl` — **203 rows** (127 repair pairs + 74 clean
modules + 2 small whole games). Every row is gate-verified; no backtranslation needed.

Trains **from base** (not on top of v0.1) so the comparison is clean. Light config
(`lora_dropout=0.05`, 2 epochs) to nudge, not memorize.

---

### Setup
New Kaggle notebook → **GPU T4**, **Internet On**. Add input: upload
`training-data/correctness/dataset.jsonl` (as a dataset).

### Cell 1 — install
```python
import torch, os
print("GPU:", torch.cuda.get_device_name(0))
os.system("pip install -q unsloth")
print("✅ if Cell 3 errors on import: Run > Restart Session, then continue at Cell 2")
```

### Cell 2 — load the dataset
```python
import glob
from datasets import load_dataset
path = glob.glob("/kaggle/input/**/*.jsonl", recursive=True)[0]   # finds correctness_dataset.jsonl
ds = load_dataset("json", data_files=path, split="train")
print("dataset:", path, "| rows:", len(ds))
```

### Cell 3 — base 14B + LoRA (dropout 0.05)
```python
from unsloth import FastLanguageModel
import torch
MAXLEN = 8192   # drop to 6144 if you hit OOM
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit",
    max_seq_length=MAXLEN, dtype=None, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(
    model, r=16, lora_alpha=16, lora_dropout=0.05,        # >0 resists memorization
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing="unsloth", random_state=42)
print("✅ base 14B + LoRA")
```

### Cell 4 — train
```python
from trl import SFTTrainer, SFTConfig
import torch
ds2 = ds.map(lambda ex: {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)})
SFTTrainer(model=model, tokenizer=tokenizer, train_dataset=ds2,
  args=SFTConfig(dataset_text_field="text", max_seq_length=MAXLEN, packing=False,
    per_device_train_batch_size=1, gradient_accumulation_steps=8,
    warmup_steps=5, num_train_epochs=2, learning_rate=2e-4,
    fp16=not torch.cuda.is_bf16_supported(), bf16=torch.cuda.is_bf16_supported(),
    logging_steps=5, optim="adamw_8bit", weight_decay=0.01,
    lr_scheduler_type="linear", seed=42, output_dir="outputs", report_to="none")).train()
```

### Cell 5 — save adapter, then Save Version
```python
model.save_pretrained("/kaggle/working/correctness-adapter")
tokenizer.save_pretrained("/kaggle/working/correctness-adapter")
print("✅ adapter saved. 🛑 Save Version → Quick Save to keep it.")
```

### Cell 6 — serve the just-trained model + tunnel (reuses the in-memory model)
```python
import os, json, threading, subprocess, time, re, requests
from transformers import TextIteratorStreamer
from flask import Flask, request, Response, jsonify
FastLanguageModel.for_inference(model)
LOCK = threading.Lock()
def prompt_of(m): return tokenizer.apply_chat_template(m, tokenize=False, add_generation_prompt=True)
def gen_full(m,t):
    ins=tokenizer(prompt_of(m),return_tensors="pt").to("cuda")
    with LOCK: out=model.generate(**ins,max_new_tokens=4096,do_sample=t>0,temperature=max(t,1e-3),pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(out[0][ins["input_ids"].shape[1]:],skip_special_tokens=True)
def gen_stream(m,t):
    ins=tokenizer(prompt_of(m),return_tensors="pt").to("cuda")
    st=TextIteratorStreamer(tokenizer,skip_prompt=True,skip_special_tokens=True)
    threading.Thread(target=lambda:(LOCK.acquire(),model.generate(**ins,streamer=st,max_new_tokens=4096,do_sample=t>0,temperature=max(t,1e-3),pad_token_id=tokenizer.eos_token_id),LOCK.release()),daemon=True).start()
    return st
app=Flask(__name__); M="mycoder-correctness"
@app.route("/api/tags")
def tags(): return jsonify({"models":[{"name":M,"model":M}]})
@app.route("/api/generate",methods=["POST"])
def g():
    b=request.get_json(force=True); t=(b.get("options") or {}).get("temperature",0.2); m=[{"role":"user","content":b.get("prompt","")}]
    if not b.get("stream",True): return jsonify({"model":M,"response":gen_full(m,t),"done":True})
    def nd():
        for x in gen_stream(m,t): yield json.dumps({"model":M,"response":x,"done":False})+"\n"
        yield json.dumps({"model":M,"response":"","done":True})+"\n"
    return Response(nd(),mimetype="application/x-ndjson")
@app.route("/api/chat",methods=["POST"])
def c():
    b=request.get_json(force=True); t=(b.get("options") or {}).get("temperature",0.2); m=b.get("messages",[])
    if not b.get("stream",False): return jsonify({"model":M,"message":{"role":"assistant","content":gen_full(m,t)},"done":True})
    def nd():
        for x in gen_stream(m,t): yield json.dumps({"model":M,"message":{"role":"assistant","content":x},"done":False})+"\n"
        yield json.dumps({"model":M,"message":{"role":"assistant","content":""},"done":True})+"\n"
    return Response(nd(),mimetype="application/x-ndjson")
threading.Thread(target=lambda:app.run(host="0.0.0.0",port=11434,threaded=True,use_reloader=False),daemon=True).start(); time.sleep(3)
os.system("apt-get -qq install -y zstd >/dev/null 2>&1")
os.system("wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared")
subprocess.Popen(["cloudflared","tunnel","--url","http://localhost:11434"],stdout=open("/tmp/cf.log","w"),stderr=subprocess.STDOUT)
url=None
for _ in range(40):
    time.sleep(2); m=re.search(r"https://[-\w]+\.trycloudflare\.com",open("/tmp/cf.log").read() if os.path.exists("/tmp/cf.log") else "")
    if m: url=m.group(0); break
print("TUNNEL URL:", url)
```

### Measure
Point the hub at the new tunnel (Settings → Ollama → base_url) and send the **exact
same racing-game prompt**. Compare against v0.1: do the self-ref-init / undefined / fake-API
bugs drop? That's the number this whole pivot was for.
