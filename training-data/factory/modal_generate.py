"""
modal_generate.py — the GPU half of the data factory.

Stays strictly 14B: the BASE Qwen2.5-Coder-14B-Instruct generates small, complete,
vanilla-canvas modules. We do NOT trust the output — generation is cheap, the
`verify_gate` (run locally afterward) is the quality guarantee. This is rejection
sampling: generate a lot, keep only what runs.

Pipeline:
    modal run modal_generate.py --n 4000 --out raw/raw_v0.4.1.jsonl
    node process_raw.mjs raw/raw_v0.4.1.jsonl 0.4.1     # gate + build train rows
    # append the kept rows to ../correctness/dataset.jsonl, then train (CORRECTNESS_TRAIN.md)

Budget math (A100-40GB ~ $2.5/hr on Modal):
    ~2-3k generations/hr after warmup. $30 ≈ 10 GPU-hr ≈ 20-30k generations.
    Gate keeps ~30-60% → thousands of verified rows (you have 203 today).
Run in batches: each `--out` file is one discrete batch you can gate independently.
"""
import json
import random
import modal

MODEL = "Qwen/Qwen2.5-Coder-14B-Instruct"

# Persist the HF download so re-runs don't re-pull 28GB of weights each time.
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
# Raw generations are written HERE (not returned to the client) so a detached run
# survives any local disconnect — same robustness as modal_train.py.
gen_output = modal.Volume.from_name("gen-output", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm", "huggingface_hub", "hf_transfer")   # unpinned: match Modal's current CUDA
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        # vLLM's flashinfer sampler JIT-compiles a CUDA kernel needing nvcc, which the slim
        # image lacks. Use the native torch sampler instead (no nvcc, no JIT).
        "VLLM_USE_FLASHINFER_SAMPLER": "0",
    })
)

app = modal.App("qwen-data-factory")

# ---------------------------------------------------------------------------
# Prompt bank — combinatorial so 20-30k generations stay diverse, not 30k clones.
# Everything is steered to the user's real stack: VANILLA single-file canvas/JS,
# NO frameworks/CDNs. That matters because the gate only whitelists standard
# globals, so a Phaser/p5 import would (correctly) be rejected as a "free var".
# ---------------------------------------------------------------------------
GENRES = [
    "a top-down arena shooter", "a side-scrolling platformer", "a falling-block puzzle",
    "a snake-style grid game", "a breakout/brick-breaker", "a tower-defense skirmish",
    "an asteroids-style space game", "a match-3 board", "a maze chase game",
    "a one-button endless runner", "a tile-based roguelike room", "a physics ball-drop game",
    "a rhythm tap game", "a card-flip memory game", "a turn-based tactics duel",
    "a fishing mini-game", "a farming plot simulator", "a typing-speed game",
    "a 2048-style slide game", "a flappy-style gap dodger",
]
MECHANICS = [
    "with a scoring system and a game-over state", "with collectible power-ups",
    "with an enemy spawner that ramps difficulty over time", "with a player health bar and respawn",
    "with a simple finite state machine (menu / playing / paused / gameover)",
    "with keyboard AND pointer controls", "with a particle burst effect on key events",
    "with a wave/level progression", "with a high-score saved to localStorage",
    "with a basic AI opponent", "with a countdown timer", "with a combo multiplier",
]
RENDER = [
    "Render on an HTML5 canvas with requestAnimationFrame.",
    "Render on an HTML5 canvas; keep the main loop deterministic with a fixed timestep.",
    "Render on a canvas sized to the window with devicePixelRatio handling.",
]
RULES = (
    "Constraints: ONE self-contained file, vanilla JavaScript only — no frameworks, "
    "no CDN scripts, no imports. Every identifier must be declared or a standard "
    "browser/canvas global; declarations must precede use; only call APIs that truly "
    "exist. The code must run as given with zero edits. Return exactly one fenced "
    "```javascript code block and nothing else."
)

