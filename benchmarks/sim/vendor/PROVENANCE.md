# vendor/ — provenance

Minimal copy of the `Grid` core from **life-simulator** by Changkun Ou, **MIT licence** (`LICENSE` here,
copied verbatim from upstream).

- Source: `life-simulator-main.zip` supplied by the user 2026-09-30,
  sha256 `7045517563ed8c9766462eedff426731a4d62a3335fabd86c915bd80a182a40a`.
- Files copied **unmodified**: `life/__init__.py`, `life/grid.py` (sha256 prefix `b2d4e71c35e38513`),
  `life/patterns.py` (`39bd63d1d79c4114`), `life/constants.py` (`45487d4dc5653529`), `life/rules.py`
  (`a16be5a57090b355`).
- Only what `grid.py` imports. `life/__init__.py` imports `life.app` lazily inside `main()`, so the 7,047-line
  curses app is never loaded.

Mutants for SIM-1 are applied to an in-memory copy of `grid.py` by the harness; nothing in this directory
is ever modified.
