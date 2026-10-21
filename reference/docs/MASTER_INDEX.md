# MASTER INDEX — everything for the AI, the hub, Legasus and the data

Consolidated 2026-10-13 into `C:\Users\tatte\AI`. This file is the map. Nothing was deleted, merged,
committed or edited inside any repo; folders were renamed into place and a link was left at every old path.

## Layout

| Folder | What it is | Size |
|---|---|---|
| `hub\` | The AI coding hub: main clone `ai-coding-hub` + 26 linked git worktrees (one per branch/experiment). They must stay siblings — code uses `../ai-coding-hub-consolidation` style paths. | ~12 GB |
| `runs\` | Experiment run outputs and their launcher/watchdog logs: `pglive1-*`, `pglive2-*`, `lt1-run`, `ctx-exp`, `recov-exp`, `dust-harvest-repair`, `hub-human-test` (LIVE sandbox, see below). | ~0.4 GB |
| `evidence\` | Fuzz snapshots, replay traces, evidence runs, counterexamples and the exported PREREG/RESULT notes that were sitting in Downloads. `_loose\` holds the single files. | ~0.3 GB |
| `models-training\` | LoRA adapter zip, training notebooks, `correctness_dataset.jsonl`, `examples_done*.zip`. | ~0.15 GB |
| `engine\` | The earlier engine/editor era: `ai-native-engine`, `new-game-project`, and the prototype files from Downloads. | small |
| `odysseus\` | The Odysseus repo (upstream: pewdiepie-archdaemon/odysseus) with its venv. | 0.6 GB |
| `archives\` | `project-transfer` (June 2026 transfer kit), old hub copies/zips/bundle, old hub workspaces, copies of the OneDrive zips. | ~1.5 GB |
| `_consolidation\` | `move-log.csv` (every old path → new path), `before-snapshot.json`, `finish-when-jobs-stop.ps1`. | — |

## Where the three things you asked about actually are

- **The hub (product code):** `hub\ai-coding-hub` is the main clone (GitHub: `mrtattershall-dev/Ai-hub`).
  The reviewed product path is `hub\ai-coding-hub-product1` (branch `product-path-1` @ `b81231b5`).
  Branch `main` is checked out in `hub\ai-coding-hub-setH`. Status documents live in `hub\ai-coding-hub-phase1`
  (`CONSOLIDATION-1_MANIFEST.md`, `INTEGRATION-PLAN-1.md`, `COORD.md`).
- **Legasus:** not a separate folder — it is the `legasus\` directory inside the hub worktrees.
  Largest/most recent copy: `hub\ai-coding-hub-phase1\legasus` (corpora in `legasus\bench`, `legasus\records`).
  It was originally developed in `hub\ai-coding-hub-indent` (branch `fix-tolerant-indent`).
- **Data:** training data is `training-data\` inside each hub worktree (main: `hub\ai-coding-hub\training-data`);
  measurements are `measurements\` in `hub\ai-coding-hub-phase1`; run outputs are `runs\`; fuzz and evidence
  captures are `evidence\` plus `fuzz-out\` inside `hub\ai-coding-hub-fuzz3`.

## Hub worktrees (state on 2026-10-13)

"Uncommitted" = files changed but not committed; these were preserved exactly as they were.

| Folder in `hub\` | Branch | HEAD | Last commit | Uncommitted | Legasus files |
|---|---|---|---|---|---|
| ai-coding-hub (main clone) | fix/unverified-finish-recorded | c952cbc9 | 2026-09-23 | 32 | 2919 |
| ai-coding-hub-append | fix/append-preservation | 285f9db6 | 2026-09-26 | 0 | 719 |
| ai-coding-hub-baseline-chain | (detached) | 5d3b2a2a | 2026-09-29 | 0 | 1925 |
| ai-coding-hub-consolidation | candidate-0 | 456156e7 | 2026-10-01 | 72 | 3281 |
| ai-coding-hub-ctx | ctx-1 | aa4ef0e9 | 2026-10-01 | 0 | 719 |
| ai-coding-hub-evict | fix-interrupted-eviction | 5c16708c | 2026-09-12 | 0 | 0 |
| ai-coding-hub-fix | (detached) | eaa70c16 | 2026-09-12 | 1 | 0 |
| ai-coding-hub-fuzz2 | fuzz2-detail | c952cbc9 | 2026-09-23 | 5 | 719 |
| ai-coding-hub-fuzz3 **(LIVE, not yet moved)** | fuzz3-candidate0 | a59684d4 | 2026-10-06 | 9 | 2051 |
| ai-coding-hub-hfix | h-fixes | dae46b20 | 2026-09-11 | 0 | 0 |
| ai-coding-hub-indent | fix-tolerant-indent | 447e85cd | 2026-09-29 | 0 | 845 |
| ai-coding-hub-integration | integration/epistemic-admission | d14c4cc1 | 2026-10-01 | 0 | 1009 |
| ai-coding-hub-ledger | fix-ledger-taskdone | d0011558 | 2026-09-12 | 0 | 0 |
| ai-coding-hub-mechfollow | seth-followups | 3aa86a06 | 2026-10-03 | 0 | 719 |
| ai-coding-hub-mii | consolidation/merge-integration-indent | 761efaf3 | 2026-09-26 | 0 | 2198 |
| ai-coding-hub-parsegate | parse-gate-1 | 3201cf7e | 2026-10-05 | 17 | 2120 |
| ai-coding-hub-pgbase | (detached) | 456156e7 | 2026-10-01 | 0 | 2051 |
| ai-coding-hub-pgtest | pgtest-1 | 37574764 | 2026-10-06 | 4 | 2114 |
| ai-coding-hub-phase1 | phase2-d2-intervention | f962c639 | 2026-10-07 | 2 (+COORD note) | 3428 |
| ai-coding-hub-product1 **(LIVE, not yet moved)** | product-path-1 | b81231b5 | 2026-10-06 | 1 | 2051 |
| ai-coding-hub-rb | fix-rollback-bounded | 6b4f2f37 | 2026-09-12 | 0 | 0 |
| ai-coding-hub-recov | recov-exp | c43c05eb | 2026-10-01 | 0 | 719 |
| ai-coding-hub-repair | repair-r1-r8 | 45d866df | 2026-10-06 | 0 | 2051 |
| ai-coding-hub-reviewsnap | (detached) | b81231b5 | 2026-10-06 | 0 | 2051 |
| ai-coding-hub-setH | main | ae1aeee9 | 2026-09-12 | 8 | 0 |
| ai-coding-hub-slice | integration/governed-slice | 064e538d | 2026-09-29 | 0 | 730 |
| hub-crash1 | (detached) | c952cbc9 | 2026-09-23 | 1 | 719 |

## Links — read before deleting anything

Thousands of frozen records and scripts contain hard-coded paths, so every old location still works:

- `C:\Users\tatte\Projects\<name>` → junction to `AI\hub\<name>` or `AI\runs\<name>` (loose log files there are hard links).
- `C:\Users\tatte\odysseus` → junction to `AI\odysseus`.
- `C:\Users\tatte\Downloads\<evidence folder>` → junction to `AI\evidence\<name>` (10 folders).
- The Desktop shortcut "AI Coding Hub" still works through these.

Going the other way, these appear inside `AI\` but physically live elsewhere:

- `AI\hub\ai-coding-hub-fuzz3` and `AI\hub\ai-coding-hub-product1` → still in `C:\Users\tatte\Projects` because a fuzz
  campaign and the owner's human test were running from them on 2026-10-13. When those jobs are stopped, run
  `_consolidation\finish-when-jobs-stop.ps1`; it moves them and updates git's worktree bookkeeping.
- `AI\engine\ai-native-engine`, `AI\engine\new-game-project`, `AI\engine\new-game-project - Copy`,
  `AI\archives\hub-old-copies\desktop-ai-coding-hub-2026-06` → still in OneDrive (cloud-backed; Claude's memory for
  this project is keyed to the `OneDrive\Documents\ai-native-engine` path).

**A junction looks like a normal folder. Deleting "through" one deletes the real files.** To remove a link only:
`cmd /c rmdir "<link path>"` (no `/s`). Never `Remove-Item -Recurse` on `Projects`, or on `AI`, without checking.

## Left where it is (managed by an app — moving breaks it)

- `C:\Users\tatte\.ollama` — local model weights (4.9 GB).
- `C:\Users\tatte\.ai-hub\owner-token` — hub owner token (secret).
- `C:\Users\tatte\.claude` — Claude sessions and the project memory.
- `C:\Users\tatte\.cache\huggingface` — model cache.

## Not gathered (not clearly part of the AI work — say the word and they move too)

In `Downloads`: the game builds (`dust-harvest-*`, `cursebound*`, `turbo_drift*`, `aethelgard*`, `rouge-engine*`,
`byteminer*`), `ai-game-trainer*.html`, asset packs, `archive.zip`, `files*.zip`. In OneDrive: `art sketching app`,
`donut.blend`.
