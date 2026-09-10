"""
modal_eval.py — generate from base vs run1 vs v2 on the SAME held-out prompts.

   python -m modal run factory/modal_eval.py

Loads each variant (base 14B, then base+run1 adapter, then base+v2 adapter), generates the
held-out EVAL_PROMPTS deterministically (greedy), and writes eval_<variant>.jsonl to the
gen-output volume. Then locally:  node factory/score_eval.mjs  -> the before/after table.

Prompts are HELD OUT — specific game/systems asks that are NOT in the training set, so this
measures generalization, not memorization. Greedy decoding so the comparison is reproducible.
"""
import modal

BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"
SYSTEM = ("You are a senior engineer who writes complete, self-contained, runnable code. "
          "Every identifier you reference must be declared or imported, declarations must "
          "precede use, and you only call methods/APIs that actually exist. Return code that "
          "runs as given.")

# Held-out prompts (NOT in training). Mix of canvas games (need headless DOM to fully verify)
# and pure-logic systems (node-runnable here). The racing game is the pivot's canonical probe.
EVAL_PROMPTS = [
    ["race", "Write a complete single-file vanilla JavaScript canvas game: a top-down car race with 3 AI opponents, lap counting, and a checkered finish line."],
    ["platformer", "Write a complete single-file vanilla JavaScript canvas game: a 2D platformer with double-jump, moving platforms, and collectible coins."],
    ["towerdef", "Write a complete single-file vanilla JavaScript canvas game: a tower defense where 3 tower types shoot waves of enemies that follow a path."],
    ["brick", "Write a complete single-file vanilla JavaScript canvas game: a brick-breaker with power-ups (multiball, wide paddle) and 3 levels."],
    ["fishing", "Write a complete single-file vanilla JavaScript canvas game: a fishing mini-game with a lowering hook, a reel-in mechanic, and a score for caught fish."],
    ["inv_weight", "Write a complete, self-contained, runnable vanilla JavaScript module: an inventory system with a weight limit and equipment slots that apply stat modifiers, ending in a self-checking demo."],
    ["combat_turn", "Write a complete, self-contained, runnable vanilla JavaScript module: a turn-based combat system with initiative order and status effects (poison, stun), ending in a self-checking demo."],
    ["crafting", "Write a complete, self-contained, runnable vanilla JavaScript module: a crafting system where recipes consume inventory items and produce new ones, ending in a self-checking demo."],
    ["dialogue", "Write a complete, self-contained, runnable vanilla JavaScript module: a branching dialogue system whose choices set and check world flags, ending in a self-checking demo."],
    ["saveload", "Write a complete, self-contained, runnable vanilla JavaScript module: a save/load system that serializes game state to a JSON string and restores it, ending in a self-checking demo."],
    ["astar", "Write a complete, self-contained, runnable vanilla JavaScript module: A* pathfinding on a grid with obstacles that returns the path, ending in a self-checking demo."],
    ["quest", "Write a complete, self-contained, runnable vanilla JavaScript module: a quest system tracking multi-step objectives that unlock a reward on completion, ending in a self-checking demo."],
    ["personality", "Write code that explains personality."],   # deliberately vague — domain-fidelity probe (does it build personality, or mislabel combat stats?)
    ["personality_rpg", "Add a personality system to my RPG character class."],  # in-context probe — does it build traits, or conflate with combat stats?
]

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

app = modal.App("qwen-eval")


@app.function(image=image, gpu="A100", timeout=60 * 60,
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters, "/output": gen_output})
def eval_model(ref: str, out_name: str):
    import json
    from unsloth import FastLanguageModel
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=ref, max_seq_length=8192, dtype=None, load_in_4bit=True)
    FastLanguageModel.for_inference(model)
    rows = []
    for pid, prompt in EVAL_PROMPTS:
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]
        text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ins = tokenizer(text, return_tensors="pt").to("cuda")
        out = model.generate(**ins, max_new_tokens=3072, do_sample=False,   # greedy = reproducible
                             pad_token_id=tokenizer.eos_token_id)
        gen = tokenizer.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)
        rows.append({"id": pid, "prompt": prompt, "text": gen})
    with open(f"/output/{out_name}", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    gen_output.commit()
    print(f"wrote {len(rows)} generations to gen-output / {out_name}")
    return len(rows)


@app.local_entrypoint()
def main():
    print("evaluating base vs run1 vs v2 on held-out prompts ...")
    eval_model.remote(BASE, "eval_base.jsonl")
    eval_model.remote("/adapters/run1", "eval_run1.jsonl")
    eval_model.remote("/adapters/v2", "eval_v2.jsonl")
    print("done. download:  python -m modal volume get gen-output eval_base.jsonl ./factory/eval/eval_base.jsonl  (and run1, v2)")
    print("then score:      node factory/score_eval.mjs")
