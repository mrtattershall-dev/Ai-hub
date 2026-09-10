"""
modal_smoke.py — cheap pre-flight for modal_train.py.

Answers three things in ONE container (model loaded once, so you pay the load tax once):
  1. does the unpinned unsloth/trl/peft image still build and run on today's CUDA?
  2. which (batch x accum) layout is fastest, at equal effective batch?
  3. what is peak GPU memory for each, i.e. how close to OOM are we?

    TRAIN_GPU=H100 python -m modal run factory/modal_smoke.py

Every config does identical work: 8 optimizer steps x 8 effective batch = 64 samples.
Runs smallest-first and catches OOM per-config, so a failure at bs=8 still leaves you
the results for bs=1/2/4 instead of losing the whole run.
"""
import os
import modal
from pathlib import Path

GPU = os.environ.get("TRAIN_GPU", "H100")
BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"
MAXLEN = int(os.environ.get("TRAIN_MAXLEN", "8192"))
DATA = Path(__file__).resolve().parent / "dataset_smoke.jsonl"

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("unsloth", "trl", "peft", "transformers", "datasets",
                 "accelerate", "bitsandbytes", "huggingface_hub", "hf_transfer")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .add_local_file(str(DATA), "/root/dataset.jsonl", copy=True)
)

app = modal.App("qwen-smoke")

# (per_device_batch, grad_accum) — all give effective batch 8, same as run3
CONFIGS = [(1, 8), (2, 4), (4, 2), (8, 1)]
STEPS = 8


@app.function(image=image, gpu=GPU, timeout=60 * 60, volumes={"/root/.cache/huggingface": hf_cache})
def smoke():
    import time, torch
    from unsloth import FastLanguageModel
    from trl import SFTTrainer, SFTConfig
    from datasets import load_dataset

    print(f"=== smoke on {GPU} | maxlen {MAXLEN} | {STEPS} steps x 8 effective batch ===", flush=True)
    t0 = time.time()
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE, max_seq_length=MAXLEN, dtype=None, load_in_4bit=True)
    model = FastLanguageModel.get_peft_model(
        model, r=16, lora_alpha=16, lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth", random_state=42)
    print(f"[load] base+lora ready in {time.time()-t0:.0f}s", flush=True)
    total_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"[gpu ] {torch.cuda.get_device_name(0)} | {total_gb:.0f} GB total", flush=True)

    ds = load_dataset("json", data_files="/root/dataset.jsonl", split="train")
    ds = ds.map(lambda ex: {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)})
    bf16 = torch.cuda.is_bf16_supported()

    results = []
    for bs, accum in CONFIGS:
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        tag = f"bs={bs} accum={accum}"
        try:
            trainer = SFTTrainer(
                model=model, tokenizer=tokenizer, train_dataset=ds,
                args=SFTConfig(
                    dataset_text_field="text", max_seq_length=MAXLEN, packing=False,
                    per_device_train_batch_size=bs, gradient_accumulation_steps=accum,
                    warmup_steps=0, max_steps=STEPS, learning_rate=2e-4,
                    fp16=not bf16, bf16=bf16, logging_steps=1000,
                    optim="adamw_8bit", weight_decay=0.01, lr_scheduler_type="constant",
                    seed=42, output_dir="/tmp/smoke", report_to="none",
                    save_strategy="no", disable_tqdm=True))
            t = time.time()
            out = trainer.train()
            dt = time.time() - t
            peak = torch.cuda.max_memory_allocated() / 1e9
            sps = out.metrics.get("train_samples_per_second", STEPS * bs * accum / dt)
            results.append((tag, dt, sps, peak, total_gb, "ok"))
            print(f"[bench] {tag:16} {dt:6.1f}s  {sps:5.2f} samples/s  peak {peak:5.1f} GB  OK", flush=True)
        except torch.cuda.OutOfMemoryError:
            results.append((tag, 0, 0, 0, total_gb, "OOM"))
            print(f"[bench] {tag:16} OOM — skipping", flush=True)
            torch.cuda.empty_cache()
        except Exception as e:
            results.append((tag, 0, 0, 0, total_gb, f"ERR {type(e).__name__}"))
            print(f"[bench] {tag:16} ERROR {type(e).__name__}: {str(e)[:160]}", flush=True)
            torch.cuda.empty_cache()

    print("\n=== RESULTS (equal work: 64 samples each) ===", flush=True)
    print(f"{'config':16} {'time':>8} {'samples/s':>11} {'peak GB':>9} {'headroom':>9}  status", flush=True)
    ok = [r for r in results if r[5] == "ok"]
    best = max(ok, key=lambda r: r[2])[0] if ok else None
    for tag, dt, sps, peak, tot, st in results:
        head = f"{tot-peak:.0f} GB" if st == "ok" else "-"
        star = "  <-- fastest" if tag == best else ""
        print(f"{tag:16} {dt:7.1f}s {sps:10.2f} {peak:8.1f} {head:>9}  {st}{star}", flush=True)
    if best:
        base = next(r for r in results if r[0] == "bs=1 accum=8")
        if base[5] == "ok":
            spd = max(ok, key=lambda r: r[2])[2] / base[2]
            print(f"\nfastest is {spd:.2f}x the bs=1 baseline that trained run3", flush=True)


@app.local_entrypoint()
def main():
    if not DATA.exists():
        raise SystemExit(f"missing {DATA}")
    smoke.remote()
