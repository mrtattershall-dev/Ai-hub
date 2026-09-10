"""
modal_evalset.py - one reproducible evaluation across every axis run5 was trained on.

    python -m modal run factory/modal_evalset.py --ref /adapters/run5 --out eval_run5.jsonl
    python -m modal run factory/modal_evalset.py --ref /adapters/run4 --out eval_run4.jsonl

    python -m modal volume get gen-output eval_run5.jsonl ./factory/eval/eval_run5.jsonl
    node factory/score_run.mjs run4 run5

WHY THIS EXISTS
---------------
The run3/run4 numbers - Phaser 0/12, interpret 0/10, Strategy 0/4, Godot 0/3, code 9/9 -
were produced by hand through the hub's tabs. They were real measurements, but they were
not a SCRIPT, so "run the same eval on run5" meant retyping prompts into a UI while a GPU
billed by the minute. That is how a tight budget disappears into setup.

It also means the old numbers are not strictly comparable to anything: nobody wrote down
the exact prompts. So the honest move is to run BOTH adapters through THIS file and compare
those, rather than compare a scripted run5 against a hand-typed run4.

DESIGN
------
Each axis uses the EXACT system prompt its training rows used - copied from
trained_run5.jsonl, not paraphrased. Evaluating a slice under a different system prompt
than it was trained under measures the prompt, not the adapter.

Prompts are HELD OUT: none appears in the training set. Greedy decoding, so two runs of the
same adapter give the same output and any difference is the adapter.

A10G by default, not A100. This is generation, not training - roughly a quarter the price
for maybe half the speed, which is the right trade when the whole eval is ~40 prompts.
"""
import os
import modal

BASE = "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit"
GPU = os.environ.get("EVAL_GPU", "A10G")

# ── The five system prompts, verbatim from the training set ───────────────────
SYS_CODE = ("You are a senior engineer who writes complete, self-contained, runnable code. "
            "Every identifier you reference must be declared or imported, declarations must "
            "precede use, and you only call methods/APIs that actually exist. Return code that "
            "runs as given.")
SYS_PHASER = ("You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 "
              "programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, "
              "this.tweens, this.input, this.load, etc.). Return code that runs as given against Phaser 3.")
SYS_INTERPRET = ("You correctly interpret what the user actually wants — the right scope, the right "
                 "domain, and sensible defaults — even from a short or casual request. Lead with a "
                 "one-line comment stating your interpretation, then write the right code: not "
                 "over-built, not under-built, in the correct domain. Return code that runs as given.")
SYS_STRUCTURED = ("You produce structured planning documents. When the user asks for specific markdown "
                  "section headers, you return exactly those headers, in that order, each followed by "
                  "concise prose or bullets. You never return code blocks for a documentation request.")
SYS_GODOT = ("You write GDScript for Godot 4. A standalone script must `extends SceneTree`, do its work "
             "in `_init()`, and call `quit()` when finished or it will run forever. Use static typing "
             "where it helps, assert() to check results, and print() to report. Return code that runs as given.")

