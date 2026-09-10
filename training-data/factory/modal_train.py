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

# The base model is overridable so a 32B run is a env-var away, NOT a code edit.
#
# It MUST be kept in step with BASE in modal_evalset.py: an adapter trained on 32B and
# evaluated against a 14B base measures nothing. Both read TRAIN_BASE/EVAL_BASE, and the
# eval prints the base it loaded so a mismatch is visible in the log rather than silent.
BASE = os.environ.get("TRAIN_BASE", "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit")

# A 32B in 4-bit is ~19GB of weights before optimizer state, gradients and activations.
# On a 40GB card that OOMs partway in - which costs the whole run, not just the step. Fail
# here instead, where it is free.
#
# GPU must be baked into the image env for the same reason BASE is: this module is imported
# again INSIDE the container, where TRAIN_GPU is unset. The first 32B attempt died on this
# very check - the container really was on an H100 (the decorator captured that at deploy)
# but re-resolved GPU to the "A100" default and refused itself. A guard that reads a value
# the container cannot see is a guard against the wrong thing.
if "32B" in BASE.upper() and GPU in ("A100", "A10", "A10G", "L4", "T4"):
    raise SystemExit(
        f"refusing to start: BASE is {BASE} but TRAIN_GPU={GPU}. "
        f"A 32B 4-bit LoRA needs 80GB - set TRAIN_GPU=H100 (or A100-80GB)."
    )
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
    # The resolved values are BAKED INTO THE IMAGE, not merely read from the local shell.
    # Module-level constants are re-evaluated when Modal imports this file INSIDE the
    # container, where TRAIN_BASE is unset - so without this, `TRAIN_BASE=...32B... modal
    # deploy` registers gpu=H100 (captured locally, at deploy) and then trains the 14B
    # default (resolved remotely, at import). An H100 billed to fine-tune the wrong model,
    # with nothing failing.
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "TRAIN_BASE": BASE, "TRAIN_GPU": GPU,
          "TRAIN_MAXLEN": os.environ.get("TRAIN_MAXLEN", "8192")})
    .add_local_file(str(DATA), "/root/dataset.jsonl", copy=True)
)

app = modal.App("qwen-train")


# RAM: unsloth offloads gradients to CPU to save VRAM, so guarantee host memory
# explicitly rather than inheriting Modal's default for the GPU class.
@app.function(image=image, gpu=GPU, timeout=60 * 60 * int(os.environ.get("TRAIN_TIMEOUT_HRS", "4")),
              cpu=float(os.environ.get("TRAIN_CPU", "4")),
              memory=int(os.environ.get("TRAIN_MEM_MB", "16384")),
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters})
def train(epochs: int = 2, maxlen: int = int(os.environ.get("TRAIN_MAXLEN", "8192")),
          lr: float = 2e-4, run_name: str = "run1"):
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
    # State the base explicitly. run5/run6 were compared against the wrong baseline once
    # already; a line in the log is the cheapest possible guard against repeating it.
    print(f"base {BASE} on {GPU}", flush=True)
    print(f"training on {len(ds)} rows | maxlen {maxlen} | {epochs} epochs")
    # Write the provenance next to the adapter. Which base an adapter was trained on is not
    # recoverable from the weights, and getting it wrong at eval time is a silent failure -
    # so it goes on the volume with the adapter that needs it.
    import json as _json, os as _os
    _os.makedirs(f"/adapters/{run_name}", exist_ok=True)
    with open(f"/adapters/{run_name}/PROVENANCE.json", "w") as _f:
        _json.dump({"base": BASE, "gpu": GPU, "rows": len(ds), "maxlen": maxlen,
                    "epochs": epochs, "lr": lr, "run_name": run_name}, _f, indent=2)

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
def main(epochs: int = 2, maxlen: int = int(os.environ.get("TRAIN_MAXLEN", "8192")),
         run_name: str = "run1"):
    if not DATA.exists():
        raise SystemExit(f"dataset not found at {DATA}")
    print(f"dataset: {DATA}  ->  training on Modal {GPU} ...")
    train.remote(epochs=epochs, maxlen=maxlen, run_name=run_name)
    print(f"done. download the adapter:\n  python -m modal volume get qwen-adapters {run_name} ./{run_name}-adapter")
