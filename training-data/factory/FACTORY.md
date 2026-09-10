# Data factory — generate-and-verify on Modal (strictly 14B)

The durable lever from the correctness pivot: a model writes small complete modules,
`verify_gate.mjs` keeps only the runnable ones = unlimited verified training data.
This runs that loop on Modal so the 16GB-Kaggle ceiling (300-at-a-time, "clean but
small") is gone. **No bigger model** — the BASE `Qwen2.5-Coder-14B-Instruct` generates;
the gate, not model size, is the quality guarantee (rejection sampling).

```
 Modal A100  ──generate──▶  raw/raw_vX.jsonl  ──process_raw.mjs (gate+dedup)──▶  factory/dataset_vX.jsonl
   (14B, vLLM)                                                                         │ append
                                                                                       ▼
                                                                      correctness/dataset.jsonl ──▶ train (CORRECTNESS_TRAIN.md)
```

## One-time setup
```powershell
pip install modal
modal token new        # opens browser, links your $30 account
# (modal.exe may not be on PATH -> use `python -m modal ...`)
```

## Train the 14B on Modal (`modal_train.py`)
Fine-tunes Qwen2.5-Coder-14B (LoRA, from base) on the cumulative `correctness/dataset.jsonl`,
on an A100 — same recipe as `correctness/CORRECTNESS_TRAIN.md`, just faster hardware.
```powershell
# from training-data/
python -m modal run factory/modal_train.py                      # 2 epochs, maxlen 8192
python -m modal run factory/modal_train.py --epochs 3 --run-name v0.4
python -m modal volume get qwen-adapters <run-name> ./<run-name>-adapter   # download adapter
```
Then serve base 14B + this adapter via your existing Ollama/Flask shim. Cost ≈ $1–2 per run
(A100-40GB, ~15–40 min). Adapter persists in the `qwen-adapters` Modal volume.

## Run a batch — the standard pipeline (each --out is one independent batch)
Two-stage validation: **static gate** (self-containment) then **execution filter** (does it run).
```powershell
# 1) GPU generation on Modal (writes to the gen-output volume; the only step that costs money)
python -m modal run --detach factory/modal_generate.py --n 4000 --out raw_b.jsonl
python -m modal volume get gen-output raw_b.jsonl ./factory/raw/raw_b.jsonl

# 2) STAGE 1 — static gate (free-var self-containment) + build train rows
node factory/process_raw.mjs factory/raw/raw_b.jsonl b      # -> factory/dataset_vb.jsonl

# 3) STAGE 2 — execution filter: node-runs each, DROPS proven-broken (threw/hung),
#    keeps runtime-clean + canvas (canvas pending the DOM stage). ~8% get dropped.
node factory/exec_validate.mjs factory/dataset_vb.jsonl --keep   # -> dataset_vb.execpass.jsonl

# 4) STAGE 3 — static architectural audit: DROPS monolith-when-separation-asked + orphan-class.
node factory/audit.mjs factory/dataset_vb.execpass.jsonl --filter  # -> ...execpass.auditpass.jsonl
#    (run without --filter anytime to just SEE the architecture numbers: systems/module,
#     DI interaction density, dead fields, disconnected systems, god-objects)

# 5) STAGE 3b (semantic, optional) — LLM-judge for domain/requirement fidelity (the
#    Personality≠Combat class). python -m modal run --detach factory/modal_judge.py ; keep verdict==pass.

# 6) (optional) diversity-subsample, then stack the validated rows onto the set
Get-Content factory/dataset_vb.execpass.auditpass.jsonl | Add-Content ../correctness/dataset.jsonl
```
Full hierarchy: **AST gate → node exec → static audit → LLM-judge** (→ headless-DOM stage for
canvas games is queued). Each stage catches a failure class the one below it can't see.
Then train via `factory/modal_train.py`. **Always run stage 2 now** — the static gate alone
passes ~98% but ~8% of those throw/hang at runtime (the gate can't see logic bugs). The
canvas games remain unvalidated until the **headless-DOM stage** (queued — jsdom / browser
running a few frames) brings them under execution check too.

## Budget
- A100-40GB ≈ **$2.50/hr** on Modal; ~2–3k generations/hr after warmup.
- **$30 ≈ 10 GPU-hr ≈ 20–30k generations.** Gate keeps ~30–60% → **thousands** of
  verified rows (you have 203 today).
- The 28GB weights download once into a persistent `hf-cache` volume; later runs skip it.
- Do it in batches (`--n 4000`) so a bad run wastes ~$1, not $30. Gate each batch and
  eyeball the VERIFIED% before spending more.

## Knobs
- `--n` generations per run. `--temperature` (default 0.85; raise for more diversity,
  the gate catches the extra junk).
- Prompt diversity lives in the `GENRES / MECHANICS / RENDER` banks in
  `modal_generate.py` — add categories there to widen coverage.
- Want HTML single-file games too? Add an HTML-targeted spec variant to the bank; the
  gate already handles `.html` via `extractJS`.

## Mining existing git repos (`harvest_repo.mjs`)

A quality supplement to generation — real human code, but the same gate applies:
```powershell
node harvest_repo.mjs https://github.com/<owner>/<repo> <version>
# clones shallow -> keeps only files that pass the gate, aren't minified, fit 14KB
# -> factory/dataset_repo_<version>.jsonl  (review, then append like above)
```
It rejects fragments (free vars), **minified** code (passes the gate but teaches
obfuscated style — kills js13k production builds), oversized files, and dupes.

**Vetted candidates (2026-06-16):**
- `juliensimon/browser-games` — 12 classic arcade games, vanilla, zero-dep, unminified,
  one `game.js` each. PERFECT style/stack match. **But every file is 32–98 KB** → all 12
  rejected as too-big at maxlen 8192. Gold as a held-out **eval set** (clean runnable
  targets) or as seeds for repair pairs; only usable as training rows at higher maxlen.
- `js13kGames/games` — thousands of entries, libs banned (good), but stores the
  **minified** production build → rejected by the minify guard. Not a bulk source.

**Modular-systems repos vetted (2026-06-16)** — for the economy→store→inventory
separation pattern. The harvester skips `test/`/`spec/` dirs + `*.test.js` (mocha/jasmine
globals otherwise show up as fake "fragments"):
- `darlingjs/darlingjs` — ECS engine, decoupled modules → **3 kept**.
- `mojotron/rpg-inventory` — **1 kept**; 3 rejected because the systems couple through
  script-tag GLOBALS (`Armory`, `GameUtilities`), not ES imports — i.e. the exact
  anti-pattern from farming-systems-separation. Gate rejecting them is correct.
- `hogart/rpg-tools` — 0 (AMD `define` wrappers).
Net: **4 verified rows from 3 repos.** Nobody publishes clean economy→store→inventory
ES-module separation at scale → that pattern must be GENERATED. `modal_generate.py` now
has a **modular-systems category** (`--systems_frac 0.35`, SYSTEM_SETS / SYSTEM_COMM):
each prompt asks for N systems as separate classes communicating only via injection/
events/explicit APIs — no shared globals — as one gate-clean file with a runnable demo.

## Human snippets (`harvest_snippets.mjs`)

Whole files are too big/coupled, but individual top-level functions often aren't. This
extracts each function/class/arrow-const from a repo, keeps its leading JSDoc with the
code, and keeps only ones that pass the gate (zero free vars) + `node --check` + size +
dedup. Adds real human STYLE and documentation the synthetic rows lack.
```powershell
node harvest_snippets.mjs <git-url> [<git-url> ...]   # -> factory/dataset_snippets.jsonl
```
Vetted (2026-06-16, all MIT): `AndrewRayCode/easing-utils` (24) + `adenekan41/helpers` (37)
= **61 self-contained human snippets**; `Tokimon/vanillajs-helpers` 0 (its helpers import
each other → free vars, correctly rejected). Caveat: snippets are gate-verified but NOT
execution-proven like the systems — they bring human idiom; the systems bring proven
behaviour. Prefer MIT/permissive sources.

## Human SYSTEMS (`harvest_human.mjs`)

For substantial real-human systems (not tiny functions): mines **module- and class-level**
units across many repos/styles. Per .js file it tries the WHOLE file first (import/export
stripped, must be self-contained); if coupled, it falls back to extracting self-contained
top-level classes/functions (JSDoc kept). Rejects: free vars, **coupled** code (`require(`
or relative import — those need an external file), minified, oversized (>14k), trivial
(<200 chars), dupes; runs `node --check` on each. `CAP=<n>` caps rows per repo for balance.
```powershell
node harvest_human.mjs <git-url> [<git-url> ...]      # -> factory/dataset_human.jsonl
$env:CAP=90; node harvest_human.mjs <urls>            # balance across many sources
```
Harvested 2026-06-16 from MIT data-structure/algorithm/FSM/behavior-tree/game repos
(trekhleb + mgechev + amejiarosario + loiane + TheAlgorithms + jakesgordon FSM + behavior3
+ quadtree-js + easystarjs …) → **406 self-contained human systems** (classes = real
systems, not one-liners). Post-clean: AsciiDoc `// tag::` build markers stripped; UMD
wrappers kept as legit style variety. Gate-verified self-contained, not execution-proven.

**The real finding:** "self-contained + vanilla + readable + *small enough*" is rare in
the wild — good whole games are too big, and the gate (correctly) won't take fragments.
That's why repos yield dozens, not thousands, and why generation stays the volume engine.
**Lever if you want those clean games:** Modal A100-40GB can train the 14B at
`max_seq_length=16384` (vs 8192) — then 32–60 KB games fit as whole-program rows. Bump
`MAX_CHARS` here + `MAXLEN` in CORRECTNESS_TRAIN.md together if you go that way.

## Hand-authored systems seeds (`systems/`)

15 correct, runnable, **execution-proven** game-systems modules across rpg / action /
adventure / casual / simulation — the canonical "correct code" exemplars (vs. the model
copying design). Each is separated classes communicating with no shared globals, ending in
a self-checking `assert` demo. `run_systems.mjs` keeps a file only if it passes BOTH the
static gate AND `node <file>` execution. Build the 15 seeds: `node systems/run_systems.mjs`.
**Scale to 200:** `node systems/gen_systems.mjs 200` turns the seeds into parametric
templates with structural variants × themes, executes every candidate, and fills an even
per-genre quota → `factory/dataset_systems.jsonl` (200 rows, 40/genre, all unique+runnable).
See `systems/README.md`. These seed the exact patterns `modal_generate.py` generates around.

## Why this trains it *better* (not just faster)
v0.1's 632 fragments taught "reference things that aren't here" → non-running code.
Every factory row is free-var-clean and deduped, so it only ever sees code where every
identifier is defined and every API is real. Scaling verified rows is the one lever that
moves correctness; this makes that scaling cheap.