# ── Held-out prompts, tagged by axis ──────────────────────────────────────────
# axis, id, system, prompt
EVAL = [
    # -- correctness: the run4 baseline was 9/9, so this axis is a REGRESSION check.
    ("code", "inv_weight", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: an inventory system with a weight limit and equipment slots that apply stat modifiers, ending in a self-checking demo."),
    ("code", "combat_turn", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a turn-based combat system with initiative order and status effects (poison, stun), ending in a self-checking demo."),
    ("code", "crafting", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a crafting system where recipes consume inventory items and produce new ones, ending in a self-checking demo."),
    ("code", "dialogue", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a branching dialogue system whose choices set and check world flags, ending in a self-checking demo."),
    ("code", "saveload", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a save/load system that serializes game state to a JSON string and restores it, ending in a self-checking demo."),
    ("code", "astar", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: A* pathfinding on a grid with obstacles that returns the path, ending in a self-checking demo."),
    ("code", "quest", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a quest system tracking multi-step objectives that unlock a reward on completion, ending in a self-checking demo."),
    ("code", "economy", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a shop economy where prices shift with supply and demand, ending in a self-checking demo."),
    ("code", "statuseffect", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a status-effect system with stacking, durations that tick down, and expiry callbacks, ending in a self-checking demo."),
    ("code", "spatial_hash", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a spatial hash grid for 2D collision broad-phase with insert, query-region and clear, ending in a self-checking demo."),
    ("code", "eventbus", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: an event bus with on/off/once/emit and handlers that unsubscribe safely during emit, ending in a self-checking demo."),
    ("code", "loot_table", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a weighted loot table with a seeded PRNG so results are reproducible, ending in a self-checking demo."),
    ("code", "cooldown", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: an ability cooldown manager with charges that refill over time, ending in a self-checking demo."),
    ("code", "tilemap", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a tile map with flood fill and a line-of-sight check between two tiles, ending in a self-checking demo."),
    ("code", "resource_chain", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a production chain where machines consume inputs and emit outputs each tick, ending in a self-checking demo."),
    ("code", "undo_stack", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: an undo/redo stack over an editable document, ending in a self-checking demo."),
    ("code", "damage_calc", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a damage calculator with resistances, critical hits and damage-over-time, ending in a self-checking demo."),
    ("code", "schedule", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: an in-game clock with day phases and callbacks scheduled at future times, ending in a self-checking demo."),
    ("code", "pathcost", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: Dijkstra over a weighted graph returning both the path and its total cost, ending in a self-checking demo."),
    ("code", "reputation", SYS_CODE, "Write a complete, self-contained, runnable vanilla JavaScript module: a faction reputation system where helping one faction lowers standing with its rival, ending in a self-checking demo."),

    # -- phaser: the headline failure. run3 scored 0/12, run4 1/6. Every row in run5's
    #    Phaser slice rendered in real Chromium before it was kept, so this is the test
    #    that decides whether the rebuild worked. Scored by ACTUALLY RENDERING the output.
    ("phaser", "ph_runner", SYS_PHASER, "Write a complete Phaser 3 program: an endless runner where the player jumps over obstacles that scroll in from the right, with a score that increases over distance."),
    ("phaser", "ph_shooter", SYS_PHASER, "Write a complete Phaser 3 program: a top-down shooter where the player rotates toward the pointer and fires bullets at enemies that spawn at the edges."),
    ("phaser", "ph_match", SYS_PHASER, "Write a complete Phaser 3 program: a grid of coloured tiles where clicking two adjacent tiles swaps them, and matches of three or more clear and score."),
    ("phaser", "ph_platform", SYS_PHASER, "Write a complete Phaser 3 program: a platformer with arcade physics, a player that can jump between three platforms, and collectible stars."),
    ("phaser", "ph_breakout", SYS_PHASER, "Write a complete Phaser 3 program: a breakout game with a paddle following the pointer, a bouncing ball, and a wall of bricks that disappear when hit."),
    ("phaser", "ph_tween", SYS_PHASER, "Write a complete Phaser 3 program: a screen of shapes that tween between positions on a timer, with a click to pause and resume the tweens."),
    ("phaser", "ph_snake", SYS_PHASER, "Write a complete Phaser 3 program: a snake game on a grid where eating a pellet grows the snake and hitting itself restarts the round."),
    ("phaser", "ph_defense", SYS_PHASER, "Write a complete Phaser 3 program: towers placed by clicking that automatically fire at enemies walking a fixed path."),
    ("phaser", "ph_physics", SYS_PHASER, "Write a complete Phaser 3 program: arcade-physics boxes that fall, stack and collide with a draggable paddle."),
    ("phaser", "ph_camera", SYS_PHASER, "Write a complete Phaser 3 program: a world larger than the screen with a camera that follows a keyboard-controlled player and clamps at the world bounds."),
    ("phaser", "ph_particles", SYS_PHASER, "Write a complete Phaser 3 program: a particle emitter that bursts on click and changes colour with each burst."),
    ("phaser", "ph_ui", SYS_PHASER, "Write a complete Phaser 3 program: a health bar and score display that update when the player is hit, drawn with graphics rather than images."),
    ("phaser", "ph_scenes", SYS_PHASER, "Write a complete Phaser 3 program: two scenes — a title screen and a play scene — with a click to move between them."),
    ("phaser", "ph_pointer", SYS_PHASER, "Write a complete Phaser 3 program: shapes that can be dragged with the pointer and snap to a grid when released."),
    ("phaser", "ph_timer", SYS_PHASER, "Write a complete Phaser 3 program: a countdown timer that spawns a shape every second and ends the round at zero."),

    # -- godot: nothing in run4 taught GDScript at all, so 0/3 was the floor. Scored by
    #    parsing in real headless Godot.
    ("godot", "gd_inventory", SYS_GODOT, "Write a standalone GDScript for Godot 4: an inventory with add, remove, and a weight cap, asserting the results and printing a summary."),
    ("godot", "gd_state", SYS_GODOT, "Write a standalone GDScript for Godot 4: a state machine with idle/walk/attack transitions, asserting that illegal transitions are rejected."),
    ("godot", "gd_pathfind", SYS_GODOT, "Write a standalone GDScript for Godot 4: breadth-first pathfinding across a small grid with walls, asserting the path length."),
    # Godot went from 3 prompts to 15. At n=3 a real improvement from 0% to 30% would go
    # undetected 34% of the time; at n=15 that drops below 0.5%. This axis was carrying
    # the least evidence and the most weight in the run6 design.
    ("godot", "gd_quest", SYS_GODOT, "Write a standalone GDScript for Godot 4: a quest tracker with multi-step objectives that unlock a reward when all steps complete, asserting partial and full completion."),
    ("godot", "gd_dialogue", SYS_GODOT, "Write a standalone GDScript for Godot 4: a branching dialogue tree whose choices set world flags, asserting that a flag gates a later branch."),
    ("godot", "gd_loot", SYS_GODOT, "Write a standalone GDScript for Godot 4: a weighted loot table using a seeded random number generator, asserting the same seed gives the same result twice."),
    ("godot", "gd_timer", SYS_GODOT, "Write a standalone GDScript for Godot 4: a cooldown tracker that ticks down over simulated frames, asserting an ability is unusable then usable again."),
    ("godot", "gd_stats", SYS_GODOT, "Write a standalone GDScript for Godot 4: a character stat block with base values and modifiers that stack, asserting the derived totals."),
    ("godot", "gd_grid", SYS_GODOT, "Write a standalone GDScript for Godot 4: a 2D grid of tiles with a flood fill that returns the filled region size, asserting it against a known layout."),
    ("godot", "gd_save", SYS_GODOT, "Write a standalone GDScript for Godot 4: serialise a small game state to a JSON string and restore it, asserting a round trip preserves every field."),
    ("godot", "gd_craft", SYS_GODOT, "Write a standalone GDScript for Godot 4: a crafting system where recipes consume ingredients and produce an item, asserting a recipe fails when ingredients are missing."),
    ("godot", "gd_damage", SYS_GODOT, "Write a standalone GDScript for Godot 4: damage resolution with armour and resistances, asserting that resistance reduces damage as expected."),
    ("godot", "gd_spawn", SYS_GODOT, "Write a standalone GDScript for Godot 4: a wave spawner that increases enemy count per wave, asserting the counts for the first three waves."),
    ("godot", "gd_inventory_sort", SYS_GODOT, "Write a standalone GDScript for Godot 4: sort an inventory by rarity then by name, asserting the resulting order."),
    ("godot", "gd_events", SYS_GODOT, "Write a standalone GDScript for Godot 4: a small signal-free event dispatcher where handlers are stored as Callables and invoked by name, asserting a handler ran."),

    # -- structured: the Strategy regression. run4 answered a markdown request with a
    #    JavaScript class. Scored on "did it return markdown headers and NOT a code fence".
    ("structured", "st_launch", SYS_STRUCTURED, "Give me a launch plan with these exact markdown headers, in this order: ## Goal, ## Audience, ## Milestones, ## Risks. Prose or bullets under each."),
    ("structured", "st_arch", SYS_STRUCTURED, "Write an architecture brief for a 2D game engine using exactly these headers, in order: ## Overview, ## Subsystems, ## Data Flow, ## Open Questions."),
    ("structured", "st_postmortem", SYS_STRUCTURED, "Write a project postmortem with exactly these headers, in order: ## What Shipped, ## What Went Wrong, ## What We Changed, ## Next Time."),
    ("structured", "st_roadmap", SYS_STRUCTURED, "Draft a quarterly roadmap using exactly these headers, in order: ## Theme, ## Q1, ## Q2, ## Dependencies."),
    ("structured", "st_designdoc", SYS_STRUCTURED, "Write a game design brief with exactly these headers, in order: ## Pitch, ## Core Loop, ## Systems, ## Scope Cuts."),
    ("structured", "st_incident", SYS_STRUCTURED, "Write an incident report using exactly these headers, in order: ## Impact, ## Timeline, ## Root Cause, ## Prevention."),
    ("structured", "st_onboarding", SYS_STRUCTURED, "Write an onboarding guide with exactly these headers, in order: ## Setup, ## First Task, ## Who To Ask, ## Common Pitfalls."),
    ("structured", "st_review", SYS_STRUCTURED, "Write a code review checklist with exactly these headers, in order: ## Correctness, ## Readability, ## Tests, ## Performance."),
    ("structured", "st_migration", SYS_STRUCTURED, "Write a migration plan using exactly these headers, in order: ## Current State, ## Target State, ## Steps, ## Rollback."),
    ("structured", "st_spec", SYS_STRUCTURED, "Write a feature specification with exactly these headers, in order: ## Problem, ## Proposal, ## Non Goals, ## Open Questions."),

    # -- interpret: run4's biggest win (0/10 -> 12/12) and also what over-generalised and
    #    broke Strategy. Subsampled to ~28% in run5, so this axis checks the win SURVIVED
    #    the cut. Scored on "did it state its interpretation and pick the right domain".
    ("interpret", "in_personality", SYS_INTERPRET, "Write code that explains personality."),
    ("interpret", "in_personality_rpg", SYS_INTERPRET, "Add a personality system to my RPG character class."),
    ("interpret", "in_weather", SYS_INTERPRET, "make it rain"),
    ("interpret", "in_shop", SYS_INTERPRET, "shop thing"),
    ("interpret", "in_save", SYS_INTERPRET, "i need saving"),
    ("interpret", "in_speed", SYS_INTERPRET, "make it faster"),
    ("interpret", "in_hard", SYS_INTERPRET, "too easy, fix it"),
    ("interpret", "in_sound", SYS_INTERPRET, "add sound"),
    ("interpret", "in_map", SYS_INTERPRET, "the map is boring"),
    ("interpret", "in_ai", SYS_INTERPRET, "enemies are dumb"),
    ("interpret", "in_inventory", SYS_INTERPRET, "bag is full again"),
    ("interpret", "in_ui", SYS_INTERPRET, "cant read anything"),
    ("interpret", "in_balance", SYS_INTERPRET, "money is useless"),
    ("interpret", "in_progress", SYS_INTERPRET, "feels grindy"),
    ("interpret", "in_camera", SYS_INTERPRET, "cant see where im going"),
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

app = modal.App("qwen-evalset")


@app.function(image=image, gpu=GPU, timeout=60 * 90,
              volumes={"/root/.cache/huggingface": hf_cache, "/adapters": adapters, "/output": gen_output})
def generate(ref: str, out_name: str):
    import json
    from unsloth import FastLanguageModel

    # A container sees the volume as of when it mounted. An adapter committed minutes
    # ago is invisible without this - the same reload that run4's deploy needed.
    adapters.reload()
    if ref.startswith("/adapters/") and not os.path.exists(ref):
        raise RuntimeError(f"adapter not found on the volume after reload: {ref}")
    # GPU is read at MODULE level on the client; inside the container the env var is
    # absent, so printing it reports the default and not what was actually allocated.
    # Ask torch what we are really on - a log line that lies about the hardware is worse
    # than no log line.
    try:
        import torch
        _gpu = torch.cuda.get_device_name(0)
    except Exception:
        _gpu = GPU
    print(f"[evalset] loading {ref} on {_gpu}", flush=True)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=ref, max_seq_length=8192, dtype=None, load_in_4bit=True)
    FastLanguageModel.for_inference(model)

    rows = []
    for i, (axis, pid, system, prompt) in enumerate(EVAL, 1):
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
        text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ins = tokenizer(text, return_tensors="pt").to("cuda")
        out = model.generate(**ins, max_new_tokens=3072, do_sample=False,   # greedy = reproducible
                             pad_token_id=tokenizer.eos_token_id)
        gen = tokenizer.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)
        rows.append({"axis": axis, "id": pid, "prompt": prompt, "text": gen})
        print(f"[evalset] {i}/{len(EVAL)}  {axis}/{pid}  {len(gen)} chars", flush=True)
        # Commit after EVERY prompt, exactly like generate_hf.
        #
        # This used to write once at the end. A run stopped at prompt 19 - to stay inside
        # a budget - therefore produced NOTHING, and 19 paid-for generations were thrown
        # away ($1.14). The sibling function had this safeguard and this one did not,
        # which is the same "implemented in one place, not the other" defect the agent
        # audit exists to catch. If you add a third generate path, it commits per row too.
        with open(f"/output/{out_name}", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
        gen_output.commit()

    print(f"[evalset] wrote {len(rows)} generations to gen-output/{out_name}")
    return len(rows)


# ── Plain-transformers path, for models unsloth may not handle ────────────────
# Qwen3-Coder-30B-A3B is Qwen3MoeForCausalLM, and unsloth's MoE coverage is uncertain -
# a load that raises still bills for the GPU it raised on. transformers + bitsandbytes
# definitely handles it, and this is inference only, so unsloth's training speedups are
# not being given up.
#
# It lives in THIS file, sharing the EVAL list above, so a comparison against run4/run5
# is guaranteed to use byte-identical prompts. That guarantee is the whole point.
HF_GPU = os.environ.get("HF_EVAL_GPU", "A100-80GB")

hf_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch", "transformers>=4.51", "accelerate", "bitsandbytes",
                 "huggingface_hub", "hf_transfer", "sentencepiece", "protobuf")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)


@app.function(image=hf_image, gpu=HF_GPU, timeout=60 * 60,
              volumes={"/root/.cache/huggingface": hf_cache, "/output": gen_output})
def generate_hf(ref: str, out_name: str, max_new: int = 3072):
    # MUST match the unsloth path's 3072. It was 2048, and Qwen3-Coder-30B is verbose
    # enough (6k-12k chars/answer) that the cap truncated 3 of the first 4 generations
    # mid-statement. A truncated answer has no closing fence, so the scorer reads it as
    # "no code block" and fails it - a number that measures the cap, not the model.
    import json
    import time
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    t0 = time.time()
    print(f"[evalset-hf] loading {ref} on {HF_GPU} (4-bit nf4)", flush=True)
    # Quantize DURING load, layer by layer, so peak memory never holds the full bf16
    # copy - a 30B in bf16 is ~60GB and would not fit even here with room to generate.
    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                             bnb_4bit_compute_dtype=torch.bfloat16,
                             bnb_4bit_use_double_quant=True)
    tok = AutoTokenizer.from_pretrained(ref)
    model = AutoModelForCausalLM.from_pretrained(
        ref, quantization_config=bnb, device_map="auto", dtype=torch.bfloat16,
        trust_remote_code=True)
    model.eval()
    print(f"[evalset-hf] loaded in {time.time() - t0:.0f}s", flush=True)

    rows = []
    for i, (axis, pid, system, prompt) in enumerate(EVAL, 1):
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ins = tok(text, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(**ins, max_new_tokens=max_new, do_sample=False,
                                 pad_token_id=tok.eos_token_id)
        gen = tok.decode(out[0][ins["input_ids"].shape[1]:], skip_special_tokens=True)
        rows.append({"axis": axis, "id": pid, "prompt": prompt, "text": gen})
        print(f"[evalset-hf] {i}/{len(EVAL)}  {axis}/{pid}  {len(gen)} chars  "
              f"({time.time() - t0:.0f}s elapsed)", flush=True)
        # Write as we go. A run that dies at prompt 28 should not throw away 27 results
        # that were already paid for.
        with open(f"/output/{out_name}", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
        gen_output.commit()

    print(f"[evalset-hf] wrote {len(rows)} generations in {time.time() - t0:.0f}s")
    return len(rows)


@app.local_entrypoint()
def main(ref: str = "/adapters/run5", out: str = "eval_run5.jsonl", engine: str = "unsloth"):
    n = generate_hf.remote(ref, out) if engine == "hf" else generate.remote(ref, out)
    print(f"\ndone: {n} generations from {ref}")
    print(f"  python -m modal volume get gen-output {out} ./factory/eval/{out}")
    print(f"  node factory/score_run.mjs {out.replace('eval_', '').replace('.jsonl', '')}")
