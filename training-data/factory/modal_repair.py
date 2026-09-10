"""
modal_repair.py - give the model ONE look at its own error and let it fix itself.

    python -m modal run factory/modal_repair.py --ref /adapters/run5 \
        --infile repair_in_run5.json --out repair_run5.jsonl

WHY THIS IS THE RIGHT QUESTION
------------------------------
The eval scored SINGLE-SHOT generation: one prompt, one answer, scored. That is a fair
measure of the adapter, and it is not how the hub actually runs. The hub verifies and
feeds the failure back - test_web, see_screen, verify_project, the agent loop. Godot
returns an exact parse error with a line number; Chromium returns the exact JS error;
node returns the assertion that failed.

So "can this be fixed without another train" reduces to a measurable question: how much
of the 10/32 failure does ONE repair round recover, given the real error text?

This is deliberately ONE round, not a loop to convergence. A loop would flatter the
result - the honest number is what a single look at the error buys, because that is what
distinguishes "the model knows this and slipped" from "the model does not know this".

Precedent worth remembering: prompting could NOT fix the Phaser asset problem earlier -
it plateaued at 2/6 across two intervention strengths, because that was missing knowledge
rather than a slip. Syntax errors are a different class. This measures which is which
instead of assuming.
"""
import json
import os
import modal

BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"
GPU = os.environ.get("EVAL_GPU", "A10G")

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
adapters = modal.Volume.from_name("qwen-adapters", create_if_missing=True)
gen_output = modal.Volume.from_name("gen-output", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("unsloth", "trl", "peft", "transformers", "datasets",
                 "accelerate", "bitsandbytes", "huggingface_hub", "hf_transfer")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

app = modal.App("qwen-repair")


@app.function(image=image, gpu=GPU, timeout=60 * 60,
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters, "/output": gen_output})
def repair(ref: str, items_json: str, out_name: str):
    from unsloth import FastLanguageModel

    adapters.reload()
    if ref.startswith("/adapters/") and not os.path.exists(ref):
        raise RuntimeError(f"adapter not found after reload: {ref}")

    items = json.loads(items_json)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=ref, max_seq_length=8192, dtype=None, load_in_4bit=True)
    FastLanguageModel.for_inference(model)

    rows = []
    for i, it in enumerate(items, 1):
        # The repair turn is a real conversation turn: system, the original ask, what the
        # model said, then the tool's verdict. That is exactly the shape the agent loop
        # produces, so the number this yields transfers to the product.
        msgs = [
            {"role": "system", "content": it["system"]},
            {"role": "user", "content": it["prompt"]},
            {"role": "assistant", "content": it["previous"]},
            {"role": "user", "content":
                f"That does not work. Running it produced this exact error:\n\n{it['error']}\n\n"
                f"Fix it and return the COMPLETE corrected program in one code block. "
                f"Do not explain — return the code."},
        ]
        text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ins = tokenizer(text, return_tensors="pt").to("cuda")
        out = model.generate(**ins, max_new_tokens=3072, do_sample=False,
                             pad_token_id=tokenizer.eos_token_id)
        gen = tokenizer.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)
        rows.append({"axis": it["axis"], "id": it["id"], "prompt": it["prompt"], "text": gen})
        print(f"[repair] {i}/{len(items)}  {it['axis']}/{it['id']}  {len(gen)} chars", flush=True)

    with open(f"/output/{out_name}", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    gen_output.commit()
    print(f"[repair] wrote {len(rows)} repairs to gen-output/{out_name}")
    return len(rows)


@app.local_entrypoint()
def main(ref: str = "/adapters/run5", infile: str = "repair_in_run5.json", out: str = "repair_run5.jsonl"):
    with open(infile, "r", encoding="utf-8") as f:
        items = f.read()
    n = repair.remote(ref, items, out)
    print(f"\ndone: {n} repairs from {ref}")
    print(f"  python -m modal volume get gen-output {out} ./factory/eval/eval_{out.replace('repair_', 'repaired_').replace('.jsonl','')}.jsonl")
