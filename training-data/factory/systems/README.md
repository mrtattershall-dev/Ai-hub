# Systems build — correct, runnable, separated game systems (training seeds)

Purpose: stop the 14B copying *design* (good-looking, non-running code) and make it repeat
*correct systems*. Every file here is a hand-authored, self-contained module of separated
classes that communicate through explicit interfaces — and every file is **proven by
execution**, not just static analysis.

## The two-gate rule (enforced by `run_systems.mjs`)
A file becomes a training row only if it passes BOTH:
1. **Static gate** — acorn free-variable analysis (same as `../../verify_gate.mjs`): zero
   free vars = self-contained, no references to things that don't exist.
2. **Execution proof** — `node <file>` runs the module's self-checking demo, whose
   `assert(...)` calls throw on any wrong behaviour. A clean exit proves the systems work.

## Separation rules every file follows
- Each system is its own class with a small public API.
- Systems communicate only through method calls / dependency injection — **no shared
  mutable globals**, no reaching into another system's fields.
- Pure logic only (no DOM/canvas) so each file is runnable + testable in Node.
- Ends in a `--- self-checking demo ---` that wires the systems together and asserts the
  expected interaction (this is the proof layer, mirroring farming-systems-separation).

## Coverage (15 systems across 5 genres)
| genre | systems |
|-------|---------|
| rpg | inventory+equipment, combat/damage, leveling/xp |
| action | enemy-spawner (object pool), collision (spatial hash), scoring/combo |
| adventure | dialogue-tree + flags, world-rooms + keys, journal/deduction |
| casual | match-3 board, lives+score+state, power-up timer |
| simulation | **economy→market→store→inventory**, production chain, time/day-night/scheduler |

## Build it
```powershell
# (a) just the 15 hand seeds, gate + execute:
node systems/run_systems.mjs           # -> factory/dataset_systems.jsonl (15 rows)

# (b) scale to N execution-verified rows (15 seeds + synthesized variants):
node systems/gen_systems.mjs 200       # -> factory/dataset_systems.jsonl (200 rows, ~40/genre)

# then, from factory/:
Get-Content dataset_systems.jsonl | Add-Content ..\correctness\dataset.jsonl
```

## Scaling: `gen_systems.mjs`
Turns the proven seeds into parametric templates with **structural variants** (price
formula inverse|linear|fixed|taxed, xp curve linear|quadratic|geometric, mitigation
subtract|ratio|dodge, …) × 5 themes × numeric packs. Demos assert **invariants** (relations
true for any valid params), so correctness isn't tied to magic numbers. Every candidate is
gated AND executed; only unique passers become rows, filled to an even per-genre quota.
At 200: 15 seeds + 185 synthesized, 200/200 unique code blocks, balanced 40/40/40/40/40.
Diversity is structural+thematic; for fresh problem framings, layer `modal_generate.py` on
top. Quality is guaranteed by execution, not by the generator.

## How this fits the factory
These 15 are the **canonical correct exemplars**. `modal_generate.py`'s modular-systems
category (`SYSTEM_SETS`, `--systems_frac`) generates *variety* around the same patterns;
the gate keeps the runnable ones. Seeds teach the right shape; generation scales it. To
add a system: drop a `systems/<genre>/<name>.js` with a header doc-comment + self-checking
demo, re-run `run_systems.mjs` — if it proves out, it's a row.
