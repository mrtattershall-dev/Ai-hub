"""
modal_test.py — quick one-off: run a single prompt through any adapter (or base).

   python -m modal run factory/modal_test.py --prompt "Write code that explains personality"
   python -m modal run factory/modal_test.py --ref /adapters/v2 --prompt "..."

Loads the model, generates greedily, prints the output. For spot-checking, not batch eval.
"""
import modal

BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"
SYSTEM = ("You are a senior engineer who writes complete, self-contained, runnable code. "
          "Every identifier you reference must be declared or imported, declarations must "
          "precede use, and you only call methods/APIs that actually exist. Return code that "
          "runs as given.")

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
adapters = modal.Volume.from_name("qwen-adapters", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.11").apt_install("git")
    .pip_install("unsloth", "trl", "peft", "transformers", "datasets",
                 "accelerate", "bitsandbytes", "huggingface_hub", "hf_transfer")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)
app = modal.App("qwen-test")


@app.function(image=image, gpu="A100", timeout=60 * 30,
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters})
def gen(ref: str, prompt: str):
    from unsloth import FastLanguageModel
    model, tok = FastLanguageModel.from_pretrained(model_name=ref, max_seq_length=8192, dtype=None, load_in_4bit=True)
    FastLanguageModel.for_inference(model)
    text = tok.apply_chat_template([{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
                                   tokenize=False, add_generation_prompt=True)
    ins = tok(text, return_tensors="pt").to("cuda")
    out = model.generate(**ins, max_new_tokens=2048, do_sample=False, pad_token_id=tok.eos_token_id)
    return tok.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)


@app.local_entrypoint()
def main(ref: str = "/adapters/run1", prompt: str = "Write code that explains personality"):
    print(f"=== {ref} | prompt: {prompt} ===\n")
    print(gen.remote(ref, prompt))
