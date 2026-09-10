# Fine-tune v0.1 on Qwen2.5-Coder **14B** — clean Kaggle notebook

Make a **NEW** Kaggle notebook. Settings (right panel):
- **Accelerator = GPU T4 ×2** (NOT TPU)
- **Internet = On**

Then paste these cells **in order**. Upload your **backtranslated** dataset
(`examples_done.zip` from Google Drive `MyDrive/mycoder/`) when Cell 2 asks —
that one already has the real instructions, so no re-backtranslation needed.

> 14B QLoRA on a free T4 is tight; the settings below are tuned to fit. If you
> hit out-of-memory, drop `MAXLEN` to 1024 (Cell 3) and re-run from Cell 3.

---

### Cell 1 — installs (will ask to restart; do it, then continue at Cell 2)
```python
import os
print("GPU:", __import__("torch").cuda.get_device_name(0))
os.system("apt-get -qq install -y zstd; curl -fsSL https://ollama.com/install.sh | sh")  # ollama for the final step
!pip install -q unsloth
print("✅ installed — if it says 'restart', do Run > Restart Session, then run Cell 2")
```

### Cell 2 — upload + build the dataset
```python
from google.colab import files  # works on Kaggle too
import zipfile, pathlib, json
up = files.upload()                         # choose examples_done.zip
name = next(iter(up))

# extract (handle Windows backslash paths)
import shutil; shutil.rmtree("examples", ignore_errors=True)
with zipfile.ZipFile(name) as z:
    for info in z.infolist():
        n = info.filename.replace("\\", "/")
        if n.endswith("/") or not n.strip(): continue
        t = pathlib.Path(n)
        t.parent.mkdir(parents=True, exist_ok=True)
        with z.open(info) as s, open(t, "wb") as d: d.write(s.read())
EX = pathlib.Path("examples") if pathlib.Path("examples").exists() else pathlib.Path(".")

SYSTEM = ("You are a senior software engineer and game developer who writes "
          "polished, self-contained vanilla-JS browser games.")
rows, stubs = [], 0
for d in sorted(p for p in EX.rglob("*") if p.is_dir()):
    pf, outs = d / "prompt.txt", [f for f in d.iterdir() if f.name.startswith("output")]
    if not pf.exists() or not outs: continue
    instr = pf.read_text(encoding="utf-8").strip()
    if not instr or "[REVIEW" in instr: stubs += 1; continue
    code = outs[0].read_text(encoding="utf-8", errors="ignore")
    rows.append({"messages": [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": instr},
        {"role": "assistant", "content": f"```{outs[0].suffix.lstrip('.')}\n{code}\n```"}]})
with open("dataset.jsonl", "w", encoding="utf-8") as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"dataset rows: {len(rows)}  (skipped {stubs} stub prompts)")
assert len(rows) > 50, "Too few real examples — did you upload examples_done.zip (the backtranslated one)?"
```

### Cell 3 — load the 14B base + LoRA
```python
from unsloth import FastLanguageModel
import torch
MAXLEN = 2048   # drop to 1024 if you hit out-of-memory
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit",
    max_seq_length=MAXLEN, dtype=None, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(
    model, r=16, lora_alpha=16, lora_dropout=0,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing="unsloth", random_state=42)
print("✅ 14B loaded + LoRA attached")
```

### Cell 4 — train
```python
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
import torch
ds = load_dataset("json", data_files="dataset.jsonl", split="train")
ds = ds.map(lambda ex: {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)})
trainer = SFTTrainer(
    model=model, tokenizer=tokenizer, train_dataset=ds,
    args=SFTConfig(
        dataset_text_field="text", max_seq_length=MAXLEN, packing=False,
        per_device_train_batch_size=1, gradient_accumulation_steps=8,
        warmup_steps=5, num_train_epochs=2, learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(), bf16=torch.cuda.is_bf16_supported(),
        logging_steps=5, optim="adamw_8bit", weight_decay=0.01,
        lr_scheduler_type="linear", seed=42, output_dir="outputs", report_to="none"))
trainer.train()
```

### Cell 5 — save the trained adapter to Drive (safety)
```python
from google.colab import drive
drive.mount('/content/drive')
model.save_pretrained("/content/drive/MyDrive/mycoder/lora-adapter-14b")
tokenizer.save_pretrained("/content/drive/MyDrive/mycoder/lora-adapter-14b")
print("✅ 14B adapter saved to Drive")
```

### Cell 6 — export GGUF (convert in /tmp = lots of space) + register with Ollama
```python
import glob, shutil, os, subprocess, time, requests
model.save_pretrained_gguf("/tmp/mycoder-tuned-14b", tokenizer, quantization_method="q4_k_m")
gguf = next(g for g in glob.glob("/tmp/**/*.gguf", recursive=True) if "Q4" in g.upper())
gdir = os.path.dirname(gguf)
os.makedirs("/kaggle/working/mycoder-tuned-14b", exist_ok=True)
shutil.copy(gguf, "/kaggle/working/mycoder-tuned-14b/")
shutil.copy(f"{gdir}/Modelfile", "/kaggle/working/mycoder-tuned-14b/")
print("✅ GGUF saved to /kaggle/working/mycoder-tuned-14b — now click 'Save Version' to keep it!")
# optional quick test:
os.environ["OLLAMA_HOST"] = "0.0.0.0:11434"
subprocess.Popen(["ollama","serve"], stdout=open("/tmp/ol.log","w"), stderr=subprocess.STDOUT); time.sleep(6)
os.system(f"ollama create mycoder-tuned-14b -f {gdir}/Modelfile")
print("models:", [m['name'] for m in requests.get('http://localhost:11434/api/tags').json()['models']])
```

### Cell 7 — (optional) tunnel it to your hub
```python
import os, subprocess, time, re
os.system("wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared")
subprocess.Popen(["cloudflared","tunnel","--url","http://localhost:11434"], stdout=open("/tmp/cf.log","w"), stderr=subprocess.STDOUT)
url=None
for _ in range(30):
    time.sleep(2)
    m=re.search(r"https://[-\w]+\.trycloudflare\.com", open("/tmp/cf.log").read() if os.path.exists("/tmp/cf.log") else "")
    if m: url=m.group(0); break
print("TUNNEL URL:", url, "\nSet hub Settings → Ollama base_url to this, model = mycoder-tuned-14b")
```

---

After Cell 6 → **Save Version** (keeps the GGUF). Then Cell 7 gives a tunnel URL →
paste it to Claude (or into hub Settings) and set the model to `mycoder-tuned-14b`.
