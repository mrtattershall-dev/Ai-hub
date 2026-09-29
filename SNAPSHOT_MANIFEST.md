# SNAPSHOT 2026-09-29 — what is here, what is not, and why

Taken 2026-09-29 14:07–14:11 CDT, pushed 14:12–14:23 CDT to a PRIVATE repository (verified `Not Found`
to an unauthenticated request immediately before the push began).

## What a snapshot is

Each `snapshot/<worktree>-2026-09-29` branch is the **exact working state** of one worktree: its committed
history, plus every uncommitted edit, plus its gitignored research data. Each was built from a **private
temporary index**, so no branch, index or file in any worktree was changed by taking it. The working
branches themselves were already on GitHub, commit-identical, before this snapshot.

Stages on the main snapshot (`snapshot/ai-coding-hub-2026-09-29`), each its own commit:
`uncommitted-work → data-measurements → data-legasus → data-training → data-assets → data-other →
hub-config-redacted → vendor-godot-lfs`.

## Completeness — verified, not assumed

Every file on disk was compared with every file in its snapshot, per worktree:

| worktree | on disk | in snapshot | missing |
|---|---|---|---|
| ai-coding-hub | 26637 | 26642 | **1** (below) |
| ai-coding-hub-append / evict / fix / hfix / indent / ledger / phase1 / setH / consolidation, hub-crash1 | — | — | **0** each |

Three build defects were found by this check and fixed BEFORE the push, which is why it exists:
1. `:(exclude,glob)**/.git/**` and `:(exclude,glob)**/.env` combined with `git add -f` make git stage
   **nothing and exit 0** — every data stage of the first build was silently empty.
2. 13,523 individually ignored asset paths overflowed the command line ("Argument list too long").
3. The data groups named only some top-level directories; ignored data elsewhere (`benchmarks/`,
   `modal-serve/`) matched no group — 103 files in one worktree.

## EXPLICIT EXCLUSIONS

| path | reason |
|---|---|
| `measurements/2026-09-11-setD/data/coder30b-setd/workspace/10 + 20 + 5 = 35, not 45.` (worktree `ai-coding-hub`) | **Unreadable on Windows.** A model wrote this file during set D, naming it after an assertion message. Its name ends in `.`, which the Windows file API strips, so the file cannot be opened by name and git reports `unable to index file`. Its CONTENT is not recoverable through normal tools; its EXISTENCE is recorded here. |
| every `node_modules/` | Downloaded dependencies, reproducible from the committed lockfiles. |
| `training-data/factory/factory/_repos/dom-examples` | Third-party public repo: **https://github.com/mdn/dom-examples @ 72c9e5c**. Also holds a 119 MB pack file GitHub cannot accept. |
| `training-data/factory/factory/_repos/browser-games` | Third-party public repo: **https://github.com/juliensimon/browser-games @ 8fd6008**. |
| worktree `ai-coding-hub-baseline-chain` | Scratch copy created for the CHAIN-1 regression differential; holds no original work. |

## TRANSFORMED, not excluded

- **`server/hub.json` and its 7 backups** — present, with the live OpenRouter API key replaced by
  `REDACTED-OPENROUTER-KEY` (0 occurrences of the key prefix in the pushed files). The files on disk are
  unchanged. Restore the key locally from your own records; never commit it.
- **`vendor/godot/godot.exe`** (165 MB) — stored through **Git LFS**, oid `ef90e929…4cb00`, because
  GitHub rejects files over 100 MB.
- **Line endings** — uncommitted edits to tracked files follow the repository's own rules (`eol=lf`
  where declared), exactly as a normal commit would. Ignored data was stored byte-exact.

## Nested repositories, kept with FULL HISTORY

Four directories were git repositories of their own; git cannot store a repo inside a repo as files, so
each history was fetched and pushed as its own branch:

| directory | branch |
|---|---|
| `measurements/2026-09-11-coder3/data/coder30b-base-setA/workspace` | `snapshot/nested-coder30b-setA-workspace-2026-09-29` |
| `measurements/2026-09-11-coder3/data/coder30b-base-setB/workspace` | `snapshot/nested-coder30b-setB-workspace-2026-09-29` |
| `workspace` | `snapshot/nested-workspace-2026-09-29` |
| `pingpong-workspace` | `snapshot/nested-pingpong-workspace-2026-09-29` |

## Secret scan — categories and paths only, never values

Scanned every snapshot commit for key-shaped strings (`sk-`, `ghp_`, `gho_`, `github_pat_`, `AIza`, `hf_`,
`xox*`, `AKIA`, `BEGIN … PRIVATE KEY`) and for `.env`/`.pem`/`.key`/credential files.

| finding | category | disposition |
|---|---|---|
| `server/hub.json` + 6 backups | **live OpenRouter API key** | **REDACTED** before push |
| `training-data/factory/factory/dataset_repo_domex.jsonl` | PKCS#8 demo private key from MDN's web-crypto tutorial | public teaching material, not a credential |
| `server/.engine-cache/https_www.google_analytics.com_analytics.js` | Google's own public browser key, embedded in `analytics.js` | public, restricted to Analytics, not ours |
| `training-data/factory/raw/workspaces/error311__vimmonsters-academy/.env.example` | template from a third-party repo, placeholder values | no secrets |

**Verdict: clean.** All 15 snapshot commits and 4 nested histories passed.

## Licensing note

`assets/` contains third-party packs, several marked **"usable in games, REDISTRIBUTION NOT PERMITTED"**
(see `assets/LICENSES.md`). They were pushed only after the repository was made private. **If this
repository is ever made public again, remove `assets/` from the snapshot branches first.**