# --- modular-systems category: clean inter-system communication (the user's
# farming-systems-separation pattern). Each set = systems that must talk through
# explicit interfaces, never shared globals. economy->store->inventory etc. ---
SYSTEM_SETS = [
    ["Economy", "Store", "Inventory"], ["Wallet", "Shop", "Inventory"],
    ["Bank", "Market", "Inventory"], ["Crafting", "Recipe", "Inventory"],
    ["Quest", "Reward", "Inventory"], ["Farm", "Crop", "Market"],
    ["Combat", "Health", "Loot"], ["Spawner", "EnemyPool", "Score"],
    ["Dialogue", "Flags", "Quest"], ["Skill", "Experience", "LevelUp"],
    ["Hunger", "Energy", "Clock"], ["Building", "Resource", "Economy"],
    ["Trade", "Reputation", "Faction"], ["Loot", "RarityTable", "Inventory"],
    ["Order", "Kitchen", "Customer"], ["Pricing", "Demand", "Store"],
]
SYSTEM_COMM = [
    "the Store reads prices from the Economy and, on a purchase, debits the Economy and adds the item to the Inventory",
    "each system exposes a small public API and is wired together by a top-level coordinator; no system reaches into another's internals",
    "systems communicate through an injected event bus (subscribe/emit), so no system imports another directly",
    "dependencies are passed in via constructors (dependency injection); a system never references a global from another system",
]
SYSTEM_RULES = (
    "Constraints: ONE self-contained vanilla JavaScript file. Implement each system as "
    "its OWN class with a clear public interface; systems must NOT share mutable globals "
    "or reach into each other's fields — they communicate only through the stated "
    "channel. At the bottom, include a short runnable demo that wires the systems "
    "together and exercises the interaction with console.log output. Every identifier "
    "declared, declarations precede use, runs as given. Return exactly one fenced "
    "```javascript code block and nothing else."
)
# Same correctness-first system prompt as build_correctness_dataset.mjs, so the
# factory rows match the rows already in correctness/dataset.jsonl.
SYSTEM = (
    "You are a senior engineer who writes complete, self-contained, runnable code. "
    "Every identifier you reference must be declared or imported, declarations must "
    "precede use, and you only call methods/APIs that actually exist. Return code "
    "that runs as given."
)


def _system_spec(rng):
    sset = rng.choice(SYSTEM_SETS)
    comm = rng.choice(SYSTEM_COMM)
    names = ", ".join(sset)
    return (f"Build {len(sset)} small, separated game systems in one file — {names} — "
            f"where {comm}.")


def build_specs(n: int, seed: int = 42, systems_frac: float = 0.35):
    """Mix of single-file games and modular-systems prompts. systems_frac controls
    how much of the batch targets the economy->store->inventory separation pattern."""
    rng = random.Random(seed)
    seen, specs = set(), []
    combos = [(g, m) for g in GENRES for m in MECHANICS]
    rng.shuffle(combos)
    i = 0
    while len(specs) < n:
        if rng.random() < systems_frac:
            spec = _system_spec(rng)
            user = f"{spec}\n\n{SYSTEM_RULES}"
        else:
            g, m = combos[i % len(combos)]
            r = rng.choice(RENDER)
            spec = f"Build {g} {m}. {r}"
            key = ("game", g, m, r)
            if key in seen and len(seen) < len(combos) * len(RENDER):
                i += 1
                continue
            seen.add(key)
            user = f"{spec}\n\n{RULES}"
        specs.append({"id": f"f{len(specs):05d}", "spec": spec,
                      "messages": [{"role": "system", "content": SYSTEM},
                                   {"role": "user", "content": user}]})
        i += 1
    return specs


@app.function(image=image, gpu="A100", timeout=60 * 60,
              volumes={"/root/.cache/huggingface": hf_cache, "/output": gen_output})
def generate(specs, out_name, temperature=0.85, max_tokens=3072):
    from vllm import LLM, SamplingParams
    llm = LLM(model=MODEL, dtype="bfloat16", gpu_memory_utilization=0.92,
              max_model_len=4096, enforce_eager=True)   # eager: avoid extra JIT/cudagraph paths
    sp = SamplingParams(temperature=temperature, top_p=0.95,
                        max_tokens=max_tokens, seed=None)
    outs = llm.chat([s["messages"] for s in specs], sp)
    path = f"/output/{out_name}"
    with open(path, "w", encoding="utf-8") as f:
        for s, o in zip(specs, outs):
            f.write(json.dumps({"id": s["id"], "spec": s["spec"],
                                "text": o.outputs[0].text}) + "\n")
    gen_output.commit()                          # persist so a disconnect can't lose it
    print(f"wrote {len(outs)} generations to volume 'gen-output' / {out_name}")
    return len(outs)


@app.local_entrypoint()
def main(n: int = 4000, out: str = "raw_b.jsonl", temperature: float = 0.85,
         systems_frac: float = 0.5):
    specs = build_specs(n, systems_frac=systems_frac)
    print(f"generating {len(specs)} specs on Modal A100 (temp={temperature}, systems {systems_frac:.0%})...")
    count = generate.remote(specs, out_name=out, temperature=temperature)
    print(f"done: {count} raw generations in volume 'gen-output' / {out}")
    print(f"download:  python -m modal volume get gen-output {out} ./factory/raw/{out}")
    print(f"then gate: node factory/process_raw.mjs factory/raw/{out} <version>")
