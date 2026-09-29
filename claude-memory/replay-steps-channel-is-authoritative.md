---
name: replay-steps-channel-is-authoritative
description: "replay-run.mjs detects refusals by regex over the PROMPTS served to the model, and the duplicate-refusal message is too long to survive into prompt text - it read 0 while the refusal actually fired; read these events from run.steps instead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1083fe36-a6a5-4016-ac41-924676bb2324
  modified: 2026-09-22T09:33:29.054Z
---

`measurements/replay/replay-run.mjs` derives its refusal counters (`destructiveRefused`,
`defLossWarnings`, `exportLossWarnings`, ...) by regex over `asked` - the prompts served to the mock
model. That channel is **lossy**.

Proven with a calibration control: a `write_file` duplicating `foo` 1->2 was refused (the file was
unchanged on disk and the run record carried `refused: it would have duplicated`), while a
prompt-derived detector for the same event read **0**. The duplicate refusal message is much longer
than the removal one and does not survive into the prompt text.

The removal refusal happens to agree on both channels - 16 scenarios / 33 events either way over 78
set G scenarios, zero disagreement - so the defect stays silent until you hit a long message.

**Why:** an absent count from this channel is *unrecorded*, not *measured*. Reporting it as zero is
the same error as reporting an unapplied mechanism's output as 0 instead of UNOBSERVABLE.

**How to apply:** read hub-side events from `run.steps` (`pushStep` notes), not from the prompts.
`benchmarks/destruction-controls/add-steps-detectors.mjs` in the `fix-tolerant-indent` worktree writes
a patched copy of the runner that does this, and
`benchmarks/destruction-controls/preservation-predicates.jsonl` holds three controls (duplicate
positive / clean negative / removal positive) that prove both predicates fire, stay silent when they
should, and do not cross-fire. Run any new replay discriminator against those before trusting a zero.

Related: [[offline-replay-rig]], [[measure-the-thing-itself]], [[silent-failures-are-the-class]],
[[detector-semantics-vs-route-governance]], [[over-strict-checkers-are-invisible-to-known-bad-tests]].
