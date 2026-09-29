---
name: legasus-location-and-discipline
description: "Where Legasus lives (the ai-coding-hub-indent worktree, branch fix-tolerant-indent), its hard boundaries (r3 frozen, Repo D owner-required, no publishing), and the commit discipline its hook enforces"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1083fe36-a6a5-4016-ac41-924676bb2324
  modified: 2026-09-20T08:52:59.207Z
---

Legasus (the authority-calculus / evidence-boundary project) lives in `~/Projects/ai-coding-hub-indent`, a git WORKTREE of `~/Projects/ai-coding-hub` on branch `fix-tolerant-indent` — not in the main clone. Ledger: `benchmarks/OVERNIGHT_LEDGER.md` (Entry 15 = 2026-09-20 composition-attack session, 25 commits `aa03ab9..4f93a79`). Quiesce state is computed by `node benchmarks/quiesce-check.mjs`.

**Why:** Two worktrees share one `.git`; a commit made in one is visible in the other's refs but not its files. The hub's fuzzer/servers run from the OTHER worktree; "nothing running" for Legasus is judged per-worktree.

**How to apply:**
- Hard boundaries the owner set (2026-09-20): `legasus-freeze-r3` and the Repo C prospective results are immutable; `FREEZE_R4_AND_SELECT_REPO_D` is OWNER_REQUIRED — never select, search for, inspect, or tailor to a Repo D candidate; never publish.
- Commit discipline (enforced by `.githooks/commit-msg.mjs`): a multi-line message must be written to a file (`scratch/mNN.txt`, next is m50), carry `Message-File: scratch/mNN.txt`, and be committed with `-F`. Write the message file with the editor, never a shell heredoc (three hazard-1 occurrences in one hour on 2026-09-20). No line may begin with `#` — git drops it as a comment and the hook refuses the mismatch.
- `git commit` commits the INDEX: `git rm` earlier in a session gets swallowed into an unrelated commit unless unstaged first (happened once; soft-reset and recommitted).
- Method the owner expects: preregister (own commit) → attack asserting the predicted defect beside a control → preserve the raw run → repair in separate commits, flipping the attack to a regression → focused tests, full suite, and every consuming rig against a baseline captured BEFORE the change. Predicted defects that don't reproduce are kept as falsifications.
- Run tests with `PYTHONDONTWRITEBYTECODE=1` so tracked `__pycache__` files don't dirty the tree. Full suite: `node --test $(find legasus -name '*.test.mjs')` (the two-level glob misses `legalabs/substrate/`).
