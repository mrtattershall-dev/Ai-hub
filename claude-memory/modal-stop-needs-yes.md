---
name: modal-stop-needs-yes
description: `python -m modal app stop <app>` prompts [y/N] and ABORTS (exit 1) in a non-interactive shell - always pass --yes, and a GPU watchdog must check the exit code and re-list apps
metadata:
  type: project
---
2026-09-10, 14B data run: `python -m modal app stop coder14b-base` printed "Are you sure...
[y/N]: Aborted!" and exited 1 from every non-interactive shell - my manual stop, a piped
`echo y |` (also refused: "no interactive terminal detected"), AND the 30-minute watchdog. The
app stayed `deployed` with a running container ~5 min past tatte's cap until
`python -m modal app stop <app> --yes` (exit 0, then "stopping...").

**Why:** a stop that silently does not happen is exactly what the GPU ledger rule exists to
prevent; the watchdog looked armed and would have billed until noticed.

**How to apply:** always `python -m modal app stop <app> --yes`. Any watchdog/teardown must
check the exit status and re-run `python -m modal app list` until the app is no longer
`deployed`/`stopping`, and say so loudly if it is. Related: [[gpu-cost-per-token]],
[[hub-location-and-coord]].

**Update, same night - use the helper, it is binding (COORD Rule 7a):** stop every Modal app
with `node training-data/factory/stopApp.mjs <app>` (in ~/Projects/ai-coding-hub; written by the
captain from this incident). Exit 0 = VERIFIED stopped (exact name via `modal app list --json`,
never the truncated table or a prefix; a typo'd name is a FAILURE). Exit 1 = may still be
billing; it has already retried and appended an "## ALARM (stopApp)" entry to COORD.md. A
hand-rolled `modal app stop` counts as a breach even when it works. Schedule watchdogs as
this command and treat its exit code as the result. (Uncommitted on disk as of 2026-09-10.)
