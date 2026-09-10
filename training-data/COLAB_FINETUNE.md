# Fine-tuning `mycoder` on your code — Colab notebook

Run these cells **in order** in a Colab notebook with a **T4 GPU** runtime
(Runtime → Change runtime type → T4 GPU). This:

1. uploads your 632 code samples (`examples.zip` from `training-data/`)
2. uses your local model to write a real instruction for each (backtranslation)
3. builds `dataset.jsonl`
4. QLoRA fine-tunes qwen2.5-coder 7B (Unsloth)
5. exports GGUF and creates `mycoder-tuned` in Ollama

> First run may need debugging (Unsloth/GGUF versions move fast). Paste any error
> back to Claude. The backtranslation step is resume-safe — re-running skips work
> already done.

---

### Cell 1 — make sure Ollama + the harvest model are available
```python
import subprocess, time, os, requests
os.environ["OLLAMA_HOST"] = "0.0.0.0:11434"
subprocess.Popen(["ollama", "serve"], stdout=open("ollama.log","w"), stderr=subprocess.STDOUT)
time.sleep(6)
# 7B is used to WRITE the instructions (fast); pull if missing
subprocess.run("ollama pull qwen2.5-coder:7b", shell=True)
print("ollama up:", requests.get("http://localhost:11434/api/tags").ok)
```

### Cell 2 — upload examples.zip and unzip
```python
from google.colab import files
import zipfile, pathlib
up = files.upload()                       # pick training-data/examples.zip
name = next(iter(up))
with zipfile.ZipFile(name) as z: z.extractall(".")
EX = pathlib.Path("examples")
print("example folders:", len([d for d in EX.iterdir() if d.is_dir()]))
```

### Cell 3 — backtranslate: model writes an instruction for each module (resume-safe)
```python
import pathlib, requests, json
EX = pathlib.Path("examples")
BT = "http://localhost:11434/api/generate"

def instruction_for(code):
    code = code[:3500]
    p = (
        "You are given a code module from a vanilla-JS browser game.\n"
        "Write the SINGLE concise instruction a developer would give an AI to produce "
        "exactly this code. 1-2 sentences, imperative, no preamble, no code.\n\n"
        f"CODE:\n```\n{code}\n```\n\nInstruction:"
    )
    r = requests.post(BT, json={"model":"qwen2.5-coder:7b","prompt":p,"stream":False,
                                "options":{"temperature":0.3,"num_ctx":8192}}, timeout=180)
    return r.json().get("response","").strip().strip('"')

folders = sorted(d for d in EX.iterdir() if d.is_dir())
for i, d in enumerate(folders):
    pf = d / "prompt.txt"
    cur = pf.read_text(encoding="utf-8") if pf.exists() else ""
    if cur and "[REVIEW" not in cur:          # already done -> skip (resume)
        continue
    outs = [f for f in d.iterdir() if f.name.startswith("output")]
    if not outs: continue
    try:
        instr = instruction_for(outs[0].read_text(encoding="utf-8", errors="ignore"))
        if instr:
            pf.write_text(instr, encoding="utf-8")
    except Exception as e:
        print("skip", d.name, e); continue
    if i % 20 == 0: print(f"{i}/{len(folders)} done")
print("backtranslation complete")
```

### Cell 4 — build dataset.jsonl
```python
import json, pathlib
EX = pathlib.Path("examples")
SYSTEM = ("You are a senior software engineer and game developer who writes "
          "polished, self-contained vanilla-JS browser games.")
rows = []
for d in sorted(EX.iterdir()):
    if not d.is_dir(): continue
    pf, outs = d/"prompt.txt", [f for f in d.iterdir() if f.name.startswith("output")]
    if not pf.exists() or not outs: continue
    instr = pf.read_text(encoding="utf-8").strip()
    if not instr or "[REVIEW" in instr: continue
    code = outs[0].read_text(encoding="utf-8", errors="ignore")
    lang = outs[0].suffix.lstrip(".")
    rows.append({"messages":[
        {"role":"system","content":SYSTEM},
        {"role":"user","content":instr},
        {"role":"assistant","content":f"```{lang}\n{code}\n```"},
    ]})
with open("dataset.jsonl","w",encoding="utf-8") as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False)+"\n")
print("dataset rows:", len(rows))
```

### Cell 5 — install Unsloth
```python
!pip install -q "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

### Cell 6 — load qwen2.5-coder 7B (4-bit) + add LoRA
```python
from unsloth import FastLanguageModel
import torch
MAXLEN = 4096
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit",
    max_seq_length=MAXLEN, dtype=None, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(
    model, r=16, lora_alpha=16, lora_dropout=0,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing="unsloth", random_state=42)
```

### Cell 7 — format data + train
```python
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
ds = load_dataset("json", data_files="dataset.jsonl", split="train")
def fmt(ex): return {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)}
ds = ds.map(fmt)
trainer = SFTTrainer(
    model=model, tokenizer=tokenizer, train_dataset=ds,
    dataset_text_field="text", max_seq_length=MAXLEN, packing=False,
    args=TrainingArguments(
        per_device_train_batch_size=2, gradient_accumulation_steps=4,
        warmup_steps=5, num_train_epochs=2, learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(), bf16=torch.cuda.is_bf16_supported(),
        logging_steps=5, optim="adamw_8bit", weight_decay=0.01,
        lr_scheduler_type="linear", seed=42, output_dir="outputs"))
trainer.train()
```

### Cell 8 — export GGUF and create the Ollama model
```python
model.save_pretrained_gguf("mycoder-tuned", tokenizer, quantization_method="q4_k_m")
!ollama create mycoder-tuned -f ./mycoder-tuned/Modelfile
print("Done. New model: mycoder-tuned")
import requests
print([m["name"] for m in requests.get("http://localhost:11434/api/tags").json()["models"]])
```

---

After Cell 8: in your hub **Settings**, set the Ollama model to **`mycoder-tuned`**
(and make sure the tunnel base_url is current). Then compare it against `mycoder`
on a few builds to see if the fine-tune actually helped.

**Tip:** download the enriched dataset so the backtranslation work is saved —
`from google.colab import files; import shutil; shutil.make_archive('examples_done','zip','examples'); files.download('examples_done.zip')` —
then unzip it back over `training-data/examples/` on your laptop.
