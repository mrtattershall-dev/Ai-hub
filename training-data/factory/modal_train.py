"""
modal_train.py — fine-tune Qwen2.5-Coder-14B (LoRA) on Modal, on an A100.

The "train better/faster" goal: same recipe as correctness/CORRECTNESS_TRAIN.md (train FROM
BASE, r=16, lora_dropout=0.05, 2 epochs) but on a real GPU instead of a Kaggle T4 — faster,
bigger batch, no GGUF/tunnel pain. Trains on the cumulative correctness set (870 rows).

Run (from training-data/, since modal.exe isn't on PATH):
    python -m modal run factory/modal_train.py                 # defaults: 2 epochs, maxlen 8192
    python -m modal run factory/modal_train.py --epochs 3 --run-name v0.4
Download the adapter when done:
    python -m modal volume get qwen-adapters <run-name> ./<run-name>-adapter
Then serve it with your existing Ollama/Flask shim (load base 14B + this adapter).

Cost: A100-40GB ~ $2-3/hr; 870 small rows x 2 epochs ≈ 15-40 min ≈ ~$1-2.
GPU: "A100" is 40GB (enough for 14B 4-bit LoRA). Use "A100-80GB" to raise batch size.
"""
import os
import modal
from pathlib import Path

GPU = os.environ.get("TRAIN_GPU", "A100")                 # 40GB default; "A100-80GB", "H100", "H200"
BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"      # train from base (clean comparison)
# Dataset is overridable so run 2 (different data) is a one-liner:
#   TRAIN_DATA=factory/dataset_v2.jsonl python -m modal run factory/modal_train.py --run-name v2
DATA = Path(os.environ["TRAIN_DATA"]).resolve() if os.environ.get("TRAIN_DATA") \
    else Path(__file__).resolve().parent.parent / "correctness" / "dataset.jsonl"

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
adapters = modal.Volume.from_name("qwen-adapters", create_if_missing=True)

# unsloth pulls a compatible torch/xformers/trl/peft set. If the build ever fails on a version
# conflict, pin the offending package here.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install("unsloth", "trl", "peft", "transformers", "datasets",
                 "accelerate", "bitsandbytes", "huggingface_hub", "hf_transfer")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .add_local_file(str(DATA), "/root/dataset.jsonl", copy=True)
)

app = modal.App("qwen-train")


# RAM: unsloth offloads gradients to CPU to save VRAM, so guarantee host memory
# explicitly rather than inheriting Modal's default for the GPU class.
@app.function(image=image, gpu=GPU, timeout=60 * 60 * int(os.environ.get("TRAIN_TIMEOUT_HRS", "4")),
              cpu=float(os.environ.get("TRAIN_CPU", "4")),
              memory=int(os.environ.get("TRAIN_MEM_MB", "16384")),
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters})
def train(epochs: int = 2, maxlen: int = 8192, lr: float = 2e-4, run_name: str = "run1"):
    import torch
    from unsloth import FastLanguageModel
    from trl import SFTTrainer, SFTConfig
    from datasets import load_dataset

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE, max_seq_length=maxlen, dtype=None, load_in_4bit=True)
    model = FastLanguageModel.get_peft_model(
        model, r=16, lora_alpha=16, lora_dropout=0.05,            # >0 resists memorization
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth", random_state=42)

    ds = load_dataset("json", data_files="/root/dataset.jsonl", split="train")
    ds = ds.map(lambda ex: {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)})
    print(f"training on {len(ds)} rows | maxlen {maxlen} | {epochs} epochs")

    bf16 = torch.cuda.is_bf16_supported()
    trainer = SFTTrainer(
        model=model, tokenizer=tokenizer, train_dataset=ds,
        args=SFTConfig(
            dataset_text_field="text", max_seq_length=maxlen, packing=False,
            per_device_train_batch_size=int(os.environ.get("TRAIN_BS", "1")),
            gradient_accumulation_steps=int(os.environ.get("TRAIN_ACCUM", "8")),  # product = effective batch
            # TRAIN_MAX_STEPS stops the run at a step count and writes a proper final
            # adapter, instead of an external watcher racing to kill the job.
            #
            # 2026-09-09: a watcher built to stop run6 at step 900 fired during session
            # teardown and killed it at step 306 - "Received a cancellation signal ...
            # killing task". A budget guard living OUTSIDE the training process can fire
            # for reasons that have nothing to do with the budget. This one cannot: the
            # trainer stops itself, anneals the LR to the cap, and saves normally.
            max_steps=int(os.environ.get("TRAIN_MAX_STEPS", "-1")),
            warmup_steps=5, num_train_epochs=epochs, learning_rate=lr,
            fp16=not bf16, bf16=bf16,
            logging_steps=10, optim="adamw_8bit", weight_decay=0.01,
            lr_scheduler_type="linear", seed=42, report_to="none",
            # FAILSAFE: checkpoint onto the persistent volume, not /tmp, so a
            # preemption/OOM/timeout loses minutes instead of the whole run.
            output_dir=f"/adapters/{run_name}_ckpt",
            save_strategy="steps",
            save_steps=int(os.environ.get("TRAIN_SAVE_STEPS", "100")),
            save_total_limit=2))

    # commit the volume after each checkpoint so it survives container death
    from transformers import TrainerCallback

    class CommitCheckpoint(TrainerCallback):
        def on_save(self, args, state, control, **kw):
            adapters.commit()
            print(f"  [failsafe] checkpoint committed at step {state.global_step}")

    trainer.add_callback(CommitCheckpoint())

    # resume automatically if a checkpoint from a previous attempt exists
    ckpt_dir = f"/adapters/{run_name}_ckpt"
    resume = os.path.isdir(ckpt_dir) and any(
        d.startswith("checkpoint-") for d in os.listdir(ckpt_dir))
    if resume:
        print(f"  [failsafe] resuming from existing checkpoint in {ckpt_dir}")
    stats = trainer.train(resume_from_checkpoint=resume)

    out = f"/adapters/{run_name}"
    model.save_pretrained(out)
    tokenizer.save_pretrained(out)
    adapters.commit()
    print(f"✅ adapter saved to volume 'qwen-adapters' / {run_name} | final loss {stats.training_loss:.4f}")


@app.local_entrypoint()
def main(epochs: int = 2, maxlen: int = 8192, run_name: str = "run1"):
    if not DATA.exists():
        raise SystemExit(f"dataset not found at {DATA}")
    print(f"dataset: {DATA}  ->  training on Modal {GPU} ...")
    train.remote(epochs=epochs, maxlen=maxlen, run_name=run_name)
    print(f"done. download the adapter:\n  python -m modal volume get qwen-adapters {run_name} ./{run_name}-adapter")
