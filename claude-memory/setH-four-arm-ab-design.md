---
name: seth-four-arm-ab-design
description: "Set H (2026-09-12) - tatte asked for 2x14B and 2x30B, with and without the wave-1 fixes, so the hub is the only variable; wave 1 merged at eaa70c1 with 18 mutants all caught"
metadata:
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T06:24:02.189Z
---

tatte: "No, run 2 14 b one with the updates and one without", then "Run 2 30b models the same way. Take the four data
sheets and compare and do offline checks with said data". So set H is an **A/B on the hub**, not another cross-set
comparison: same 100 goals (`goals-H.json`, sha `1f29e971e72f9461`, byte-identical to F and G), same checker
(`checks-H.mjs`, `ea0d8b53535313ef`), same models and caps. Pre-registration committed before the window at `3f1114f`.

**Controls** (`coder14b-sethctl`, `coder30b-sethctl`) run a clean worktree pinned at `main`, whose runtime `server/` is
byte-identical to `dae46b2` - so they are simultaneously a replication of set G and the rig's **first run-to-run variance
estimate**. Without that number, no claim of the form "the fixes moved the score" is honest, including about the twenty
already merged.

**Treatment** (`coder14b-sethfix`, `coder30b-sethfix`) runs `eaa70c1`: three fixes, each red-first against a real hub,
**18 mutants run and 18 caught** - `finishKind` in both durable records, `edit_file` honesty + duplicate refusal +
repeat keyed on args, and the end-of-run repair bounded to the goal it is repairing.

**Harness defect found while preparing, and it affects how set G should be read**: `trialG.mjs:31` hardcoded the WORKING
TREE as the hub entry point while logging a commit sha, so such a launch can measure uncommitted code and look
authoritative. `trialH.mjs` takes `HUB_ENTRY`; every arm now pins an explicit worktree. A fresh worktree also lacks
gitignored paths - `node_modules` (junction it) and `training-data/factory/stopApp.mjs` (keep the stop path pointing at
the main checkout).

**Set G's regression numbers, recovered**: 30B `78 run | 33 worked when written | 29 at the end | 6 REGRESSED`; 14B
`58 | 6 | 4 | 2`. Against set F (30B `48 | 36 | 16` over 100 run) destruction fell sharply per goal attempted. I had
wrongly announced there was "no number" because the artefact was committed empty - a missing FILE is not a missing
RESULT.

**How to apply:** judge by the hidden checks against the workspace, never by status counts. Report the control's
variance before comparing arms. The countable check that does not need the score to move: the treatment workspace should
hold no duplicated definitions where the control's does (set G left `s6_graph.py` at 1987 lines, 28 `def __init__`).

Related: [[setg-result-budget-is-the-ceiling]], [[long-run-accuracy-north-star]],
[[baseline-consumers-before-changing-shared-code]], [[honest-answer-can-disable-its-guard]].
