# Set H runbook — what to do when the gates fire

Written 2026-09-12 01:44 while the controls were still running, so a context break costs nothing. Everything here is
verified, not remembered.

## State at the time of writing

    controls RUNNING   coder14b-sethctl (A10G), coder30b-sethctl (H100) — started 00:59, no new goals after 02:26
    treatments PENDING coder14b-sethfix, coder30b-sethfix — both app names confirmed free
    gate           full offline suite on the treatment hub -> /tmp/suite-fix.log (87 files)
    keep-awake     armed 01:36 for 95 min (past the cap). AC confirmed, BatteryStatus 2.

    control hub    C:/Users/tatte/Projects/ai-coding-hub-setH @ 3f1114f (main)
                   runtime server/ byte-identical to dae46b2 — the hub set G measured
    treatment hub  C:/Users/tatte/Projects/ai-coding-hub-fix  @ eaa70c1 (detached)
                   runtime server/ byte-identical to committed eaa70c1 (only run-offline-suite.sh differs, not runtime)

## Gate 1 — the suite must be green BEFORE any treatment arm launches

    grep -c 'SUITE DONE' /tmp/suite-fix.log          # 1 when finished
    grep -cE '^--- exit [^0]' /tmp/suite-fix.log     # must be 0
    grep -E '^--- exit .*(rollbackBounded|editTruth|unverifiedFinishRecorded)' /tmp/suite-fix.log   # must show all 3

The three wave-1 tests MUST appear. An earlier run passed 84/84 without executing any of them, because
`run-offline-suite.sh` defaults `WT` to a different worktree and cd-s there silently. The suite now prints
`SUITE TREE: <path> @ <sha>` as its first line — check it says `ai-coding-hub-fix @ eaa70c1`.

## Gate 2 — the controls must stop cleanly

Watchdogs stop each app via `stopApp.mjs` only (Rule 7a) on `ALL DONE` or at 110 min. Then prove it independently:

    python -m modal app list --json      # both -sethctl apps must read state "stopped"

## Launch the treatment arms (concurrently, matching the controls' conditions)

    D=/c/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-12-setH
    # arm 2 (14B treatment)
    nohup bash $D/tools/watchdog.sh coder14b-sethfix $D/coder14b-sethfix.status $D/watchdog-coder14b-sethfix.log 110 &
    HUB_ENTRY=C:/Users/tatte/Projects/ai-coding-hub-fix/server/index.js CAP_MIN=95 \
      bash $D/tools/launch-H.sh coder14b-sethfix Qwen/Qwen2.5-Coder-14B-Instruct-AWQ A10G coder14b
    # arm 4 (30B treatment)
    nohup bash $D/tools/watchdog.sh coder30b-sethfix $D/coder30b-sethfix.status $D/watchdog-coder30b-sethfix.log 110 &
    HUB_ENTRY=C:/Users/tatte/Projects/ai-coding-hub-fix/server/index.js CAP_MIN=95 \
      bash $D/tools/launch-H.sh coder30b-sethfix Qwen/Qwen3-Coder-30B-A3B-Instruct H100 coder30b

The watchdog is armed BEFORE the deploy on purpose: `launch-H.sh` writes the status file first, so a failed deploy or a
failed identity check still marks ALL DONE and the app is still stopped. Rule 3: the health check must echo the exact HF
model before a single goal runs — it is in `<app>-deploy-and-identity.log`.

## Then compare

    cd $D && node tools/compare-setH.mjs

It prints, in this order: the four arms; the CONTROL-vs-set-G spread (the rig's first run-to-run variance estimate —
**no arm-to-arm difference smaller than that may be called real**); goals attempted per arm; duplicated definitions per
workspace; and the reminder that a flat score with more goals attempted and no corruption means the ceiling is the
model, not the tools.

The duplicate detector was validated against known ground truth before the run: on set G's kept workspaces it reproduces
`s6_graph.py` 1988 lines / `add_node x33, nodes x33` and `s3_matrix.js` 2375 lines / `constructor x27`, matching grep
counts of 28 `def __init__` and 27 `constructor`. Baseline in `setG-duplicate-baseline.txt`.

## What must NOT be claimed

- No difference between arms is real without reference to the control's variance figure.
- Statuses (done/stopped) are not results. Set G's `completed` went UP while the work got worse.
- Set G's regression numbers are `30B 78 run | 33 written | 29 end | 6 REGRESSED` and `14B 58 | 6 | 4 | 2`. The figures
  near COORD.md:4255 are SET F's and must not be quoted as set G's.

## Deliberately NOT in the treatment hub

`fix-ledger-taskdone` (b3cee6c, worktree `ai-coding-hub-ledger`) fixes `task_done` closing the wrong task — 43 of 44
live calls in set G. It is a real fix with 7/7 mutants, but it is NOT in `eaa70c1`: the pre-registration names exactly
three fixes, and adding a fourth after the fact would invalidate it. It belongs to the next wave.
