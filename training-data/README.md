# Training data for fine-tuning `mycoder`

This folder collects **examples** that will eventually be used to fine-tune
(QLoRA) the local model so it codes even more in your style. Building this is a
slow, accumulating project — quality and diversity matter far more than count,
but you do need volume.

## How much do I need?

- **~50 examples**: enough for a first experimental QLoRA run (will be rough).
- **~200–500+ diverse examples**: where it starts genuinely paying off.
- 30 near-identical versions of the same game ≠ 30 examples — that's basically 1.
  Variety (different mechanics, different modules, different problems) is what teaches.

## The format (easy to author)

Each example is a folder under `examples/`:

```
examples/
  0001-input-module/
    prompt.txt      <- the instruction (what to build)
    output.js       <- the ideal code answer (any extension: .js .html .css .py)
```

- `prompt.txt` = how a user would ask for that code.
- `output.*` = the correct, polished code you'd want the model to produce.
- One output file per example. Keep each output focused (a module/component),
  not a whole 30k-line game — small, clean, self-contained examples train best.

## Workflow

1. **Mine your projects** in `raw-projects/` — your multi-file games (turbo_drift,
   byteminer) are gold: each module (`physics.js`, `particles.js`, `ai.js`, …) is
   one ready-made example. Write a `prompt.txt` describing it, drop the file in as
   `output.js`.
2. **Capture new good builds** — whenever the agent (or you) makes something you
   like, save the prompt + the file as a new example folder.
3. **Build the dataset**: run `python build_dataset.py` → produces `dataset.jsonl`.
4. **Fine-tune** (later, on Colab T4): feed `dataset.jsonl` to Unsloth/LLaMA-Factory
   for a QLoRA run on `qwen2.5-coder`, export GGUF, import to Ollama as a new model.

## Tips for strong examples

- Prefer **single modules/components** over giant files.
- Make the `prompt.txt` realistic — phrase it like you'd actually ask.
- Keep your signature style in the outputs (IIFE modules, canvas loops,
  localStorage saves, Web Audio, semantic input, section-banner comments).
- De-duplicate: pick the *best* version of a thing, not every iteration.

The 3 seed examples here were taken from your `turbo_drift` game to show the shape.
