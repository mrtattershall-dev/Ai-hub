#!/usr/bin/env python3
"""Convert examples/*/ folders into dataset.jsonl for fine-tuning.

Each example folder needs:
  prompt.txt     - the instruction
  output.<ext>   - the ideal code answer

Output: dataset.jsonl in chat format (system/user/assistant), one JSON per line —
the format Unsloth / LLaMA-Factory accept for QLoRA fine-tuning.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
EXAMPLES = ROOT / "examples"
SYSTEM = ("You are a senior software engineer and game developer who writes "
          "polished, self-contained vanilla-JS browser games.")

rows = []
for d in sorted(EXAMPLES.iterdir()):
    if not d.is_dir():
        continue
    prompt_file = d / "prompt.txt"
    outputs = sorted(f for f in d.iterdir() if f.name.startswith("output"))
    if not prompt_file.exists() or not outputs:
        print(f"  skip {d.name} (missing prompt.txt or output.*)")
        continue
    prompt = prompt_file.read_text(encoding="utf-8").strip()
    out_file = outputs[0]
    code = out_file.read_text(encoding="utf-8")
    lang = out_file.suffix.lstrip(".")
    completion = f"```{lang}\n{code}\n```"
    rows.append({"messages": [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt},
        {"role": "assistant", "content": completion},
    ]})

out_path = ROOT / "dataset.jsonl"
with open(out_path, "w", encoding="utf-8") as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

print(f"Wrote {len(rows)} example(s) to {out_path}")
if rows:
    print("Reminder: aim for ~200+ diverse examples before a serious fine-tune.")
