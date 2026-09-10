# v0.2 patched training — backtranslate + train, one 300-patch at a time

You have three patches in this folder:

| Patch | Examples | Zip |
|---|---|---|
| v0.2.1 | 300 | `v0.2.1.zip` |
| v0.2.2 | 300 | `v0.2.2.zip` |
| v0.2.3 | 199 | `v0.2.3.zip` |

Each is a balanced cross-section of all your games (shuffled, seed 42). The folders
are still `[REVIEW]` stubs — backtranslation writes a real instruction per module.

**The loop (repeat per patch):** upload patch → **backtranslate its ~300 stubs**
(the only step that "overloads" at scale, hence 300 at a time) → append to the
cumulative `dataset.jsonl` → **train from base** on the whole thing → serve.

> Why train on the *cumulative* set (v0.1 632 + each patch) and not just the new
> 300? Training only on new data makes a LoRA forget the old. Retraining from base
> on everything each round is cheap (≤~1.4k rows) and keeps all prior skill.

---

## Round N (example: v0.2.1)

Kaggle notebook, **GPU T4**, **Internet On**. Attach as inputs:
- `v0.2.1.zip` (the patch)
- your current cumulative `dataset.jsonl` (start: the v0.1 632-row file from
  `training-data/dataset.jsonl`; after round 1 use the one this loop produces)

### Cell A — backtranslate the patch (clean 7B writer, resume-safe → /kaggle/working)
```python
import os, glob, subprocess, time, pathlib, requests, shutil
os.system("apt-get -qq install -y zstd >/dev/null 2>&1")
os.system("curl -fsSL https://ollama.com/install.sh | sh")
os.environ["OLLAMA_HOST"] = "0.0.0.0:11434"
subprocess.Popen(["ollama","serve"], stdout=open("/tmp/ol.log","w"), stderr=subprocess.STDOUT); time.sleep(6)
os.system("ollama pull qwen2.5-coder:7b")           # fast, clean instruction writer
BT = "http://localhost:11434/api/generate"

# auto-find the patch (the input folder with the most prompt.txt files)
cand = {}
for p in glob.glob("/kaggle/input/**/prompt.txt", recursive=True):
    root = pathlib.Path(p).parent.parent
    cand[root] = cand.get(root, 0) + 1
SRC = max(cand, key=cand.get); print("patch source:", SRC, "folders:", cand[SRC])
OUT = pathlib.Path("/kaggle/working/patch_done"); OUT.mkdir(exist_ok=True)

def instruction_for(code):
    code = code[:3500]
    p = ("You are given a code module from a vanilla-JS browser game.\n"
         "Write the SINGLE concise instruction a developer would give an AI to produce "
         "exactly this code. 1-2 sentences, imperative, no preamble, no code.\n\n"
         f"CODE:\n```\n{code}\n```\n\nInstruction:")
    r = requests.post(BT, json={"model":"qwen2.5-coder:7b","prompt":p,"stream":False,
                                "options":{"temperature":0.3,"num_ctx":8192}}, timeout=180)
    return r.json().get("response","").strip().strip('"')

folders = sorted(d for d in SRC.iterdir() if d.is_dir())
done = 0
for i, d in enumerate(folders):
    dst = OUT / d.name; dst.mkdir(exist_ok=True)
    outs = [f for f in d.iterdir() if f.name.startswith("output")]
    if not outs: continue
    for f in outs: shutil.copy(f, dst / f.name)
    pf = dst / "prompt.txt"
    if pf.exists() and "[REVIEW" not in pf.read_text(encoding="utf-8"): done += 1; continue  # resume
    try:
        instr = instruction_for(outs[0].read_text(encoding="utf-8", errors="ignore"))
        if instr: pf.write_text(instr, encoding="utf-8"); done += 1
    except Exception as e: print("skip", d.name, e)
    if i % 25 == 0: print(f"  {i}/{len(folders)} (done={done})")
print(f"backtranslated {done}/{len(folders)} -> {OUT}")
```

### Cell B — append the patch to the cumulative dataset.jsonl
```python
import json, pathlib, glob
SYSTEM = ("You are a senior software engineer and game developer who writes "
          "polished, self-contained vanilla-JS browser games.")
base = glob.glob("/kaggle/input/**/dataset.jsonl", recursive=True)
rows = [json.loads(l) for l in open(base[0], encoding="utf-8")] if base else []
print("starting rows:", len(rows))
OUT = pathlib.Path("/kaggle/working/patch_done"); added = 0
for d in sorted(OUT.iterdir()):
    if not d.is_dir(): continue
    pf = d / "prompt.txt"; outs = [f for f in d.iterdir() if f.name.startswith("output")]
    if not pf.exists() or not outs: continue
    instr = pf.read_text(encoding="utf-8").strip()
    if not instr or "[REVIEW" in instr: continue
    code = outs[0].read_text(encoding="utf-8", errors="ignore"); lang = outs[0].suffix.lstrip(".")
    rows.append({"messages":[{"role":"system","content":SYSTEM},
        {"role":"user","content":instr},
        {"role":"assistant","content":f"```{lang}\n{code}\n```"}]}); added += 1
with open("/kaggle/working/dataset.jsonl","w",encoding="utf-8") as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False)+"\n")
print(f"added {added} -> cumulative dataset.jsonl now {len(rows)} rows")
```

### Cell C — Save Version (Quick Save)
Keeps the new `dataset.jsonl` (and `patch_done/`). Download `dataset.jsonl` to keep
it as the cumulative file you upload for the *next* round.

### Cells D… — train
Run your bulletproof training cells on `/kaggle/working/dataset.jsonl`
(Cell 3 load base → Cell 4 train → Cell 5 save adapter → **Save Version**). Then
serve the new adapter with the Flask/Ollama shim (no GGUF needed).

---

## After all three patches
You'll have v0.1 (632) + v0.2 (~797) ≈ **1,430 examples**. The memory-card 88 become
**v0.3** the same way:
`python split_patches.py --version 0.3 --src patch-memory-card/examples`
(then run this loop on `v0.3.1.zip`).
