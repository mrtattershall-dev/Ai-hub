---
name: native-hub-crash-standing
description: "2026-09-29 — recurring 0xC0000409 hub crash; seed-only reproduction RETIRED (falsified both ways), HANG→fetch-failed→CRASH is a death signature not a cause signature; evidence in ~/Downloads/fuzz-snapshot-2026-09-29"
metadata: 
  node_type: memory
  type: project
  originSessionId: de899dc4-22bd-4614-9c74-c8768ac7b97d
  modified: 2026-09-29T13:55:08.212Z
---

**Standing state:** native crash observed in the live fuzz campaign; cause unknown; seed not
sufficient; isolated clean replay stable; full raw fatal evidence not yet captured. CRASH-2 is
closed — the next investigation is a NEW frozen experiment varying ONE execution-context
dimension at a time.

Two results worth not re-deriving:

- **Seed-only reproduction is retired.** Falsified in both directions with byte-identical code
  (0 commits to `server/` in the window): seed 418175 crashed in the corpus and reran clean;
  418173 was clean in the corpus and crashed on rerun. The reproducer is a *run state*, not a
  seed — a documented OSS-Fuzz class.
- **`HANG → START threw: fetch failed → CRASH → truncated statuses` is a DEATH signature.** An
  external `Stop-Process` reproduces it exactly, so it means "the hub died mid-run" and carries
  no information about why. Not a discriminator.

Two apparatus traps, both caught by controls rather than reasoning:

- `fuzzForever` runs the **working tree**, not a commit — a sha pin is required, and editing
  `server/fuzzLoop.mjs` would change the live campaign mid-flight.
- A capture hook on `hub.on('exit')` never fires: `hub.kill()` is async and the harness exits
  first. Prove an instrument on the CRASH branch, not just on an ordinary exit, or its silence
  is uninterpretable.

Evidence lives in `~/Downloads/fuzz-snapshot-2026-09-29/` (STANDING.md is the index); the
instrumented harness is the detached worktree `~/Projects/hub-crash1` at c952cbc9. `crash-seeds.txt`
is an incident index, **not** a repro list. See [[standing-report-reporting-rules]] and
[[never-edit-or-pattern-kill-a-running-job]].
